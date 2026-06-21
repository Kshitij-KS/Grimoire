// Feature: free-chunking-embedding-api
// Provider abstraction for the hardened Embedding_Service.
//
// This module defines the small `EmbeddingProvider` interface that the service
// layer drives, plus the concrete `HuggingFaceProvider` that wraps the
// HuggingFace Inference API (`featureExtraction`). All retry/backoff,
// validation, fallback, and observability live in the service layer; a provider
// is intentionally thin and owns only the raw embedding call and the
// normalization of the provider's response shape into a `number[]`.

import { HfInference } from "@huggingface/inference";
import {
  getEmbeddingConfig,
  isFallbackConfigured,
  type EmbeddingConfig,
} from "@/lib/env";
import { EmbeddingError } from "./errors";
import { validateDimension } from "./service";

/**
 * A single Embedding_Provider: the minimal abstraction the Embedding_Service
 * drives. Implementations own only the raw embedding call and the normalization
 * of the provider's response into a flat `number[]`. Cross-cutting concerns
 * (input validation, dimension validation, retry/backoff, fallback, and
 * structured failure logging) are owned by the service layer, not the provider.
 */
export interface EmbeddingProvider {
  /**
   * Stable identifier combining provider and model, e.g.
   * `"huggingface:sentence-transformers/all-mpnet-base-v2"`. Used in failure
   * logs to identify which provider served or failed a request.
   */
  readonly id: string;
  /**
   * The model identifier alone, e.g.
   * `"sentence-transformers/all-mpnet-base-v2"`. Reported by the service to
   * assert read/write embedding consistency.
   */
  readonly model: string;
  /** Whether this provider can be reached without authentication credentials. */
  readonly allowsAnonymous: boolean;
  /**
   * Issue the raw embedding call for `text`, honoring `signal` for cancellation
   * / timeout. May throw provider or network errors; the service layer
   * classifies and retries them. Returns a flat numeric vector — the provider
   * is responsible only for normalizing its own response shape, not for
   * enforcing the required dimension.
   *
   * @throws {EmbeddingError} with `category: "unrecognized-response"` when the
   *   provider returns a response that does not match the expected vector
   *   structure.
   */
  embed(text: string, signal: AbortSignal): Promise<number[]>;
}

/**
 * Options for constructing a {@link HuggingFaceProvider}.
 */
export interface HuggingFaceProviderOptions {
  /** The model identifier to embed against, e.g. `all-mpnet-base-v2`. */
  model: string;
  /**
   * Optional access token (env `HF_TOKEN`). When present it is attached as
   * authentication credentials on every request; when absent, requests are made
   * anonymously (HuggingFace permits anonymous access, subject to rate limits).
   */
  token?: string;
}

/**
 * Embedding_Provider backed by the HuggingFace Inference API.
 *
 * Wraps `HfInference.featureExtraction` (logic ported from the legacy
 * `lib/gemini.ts` shim), normalizing the `number[] | number[][]` response shape
 * into a flat `number[]` (R2.3). HuggingFace permits anonymous requests, so
 * `allowsAnonymous` is `true`: when no token is configured the client is
 * constructed without credentials; when a token is present it is attached as
 * authentication credentials on every request (R6.2, R6.3).
 */
export class HuggingFaceProvider implements EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  /** HuggingFace permits anonymous (token-less) requests. */
  readonly allowsAnonymous = true;

  private readonly token?: string;
  private client: HfInference | null = null;

  constructor(options: HuggingFaceProviderOptions) {
    this.model = options.model;
    this.token = options.token;
    this.id = `huggingface:${options.model}`;
  }

  /**
   * Lazily construct the underlying HuggingFace client. When a token is present
   * it is passed as the client's credentials so every request it issues carries
   * that token (R6.2); when absent the client is anonymous (R6.3).
   */
  private getClient(): HfInference {
    this.client ??= new HfInference(this.token ?? undefined);
    return this.client;
  }

  /**
   * Embed `text` via HuggingFace `featureExtraction`.
   *
   * The HuggingFace response is `number[]` for a single pooled vector or
   * `number[][]` for token/sentence-level outputs; this method normalizes both
   * to a flat `number[]`. Any other shape is rejected with an
   * `unrecognized-response` {@link EmbeddingError} (R2.3). The provider does not
   * enforce the required dimension — that is the service layer's responsibility.
   *
   * @param text - The text to embed.
   * @param signal - Abort signal used by the service for the per-request timeout.
   * @returns The normalized embedding vector.
   */
  async embed(text: string, signal: AbortSignal): Promise<number[]> {
    const client = this.getClient();

    const result = await client.featureExtraction(
      {
        model: this.model,
        inputs: text,
      },
      { signal },
    );

    return normalizeFeatureExtractionOutput(result);
  }
}

/**
 * Normalize a HuggingFace `featureExtraction` result into a flat `number[]`.
 *
 * Accepts the two shapes the API produces for a single text input:
 * - `number[]` — a pooled sentence embedding, returned as-is.
 * - `number[][]` — token/sentence-level embeddings, the first row is returned.
 *
 * Any other shape (nested deeper, non-numeric, empty, or a non-array value)
 * is rejected with an `unrecognized-response` {@link EmbeddingError} describing
 * the unexpected shape (R2.3).
 */
