export const dynamic = "force-dynamic";
import { z } from "zod";
import { DAILY_LIMITS, FREE_TIER_LIMITS } from "@/lib/constants";
import { hasAiEnv } from "@/lib/env";
import { checkAndIncrement } from "@/lib/rate-limit";
import { jsonError, jsonRateLimited, requireUser, zodErrorResponse } from "@/lib/api";
import { inngest } from "@/lib/inngest-client";
import { requireWorldAccess } from "@/lib/world-access";
import { processLoreEntry } from "@/lib/lore-processing";

const schema = z.object({
  worldId: z.string().uuid().or(z.literal("demo-world")),
  title: z.string().min(1).max(120),
  content: z.string().min(20),
  entryId: z.string().uuid().optional(),
  useBackground: z.boolean().optional().default(true),
});

function sseEvent(event: string, data: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!hasAiEnv()) {
    return jsonError("AI_NOT_CONFIGURED", 503, {
      detail: "Missing GROQ_API_KEY or GEMINI_API_KEY on the server.",
    });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { user, supabase } = auth;
  const { worldId, title, content, entryId, useBackground } = parsed.data;

  if (worldId !== "demo-world") {
    const access = await requireWorldAccess(supabase, user.id, worldId, "editor");
    if (!access.allowed) return jsonError("FORBIDDEN", 403);
  }

  const [{ data: profile }, { count: loreCount }] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
    supabase
      .from("lore_entries")
      .select("*", { head: true, count: "exact" })
      .eq("world_id", worldId),
  ]);

  const isFree = !profile || profile.plan === "free";
  if (isFree && (loreCount ?? 0) >= FREE_TIER_LIMITS.loreEntries && !entryId) {
    return Response.json(
      { error: "FREE_LORE_LIMIT_REACHED" },
      { status: 403 },
    );
  }

  const rate = await checkAndIncrement(
    supabase,
    user.id,
    "lore_ingest",
    DAILY_LIMITS.lore_ingest,
  );
  if (!rate.allowed) return jsonRateLimited("lore_ingest", rate.limit);

  // Save/update the lore entry immediately
  let entry;
  try {
    if (entryId) {
      const { data, error } = await supabase
        .from("lore_entries")
        .update({ title, content, processing_status: "pending" })
        .eq("id", entryId)
        .select("*")
        .single();
      if (error) return jsonError(error.message, 500);
      entry = data;
    } else {
      const { data, error } = await supabase
        .from("lore_entries")
        .insert({
          world_id: worldId,
          user_id: user.id,
          title,
          content,
          processing_status: "pending",
        })
        .select("*")
        .single();
      if (error) return jsonError(error.message, 500);
      entry = data;
    }
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Database error", 500);
  }

  // Try background processing via Inngest first if configured
  const inngestConfigured = process.env.INNGEST_EVENT_KEY && process.env.INNGEST_EVENT_KEY !== "test";
  
  if (useBackground && inngestConfigured) {
    try {
      const { ids } = await inngest.send({
        name: "lore.inscribed",
        data: {
          worldId,
          entryId: entry.id,
          content,
          userId: user.id,
          title,
        },
      });

      // Store the Inngest event ID for tracking
      if (ids?.[0]) {
        await supabase
          .from("lore_entries")
          .update({ inngest_event_id: ids[0] })
          .eq("id", entry.id);
      }

      return Response.json({
        entry,
        processing: "background",
        eventId: ids?.[0] ?? null,
      });
    } catch {
      // Inngest not available — fall back to synchronous processing
      console.warn("Inngest unavailable, falling back to synchronous processing");
    }
  }

  // Fallback: synchronous SSE processing (original behavior)
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(sseEvent("saved", { entry })));
        const result = await processLoreEntry({
          supabase,
          worldId,
          entryId: entry.id,
          content,
          onEvent: (event) => {
            if (event.type === "chunking") {
              controller.enqueue(encoder.encode(sseEvent("chunking", { status: "started" })));
            }
            if (event.type === "embedding_progress") {
              controller.enqueue(
                encoder.encode(
                  sseEvent("embedding_progress", {
                    index: event.index,
                    total: event.total,
                  }),
                ),
              );
            }
            if (event.type === "embedding_complete") {
              controller.enqueue(encoder.encode(sseEvent("embedding_complete", { count: event.count })));
            }
            if (event.type === "entity_extraction_started") {
              controller.enqueue(encoder.encode(sseEvent("entity_extraction_started", {})));
            }
            if (event.type === "entity_extraction") {
              controller.enqueue(encoder.encode(sseEvent("entity_extraction", { count: event.count })));
            }
          },
        });

        controller.enqueue(
          encoder.encode(
            sseEvent("complete", {
              entry,
              chunksCreated: result.chunksCreated,
              entitiesFound: result.entitiesFound,
            }),
          ),
        );
      } catch (error) {
        await supabase
          .from("lore_entries")
          .update({ processing_status: "failed" })
          .eq("id", entry.id);

        controller.enqueue(
          encoder.encode(
            sseEvent("error", {
              error:
                error instanceof Error
                  ? error.message
                  : "Lore ingest failed.",
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
