export const dynamic = "force-dynamic";
import { requireUser, jsonError, jsonRateLimited } from "@/lib/api";
import { requireWorldAccess } from "@/lib/world-access";
import { checkAndIncrement } from "@/lib/rate-limit";
import { DAILY_LIMITS, FREE_TIER_LIMITS } from "@/lib/constants";

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

  // Require at least editor access so collaborators can import too, rather than
  // a raw owner-only ownership check.
  const access = await requireWorldAccess(supabase, user.id, params.id, "editor");
  if (!access.allowed) return jsonError("Forbidden", 403);

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

  // First pass: validate files (extension, size, readability, non-empty) so the
  // free-tier cap can be checked against the count of files that would actually
  // be imported.
  const validFiles: Array<{ name: string; content: string; title: string }> = [];

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

    validFiles.push({ name, content, title: extractTitle(content, ext) });
  }

  // Free-tier cap: reject up front if importing the valid batch would push the
  // world past the free-tier lore-entry limit.
  const { count: existing } = await supabase
    .from("lore_entries")
    .select("id", { count: "exact", head: true })
    .eq("world_id", params.id);

  if ((existing ?? 0) + validFiles.length > FREE_TIER_LIMITS.loreEntries) {
    return jsonError("FREE_TIER_LORE_LIMIT", 403, {
      limit: FREE_TIER_LIMITS.loreEntries,
    });
  }

  for (const file of validFiles) {
    const { name, content, title } = file;

    // Meter each entry against the per-user lore_ingest daily limit; the first
    // exhausted check short-circuits the remaining files.
    const gate = await checkAndIncrement(
      supabase,
      user.id,
      "lore_ingest",
      DAILY_LIMITS.lore_ingest,
    );
    if (!gate.allowed) {
      return jsonRateLimited("lore_ingest", DAILY_LIMITS.lore_ingest);
    }

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
