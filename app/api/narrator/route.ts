export const dynamic = "force-dynamic";
import { z } from "zod";
import { DAILY_LIMITS } from "@/lib/constants";
import { hasAiEnv } from "@/lib/env";
import { hasSupabaseEnv } from "@/lib/public-env";
import { analyzeImpact, detectBlankSpots, orderEventsChronologically, embedText } from "@/lib/embeddings";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { jsonError, jsonRateLimited, requireUser, zodErrorResponse } from "@/lib/api";
import { checkAndIncrement } from "@/lib/rate-limit";
import { requireWorldAccess } from "@/lib/world-access";

// Accept any non-empty string worldId — "demo-world" is valid for demo mode
const worldIdSchema = z.string().min(1);

const impactSchema = z.object({
  worldId: worldIdSchema,
  scenario: z.string().min(5).max(2500),
  action: z.literal("impact"),
});

const blankSpotSchema = z.object({
  worldId: worldIdSchema,
  action: z.literal("blank-spots"),
});

const timelineSchema = z.object({
  worldId: worldIdSchema,
  action: z.literal("timeline"),
});

async function getSupabase() {
  if (!hasSupabaseEnv()) return null;
  try {
    return createServerSupabaseClient();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", 400);
  }

  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase: authSupabase } = auth;
  // Rate limit moved to individual action blocks
  const action = typeof body === "object" && body !== null && "action" in body
    ? String((body as { action: unknown }).action)
    : "";
  const supabase = await getSupabase();

  if (action === "impact") {
    const parsed = impactSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { worldId, scenario } = parsed.data;

    if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", 500);
    const isDemoWorld = worldId === "demo-world";
    if (!isDemoWorld) {
      const access = await requireWorldAccess(supabase, user.id, worldId, "viewer");
      if (!access.allowed) return jsonError("FORBIDDEN", 403);
    }

    const rate = await checkAndIncrement(
      authSupabase,
      user.id,
      "narrator_action",
      DAILY_LIMITS.narrator_action,
    );
    if (!rate.allowed) return jsonRateLimited("narrator_action", rate.limit);


    if (!hasAiEnv()) {
      return jsonError("AI_NOT_CONFIGURED", 503, {
        detail: "Missing GROQ_API_KEY or GEMINI_API_KEY on the server.",
      });
    }

    const [{ data: entities }, embedding] = await Promise.all([
      supabase.from("entities").select("*").eq("world_id", worldId),
      embedText(scenario),
    ]);

    const { data: loreChunks } = await supabase.rpc("match_lore_chunks", {
      world_uuid: worldId,
      query_embedding: embedding,
      match_count: 8,
      filter_tags: null,
    });

    const loreContext = (loreChunks ?? []).map((c: { content: string }) => c.content);
    const result = await analyzeImpact(scenario, loreContext, entities ?? []);
    return Response.json(result);
  }

  if (action === "blank-spots") {
    const parsed = blankSpotSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { worldId } = parsed.data;

    if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", 500);
    const isDemoWorld = worldId === "demo-world";
    if (!isDemoWorld) {
      const access = await requireWorldAccess(supabase, user.id, worldId, "viewer");
      if (!access.allowed) return jsonError("FORBIDDEN", 403);
    }

    const rate = await checkAndIncrement(
      authSupabase,
      user.id,
      "narrator_action",
      DAILY_LIMITS.narrator_action,
    );
    if (!rate.allowed) return jsonRateLimited("narrator_action", rate.limit);


    if (!hasAiEnv()) {
      return jsonError("AI_NOT_CONFIGURED", 503, {
        detail: "Missing GROQ_API_KEY or GEMINI_API_KEY on the server.",
      });
    }

    const { data: entities } = await supabase
      .from("entities")
      .select("*")
      .eq("world_id", worldId)
      .order("mention_count", { ascending: false })
      .limit(20);

    const { data: loreChunks } = await supabase
      .from("lore_chunks")
      .select("content")
      .eq("world_id", worldId)
      .limit(10);

    const loreContext = (loreChunks ?? []).map((c: { content: string }) => c.content);
    const holes = await detectBlankSpots(entities ?? [], loreContext);
    return Response.json({ holes });
  }

  if (action === "timeline") {
    const parsed = timelineSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { worldId } = parsed.data;

    if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", 500);
    const isDemoWorld = worldId === "demo-world";
    if (!isDemoWorld) {
      const access = await requireWorldAccess(supabase, user.id, worldId, "viewer");
      if (!access.allowed) return jsonError("FORBIDDEN", 403);
    }

    const rate = await checkAndIncrement(
      authSupabase,
      user.id,
      "narrator_action",
      DAILY_LIMITS.narrator_action,
    );
    if (!rate.allowed) return jsonRateLimited("narrator_action", rate.limit);


    if (!hasAiEnv()) {
      return jsonError("AI_NOT_CONFIGURED", 503, {
        detail: "Missing GROQ_API_KEY or GEMINI_API_KEY on the server.",
      });
    }

    const { data: events } = await supabase
      .from("entities")
      .select("id, name, summary")
      .eq("world_id", worldId)
      .eq("type", "event");

    if (!events || events.length === 0) {
      return Response.json({ timeline: [] });
    }

    // Return flat event array — the client handles era grouping in the component
    const flat = await orderEventsChronologically(events);
    return Response.json({ timeline: flat });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

// ── GET /api/narrator?action=blank-spots&worldId=<id> ─────────────────────
// Used by the dashboard Lore Bounties panel. No rate limit — read-only analysis.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const worldId = searchParams.get("worldId");

  if (action !== "blank-spots" || !worldId) {
    return jsonError("INVALID_PARAMS", 400);
  }

  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

   if (!hasAiEnv()) {
     return jsonError(
       "AI_SERVICE_UNAVAILABLE",
       503,
       {
         detail: "AI analysis services are temporarily unavailable. Please try again later.",
         suggestion: "Check that GROQ_API_KEY and GEMINI_API_KEY are properly configured on the server.",
       }
     );
   }

  const supabase = await getSupabase();
  if (!supabase) return jsonError("SUPABASE_NOT_CONFIGURED", 500);

  const access = await requireWorldAccess(supabase, user.id, worldId, "viewer");
  if (!access.allowed) return jsonError("FORBIDDEN", 403);

  const { data: entities } = await supabase
    .from("entities")
    .select("*")
    .eq("world_id", worldId)
    .order("mention_count", { ascending: false })
    .limit(20);

  const { data: loreChunks } = await supabase
    .from("lore_chunks")
    .select("content")
    .eq("world_id", worldId)
    .limit(10);

  const loreContext = (loreChunks ?? []).map((c: { content: string }) => c.content);
  const holes = await detectBlankSpots(entities ?? [], loreContext);
  return Response.json({ holes });
}
