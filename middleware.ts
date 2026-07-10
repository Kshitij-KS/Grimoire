import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { applySecurityHeaders } from "@/lib/middleware/security-headers";
import {
  checkAuthRateLimit,
  getClientIp,
} from "@/lib/middleware/auth-rate-limit";

export async function middleware(request: NextRequest) {
  if (!env.nextPublicSupabaseUrl || !env.nextPublicSupabaseAnonKey) {
    const earlyResponse = NextResponse.next();
    applySecurityHeaders(earlyResponse);
    return earlyResponse;
  }

  // Gate all eval API routes outside development so service-role-backed eval
  // endpoints are unreachable in production. 404 avoids advertising them.
  if (
    request.nextUrl.pathname.startsWith("/api/eval") &&
    process.env.NODE_ENV !== "development"
  ) {
    const evalGateResponse = NextResponse.json(
      { error: "Not found" },
      { status: 404 },
    );
    applySecurityHeaders(evalGateResponse);
    return evalGateResponse;
  }

  // Rate limit auth endpoints BEFORE session refresh to short-circuit abusive traffic
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    const ip = getClientIp(request);
    const { allowed, retryAfter } = checkAuthRateLimit(ip);

    if (!allowed) {
      const rateLimitResponse = NextResponse.json(
        { error: "Rate limit exceeded. Please wait before trying again." },
        { status: 429 },
      );
      rateLimitResponse.headers.set("Retry-After", String(retryAfter));
      applySecurityHeaders(rateLimitResponse);
      return rateLimitResponse;
    }
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    env.nextPublicSupabaseUrl,
    env.nextPublicSupabaseAnonKey,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  await supabase.auth.getUser();

  // Append security headers to every response
  applySecurityHeaders(response);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
