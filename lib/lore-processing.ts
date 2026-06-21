import { chunkLoreText } from "@/lib/chunker";
import { embedText, extractEntities } from "@/lib/embeddings";

type ProcessingEvent =
  | { type: "chunking"; total: number }
  | { type: "embedding_progress"; index: number; total: number }
  | { type: "embedding_complete"; count: number }
  | { type: "entity_extraction_started" }
  | { type: "entity_extraction"; count: number };

type SupabaseMutationResult = PromiseLike<{ error?: unknown }>;

type SupabaseTable = {
  update: (values: Record<string, unknown>) => {
    eq: (column: string, value: string) => SupabaseMutationResult;
  };
  delete: () => {
    eq: (column: string, value: string) => SupabaseMutationResult;
  };
  insert: (values: unknown) => SupabaseMutationResult;
  upsert: (
    values: unknown,
    options?: Record<string, unknown>,
  ) => SupabaseMutationResult;
};

type ProcessLoreEntryOptions = {
  supabase: {
    from: (table: string) => SupabaseTable;
    rpc: (name: string, params: unknown) => SupabaseMutationResult;
  };
  worldId: string;
  entryId: string;
  content: string;
  onEvent?: (event: ProcessingEvent) => void | Promise<void>;
};

export async function processLoreEntry({
  supabase,
  worldId,
  entryId,
  content,
  onEvent,
}: ProcessLoreEntryOptions) {
  await supabase
    .from("lore_entries")
    .update({ processing_status: "processing" })
    .eq("id", entryId);

  const chunks = chunkLoreText(content);
  await onEvent?.({ type: "chunking", total: chunks.length });

  await onEvent?.({ type: "entity_extraction_started" });
  const extractedEntities = await extractEntities(content).catch((err) => {
    console.error("Entity extraction failed:", err);
    return [];
  });
  const chunkRows = [];

  for (const chunk of chunks) {
    await onEvent?.({
      type: "embedding_progress",
      index: chunk.chunkIndex,
      total: chunks.length,
    });

    // The hardened Embedding_Service (lib/embedding/service.ts) now owns all
    // retry/backoff/timeout/fallback logic, so this is a direct pass-through.
    // A terminal EmbeddingError propagates out of the loop, aborting this
    // entry's write before any chunk is inserted, so no partially-written
    // vectors are persisted (R1.7, R3.1, R3.3).
    const embedding = await embedText(chunk.content);
    const entityTags = extractedEntities
      .filter((entity) =>
        chunk.content.toLowerCase().includes(entity.name.toLowerCase()),
      )
      .map((entity) => entity.name);

    chunkRows.push({
      world_id: worldId,
      lore_entry_id: entryId,
      content: chunk.content,
      embedding,
      entity_tags: entityTags,
      chunk_index: chunk.chunkIndex,
    });
  }

  // Delete old chunks first
  await supabase.from("lore_chunks").delete().eq("lore_entry_id", entryId);


  // Insert new chunks
  if (chunkRows.length > 0) {
    const { error } = await supabase.from("lore_chunks").insert(chunkRows);
    if (error) throw error;
  }



  await onEvent?.({ type: "embedding_complete", count: chunkRows.length });
  await onEvent?.({
    type: "entity_extraction",
    count: extractedEntities.length,
  });

  if (extractedEntities.length > 0) {
    const { error } = await supabase.rpc("upsert_entities_with_mention", {
      p_entities: extractedEntities.map((entity) => ({
        world_id: worldId,
        name: entity.name,
        type: entity.type,
        summary: entity.summary ?? null,
      })),
    });
    if (error) throw error;
  }

  await supabase
    .from("lore_entries")
    .update({ processing_status: "complete" })
    .eq("id", entryId);

  return {
    chunksCreated: chunkRows.length,
    entitiesFound: extractedEntities,
  };
}
