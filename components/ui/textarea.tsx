import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[120px] w-full rounded-[24px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-4 py-3 text-sm text-[var(--text-main)] outline-none transition-all placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--border-focus)_20%,transparent)]",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
