import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-4 py-2 text-sm text-[var(--text-main)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--border-focus)_20%,transparent)]",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
