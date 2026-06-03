# Requirements Document

## Introduction

This document defines the production-readiness requirements for Grimoire, a dark fantasy worldbuilding SaaS. The feature addresses critical gaps identified during a comprehensive codebase audit that must be resolved before launching to real users. It covers error monitoring, analytics, SEO and meta tags, security hardening, legal pages, error pages, performance optimization, rate limit UX, onboarding, empty states, and dead-code cleanup.

## Glossary

- **Grimoire_App**: The Next.js 14 App Router application serving the Grimoire SaaS product
- **Error_Monitor**: A client and server-side error tracking service (e.g., Sentry) integrated into the application
- **Analytics_Service**: A product analytics service (e.g., PostHog) tracking user behavior and feature engagement
- **Landing_Page**: The public-facing marketing page at the root route (`/`)
- **Dashboard**: The authenticated user's home page showing worlds, stats, and activity
- **World_Workspace**: The main interface where users interact with all 7 world sections
- **Rate_Limiter**: The existing per-user, per-day rate limiting system in `lib/rate-limit.ts`
- **Onboarding_Flow**: A guided first-use experience shown to new users after world creation
- **OG_Tags**: Open Graph meta tags used for rich link previews on social platforms
- **SEO_Metadata**: Search engine optimization metadata including title, description, canonical URL, and structured data
- **Error_Boundary**: A React error boundary component that catches rendering errors and displays a fallback UI
- **Empty_State**: A UI component shown when a section has no content, providing guidance and a call-to-action
- **Dashboard_Query**: The server-side data fetching logic for the dashboard page that currently makes N×3 parallel queries
- **Dead_Code**: Unused dependencies or unreferenced code modules present in the codebase

## Requirements

### Requirement 1: Error Monitoring Integration

**User Story:** As a developer, I want unhandled errors to be captured and reported automatically, so that I can identify and fix production issues before users report them.

#### Acceptance Criteria

1. THE Grimoire_App SHALL integrate an Error_Monitor client that captures unhandled JavaScript exceptions on both client and server
2. WHEN an unhandled exception occurs in a React component, THE Error_Boundary SHALL catch the error, report it to the Error_Monitor, and render a fallback UI consistent with the application's dark fantasy design system that includes a human-readable error message and a navigation action allowing the user to return to the Dashboard
3. WHEN an unhandled exception occurs in an API route handler, THE Grimoire_App SHALL report the error to the Error_Monitor and return a JSON response with a 500 status code containing an "error" field with a generic human-readable message that does not expose internal stack traces, source paths, or sensitive configuration details
4. IF the user is authenticated, THEN THE Error_Monitor SHALL attach the authenticated user's ID to the error report
5. THE Error_Monitor SHALL attach the current route path as context metadata on each error report
6. IF the error occurs within a route that contains a world ID parameter, THEN THE Error_Monitor SHALL attach the world ID as additional context metadata on the error report

### Requirement 2: Product Analytics Integration

**User Story:** As a product owner, I want to track how users interact with each feature, so that I can make data-driven decisions about what to improve or remove.

#### Acceptance Criteria

1. WHEN an authenticated user loads any page within the Grimoire_App, THE Analytics_Service client SHALL initialize within 3 seconds of the page becoming interactive and identify the user by their authenticated user ID with a plan tier property (free or pro)
2. WHEN a user navigates to a World_Workspace section, THE Analytics_Service SHALL record a section-viewed event containing the section name (one of: lore, bible, souls, consistency, tapestry, tavern, narrator) and the world ID
3. WHEN a user completes a core action (lore inscribed, soul forged, consistency check run, tavern session created, narrator tool used), THE Analytics_Service SHALL record a named event containing the action name, the world ID, and a timestamp
4. WHEN a user hits a rate limit, THE Analytics_Service SHALL record a rate-limit-hit event containing the action type, the daily limit value for that action, and the number of actions consumed in the current day
5. IF the Analytics_Service fails to initialize or fails to send an event, THEN THE Grimoire_App SHALL continue normal operation without interruption and SHALL NOT display an error to the user
6. THE Analytics_Service SHALL transmit recorded events to the analytics backend within 30 seconds of the triggering action

### Requirement 3: SEO and Open Graph Meta Tags

**User Story:** As a marketer, I want the landing page and public pages to have proper meta tags, so that links shared on social platforms display rich previews and search engines index the site correctly.

#### Acceptance Criteria

