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
            background: "rgba(21,26,41,0.96)",
            border: "1px solid rgba(118,129,173,0.22)",
            color: "#e6e9f5",
            borderRadius: "16px",
            fontSize: "0.875rem",
            padding: "12px 16px",
            boxShadow: "0 18px 44px rgba(4,6,12,0.5), 0 0 0 1px rgba(165,148,255,0.08)",
          },
          classNames: {
            title: "!font-medium !text-[rgb(230,233,245)]",
            description: "!text-[rgb(160,168,195)]",
            success: "!border-l-4 !border-l-[#5cb491]",
            error: "!border-l-4 !border-l-[#d25a5a]",
            info: "!border-l-4 !border-l-[#7e6df2]",
            warning: "!border-l-4 !border-l-[#c4a86a]",
          },
        }}
      />
    </>
  );
}
