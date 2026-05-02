import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/lib/env";

let primaryClient: GoogleGenerativeAI | null = null;
let fallbackClient: GoogleGenerativeAI | null = null;
type GeminiModel = ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;

export function getGeminiClients() {
  if (!env.geminiApiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }
  primaryClient ??= new GoogleGenerativeAI(env.geminiApiKey);
  if (env.geminiFallbackApiKey) {
    fallbackClient ??= new GoogleGenerativeAI(env.geminiFallbackApiKey);
  }
  return { primary: primaryClient, fallback: fallbackClient };
}

async function tryFallback<T>(
  actions: (() => Promise<T>)[],
  message: string,
) {
  let lastError: any;
  for (let i = 0; i < actions.length; i++) {
    try {
      return await actions[i]();
    } catch (error) {
      lastError = error;
      if (i < actions.length - 1) {
        console.warn(`${message} (Attempt ${i + 1} failed)`, error);
      }
    }
  }
  throw lastError;
}

function withFallback(modelNames: string[]): GeminiModel {
  const { primary, fallback } = getGeminiClients();
  const models: GeminiModel[] = [];
  
  for (const modelName of modelNames) {
    models.push(primary.getGenerativeModel({ model: modelName }));
    if (fallback) {
      models.push(fallback.getGenerativeModel({ model: modelName }));
    }
  }

  const baseModel = models[0];
  const proxyModel = Object.assign(Object.create(Object.getPrototypeOf(baseModel)), baseModel) as GeminiModel;

  proxyModel.generateContent = (...args: Parameters<typeof baseModel.generateContent>) =>
    tryFallback(
      models.map(m => () => m.generateContent(...args)),
      "Gemini generateContent failed, trying fallback...",
    );

  proxyModel.generateContentStream = (...args: Parameters<typeof baseModel.generateContentStream>) =>
    tryFallback(
      models.map(m => () => m.generateContentStream(...args)),
      "Gemini generateContentStream failed, trying fallback...",
    );

  proxyModel.embedContent = (...args: Parameters<typeof baseModel.embedContent>) =>
    tryFallback(
      models.map(m => () => m.embedContent(...args)),
      "Gemini embedContent failed, trying fallback...",
    );

  proxyModel.batchEmbedContents = (...args: Parameters<typeof baseModel.batchEmbedContents>) =>
    tryFallback(
      models.map(m => () => m.batchEmbedContents(...args)),
      "Gemini batchEmbedContents failed, trying fallback...",
    );

  return proxyModel;
}

/** Heavy generation model — soul generation, entity extraction, consistency checks. */
export function getGeminiModel() {
  return withFallback(["gemini-3.1-pro", "gemini-2.5-pro"]);
}

/** Fast conversational model — soul chat, demo chat. */
export function getChatModel() {
  return withFallback(["gemini-3-flash", "gemini-2.5-flash"]);
}

/** Embedding model for semantic search. */
export function getEmbeddingModel() {
  return withFallback(["gemini-embedding-2-preview", "text-embedding-004"]);
}
