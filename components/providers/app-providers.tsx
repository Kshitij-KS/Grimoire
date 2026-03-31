"use client";

import { Toaster } from "sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        gap={8}
        toastOptions={{
          duration: 4000,
          style: {
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text-main)",
            borderRadius: "8px",
            fontSize: "0.875rem",
            padding: "12px 16px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          },
          classNames: {
            title:       "!font-medium",
            description: "!text-[var(--text-muted)]",
            success:     "!border-l-4 !border-l-[var(--success)]",
            error:       "!border-l-4 !border-l-[var(--danger)]",
            info:        "!border-l-4 !border-l-[var(--ai-pulse)]",
            warning:     "!border-l-4 !border-l-[var(--accent)]",
          },
        }}
      />
    </>
  );
}
