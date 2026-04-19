"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { initialsFromName } from "@/lib/utils";
import type { Message, Soul } from "@/lib/types";

export function SoulChatInterface({
  soul,
  worldId,
  initialMessages = [],
  remaining = 50,
}: {
  soul: Soul;
  worldId: string;
  initialMessages?: Message[];
  remaining?: number;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [messagesLeft, setMessagesLeft] = useState(remaining);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const submit = useCallback(async () => {
    if (!input.trim() || sending) return;
    const outgoing = input.trim();
    setInput("");
    setSending(true);
    setIsTyping(true);
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
      const response = await fetch("/api/souls/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId, soulId: soul.id, message: outgoing }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json();
        throw new Error(payload.error || "Chat failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = "";
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });

        if (firstChunk) {
          firstChunk = false;
          setIsTyping(false);
          setMessages((current) => [
            ...current,
            {
              id: assistantId,
              conversation_id: "local",
              role: "assistant",
              content: result,
              created_at: new Date().toISOString(),
            },
          ]);
        } else {
          setMessages((current) =>
            current.map((m) => (m.id === assistantId ? { ...m, content: result } : m)),
          );
        }
      }

      setMessagesLeft((n) => Math.max(0, n - 1));
    } catch (error) {
      setIsTyping(false);
      toast.error(error instanceof Error ? error.message : "Chat failed.");
    } finally {
      setSending(false);
      setIsTyping(false);
    }
  }, [input, sending, soul.id, worldId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,100,40,0.12),transparent_35%),#0d0b08]" />
      {/* No grid — warm atmospheric background only */}

      {/* Grain overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          opacity: 0.03,
        }}
      />

      <div className="relative z-10 mx-auto flex h-[100dvh] max-w-5xl flex-col px-3 pb-3 pt-3 sm:px-4 sm:pb-6 sm:pt-6">
        {/* Soul header */}
        <Card className="mb-3 sm:mb-4 flex items-center gap-3 sm:gap-4 rounded-2xl sm:rounded-[28px] px-4 py-3 sm:px-5 sm:py-4 shrink-0">
          <Avatar
            className="h-10 w-10 sm:h-14 sm:w-14 border-2 shrink-0"
            style={{ borderColor: soul.avatar_color, boxShadow: `0 0 24px ${soul.avatar_color}44` }}
          >
            <AvatarFallback style={{ background: `${soul.avatar_color}22`, color: soul.avatar_color }}>
              {soul.avatar_initials ?? initialsFromName(soul.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-secondary">Speaking as</p>
            <h1 className="font-heading text-2xl sm:text-4xl text-foreground line-clamp-1">{soul.name}</h1>
            {soul.soul_card?.voice ? (
              <p className="mt-0.5 line-clamp-1 text-xs italic text-secondary">
                {soul.soul_card.voice.slice(0, 70)}
              </p>
            ) : null}
          </div>
        </Card>

        {/* Messages area */}
        <div
          ref={scrollRef}
          className="glass-panel flex-1 space-y-4 overflow-y-auto rounded-2xl sm:rounded-[30px] p-4 sm:p-5"
        >
          {/* Empty state */}
          {messages.length === 0 && !isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <Avatar
                className="mb-4 h-12 w-12 sm:h-16 sm:w-16 border-2"
                style={{ borderColor: soul.avatar_color, boxShadow: `0 0 32px ${soul.avatar_color}44` }}
              >
                <AvatarFallback style={{ background: `${soul.avatar_color}22`, color: soul.avatar_color }}>
                  {soul.avatar_initials ?? initialsFromName(soul.name)}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-heading text-2xl sm:text-3xl text-foreground">{soul.name}</h3>
              {soul.soul_card?.sample_lines?.[0] && (
                <blockquote className="mt-4 max-w-md border-l-[3px] border-[rgba(212,168,83,0.4)] pl-4 font-heading text-lg sm:text-xl italic text-secondary">
                  &ldquo;{soul.soul_card.sample_lines[0]}&rdquo;
                </blockquote>
              )}
              <p className="mt-4 text-sm text-secondary">Begin the conversation. They are waiting.</p>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[90%] sm:max-w-[80%] rounded-[20px] sm:rounded-[24px] bg-[linear-gradient(135deg,var(--ai-pulse),var(--ai-pulse-soft))] px-4 py-2.5 sm:px-4 sm:py-3 text-white shadow-sm text-sm sm:text-base prose-grimoire"
                      : "max-w-[90%] sm:max-w-[80%] rounded-[20px] sm:rounded-[24px] border border-border border-l-[3px] border-l-[var(--accent)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-4 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base prose-grimoire"
                  }
                >
                  {message.role === "assistant" ? (
                    <p className="mb-2 text-xs uppercase tracking-[0.25em] text-[var(--accent)]">{soul.name}</p>
                  ) : null}
                  <div>
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="flex justify-start"
              >
                <div className="rounded-[20px] sm:rounded-[24px] border border-border border-l-[3px] border-l-[var(--accent)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-4 py-2.5 sm:px-4 sm:py-3">
                  <p className="mb-2 text-xs uppercase tracking-[0.25em] text-[var(--accent)]">{soul.name}</p>
                  <TypingDots />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input bar */}
        <Card className="mt-3 sm:mt-4 rounded-[20px] sm:rounded-[28px] p-3 sm:p-4 shrink-0">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoResize();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Write to the soul... (Enter to send, Shift+Enter for new line)"
            className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-secondary"
            style={{ minHeight: "48px", maxHeight: "160px" }}
            rows={2}
          />

          {/* Usage progress bar */}
          <div className="mt-2 mb-3">
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
              <div
                className="h-full rounded-full bg-[color-mix(in_srgb,var(--ai-pulse)_50%,transparent)] transition-all"
                style={{ width: `${(messagesLeft / 50) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-secondary">
              {messagesLeft < 20 ? (
                <span className={messagesLeft < 10 ? "text-[rgb(192,74,74)]" : "text-[var(--accent)]"}>
                  {messagesLeft} words of fate remain today
                </span>
              ) : (
                <span>{messagesLeft} / 50 today</span>
              )}
            </div>
            <Button onClick={submit} disabled={sending || !input.trim()}>
              {sending ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </div>

          <p className="mt-3 text-center text-xs text-secondary opacity-60">
            This character speaks from within your lore. Their knowledge is bounded by what you have written.
          </p>
        </Card>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-[rgb(212,168,83)]"
          animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
          transition={{
            repeat: Infinity,
            duration: 0.9,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
