import "server-only";
import { publicEnv } from "@/lib/public-env";

export const env = {
  ...publicEnv,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  // HuggingFace token for embeddings (sentence-transformers/all-mpnet-base-v2, 768-dim).
  // Free-tier anonymous access works but may be rate-limited; a free HF token removes that limit.
  hfToken: process.env.HF_TOKEN,
  groqApiKey: process.env.GROQ_API_KEY,
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
  // Groq for all generation.
  // HuggingFace token is optional but recommended.
  return Boolean(env.groqApiKey);
}

// ---------------------------------------------------------------------------
// Embedding provider configuration
// ---------------------------------------------------------------------------

/**
 * The default Primary_Provider identifier for the Embedding_Service.
 * Embeddings run against the HuggingFace Inference API.
 */
const EMBEDDING_PRIMARY_PROVIDER_ID = "huggingface";

/**
 * The default Primary_Provider model. `all-mpnet-base-v2` emits 768-dimensional
 * vectors, matching the existing Supabase `vector(768)` columns so no database
 * migration or re-embedding is required.
 */
const EMBEDDING_PRIMARY_MODEL = "sentence-transformers/all-mpnet-base-v2";

/**
 * Resolved configuration for the Embedding_Service.
 *
 * The fallback provider is treated as configured only when BOTH `fallbackToken`
 * and `fallbackModel` resolve to non-empty values (see {@link isFallbackConfigured}).
 * `GEMINI_API_KEY` is intentionally absent from this model and its absence never
 * blocks initialization.
 */
export interface EmbeddingConfig {
  primaryProviderId: string;
  primaryModel: string;
  /** Primary_Provider access token (env `HF_TOKEN`); optional, anonymous allowed. */
  primaryToken?: string;
  /** Fallback_Provider access token (env `EMBEDDING_FALLBACK_TOKEN`). */
  fallbackToken?: string;
  /** Fallback_Provider model identifier (env `EMBEDDING_FALLBACK_MODEL`). */
  fallbackModel?: string;
}

/** Trim a raw env value and collapse empty/whitespace-only values to undefined. */
function normalizeOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Resolve the {@link EmbeddingConfig} from environment values and named
 * constants.
 *
 * Fails initialization with a missing-config error when either the provider
 * identifier or the model identifier is absent.
 */
export function getEmbeddingConfig(): EmbeddingConfig {
  const primaryProviderId = EMBEDDING_PRIMARY_PROVIDER_ID.trim();
  const primaryModel = EMBEDDING_PRIMARY_MODEL.trim();

  if (!primaryProviderId || !primaryModel) {
    throw new Error(
      "Embedding configuration error: missing provider id or model identifier. " +
        "Both the Embedding_Provider identifier and the model identifier are required " +
        "to initialize the Embedding_Service.",
    );
  }

  return {
    primaryProviderId,
    primaryModel,
    primaryToken: normalizeOptional(process.env.HF_TOKEN),
    fallbackToken: normalizeOptional(process.env.EMBEDDING_FALLBACK_TOKEN),
    fallbackModel: normalizeOptional(process.env.EMBEDDING_FALLBACK_MODEL),
  };
}

/**
 * A Fallback_Provider is configured only when BOTH its access token and its
 * model identifier are present.
 */
export function isFallbackConfigured(config: EmbeddingConfig): boolean {
  return Boolean(config.fallbackToken && config.fallbackModel);
}
