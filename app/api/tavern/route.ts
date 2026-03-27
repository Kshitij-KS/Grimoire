export const dynamic = "force-dynamic";
import { z } from "zod";
import { DAILY_LIMITS } from "@/lib/constants";
import { embedText, generateTavernResponse } from "@/lib/embeddings";
import { hasAiEnv } from "@/lib/env";
import { checkAndIncrement } from "@/lib/rate-limit";
import { jsonError, jsonRateLimited, requireUser, zodErrorResponse } from "@/lib/api";

const sendSchema = z.object({
  worldId: z.string().uuid(),
  sessionId: z.string().uuid(),
  message: z.string().min(1),
  directedToSoulId: z.string().uuid().nullable().optional(),
});

const createSchema = z.object({
  worldId: z.string().uuid(),
  soulIds: z.array(z.string().uuid()).min(2).max(4),
  name: z.string().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { user, supabase } = auth;
  const body = await request.json();

  // Route: create session
  if (body.action === "create") {
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);

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

  // Fetch session and souls
  const { data: session } = await supabase
    .from("tavern_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session) return Response.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });

  const { data: souls } = await supabase
    .from("souls")
    .select("*")
    .in("id", session.soul_ids ?? []);

  if (!souls || souls.length === 0) return Response.json({ error: "NO_SOULS" }, { status: 400 });

  // Save user message
  await supabase.from("tavern_messages").insert({
    session_id: sessionId,
    soul_id: null,
    role: "director",
    directed_to: directedToSoulId ?? null,
    content: message,
  });

  // Get recent conversation history
  const { data: recentMessages } = await supabase
    .from("tavern_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(12);

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

  // Generate responses
  const responses = await generateTavernResponse(
    souls.map((s) => ({ name: s.name, soul_card: s.soul_card ?? {} })),
    targetSoul,
    message,
    history,
    loreContext,
  );

  // Save soul responses
  const savedMessages = [];
  for (const resp of responses) {
    const soul = souls.find((s) => s.name === resp.soulName);
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
    const { data: messages } = await supabase
      .from("tavern_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    return Response.json({ messages: messages ?? [] });
  }

  if (worldId) {
    const { data: sessions } = await supabase
      .from("tavern_sessions")
      .select("*")
      .eq("world_id", worldId)
      .order("last_active", { ascending: false });

    return Response.json({ sessions: sessions ?? [] });
  }

  return Response.json({ error: "Missing worldId or sessionId" }, { status: 400 });
}
