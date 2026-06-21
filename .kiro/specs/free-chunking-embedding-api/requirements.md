# Requirements Document

## Introduction

This feature replaces and hardens the embedding provider used by Grimoire's
"chunk-and-store lore" pipeline. The user's goal is to reliably chunk and store
at least five lore entries end to end on a free tier without hitting rate or
quota limits.

Important grounding from the current codebase:

- **Gemini is already gone.** All text generation now runs on Groq
  (`lib/groq.ts`). The embedding shim still lives in a file named `lib/gemini.ts`,
  but it no longer calls Gemini — it calls the HuggingFace Inference API
  (`featureExtraction`) with model `sentence-transformers/all-mpnet-base-v2`
  (768 dimensions). A stale code comment references `BAAI/bge-base-en-v1.5`;
  the actual constant is `all-mpnet-base-v2`. This feature is therefore a
  **swap-and-harden of the embedding provider**, not a Gemini removal.
- **Local chunking is not the bottleneck.** `lib/chunker.ts` splits text into
  ~400-word chunks (`CHUNK_SIZE_WORDS`) entirely locally with no API call.
  The bottleneck is the per-chunk embedding API call in
  `lib/lore-processing.ts` (`embedWithRetry` → `embedText`).
- **768 dimensions is a hard constraint.** The Supabase pgvector columns in
  `lore_chunks.embedding` and `semantic_cache.embedding` are fixed at
  `vector(768)`, with matching ivfflat indexes and RPC signatures
  (`match_lore_chunks`, `match_semantic_cache`). Any provider that emits a
  different dimensionality requires a database migration of both columns,
  both indexes, and all RPC signatures, plus re-embedding of all stored data.
- **The same model serves read and write paths.** `embedText` is called both
  when storing lore (write) and when querying it (`app/api/lore/search`,
  `app/api/tavern`, `app/api/souls/chat`, `app/api/narrator`,
  `app/api/consistency/check`). Stored and query embeddings MUST come from the
  same model, or vector similarity becomes meaningless.

The default direction is to select a free, reliable embedding provider/model
that outputs 768-dimensional vectors (so no migration or re-embedding is
required) and to harden the call path with bounded retries and an optional
fallback provider.

## Glossary

- **Embedding_Service**: The Grimoire module exposing `embedText(text)` and
  `getEmbeddingModel()`, responsible for converting text into a numeric vector.
  Currently implemented across `lib/embeddings.ts` and `lib/gemini.ts`.
- **Embedding_Provider**: The external free API that computes embedding vectors
  (e.g., HuggingFace Inference API or an equivalent free provider).
- **Primary_Provider**: The Embedding_Provider used by default for all requests.
- **Fallback_Provider**: An optional secondary Embedding_Provider used only when
  the Primary_Provider fails after exhausting retries.
- **Embedding_Vector**: A list of floating-point numbers produced for a text input.
- **Required_Dimension**: The fixed embedding vector length the database expects,
  currently 768.
- **Lore_Pipeline**: The chunk-and-store flow in `lib/lore-processing.ts`
  invoked by the Inngest job `lib/inngest/lore-ingest.ts`.
- **Lore_Entry**: A single block of lore text submitted for ingestion, split
  into one or more chunks before embedding.
- **Query_Path**: Read-side call sites that embed user queries for similarity
  search (`lore/search`, `tavern`, `souls/chat`, `narrator`,
  `consistency/check`).
- **Rate_Limit_Error**: A provider response indicating quota/throttling
  (e.g., HTTP 429 or 503 with a retry signal).
- **Config**: Environment-variable configuration in `lib/env.ts`
  (e.g., `HF_TOKEN`) plus provider/model constants.

## Requirements

### Requirement 1: Free, 768-Dimension-Compatible Provider Selection

**User Story:** As a worldbuilder on a free plan, I want the embedding provider
to be free and produce vectors the database already accepts, so that I can store
lore without paying and without a database migration.

#### Acceptance Criteria

1. THE Embedding_Service SHALL use an Embedding_Provider whose free tier permits Embedding_Vector generation without requiring payment method registration or billing credentials.
2. THE Embedding_Service SHALL produce Embedding_Vectors whose length equals the Required_Dimension of 768.
3. WHERE the selected Embedding_Provider's model emits a vector length other than 768, THE Embedding_Service SHALL reject that model during selection and the feature SHALL document the required database migration as out of scope for the no-migration path.
4. THE Embedding_Service SHALL use the same Embedding_Provider and model for both the Lore_Pipeline and the Query_Path.
5. THE Config SHALL record the selected Embedding_Provider identifier and model identifier as named constants or environment values.
6. IF the Embedding_Provider returns an Embedding_Vector whose length is not equal to the Required_Dimension of 768 during generation, THEN THE Embedding_Service SHALL reject the result, SHALL NOT persist the Embedding_Vector, and SHALL return an error indicating a dimension mismatch.
7. IF the Embedding_Provider is unreachable or returns a failure during Embedding_Vector generation, THEN THE Embedding_Service SHALL abort the operation without persisting partial results and SHALL return an error indicating the provider failure.
8. IF the Config does not contain both the Embedding_Provider identifier and the model identifier, THEN THE Embedding_Service SHALL fail initialization and SHALL return an error indicating the missing configuration.

