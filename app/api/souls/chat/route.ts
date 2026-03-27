export const dynamic = "force-dynamic";
import { z } from "zod";
import { DAILY_LIMITS, SEMANTIC_CACHE_THRESHOLD } from "@/lib/constants";
import { hasAiEnv } from "@/lib/env";
import { getChatModel } from "@/lib/gemini";
import { embedText } from "@/lib/embeddings";
import { checkAndIncrement } from "@/lib/rate-limit";
import { jsonError, jsonRateLimited, requireUser, zodErrorResponse } from "@/lib/api";
import crypto from "crypto";
import { soulMatchesWorld } from "@/lib/soul-access";

const schema = z.object({
  worldId: z.string().uuid(),
  soulId: z.string().uuid(),
  message: z.string().min(1),
});

function hashPrompt(text: string): string {
  return crypto.createHash("sha256").update(text.trim().toLowerCase()).digest("hex");
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!hasAiEnv()) {
    return jsonError("AI_NOT_CONFIGURED", 503, {
      detail: "Missing GEMINI_API_KEY on the server.",
    });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { user, supabase } = auth;
  const rate = await checkAndIncrement(
    supabase,
    user.id,
    "chat_message",
    DAILY_LIMITS.chat_message,
  );
  if (!rate.allowed) return jsonRateLimited("chat_message", rate.limit);

  const [{ data: soul }, embedding] = await Promise.all([
    supabase
      .from("souls")
      .select("id, world_id, name, soul_card")
      .eq("id", parsed.data.soulId)
      .eq("user_id", user.id)
      .maybeSingle(),
    embedText(parsed.data.message),
  ]);

  if (!soul)
    return Response.json({ error: "SOUL_NOT_FOUND" }, { status: 404 });

  if (!soulMatchesWorld(soul.world_id, parsed.data.worldId)) {
    return Response.json({ error: "FORBIDDEN_WORLD_MISMATCH" }, { status: 403 });
  }

  const soulWorldId = soul.world_id;

  // ── Semantic Cache Check ──────────────────────────────────────────────
  try {
    const { data: cacheHits } = await supabase.rpc("match_semantic_cache", {
      query_embedding: embedding,
      soul_uuid: parsed.data.soulId,
      world_uuid: soulWorldId,
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
        const { data } = await supabase
          .from("conversations")
          .insert({
            soul_id: parsed.data.soulId,
            user_id: user.id,
            world_id: soulWorldId,
          })
          .select("*")
          .single();
        conversation = data;
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
    const { data } = await supabase
      .from("conversations")
      .insert({
        soul_id: parsed.data.soulId,
        user_id: user.id,
        world_id: soulWorldId,
      })
      .select("*")
      .single();
    conversation = data;
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

  const systemInstruction = `You are ${soul.name}. You are a fictional character in a worldbuilding project.

YOUR SOUL CARD:
${JSON.stringify(soul.soul_card, null, 2)}

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
- Speak entirely as this character. Never break character.
- Only know what your soul card says you know.
- If asked about something you don't know, respond as the character would.
- Keep responses 2-4 paragraphs max unless the scene demands more.
- Do not reference that you are an AI.
- When you rely heavily on a specific piece of lore for your answer, naturally mention the fact. The system tracks sources automatically.`;

  const history = lastMessages.map(
    (m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }),
  );

  let geminiStream;
  try {
    const model = getChatModel();
    geminiStream = await model.generateContentStream({
      systemInstruction,
      contents: [
        ...history,
        { role: "user", parts: [{ text: parsed.data.message }] },
      ],
    });
  } catch (error: unknown) {
    console.error("Gemini API error:", error);
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
        for await (const chunk of geminiStream.stream) {
          const text = chunk.text();
          if (text) {
            assistantText += text;
            controller.enqueue(encoder.encode(text));
          }
        }
      } catch (e) {
        console.error("Gemini stream error:", e);
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
}
