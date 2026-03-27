/**
 * Attempts to repair malformed JSON before parsing fails.
 * Handles common Gemini output issues:
 * - Missing closing brackets/braces
 * - Trailing commas
 * - Unclosed strings
 * - Markdown code fence wrapping
 * - Thinking preamble text before JSON
 */
export function repairAndParseJSON<T = unknown>(raw: string): T {
  // Step 1: Strip markdown code fences
  let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");

  // Step 2: Extract JSON from thinking preamble (Gemini 2.5 Pro often thinks first)
  const jsonStart = cleaned.search(/[\[{]/);
  if (jsonStart > 0) {
    cleaned = cleaned.slice(jsonStart);
  }

  // Step 3: Try parsing as-is first
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Continue to repair
  }

  // Step 4: Remove trailing commas before closing brackets
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  // Step 5: Fix unclosed strings — find unmatched quotes
  const quoteCount = (cleaned.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    cleaned += '"';
  }

  // Step 6: Balance brackets
  const openBraces = (cleaned.match(/{/g) || []).length;
  const closeBraces = (cleaned.match(/}/g) || []).length;
  const openBrackets = (cleaned.match(/\[/g) || []).length;
  const closeBrackets = (cleaned.match(/]/g) || []).length;

  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    cleaned += "]";
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    cleaned += "}";
  }

  // Step 7: Try parsing the repaired string
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Step 8: Last resort — try to extract the first valid JSON object/array
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);

    const candidate = objectMatch?.[0] || arrayMatch?.[0];
    if (candidate) {
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // Fall through
      }
    }

    throw new Error(
      `JSON repair failed. Raw (first 500 chars): ${raw.slice(0, 500)}`,
    );
  }
}

/**
 * Safely parse AI JSON output with fallback repair.
 * Returns { ok: true, data } or { ok: false, error }.
 */
export function safeParseAIJSON<T = unknown>(
  raw: string,
): { ok: true; data: T } | { ok: false; error: string } {
  try {
    const data = repairAndParseJSON<T>(raw);
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown JSON parse error",
    };
  }
}