1. THE Landing_Page SHALL include a title tag (max 60 characters), a meta description (between 50 and 160 characters), an absolute canonical URL, and OG_Tags (og:title, og:description, og:image as an absolute URL pointing to an image at least 1200×630 pixels, og:type set to "website", og:url as an absolute URL)
2. THE Landing_Page SHALL include Twitter Card meta tags with twitter:card set to "summary_large_image", twitter:title, twitter:description, and twitter:image as an absolute URL
3. THE Landing_Page SHALL include structured data (JSON-LD) with Organization schema (containing name and url properties) and WebApplication schema (containing name, url, and applicationCategory properties)
4. WHEN the `/demo` route is accessed, THE Grimoire_App SHALL serve OG_Tags with an og:title referencing the Ashveil demo world, an og:description distinct from the landing page description, an og:image at least 1200×630 pixels, og:type set to "website", and og:url set to the absolute URL of the demo page
5. THE Grimoire_App SHALL serve a `robots.txt` that allows crawling of `/` and `/demo` and disallows `/dashboard`, `/worlds/*`, `/api/*`, `/login`, and `/signup`
6. THE Grimoire_App SHALL serve a `sitemap.xml` that includes absolute URLs for the landing page (`/`) and the demo page (`/demo`)
7. WHEN the Landing_Page or demo page is rendered, THE Grimoire_App SHALL ensure all og:image URLs and canonical URLs resolve to publicly accessible resources without requiring authentication

### Requirement 4: Security Hardening

**User Story:** As a developer, I want the application to have baseline security protections, so that common attacks are mitigated before launch.

#### Acceptance Criteria

