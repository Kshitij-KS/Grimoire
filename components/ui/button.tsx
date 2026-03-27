"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(165,148,255,0.35)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,rgba(126,109,242,0.96),rgba(165,148,255,0.86))] text-white shadow-card hover:brightness-110",
        secondary:
          "glass-panel text-foreground hover:border-[rgba(165,148,255,0.22)] hover:bg-[rgba(255,255,255,0.03)]",
        ghost:
          "bg-transparent text-secondary hover:bg-[rgba(255,255,255,0.04)] hover:text-foreground",
        gold: "bg-[linear-gradient(135deg,rgba(196,168,106,0.94),rgba(220,195,142,0.86))] text-[#20170b] hover:brightness-105",
        danger:
          "bg-[rgba(210,90,90,0.14)] text-[rgb(255,214,214)] hover:bg-[rgba(210,90,90,0.2)]",
        outline:
          "border border-border bg-transparent text-foreground hover:border-[rgba(165,148,255,0.22)] hover:bg-[rgba(255,255,255,0.03)]",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-xl px-3",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 rounded-xl",
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
