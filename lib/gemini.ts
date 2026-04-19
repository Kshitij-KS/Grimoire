import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/lib/env";

let primaryClient: GoogleGenerativeAI | null = null;
let fallbackClient: GoogleGenerativeAI | null = null;

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

function withFallback(modelName: string) {
  const { primary, fallback } = getGeminiClients();
  const primaryModel = primary.getGenerativeModel({ model: modelName });
  
  if (!fallback) return primaryModel;

  const fallbackModel = fallback.getGenerativeModel({ model: modelName });

  return {
    ...primaryModel,
    generateContent: async (...args: Parameters<typeof primaryModel.generateContent>) => {
      try {
        return await primaryModel.generateContent(...args);
      } catch (error) {
        console.warn(`Primary Gemini API failed, trying fallback...`, error);
        return await fallbackModel.generateContent(...args);
      }
    },
    generateContentStream: async (...args: Parameters<typeof primaryModel.generateContentStream>) => {
      try {
        return await primaryModel.generateContentStream(...args);
      } catch (error) {
        console.warn(`Primary Gemini API stream failed, trying fallback...`, error);
        return await fallbackModel.generateContentStream(...args);
      }
    }
  } as unknown as typeof primaryModel;
}

/** Heavy generation model — soul generation, entity extraction, consistency checks. */
export function getGeminiModel() {
  return withFallback("gemini-2.5-pro");
}

/** Fast conversational model — soul chat, demo chat. */
export function getChatModel() {
  return withFallback("gemini-2.5-flash");
}
