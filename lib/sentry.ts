import * as Sentry from "@sentry/nextjs";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Sets the authenticated user on the Sentry scope.
 */
export function initSentryUser(userId: string): void {
  Sentry.setUser({ id: userId });
}

/**
 * Sets route and optional world ID context on the Sentry scope.
 */
export function setSentryContext(route: string, worldId?: string): void {
  Sentry.setContext("route", {
    path: route,
    ...(worldId ? { worldId } : {}),
  });
}

/**
 * Captures an API error in Sentry with request context and returns a safe 500 response.
 */
export function captureApiError(error: unknown, request: Request): Response {
  const url = new URL(request.url);
  const route = url.pathname;
  const worldId = extractWorldId(route);

  setSentryContext(route, worldId);
  Sentry.captureException(error);

  return Response.json(
    { error: "An unexpected error occurred. Please try again." },
    { status: 500 },
  );
}

/**
 * Extracts a world ID from a URL path.
 * Matches patterns like /api/worlds/[uuid]/... or /worlds/[uuid]/...
 */
export function extractWorldId(pathname: string): string | undefined {
  const match = pathname.match(
    /\/worlds\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  return match?.[1];
}

/**
 * Higher-order function that wraps an API route handler with error monitoring.
 *
 * - Catches unhandled errors
 * - Reports them to Sentry with route and world ID context
 * - Attaches authenticated user ID when available
 * - Returns a safe 500 JSON response (no stack traces exposed)
 */
export function withErrorMonitoring(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      // Attempt to attach authenticated user context
      try {
        const supabase = createServerSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          initSentryUser(user.id);
        }
      } catch {
        // Auth context is best-effort; don't block the request
      }

      // Set route context before executing handler
      const url = new URL(req.url);
      const route = url.pathname;
      const worldId = extractWorldId(route);
      setSentryContext(route, worldId);

      return await handler(req);
    } catch (error) {
      return captureApiError(error, req);
    }
  };
}
