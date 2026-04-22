export const dynamic = "force-dynamic";
import { z } from "zod";
import { DAILY_LIMITS, FREE_TIER_LIMITS } from "@/lib/constants";
import { hasAiEnv } from "@/lib/env";
import { getGeminiModel } from "@/lib/gemini";
import { checkAndIncrement } from "@/lib/rate-limit";
import { jsonError, jsonRateLimited, requireUser, zodErrorResponse } from "@/lib/api";
import { parseSoulCard, soulCardPrompt } from "@/lib/soul-card";
import { initialsFromName } from "@/lib/utils";

const schema = z.object({
  worldId: z.string().uuid(),
  name: z.string().min(2),
  avatarColor: z.string().min(4),
  description: z.string().min(40),
  soulId: z.string().uuid().optional(), // if provided, regenerate existing soul
});

async function generateSoulCard(userPrompt: string, name: string) {
  const model = getGeminiModel();
  const attempts = [
    {
      systemInstruction: soulCardPrompt,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    },
    `${soulCardPrompt}

Character name: ${name}

${userPrompt}

Return only valid JSON matching the required shape exactly.`,
  ];

  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      const result = await model.generateContent(attempt);
      return parseSoulCard(result.response.text().trim());
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Soul forge failed.");
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
  const isRegeneration = Boolean(parsed.data.soulId);

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
${(loreChunks ?? []).map((chunk) => chunk.content).join("\n\n")}`;

  let soulCard;
  try {
    soulCard = await generateSoulCard(userPrompt, parsed.data.name);
  } catch (error) {
    console.error("Soul Forge Error:", error);
    return Response.json(
      { error: "Failed to forge soul. The oracle may be resting or overwhelmed." },
      { status: 500 }
    );
  }

  if (isRegeneration && parsed.data.soulId) {
    const { data: soul, error } = await supabase
      .from("souls")
      .update({ soul_card: soulCard, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.soulId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
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

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true, soul, soul_card: soulCard });
}
