import { createClient } from "@supabase/supabase-js";
import { env, hasServerSupabaseEnv } from "@/lib/env";

export function createAdminSupabaseClient() {
  if (!hasServerSupabaseEnv()) {
    throw new Error("Missing Supabase service role environment variables.");
  }

  return createClient(
    env.nextPublicSupabaseUrl!,
    env.supabaseServiceRoleKey!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
