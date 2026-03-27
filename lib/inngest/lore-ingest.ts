import { inngest } from "@/lib/inngest-client";
import { chunkLoreText } from "@/lib/chunker";
import { embedText, extractEntities } from "@/lib/embeddings";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const loreIngestFunction = inngest.createFunction(
  {
    id: "lore-inscribe",
    retries: 3,
    triggers: [{ event: "lore.inscribed" }],
    onFailure: async ({ error, event }: { error: { message: string }; event: { data: Record<string, unknown> } }) => {
      const supabase = getServiceClient();
      const eventData = event.data as { userId: string; worldId: string; entryId: string };
      await supabase.from("failed_jobs").insert({
        user_id: eventData.userId,
        world_id: eventData.worldId,
        event_name: "lore.inscribed",
        payload: event.data,
        error_message: error.message,
        lore_entry_id: eventData.entryId,
        status: "failed",
      });
      await supabase
        .from("lore_entries")
        .update({ processing_status: "failed" })
        .eq("id", eventData.entryId);
    },
  },
  async ({ event, step }: { event: { data: Record<string, unknown> }; step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> } }) => {
    const { worldId, entryId, content } = event.data as {
      worldId: string;
      entryId: string;
      content: string;
      userId: string;
    };
    const supabase = getServiceClient();

    // Update status to processing
    await supabase
      .from("lore_entries")
      .update({ processing_status: "processing" })
      .eq("id", entryId);

    // Step 1: Chunk the text
    const chunks = await step.run("chunk-text", async () => {
      return chunkLoreText(content);
    });

    // Step 2: Extract entities (with built-in Inngest retry)
    const extractedEntities = await step.run("extract-entities", async () => {
      try {
        return await extractEntities(content);
      } catch (e) {
        console.error("Entity extraction failed:", e);
        return [] as Array<{ name: string; type: string; summary?: string }>;
      }
    });

    // Step 3: Embed all chunks (batch with retry per chunk)
    const chunkRows = await step.run("embed-chunks", async () => {
      const rows: Array<{
        world_id: string;
        lore_entry_id: string;
        content: string;
        embedding: number[];
        entity_tags: string[];
        chunk_index: number;
      }> = [];

      for (const chunk of chunks) {
        let embedding: number[] = [];
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            embedding = await embedText(chunk.content);
            break;
          } catch (e) {
            attempts++;
            if (attempts >= maxAttempts) {
              throw new Error(
                `Embedding failed for chunk ${chunk.chunkIndex} after ${maxAttempts} attempts: ${e instanceof Error ? e.message : "unknown"}`
              );
            }
            // Exponential backoff: 1s, 2s, 4s
            await new Promise((resolve) =>
              setTimeout(resolve, Math.pow(2, attempts) * 1000)
            );
          }
        }

        const entityTags = extractedEntities
          .filter((entity: { name: string }) =>
            chunk.content.toLowerCase().includes(entity.name.toLowerCase())
          )
          .map((entity: { name: string }) => entity.name);

        rows.push({
          world_id: worldId,
          lore_entry_id: entryId,
          content: chunk.content,
          embedding,
          entity_tags: entityTags,
          chunk_index: chunk.chunkIndex,
        });
      }
      return rows;
    });

    // Step 4: Save everything to DB
    await step.run("save-to-db", async () => {
      // Delete old chunks if re-processing
      await supabase.from("lore_chunks").delete().eq("lore_entry_id", entryId);

      // Insert new chunks
      if (chunkRows.length > 0) {
        const { error } = await supabase.from("lore_chunks").insert(chunkRows);
        if (error) throw error;
      }

      // Upsert entities
      for (const entity of extractedEntities) {
        await supabase.from("entities").upsert(
          {
            world_id: worldId,
            name: entity.name,
            type: entity.type,
            summary: entity.summary ?? null,
          },
          { onConflict: "world_id,normalized_name,type" }
        );
      }

      // Mark as complete
      await supabase
        .from("lore_entries")
        .update({ processing_status: "complete" })
        .eq("id", entryId);
    });

    return {
      entryId,
      chunksCreated: chunkRows.length,
      entitiesFound: extractedEntities.length,
    };
  }
);
