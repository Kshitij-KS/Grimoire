import type { SupabaseClient } from "@supabase/supabase-js";

export async function checkAndIncrement(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  limit: number,
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("rate_limits")
    .select("count")
    .eq("user_id", userId)
    .eq("action", action)
    .eq("date", today)
    .maybeSingle();

  if (data && data.count >= limit) {
    return { allowed: false, count: data.count, limit };
  }

  await supabase.from("rate_limits").upsert(
    {
      user_id: userId,
      action,
      date: today,
      count: (data?.count || 0) + 1,
    },
    { onConflict: "user_id,action,date" },
  );

  return { allowed: true, count: (data?.count || 0) + 1, limit };
}
