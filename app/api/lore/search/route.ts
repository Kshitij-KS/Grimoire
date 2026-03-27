export const dynamic = "force-dynamic";
import { z } from "zod";
import { embedText } from "@/lib/embeddings";
import { requireUser, zodErrorResponse } from "@/lib/api";

const schema = z.object({
  worldId: z.string().uuid(),
  query: z.string().min(2),
  tags: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const embedding = await embedText(parsed.data.query);
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