### Requirement 2: Embedding Generation Behavior

**User Story:** As a developer, I want `embedText` to keep its existing contract,
so that all existing call sites continue to work without changes.

#### Acceptance Criteria

1. WHEN `embedText` is called with a text input containing at least one non-whitespace character and no more than 8192 characters, THE Embedding_Service SHALL return an Embedding_Vector containing exactly 768 numeric elements.
2. IF the Embedding_Provider returns a vector whose length is not exactly 768, THEN THE Embedding_Service SHALL raise an error identifying both the actual element count and the expected element count of 768, and SHALL NOT return an Embedding_Vector.
3. IF the Embedding_Provider returns a response that does not match the expected vector structure, THEN THE Embedding_Service SHALL raise an error describing the unexpected response shape, and SHALL NOT return an Embedding_Vector.
4. IF `embedText` is called with text that is empty or contains only whitespace characters, THEN THE Embedding_Service SHALL raise an error identifying the invalid input and SHALL NOT call the Embedding_Provider.
5. IF `embedText` is called with text exceeding 8192 characters, THEN THE Embedding_Service SHALL raise an error identifying the input length and the maximum allowed length of 8192 characters, and SHALL NOT call the Embedding_Provider.
6. IF the Embedding_Provider is unreachable or does not return a response within 30 seconds, THEN THE Embedding_Service SHALL raise an error indicating that the Embedding_Provider request failed, and SHALL NOT return an Embedding_Vector.

### Requirement 3: Reliable Throughput for At Least Five Lore Entries

**User Story:** As a worldbuilder, I want to chunk and store at least five lore
entries end to end, so that I can populate my world without the pipeline failing
on free-tier limits.

#### Acceptance Criteria

1. WHEN at least five Lore_Entries are submitted in sequence, THE Lore_Pipeline SHALL embed every chunk of every entry into an Embedding_Vector of length 768 and SHALL store each chunk such that the count of stored chunks equals the total number of chunks produced across all entries.
2. WHILE the Lore_Pipeline is embedding the chunks of a single Lore_Entry, THE Embedding_Service SHALL issue embedding requests at or below the Primary_Provider's documented free-tier request rate, such that request frequency alone does not trigger a Rate_Limit_Error.
3. WHEN every chunk of a Lore_Entry has been embedded and stored, THE Lore_Pipeline SHALL set that entry's processing status to `complete`.
4. IF embedding any chunk fails after all retry and fallback attempts, THEN THE Lore_Pipeline SHALL set that entry's processing status to `failed` AND SHALL record the failure in the `failed_jobs` table.
5. IF embedding fails after all retry and fallback attempts for a Lore_Entry whose status is already `complete`, THEN THE Lore_Pipeline SHALL transition that entry's status to `failed`.
6. IF a single Lore_Entry fails embedding after all retry and fallback attempts, THEN THE Lore_Pipeline SHALL continue processing the remaining Lore_Entries in the batch rather than aborting the entire batch.

### Requirement 4: Rate-Limit Handling, Retries, and Backoff

**User Story:** As a worldbuilder, I want transient provider throttling to be
retried automatically, so that temporary limits do not fail my ingestion.

#### Acceptance Criteria

1. IF the Embedding_Provider returns a Rate_Limit_Error, THEN THE Embedding_Service SHALL retry the failed request up to a maximum of 5 retry attempts (6 total invocations including the initial request).
2. WHEN the Embedding_Service retries after a Rate_Limit_Error, THE Embedding_Service SHALL wait an exponentially increasing backoff interval before each successive attempt, starting at 1 second and doubling on each attempt, capped at a maximum of 60 seconds per interval.
3. IF all 5 retry attempts for a chunk fail with a Rate_Limit_Error, THEN THE Embedding_Service SHALL raise an error that identifies the chunk index and the final failure reason, and SHALL NOT produce an Embedding_Vector for that chunk.
4. WHEN a retried request succeeds before the retry attempts are exhausted, THE Embedding_Service SHALL return the resulting Embedding_Vector for that chunk.
5. WHEN a retried request succeeds, THE Embedding_Service SHALL stop further retry attempts for that chunk and SHALL NOT consume any remaining attempts.

### Requirement 5: Optional Fallback Provider

**User Story:** As a worldbuilder, I want a backup embedding source when the
primary one is down or throttled, so that ingestion still completes.

#### Acceptance Criteria

