"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base: precise transition over named properties only — never `transition-all`
  // Active scale: the single most impactful micro-interaction (Emil principle #1)
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium font-sans tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] active:transition-none transition-[transform,opacity,background-color,border-color,box-shadow] duration-150 ease-out select-none",
  {
    variants: {
      variant: {
        // Primary: rich solid surface — feels weighty and intentional
        default:
          "bg-[var(--text-main)] text-[var(--bg)] hover:opacity-88 shadow-[0_1px_3px_rgba(0,0,0,0.15)] dark:shadow-[0_1px_6px_rgba(0,0,0,0.4)]",
        // Secondary: clean bordered surface with backdrop blur
        secondary:
          "glass-panel text-[var(--text-main)] border border-[var(--border)] hover:border-[var(--border-focus)] hover:bg-[color-mix(in_srgb,var(--surface-raised)_80%,transparent)]",
        // Ghost: weightless — only shows presence on hover
        ghost:
          "bg-transparent text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] hover:text-[var(--text-main)]",
        // Gold / Accent: accent-colored, warm press
        gold:
          "bg-[var(--accent)] text-[var(--bg)] hover:opacity-88 shadow-[0_1px_4px_color-mix(in_srgb,var(--accent)_30%,transparent)]",
        accent:
          "bg-[var(--accent)] text-[var(--bg)] hover:opacity-88 shadow-[0_1px_4px_color-mix(in_srgb,var(--accent)_30%,transparent)]",
        // Danger: deliberately restrained — warning, not alarm
        danger:
          "bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)] border border-[color-mix(in_srgb,var(--danger)_22%,transparent)] hover:bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] hover:border-[color-mix(in_srgb,var(--danger)_40%,transparent)]",
        // Outline: border only, surface on hover
        outline:
          "border border-[var(--border)] bg-transparent text-[var(--text-main)] hover:border-[var(--border-focus)] hover:bg-[var(--surface)]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm:      "h-8 rounded-md px-3 text-xs",
        lg:      "h-12 px-7 text-base",
        icon:    "h-9 w-9 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
