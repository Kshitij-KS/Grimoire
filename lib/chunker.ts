export interface ChunkedText {
  content: string;
  chunkIndex: number;
}

function splitIntoSentences(paragraph: string) {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function chunkLoreText(text: string, maxWords = 400): ChunkedText[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: ChunkedText[] = [];
  let overlapSentence = "";

  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);

    if (words.length <= maxWords) {
      const content = [overlapSentence, paragraph].filter(Boolean).join(" ").trim();
      chunks.push({ content, chunkIndex: chunks.length });
      const sentences = splitIntoSentences(paragraph);
      overlapSentence = sentences[sentences.length - 1] ?? "";
      return;
    }

    const sentences = splitIntoSentences(paragraph);
    let current: string[] = [];
    let currentCount = 0;

    sentences.forEach((sentence) => {
      const sentenceCount = sentence.split(/\s+/).filter(Boolean).length;
      if (currentCount + sentenceCount > maxWords && current.length > 0) {
        const paragraphChunk = current.join(" ").trim();
        const content = [overlapSentence, paragraphChunk].filter(Boolean).join(" ").trim();
        chunks.push({ content, chunkIndex: chunks.length });
        overlapSentence = current[current.length - 1] ?? "";
        current = [sentence];
        currentCount = sentenceCount;
      } else {
        current.push(sentence);
        currentCount += sentenceCount;
      }
    });

    if (current.length > 0) {
      const paragraphChunk = current.join(" ").trim();
      const content = [overlapSentence, paragraphChunk].filter(Boolean).join(" ").trim();
      chunks.push({ content, chunkIndex: chunks.length });
      overlapSentence = current[current.length - 1] ?? "";
    }
  });

  return chunks;
}
