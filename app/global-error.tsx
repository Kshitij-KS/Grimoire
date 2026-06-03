"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0A0A0B",
          color: "#F4F4F5",
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: "480px",
            padding: "2rem",
          }}
        >
          {/* Decorative rune icon */}
          <div
            style={{
              fontSize: "3rem",
              marginBottom: "1.5rem",
              opacity: 0.7,
            }}
            aria-hidden="true"
          >
            ✦
          </div>

          <h1
            style={{
              fontFamily: '"Crimson Pro", Georgia, serif',
              fontSize: "2rem",
              fontWeight: 600,
              color: "#E5A85A",
              marginBottom: "0.75rem",
              letterSpacing: "-0.01em",
            }}
          >
            Something Went Wrong
          </h1>

          <p
            style={{
              fontSize: "1rem",
              lineHeight: 1.6,
              color: "#A1A1AA",
              marginBottom: "2rem",
            }}
          >
            An unexpected error has disrupted the arcane weave. Our scribes have
            been notified and are investigating the disturbance.
          </p>

          {error.message && (
            <p
              style={{
                fontSize: "0.875rem",
                color: "#52525B",
                marginBottom: "2rem",
                padding: "0.75rem 1rem",
                backgroundColor: "#121214",
                borderRadius: "0.5rem",
                border: "1px solid #27272A",
                wordBreak: "break-word",
              }}
            >
              {error.message}
            </p>
          )}

          <div
            style={{
              display: "flex",
              gap: "1rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => reset()}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#0A0A0B",
                backgroundColor: "#E5A85A",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                transition: "opacity 150ms ease",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.opacity = "1";
              }}
            >
              Try Again
            </button>

            <Link
              href="/dashboard"
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#F4F4F5",
                backgroundColor: "transparent",
                border: "1px solid #27272A",
                borderRadius: "0.5rem",
                textDecoration: "none",
                transition: "border-color 150ms ease",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLAnchorElement).style.borderColor = "#52525B";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLAnchorElement).style.borderColor = "#27272A";
              }}
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
