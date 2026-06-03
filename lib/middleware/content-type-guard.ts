/**
 * Content-Type validation guard for API routes.
 * Requirement 4.3: Validate Content-Type header on POST/PATCH/DELETE routes
 *
 * Usage in API route handlers:
 *   const error = validateContentType(request);
 *   if (error) return error;
 */

/** HTTP methods that require Content-Type validation (they carry a request body). */
const METHODS_REQUIRING_BODY = new Set(["POST", "PATCH", "DELETE"]);

/**
 * Route patterns that accept multipart/form-data instead of application/json.
 * These are excluded from Content-Type validation.
 */
const MULTIPART_ROUTE_PATTERNS: RegExp[] = [
  /^\/api\/worlds\/[^/]+\/import$/,
];

/**
 * Checks whether a given pathname matches a route that accepts multipart/form-data.
 */
export function isMultipartRoute(pathname: string): boolean {
  return MULTIPART_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * Validates that the request has `Content-Type: application/json` for
 * methods that carry a request body (POST, PATCH, DELETE).
 *
 * @param request - The incoming Request object
 * @param pathname - Optional pathname override. If not provided, parsed from request.url.
 * @returns A 415 Response if validation fails, or null if the request is valid.
 */
export function validateContentType(
  request: Request,
  pathname?: string,
): Response | null {
  const method = request.method.toUpperCase();

  // Only validate methods that carry a request body
  if (!METHODS_REQUIRING_BODY.has(method)) {
    return null;
  }

  // Determine the pathname
  const resolvedPathname =
    pathname ?? new URL(request.url).pathname;

  // Skip validation for multipart routes
  if (isMultipartRoute(resolvedPathname)) {
    return null;
  }

  // Check the Content-Type header (case-insensitive, may include charset)
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  // Invalid or missing Content-Type
  return new Response(
    JSON.stringify({ error: "Content-Type must be application/json" }),
    {
      status: 415,
      headers: { "Content-Type": "application/json" },
    },
  );
}
