import { cn } from "@/lib/utils";

type ShimmerVariant = "line" | "card" | "circle" | "panel";

interface LoadingShimmerProps {
  className?: string;
  variant?: ShimmerVariant;
}

const VARIANT_CLASSES: Record<ShimmerVariant, string> = {
  line: "h-4 rounded-lg",
  card: "h-24 rounded-[20px]",
  circle: "h-10 w-10 rounded-full",
  panel: "h-40 rounded-[24px]",
};

export function LoadingShimmer({ className, variant = "line" }: LoadingShimmerProps) {
  return (
    <div
      className={cn(
        "bg-[rgba(212,168,83,0.04)]",
        "shimmer",
        VARIANT_CLASSES[variant],
        className
      )}
      style={{
        background: "linear-gradient(90deg, rgba(212,168,83,0.03) 0%, rgba(212,168,83,0.09) 40%, rgba(180,120,50,0.07) 60%, rgba(212,168,83,0.03) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmerWarm 2.1s linear infinite",
      }}
    />
  );
}
