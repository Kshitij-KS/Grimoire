export const dynamic = "force-dynamic";
import { z } from "zod";
import { jsonError } from "@/lib/api";
import { hasAiEnv } from "@/lib/env";
// import { getChatModel } from "@/lib/gemini"; // REPLACED — Groq handles generation now
import { groqStream, GROQ_MODEL_FAST } from "@/lib/groq";
import { demoLoreEntries, demoSoulCard } from "@/lib/mock-data";

const schema = z.object({
  message: z.string().min(1).max(2000),
});

const systemInstruction = `You are Mira Ashveil. You are a fictional character in a demo of Grimoire, a worldbuilding platform.

YOUR SOUL CARD:
${JSON.stringify(demoSoulCard, null, 2)}

RELEVANT WORLD LORE:
${demoLoreEntries.map((e) => e.content).join("\n\n")}

RULES:
- Speak entirely as Mira. Never break character.
- Only know what your soul card says you know.
- If asked about something you don't know, respond as Mira would — with wariness or deflection, never as an AI.
- Keep responses 2-4 paragraphs max unless the scene demands more.
- Do not reference that you are an AI or a demo.`;

export async function POST(request: Request) {
  if (!hasAiEnv()) {
    return jsonError("AI_NOT_CONFIGURED", 503, {
      detail: "Missing GROQ_API_KEY or GEMINI_API_KEY on the server.",
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  // Previously: let geminiStream; const model = getChatModel();
  //   geminiStream = await model.generateContentStream({ systemInstruction, contents: [...] });
  // Now: groqStream with GROQ_MODEL_FAST (llama-3.1-8b-instant) — ultra-fast for demo chat
  let groqStreamResponse;
  try {
    groqStreamResponse = await groqStream({
      model: GROQ_MODEL_FAST,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: parsed.data.message },
      ],
      temperature: 0.8,
      max_tokens: 1024,
    });
  } catch (error: unknown) {
    console.error("Groq API error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to speak with the soul." },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Previously: for await (const chunk of geminiStream.stream) { const text = chunk.text(); ... }
        // Now: Groq OpenAI-compatible streaming with delta.content
        for await (const chunk of groqStreamResponse) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
      } catch (e) {
        console.error("Groq stream error:", e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
