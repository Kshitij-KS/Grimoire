export const dynamic = "force-dynamic";
import { z } from "zod";
import { DAILY_LIMITS, SEMANTIC_CACHE_THRESHOLD } from "@/lib/constants";
import { hasAiEnv } from "@/lib/env";
// import { getChatModel } from "@/lib/gemini"; // REPLACED — Groq handles generation now
import { groqStream, GROQ_MODEL_FAST, type GroqMessage } from "@/lib/groq";
import { embedText, assertModelConsistency, buildSoulSystemBlock } from "@/lib/embeddings";
import { checkAndIncrement } from "@/lib/rate-limit";
import { jsonError, jsonRateLimited, requireUser, zodErrorResponse } from "@/lib/api";
import crypto from "crypto";
import { soulMatchesWorld } from "@/lib/soul-access";
import { requireWorldAccess } from "@/lib/world-access";
import { withErrorMonitoring } from "@/lib/sentry";

// Model-consistency guard (R7.1, R7.2). No per-row stored model identifier is
// recorded in the schema (768-dim columns need no migration), so we pin the
// identifier the stored embeddings were generated with — HuggingFace
// all-mpnet-base-v2, matching `getEmbeddingModel()`. We assert the active model
// still matches before `match_semantic_cache` / `match_lore_chunks`; a mismatch
// suppresses those RPCs.
const STORED_EMBEDDING_MODEL = "huggingface:sentence-transformers/all-mpnet-base-v2";

const schema = z.object({
  worldId: z.string().uuid(),
  soulId: z.string().uuid(),
  message: z.string().min(1).max(2500),
});

function hashPrompt(text: string): string {
  return crypto.createHash("sha256").update(text.trim().toLowerCase()).digest("hex");
}

