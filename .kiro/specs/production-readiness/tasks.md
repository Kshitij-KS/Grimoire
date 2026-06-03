# Implementation Plan: Production Readiness

## Overview

This plan transforms Grimoire from a development prototype into a launch-ready SaaS product across 12 areas: error monitoring, analytics, SEO, security, legal pages, error pages, dashboard performance, rate limit UX, onboarding, empty states, dead code removal, and PWA manifest. Each task is isolated to minimize blast radius and enable incremental delivery. The implementation uses TypeScript with the existing Next.js 14 App Router, Supabase, Zustand, and Radix/Tailwind stack.

## Tasks

- [x] 1. Error Monitoring Integration (Sentry)
  - [x] 1.1 Install and configure Sentry SDK for Next.js
    - Install `@sentry/nextjs` package
    - Create `sentry.client.config.ts` with DSN, environment, and tracesSampleRate
    - Create `sentry.server.config.ts` with DSN and server-specific options
    - Create `sentry.edge.config.ts` for edge runtime
    - Wrap `next.config.mjs` with `withSentryConfig` for source map uploads
    - _Requirements: 1.1_

  - [x] 1.2 Create Sentry utility helpers and API error wrapper
    - Create `lib/sentry.ts` with `initSentryUser(userId)`, `setSentryContext(route, worldId?)`, and `captureApiError(error, request)` functions
    - Create `withErrorMonitoring` higher-order function that wraps API route handlers, catches unhandled errors, reports to Sentry with route and world ID context, and returns a 500 JSON response with generic message (no stack traces exposed)
    - Attach authenticated user ID to error reports when available
    - Attach route path and world ID (if present in params) as context metadata
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [x] 1.3 Create global error boundary pages
    - Create `app/global-error.tsx` as root error boundary that reports to Sentry and renders fallback UI with dark fantasy styling, error message, and navigation link to dashboard
    - Create `app/error.tsx` as nested error boundary with retry logic (calls `reset()` once, then shows static "return to dashboard" link to prevent infinite loops)
    - Integrate Sentry `captureException` in both error boundaries
    - _Requirements: 1.2, 6.2, 6.3, 6.5_

  - [ ]* 1.4 Write unit tests for Sentry utility helpers
    - Test `withErrorMonitoring` returns 500 JSON without stack trace
    - Test user ID and route context are attached to error reports
    - Test world ID extraction from route params
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Security Hardening
  - [x] 2.1 Implement security headers in middleware
    - Create `lib/middleware/security-headers.ts` exporting header constants: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and `Strict-Transport-Security: max-age=31536000; includeSubDomains`
    - Extend existing `middleware.ts` to append security headers to all responses
    - _Requirements: 4.1, 4.4_

  - [x] 2.2 Implement auth endpoint IP rate limiter
    - Create `lib/middleware/auth-rate-limit.ts` with in-memory sliding window (10 requests per 60 seconds per IP)
    - Integrate into `middleware.ts` to check rate limit before processing `/api/auth/*` routes
    - Return 429 status with `Retry-After` header and JSON error body when limit exceeded
    - Include TTL cleanup to prevent memory leaks from expired entries
    - _Requirements: 4.2, 4.5_

  - [x] 2.3 Implement Content-Type validation guard
    - Create `lib/middleware/content-type-guard.ts` that validates `Content-Type: application/json` on POST/PATCH/DELETE requests
    - Return 415 status with JSON error body when Content-Type is missing or incorrect
    - Exclude routes that accept `multipart/form-data` (e.g., `/api/worlds/[id]/import`)
    - Apply validation in API route handlers or as shared utility
    - _Requirements: 4.3_

  - [ ]* 2.4 Write unit tests for security middleware
    - Test sliding window allows requests under limit and rejects over limit
    - Test Retry-After header calculation accuracy
    - Test expired entry cleanup
    - Test Content-Type guard accepts `application/json`, rejects `text/plain`, allows multipart on excluded routes
    - Test all required security headers are present on responses
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 3. Checkpoint - Ensure error monitoring and security pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Product Analytics Integration (PostHog)
  - [x] 4.1 Install PostHog and create provider component
    - Install `posthog-js` package
    - Create `components/providers/posthog-provider.tsx` with lazy initialization after hydration (max 3-second wait)
    - Wrap application in PostHog provider in root layout
    - Ensure provider initializes with cookieless mode and identifies authenticated user with ID and plan tier
    - All analytics operations wrapped in try-catch with silent failure
    - _Requirements: 2.1, 2.5_

  - [x] 4.2 Create type-safe analytics event tracking API
    - Create `lib/analytics-events.ts` with event name constants and payload type definitions
    - Create `lib/analytics.ts` with typed functions: `identifyUser(userId, { plan })`, `trackSectionViewed(section, worldId)`, `trackCoreAction(action, worldId)`, `trackRateLimitHit(action, limit, consumed)`
    - Define `CoreAction` type for: lore_inscribed, soul_forged, consistency_check_run, tavern_session_created, narrator_tool_used
    - Ensure all tracking calls are wrapped in try-catch with silent failure
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 4.3 Integrate analytics events into workspace sections
    - Add `trackSectionViewed` calls when user navigates to each World_Workspace section (lore, bible, souls, consistency, tapestry, tavern, narrator)
    - Add `trackCoreAction` calls on successful completion of core actions (lore inscribed, soul forged, consistency check run, tavern session created, narrator tool used)
    - Add `trackRateLimitHit` calls when rate limit responses are received
    - _Requirements: 2.2, 2.3, 2.4_

  - [ ]* 4.4 Write unit tests for analytics module
    - Test event functions call PostHog with correct event names and property shapes
    - Test silent failure when PostHog throws
    - Test identifyUser passes correct properties
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 5. SEO and Open Graph Meta Tags
  - [x] 5.1 Add metadata to landing page and demo page
    - Update `app/page.tsx` with exported `metadata` object containing title (max 60 chars), description (50-160 chars), canonical URL, Open Graph tags (og:title, og:description, og:image 1200×630, og:type "website", og:url), and Twitter Card tags (summary_large_image, twitter:title, twitter:description, twitter:image)
    - Add JSON-LD structured data with Organization schema (name, url) and WebApplication schema (name, url, applicationCategory)
    - Update `app/demo/page.tsx` with demo-specific metadata: og:title referencing Ashveil demo world, distinct og:description, og:image, og:type, og:url
    - Create placeholder OG images at `public/og-image.png` and `public/og-demo.png` (1200×630)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7_

  - [x] 5.2 Create robots.txt and sitemap.xml
    - Create `app/robots.ts` using Next.js convention: allow `/` and `/demo`, disallow `/dashboard`, `/worlds/*`, `/api/*`, `/login`, `/signup`
    - Create `app/sitemap.ts` using Next.js convention: include absolute URLs for `/` and `/demo`
    - _Requirements: 3.5, 3.6_

  - [ ]* 5.3 Write integration tests for SEO metadata
    - Test landing page metadata object has all required OG and Twitter Card fields
    - Test demo page metadata has distinct description and correct og:title
    - Test robots.txt has correct allow/disallow rules
    - Test sitemap.xml includes correct absolute URLs
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 6. Legal Pages
  - [x] 6.1 Create Terms of Service and Privacy Policy pages
    - Create `app/terms/page.tsx` with legal content structured using `<article>` semantics, numbered sections, last-updated date, and application design system styling
    - Create `app/privacy/page.tsx` with same structure and styling conventions
    - Both pages use the dark fantasy design tokens and layout
    - _Requirements: 5.1, 5.2_

  - [x] 6.2 Add legal links to landing page footer and signup form
    - Update landing page footer to include links to `/terms` and `/privacy`
    - Update `app/(auth)/signup/page.tsx` to display legal notice below submit button: "By signing up, you agree to the Terms of Service and Privacy Policy" with each as a link opening in a new tab (`target="_blank"`)
    - _Requirements: 5.3, 5.4, 5.5_

