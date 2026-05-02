import { chunkLoreText } from "@/lib/chunker";
import { embedText, extractEntities } from "@/lib/embeddings";

type ProcessingEvent =
  | { type: "chunking"; total: number }
  | { type: "embedding_progress"; index: number; total: number }
  | { type: "embedding_complete"; count: number }
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
  upsert: (values: unknown, options?: Record<string, unknown>) => SupabaseMutationResult;
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

async function embedWithRetry(content: string, chunkIndex: number) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await embedText(content);
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw new Error(
    `Embedding failed for chunk ${chunkIndex} after 3 attempts: ${
      lastError instanceof Error ? lastError.message : "unknown"
    }`,
  );
}

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

  const extractedEntities = await extractEntities(content).catch(() => []);
  const chunkRows = [];

  for (const chunk of chunks) {
    await onEvent?.({
      type: "embedding_progress",
      index: chunk.chunkIndex,
      total: chunks.length,
    });

    const embedding = await embedWithRetry(chunk.content, chunk.chunkIndex);
    const entityTags = extractedEntities
      .filter((entity) => chunk.content.toLowerCase().includes(entity.name.toLowerCase()))
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

  await supabase.from("lore_chunks").delete().eq("lore_entry_id", entryId);

  if (chunkRows.length > 0) {
    const { error } = await supabase.from("lore_chunks").insert(chunkRows);
    if (error) throw error;
  }

  await onEvent?.({ type: "embedding_complete", count: chunkRows.length });
  await onEvent?.({ type: "entity_extraction", count: extractedEntities.length });

  for (const entity of extractedEntities) {
    const { error } = await supabase.rpc("upsert_entity_with_mention", {
      p_world_id: worldId,
      p_name: entity.name,
      p_type: entity.type,
      p_summary: entity.summary ?? null,
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