export const POST = withErrorMonitoring(async (request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!hasAiEnv()) {
    return jsonError("AI_NOT_CONFIGURED", 503, {
      detail: "Missing GROQ_API_KEY on the server.",
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { user, supabase } = auth;
  const [{ data: soul }, embedding] = await Promise.all([
    supabase
      .from("souls")
      .select("id, world_id, name, soul_card")
      .eq("id", parsed.data.soulId)
      .maybeSingle(),
    embedText(parsed.data.message),
  ]);

  if (!soul)
    return Response.json({ error: "SOUL_NOT_FOUND" }, { status: 404 });

  if (!soulMatchesWorld(soul.world_id, parsed.data.worldId)) {
    return Response.json({ error: "FORBIDDEN_WORLD_MISMATCH" }, { status: 403 });
  }

  const soulWorldId = soul.world_id;
  const access = await requireWorldAccess(supabase, user.id, soulWorldId, "editor");
  if (!access.allowed) return jsonError("FORBIDDEN", 403);

  const rate = await checkAndIncrement(
    supabase,
    user.id,
    "chat_message",
    DAILY_LIMITS.chat_message,
  );
  if (!rate.allowed) return jsonRateLimited("chat_message", rate.limit);

  // ── Semantic Cache Check ──────────────────────────────────────────────
  // Suppress the similarity RPCs (match_semantic_cache below and
  // match_lore_chunks further down) if the active model no longer matches the
  // model the stored embeddings were generated with (R7.2).
  assertModelConsistency(STORED_EMBEDDING_MODEL);
  try {
    const { data: cacheHits } = await supabase.rpc("match_semantic_cache", {
      query_embedding: embedding,
      soul_uuid: parsed.data.soulId,
      world_uuid: soulWorldId,
      user_uuid: user.id,
      threshold: SEMANTIC_CACHE_THRESHOLD,
    });

    if (cacheHits && cacheHits.length > 0) {
      const cached = cacheHits[0];

      // Increment hit count asynchronously
      supabase
        .from("semantic_cache")
        .update({ hit_count: (cached.hit_count ?? 0) + 1 })
        .eq("id", cached.id)
        .then(() => {});

      // Save messages
      let { data: conversation } = await supabase
        .from("conversations")
        .select("*")
        .eq("soul_id", parsed.data.soulId)
        .eq("user_id", user.id)
        .eq("world_id", soulWorldId)
        .maybeSingle();

      if (!conversation) {
        const { data: newConvo, error: insertErr } = await supabase
          .from("conversations")
          .insert({
            soul_id: parsed.data.soulId,
            user_id: user.id,
            world_id: soulWorldId,
          })
          .select("*")
          .single();
        if (insertErr || !newConvo) return jsonError("Failed to create conversation", 500);
        conversation = newConvo;
      }

      if (conversation) {
        await supabase.from("messages").insert([
          {
            conversation_id: conversation.id,
            role: "user",
            content: parsed.data.message,
          },
          {
            conversation_id: conversation.id,
            role: "assistant",
            content: cached.response,
          },
        ]);
        await supabase
          .from("conversations")
          .update({ last_active: new Date().toISOString() })
          .eq("id", conversation.id);
      }

      // Simulate streaming for cached response
      const encoder = new TextEncoder();
      const words = cached.response.split(/(\s+)/);
      const stream = new ReadableStream({
        start(controller) {
          let index = 0;
          const push = () => {
            if (index >= words.length) {
              controller.close();
              return;
            }
            controller.enqueue(encoder.encode(words[index]));
            index += 1;
            setTimeout(push, 8); // Faster for cached responses
          };
          push();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Cache": "HIT",
        },
      });
    }
  } catch (e) {
    // Semantic cache unavailable — continue without it
    console.warn("Semantic cache query failed:", e);
  }

  // ── Cache Miss: Generate via Gemini ───────────────────────────────────

  let { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("soul_id", parsed.data.soulId)
    .eq("user_id", user.id)
    .eq("world_id", soulWorldId)
    .maybeSingle();

  if (!conversation) {
    const { data: newConvo, error: insertErr } = await supabase
      .from("conversations")
      .insert({
        soul_id: parsed.data.soulId,
        user_id: user.id,
        world_id: soulWorldId,
      })
      .select("*")
      .single();
    if (insertErr || !newConvo) return jsonError("Failed to create conversation", 500);
    conversation = newConvo;
  }

  const [{ data: recentMessages }, { data: loreChunks }] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.rpc("match_lore_chunks", {
      world_uuid: soulWorldId,
      query_embedding: embedding,
      match_count: 4,
      filter_tags: [soul.name],
    }),
  ]);

  const lastMessages = (recentMessages ?? []).reverse();
  let compressedHistory = conversation.compressed_history ?? "";

  if ((recentMessages?.length ?? 0) > 5) {
    compressedHistory = lastMessages
      .slice(0, 2)
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join("\n");

    await supabase
      .from("conversations")
      .update({ compressed_history: compressedHistory })
      .eq("id", conversation.id);
  }

  // Track which lore chunks we're using for source attribution
  const sourceChunkIds = (loreChunks ?? []).map(
    (chunk: { id: string }) => chunk.id,
  );

  const systemInstruction = `You are ${soul.name}, a real person inside a living fictional world — not an assistant.

${buildSoulSystemBlock({ name: soul.name, soul_card: (soul.soul_card ?? {}) as Record<string, unknown> })}

RELEVANT WORLD LORE (with chunk IDs for attribution):
${(loreChunks ?? [])
  .map(
    (chunk: { id: string; content: string }) =>
      `[CHUNK:${chunk.id}] ${chunk.content}`,
  )
  .join("\n\n")}

CONVERSATION HISTORY SUMMARY:
${compressedHistory}

RULES:
- Speak entirely as this character. Never break character or reference being an AI.
- Only know what your soul card and the lore above say you know. If asked about something you don't know, react as this person would — deflect, guess, admit ignorance, get curious — never as a helpful assistant.
- Answer at a natural length: sometimes a single sharp line, sometimes a few sentences. Match the weight of what was asked. Do NOT default to multi-paragraph monologues.
- Do NOT reuse your own earlier phrasings, sentence openings, or pet images from this conversation. If you already made a point, advance it rather than restate it.
- Never quote your sample lines verbatim — they only show your cadence.
- When you lean heavily on a specific piece of lore, weave the fact in naturally. The system tracks sources automatically.`;

  // Convert message history from Gemini's {role, parts} format to Groq's {role, content} format
  // Previously: const history = lastMessages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const history: GroqMessage[] = lastMessages.map(
    (m: { role: string; content: string }) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: m.content,
    }),
  );

  // ── Cache Miss: Generate via Groq (was: Gemini) ───────────────────────
  // Previously: let geminiStream; const model = getChatModel(); geminiStream = await model.generateContentStream({...})
  let groqStreamResponse;
  try {
    groqStreamResponse = await groqStream({
      model: GROQ_MODEL_FAST,
      messages: [
        { role: "system", content: systemInstruction },
        ...history,
        { role: "user", content: parsed.data.message },
      ],
      temperature: 0.85,
      max_tokens: 2048,
      // Curb the 8B model's tendency to reuse stock openings and pet phrases.
      frequency_penalty: 0.4,
      presence_penalty: 0.3,
    });
  } catch (error: unknown) {
    console.error("Groq API error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to speak with the soul." },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();
  let assistantText = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Previously: for await (const chunk of geminiStream.stream) { const text = chunk.text(); ... }
        // Now: Groq OpenAI-compatible streaming with delta.content
        for await (const chunk of groqStreamResponse) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            assistantText += text;
            controller.enqueue(encoder.encode(text));
          }
        }
      } catch (e) {
        console.error("Groq stream error:", e);
      } finally {
        controller.close();

        // ── Post-stream: save to DB and semantic cache ──────────────────
        const finalText = assistantText.trim();
        if (finalText && conversation) {
          supabase.from("messages").insert([
            { conversation_id: conversation.id, role: "user", content: parsed.data.message },
            {
              conversation_id: conversation.id,
              role: "assistant",
              content: finalText,
              source_chunk_ids: sourceChunkIds.length > 0 ? sourceChunkIds : null,
            },
          ]).then(() => {});

          supabase.from("conversations")
            .update({ last_active: new Date().toISOString() })
            .eq("id", conversation.id)
            .then(() => {});

          const promptHash = hashPrompt(parsed.data.message);
          supabase.from("semantic_cache").insert({
            world_id: soulWorldId,
            soul_id: parsed.data.soulId,
            user_id: user.id,
            prompt_hash: promptHash,
            prompt_text: parsed.data.message,
            embedding,
            response: finalText,
          }).then(() => {});
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Cache": "MISS",
    },
  });
});
