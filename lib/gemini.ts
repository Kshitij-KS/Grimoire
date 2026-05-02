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
  primaryCall: () => Promise<T>,
  fallbackCall: (() => Promise<T>) | null,
  message: string,
) {
  try {
    return await primaryCall();
  } catch (error) {
    if (!fallbackCall) throw error;
    console.warn(message, error);
    return fallbackCall();
  }
}

function withFallback(modelName: string): GeminiModel {
  const { primary, fallback } = getGeminiClients();
  const primaryModel = primary.getGenerativeModel({ model: modelName });

  if (!fallback) return primaryModel;

  const fallbackModel = fallback.getGenerativeModel({ model: modelName });
  const model = Object.assign(Object.create(Object.getPrototypeOf(primaryModel)), primaryModel) as GeminiModel;

  model.generateContent = (...args: Parameters<typeof primaryModel.generateContent>) =>
    tryFallback(
      () => primaryModel.generateContent(...args),
      () => fallbackModel.generateContent(...args),
      "Primary Gemini API failed, trying fallback...",
    );

  model.generateContentStream = (...args: Parameters<typeof primaryModel.generateContentStream>) =>
    tryFallback(
      () => primaryModel.generateContentStream(...args),
      () => fallbackModel.generateContentStream(...args),
      "Primary Gemini API stream failed, trying fallback...",
    );

  model.embedContent = (...args: Parameters<typeof primaryModel.embedContent>) =>
    tryFallback(
      () => primaryModel.embedContent(...args),
      () => fallbackModel.embedContent(...args),
      "Primary Gemini embedding API failed, trying fallback...",
    );

  model.batchEmbedContents = (...args: Parameters<typeof primaryModel.batchEmbedContents>) =>
    tryFallback(
      () => primaryModel.batchEmbedContents(...args),
      () => fallbackModel.batchEmbedContents(...args),
      "Primary Gemini batch embedding API failed, trying fallback...",
    );

  return model;
}

/** Heavy generation model — soul generation, entity extraction, consistency checks. */
export function getGeminiModel() {
  return withFallback("gemini-2.5-pro");
}

/** Fast conversational model — soul chat, demo chat. */
export function getChatModel() {
  return withFallback("gemini-2.5-flash");
}

/** Embedding model for semantic search. */
export function getEmbeddingModel() {
  return withFallback("gemini-embedding-2-preview");
}