- [x] 7. Custom Error Pages
  - [x] 7.1 Create custom 404 not-found page
    - Create `app/not-found.tsx` using App Router convention with dark fantasy styling, application branding, "page not found" message, and smart navigation link (authenticated → dashboard, unauthenticated → landing page)
    - Use cookie presence for auth state detection on client-side
    - _Requirements: 6.1, 6.4_

  - [ ]* 7.2 Write unit tests for error pages
    - Test 404 page renders correct link based on auth state
    - Test error page calls reset on first failure then shows static link on second
    - _Requirements: 6.1, 6.2, 6.5_

- [x] 8. Checkpoint - Ensure analytics, SEO, legal, and error pages pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Dashboard Query Performance
  - [x] 9.1 Create Supabase RPC function for aggregated dashboard stats
    - Create SQL migration file `supabase/migrations/XXXX_dashboard_stats.sql` with `get_dashboard_stats(p_world_ids uuid[])` function
    - Function returns `TABLE(world_id uuid, lore_count bigint, soul_count bigint, entity_count bigint)` using LEFT JOINs with grouped counts
    - _Requirements: 7.1_

  - [x] 9.2 Refactor dashboard API route to use aggregated query
    - Refactor `app/api/dashboard/route.ts` to use 2-round-trip pattern:
      - Round-trip 1 (Promise.all): fetch worlds, profile, memberships
      - Round-trip 2 (Promise.all): call `get_dashboard_stats(allWorldIds)` + fetch recent activity
    - Add 5-second timeout via AbortController; return 504 with error message on timeout
    - Ensure no N×3 per-world query pattern remains
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 9.3 Write integration tests for dashboard query
    - Test RPC is called with correct world IDs
    - Test response completes within 2 await boundaries
    - Test timeout handling returns error state (not infinite spinner)
    - _Requirements: 7.2, 7.3, 7.4_

