export const dynamic = "force-dynamic";

import { jsonError, zodErrorResponse } from "@/lib/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { waitlistSchema } from "@/lib/waitlist";

/**
 * Public waitlist capture. No auth required — the CTAs are shown to anyone, and
 * the `waitlist` table's insert-only RLS policy allows the anon client to write
 * (but never read). Repeat submissions succeed idempotently via an upsert on the
 * `email` unique constraint. (Requirements 14.1, 14.2, 14.3.)
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", 400);
  }

  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  let supabase: ReturnType<typeof createServerSupabaseClient>;
  try {
    supabase = createServerSupabaseClient();
  } catch (error) {
    return jsonError("CONFIGURATION_ERROR", 500, {
      detail: error instanceof Error ? error.message : "Missing server configuration.",
    });
  }

  const { error } = await supabase.from("waitlist").upsert(
    { email: parsed.data.email, source: parsed.data.source ?? null },
    { onConflict: "email", ignoreDuplicates: true },
  );

  if (error) {
    return jsonError("WAITLIST_INSERT_FAILED", 500, { detail: error.message });
  }

  return Response.json({ success: true });
}
