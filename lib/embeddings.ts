import { z } from "zod";
import { getGeminiModel, getEmbeddingModel } from "@/lib/gemini";
import { repairAndParseJSON } from "@/lib/json-repair";

export async function embedText(text: string): Promise<number[]> {
  const model = getEmbeddingModel();
  const result = await model.embedContent(text);
  return result.embedding.values ?? [];
}

// Zod schema for extracted entities
const entitySchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    "character",
    "location",
    "faction",
    "artifact",
    "event",
    "rule",
  ]),
  summary: z.string().optional(),
});

const entitiesResponseSchema = z.object({
  entities: z.array(entitySchema),
});

export async function extractEntities(text: string) {
  const model = getGeminiModel();
  const prompt = `Extract named entities from this lore. Return strict JSON in the shape:
{"entities":[{"name":"", "type":"character|location|faction|artifact|event|rule", "summary":"short summary"}]}

Lore:
${text}`;

  const response = await model.generateContent(prompt);
  const raw = response.response.text();

  // Use json-repair for robust parsing
  const parsed = repairAndParseJSON<{ entities: Array<{ name: string; type: string; summary?: string }> }>(raw);

  // Validate with Zod
  const validated = entitiesResponseSchema.safeParse(parsed);
  if (validated.success) {
    return validated.data.entities;
  }

  // Fallback: if Zod validation fails, try to salvage valid entities
  console.warn("Entity extraction Zod validation failed:", validated.error.message);
  if (parsed?.entities && Array.isArray(parsed.entities)) {
    return parsed.entities
      .filter((e) => e?.name && e?.type)
      .map((e) => ({
        name: String(e.name),
        type: String(e.type),
        summary: e.summary ? String(e.summary) : undefined,
      }));
  }

  return [];
}

// Zod schema for consistency flags
const consistencyFlagSchema = z.object({
  severity: z.enum(["low", "medium", "high"]),
  flagged_text: z.string(),
  contradiction: z.string(),
  reference: z.string(),
});

const consistencyResponseSchema = z.object({
  flags: z.array(consistencyFlagSchema),
});

export async function checkConsistency(
  newWriting: string,
  referenceChunks: string[],
) {
  if (referenceChunks.length === 0) return [];

  const model = getGeminiModel();
  const prompt = `You are a strict canon consistency checker for a fictional world.
Find ALL factual contradictions between the new writing and the established lore.

A CONTRADICTION exists when the new writing makes a specific factual claim that conflicts with established lore:
- Timeline, durations, or sequences of events (e.g. "nine winters of silence" vs "bells rang")
- Character knowledge, abilities, relationships, or history
- Location details, names, or properties
- Events described as happening that lore says did not happen, or vice versa
- Any named entity described in a way that contradicts how lore describes them

Examine every sentence of the new writing. Compare each factual claim against ALL provided lore chunks.
Be thorough — a minor inconsistency is still a contradiction.

Return ONLY valid JSON with no other text, no markdown:
{"flags":[{"severity":"low|medium|high","flagged_text":"<exact quote from new writing>","contradiction":"<clear explanation>","reference":"<what the lore actually states>"}]}

If there are genuinely no contradictions, return exactly: {"flags":[]}

New writing:
${newWriting}

Established lore (check new writing against ALL of these):
${referenceChunks.map((chunk, i) => `[${i + 1}] ${chunk}`).join("\n\n")}`;

  const response = await model.generateContent(prompt);
  const raw = response.response.text();

  try {
    const parsed = repairAndParseJSON<{ flags: Array<{ severity: string; flagged_text: string; contradiction: string; reference: string }> }>(raw);
    const validated = consistencyResponseSchema.safeParse(parsed);

    if (validated.success) {
      return validated.data.flags;
    }

    // Fallback: try to salvage valid flags
    if (parsed?.flags && Array.isArray(parsed.flags)) {
      return parsed.flags
        .filter((f) => f?.flagged_text && f?.contradiction)
        .map((f) => ({
          severity: (["low", "medium", "high"].includes(f.severity) ? f.severity : "medium") as "low" | "medium" | "high",
          flagged_text: String(f.flagged_text),
          contradiction: String(f.contradiction),
          reference: String(f.reference ?? ""),
        }));
    }
  } catch {
    // Fall through
  }

  return [];
}

