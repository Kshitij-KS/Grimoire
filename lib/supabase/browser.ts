"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export function createClient() {
  if (!env.nextPublicSupabaseUrl || !env.nextPublicSupabaseAnonKey) {
    throw new Error("Missing Supabase browser environment variables.");
  }

  browserClient ??= createBrowserClient(
    env.nextPublicSupabaseUrl,
    env.nextPublicSupabaseAnonKey,
  );

  return browserClient;
}
