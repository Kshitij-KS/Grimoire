"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/public-env";

let browserClient: SupabaseClient | null = null;

export function createClient() {
  if (!publicEnv.nextPublicSupabaseUrl || !publicEnv.nextPublicSupabaseAnonKey) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      console.warn("Missing Supabase browser environment variables. Returning placeholder client for build.");
    } else {
      throw new Error("Missing Supabase browser environment variables.");
    }
  }

  browserClient ??= createBrowserClient(
    publicEnv.nextPublicSupabaseUrl || "https://placeholder.supabase.co",
    publicEnv.nextPublicSupabaseAnonKey || "placeholder",
  );

  return browserClient;
}
