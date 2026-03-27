import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export function createServerSupabaseClient() {
  if (!env.nextPublicSupabaseUrl || !env.nextPublicSupabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const cookieStore = cookies();

  return createServerClient(
    env.nextPublicSupabaseUrl,
    env.nextPublicSupabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    },
  );
}
