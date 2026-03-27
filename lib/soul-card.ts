import { z } from "zod";

export const soulCardPrompt = `You are a creative writing assistant. Given a character description and any relevant 
world lore, generate a structured Soul Card that will be used to animate this character 
as an AI persona. The Soul Card must feel specific, lived-in, and dramatically interesting.

Return ONLY valid JSON in this exact shape:
{
  voice: string (2-3 sentences describing HOW they speak — rhythm, vocabulary, habits),
  core: string (1-2 sentences on their fundamental nature and driving wound or desire),
  knows: string[] (5-8 specific things they know, be concrete not vague),
  doesnt_know: string[] (3-5 things they are ignorant of, dramatically interesting ones),
  relationships: { name: string, attitude: string }[] (3-5 key relationships),
  secrets: string[] (2-3 secrets they hold — things they would never volunteer),
  sample_lines: string[] (exactly 3 example lines of dialogue in their voice)
}`;

export const soulCardSchema = z.object({
  voice: z.string(),
  core: z.string(),
  knows: z.array(z.string()),
  doesnt_know: z.array(z.string()),
  relationships: z.array(
    z.object({
      name: z.string(),
      attitude: z.string(),
    }),
  ),
  secrets: z.array(z.string()),
  sample_lines: z.array(z.string()).length(3),
});

export function parseSoulCard(raw: string) {
  const jsonString = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  return soulCardSchema.parse(JSON.parse(jsonString));
}
