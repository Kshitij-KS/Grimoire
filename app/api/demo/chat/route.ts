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
  const result = await model.generateContent({
    systemInstruction,
    contents: [{ role: "user", parts: [{ text: parsed.data.message }] }],
  });

  const assistantText = result.response.text().trim();

  const encoder = new TextEncoder();
  const words = assistantText.split(/(\s+)/);
  const stream = new ReadableStream({
    start(controller) {
      let index = 0;
      const push = () => {
        if (index >= words.length) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(words[index]));
        index += 1;
        setTimeout(push, 16);
      };
      push();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
