import { motion } from "framer-motion";
import { MapPin, Shield, Sparkles, ScrollText, UserRound, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Entity, EntityType } from "@/lib/types";

const iconMap: Record<EntityType, React.ComponentType<{ className?: string }>> = {
  character: UserRound,
  location: MapPin,
  faction: Shield,
  artifact: WandSparkles,
  event: Sparkles,
  rule: ScrollText,
};

// Type-specific accent colors using CSS variables
const typeColorVar: Record<EntityType, string> = {
  character: "var(--accent)",
  location: "var(--ai-pulse)",
  faction: "var(--danger)",
  artifact: "var(--ai-pulse-soft)",
  event: "var(--success)",
  rule: "var(--text-muted)",
};

export function EntityCard({
  entity,
  onClick,
}: {
  entity: Entity;
  onClick: () => void;
}) {
  const Icon = iconMap[entity.type];
  const colorVar = typeColorVar[entity.type] ?? "var(--accent)";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="w-full text-left"
      whileHover={{
        y: -3,
        boxShadow: `0 12px 32px color-mix(in srgb, ${colorVar} 22%, transparent), 0 0 0 1px color-mix(in srgb, ${colorVar} 12%, transparent)`,
      }}
      transition={{ type: "spring", stiffness: 340, damping: 24 }}
    >
      <Card className="h-full rounded-[28px] p-5 transition-colors duration-200">
        <span style={{ color: colorVar }}>
          <Icon className="mb-4 h-5 w-5" />
        </span>
        <h3 className="font-heading text-3xl" style={{ color: colorVar }}>
          {entity.name}
        </h3>
        <p className="mt-3 text-sm leading-7 text-secondary">{entity.summary}</p>
        <div className="mt-4">
          <Badge variant="muted">Mentioned {entity.mention_count ?? 1} times</Badge>
        </div>
      </Card>
    </motion.button>
  );
}