function normalizeFeatureExtractionOutput(result: unknown): number[] {
  if (Array.isArray(result)) {
    if (result.length > 0 && typeof result[0] === "number") {
      return result as number[];
    }

    if (
      result.length > 0 &&
      Array.isArray(result[0]) &&
      typeof (result[0] as unknown[])[0] === "number"
    ) {
      return (result as number[][])[0];
    }
  }

  // `JSON.stringify` returns the JS value `undefined` (not a string) for
  // `undefined` and for functions/symbols, so guard before calling `.slice`.
  const serialized = JSON.stringify(result);
  const describedShape = (serialized ?? String(result)).slice(0, 100);
  throw new EmbeddingError(
    `Unrecognized HuggingFace featureExtraction response shape: ${describedShape}`,
    { category: "unrecognized-response" },
  );
}

/**
 * Construct the Primary_Provider from the resolved {@link EmbeddingConfig}.
 *
 * The Primary_Provider is always a {@link HuggingFaceProvider} bound to the
 * configured primary model. When a primary access token (`HF_TOKEN`) is present
 * it is attached as authentication credentials on every request (R6.2); when
 * absent, requests are issued anonymously, which HuggingFace permits (R6.3).
 * Because HuggingFace allows anonymous access, no missing-token configuration
 * error is raised here (R6.4 applies only to providers that disallow anonymous
 * access).
 *
 * @param config - The resolved embedding configuration; defaults to
 *   {@link getEmbeddingConfig}.
 * @returns The Primary_Provider used by the Embedding_Service.
 */
export function createPrimaryProvider(
  config: EmbeddingConfig = getEmbeddingConfig(),
): EmbeddingProvider {
  return new HuggingFaceProvider({
    model: config.primaryModel,
    token: config.primaryToken,
  });
}

// ---------------------------------------------------------------------------
// Fallback provider (optional, config-gated)
// ---------------------------------------------------------------------------

/**
 * Options for constructing a {@link FallbackProvider}.
 */
export interface FallbackProviderOptions {
  /** The fallback model identifier (env `EMBEDDING_FALLBACK_MODEL`). */
  model: string;
  /**
   * The fallback access token (env `EMBEDDING_FALLBACK_TOKEN`). A token is
   * always required for the Fallback_Provider — it is only ever constructed
   * when both a token and a model are configured (R6.5, R6.6).
   */
  token: string;
}

/**
 * Optional secondary Embedding_Provider used only when the Primary_Provider
 * fails after exhausting all of its bounded retries.
 *
 * The Fallback_Provider is backed by the HuggingFace Inference API (reusing
 * {@link HuggingFaceProvider}) and is **only** constructed when both a fallback
 * token and a fallback model are configured (see {@link createFallbackProvider}).
 *
 * Unlike the Primary_Provider, the Fallback_Provider enforces the
 * {@link validateDimension} (768) check **when it serves a request**: a fallback
 * whose model emits a vector of any other length is rejected with a
 * `dimension-mismatch` {@link EmbeddingError} rather than being treated as a
 * valid fallback (R5.2). This guarantees the Embedding_Service never returns,
 * persists, or queries with a mis-dimensioned vector produced by a fallback.
 *
 * Because the Fallback_Provider is gated on a configured token, it never makes
 * anonymous requests, so `allowsAnonymous` is `false`.
 */
export class FallbackProvider implements EmbeddingProvider {
  readonly id: string;
  readonly model: string;
  /** The Fallback_Provider is only configured with a token, never anonymous. */
  readonly allowsAnonymous = false;

  private readonly inner: HuggingFaceProvider;

  constructor(options: FallbackProviderOptions) {
    this.model = options.model;
    this.id = `fallback:huggingface:${options.model}`;
    this.inner = new HuggingFaceProvider({
      model: options.model,
      token: options.token,
    });
  }

  /**
   * Embed `text` via the underlying fallback model, enforcing the required
   * dimension as the fallback serves the request.
   *
   * The raw vector is obtained from the wrapped {@link HuggingFaceProvider}
   * (which normalizes the response shape, R2.3) and then passed through
   * {@link validateDimension}: a non-768 fallback vector is rejected with a
   * `dimension-mismatch` {@link EmbeddingError} so a fallback whose model emits
   * the wrong dimensionality is never accepted as a valid fallback (R5.2).
   *
   * @param text - The text to embed.
   * @param signal - Abort signal used by the service for the per-request timeout.
   * @returns The fallback embedding vector, guaranteed to have length 768.
   * @throws {EmbeddingError} with `category: "dimension-mismatch"` when the
   *   fallback model emits a vector whose length is not 768.
   */
  async embed(text: string, signal: AbortSignal): Promise<number[]> {
    const vector = await this.inner.embed(text, signal);
    return validateDimension(vector);
  }
}

/**
 * Construct the optional Fallback_Provider from the resolved
 * {@link EmbeddingConfig}.
 *
 * A Fallback_Provider is built **only** when both the fallback token and the
 * fallback model are present in Config (delegated to {@link isFallbackConfigured},
 * R6.5, R6.6). When the fallback is not configured, the factory returns
 * `undefined`, exposing the Fallback_Provider as unavailable so the
 * Embedding_Service raises the Primary_Provider's final error on exhaustion
 * rather than routing to a non-existent fallback (R5.3).
 *
 * @param config - The resolved embedding configuration; defaults to
 *   {@link getEmbeddingConfig}.
 * @returns A {@link FallbackProvider} when configured, otherwise `undefined`.
 */
export function createFallbackProvider(
  config: EmbeddingConfig = getEmbeddingConfig(),
): EmbeddingProvider | undefined {
  if (!isFallbackConfigured(config)) {
    return undefined;
  }

  // `isFallbackConfigured` guarantees both values are present and non-empty.
  return new FallbackProvider({
    model: config.fallbackModel as string,
    token: config.fallbackToken as string,
  });
}
