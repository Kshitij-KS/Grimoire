export const dynamic = "force-dynamic";
import { z } from "zod";
import { getChatModel } from "@/lib/gemini";
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

  const model = getChatModel();

  // Use true streaming from Gemini — avoids Vercel timeout on slow generations
  const geminiStream = await model.generateContentStream({
    systemInstruction,
    contents: [{ role: "user", parts: [{ text: parsed.data.message }] }],
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of geminiStream.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(encoder.encode(text));
        }
      } catch (e) {
        console.error("Gemini stream error:", e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
