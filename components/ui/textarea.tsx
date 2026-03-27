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
        "flex min-h-[120px] w-full rounded-[24px] border border-border bg-[rgba(17,21,33,0.84)] px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-secondary focus:border-[rgba(165,148,255,0.5)] focus:ring-2 focus:ring-[rgba(165,148,255,0.14)]",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
