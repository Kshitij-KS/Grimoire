import { describe, expect, it } from "vitest";
import { splitIntoSentences, chunkLoreText } from "@/lib/chunker";

describe("splitIntoSentences", () => {
  it("splits simple sentences with standard punctuation", () => {
    const text = "First sentence. Second sentence! Third sentence?";
    const result = splitIntoSentences(text);
    expect(result).toEqual([
      "First sentence.",
      "Second sentence!",
      "Third sentence?"
    ]);
  });

  it("handles multiple spaces and newlines between sentences", () => {
    const text = "Sentence one.   \n\n  Sentence two! \t Sentence three?";
    const result = splitIntoSentences(text);
    expect(result).toEqual([
      "Sentence one.",
      "Sentence two!",
      "Sentence three?"
    ]);
  });

  it("handles strings with no terminal punctuation", () => {
    const text = "This is just one long string with no periods";
    const result = splitIntoSentences(text);
    expect(result).toEqual([
      "This is just one long string with no periods"
    ]);
  });

  it("handles empty strings", () => {
    const text = "";
    const result = splitIntoSentences(text);
    expect(result).toEqual([]);
  });

  it("handles strings containing only whitespace", () => {
    const text = "   \n\t  ";
    const result = splitIntoSentences(text);
    expect(result).toEqual([]);
  });

  it("handles abbreviations (current behavior is to split)", () => {
    // This documents the current behavior, even if it's considered an edge case
    // where abbreviations like Mr. cause splits.
    const text = "Mr. Smith went to Washington.";
    const result = splitIntoSentences(text);
    expect(result).toEqual([
      "Mr.",
      "Smith went to Washington."
    ]);
  });

  it("handles multiple punctuation marks together", () => {
    const text = "What... is happening?! I don't know.";
    const result = splitIntoSentences(text);
    // The current regex `/(?<=[.!?])\s+/` splits on any whitespace following ANY of . ! ?
    // So "What..." -> "What..." + space -> splits here
    // "happening?!" -> "happening?!" + space -> splits here
    expect(result).toEqual([
      "What...",
      "is happening?!",
      "I don't know."
    ]);
  });

  it("handles spaces before punctuation", () => {
    const text = "A weird sentence . And another one !";
    const result = splitIntoSentences(text);
    expect(result).toEqual([
      "A weird sentence .",
      "And another one !"
    ]);
  });
});

describe("chunkLoreText", () => {
  it("chunks text into an array of ChunkedText objects", () => {
    const text = "Paragraph one is here.\n\nParagraph two is here. It has multiple sentences.";
    const chunks = chunkLoreText(text, 10);

    // Check that we get valid chunks
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toHaveProperty("content");
    expect(chunks[0]).toHaveProperty("chunkIndex");
  });
});
