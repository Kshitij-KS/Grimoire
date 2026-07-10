import { z } from "zod";

/**
 * Authoritative validation schema for waitlist submissions. Shared by the
 * `POST /api/waitlist` route handler and the client-side WaitlistDialog so both
 * agree on exactly what counts as a valid submission (Requirements 14.1, 14.3).
 */
export const waitlistSchema = z.object({
  email: z.string().email(),
  source: z.string().max(64).optional(),
});

export type WaitlistSubmission = z.infer<typeof waitlistSchema>;

/**
 * True iff `email` is a validly-formatted email address per the same rule the
 * waitlist accepts. Extracted into a pure function so it can be unit- and
 * property-tested independently of the route handler (Property 3).
 */
export function isValidWaitlistEmail(email: string): boolean {
  return z.string().email().safeParse(email).success;
}