// ── New: Autocomplete suggestion ────────────────────────────────────────
export async function generateAutocomplete(
  context: string,
  wordCount: number = 15,
): Promise<string> {
  const model = getGeminiModel();
  const prompt = `Continue this story/lore text with exactly ${wordCount} words. 
Return ONLY the continuation text, no quotes, no explanation.
Match the tone and style of the existing text.

Text to continue:
${context}`;

  const response = await model.generateContent(prompt);
  return response.response.text().trim();
}

// ── New: Impact analysis ────────────────────────────────────────────────
export async function analyzeImpact(
  scenario: string,
  loreContext: string[],
  entities: Array<{ name: string; type: string; summary: string | null }>,
): Promise<{
  affected: Array<{ name: string; type: string; impact: string; severity: string }>;
  orphaned: string[];
  invalidated: string[];
}> {
  const model = getGeminiModel();
  const prompt = `You are analyzing a hypothetical scenario's impact on a fictional world.

SCENARIO: "${scenario}"

KNOWN ENTITIES:
${entities.map((e) => `- ${e.name} (${e.type}): ${e.summary ?? "No summary"}`).join("\n")}

RELEVANT LORE:
${loreContext.join("\n\n")}

Analyze the cascading effects. Return strict JSON:
{
  "affected": [{"name": "entity name", "type": "entity type", "impact": "how they're affected", "severity": "low|medium|high|critical"}],
  "orphaned": ["characters or entities that would lose purpose or connection"],
  "invalidated": ["world rules or facts that would no longer hold true"]
}`;

  const response = await model.generateContent(prompt);
  const raw = response.response.text();

  try {
    return repairAndParseJSON(raw);
  } catch {
    return { affected: [], orphaned: [], invalidated: [] };
  }
}

// ── New: Blank spot detection ───────────────────────────────────────────
export async function detectBlankSpots(
  entities: Array<{ name: string; type: string; summary: string | null; mention_count?: number }>,
  loreContext: string[],
): Promise<Array<{ entity: string; missing: string; suggestion: string }>> {
  const model = getGeminiModel();
  const prompt = `Analyze these entities from a fictional world and identify missing information.
Focus on the most referenced entities that lack important details.

ENTITIES:
${entities.map((e) => `- ${e.name} (${e.type}, mentioned ${e.mention_count ?? 0} times): ${e.summary ?? "No summary"}`).join("\n")}

EXISTING LORE CONTEXT:
${loreContext.slice(0, 10).join("\n\n")}

Find 3-8 "lore holes" — important missing information. Return strict JSON:
{"holes": [{"entity": "entity name", "missing": "what information is missing", "suggestion": "what the writer should consider adding"}]}`;

  const response = await model.generateContent(prompt);
  const raw = response.response.text();

  try {
    const parsed = repairAndParseJSON<{ holes: Array<{ entity: string; missing: string; suggestion: string }> }>(raw);
    return parsed.holes ?? [];
  } catch {
    return [];
  }
}

// ── New: Timeline ordering ──────────────────────────────────────────────
export async function orderEventsChronologically(
  events: Array<{ id: string; name: string; summary: string | null }>,
): Promise<Array<{ id: string; name: string; era: string; order: number }>> {
  if (events.length === 0) return [];

  const model = getGeminiModel();
  const prompt = `Analyze these fictional world events and arrange them in chronological order.
Infer the timeline from context clues in the summaries (e.g. "before", "after", "during", "following").

EVENTS:
${events.map((e) => `- ID: ${e.id} | Name: ${e.name} | Summary: ${e.summary ?? "No details"}`).join("\n")}

Return strict JSON with events in chronological order:
{"timeline": [{"id": "event id", "name": "event name", "era": "inferred era/period name", "order": 1}]}
Order numbers should start at 1.`;

  const response = await model.generateContent(prompt);
  const raw = response.response.text();

  try {
    const parsed = repairAndParseJSON<{ timeline: Array<{ id: string; name: string; era: string; order: number }> }>(raw);
    return parsed.timeline ?? [];
  } catch {
    return events.map((e, i) => ({
      id: e.id,
      name: e.name,
      era: "Unknown Era",
      order: i + 1,
    }));
  }
}

