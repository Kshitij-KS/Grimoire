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

// Type-specific accent colors
const typeGlow: Record<EntityType, string> = {
  character: "rgba(212,168,83,",
  location: "rgba(124,92,191,",
  faction: "rgba(192,74,74,",
  artifact: "rgba(157,127,224,",
  event: "rgba(92,180,145,",
  rule: "rgba(160,168,195,",
};

const typeColor: Record<EntityType, string> = {
  character: "rgb(212,168,83)",
  location: "rgb(157,127,224)",
  faction: "rgb(210,90,90)",
  artifact: "rgb(196,168,255)",
  event: "rgb(92,180,145)",
  rule: "rgb(160,168,195)",
};

export function EntityCard({
  entity,
  onClick,
}: {
  entity: Entity;
  onClick: () => void;
}) {
  const Icon = iconMap[entity.type];
  const glow = typeGlow[entity.type] ?? "rgba(212,168,83,";
  const color = typeColor[entity.type] ?? "rgb(212,168,83)";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="w-full text-left"
      whileHover={{
        y: -3,
        boxShadow: `0 12px 32px ${glow}0.22), 0 0 0 1px ${glow}0.12)`,
      }}
      transition={{ type: "spring", stiffness: 340, damping: 24 }}
    >
      <Card className="h-full rounded-[28px] p-5 transition-colors duration-200">
        <span style={{ color }}>
          <Icon className="mb-4 h-5 w-5" />
        </span>
        <h3 className="font-heading text-3xl" style={{ color }}>
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
