import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-border bg-[rgba(126,109,242,0.1)] text-foreground",
        outline: "border-[rgba(196,205,242,0.18)] bg-[rgba(255,255,255,0.02)] text-secondary",
        gold: "border-[rgba(196,168,106,0.28)] bg-[rgba(196,168,106,0.12)] text-[rgb(236,221,182)]",
        success: "border-[rgba(92,180,145,0.28)] bg-[rgba(92,180,145,0.12)] text-[rgb(201,248,228)]",
        danger: "border-[rgba(210,90,90,0.28)] bg-[rgba(210,90,90,0.12)] text-[rgb(255,214,214)]",
        muted: "border-border bg-[rgba(255,255,255,0.03)] text-secondary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
