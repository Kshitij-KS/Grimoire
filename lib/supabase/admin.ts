import { createClient } from "@supabase/supabase-js";
import { env, hasServerSupabaseEnv } from "@/lib/env";

export function createAdminSupabaseClient() {
  if (!hasServerSupabaseEnv()) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      console.warn("Missing Supabase service role environment variables. Returning placeholder client for build.");
    } else {
      throw new Error("Missing Supabase service role environment variables.");
    }
  }

  return createClient(
    env.nextPublicSupabaseUrl || "https://placeholder.supabase.co",
    env.supabaseServiceRoleKey || "placeholder",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
