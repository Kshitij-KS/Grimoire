export const dynamic = "force-dynamic";
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest-client";
import { loreIngestFunction } from "@/lib/inngest/lore-ingest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [loreIngestFunction],
});
