export const dynamic = "force-dynamic";
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest-client";
import { loreIngestFunction } from "@/lib/inngest/lore-ingest";
import { env } from "@/lib/env";

if (process.env.NODE_ENV === "production" && !env.inngestSigningKey) {
  throw new Error("INNGEST_SIGNING_KEY is required in production environment");
}

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [loreIngestFunction],
});
