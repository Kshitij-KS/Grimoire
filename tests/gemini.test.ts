import { describe, expect, it, vi } from "vitest";

describe("Gemini model helpers", () => {
  it("preserves embedContent when the fallback client is configured", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => ({}));

    const embedContent = vi.fn().mockResolvedValue({ embedding: { values: [1, 2, 3] } });
    const generateContent = vi.fn();
    const generateContentStream = vi.fn();

    class MockModel {
      generateContent(...args: unknown[]) {
        return generateContent(...args);
      }
      generateContentStream(...args: unknown[]) {
        return generateContentStream(...args);
      }
      embedContent(...args: unknown[]) {
        return embedContent(...args);
      }
    }

    class GoogleGenerativeAI {
      constructor(readonly apiKey: string) {}
      getGenerativeModel() {
        return new MockModel();
      }
    }

    vi.doMock("@google/generative-ai", () => ({ GoogleGenerativeAI }));

    process.env.GEMINI_API_KEY = "primary-key";
    process.env.GEMINI_FALLBACK_API_KEY = "fallback-key";

    const { getEmbeddingModel } = await import("@/lib/gemini");
    const model = getEmbeddingModel();

    expect(typeof model.embedContent).toBe("function");
    await expect(model.embedContent("hello")).resolves.toEqual({
      embedding: { values: [1, 2, 3] },
    });
  });
});
