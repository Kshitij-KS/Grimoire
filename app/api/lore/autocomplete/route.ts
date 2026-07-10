export const dynamic = "force-dynamic";
import { z } from "zod";
import { DAILY_LIMITS } from "@/lib/constants";
import { generateAutocomplete } from "@/lib/embeddings";
import { jsonError, jsonRateLimited, requireUser, zodErrorResponse } from "@/lib/api";
import { checkAndIncrement } from "@/lib/rate-limit";
import { hasAiEnv } from "@/lib/env";

const schema = z.object({
  worldId: z.string().uuid(),
  context: z.string().min(10).max(5000),
  wordCount: z.number().min(5).max(30).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!hasAiEnv()) {
    return jsonError("AI_NOT_CONFIGURED", 503, {
      detail: "Missing GROQ_API_KEY on the server (generation uses Groq; embeddings use HuggingFace).",
    });
  }

  const { supabase, user } = auth;

  const gate = await checkAndIncrement(
    supabase,
    user.id,
    "autocomplete",
    DAILY_LIMITS.autocomplete,
  );
  if (!gate.allowed) return jsonRateLimited("autocomplete", DAILY_LIMITS.autocomplete);

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { worldId, context, wordCount } = parsed.data;

  // Fetch last 3 chunks from this world for context enrichment
  const { data: recentChunks } = await supabase
    .from("lore_chunks")
    .select("content")
    .eq("world_id", worldId)
    .order("created_at", { ascending: false })
    .limit(3);

  const fullContext = [
    ...(recentChunks ?? []).map((c: { content: string }) => c.content),
    context,
  ].join("\n\n");

  try {
    const suggestion = await generateAutocomplete(fullContext, wordCount ?? 15);
    return Response.json({ suggestion });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Autocomplete failed" },
      { status: 500 },
    );
  }
}
