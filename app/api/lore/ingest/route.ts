export const dynamic = "force-dynamic";
import { z } from "zod";
import { DAILY_LIMITS, FREE_TIER_LIMITS } from "@/lib/constants";
import { hasAiEnv } from "@/lib/env";
import { checkAndIncrement, decrementRateLimit } from "@/lib/rate-limit";
import { jsonError, jsonRateLimited, requireUser, zodErrorResponse } from "@/lib/api";
import { inngest } from "@/lib/inngest-client";
import { requireWorldAccess } from "@/lib/world-access";
import { processLoreEntry } from "@/lib/lore-processing";
import { withErrorMonitoring } from "@/lib/sentry";

const schema = z.object({
  worldId: z.string().uuid().or(z.literal("demo-world")),
  title: z.string().min(1).max(120),
  content: z.string().min(20),
  entryId: z.string().uuid().optional(),
  // Default to synchronous SSE processing, which is self-contained and reliable
  // (chunk -> embed -> store -> entities, with live progress). Background
  // (Inngest) processing is opt-in: it avoids serverless timeouts on very large
  // entries, but it silently strands entries in "pending" if the Inngest app is
  // not actually delivering/executing events. Callers that know Inngest is
  // healthy can opt in with `useBackground: true`.
  useBackground: z.boolean().optional().default(false),
});

function sseEvent(event: string, data: Record<string, unknown>) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Extracts a human-readable message from thrown values. Supabase/PostgREST
 * errors are plain objects (not Error instances) shaped like
 * `{ message, details, hint, code }`, so a bare `error.message` check misses
 * them and callers see the opaque fallback. This pulls out whatever detail is
 * available so the client (and logs) show the real cause.
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const e = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const parts = [e.message, e.details, e.hint].filter(
      (p): p is string => typeof p === "string" && p.length > 0,
    );
    if (parts.length > 0) {
      return e.code ? `${parts.join(" — ")} (${String(e.code)})` : parts.join(" — ");
    }
  }
  return "Lore ingest failed.";
}

export const POST = withErrorMonitoring(async (request) => {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
   if (!hasAiEnv()) {
     return jsonError(
       "AI_SERVICE_UNAVAILABLE",
       503,
       {
         detail: "AI services are temporarily unavailable. Please try again later.",
         suggestion: "Check that GROQ_API_KEY is configured on the server (HF_TOKEN is optional but recommended for embeddings).",
       }
     );
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
        // Log the full error server-side so the real cause (e.g. a Postgres
        // error from a chunk insert or an entity RPC) is visible in the terminal.
        console.error("[lore/ingest] processing failed:", error);

        // Refund the daily lore_ingest unit we charged before processing — a
        // server-side failure must not consume the user's quota. Best-effort:
        // never let a refund error mask the original failure.
        try {
          await decrementRateLimit(supabase, user.id, "lore_ingest");
        } catch (refundError) {
          console.error("[lore/ingest] failed to refund rate limit:", refundError);
        }

        await supabase
          .from("lore_entries")
          .update({ processing_status: "failed" })
          .eq("id", entry.id);

        // Surface a meaningful message. Supabase/PostgREST errors are plain
        // objects (not Error instances) with message/details/hint/code fields,
        // so extract those rather than collapsing to a generic string.
        const message = extractErrorMessage(error);

        controller.enqueue(
          encoder.encode(
            sseEvent("error", {
              error: message,
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
});