- [x] 10. Rate Limit User Experience
  - [x] 10.1 Create rate limit status hook and store extension
    - Create `lib/hooks/use-rate-limit-status.ts` hook that fetches current usage counts and exposes `isNearLimit(count, limit)` (80% threshold) and `remainingUses(count, limit)` helpers
    - Extend existing workspace Zustand store with `rateLimits: Record<string, { count: number; limit: number }>` and `setRateLimits` action
    - Implement UTC midnight reset detection with 60-second polling interval that refetches rate limits on day change
    - _Requirements: 8.1, 8.5_

  - [x] 10.2 Create rate limit warning badge and modal components
    - Create `components/shared/rate-limit-warning.tsx` as inline badge showing "X left today" when usage >= 80% of limit
    - Create/update `components/shared/rate-limit-modal.tsx` showing: action label (from labels mapping), current count / max count (e.g., "5 / 5"), hours:minutes remaining until UTC midnight reset, and upgrade prompt
    - _Requirements: 8.2, 8.3_

  - [x] 10.3 Integrate rate limit UX into workspace action buttons
    - Add rate limit warning badges adjacent to relevant action buttons in World_Workspace sections
    - Visually disable action buttons when daily limit is exhausted with tooltip showing action name, limit reached message, and time until reset
    - Show RateLimitModal when rate-limited API response (429) is received
    - Re-enable buttons and remove warnings when midnight reset is detected
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

  - [ ]* 10.4 Write unit tests for rate limit UX
    - Test 80% threshold calculation and remaining uses math
    - Test warning badge shows/hides at correct thresholds
    - Test modal displays correct action label, count, and countdown
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 11. Onboarding Flow
  - [x] 11.1 Extend profiles table and create onboarding step definitions
    - Create SQL migration adding `onboarding_state` JSONB column to `profiles` table with default value `{"currentStep": 0, "completedSteps": [false, false, false, false], "dismissed": false, "finished": false}`
    - Create `lib/onboarding-steps.ts` with step definitions (write-lore, view-entity, forge-soul, chat-soul), titles, sections, and TypeScript `OnboardingState` interface
    - _Requirements: 9.1, 9.2, 9.9_

  - [x] 11.2 Create onboarding hook and persistence logic
    - Create `lib/hooks/use-onboarding.ts` hook managing step state, completion detection, dismiss/resume, and server persistence
    - Step completion detection: step 1 on successful lore POST, step 2 on archive navigation with entities present (poll every 3s for up to 60s if extracting), step 3 on successful soul POST, step 4 on successful chat message with response
    - Persist onboarding state to `profiles.onboarding_state` on every step change
    - Handle dismiss (record current step as resume point) and auto-resume on re-entry
    - Mark onboarding as finished when all 4 steps complete; never show again
    - _Requirements: 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

  - [x] 11.3 Create onboarding panel UI component
    - Create `components/shared/onboarding-panel.tsx` as persistent guide panel showing: current step title, step number, progress indicator (X of 4), completion checkmarks, and dismiss button
    - Style with dark fantasy design system
    - Show waiting state with "Extracting entities..." message for step 2 when entities are being processed
    - Integrate into World_Workspace layout, activated only for first-time users on their first world
    - _Requirements: 9.1, 9.2, 9.4, 9.5, 9.7, 9.8_

  - [ ]* 11.4 Write unit tests for onboarding logic
    - Test step progression and completion detection
    - Test dismiss and resume behavior
    - Test finished state prevents re-display
    - Test polling state for entity extraction
    - _Requirements: 9.3, 9.4, 9.5, 9.6, 9.8, 9.9_

