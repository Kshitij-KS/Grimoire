"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Checks for the presence of a Supabase auth cookie to determine
 * if the user is authenticated. Supabase SSR sets cookies matching
 * the pattern: sb-<project-ref>-auth-token
 */
function getIsAuthenticated(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((c) => c.trim().startsWith("sb-") && c.includes("-auth-token"));
}

export default function NotFound() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(getIsAuthenticated());
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-6 text-center">
      {/* Decorative top accent */}
      <div className="mb-8 h-px w-24 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />

      {/* Branding */}
      <h1 className="font-heading text-2xl tracking-wide text-[var(--accent)]">
        Grimoire
      </h1>

      {/* Error code */}
      <p className="mt-6 font-heading text-7xl font-bold text-[var(--text-main)] md:text-9xl">
        404
      </p>

      {/* Message */}
      <h2 className="mt-4 font-heading text-xl text-[var(--text-main)] md:text-2xl">
        Page Not Found
      </h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
        The page you seek has vanished into the void. It may have been moved,
        removed, or never existed in this realm.
      </p>

      {/* Smart navigation link */}
      <Link
        href={isAuthenticated ? "/dashboard" : "/"}
        className="mt-8 inline-flex items-center gap-2 rounded-md border border-[var(--accent)] px-6 py-2.5 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--bg)]"
      >
        {isAuthenticated ? "Return to Dashboard" : "Return to Home"}
      </Link>

      {/* Decorative bottom accent */}
      <div className="mt-8 h-px w-24 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />
    </main>
  );
}
