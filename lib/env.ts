import "server-only";
import { publicEnv } from "@/lib/public-env";

export const env = {
  ...publicEnv,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  // HuggingFace token for embeddings (BAAI/bge-base-en-v1.5).
  // Free-tier anonymous access works but may be rate-limited; a free HF token removes that limit.
  hfToken: process.env.HF_TOKEN,
  groqApiKey: process.env.GROQ_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  inngestSigningKey: process.env.INNGEST_SIGNING_KEY,
  inngestEventKey: process.env.INNGEST_EVENT_KEY,
};

export function hasServerSupabaseEnv() {
  return Boolean(
    env.nextPublicSupabaseUrl &&
    env.nextPublicSupabaseAnonKey &&
    env.supabaseServiceRoleKey,
  );
}

export function hasAiEnv() {
  // Groq for all generation; Gemini for embeddings (both required).
  // HuggingFace token is optional but recommended.
  return Boolean(env.groqApiKey && env.geminiApiKey);
}