// ── Tavern: soul context builder ─────────────────────────────────────────
function buildSoulSystemBlock(soul: {
  name: string;
  soul_card: Record<string, unknown>;
}): string {
  const card = soul.soul_card as {
    voice?: string;
    core?: string;
    sample_lines?: string[];
    knows?: string[];
    doesnt_know?: string[];
    secrets?: string[];
    relationships?: Array<{ name: string; attitude: string }>;
  };

  const sampleLines = Array.isArray(card.sample_lines) && card.sample_lines.length > 0
    ? card.sample_lines.map((l) => `  • "${l}"`).join("\n")
    : "  (no sample lines provided)";

  return `CHARACTER: ${soul.name}
VOICE (memorize and replicate): ${card.voice ?? "No voice description."}
CORE WOUND / DRIVE: ${card.core ?? "No core description."}
THINGS THEY KNOW: ${Array.isArray(card.knows) ? card.knows.join("; ") : "unknown"}
THINGS THEY DON'T KNOW: ${Array.isArray(card.doesnt_know) ? card.doesnt_know.join("; ") : "unknown"}
SAMPLE SPEECH PATTERNS (match this cadence and vocabulary exactly):
${sampleLines}`;
}

// ── Tavern: single-soul isolated call ────────────────────────────────────
async function generateSingleSoulResponse(
  soul: { name: string; soul_card: Record<string, unknown> },
  context: {
    userMessage: string;
    history: string;
    loreContext: string[];
    directedToName: string | null;
  },
): Promise<{ soulName: string; response: string } | null> {
  const model = getGeminiModel();

  const isAddressed = context.directedToName === null || context.directedToName === soul.name;

  const directedClause = context.directedToName
    ? context.directedToName === soul.name
      ? `The Director is speaking DIRECTLY to you, ${soul.name}. You must respond.`
      : `The Director is speaking to ${context.directedToName}. You can interject briefly if you have a strong reason, but keep it very short. If the topic doesn't concern you, return an empty response array.`
    : `The Director addressed the whole room. Respond only if this topic meaningfully involves your character.`;

  const prompt = `SYSTEM IDENTITY LOCK: You are roleplaying as ${soul.name} ONLY. Never speak as any other character.

${buildSoulSystemBlock(soul)}

WORLD LORE (stay within these facts — do NOT invent new lore):
${context.loreContext.join("\n\n")}

RECENT CONVERSATION (last 8 turns):
${context.history || "(no prior conversation)"}

${directedClause}

DIRECTOR SAYS: "${context.userMessage}"

RULES:
- Never break character or adopt another soul's voice.
- Do not introduce facts absent from the world lore above.
- Keep your response under 160 words.
- Respond in dialogue only — no stage directions, no narration.
- ${isAddressed ? "You must respond." : "Only respond if you have a compelling character reason."}

Return ONLY valid JSON, no other text:
{
  "responses": [
    {
      "soulName": "${soul.name}",
      "reasoning": "<one sentence: why ${soul.name} responds to THIS message, grounded in their core>",
      "response": "<in-character dialogue>"
    }
  ]
}

If this soul would stay silent, return: {"responses": []}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const parsed = repairAndParseJSON<{
      responses: Array<{ soulName: string; reasoning: string; response: string }>;
    }>(raw);

    const item = parsed?.responses?.[0];
    if (!item?.soulName || !item?.response || item.response.trim().length < 5) return null;

    // Discard reasoning — it served its grounding purpose
    return { soulName: item.soulName, response: item.response.trim() };
  } catch {
    return null;
  }
}

// ── Tavern: multi-soul response (2-soul monolithic path) ──────────────────
async function generateDuoResponse(
  souls: Array<{ name: string; soul_card: Record<string, unknown> }>,
  context: {
    userMessage: string;
    history: string;
    loreContext: string[];
    directedToName: string | null;
  },
): Promise<Array<{ soulName: string; response: string }>> {
  const model = getGeminiModel();

  const [soulA, soulB] = souls;
  const directedClause = context.directedToName
    ? `The Director is speaking directly to ${context.directedToName}.`
    : "The Director addressed both characters.";

  const prompt = `You are simulating a scene with exactly two fictional characters.
Each must stay strictly in their own voice. They must not agree on everything.

${buildSoulSystemBlock(soulA)}

---

${buildSoulSystemBlock(soulB)}

WORLD LORE (do NOT invent facts outside this):
${context.loreContext.join("\n\n")}

RECENT CONVERSATION:
${context.history || "(no prior conversation)"}

${directedClause}
DIRECTOR SAYS: "${context.userMessage}"

TURN ORDER: ${soulA.name} responds first. ${soulB.name} responds second, reacting to what ${soulA.name} said.

RULES:
- Never merge the two voices.
- No stage directions, narration, or invented lore.
- Each response under 160 words.
- ${context.directedToName && context.directedToName !== soulA.name ? `${soulA.name} may briefly acknowledge but keep it short.` : ""}
- ${context.directedToName && context.directedToName !== soulB.name ? `${soulB.name} may briefly acknowledge but keep it short.` : ""}

Return ONLY valid JSON, no other text:
{
  "responses": [
    { "soulName": "${soulA.name}", "reasoning": "<why ${soulA.name} speaks>", "response": "<dialogue>" },
    { "soulName": "${soulB.name}", "reasoning": "<why ${soulB.name} speaks>", "response": "<dialogue>" }
  ]
}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const parsed = repairAndParseJSON<{
      responses: Array<{ soulName: string; reasoning: string; response: string }>;
    }>(raw);

    return (parsed?.responses ?? [])
      .filter((r) => r?.soulName && r?.response && r.response.trim().length >= 5)
      .map((r) => ({ soulName: r.soulName, response: r.response.trim() }));
  } catch {
    return [];
  }
}

