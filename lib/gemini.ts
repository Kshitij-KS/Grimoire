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

/** Fast text generation model — replaces Claude Haiku for soul generation and chat. */
export function getGeminiModel() {
  return getClient().getGenerativeModel({ model: "gemini-2.5-pro" });
}
