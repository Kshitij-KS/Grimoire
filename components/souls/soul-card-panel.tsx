"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Edit2, Eye, EyeOff, RefreshCw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
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
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(soul.description);
  const [voiceDraft, setVoiceDraft] = useState(soul.soul_card?.voice ?? "");
  const [coreDraft, setCoreDraft] = useState(soul.soul_card?.core ?? "");

  useEffect(() => {
    setDescriptionDraft(soul.description);
    setVoiceDraft(soul.soul_card?.voice ?? "");
    setCoreDraft(soul.soul_card?.core ?? "");
    setIsEditing(false);
  }, [soul]);

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

  const saveOverrides = async () => {
    if (!voiceDraft.trim() || !coreDraft.trim() || descriptionDraft.trim().length < 10) {
      toast.error("Description, voice, and core notes all need meaningful text.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/souls/${soul.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: descriptionDraft,
          voice: voiceDraft,
          core: coreDraft,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to save overrides.");
      toast.success("Soul guidance updated.");
      setIsEditing(false);
      onRegenerated?.(payload.soul ?? soul);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save overrides.");
    } finally {
      setSaving(false);
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
        <div className="flex items-center gap-1">
          {!isEditing ? (
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} title="Edit voice and core">
              <Edit2 className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={saveOverrides} disabled={saving} title="Save overrides">
              <Save className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
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
              {isEditing ? (
                <Card className="rounded-[24px] border border-border bg-[rgba(255,255,255,0.02)] p-4">
                  <p className="chapter-label">Manual Overrides</p>
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-[0.22em] text-secondary">Character Description</label>
                      <Textarea value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} className="min-h-[120px]" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-[0.22em] text-secondary">Voice</label>
                      <Textarea value={voiceDraft} onChange={(event) => setVoiceDraft(event.target.value)} className="min-h-[110px]" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-[0.22em] text-secondary">Core</label>
                      <Textarea value={coreDraft} onChange={(event) => setCoreDraft(event.target.value)} className="min-h-[110px]" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                      <Button onClick={saveOverrides} disabled={saving}>
                        {saving ? "Saving..." : "Save overrides"}
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : null}

              <SoulSection title="Voice" color="gold">
                <p className="text-sm leading-7 text-secondary">{card.voice}</p>
              </SoulSection>

              <SoulSection title="Core" color="purple">
                <p className="text-sm leading-7 text-secondary">{card.core}</p>
              </SoulSection>

              <SoulSection title="Source Description" color="muted">
                <p className="text-sm leading-7 text-secondary">{soul.description}</p>
              </SoulSection>

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

              {card.relationships && card.relationships.length > 0 && (
                <SoulSection title="Relationships" color="purple">
                  <div className="space-y-2">
                    {card.relationships.map((rel, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-[14px] border border-border bg-[rgba(28,22,14,0.6)] px-3 py-2">
                        <span className="font-heading text-base text-[rgb(157,127,224)]">{rel.name}</span>
                        <span className="text-secondary">-</span>
                        <span className="text-sm text-secondary">{rel.attitude}</span>
                      </div>
                    ))}
                  </div>
                </SoulSection>
              )}

              {card.secrets && card.secrets.length > 0 && (
                <SoulSection title="Secrets" color="gold">
                  <div className="space-y-2">
                    {card.secrets.map((secret, i) => {
                      const visible = revealedSecrets.has(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleSecret(i)}
                          className="flex w-full items-start justify-between rounded-[14px] border border-border bg-[rgba(28,22,14,0.6)] px-3 py-2 text-left"
                        >
                          <span className="pr-3 text-sm leading-7 text-secondary">
                            {visible ? secret : "Hidden until willingly revealed."}
                          </span>
                          {visible ? <EyeOff className="mt-1 h-4 w-4 text-secondary" /> : <Eye className="mt-1 h-4 w-4 text-secondary" />}
                        </button>
                      );
                    })}
                  </div>
                </SoulSection>
              )}

              {card.sample_lines && card.sample_lines.length > 0 && (
                <SoulSection title="Sample Lines" color="purple">
                  <div className="space-y-3">
                    {card.sample_lines.map((line, i) => (
                      <blockquote key={i} className="rounded-[14px] border border-border bg-[rgba(28,22,14,0.6)] px-4 py-3 font-heading text-lg italic text-[rgb(240,230,214)]">
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

      <div className="border-t border-border p-5">
        <div className="flex gap-2">
          <Button onClick={regenerate} disabled={regenerating} className="flex-1">
            <RefreshCw className={`mr-2 h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
            {regenerating ? "Reforging..." : "Reforge Soul Card"}
          </Button>
        </div>
        <p className="mt-3 text-xs leading-6 text-secondary">
          Manual overrides change the soul&apos;s voice and core guidance without discarding the rest of the generated card.
        </p>
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
  color: "gold" | "purple" | "muted";
  children: React.ReactNode;
}) {
  const accentClass =
    color === "gold"
      ? "text-[rgb(212,168,83)]"
      : color === "purple"
        ? "text-[rgb(157,127,224)]"
        : "text-[rgb(139,133,160)]";

  return (
    <Card className="rounded-[24px] border border-border bg-[rgba(255,255,255,0.02)] p-4">
      <p className={`text-xs uppercase tracking-[0.24em] ${accentClass}`}>{title}</p>
      <div className="mt-3">{children}</div>
    </Card>
  );
}
