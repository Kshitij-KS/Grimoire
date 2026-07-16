import Groq from "groq-sdk";
import { env } from "@/lib/env";

let groqClient: Groq | null = null;

export function getGroqClient(): Groq {
  if (!env.groqApiKey) {
    throw new Error("Missing GROQ_API_KEY");
  }
  groqClient ??= new Groq({ apiKey: env.groqApiKey });
  return groqClient;
}

// ── Model IDs ────────────────────────────────────────────────────────────────
// Production models (stable, suitable for production use)
// Ref: https://console.groq.com/docs/models

/** Heavy generation model — soul generation, entity extraction, consistency checks, impact analysis.
 *  Uses llama-3.3-70b-versatile — the most capable production model on Groq. */
export const GROQ_MODEL_HEAVY = "llama-3.3-70b-versatile" as const;

/** Fast conversational model — soul chat, demo chat, entity extraction quick ops.
 *  Uses llama-3.1-8b-instant — ultra-fast, 800+ tps, great for streaming chat. */
export const GROQ_MODEL_FAST = "llama-3.1-8b-instant" as const;

// ── Typed chat completion helper ──────────────────────────────────────────────
export type GroqMessage = Groq.Chat.ChatCompletionMessageParam;

export interface GroqGenerateOptions {
  model?: string;
  messages: GroqMessage[];
  temperature?: number;
  max_tokens?: number;
  /** Penalize tokens by prior frequency — reduces verbatim word/phrase reuse. */
  frequency_penalty?: number;
  /** Penalize tokens already present — nudges toward new topics/phrasing. */
  presence_penalty?: number;
  stream?: false;
}

export interface GroqStreamOptions {
  model?: string;
  messages: GroqMessage[];
  temperature?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

/**
 * Non-streaming Groq generation. Returns the full response text.
 */
export async function groqGenerate(opts: GroqGenerateOptions): Promise<string> {
  const client = getGroqClient();
  const completion = await client.chat.completions.create({
    model: opts.model ?? GROQ_MODEL_HEAVY,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.max_tokens ?? 4096,
    frequency_penalty: opts.frequency_penalty,
    presence_penalty: opts.presence_penalty,
    stream: false,
  });
  return completion.choices[0]?.message?.content ?? "";
}

/**
 * Streaming Groq generation. Returns the async iterable stream.
 */
export async function groqStream(opts: GroqStreamOptions) {
  const client = getGroqClient();
  return client.chat.completions.create({
    model: opts.model ?? GROQ_MODEL_FAST,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.max_tokens ?? 2048,
    frequency_penalty: opts.frequency_penalty,
    presence_penalty: opts.presence_penalty,
    stream: true,
  });
}
