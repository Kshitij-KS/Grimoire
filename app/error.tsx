"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [hasAttemptedReset, setHasAttemptedReset] = useState(false);

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const handleRetry = () => {
    if (!hasAttemptedReset) {
      setHasAttemptedReset(true);
      reset();
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Decorative element */}
        <div
          className="text-5xl mb-6 opacity-60"
          aria-hidden="true"
        >
          ⚗
        </div>

        <h1
          className="text-2xl font-semibold mb-3"
          style={{
            fontFamily: "var(--font-crimson), Georgia, serif",
            color: "var(--accent)",
          }}
        >
          A Disturbance in the Weave
        </h1>

        <p
          className="text-base leading-relaxed mb-6"
          style={{ color: "var(--text-muted)" }}
        >
          An unexpected error occurred while rendering this section. Our scribes
          have been alerted to the anomaly.
        </p>

        {error.message && (
          <p
            className="text-sm mb-6 px-4 py-3 rounded-lg break-words"
            style={{
              color: "var(--text-muted)",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            {error.message}
          </p>
        )}

        <div className="flex gap-3 justify-center flex-wrap">
          {!hasAttemptedReset ? (
            <button
              onClick={handleRetry}
              className="px-6 py-3 text-sm font-medium rounded-lg cursor-pointer transition-opacity hover:opacity-90"
              style={{
                backgroundColor: "var(--accent)",
                color: "#0A0A0B",
                border: "none",
              }}
            >
              Try Again
            </button>
          ) : null}

          <Link
            href="/dashboard"
            className="px-6 py-3 text-sm font-medium rounded-lg no-underline transition-colors"
            style={{
              color: "var(--text-main)",
              border: "1px solid var(--border)",
              backgroundColor: "transparent",
            }}
          >
            Return to Dashboard
          </Link>
        </div>

        {hasAttemptedReset && (
          <p
            className="mt-4 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            The error persisted after retrying. Please return to the dashboard.
          </p>
        )}
      </div>
    </div>
  );
}
