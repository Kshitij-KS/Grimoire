import type { SupabaseClient } from "@supabase/supabase-js";

export async function checkAndIncrement(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  limit: number,
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const { data, error } = await supabase.rpc("increment_rate_limit", {
    p_user_id: userId,
    p_action: action,
    p_limit: limit,
  });

  if (error || !Array.isArray(data) || data.length === 0) {
    // Fail closed so abuse cannot bypass limits when the limiter is unavailable.
    return { allowed: false, count: limit, limit };
  }

  const first = data[0] as { allowed?: boolean; count?: number; limit?: number };
  return {
    allowed: Boolean(first.allowed),
    count: typeof first.count === "number" ? first.count : limit,
    limit: typeof first.limit === "number" ? first.limit : limit,
  };
}
