export const dynamic = "force-dynamic";
import { z } from "zod";
import { DAILY_LIMITS } from "@/lib/constants";
import { checkConsistency, embedText } from "@/lib/embeddings";
import { checkAndIncrement } from "@/lib/rate-limit";
import { jsonRateLimited, requireUser, zodErrorResponse } from "@/lib/api";

const schema = z.object({
  worldId: z.string().uuid(),
  text: z.string().min(10),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { user, supabase } = auth;
  const rate = await checkAndIncrement(
    supabase,
    user.id,
    "consistency_check",
    DAILY_LIMITS.consistency_check,
  );
  if (!rate.allowed) return jsonRateLimited("consistency_check", rate.limit);

  // Extract likely entity names (capitalized words/phrases) from the new text
  const entityNames = Array.from(
    new Set(parsed.data.text.match(/\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*/g) ?? [])
  ).slice(0, 10);

  // Run embedding similarity search AND entity-tag search in parallel
  const [similarResult, tagResult] = await Promise.all([
    supabase.rpc("match_lore_chunks", {
      world_uuid: parsed.data.worldId,
      query_embedding: await embedText(parsed.data.text),
      match_count: 12,
      filter_tags: null,
    }),
    entityNames.length > 0
      ? supabase
          .from("lore_chunks")
          .select("content")
          .eq("world_id", parsed.data.worldId)
          .overlaps("entity_tags", entityNames)
          .limit(12)
      : Promise.resolve({ data: [] as Array<{ content: string }> }),
  ]);

  // Deduplicate chunks by content
  const seen = new Set<string>();
  const allChunks: string[] = [];
  for (const chunk of [
    ...((similarResult.data ?? []) as Array<{ content: string }>),
    ...((tagResult.data ?? []) as Array<{ content: string }>),
  ]) {
    if (!seen.has(chunk.content)) {
      seen.add(chunk.content);
      allChunks.push(chunk.content);
    }
  }

  const flags = await checkConsistency(parsed.data.text, allChunks);

  const { data: check } = await supabase
    .from("consistency_checks")
    .insert({
      world_id: parsed.data.worldId,
      user_id: user.id,
      source_text: parsed.data.text,
    })
    .select("*")
    .single();

  if (flags.length > 0 && check) {
    await supabase.from("consistency_flags").insert(
      flags.map((flag) => ({
        world_id: parsed.data.worldId,
        check_id: check.id,
        flagged_text: flag.flagged_text,
        contradiction: flag.contradiction,
        existing_reference: flag.reference,
        severity: flag.severity,
      })),
    );
  }

  return Response.json({
    success: true,
    flags: (flags ?? []).map((flag, index) => ({
      id: `${check?.id ?? "flag"}-${index}`,
      world_id: parsed.data.worldId,
      check_id: check?.id ?? null,
      flagged_text: flag.flagged_text,
      contradiction: flag.contradiction,
      existing_reference: flag.reference,
      severity: flag.severity,
      resolved: false,
      created_at: new Date().toISOString(),
    })),
  });
}
