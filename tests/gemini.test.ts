import { describe, expect, it, vi } from "vitest";

describe("HuggingFace embedding model helpers", () => {
  it("embedContent resolves with a 768-dim vector from the HF mock", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => ({}));

    // Mock HuggingFace featureExtraction to return a 768-element array
    const mockVector = Array.from({ length: 768 }, (_, i) => i * 0.001);
    const mockFeatureExtraction = vi.fn().mockResolvedValue(mockVector);

    vi.doMock("@huggingface/inference", () => ({
      HfInference: class {
        featureExtraction(...args: unknown[]) {
          return mockFeatureExtraction(...args);
        }
      },
    }));

    process.env.HF_TOKEN = "";

    const { getEmbeddingModel } = await import("@/lib/gemini");
    const model = getEmbeddingModel();

    expect(typeof model.embedContent).toBe("function");

    const result = await model.embedContent({
      content: { parts: [{ text: "hello" }] },
    });

    expect(result).toEqual({ embedding: { values: mockVector } });
    expect(result.embedding.values).toHaveLength(768);
  });
});
