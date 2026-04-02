"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BrainCircuit, Send, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { DestructiveActionModal } from "@/components/shared/destructive-action-modal";
import { EchoesOrbDynamic } from "@/components/echoes/echoes-orb-dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { initialsFromName } from "@/lib/utils";
import type { Message, Soul } from "@/lib/types";

export function EchoesInterface({
  soul,
  worldId,
  initialMessages = [],
  remaining = 50,
  onBack,
  isDemo = false,
}: {
  soul: Soul;
  worldId: string;
  initialMessages?: Message[];
  remaining?: number;
  onBack?: () => void;
  isDemo?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [displayedWords, setDisplayedWords] = useState<{ msgId: string; words: string[] }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [messagesLeft, setMessagesLeft] = useState(remaining);
  const [voiceText, setVoiceText] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleReset = async () => {
    if (isDemo) return;
    try {
      const res = await fetch(`/api/souls/${soul.id}/chat`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to reset chat memory.");
      setMessages([]);
      setDisplayedWords([]);
      toast.success("Memory wiped successfully.");
    } catch {
      toast.error("Failed to reset memory.");
    }
  };

  const color = soul.avatar_color ?? "rgb(124,92,191)";
  const initials = soul.avatar_initials ?? initialsFromName(soul.name);
  const voiceFull = soul.soul_card?.voice ?? "";

  // Typewriter for voice description on mount
  useEffect(() => {
    if (!voiceFull) return;
    let i = 0;
    setVoiceText("");
    const interval = setInterval(() => {
      i++;
      setVoiceText(voiceFull.slice(0, i));
      if (i >= voiceFull.length) clearInterval(interval);
    }, 22);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soul.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, displayedWords]);

  const submit = useCallback(async () => {
    if (!input.trim() || sending) return;
    const outgoing = input.trim();
    setInput("");
    setSending(true);
    setIsStreaming(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const optimisticUser: Message = {
      id: crypto.randomUUID(),
      conversation_id: "local",
      role: "user",
      content: outgoing,
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimisticUser]);

    const assistantId = crypto.randomUUID();

    try {
      const endpoint = isDemo ? "/api/demo/chat" : "/api/souls/chat";
      const payload = isDemo
        ? { message: outgoing }
        : { worldId, soulId: soul.id, message: outgoing };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok || !response.body) {
        let errMsg = `Chat failed (${response.status})`;
        try {
          const text = await response.text();
          if (text) {
            const json = JSON.parse(text);
            errMsg = json.error || json.message || errMsg;
          }
        } catch { /* empty body or non-JSON — use status fallback */ }
        throw new Error(errMsg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = "";

      setMessages((current) => [
        ...current,
        {
          id: assistantId,
          conversation_id: "local",
          role: "assistant",
          content: "",
          created_at: new Date().toISOString(),
        },
      ]);
      setDisplayedWords((prev) => [...prev, { msgId: assistantId, words: [] }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
        const allWords = result.split(/(\s+)/);
        setDisplayedWords((prev) =>
          prev.map((entry) =>
            entry.msgId === assistantId ? { ...entry, words: allWords } : entry,
          ),
        );
        setMessages((current) =>
          current.map((m) => (m.id === assistantId ? { ...m, content: result } : m)),
        );
      }

      if (!isDemo) setMessagesLeft((n) => Math.max(0, n - 1));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chat failed.");
    } finally {
      setSending(false);
      setIsStreaming(false);
    }
  }, [input, sending, soul.id, worldId, isDemo]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const getDisplayedWords = (msgId: string) =>
    displayedWords.find((entry) => entry.msgId === msgId)?.words ?? null;

  const showTypingIndicator =
    isStreaming && messages[messages.length - 1]?.role !== "assistant";

  return (
    <div className="relative overflow-hidden rounded-[34px] border border-border bg-[color-mix(in_srgb,var(--surface)_72%,transparent)]">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-10" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--ai-pulse)_12%,transparent),transparent_24%)]" />

      <div className="relative flex min-h-[72vh] flex-col">
        {/* ── Header ── */}
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              {onBack ? (
                <Button variant="ghost" size="icon" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              ) : null}
              <div>
                <p className="chapter-label">Souls · Echoes</p>
                <h2 className="font-heading text-3xl text-foreground">{soul.name}</h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">Speaking in character</Badge>
              <Badge variant={messagesLeft < 10 ? "danger" : "gold"}>
                {messagesLeft} remaining today
              </Badge>
              {!isDemo && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setResetModalOpen(true)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-950/30"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Wipe Memory
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid flex-1 gap-0 lg:grid-cols-[300px_1fr]">
          {/* ── Soul sidebar ── */}
          <aside className="border-b border-border p-6 lg:border-b-0 lg:border-r">
            <div className="flex flex-col items-center text-center">
              {/* Enlarged orb */}
              <div className="relative mb-5 h-52 w-52">
                <EchoesOrbDynamic isStreaming={isStreaming} />
              </div>

              <p className="font-heading text-2xl text-foreground">{soul.name}</p>

              {/* Typewriter voice description */}
              {voiceFull ? (
                <p className="mt-3 min-h-[4rem] text-sm leading-7 text-secondary">
                  {voiceText}
                  {voiceText.length < voiceFull.length && (
                    <span
                      className="ml-0.5 inline-block w-[2px] align-middle"
                      style={{
                        height: "0.85em",
                        background: "var(--text-secondary)",
                        animation: "typewriterCursor 0.9s steps(2,end) infinite",
                      }}
                    />
                  )}
                </p>
              ) : null}

              {/* Sample line quote */}
              {soul.soul_card?.sample_lines?.[0] ? (
                <blockquote
                  className="mt-6 border-l-2 pl-4 text-left font-heading text-lg italic text-[rgba(230,233,245,0.82)]"
                  style={{ borderColor: `${color}44` }}
                >
                  &ldquo;{soul.soul_card.sample_lines[0]}&rdquo;
                </blockquote>
              ) : null}

              {/* Soul avatar badge below quote */}
              <div className="mt-5 flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
                <div
                  className="flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold"
                  style={{ borderColor: color, background: `${color}22`, color }}
                >
                  {initials.slice(0, 1)}
                </div>
                <span className="text-[10px] uppercase tracking-[0.18em] text-secondary">Bound Soul</span>
              </div>

              {/* Memory depth bar */}
              <div className="mt-5 w-full space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                    <BrainCircuit className="h-3 w-3" style={{ color }} />
                    Memory depth
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">{messages.length}/50</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (messages.length / 50) * 100)}%`,
                      background: `linear-gradient(90deg, ${color}, ${color}88)`,
                    }}
                  />
                </div>
              </div>
            </div>
          </aside>

          {/* ── Chat area ── */}
          <div className="flex min-h-0 flex-col">
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {messages.length === 0 && !isStreaming ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="pt-10 text-center"
                >
                  <p className="font-heading text-2xl italic text-secondary">
                    Begin the conversation. The soul is listening.
                  </p>
                </motion.div>
              ) : null}

              <AnimatePresence initial={false}>
                {messages.map((message) => {
                  if (message.role === "user") {
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 340, damping: 26 }}
                        className="flex justify-end"
                      >
                        <div className="max-w-[80%] rounded-[22px] rounded-tr-[6px] bg-[linear-gradient(135deg,var(--ai-pulse),var(--ai-pulse-soft))] px-4 py-3 text-sm leading-7 text-white shadow-message-soul">
                          {message.content}
                        </div>
                      </motion.div>
                    );
                  }

                  const words = getDisplayedWords(message.id);
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 26 }}
                      className="group/msg flex items-start gap-2 justify-start"
                    >
                      {/* Mini soul avatar */}
                      <div
                        className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                        style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
                      >
                        {initials.slice(0, 1)}
                      </div>
                      <div className="flex max-w-[82%] flex-col gap-1">
                        <div
                          className="rounded-[22px] rounded-tl-[6px] border border-border px-4 py-3"
                          style={{
                            background: "rgba(20,24,38,0.88)",
                            borderLeft: `2px solid ${color}55`,
                          }}
                        >
                          <p
                            className="mb-1.5 text-[10px] uppercase tracking-[0.22em]"
                            style={{ color: "rgb(196,168,106)" }}
                          >
                            {soul.name}
                          </p>
                          <div className="font-heading text-lg leading-8 text-foreground">
                            {words !== null
                              ? words.map((word, index) => (
                                  <motion.span
                                    key={index}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.14 }}
                                  >
                                    {word}
                                  </motion.span>
                                ))
                              : message.content}
                          </div>
                        </div>
                        {/* Reaction toolbar — appears on hover */}
                        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover/msg:opacity-100">
                          <button
                            onClick={async () => {
                              try {
                                await fetch("/api/lore/ingest", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    worldId,
                                    title: `${soul.name} — spoken word`,
                                    content: message.content,
                                  }),
                                });
                                toast.success("Saved to your lore.");
                              } catch {
                                toast.error("Could not save to lore.");
                              }
                            }}
                            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] transition-colors hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:text-[var(--accent)]"
                          >
                            📖 Save to Lore
                          </button>
                          <button
                            onClick={() => toast.info("Coming soon.")}
                            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
                          >
                            🔖
                          </button>
                          <button
                            onClick={() => toast.info("Coming soon.")}
                            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
                          >
                            ✨
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* ── Typing indicator ── */}
              <AnimatePresence>
                {showTypingIndicator ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.88 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-2"
                  >
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
                    >
                      {initials.slice(0, 1)}
                    </div>
                    <div
                      className="flex items-center gap-2 rounded-[16px] px-4 py-2.5"
                      style={{ background: "rgba(20,24,38,0.92)" }}
                    >
                      <span className="text-xs italic text-secondary">The soul stirs</span>
                      <span className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="inline-block h-1.5 w-1.5 rounded-full"
                            style={{
                              background: `${color}b0`,
                              animation: `typingBounce 1.4s ease-in-out ${i * 0.16}s infinite`,
                            }}
                          />
                        ))}
                      </span>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {/* ── Input ── */}
            <div className="border-t border-border px-5 py-4">
              <div
                className="rounded-[26px] border bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] p-4 transition-all duration-200"
                style={{
                  borderColor: inputFocused
                    ? "color-mix(in srgb, var(--border-focus) 70%, transparent)"
                    : "var(--border)",
                  boxShadow: inputFocused ? "0 0 0 1px color-mix(in srgb, var(--border-focus) 15%, transparent)" : "none",
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    autoResize();
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder={`Write to ${soul.name}...`}
                  className="min-h-[48px] max-h-[160px] w-full resize-none bg-transparent text-sm leading-7 text-foreground outline-none placeholder:text-secondary"
                  rows={1}
                />
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-secondary">
                    {messagesLeft < 20
                      ? `${messagesLeft} words of fate remain today`
                      : "This character speaks from within your lore."}
                  </p>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      onClick={submit}
                      disabled={sending || !input.trim()}
                      style={
                        !sending && input.trim()
                          ? { boxShadow: "0 0 14px color-mix(in srgb, var(--accent) 20%, transparent)" }
                          : {}
                      }
                    >
                      <Send className="h-4 w-4" />
                      Send
                    </Button>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DestructiveActionModal
        open={resetModalOpen}
        onOpenChange={setResetModalOpen}
        title="Wipe Memory"
        description={`Are you sure you want to permanently erase the conversation history with ${soul.name}? This will clear their short-term context. This action cannot be undone.`}
        requireString={`wipe ${soul.name}`}
        onConfirm={handleReset}
        isDemo={isDemo}
      />
    </div>
  );
}
