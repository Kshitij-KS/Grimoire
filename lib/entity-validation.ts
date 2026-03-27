import { z } from "zod";

export const entityTypeValues = ["character", "location", "faction", "artifact", "event", "rule"] as const;

export const entityPatchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(entityTypeValues),
  summary: z.string().trim().max(3000).nullable().optional(),
});

export type EntityPatchInput = z.infer<typeof entityPatchSchema>;
