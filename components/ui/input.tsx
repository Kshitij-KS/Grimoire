import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-2xl border border-border bg-[rgba(17,21,33,0.84)] px-4 py-2 text-sm text-foreground outline-none transition-all placeholder:text-secondary focus:border-[rgba(165,148,255,0.5)] focus:ring-2 focus:ring-[rgba(165,148,255,0.14)]",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
