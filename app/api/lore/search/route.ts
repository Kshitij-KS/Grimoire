export const dynamic = "force-dynamic";
import { z } from "zod";
import { embedText, assertModelConsistency } from "@/lib/embeddings";
import { jsonError, requireUser, zodErrorResponse } from "@/lib/api";
import { hasAiEnv } from "@/lib/env";
import { requireWorldAccess } from "@/lib/world-access";

// Model-consistency guard (R7.1, R7.2). The schema records no per-row stored
// model identifier (the 768-dim columns require no migration), so we pin the
// identifier the stored Lore_Pipeline embeddings were generated with — the
// HuggingFace all-mpnet-base-v2 model, matching `getEmbeddingModel()`'s
// "<provider>:<model>" form. Before issuing `match_lore_chunks` we assert the
// active embedding model still equals this; a mismatch (e.g. the provider/model
// env changed without re-embedding) throws and suppresses the RPC.
const STORED_EMBEDDING_MODEL = "huggingface:sentence-transformers/all-mpnet-base-v2";

const schema = z.object({
  worldId: z.string().uuid(),
  query: z.string().min(2),
  tags: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!hasAiEnv()) {
    return jsonError("AI_NOT_CONFIGURED", 503, {
      detail: "Missing GROQ_API_KEY on the server.",
    });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const access = await requireWorldAccess(auth.supabase, auth.user.id, parsed.data.worldId, "viewer");
  if (!access.allowed) return jsonError("FORBIDDEN", 403);

  const embedding = await embedText(parsed.data.query);
  // Suppress the similarity RPC if the active model no longer matches the model
  // the stored embeddings were generated with (R7.2).
  assertModelConsistency(STORED_EMBEDDING_MODEL);
  const { data, error } = await auth.supabase.rpc("match_lore_chunks", {
    world_uuid: parsed.data.worldId,
    query_embedding: embedding,
    match_count: 4,
    filter_tags: parsed.data.tags ?? null,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ chunks: data ?? [] });
}