- [x] 12. Checkpoint - Ensure dashboard, rate limit, and onboarding pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Section Empty States
  - [x] 13.1 Create reusable empty state component
    - Create `components/shared/empty-state.tsx` with props: `icon`, `heading`, `description` (max 280 chars), `ctaLabel`, `ctaAction`
    - Style with dark fantasy design tokens (themed colors, typography, decorative elements)
    - Use section-specific icons from the application's existing icon set (lucide-react)
    - _Requirements: 10.1, 10.8_

  - [x] 13.2 Integrate empty states into all workspace sections
    - Add empty state to Lore Scribe (condition: zero lore entries) with CTA navigating to lore creation
    - Add empty state to The Archive (condition: zero entities) with CTA to Lore Scribe
    - Add empty state to Bound Souls with conditional messaging: if entities exist but no souls → CTA to Archive; if no entities and no souls → CTA to Lore Scribe
    - Add empty state to The Tavern (condition: fewer than 2 souls) with CTA to Bound Souls
    - Add empty state to Narrator's Eye (condition: zero lore entries) with CTA to Lore Scribe
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [ ]* 13.3 Write unit tests for empty state component
    - Test correct content renders per section condition
    - Test conditional Bound Souls messaging (entities present vs. absent)
    - Test CTA actions navigate to correct sections
    - _Requirements: 10.1, 10.4, 10.5, 10.6, 10.7_

- [x] 14. Dead Code and Unused Dependency Removal
  - [x] 14.1 Remove `@anthropic-ai/sdk` from project
    - Remove `@anthropic-ai/sdk` from `package.json` dependencies
    - Run `npm install` to regenerate `package-lock.json`
    - Grep all source files under `app/`, `components/`, and `lib/` for any import/reference to `@anthropic-ai/sdk` and remove if found
    - Verify `npm run build` exits with code 0
    - Verify `npm test` exits with code 0
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 15. Favicon and PWA Manifest
  - [x] 15.1 Create favicon assets and web app manifest
    - Create/place favicon PNG files in `public/`: `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` (180×180), `icon-192x192.png`, `icon-512x512.png` using brand palette (dark `#0A0A0B`, gold `#E5A85A`)
    - Create `public/site.webmanifest` with name "Grimoire — Worldbuilding Studio", short_name "Grimoire", theme_color `#0A0A0B`, background_color `#0A0A0B`, display "standalone", start_url "/", and icons array referencing all sizes with `image/png` MIME type
    - _Requirements: 12.1, 12.2, 12.4_

  - [x] 15.2 Update root layout with icon and manifest references
    - Update `app/layout.tsx` `<head>` to include `<link rel="icon">` tags for all favicon sizes, `<link rel="apple-touch-icon">`, `<link rel="manifest" href="/site.webmanifest">`, and `<meta name="theme-color" content="#0A0A0B">`
    - Ensure manifest and icon references are present on both landing and authenticated pages
    - _Requirements: 12.3, 12.4, 12.5_

- [x] 16. Final Checkpoint - Full build and test verification
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm run build` and verify exit code 0
  - Run `npm test` and verify all tests pass

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- No property-based tests are included — the design explicitly determined PBT is not applicable for this feature (integration, configuration, UI, and side-effect operations)
- Unit tests use Vitest (already configured); integration tests use MSW for API mocking
- All code uses TypeScript with the existing Next.js 14 App Router conventions

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "5.1", "14.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "2.3", "5.2", "6.1", "9.1", "15.1"] },
    { "id": 2, "tasks": ["1.3", "2.4", "4.1", "5.3", "6.2", "7.1", "9.2", "11.1", "15.2"] },
    { "id": 3, "tasks": ["1.4", "4.2", "7.2", "9.3", "10.1", "11.2", "13.1"] },
    { "id": 4, "tasks": ["4.3", "10.2", "11.3", "13.2"] },
    { "id": 5, "tasks": ["4.4", "10.3", "11.4", "13.3"] },
    { "id": 6, "tasks": ["10.4"] }
  ]
}
```
