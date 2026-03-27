export const dynamic = "force-dynamic";
import { z } from "zod";
import { DAILY_LIMITS, FREE_TIER_LIMITS } from "@/lib/constants";
import { chunkLoreText } from "@/lib/chunker";
import { embedText, extractEntities } from "@/lib/embeddings";
import { hasAiEnv } from "@/lib/env";
import { checkAndIncrement } from "@/lib/rate-limit";
import { jsonError, jsonRateLimited, requireUser, zodErrorResponse } from "@/lib/api";
import { inngest } from "@/lib/inngest-client";

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
      detail: "Missing GEMINI_API_KEY on the server.",
    });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { user, supabase } = auth;
  const { worldId, title, content, entryId, useBackground } = parsed.data;

  const [{ data: profile }, { count: loreCount }] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
    supabase
      .from("lore_entries")
      .select("*", { head: true, count: "exact" })
      .eq("user_id", user.id),
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
  if (entryId) {
    const { data, error } = await supabase
      .from("lore_entries")
      .update({ title, content, processing_status: "pending" })
      .eq("id", entryId)
      .select("*")
      .single();
    if (error) throw error;
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
    if (error) throw error;
    entry = data;
  }

  // Try background processing via Inngest first
  if (useBackground) {
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
        await supabase
          .from("lore_entries")
          .update({ processing_status: "processing" })
          .eq("id", entry.id);

        controller.enqueue(encoder.encode(sseEvent("saved", { entry })));
        controller.enqueue(
          encoder.encode(sseEvent("chunking", { status: "started" })),
        );

        const chunks = chunkLoreText(content);
        const extractedEntities = await extractEntities(content).catch(
          () => [],
        );
        const chunkRows = [];

        for (const chunk of chunks) {
          controller.enqueue(
            encoder.encode(
              sseEvent("embedding_progress", {
                index: chunk.chunkIndex,
                total: chunks.length,
              }),
            ),
          );

          let embedding: number[] = [];
          let attempts = 0;
          while (attempts < 3) {
            try {
              embedding = await embedText(chunk.content);
              break;
            } catch (e) {
              attempts++;
              if (attempts >= 3) {
                console.error("Embedding failed after 3 attempts:", e);
                embedding = [];
                break;
              }
              await new Promise((r) =>
                setTimeout(r, Math.pow(2, attempts) * 1000),
              );
            }
          }

          const entityTags = extractedEntities
            .filter((entity) =>
              chunk.content
                .toLowerCase()
                .includes(entity.name.toLowerCase()),
            )
            .map((entity) => entity.name);

          chunkRows.push({
            world_id: worldId,
            lore_entry_id: entry.id,
            content: chunk.content,
            embedding: embedding.length > 0 ? embedding : null,
            entity_tags: entityTags,
            chunk_index: chunk.chunkIndex,
          });
        }

        // Delete old chunks if re-processing
        if (entryId) {
          await supabase
            .from("lore_chunks")
            .delete()
            .eq("lore_entry_id", entryId);
        }

        await supabase.from("lore_chunks").insert(chunkRows);
        controller.enqueue(
          encoder.encode(
            sseEvent("embedding_complete", { count: chunkRows.length }),
          ),
        );
        controller.enqueue(
          encoder.encode(
            sseEvent("entity_extraction", {
              count: extractedEntities.length,
            }),
          ),
        );

        for (const entity of extractedEntities) {
          await supabase.from("entities").upsert(
            {
              world_id: worldId,
              name: entity.name,
              type: entity.type,
              summary: entity.summary ?? null,
            },
            { onConflict: "world_id,normalized_name,type" },
          );
        }

        await supabase
          .from("lore_entries")
          .update({ processing_status: "complete" })
          .eq("id", entry.id);

        controller.enqueue(
          encoder.encode(
            sseEvent("complete", {
              entry,
              chunksCreated: chunkRows.length,
              entitiesFound: extractedEntities,
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
