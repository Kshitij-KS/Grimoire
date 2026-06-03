/**
 * Security headers applied to all responses via middleware.
 * Requirement 4.1: Secure HTTP response headers on all responses
 * Requirement 4.4: HSTS header in production
 */

export const X_CONTENT_TYPE_OPTIONS = "nosniff";
export const X_FRAME_OPTIONS = "DENY";
export const REFERRER_POLICY = "strict-origin-when-cross-origin";
export const PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=()";
export const STRICT_TRANSPORT_SECURITY =
  "max-age=31536000; includeSubDomains";

/**
 * Map of security headers to apply to all responses.
 * HSTS is excluded here and handled separately (production-only).
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": X_CONTENT_TYPE_OPTIONS,
  "X-Frame-Options": X_FRAME_OPTIONS,
  "Referrer-Policy": REFERRER_POLICY,
  "Permissions-Policy": PERMISSIONS_POLICY,
};

/**
 * Appends all security headers to the given response.
 * HSTS is only added when running in production to avoid browser
 * enforcement issues during local development.
 */
export function applySecurityHeaders(
  response: Response,
  isProduction: boolean = process.env.NODE_ENV === "production",
): void {
  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }

  if (isProduction) {
    response.headers.set(
      "Strict-Transport-Security",
      STRICT_TRANSPORT_SECURITY,
    );
  }
}
