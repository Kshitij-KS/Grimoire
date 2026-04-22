"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/public-env";

let browserClient: SupabaseClient | null = null;

export function createClient() {
  if (!publicEnv.nextPublicSupabaseUrl || !publicEnv.nextPublicSupabaseAnonKey) {
    throw new Error("Missing Supabase browser environment variables.");
  }

  browserClient ??= createBrowserClient(
    publicEnv.nextPublicSupabaseUrl,
    publicEnv.nextPublicSupabaseAnonKey,
  );

  return browserClient;
}
