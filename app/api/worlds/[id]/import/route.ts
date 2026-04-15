export const dynamic = "force-dynamic";
import { requireUser, jsonError } from "@/lib/api";

const MAX_FILES = 10;
const MAX_FILE_BYTES = 512 * 1024; // 500 KB
const ALLOWED_EXTS = [".txt", ".md"];

function extractTitle(content: string, ext: string): string {
  if (ext === ".md") {
    // First # heading
    const match = content.match(/^#\s+(.+)/m);
    if (match?.[1]?.trim()) return match[1].trim().slice(0, 120);
  }
  // First non-empty line for both txt and md fallback
  const firstLine = content.split(/\r?\n/).find((l) => l.trim().length > 0);
  return (firstLine ?? "Untitled Import").trim().slice(0, 120);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  // Verify world ownership
  const { data: world } = await supabase
    .from("worlds")
    .select("id, user_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!world) return jsonError("World not found", 404);
  if (world.user_id !== user.id) return jsonError("Forbidden", 403);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data", 400);
  }

  const rawFiles = formData.getAll("files");
  if (!rawFiles.length) return jsonError("No files provided", 400);
  if (rawFiles.length > MAX_FILES) {
    return jsonError(`Maximum ${MAX_FILES} files per import`, 400);
  }

  const entries: Array<{ id: string; title: string; created_at: string }> = [];
  const errors: Array<{ name: string; reason: string }> = [];

  for (const raw of rawFiles) {
    if (!(raw instanceof File)) {
      errors.push({ name: "(unknown)", reason: "Not a valid file" });
      continue;
    }

    const name = raw.name ?? "unknown";
    const ext = name.includes(".")
      ? "." + name.split(".").pop()!.toLowerCase()
      : "";

    if (!ALLOWED_EXTS.includes(ext)) {
      errors.push({ name, reason: `Unsupported file type: ${ext || "(none)"}` });
      continue;
    }

    if (raw.size > MAX_FILE_BYTES) {
      errors.push({ name, reason: "File exceeds 500 KB limit" });
      continue;
    }

    let content: string;
    try {
      content = await raw.text();
    } catch {
      errors.push({ name, reason: "Could not read file contents" });
      continue;
    }

    if (!content.trim()) {
      errors.push({ name, reason: "File is empty" });
      continue;
    }

    const title = extractTitle(content, ext);

    const { data: entry, error: insertErr } = await supabase
      .from("lore_entries")
      .insert({
        world_id: params.id,
        user_id: user.id,
        title,
        content,
        processing_status: "pending",
      })
      .select("id, title, created_at")
      .single();

    if (insertErr || !entry) {
      errors.push({ name, reason: "Database insert failed" });
      continue;
    }

    entries.push(entry);

    // Fire background Inngest event (best-effort — don't fail if Inngest unavailable)
    try {
      const { inngest } = await import("@/lib/inngest-client");
      await inngest.send({
        name: "lore.inscribed",
        data: {
          worldId: params.id,
          entryId: entry.id,
          content,
          userId: user.id,
        },
      });
    } catch {
      // Inngest unavailable — entry stays "pending", user can re-process later
    }
  }

  return Response.json({
    imported: entries.length,
    entries,
    errors: errors.length > 0 ? errors : undefined,
  });
}
