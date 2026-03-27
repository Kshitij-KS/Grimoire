"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { initialsFromName } from "@/lib/utils";
import type { Soul } from "@/lib/types";

interface SoulCardPanelProps {
  soul: Soul;
  worldId: string;
  onClose: () => void;
  onRegenerated?: (updated: Soul) => void;
}

export function SoulCardPanel({ soul, worldId, onClose, onRegenerated }: SoulCardPanelProps) {
  const [revealedSecrets, setRevealedSecrets] = useState<Set<number>>(new Set());
  const [regenerating, setRegenerating] = useState(false);

  const toggleSecret = (index: number) => {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const regenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      const response = await fetch("/api/souls/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worldId,
          name: soul.name,
          avatarColor: soul.avatar_color,
          description: soul.description,
          soulId: soul.id,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Regeneration failed.");
      toast.success("Soul card reforged.");
      onRegenerated?.(payload.soul ?? { ...soul, soul_card: payload.soul_card });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Regeneration failed.");
    } finally {
      setRegenerating(false);
    }
  };

  const card = soul.soul_card;

  return (
    <motion.div
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 60, opacity: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 32 }}
      className="glass-panel-elevated fixed inset-y-4 right-4 z-40 flex w-[min(92vw,460px)] flex-col rounded-[30px] shadow-arcane"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border p-5 pb-4">
        <div className="flex items-center gap-4">
          <Avatar
            className="h-14 w-14 border-2 shrink-0"
            style={{ borderColor: soul.avatar_color, boxShadow: `0 0 24px ${soul.avatar_color}44` }}
          >
            <AvatarFallback style={{ background: `${soul.avatar_color}22`, color: soul.avatar_color }}>
              {soul.avatar_initials ?? initialsFromName(soul.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-secondary">Soul Card</p>
            <h3 className="font-heading text-4xl text-foreground">{soul.name}</h3>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="space-y-3 p-5">
          {!card ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="shimmer h-20 rounded-[18px] bg-[rgba(28,22,14,0.5)]" />
              ))}
            </div>
          ) : (
            <>
              {/* Voice */}
              <SoulSection title="Voice" color="gold">
                <p className="text-sm leading-7 text-secondary">{card.voice}</p>
              </SoulSection>

              {/* Core */}
              <SoulSection title="Core" color="purple">
                <p className="text-sm leading-7 text-secondary">{card.core}</p>
              </SoulSection>

              {/* Knows */}
              {card.knows && card.knows.length > 0 && (
                <SoulSection title="Knows" color="gold">
                  <ul className="space-y-1.5">
                    {card.knows.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                        <span className="mt-1 shrink-0 text-[rgb(212,168,83)] text-[10px]">◆</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </SoulSection>
              )}

              {/* Doesn't Know */}
              {card.doesnt_know && card.doesnt_know.length > 0 && (
                <SoulSection title="Doesn't Know" color="muted">
                  <ul className="space-y-1.5">
                    {card.doesnt_know.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(139,133,160)]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </SoulSection>
              )}

              {/* Relationships */}
              {card.relationships && card.relationships.length > 0 && (
                <SoulSection title="Relationships" color="purple">
                  <div className="space-y-2">
                    {card.relationships.map((rel, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-[14px] border border-border bg-[rgba(28,22,14,0.6)] px-3 py-2">
                        <span className="font-heading text-base text-[rgb(157,127,224)]">{rel.name}</span>
                        <span className="text-secondary">—</span>
                        <span className="text-sm text-secondary">{rel.attitude}</span>
                      </div>
                    ))}
                  </div>
                </SoulSection>
              )}

              {/* Secrets */}
              {card.secrets && card.secrets.length > 0 && (
                <SoulSection title="Secrets" color="danger">
                  <div className="space-y-2">
                    {card.secrets.map((secret, i) => (
                      <div
                        key={i}
                        className="group relative flex items-start justify-between gap-3 rounded-[14px] border border-[rgba(192,74,74,0.22)] bg-[rgba(192,74,74,0.07)] px-3 py-2"
                      >
                        <p
                          className="text-sm leading-6 text-secondary transition-all duration-300"
                          style={{ filter: revealedSecrets.has(i) ? "none" : "blur(5px)", userSelect: revealedSecrets.has(i) ? "auto" : "none" }}
                        >
                          {secret}
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleSecret(i)}
                          className="shrink-0 text-[rgb(192,74,74)] opacity-60 transition hover:opacity-100"
                          title={revealedSecrets.has(i) ? "Hide" : "Reveal"}
                        >
                          {revealedSecrets.has(i) ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </SoulSection>
              )}

              {/* Sample Lines */}
              {card.sample_lines && card.sample_lines.length > 0 && (
                <SoulSection title="Sample Lines" color="gold">
                  <div className="space-y-4">
                    {card.sample_lines.map((line, i) => (
                      <blockquote
                        key={i}
                        className="border-l-[3px] border-[rgba(212,168,83,0.5)] pl-4 font-heading text-xl italic text-[rgb(240,224,192)]"
                      >
                        &ldquo;{line}&rdquo;
                      </blockquote>
                    ))}
                  </div>
                </SoulSection>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <Button
          variant="secondary"
          className="w-full gap-2"
          onClick={regenerate}
          disabled={regenerating}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Reforging soul card..." : "Reforge Soul Card"}
        </Button>
        <p className="mt-2 text-center text-xs text-secondary">Counts against your daily soul generation limit</p>
      </div>
    </motion.div>
  );
}

function SoulSection({
  title,
  color,
  children,
}: {
  title: string;
  color: "gold" | "purple" | "muted" | "danger";
  children: React.ReactNode;
}) {
  const colorMap = {
    gold: "text-[rgb(212,168,83)]",
    purple: "text-[rgb(157,127,224)]",
    muted: "text-secondary",
    danger: "text-[rgb(192,74,74)]",
  };

  return (
    <Card className="rounded-[20px] p-4">
      <div className={`mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] ${colorMap[color]}`}>
        <span className="h-px flex-1 bg-current opacity-20" />
        {title}
        <span className="h-px flex-1 bg-current opacity-20" />
      </div>
      {children}
    </Card>
  );
}
