export const env = {
  nextPublicSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  nextPublicSupabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiFallbackApiKey: process.env.GEMINI_FALLBACK_API_KEY,
  inngestSigningKey: process.env.INNGEST_SIGNING_KEY,
  inngestEventKey: process.env.INNGEST_EVENT_KEY,
};

export function hasSupabaseEnv() {
  return Boolean(env.nextPublicSupabaseUrl && env.nextPublicSupabaseAnonKey);
}

export function hasServerSupabaseEnv() {
  return Boolean(
    env.nextPublicSupabaseUrl &&
    env.nextPublicSupabaseAnonKey &&
    env.supabaseServiceRoleKey,
  );
}

export function hasAiEnv() {
  return Boolean(env.geminiApiKey);
}
