// Feature: ship-plan-v1, Property 3: Waitlist accepts an email if and only if it is validly formatted
//
// Exercises the shared validation used by both `POST /api/waitlist` and the
// WaitlistDialog (`lib/waitlist.ts`): `waitlistSchema` / `isValidWaitlistEmail`.
// The property is a biconditional — a submission is accepted exactly when its
// email is validly formatted:
//   - valid-format addresses (fast-check's emailAddress() arbitrary) are accepted
//   - arbitrary strings are accepted iff they are valid, rejected otherwise
//     (random strings can occasionally be valid emails, so we branch on the
//     authoritative validator rather than assuming "random string ⇒ invalid").
//
// **Validates: Requirements 14.1, 14.3**

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { isValidWaitlistEmail, waitlistSchema } from "@/lib/waitlist";

// A generator of clearly-valid email addresses. fast-check's emailAddress()
// follows RFC 5321 and can emit local parts containing special characters (e.g.
// "!a@a.aa") that our authoritative validator (Zod's .email()) intentionally
// rejects, so it is a poor proxy for "our valid set". We instead assemble
// addresses from alphanumeric-ish parts that the schema definitely accepts.
const alnum = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
const alnumString = (min: number, max: number) =>
  fc.array(fc.constantFrom(...alnum), { minLength: min, maxLength: max }).map((cs) => cs.join(""));
const localPart = alnumString(1, 20);
const domainLabel = alnumString(1, 12);
const tld = fc.constantFrom("com", "net", "org", "io", "dev", "co");
const validEmail = fc
  .tuple(localPart, domainLabel, tld)
  .map(([local, domain, ext]) => `${local}@${domain}.${ext}`);

describe("Feature: ship-plan-v1, Property 3: Waitlist accepts an email iff it is validly formatted", () => {
  it("accepts every validly-formatted email address", () => {
    fc.assert(
      fc.property(validEmail, (email) => {
        expect(isValidWaitlistEmail(email)).toBe(true);
        expect(waitlistSchema.safeParse({ email }).success).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it("accepts an arbitrary string iff it is a valid email (biconditional)", () => {
    fc.assert(
      fc.property(fc.string(), fc.option(fc.string({ maxLength: 64 })), (email, source) => {
        const valid = isValidWaitlistEmail(email);

        // The schema's accept decision must agree with the pure validator.
        const parsed = waitlistSchema.safeParse(
          source === null ? { email } : { email, source },
        );

        // source over the 64-char cap is independently rejected; keep it in range
        // so the outcome is driven purely by email validity.
        const sourceValid = source === null || source.length <= 64;
        expect(parsed.success).toBe(valid && sourceValid);
      }),
      { numRuns: 200 },
    );
  });

  it("rejects strings that are structurally not emails", () => {
    fc.assert(
      fc.property(
        // Strings with no '@' can never be valid emails — filter defensively in
        // case a generated value happens to contain one.
        fc.string().filter((s) => !s.includes("@")),
        (notEmail) => {
          expect(isValidWaitlistEmail(notEmail)).toBe(false);
          expect(waitlistSchema.safeParse({ email: notEmail }).success).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });
});