// ── Tavern: main entry point ──────────────────────────────────────────────
/**
 * Generates in-character responses for 2-3 souls in a Tavern session.
 *
 * Strategy:
 * - 2 souls → single "duo" call (monolithic, with explicit turn order).
 * - 3 souls → N parallel isolated calls, each soul sees only its own card.
 *   This eliminates persona blending at the context level.
 *
 * Reasoning fields are generated internally (chain-of-thought grounding)
 * but discarded before responses are returned and saved.
 */
export async function generateTavernResponse(
  souls: Array<{ name: string; soul_card: Record<string, unknown> }>,
  targetSoulName: string | null,
  userMessage: string,
  conversationHistory: string,
  loreContext: string[],
): Promise<Array<{ soulName: string; response: string }>> {
  const validSouls = souls.filter((s) => s.name?.trim());
  if (validSouls.length === 0) return [];

  const context = {
    userMessage,
    history: conversationHistory,
    loreContext,
    directedToName: targetSoulName,
  };

  // 2-soul path: single monolithic call with turn-order enforcement
  if (validSouls.length === 2) {
    return generateDuoResponse(validSouls, context);
  }

  // 3-soul path: parallel isolated calls (one per soul), merged server-side
  const soulsToQuery = targetSoulName
    ? validSouls // each soul still gets its own call; directed clause handles skipping
    : validSouls;

  const results = await Promise.all(
    soulsToQuery.map((soul) => generateSingleSoulResponse(soul, context)),
  );

  // Filter nulls (silent souls), preserve generation order
  return results.filter((r): r is { soulName: string; response: string } => r !== null);
}

// ── New: Detect declarative facts in chat messages ──────────────────────
export async function detectDeclarativeFact(
  message: string,
): Promise<{ isFact: boolean; summary: string | null }> {
  const model = getGeminiModel();
  const prompt = `Analyze if this message from a worldbuilder contains a declarative fact about their world that should be recorded as lore.

Examples of declarative facts:
- "The artifact was actually destroyed centuries ago"
- "The Ember Cult is headquartered in the Obsidian Spire"
- "Kael can actually use shadow magic, not fire"

Not declarative facts:
- "What if the artifact was destroyed?"
- "Tell me about the Ember Cult"
- "That's interesting"

Message: "${message}"

Return strict JSON: {"is_fact": true/false, "summary": "one-line summary of the fact" or null}`;

  const response = await model.generateContent(prompt);
  const raw = response.response.text();

  try {
    const parsed = repairAndParseJSON<{ is_fact: boolean; summary: string | null }>(raw);
    return { isFact: parsed.is_fact ?? false, summary: parsed.summary ?? null };
  } catch {
    return { isFact: false, summary: null };
  }
}
