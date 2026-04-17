export const dynamic = "force-dynamic";
import { z } from "zod";
import { DAILY_LIMITS, FREE_TIER_LIMITS } from "@/lib/constants";
import { embedText, generateTavernResponse } from "@/lib/embeddings";
import { hasAiEnv } from "@/lib/env";
import { checkAndIncrement } from "@/lib/rate-limit";
import { jsonError, jsonRateLimited, requireUser, zodErrorResponse } from "@/lib/api";
import { userOwnsWorld } from "@/lib/world-access";

const sendSchema = z.object({
  worldId: z.string().uuid(),
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(2500),
  directedToSoulId: z.string().uuid().nullable().optional(),
});

const createSchema = z.object({
  worldId: z.string().uuid(),
  soulIds: z.array(z.string().uuid()).min(2).max(FREE_TIER_LIMITS.tavernSoulsPro),
  name: z.string().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user, supabase } = auth;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", 400);
  }

  // Route: create session
  if (typeof body === "object" && body !== null && "action" in body && (body as { action: unknown }).action === "create") {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);

    const ownsWorld = await userOwnsWorld(supabase, user.id, parsed.data.worldId);
    if (!ownsWorld) return jsonError("FORBIDDEN", 403);

    // ── Plan-gated soul count ───────────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();

    const isFree = !profile || profile.plan === "free";
    const soulLimit = isFree ? FREE_TIER_LIMITS.tavernSouls : FREE_TIER_LIMITS.tavernSoulsPro;

    if (parsed.data.soulIds.length > soulLimit) {
      return jsonError("TAVERN_SOUL_LIMIT", 403, {
        detail: isFree
          ? `Free accounts can gather up to ${FREE_TIER_LIMITS.tavernSouls} souls. Upgrade to Pro to unlock a 4th slot.`
          : `You can gather at most ${FREE_TIER_LIMITS.tavernSoulsPro} souls at once.`,
        limit: soulLimit,
        plan: isFree ? "free" : "pro",
      });
    }
    // ───────────────────────────────────────────────────────────────────

    const { data: matchedSouls } = await supabase
      .from("souls")
      .select("id")
      .eq("world_id", parsed.data.worldId)
      .eq("user_id", user.id)
      .in("id", parsed.data.soulIds);

    if ((matchedSouls ?? []).length !== parsed.data.soulIds.length) {
      return jsonError("INVALID_SOUL_SELECTION", 400);
    }

    const { data } = await supabase
      .from("tavern_sessions")
      .insert({
        world_id: parsed.data.worldId,
        user_id: user.id,
        soul_ids: parsed.data.soulIds,
        name: parsed.data.name ?? "The Tavern",
      })
      .select("*")
      .single();

    return Response.json({ session: data });
  }

  // Route: send message
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  if (!hasAiEnv()) {
    return jsonError("AI_NOT_CONFIGURED", 503, {
      detail: "Missing GEMINI_API_KEY on the server.",
    });
  }

  const rate = await checkAndIncrement(
    supabase,
    user.id,
    "tavern_message",
    DAILY_LIMITS.tavern_message,
  );
  if (!rate.allowed) return jsonRateLimited("tavern_message", rate.limit);

  const { sessionId, worldId, message, directedToSoulId } = parsed.data;

  const ownsWorld = await userOwnsWorld(supabase, user.id, worldId);
  if (!ownsWorld) return jsonError("FORBIDDEN", 403);

  // Fetch session and souls
  const { data: session } = await supabase
    .from("tavern_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .eq("world_id", worldId)
    .single();

  if (!session) return Response.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });

  const { data: souls } = await supabase
    .from("souls")
    .select("*")
    .in("id", session.soul_ids ?? []);

  if (!souls || souls.length === 0) return Response.json({ error: "NO_SOULS" }, { status: 400 });

  if (directedToSoulId && !souls.some((s) => s.id === directedToSoulId)) {
    return jsonError("INVALID_DIRECTED_SOUL", 400);
  }

  // Save user message
  await supabase.from("tavern_messages").insert({
    session_id: sessionId,
    soul_id: null,
    role: "director",
    directed_to: directedToSoulId ?? null,
    content: message,
  });

  // Get recent conversation history — cap at 8 turns to reduce context pressure with 3 souls
  const historyLimit = souls.length >= 3 ? 8 : 12;
  const { data: recentMessages } = await supabase
    .from("tavern_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(historyLimit);

  const history = (recentMessages ?? [])
    .reverse()
    .map((m: { role: string; content: string; soul_id: string | null }) => {
      const soul = souls.find((s) => s.id === m.soul_id);
      const speaker = soul ? soul.name : "Director";
      return `${speaker}: ${m.content}`;
    })
    .join("\n");

  // Get relevant lore
  const embedding = await embedText(message);
  const { data: loreChunks } = await supabase.rpc("match_lore_chunks", {
    world_uuid: worldId,
    query_embedding: embedding,
    match_count: 4,
  });

  const loreContext = (loreChunks ?? []).map(
    (c: { content: string }) => c.content,
  );

  const targetSoul = directedToSoulId
    ? souls.find((s) => s.id === directedToSoulId)?.name ?? null
    : null;

  // Build the set of valid soul names for hallucination guard
  const validSoulNames = new Set(souls.map((s: { name: string }) => s.name));

  // Generate responses
  const responses = await generateTavernResponse(
    souls.map((s) => ({ name: s.name, soul_card: s.soul_card ?? {} })),
    targetSoul,
    message,
    history,
    loreContext,
  );

  // Save soul responses — discard hallucinated names and sub-5-char responses
  const savedMessages = [];
  for (const resp of responses) {
    // Hallucination guard: reject any soul name not in this session
    if (!validSoulNames.has(resp.soulName)) continue;
    // Minimum length guard: skip empty/stub responses
    if (!resp.response || resp.response.trim().length < 5) continue;

    const soul = souls.find((s: { name: string }) => s.name === resp.soulName);
    if (!soul) continue;

    const { data: saved } = await supabase
      .from("tavern_messages")
      .insert({
        session_id: sessionId,
        soul_id: soul.id,
        role: "soul",
        content: resp.response,
      })
      .select("*")
      .single();

    if (saved) savedMessages.push({ ...saved, soulName: soul.name, avatarColor: soul.avatar_color });
  }

  await supabase
    .from("tavern_sessions")
    .update({ last_active: new Date().toISOString() })
    .eq("id", sessionId);

  return Response.json({ messages: savedMessages });
}


export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { supabase } = auth;
  const { searchParams } = new URL(request.url);
  const worldId = searchParams.get("worldId");
  const sessionId = searchParams.get("sessionId");

  if (sessionId) {
    const { data: session } = await supabase
      .from("tavern_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!session) return jsonError("FORBIDDEN", 403);

    const { data: messages } = await supabase
      .from("tavern_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    return Response.json({ messages: messages ?? [] });
  }

  if (worldId) {
    const ownsWorld = await userOwnsWorld(supabase, auth.user.id, worldId);
    if (!ownsWorld) return jsonError("FORBIDDEN", 403);

    const { data: sessions } = await supabase
      .from("tavern_sessions")
      .select("*")
      .eq("user_id", auth.user.id)
      .eq("world_id", worldId)
      .order("last_active", { ascending: false });

    return Response.json({ sessions: sessions ?? [] });
  }

  return Response.json({ error: "Missing worldId or sessionId" }, { status: 400 });
}