1. WHERE a Fallback_Provider is configured, IF the Primary_Provider fails after exhausting all of its bounded retry attempts, THEN THE Embedding_Service SHALL attempt the same request against the Fallback_Provider.
2. WHERE a Fallback_Provider is configured, THE Fallback_Provider SHALL produce Embedding_Vectors whose length equals the Required_Dimension of 768; IF a candidate Fallback_Provider produces a vector length other than 768, THEN THE Embedding_Service SHALL reject that provider as a Fallback_Provider and SHALL NOT route requests to it.
3. WHERE no Fallback_Provider is configured, IF the Primary_Provider fails after exhausting all of its bounded retry attempts, THEN THE Embedding_Service SHALL raise the Primary_Provider's final error.
4. WHEN the Embedding_Service uses the Fallback_Provider for a request, THE Embedding_Service SHALL record an observable indication that the Fallback_Provider, rather than the Primary_Provider, served that request.
5. WHERE a Fallback_Provider is configured, WHEN the Fallback_Provider returns a successful response for a request routed to it, THE Embedding_Service SHALL return the resulting Embedding_Vector of length 768.
6. WHERE a Fallback_Provider is configured, IF the Fallback_Provider also fails after exhausting its bounded retry attempts, THEN THE Embedding_Service SHALL raise an error identifying that both the Primary_Provider and the Fallback_Provider failed and stating the final failure reason.

### Requirement 6: Configuration and Environment

**User Story:** As an operator, I want clear environment configuration for the
embedding provider, so that I can enable higher free-tier limits and a fallback
without code changes.

#### Acceptance Criteria

1. THE Config SHALL expose an optional access token for the Primary_Provider, read from an environment variable at Embedding_Service initialization.
2. WHEN an access token for the Primary_Provider is present, THE Embedding_Service SHALL include that token as authentication credentials on every request to the Primary_Provider.
3. WHERE no access token for the Primary_Provider is present AND the Primary_Provider permits anonymous requests, THE Embedding_Service SHALL send requests to the Primary_Provider without authentication credentials.
4. IF no access token for the Primary_Provider is present AND the Primary_Provider does not permit anonymous requests, THEN THE Embedding_Service SHALL raise a configuration error identifying the missing Primary_Provider token before issuing any request.
5. WHERE a Fallback_Provider is configured, THE Config SHALL expose both the Fallback_Provider's access token and its model identifier, each read from an environment variable at Embedding_Service initialization.
6. WHERE a Fallback_Provider is configured, IF either the Fallback_Provider's access token or its model identifier is absent, THEN THE Config SHALL treat the Fallback_Provider as not configured.
7. WHEN the Embedding_Service initializes without a `GEMINI_API_KEY` value present, THE Embedding_Service SHALL complete initialization and perform embedding operations without raising an error related to the absence of that value.

### Requirement 7: Read/Write Embedding Consistency

**User Story:** As a worldbuilder, I want search and chat to return relevant
results, so that the lore I stored is actually retrievable.

#### Acceptance Criteria

1. THE Embedding_Service SHALL generate Query_Path embeddings using the same Embedding_Provider and the same model identifier (as reported by `getEmbeddingModel()`) used to generate stored Lore_Pipeline embeddings.
2. IF the active embedding model identifier returned by `getEmbeddingModel()` differs from the model identifier recorded for the stored Lore_Pipeline embeddings, THEN THE Embedding_Service SHALL raise an error identifying the active and recorded model identifiers and SHALL NOT issue the `match_lore_chunks` or `match_semantic_cache` RPC, AND the feature documentation SHALL state that all stored embeddings require re-embedding with the active model before similarity search results are valid.
3. WHEN a Query_Path call embeds a user query, THE Embedding_Service SHALL return an Embedding_Vector of length 768 suitable for the `match_lore_chunks` and `match_semantic_cache` RPCs.
4. IF a Query_Path embedding produces an Embedding_Vector whose length is not 768, THEN THE Embedding_Service SHALL raise an error identifying the actual and expected (768) dimensions and SHALL NOT issue the `match_lore_chunks` or `match_semantic_cache` RPC.
5. WHEN a Query_Path call is invoked with empty or whitespace-only query text, THE Embedding_Service SHALL raise an error identifying the invalid input rather than calling the Embedding_Provider.

### Requirement 8: Observability of Embedding Failures

**User Story:** As an operator, I want to see why embedding failed, so that I can
diagnose free-tier limit problems quickly.

#### Acceptance Criteria

1. WHEN an embedding request fails, THE Embedding_Service SHALL log a failure record identifying the Embedding_Provider used, the failure category as exactly one of {rate-limit, dimension-mismatch, invalid-input, unrecognized-response, other}, and the attempt number as an integer from 1 to the bounded maximum number of attempts.
2. IF a Rate_Limit_Error occurs, THEN THE Embedding_Service SHALL log the failure with its failure category set to rate-limit, recorded distinctly from every other failure category.
3. WHEN the Lore_Pipeline records a failed Lore_Entry, THE Lore_Pipeline SHALL include in the stored failure record the originating chunk index as a zero-based integer, the failure category, and the final error message describing the terminal failure reason.
4. WHEN the Embedding_Service exhausts all retry attempts and any configured Fallback_Provider without success, THE Embedding_Service SHALL log a terminal failure record identifying each Embedding_Provider attempted and the total number of attempts made across all providers.
