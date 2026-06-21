// Read-only diagnostic for the lore storage pipeline.
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: entries, error: e1 } = await sb
  .from("lore_entries")
  .select("id,title,processing_status,created_at,world_id")
  .order("created_at", { ascending: false })
  .limit(10);
console.log("recent lore_entries error:", e1?.message ?? "none");
console.table((entries ?? []).map((e) => ({ id: e.id.slice(0, 8), title: (e.title ?? "").slice(0, 24), status: e.processing_status })));

const { count: chunkCount, error: e2 } = await sb
  .from("lore_chunks")
  .select("*", { head: true, count: "exact" });
console.log("lore_chunks total count:", chunkCount, "error:", e2?.message ?? "none");

const { count: failedCount, error: e3 } = await sb
  .from("failed_jobs")
  .select("*", { head: true, count: "exact" });
console.log("failed_jobs total count:", failedCount, "error:", e3?.message ?? "none");

const { data: recentFailed, error: e4 } = await sb
  .from("failed_jobs")
  .select("error_message,created_at,lore_entry_id")
  .order("created_at", { ascending: false })
  .limit(5);
console.log("recent failed_jobs error:", e4?.message ?? "none");
for (const f of recentFailed ?? []) console.log("  -", (f.error_message ?? "").slice(0, 160));
