"use client";

import { useState, useEffect, useRef } from "react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Crown, Lock, Pencil, Send, Users, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FREE_TIER_LIMITS } from "@/lib/constants";
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
}

export function TavernChat({ worldId, souls, plan = "free" }: TavernChatProps) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [messages, setMessages] = useState<TavernMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedSouls, setSelectedSouls] = useState<string[]>([]);
  const [directedTo, setDirectedTo] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        }),
      });
      const data = await res.json();
      if (data.error === "TAVERN_SOUL_LIMIT") {
        toast.error(data.detail ?? "Soul limit reached. Upgrade to Pro.");
        return;
      }
      if (data.session) {
        setSession({
          id: data.session.id,
          name: data.session.name,
          soulIds: data.session.soul_ids,
        });
        setSessionName(data.session.name ?? "The Tavern");
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
          <h2 className="font-heading text-3xl text-foreground">The Tavern</h2>
          <p className="mt-1 text-sm text-secondary">
            Gather your souls together. Watch them speak, argue, and reveal.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <p className="chapter-label">— Select 2–{soulLimit} Souls —</p>

          <div className="grid gap-3 sm:grid-cols-2">
            {souls.map((soul) => {
              const isSelected = selectedSouls.includes(soul.id);
              const isAtLimit = !isSelected && selectedSouls.length >= soulLimit;
              // Show a locked upsell slot when a free user already has 3 souls selected
              // and tries to select a 4th (which doesn't exist yet for free), or just
              // grey out excess souls when at limit.
              return (
                <motion.button
                  key={soul.id}
                  whileTap={isAtLimit ? undefined : { scale: 0.97 }}
                  onClick={() => {
                    if (isAtLimit) return; // locked at free limit
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
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
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
                      <span className="text-[10px] text-white">✓</span>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Upsell slot — shown when a free user hits the 3-soul limit */}
          {isFree && souls.length >= FREE_TIER_LIMITS.tavernSouls && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-3 rounded-[18px] border border-dashed border-[color-mix(in_srgb,var(--gold)_30%,transparent)] bg-[color-mix(in_srgb,var(--gold)_4%,transparent)] p-4"
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
            </motion.div>
          )}

          {souls.length < 2 && (
            <p className="text-xs text-secondary text-center">
              You need at least 2 bound souls to use the Tavern.
            </p>
          )}

          {/* Contextual generation note when 3 souls selected */}
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

          <Button
            className="w-full"
            onClick={createSession}
            disabled={selectedSouls.length < 2}
          >
            <Plus className="mr-2 h-4 w-4" />
            Open the Tavern ({selectedSouls.length}/{soulLimit} souls)
          </Button>
        </div>
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
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
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
                        className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
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
                : "Address the tavern..."
            }
            className="flex-1 rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] px-4 py-2.5 text-sm text-foreground placeholder:text-dim focus:border-[var(--border-focus)] focus:outline-none transition-colors"
            disabled={sending}
          />
          <Button
            size="sm"
            onClick={sendMessage}
            disabled={!input.trim() || sending}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}