import { HfInference } from "@huggingface/inference";
import { env } from "@/lib/env";

// ─────────────────────────────────────────────────────────────────────────────
// Gemini has been fully replaced. All text-generation tasks use Groq (lib/groq.ts).
// Embeddings previously used Gemini text-embedding-004 (768-dim). They now use
// HuggingFace BAAI/bge-base-en-v1.5 which also outputs 768 dimensions, keeping
// the Supabase pgvector columns fully compatible.
//
// A free HuggingFace account token (HF_TOKEN) is optional but recommended to
// avoid anonymous rate limits. The model itself is always free.
// ─────────────────────────────────────────────────────────────────────────────

const HF_MODEL = "sentence-transformers/all-mpnet-base-v2";

let hfClient: HfInference | null = null;

function getHfClient(): HfInference {
  hfClient ??= new HfInference(env.hfToken ?? undefined);
  return hfClient;
}

// ── Embedding model shim ─────────────────────────────────────────────────────
// Returns an object with an `embedContent` method that matches the call-site
// in lib/embeddings.ts, so embedText() works without any changes there.
export function getEmbeddingModel() {
  const client = getHfClient();

  return {
    async embedContent(input: {
      content: { parts: Array<{ text: string }> };
      outputDimensionality?: number;
    }): Promise<{ embedding: { values: number[] } }> {
      const text = input.content.parts.map((p) => p.text).join(" ");

      const result = await client.featureExtraction({
        model: HF_MODEL,
        inputs: text,
      });

      // featureExtraction returns number[] | number[][] depending on input
      let vector: number[];
      if (Array.isArray(result) && typeof result[0] === "number") {
        vector = result as number[];
      } else if (Array.isArray(result) && Array.isArray(result[0])) {
        vector = (result as number[][])[0];
      } else {
        throw new Error(
          `Unexpected HuggingFace featureExtraction output shape: ${JSON.stringify(result).slice(0, 100)}`,
        );
      }

      return { embedding: { values: vector } };
    },
  };
}
