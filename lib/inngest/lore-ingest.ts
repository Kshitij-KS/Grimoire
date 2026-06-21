import { inngest } from "@/lib/inngest-client";
import { createClient } from "@supabase/supabase-js";
import { processLoreEntry } from "@/lib/lore-processing";
import type { FailureCategory } from "@/lib/embedding/errors";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * The closed set of embedding failure categories (mirrors
 * {@link FailureCategory} in `lib/embedding/errors.ts`) as a runtime-checkable
 * list. Used to recover the failure category from the error that reaches the
 * Inngest `onFailure` handler, whether it arrives as a structured field on a
 * serialized {@link EmbeddingError} or only embedded in the error message text.
 */
const FAILURE_CATEGORIES: readonly FailureCategory[] = [
  "rate-limit",
  "dimension-mismatch",
  "invalid-input",
  "unrecognized-response",
  "other",
];

/**
 * Recover the {@link FailureCategory} for a terminal embedding failure.
 *
 * Inngest serializes the thrown error before it reaches `onFailure`, so the
 * original `EmbeddingError` arrives as a plain object rather than a class
 * instance. We therefore (1) prefer a `category` field if it survived
 * serialization, then (2) fall back to scanning the error message, which the
 * hardened service formats with the final category in parentheses
 * (e.g. `"... failed after 6 attempts (rate-limit): ..."`). Returns `null` when
 * no category can be determined.
 */
function extractFailureCategory(error: {
  message?: string;
  category?: unknown;
}): FailureCategory | null {
  if (
    typeof error.category === "string" &&
    (FAILURE_CATEGORIES as readonly string[]).includes(error.category)
  ) {
    return error.category as FailureCategory;
  }

  const message = error.message ?? "";
  for (const category of FAILURE_CATEGORIES) {
    if (message.includes(`(${category})`)) {
      return category;
    }
  }

  return null;
}

/**
 * Recover the zero-based originating chunk index from a terminal embedding
 * failure. The write-path retry wrapper names the failing chunk in its message
 * (e.g. `"Embedding failed for chunk 3 after ..."`), so we parse it back out.
 * Returns `null` when no chunk index is present in the message.
 */
function extractChunkIndex(error: { message?: string }): number | null {
  const match = (error.message ?? "").match(/chunk\s+(\d+)/i);
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isInteger(index) ? index : null;
}

export const loreIngestFunction = inngest.createFunction(
  {
    id: "lore-inscribe",
    retries: 3,
    triggers: [{ event: "lore.inscribed" }],
    onFailure: async ({ error, event }: { error: { message: string; name?: string; category?: unknown }; event: { data: Record<string, unknown> } }) => {
      const supabase = getServiceClient();
      const { event: originalEvent } = event.data as {
        event: { data: { userId: string; worldId: string; entryId: string } };
        error: { message: string; name: string };
      };
      const eventData = originalEvent.data;

      // Recover structured failure observability from the terminal error so the
      // failed_jobs record carries the originating zero-based chunk index, the
      // failure category, and the final error message (R3.4, R8.3). The
      // failed_jobs table has no dedicated chunk_index/category columns, so
      // these are recorded inside the existing `payload` jsonb alongside the
      // raw failure event, while `error_message` uses its dedicated column.
      const category = extractFailureCategory(error);
      const chunkIndex = extractChunkIndex(error);

      await supabase.from("failed_jobs").insert({
        user_id: eventData.userId,
        world_id: eventData.worldId,
        event_name: "lore.inscribed",
        payload: {
          ...(event.data as Record<string, unknown>),
          chunk_index: chunkIndex,
          category,
        },
        error_message: error.message,
        lore_entry_id: eventData.entryId,
        status: "failed",
      });
      await supabase
        .from("lore_entries")
        .update({ processing_status: "failed" })
        .eq("id", eventData.entryId);
    },
  },
  async ({ event, step }: { event: { data: Record<string, unknown> }; step: { run: <T>(name: string, fn: () => Promise<T>) => Promise<T> } }) => {
    const { worldId, entryId, content } = event.data as {
      worldId: string;
      entryId: string;
      content: string;
      userId: string;
    };
    const supabase = getServiceClient();

    const result = await step.run("process-lore-entry", async () => {
      return processLoreEntry({
        supabase,
        worldId,
        entryId,
        content,
      });
    });

    await step.run("resolve-failed-jobs", async () => {
      await supabase
        .from("failed_jobs")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("lore_entry_id", entryId)
        .neq("status", "resolved");
    });

    return {
      entryId,
      chunksCreated: result.chunksCreated,
      entitiesFound: result.entitiesFound.length,
    };
  }
);
