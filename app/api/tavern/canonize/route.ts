export const dynamic = "force-dynamic";
import { z } from "zod";
import { hasAiEnv } from "@/lib/env";
import { groqGenerate, GROQ_MODEL_HEAVY } from "@/lib/groq";
import { jsonError, requireUser, zodErrorResponse } from "@/lib/api";
import { requireWorldAccess } from "@/lib/world-access";
import { inngest } from "@/lib/inngest-client";

const schema = z.object({
  worldId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!hasAiEnv()) {
    return jsonError("AI_NOT_CONFIGURED", 503, {
      detail: "Missing GROQ_API_KEY on the server.",
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { user, supabase } = auth;
  const { worldId, sessionId } = parsed.data;

  const access = await requireWorldAccess(supabase, user.id, worldId, "editor");
  if (!access.allowed) return jsonError("FORBIDDEN", 403);

  // Fetch session + souls
  const { data: session } = await supabase
    .from("tavern_sessions")
    .select("*, souls:souls(*)")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .eq("world_id", worldId)
    .single();

  if (!session) return jsonError("SESSION_NOT_FOUND", 404);
  if (session.canonized) return jsonError("ALREADY_CANONIZED", 409);

  // Fetch full transcript
  const { data: messages } = await supabase
    .from("tavern_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (!messages || messages.length < 4) {
    return jsonError("TRANSCRIPT_TOO_SHORT", 400, {
      detail: "At least 4 messages are needed to inscribe a scene to canon.",
    });
  }

  // Build a readable transcript
  const soulMap: Record<string, string> = {};
  for (const soul of (session.souls ?? []) as Array<{ id: string; name: string }>) {
    soulMap[soul.id] = soul.name;
  }

  const transcript = messages
    .map((m: { role: string; soul_id: string | null; content: string }) => {
      const speaker =
        m.role === "director"
          ? "Narrator"
          : m.soul_id
          ? (soulMap[m.soul_id] ?? "Unknown Soul")
          : "Unknown";
      return `${speaker}: ${m.content}`;
    })
    .join("\n");

  const premiseContext = session.premise
    ? `\n\nScene Premise: ${session.premise}`
    : "";

  // Generate lore prose from transcript
  const loreContent = await groqGenerate({
    model: GROQ_MODEL_HEAVY,
    temperature: 0.6,
    max_tokens: 1500,
    messages: [
      {
        role: "system",
        content: `You are a master chronicler who transforms dramatic scene transcripts into canonical lore. 
Write in third-person omniscient past tense. Preserve all important details, decisions, revelations, and character dynamics from the scene. 
Do not add new facts not present in the transcript. Format as a single, flowing prose entry — no headers, no bullet points. 
The lore entry should read as though written by a world historian documenting a pivotal moment.`,
      },
      {
        role: "user",
        content: `Transform this scene transcript into a canonical lore entry for this world.${premiseContext}

Transcript:
${transcript}

Write the lore entry now:`,
      },
    ],
  });

  // Derive a title from the session name + soul names
  const soulNames = (session.souls ?? [])
    .map((s: { name: string }) => s.name)
    .join(", ");
  const loreTitle = `${session.name}: ${soulNames}`.slice(0, 80);

  // Save the lore entry
  const { data: loreEntry } = await supabase
    .from("lore_entries")
    .insert({
      world_id: worldId,
      user_id: user.id,
      title: loreTitle,
      content: loreContent,
    })
    .select("*")
    .single();

  if (!loreEntry) return jsonError("LORE_INSERT_FAILED", 500);

  // Mark session as canonized
  await supabase
    .from("tavern_sessions")
    .update({ canonized: true, canonized_lore_entry_id: loreEntry.id })
    .eq("id", sessionId);

  // Trigger the lore processing pipeline (embedding, entity extraction, etc.)
  await inngest.send({
    name: "lore/entry.created",
    data: {
      entryId: loreEntry.id,
      worldId,
      userId: user.id,
    },
  });

  return Response.json({ success: true, loreEntryId: loreEntry.id, loreTitle });
}
