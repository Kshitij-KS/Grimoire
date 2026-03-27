import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "@/lib/env";

let client: GoogleGenerativeAI | null = null;

function getClient() {
  if (!env.geminiApiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }
  client ??= new GoogleGenerativeAI(env.geminiApiKey);
  return client;
}

/** Heavy generation model — soul generation, entity extraction, consistency checks. */
export function getGeminiModel() {
  return getClient().getGenerativeModel({ model: "gemini-2.5-pro" });
}

/** Fast conversational model — soul chat, demo chat. */
export function getChatModel() {
  return getClient().getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
}
