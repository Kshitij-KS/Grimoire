"use client";

import { useState, useEffect, useRef } from "react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Crown, Lock, Pencil, Send, Users, Plus, BookMarked, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RateLimitWarning } from "@/components/shared/rate-limit-warning";
import { WaitlistDialog } from "@/components/shared/waitlist-dialog";
import { FREE_TIER_LIMITS } from "@/lib/constants";
import { trackCoreAction } from "@/lib/analytics";
import { useWorkspaceStore } from "@/lib/store";
import { useRateLimitStatus } from "@/lib/hooks/use-rate-limit-status";
import type { PlanTier, Soul, TavernMessage } from "@/lib/types";

interface TavernChatProps {
  worldId: string;
  souls: Soul[];
  plan?: PlanTier;
}

interface SessionState {
  id: string;
  name: string;
  soulIds: string[];
  canonized: boolean;
  canonizedLoreEntryId?: string | null;
}

export function TavernChat({ worldId, souls, plan = "free" }: TavernChatProps) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [messages, setMessages] = useState<TavernMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [canonizing, setCanonizing] = useState(false);
  const [selectedSouls, setSelectedSouls] = useState<string[]>([]);
  const [premise, setPremise] = useState("");
  const [directedTo, setDirectedTo] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Rate limit state for tavern sessions
  const { isLimitExhausted, isActionNearLimit } = useRateLimitStatus();
  const rateLimits = useWorkspaceStore((s) => s.rateLimits);
  const showLimitModal = useWorkspaceStore((s) => s.showLimitModal);
  const tavernEntry = rateLimits["tavern_message"];
  const tavernExhausted = isLimitExhausted("tavern_message");
  const tavernNearLimit = isActionNearLimit("tavern_message");

  const isFree = plan === "free";
  const soulLimit = isFree ? FREE_TIER_LIMITS.tavernSouls : FREE_TIER_LIMITS.tavernSoulsPro;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const createSession = async () => {
    if (selectedSouls.length < 2) return;
    try {
      const res = await fetch("/api/tavern", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          worldId,
          soulIds: selectedSouls,
          name: "The Tavern",
          premise: premise.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.error === "TAVERN_SOUL_LIMIT") {
        toast.error(data.detail ?? "Soul limit reached.", {
          action: {
            label: "Join waitlist",
            onClick: () => setWaitlistOpen(true),
          },
        });
        return;
      }
      if (data.session) {
        setSession({
          id: data.session.id,
          name: data.session.name,
          soulIds: data.session.soul_ids,
          canonized: data.session.canonized ?? false,
          canonizedLoreEntryId: data.session.canonized_lore_entry_id ?? null,
        });
        setSessionName(data.session.name ?? "The Tavern");
        trackCoreAction("tavern_session_created", worldId);
      }
    } catch (e) {
      console.error("Failed to create tavern session:", e);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !session || sending) return;
    const msg = input.trim();
    setInput("");
    setSending(true);

    // Optimistic user message
    const optimisticMsg: TavernMessage = {
      id: `temp-${Date.now()}`,
      session_id: session.id,
      soul_id: null,
      role: "director",
      directed_to: directedTo,
      content: msg,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch("/api/tavern", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worldId,
          sessionId: session.id,
          message: msg,
          directedToSoulId: directedTo,
        }),
      });
      if (res.status === 429) {
        showLimitModal("tavern_message", tavernEntry?.limit);
        toast.error("Daily tavern message limit reached.");
        return;
      }
      const data = await res.json();
      if (data.messages) {
        const soulMessages: TavernMessage[] = data.messages.map(
          (m: TavernMessage & { soulName?: string; avatarColor?: string }) => ({
            ...m,
            role: "soul" as const,
          }),
        );
        setMessages((prev) => [...prev, ...soulMessages]);
      }
    } catch (e) {
      console.error("Tavern send failed:", e);
    } finally {
      setSending(false);
      setDirectedTo(null);
    }
  };

  const handleCanonize = async () => {
    if (!session || canonizing || session.canonized) return;
    setCanonizing(true);
    try {
      const res = await fetch("/api/tavern/canonize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId, sessionId: session.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.detail ?? data.error ?? "Failed to inscribe to canon.";
        toast.error(msg);
        return;
      }
      setSession((prev) => prev ? { ...prev, canonized: true, canonizedLoreEntryId: data.loreEntryId } : prev);
      toast.success(`Scene inscribed as "${data.loreTitle}". The oracle remembers.`, { duration: 4000 });
    } catch {
      toast.error("The ritual failed. Try again.");
    } finally {
      setCanonizing(false);
    }
  };

  const saveSessionName = async () => {
    setEditingName(false);
    if (!session || !sessionName.trim()) return;
    try {
      await fetch("/api/tavern", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, name: sessionName.trim() }),
      });
    } catch {
      // non-critical, name update can fail silently
    }
  };

  const exportScene = () => {
    if (messages.length === 0) return;
    const lines = messages.map((msg) => {
      if (msg.role === "director") return `[Director]: ${msg.content}`;
      const soul = souls.find((s) => s.id === msg.soul_id);
      return `${soul?.name ?? "Soul"}: ${msg.content}`;
    });
    const text = `# ${sessionName || "The Tavern"}\n\n` + lines.join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Scene copied to clipboard.");
    }).catch(() => {
      toast.error("Could not copy scene.");
    });
  };

  const activeSouls = souls.filter((s) =>
    session ? session.soulIds.includes(s.id) : selectedSouls.includes(s.id),
  );

  // ── Session Creation View ──
  if (!session) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <div className="mb-6 text-center">
          <h2 className="font-heading text-3xl text-foreground">The Scene Forge</h2>
          <p className="mt-1 text-sm text-secondary">
            Gather your souls together. Watch them speak, argue, and reveal.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-6 space-y-5">
          <p className="chapter-label">— Select 2–{soulLimit} Souls —</p>

          <div className="grid gap-3 sm:grid-cols-2">
            {souls.map((soul) => {
              const isSelected = selectedSouls.includes(soul.id);
              const isAtLimit = !isSelected && selectedSouls.length >= soulLimit;
              return (
                <motion.button
                  key={soul.id}
                  whileTap={isAtLimit ? undefined : { scale: 0.97 }}
                  onClick={() => {
                    if (isAtLimit) return;
                    if (isSelected) {
                      setSelectedSouls((prev) => prev.filter((id) => id !== soul.id));
                    } else {
                      setSelectedSouls((prev) => [...prev, soul.id]);
                    }
                  }}
                  disabled={isAtLimit}
                  className={`flex items-center gap-3 rounded-[18px] border p-4 text-left transition-all ${
                    isAtLimit
                      ? "cursor-not-allowed opacity-40 border-border bg-[rgba(255,255,255,0.02)]"
                      : isSelected
                      ? "border-border bg-[rgba(255,255,255,0.02)]"
                      : "border-border bg-[rgba(255,255,255,0.02)] hover:border-[rgba(90,72,52,0.45)]"
                  }`}
                  style={isSelected ? { borderColor: soul.avatar_color, background: soul.avatar_color ? `${soul.avatar_color}1a` : "color-mix(in srgb, var(--ai-pulse) 10%, transparent)" } : {}}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-[var(--text-main)]"
                    style={{ background: soul.avatar_color }}
                  >
                    {soul.avatar_initials ?? soul.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {soul.name}
                    </p>
                    <p className="text-xs text-secondary truncate">
                      {soul.description?.slice(0, 50) ?? "No description"}
                    </p>
                  </div>
                  {isSelected && (
                    <div
                      className="ml-auto flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ background: soul.avatar_color }}
                    >
                      <span className="text-[10px] text-[var(--text-main)]">✓</span>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Upsell slot */}
          {isFree && souls.length >= FREE_TIER_LIMITS.tavernSouls && (
            <motion.button
              type="button"
              onClick={() => setWaitlistOpen(true)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex w-full items-center gap-3 rounded-[18px] border border-dashed border-[color-mix(in_srgb,var(--gold)_30%,transparent)] bg-[color-mix(in_srgb,var(--gold)_4%,transparent)] p-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--gold)_8%,transparent)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--gold)_15%,transparent)]">
                <Lock className="h-4 w-4 text-[var(--gold)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--gold)] truncate flex items-center gap-1.5">
                  4th Soul Slot
                  <span className="rounded-md bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] px-1.5 py-0.5 text-[9px] uppercase tracking-widest font-bold text-[var(--gold)]">Pro</span>
                </p>
                <p className="text-xs text-secondary truncate">
                  Upgrade to gather a 4th voice in the room.
                </p>
              </div>
              <Crown className="h-4 w-4 text-[var(--gold)] opacity-60 shrink-0" />
            </motion.button>
          )}

          {souls.length < 2 && (
            <p className="text-xs text-secondary text-center">
              You need at least 2 bound souls to use the Scene Forge.
            </p>
          )}

          <AnimatePresence>
            {selectedSouls.length === FREE_TIER_LIMITS.tavernSouls && (
              <motion.p
                key="parallel-note"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-[11px] text-center text-secondary overflow-hidden"
              >
                3 souls use isolated generation for voice clarity — responses may take a few extra seconds.
              </motion.p>
            )}
          </AnimatePresence>

          {/* Scene Premise */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)] font-bold">
              Scene Premise <span className="opacity-50 normal-case tracking-normal font-normal">(optional)</span>
            </label>
            <textarea
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              rows={2}
              maxLength={400}
              placeholder="e.g. The heroes have just returned from the dungeon. Tensions are high after a betrayal..."
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] px-4 py-3 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-focus)] transition-colors"
            />
            <p className="text-[10px] text-[var(--text-muted)] text-right opacity-60">
              {premise.length}/400 — this context guides soul responses and canon inscription.
            </p>
          </div>

          <Button
            className="w-full"
            onClick={createSession}
            disabled={selectedSouls.length < 2 || tavernExhausted}
            title={tavernExhausted ? "Tavern Sessions — daily limit reached. Resets at UTC midnight." : undefined}
          >
            <Plus className="mr-2 h-4 w-4" />
            Open the Scene ({selectedSouls.length}/{soulLimit} souls)
          </Button>
          {tavernEntry && tavernNearLimit && (
            <div className="mt-2 flex justify-center">
              <RateLimitWarning count={tavernEntry.count} limit={tavernEntry.limit} />
            </div>
          )}
        </div>
        <WaitlistDialog open={waitlistOpen} onOpenChange={setWaitlistOpen} source="tavern" />
      </div>
    );
  }

  // ── Chat View ──
  return (
    <div className="flex h-[calc(100vh-120px)] flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <Users className="h-4 w-4 text-[var(--ai-pulse-soft)]" />

        {/* Inline editable session name */}
        {editingName ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={nameInputRef}
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              onBlur={saveSessionName}
              onKeyDown={(e) => e.key === "Enter" && saveSessionName()}
              className="font-heading text-lg text-[var(--text-main)] bg-transparent outline-none border-b border-[var(--border-focus)]"
              autoFocus
            />
            <button onClick={saveSessionName} className="text-[var(--accent)]">
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="group flex items-center gap-1.5">
            <h3 className="font-heading text-lg text-[var(--text-main)]">{sessionName || "The Tavern"}</h3>
            <button
              onClick={() => { setEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 30); }}
              className="opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
            >
              <Pencil className="h-3 w-3 text-[var(--text-muted)]" />
            </button>
          </div>
        )}

        {/* Canonized badge */}
        {session.canonized && (
          <Badge variant="gold" className="ml-1 gap-1">
            <Sparkles className="h-2.5 w-2.5" />
            Canonized
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Scene export */}
          <button
            onClick={exportScene}
            disabled={messages.length === 0}
            title="Export scene to clipboard"
            className="flex items-center gap-1.5 rounded-[10px] border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--text-muted)] transition-colors hover:border-[var(--border-focus)] hover:text-[var(--text-main)] disabled:opacity-40"
          >
            <Copy className="h-3 w-3" />
            Export
          </button>
          {activeSouls.map((soul) => (
            <div
              key={soul.id}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-[var(--text-main)]"
              style={{ background: soul.avatar_color }}
              title={soul.name}
            >
              {soul.avatar_initials ?? soul.name[0]}
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const soul = souls.find((s) => s.id === msg.soul_id);
            const isDirector = msg.role === "director";

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex ${isDirector ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-[18px] px-4 py-3 ${
                    isDirector
                      ? "bg-[rgba(90,72,52,0.22)] border border-[rgba(90,72,52,0.38)]"
                      : "glass-panel"
                  }`}
                >
                  {!isDirector && soul && (
                    <div className="mb-1 flex items-center gap-2">
                      <div
                        className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-[var(--text-main)]"
                        style={{ background: soul.avatar_color }}
                      >
                        {soul.avatar_initials ?? soul.name[0]}
                      </div>
                      <span className="text-xs font-medium text-[var(--gold)]">
                        {soul.name}
                      </span>
                    </div>
                  )}
                  <p className="text-sm leading-6 text-foreground whitespace-pre-wrap">
                    {msg.content}
                  </p>
                  <p className="mt-1 text-[9px] text-dim" suppressHydrationWarning>
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {sending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-sm text-secondary"
          >
            <LoadingSpinner className="h-3 w-3 text-[var(--violet-soft)]" />
            <span>
              {activeSouls.length === 1
                ? `${activeSouls[0].name} considers…`
                : activeSouls.length === 2
                ? `${activeSouls[0].name} and ${activeSouls[1].name} deliberate…`
                : `${activeSouls.map((s) => s.name).join(", ")} each consider their words…`}
            </span>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Inscribe to Canon — shown after 5+ messages */}
      <AnimatePresence>
        {messages.length >= 5 && !session.canonized && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="shrink-0 border-t border-[color-mix(in_srgb,var(--accent)_15%,transparent)] bg-[color-mix(in_srgb,var(--accent)_4%,transparent)] px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--accent)]">This scene has lore worth remembering.</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Inscribe it to your world&apos;s canon — the Oracle will transform it into lore prose.</p>
              </div>
              <button
                onClick={handleCanonize}
                disabled={canonizing}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-4 py-2 text-xs font-medium text-[var(--accent)] transition-all hover:bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] active:scale-[0.97] active:transition-none disabled:opacity-50"
              >
                {canonizing ? (
                  <LoadingSpinner className="h-3 w-3" />
                ) : (
                  <BookMarked className="h-3.5 w-3.5" />
                )}
                {canonizing ? "Inscribing…" : "Inscribe to Canon"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Direction Selector */}
      <div className="flex items-center gap-2 border-t border-border px-4 py-2">
        <span className="text-[10px] text-secondary">Direct to:</span>
        <button
          onClick={() => setDirectedTo(null)}
          className={`rounded-lg px-2 py-1 text-[10px] transition-colors ${
            !directedTo
              ? "bg-[rgba(90,72,52,0.25)] text-foreground"
              : "text-secondary hover:text-foreground"
          }`}
        >
          Everyone
        </button>
        {activeSouls.map((soul) => (
          <button
            key={soul.id}
            onClick={() => setDirectedTo(soul.id)}
            className={`rounded-lg px-2 py-1 text-[10px] transition-colors ${
              directedTo === soul.id
                ? "bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--accent)]"
                : "text-secondary hover:text-foreground"
            }`}
          >
            {soul.name}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <input
            value={input}
            aria-label="Message input"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={
              directedTo
                ? `Speak to ${souls.find((s) => s.id === directedTo)?.name ?? "soul"}...`
                : "Address the scene..."
            }
            className="flex-1 rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] px-4 py-2.5 text-sm text-foreground placeholder:text-dim focus:border-[var(--border-focus)] focus:outline-none transition-colors"
            disabled={sending}
          />
          <Button
            size="sm"
            onClick={sendMessage}
            disabled={!input.trim() || sending || tavernExhausted}
            title={tavernExhausted ? "Tavern Sessions — daily limit reached. Resets at UTC midnight." : undefined}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
          {tavernEntry && tavernNearLimit && (
            <RateLimitWarning count={tavernEntry.count} limit={tavernEntry.limit} />
          )}
        </div>
      </div>
      <WaitlistDialog open={waitlistOpen} onOpenChange={setWaitlistOpen} source="tavern" />
    </div>
  );
}