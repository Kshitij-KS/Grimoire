import { z } from "zod";
import { repairAndParseJSON } from "@/lib/json-repair";

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
  // 1-3 authentic lines. We no longer force exactly 3 by padding with shared
  // filler (that homogenized under-specified souls); see parseSoulCard.
  sample_lines: z.array(z.string()).min(1).max(3),
});

function normalizeStringArray(value: unknown, max: number) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, max);
}

function normalizeRelationships(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const relation = item as { name?: unknown; attitude?: unknown };
      const name = String(relation.name ?? "").trim();
      const attitude = String(relation.attitude ?? "").trim();
      if (!name || !attitude) return null;
      return { name, attitude };
    })
    .filter((item): item is { name: string; attitude: string } => item !== null)
    .slice(0, 5);
}

/**
 * Produces the sample_lines to store. We keep whatever authentic lines the
 * model returned (1-3) WITHOUT padding to three — padding with fixed clichés
 * made every under-specified soul share the same "voice". Only when the model
 * returns zero usable lines do we fall back: to a single line derived from the
 * character's own `voice` description (so the fallback is still per-soul and
 * distinct), or, if there is no voice either, one neutral line as a last resort.
 */
function resolveSampleLines(rawSampleLines: unknown, voice: string): string[] {
  const real = normalizeStringArray(rawSampleLines, 3);
  if (real.length > 0) return real;

  const v = voice.trim();
  if (v) {
    // Derive a single cadence sample from the voice description itself.
    const seed = v.length > 160 ? `${v.slice(0, 157).trimEnd()}…` : v;
    return [seed];
  }

  return ["Ask what you truly need, and I will decide how much to reveal."];
}

export function parseSoulCard(raw: string) {
  const parsed = repairAndParseJSON<Record<string, unknown>>(raw);
  const voice = String(parsed.voice ?? "").trim();

  return soulCardSchema.parse({
    voice,
    core: String(parsed.core ?? "").trim(),
    knows: normalizeStringArray(parsed.knows, 8),
    doesnt_know: normalizeStringArray(parsed.doesnt_know, 5),
    relationships: normalizeRelationships(parsed.relationships),
    secrets: normalizeStringArray(parsed.secrets, 3),
    sample_lines: resolveSampleLines(parsed.sample_lines, voice),
  });
}