1. THE Grimoire_App SHALL set secure HTTP response headers on all responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`
2. WHEN an authentication API endpoint (`/api/auth/*`) receives more than 10 requests from the same IP within a 60-second sliding window, THE Rate_Limiter SHALL reject subsequent requests with a 429 status code and a `Retry-After` header indicating the number of seconds until the next request is allowed
3. THE Grimoire_App SHALL validate the `Content-Type` header on all POST/PATCH/DELETE API routes that expect JSON payloads, and reject requests that do not specify `application/json` with a 415 status code, excluding routes that accept `multipart/form-data` uploads (such as `/api/worlds/[id]/import`)
4. WHEN the application is served in production, THE Grimoire_App SHALL set `Strict-Transport-Security` header with a max-age of 31536000 seconds and the `includeSubDomains` directive
5. IF the Rate_Limiter rejects a request, THEN THE Grimoire_App SHALL return a response body containing an error message indicating the rate limit has been exceeded and the request was not processed

### Requirement 5: Legal Pages

**User Story:** As a business owner, I want Terms of Service and Privacy Policy pages available on the site, so that I meet legal requirements for launching a SaaS product.

#### Acceptance Criteria

1. THE Grimoire_App SHALL serve a Terms of Service page at the `/terms` route that renders legal content organized with a page heading, numbered or titled sections, and a visible last-updated date, using the application's design system
2. THE Grimoire_App SHALL serve a Privacy Policy page at the `/privacy` route that renders legal content organized with a page heading, numbered or titled sections, and a visible last-updated date, using the application's design system
3. THE Landing_Page SHALL include links to the Terms of Service and Privacy Policy pages in the footer
4. WHILE the auth form is in signup mode, THE Grimoire_App SHALL display a text notice below the submit button stating that signing up constitutes agreement to the Terms of Service and Privacy Policy, where each policy name is a navigable link to its respective page
5. WHEN a user activates a Terms of Service or Privacy Policy link from the signup notice, THE Grimoire_App SHALL open the linked page in a new browser tab so that the user's signup form state is preserved

### Requirement 6: Custom Error Pages

**User Story:** As a user, I want to see helpful, on-brand error pages when something goes wrong, so that I understand what happened and can navigate back to a working state.

#### Acceptance Criteria

1. THE Grimoire_App SHALL render a custom 404 page at the `not-found.tsx` App Router convention that includes the application branding, a message indicating the requested page does not exist, and a navigation link that directs authenticated users to the dashboard and unauthenticated users to the landing page
2. THE Grimoire_App SHALL render a custom global error page at the `error.tsx` App Router convention that includes the application branding, a message indicating an unexpected error occurred, and a retry button that invokes the error boundary's `reset()` function to attempt re-rendering
3. WHEN the global error page renders, THE Error_Monitor SHALL receive the error details automatically via the Error_Boundary integration
4. THE custom 404 page and error page SHALL use the application's dark fantasy design system (themed colors, typography, decorative elements)
5. WHEN the retry button on the global error page is activated and the error persists after re-render, THE Grimoire_App SHALL continue displaying the error page without entering an infinite reset loop

### Requirement 7: Dashboard Query Performance

**User Story:** As a user with multiple worlds, I want the dashboard to load quickly, so that I can access my worlds without delay.

#### Acceptance Criteria

1. THE Dashboard_Query SHALL retrieve per-world statistics (lore entry count, soul count, entity count) using aggregated queries grouped by world_id rather than issuing separate count queries per world
2. WHEN the dashboard page loads, THE Grimoire_App SHALL complete all data fetching in at most 2 sequential database round-trips, where a round-trip is defined as one await boundary (parallel queries issued within a single Promise.all count as one round-trip)
3. THE Dashboard_Query SHALL return the complete API response within 500ms server-side processing time (measured from request receipt to response send, excluding network latency) for a user with up to 10 worlds, each containing up to 100 lore entries, up to 50 souls, and up to 50 entities
4. IF the dashboard data fetch fails or exceeds a 5-second timeout, THEN THE Grimoire_App SHALL return a response indicating the failure and SHALL NOT leave the user on an indefinitely loading state

### Requirement 8: Rate Limit User Experience

**User Story:** As a user, I want clear feedback when I approach or hit a rate limit, so that I understand the constraint and know what action to take.

#### Acceptance Criteria

1. WHEN a user's usage reaches 80% of a daily limit for any action, THE World_Workspace SHALL display a non-blocking warning indicator adjacent to the relevant action button showing the number of remaining uses as a numeric count (e.g., "2 left today")
2. WHEN a rate-limited API request is rejected due to an exhausted daily limit, THE Grimoire_App SHALL display the RateLimitModal showing the action name, current usage count, maximum allowed count, time remaining until UTC midnight reset, and a prompt directing the user to the upgrade option
3. THE RateLimitModal SHALL display the specific action label (from the defined action labels mapping), the current count out of the maximum allowed (e.g., "5 / 5"), and the reset countdown as hours and minutes remaining until the next UTC midnight
4. WHILE a user has exhausted a daily limit, THE World_Workspace SHALL visually disable the corresponding action button and display a tooltip on hover stating the action name, that the daily limit has been reached, and the time remaining until reset
5. WHEN a user's daily usage resets at UTC midnight while the World_Workspace is open, THE World_Workspace SHALL re-enable any previously disabled action buttons and remove any warning indicators within 60 seconds of the reset time

### Requirement 9: Onboarding Flow

**User Story:** As a new user, I want guided steps after creating my first world, so that I understand how to use the product and experience value quickly.

#### Acceptance Criteria

1. WHEN a user creates their first world and enters the World_Workspace for the first time, THE Onboarding_Flow SHALL activate and display a persistent guide panel indicating the current step, step title, and a progress indicator showing completed steps out of four total steps
2. THE Onboarding_Flow SHALL present four sequential steps in this order: (1) write and save a lore entry, (2) view at least one extracted entity in the archive section, (3) forge a soul from an entity, (4) send at least one message to the forged soul in the chat interface
3. WHEN the user completes a step, THE Onboarding_Flow SHALL detect completion as follows: step 1 completes when a lore entry is successfully saved, step 2 completes when the user navigates to the archive section and at least one entity exists, step 3 completes when a soul is successfully created, step 4 completes when the user sends a chat message to any soul and receives a response
4. WHEN the user completes a step, THE Onboarding_Flow SHALL mark that step with a visible completion indicator, advance the guide to display the next incomplete step, and update the progress indicator within 2 seconds of the triggering action
5. THE Onboarding_Flow SHALL display a dismiss control that, when activated, hides the guide panel and records the current step as the resume point
6. WHEN a user who previously dismissed the onboarding re-enters the World_Workspace, THE Onboarding_Flow SHALL automatically re-display the guide panel starting from the first incomplete step
7. IF the user reaches step 2 and no entities have been extracted yet due to asynchronous processing, THEN THE Onboarding_Flow SHALL display a waiting state indicating that entity extraction is in progress and advance to step 2 completion once at least one entity appears
8. WHEN all four steps are completed, THE Onboarding_Flow SHALL mark the onboarding as finished, hide the guide panel, and not display again for that user on subsequent visits
9. THE Onboarding_Flow state (current step index, dismissed status, completion flag per step) SHALL persist across sessions using the user's profile record

### Requirement 10: Section Empty States

**User Story:** As a user, I want each workspace section to show helpful guidance when empty, so that I understand what the section does and how to get started.

#### Acceptance Criteria

1. WHEN a World_Workspace section meets its empty condition (Lore Scribe: zero lore entries; The Archive: zero entities; Bound Souls: zero souls; The Tavern: fewer than 2 souls in the world; Narrator's Eye: zero lore entries to check against), THE Grimoire_App SHALL display an Empty_State component containing a section-specific icon, a heading, a descriptive paragraph of no more than 280 characters, and a single primary call-to-action button
2. THE Empty_State for the Lore Scribe section SHALL display a description indicating that lore entries power the entire system and SHALL provide a call-to-action button that navigates the user to the lore creation view
3. THE Empty_State for The Archive section SHALL display a description indicating that entities are extracted automatically after lore is inscribed and SHALL provide a call-to-action button that navigates the user to the Lore Scribe section
4. IF the world contains one or more entities but zero souls, THEN THE Empty_State for the Bound Souls section SHALL display a description indicating that souls are forged from entities and SHALL provide a call-to-action button that navigates the user to The Archive section
5. IF the world contains zero entities and zero souls, THEN THE Empty_State for the Bound Souls section SHALL display a description indicating that souls require lore-derived entities and SHALL provide a call-to-action button that navigates the user to the Lore Scribe section
6. IF the world contains fewer than 2 souls, THEN THE Empty_State for The Tavern section SHALL display a description explaining multi-soul conversation and SHALL provide a call-to-action button that navigates the user to the Bound Souls section
7. THE Empty_State for the Narrator's Eye section SHALL display a description explaining consistency checking and SHALL provide a call-to-action button that navigates the user to the Lore Scribe section
8. EACH Empty_State SHALL render using the application's existing dark-fantasy design tokens and SHALL display a section-specific icon from the application's icon set

### Requirement 11: Dead Code and Unused Dependency Removal

**User Story:** As a developer, I want unused dependencies removed from the project, so that the bundle size is smaller and the dependency surface area is minimized.

#### Acceptance Criteria

1. THE Grimoire_App SHALL remove the `@anthropic-ai/sdk` package from `package.json` and `package-lock.json` since no application source file imports or references it
2. WHEN a dependency is removed from `package.json`, THE Grimoire_App SHALL verify that both the build (`npm run build`) and the test suite (`npm test`) complete with exit code 0
3. THE Grimoire_App SHALL not contain any import statement, require call, or module reference to a removed dependency in any file under `app/`, `components/`, or `lib/` directories
4. WHEN a dependency is removed, THE Grimoire_App SHALL verify that no remaining source file contains a string literal referencing the removed package name (e.g., `"@anthropic-ai/sdk"`)
5. IF the `node_modules` folder is regenerated via `npm install` after dependency removal, THEN THE Grimoire_App SHALL produce a `package-lock.json` that no longer lists the removed package as a direct or transitive dependency entry at the root level

### Requirement 12: Favicon and PWA Manifest

**User Story:** As a user, I want the application to have a polished browser presence with a proper favicon and web app manifest, so that it appears professional in browser tabs and can be installed as a PWA on mobile.

#### Acceptance Criteria

1. THE Grimoire_App SHALL serve favicon images in PNG format at the following sizes: 16x16, 32x32, 180x180 (apple-touch-icon), 192x192, and 512x512, where each icon uses the application's brand palette (dark background `#0A0A0B` and gold accent `#E5A85A`)
2. THE Grimoire_App SHALL serve a `site.webmanifest` file containing: `name` set to "Grimoire — Worldbuilding Studio", `short_name` set to "Grimoire", `theme_color` set to `#0A0A0B`, `background_color` set to `#0A0A0B`, `display` set to "standalone", and an `icons` array referencing all served icon sizes with their corresponding MIME types
3. THE Landing_Page and all authenticated pages SHALL reference the manifest file via a `<link rel="manifest">` tag in the document head
4. WHEN a browser evaluates PWA installability criteria, THE Grimoire_App SHALL satisfy the manifest requirements such that Chrome's "Add to Home Screen" prompt is available (valid manifest with name, 192x192 icon, 512x512 icon, start_url, and display set to standalone)
5. THE Grimoire_App SHALL include a `<meta name="theme-color" content="#0A0A0B">` tag in the document head so that mobile browsers apply the brand color to the browser chrome
