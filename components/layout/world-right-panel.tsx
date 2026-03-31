"use client";

import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRelativeTime, initialsFromName } from "@/lib/utils";
import type { ConsistencyFlag, Entity, Soul, WorldStats } from "@/lib/types";

const SEVERITY_COLORS: Record<string, string> = {
  high: "text-[var(--danger)] border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]",
  medium: "text-[var(--accent)] border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]",
  low: "text-[var(--ai-pulse-soft)] border-[color-mix(in_srgb,var(--ai-pulse)_30%,transparent)] bg-[color-mix(in_srgb,var(--ai-pulse)_8%,transparent)]",
};

export function WorldRightPanel({
  entities,
  flags,
  souls,
  stats,
  worldId,
}: {
  entities: Entity[];
  flags: ConsistencyFlag[];
  souls: Soul[];
  stats: WorldStats;
  worldId: string;
}) {
  const visibleEntities = entities.slice(0, 8);
  const extraEntities = entities.length - visibleEntities.length;
  const activeFlags = flags.filter((f) => !f.resolved);
  const visibleFlags = activeFlags.slice(0, 4);
  const extraFlags = activeFlags.length - visibleFlags.length;

  return (
    <aside className="glass-panel hidden w-[280px] shrink-0 rounded-[28px] p-5 lg:block">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.25em] text-secondary">World Pulse</p>
        <h2 className="font-heading text-3xl text-foreground">Live memory</h2>
      </div>

      <ScrollArea className="h-[calc(100vh-160px)] pr-3">
        <div className="space-y-5">
          {/* Entities */}
          <Card className="rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Known entities</p>
            {entities.length === 0 ? (
              <p className="mt-3 text-xs italic text-secondary">No entities detected yet. Add lore to populate the archive.</p>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {visibleEntities.map((entity) => (
                    <Badge
                      key={entity.id}
                      className="cursor-default transition-colors hover:bg-[rgba(212,168,83,0.1)] hover:text-[rgb(212,168,83)]"
                    >
                      {entity.name}
                    </Badge>
                  ))}
                </div>
                {extraEntities > 0 ? (
                  <p className="mt-3 text-xs text-secondary">and {extraEntities} more in the archive</p>
                ) : null}
              </>
            )}
          </Card>

          {/* Flags */}
          <Card className="rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Open tensions</p>
            {activeFlags.length === 0 ? (
              <p className="mt-3 text-xs italic text-secondary">No contradictions flagged. The world holds.</p>
            ) : (
              <>
                <div className="mt-4 space-y-3">
                  {visibleFlags.map((flag) => {
                    const colorClass = SEVERITY_COLORS[flag.severity] ?? SEVERITY_COLORS.low;
                    return (
                      <div
                        key={flag.id}
                        className={`rounded-2xl border p-3 ${colorClass}`}
                      >
                        <p className="text-xs uppercase tracking-[0.2em]">{flag.severity}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-secondary">{flag.flagged_text}</p>
                      </div>
                    );
                  })}
                </div>
                {extraFlags > 0 ? (
                  <p className="mt-3 text-xs text-secondary">and {extraFlags} more tensions</p>
                ) : null}
              </>
            )}
          </Card>

          {/* Souls */}
          <Card className="rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Bound souls</p>
            {souls.length === 0 ? (
              <p className="mt-3 text-xs italic text-secondary">No souls bound yet. Forge a character to begin.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {souls.map((soul) => (
                  <Link
                    key={soul.id}
                    href={`/worlds/${worldId}/souls/${soul.id}/chat`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-[rgba(13,11,8,0.4)] p-3 transition hover:border-[rgba(212,168,83,0.25)]"
                  >
                    <Avatar
                      className="h-8 w-8 border border-border"
                      style={{ boxShadow: `0 0 14px ${soul.avatar_color}44` }}
                    >
                      <AvatarFallback
                        style={{ background: `${soul.avatar_color}22`, color: soul.avatar_color, fontSize: "11px" }}
                      >
                        {soul.avatar_initials ?? initialsFromName(soul.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-heading text-lg text-foreground">{soul.name}</p>
                      <p className="text-xs text-secondary" suppressHydrationWarning>{formatRelativeTime(soul.updated_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Word count */}
          <Card className="rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-secondary">Words in the archive</p>
            <p className="mt-3 font-heading text-4xl text-[rgb(212,168,83)]">
              {stats.totalWords.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-secondary">across all lore entries</p>
          </Card>
        </div>
      </ScrollArea>
    </aside>
  );
}
