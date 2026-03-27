import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DAILY_LIMITS } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export function jsonError(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function jsonRateLimited(action: keyof typeof DAILY_LIMITS, limit: number) {
  return NextResponse.json(
    {
      error: "RATE_LIMITED",
      action,
      limit,
      resetAt: "midnight UTC",
    },
    { status: 429 },
  );
}

export function zodErrorResponse(error: ZodError) {
  return NextResponse.json(
    {
      error: "VALIDATION_ERROR",
      issues: error.flatten(),
    },
    { status: 400 },
  );
}

export async function requireUser() {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: jsonError("UNAUTHORIZED", 401), supabase };
    }

    return { user, supabase };
  } catch (error) {
    return {
      error: jsonError("CONFIGURATION_ERROR", 500, {
        detail: error instanceof Error ? error.message : "Missing server configuration.",
      }),
    };
  }
}
