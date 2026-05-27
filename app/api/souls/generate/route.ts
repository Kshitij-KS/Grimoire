export const dynamic = "force-dynamic";
import { z } from "zod";
import { DAILY_LIMITS, FREE_TIER_LIMITS } from "@/lib/constants";
import { hasAiEnv } from "@/lib/env";
// import { getGeminiModel } from "@/lib/gemini"; // REPLACED — Groq handles generation now
import { groqGenerate, GROQ_MODEL_HEAVY } from "@/lib/groq";
import { checkAndIncrement, decrementRateLimit } from "@/lib/rate-limit";
import { jsonError, jsonRateLimited, requireUser, zodErrorResponse } from "@/lib/api";
import { parseSoulCard, soulCardPrompt } from "@/lib/soul-card";
import { initialsFromName } from "@/lib/utils";
import { requireWorldAccess } from "@/lib/world-access";

const schema = z.object({
  worldId: z.string().uuid(),
  name: z.string().min(2),
  avatarColor: z.string().min(4),
  description: z.string().min(40),
  soulId: z.string().uuid().optional(), // if provided, regenerate existing soul
});

async function generateSoulCard(userPrompt: string, name: string) {
  // Previously: const model = getGeminiModel(); await model.generateContent(attempt);
  // Now: groqGenerate with GROQ_MODEL_HEAVY (llama-3.3-70b-versatile) — best for soul card quality
  const attempts = [
    // Attempt 1: clean system + user separation
    async () => {
      const raw = await groqGenerate({
        model: GROQ_MODEL_HEAVY,
        messages: [
          { role: "system", content: soulCardPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 4096,
      });
      return parseSoulCard(raw.trim());
    },
    // Attempt 2: combined fallback prompt
    async () => {
      const raw = await groqGenerate({
        model: GROQ_MODEL_HEAVY,
        messages: [
          {
            role: "user",
            content: `${soulCardPrompt}\n\nCharacter name: ${name}\n\n${userPrompt}\n\nReturn only valid JSON matching the required shape exactly.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      });
      return parseSoulCard(raw.trim());
    },
  ];

  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Soul forge failed.");
}

function soulForgeErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown soul forge error.";
  if (error instanceof z.ZodError || message.includes("JSON repair failed")) {
    return Response.json(
      {
        error: "SOUL_CARD_INVALID_JSON",
        detail: "The AI returned a malformed soul card. Try again with a more specific character description.",
      },
      { status: 502 },
    );
  }

  if (
    // Groq error patterns
    message.includes("groq") ||
    message.includes("GROQ") ||
    // Legacy Gemini error patterns (kept for reference, commented out)
    // message.includes("GoogleGenerativeAI") ||
    // message.includes("fetching from https://generativelanguage.googleapis.com") ||
    message.includes("API key") ||
    message.includes("quota") ||
    message.includes("rate_limit")
  ) {
    return Response.json(
      {
        error: "SOUL_FORGE_MODEL_FAILED",
        detail: "The AI model could not complete the soul forge request.",
      },
      { status: 502 },
    );
  }

  return Response.json(
    {
      error: "SOUL_FORGE_FAILED",
      detail: message,
    },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!hasAiEnv()) {
    return jsonError("AI_NOT_CONFIGURED", 503, {
      detail: "Missing GROQ_API_KEY or GEMINI_API_KEY on the server.",
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
  const isRegeneration = Boolean(parsed.data.soulId);
  const access = await requireWorldAccess(supabase, user.id, parsed.data.worldId, "editor");
  if (!access.allowed) return jsonError("FORBIDDEN", 403);

  if (parsed.data.soulId) {
    const { data: existingSoul } = await supabase
      .from("souls")
      .select("id, world_id")
      .eq("id", parsed.data.soulId)
      .maybeSingle();

    if (!existingSoul) return jsonError("SOUL_NOT_FOUND", 404);
    if (existingSoul.world_id !== parsed.data.worldId) return jsonError("FORBIDDEN_WORLD_MISMATCH", 403);
  }

  // Only check soul count limit for new souls (not regenerations)
  if (!isRegeneration) {
    const [{ data: profile }, { count: soulCount }] = await Promise.all([
      supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
      supabase.from("souls").select("*", { head: true, count: "exact" }).eq("world_id", parsed.data.worldId),
    ]);

    const isFree = !profile || profile.plan === "free";
    if (isFree && (soulCount ?? 0) >= FREE_TIER_LIMITS.soulsPerWorld) {
      return Response.json({ error: "FREE_SOUL_LIMIT_REACHED" }, { status: 403 });
    }
  }

  const rate = await checkAndIncrement(supabase, user.id, "soul_generate", DAILY_LIMITS.soul_generate);
  if (!rate.allowed) return jsonRateLimited("soul_generate", rate.limit);

  const { data: loreChunks } = await supabase
    .from("lore_chunks")
    .select("content")
    .eq("world_id", parsed.data.worldId)
    .or(`content.ilike.%${parsed.data.name}%,entity_tags.cs.{${parsed.data.name}}`)
    .limit(4);

  const userPrompt = `${parsed.data.description}

Relevant lore:
${((loreChunks ?? []) as Array<{ content: string }>).map((chunk) => chunk.content).join("\n\n")}`;

  let soulCard;
  try {
    soulCard = await generateSoulCard(userPrompt, parsed.data.name);
  } catch (error) {
    console.error("Soul Forge Error:", error);
    await decrementRateLimit(supabase, user.id, "soul_generate");
    return soulForgeErrorResponse(error);
  }

  if (isRegeneration && parsed.data.soulId) {
    const { data: soul, error } = await supabase
      .from("souls")
      .update({ soul_card: soulCard, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.soulId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      await decrementRateLimit(supabase, user.id, "soul_generate");
      return Response.json(
        { error: "SOUL_UPDATE_FAILED", detail: error.message },
        { status: 500 },
      );
    }
    return Response.json({ success: true, soul, soul_card: soulCard });
  }

  const { data: soul, error } = await supabase
    .from("souls")
    .insert({
      world_id: parsed.data.worldId,
      user_id: user.id,
      name: parsed.data.name,
      description: parsed.data.description,
      soul_card: soulCard,
      avatar_color: parsed.data.avatarColor,
      avatar_initials: initialsFromName(parsed.data.name),
    })
    .select("*")
    .single();

  if (error) {
    await decrementRateLimit(supabase, user.id, "soul_generate");
    return Response.json(
      { error: "SOUL_INSERT_FAILED", detail: error.message },
      { status: 500 },
    );
  }
  return Response.json({ success: true, soul, soul_card: soulCard });
}
