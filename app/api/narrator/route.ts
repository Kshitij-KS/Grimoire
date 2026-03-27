export const dynamic = "force-dynamic";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { analyzeImpact, detectBlankSpots, orderEventsChronologically, embedText } from "@/lib/embeddings";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { zodErrorResponse } from "@/lib/api";

// Accept any non-empty string worldId — "demo-world" is valid for demo mode
const worldIdSchema = z.string().min(1);

const impactSchema = z.object({
  worldId: worldIdSchema,
  scenario: z.string().min(5),
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
  const body = await request.json();
  const action = body.action as string;
  const supabase = await getSupabase();

  if (action === "impact") {
    const parsed = impactSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { worldId, scenario } = parsed.data;

    // For demo world or no supabase, return mocked plausible result
    if (!supabase || worldId === "demo-world") {
      return Response.json({
        affected: [
          { name: "Mira Ashveil", type: "character", impact: "Her loyalties and mission would be fundamentally altered by this change.", severity: "high" },
          { name: "Ember Cult", type: "faction", impact: "The faction's influence and presence would shift dramatically.", severity: "high" },
          { name: "Ashveil", type: "location", impact: "The city's political balance would be destabilized.", severity: "medium" },
        ],
        orphaned: [],
        invalidated: ["The western bells have been silent for nine winters — this may no longer hold."],
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
    });

    const loreContext = (loreChunks ?? []).map((c: { content: string }) => c.content);
    const result = await analyzeImpact(scenario, loreContext, entities ?? []);
    return Response.json(result);
  }

  if (action === "blank-spots") {
    const parsed = blankSpotSchema.safeParse(body);
    if (!parsed.success) return zodErrorResponse(parsed.error);
    const { worldId } = parsed.data;

    if (!supabase || worldId === "demo-world") {
      return Response.json({
        holes: [
          { entity: "Mira Ashveil", missing: "Childhood and origin before the Ember Cult", suggestion: "Consider writing a lore entry about her early life in Ashveil's lower wards." },
          { entity: "Ember Cult", missing: "Founding history and original purpose", suggestion: "A document about the Cult's founding ideology would enrich the faction." },
          { entity: "Ember Bridge", missing: "Construction history and who controls it now", suggestion: "Add a lore entry describing the bridge's origin and current guardians." },
        ],
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

    if (!supabase || worldId === "demo-world") {
      return Response.json({
        timeline: [
          { era: "The Founding Age", events: [{ id: "e1", name: "Ashveil's Creation", summary: "Seven archmages bound their names into the city's foundation." }] },
          { era: "The Ember Years", events: [{ id: "e2", name: "Rise of the Ember Cult", summary: "The Cult rose to prominence, wrapping civic ritual in fire-lit obedience." }] },
          { era: "The Fracture", events: [{ id: "e3", name: "Night of Hollow Glass", summary: "Mira deserted the cult after this pivotal event." }] },
        ],
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

    const timeline = await orderEventsChronologically(events);
    return Response.json({ timeline });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
