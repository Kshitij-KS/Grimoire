import { inngest } from "@/lib/inngest-client";
import { createClient } from "@supabase/supabase-js";
import { processLoreEntry } from "@/lib/lore-processing";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role credentials");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const loreIngestFunction = inngest.createFunction(
  {
    id: "lore-inscribe",
    retries: 3,
    triggers: [{ event: "lore.inscribed" }],
    onFailure: async ({ error, event }: { error: { message: string }; event: { data: Record<string, unknown> } }) => {
      const supabase = getServiceClient();
      const { event: originalEvent } = event.data as {
        event: { data: { userId: string; worldId: string; entryId: string } };
        error: { message: string; name: string };
      };
      const eventData = originalEvent.data;
      await supabase.from("failed_jobs").insert({
        user_id: eventData.userId,
        world_id: eventData.worldId,
        event_name: "lore.inscribed",
        payload: event.data,
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
