import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/dashboard";

  // Validate next param — only allow relative paths to prevent open redirect
  const safeNext = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  if (code) {
    const supabase = createServerSupabaseClient();
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(new URL("/auth?error=session_failed", url.origin));
      }
    } catch {
      return NextResponse.redirect(new URL("/auth?error=session_failed", url.origin));
    }
  }

  return NextResponse.redirect(new URL(safeNext, url.origin));
}
