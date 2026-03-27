"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { initialsFromName } from "@/lib/utils";

// ─── Demo script ─────────────────────────────────────────────────────────────

const SOUL_NAME = "Mira Ashveil";
const SOUL_COLOR = "rgb(157,127,224)";


type Role = "user" | "soul";

interface ScriptLine {
  id: string;
  role: Role;
  text: string;
  startMs: number;
}

const SCRIPT: ScriptLine[] = [
  { id: "u1", role: "user", text: "Do you trust anyone in Ashveil?",                               startMs: 600  },
  { id: "s1", role: "soul", text: "Trust is a lantern you hand to strangers. Most use it to find the door out.", startMs: 2200 },
  { id: "u2", role: "user", text: "What happened at the Ember Bridge?",                             startMs: 7600 },
  { id: "s2", role: "soul", text: "I was there. I do not speak of it before the third bell.",       startMs: 9200 },
  { id: "u3", role: "user", text: "What are you afraid of?",                                        startMs: 14000 },
  { id: "s3", role: "soul", text: "Silence that sounds too much like agreement.",                   startMs: 15600 },
];

const CHAR_DELAY_SOUL = 28; // ms per character
const CHAR_DELAY_USER = 40;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RenderedMsg {
  id: string;
  role: Role;
  fullText: string;
  displayedText: string;
  complete: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SoulChatPreview() {
  const [messages, setMessages] = useState<RenderedMsg[]>([]);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [phase, setPhase] = useState<"playing" | "clearing">("playing");
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const reducedMotion = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Detect reduced motion once on mount
  useEffect(() => {
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const clearAllTimers = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    Object.values(intervalsRef.current).forEach(clearInterval);
    intervalsRef.current = {};
  };

  const typeMessage = (id: string, fullText: string, charDelay: number) => {
    if (reducedMotion.current) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, displayedText: fullText, complete: true } : m))
      );
      return;
    }

    let charIdx = 0;
    const interval = setInterval(() => {
      charIdx++;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, displayedText: fullText.slice(0, charIdx), complete: charIdx >= fullText.length }
            : m
        )
      );
      if (charIdx >= fullText.length) {
        clearInterval(interval);
        delete intervalsRef.current[id];
      }
    }, charDelay);

    intervalsRef.current[id] = interval;
  };

  const startLoop = () => {
    setMessages([]);
    setTypingIndicator(false);
    setPhase("playing");

    SCRIPT.forEach((line) => {
      const isSoul = line.role === "soul";
      // Show typing indicator 900ms before soul response appears
      if (isSoul) {
        const typingStart = line.startMs - 900;
        if (typingStart > 0) {
          const t1 = setTimeout(() => setTypingIndicator(true), typingStart);
          timeoutsRef.current.push(t1);
        }
      }

      // Reveal message bubble
      const t2 = setTimeout(() => {
        if (isSoul) setTypingIndicator(false);

        const newMsg: RenderedMsg = {
          id: line.id,
          role: line.role,
          fullText: line.text,
          displayedText: reducedMotion.current ? line.text : "",
          complete: reducedMotion.current,
        };

        setMessages((prev) => [...prev, newMsg]);

        if (!reducedMotion.current) {
          const charDelay = isSoul ? CHAR_DELAY_SOUL : CHAR_DELAY_USER;
          typeMessage(line.id, line.text, charDelay);
        }
      }, line.startMs);

      timeoutsRef.current.push(t2);
    });

    // After last message finishes typing, start clearing
    const lastLine = SCRIPT[SCRIPT.length - 1];
    const clearStart =
      lastLine.startMs + lastLine.text.length * CHAR_DELAY_SOUL + 2200;

    const tClear = setTimeout(() => {
      setPhase("clearing");
      const tRestart = setTimeout(() => startLoop(), 900);
      timeoutsRef.current.push(tRestart);
    }, clearStart);

    timeoutsRef.current.push(tClear);
  };

  useEffect(() => {
    startLoop();
    return () => clearAllTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const miraInitials = initialsFromName(SOUL_NAME);

  return (
    <div className="flex flex-col gap-3">
      {/* Soul identity strip */}
      <div className="flex items-center gap-3 px-1">
        <div
          className="soul-glow-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-medium"
          style={{
            borderColor: SOUL_COLOR,
            background: `${SOUL_COLOR}20`,
            color: SOUL_COLOR,
          }}
        >
          {miraInitials}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground" style={{ fontFamily: "var(--font-crimson), serif" }}>
            {SOUL_NAME}
          </p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-secondary">Bound Soul · Ashveil</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[rgba(92,180,145,0.8)]" />
          <span className="text-[10px] text-secondary">Speaking in character</span>
        </div>
      </div>

      {/* Chat window */}
      <div
        ref={scrollRef}
        className="relative min-h-[260px] overflow-hidden rounded-[20px] lg:min-h-[320px]"
        style={{ background: "rgba(6,8,14,0.72)" }}
      >
        <div className="flex flex-col gap-3 p-4">
          <AnimatePresence mode={phase === "clearing" ? "sync" : "popLayout"}>
            {phase !== "clearing" &&
              messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={reducedMotion.current ? false : { opacity: 0, scale: 0.92, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 340, damping: 26 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "soul" ? (
                    <div className="flex max-w-[85%] items-start gap-2">
                      {/* Mini avatar */}
                      <div
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                        style={{ background: `${SOUL_COLOR}22`, color: SOUL_COLOR }}
                      >
                        {miraInitials.slice(0, 1)}
                      </div>
                      <div
                        className="rounded-[16px] rounded-tl-[4px] px-4 py-2.5 text-sm leading-6"
                        style={{
                          background: "rgba(20,16,28,0.92)",
                          borderLeft: "2px solid rgba(157,127,224,0.45)",
                          color: "rgba(230,233,245,0.92)",
                        }}
                      >
                        {msg.displayedText}
                        {!msg.complete && (
                          <span
                            className="ml-0.5 inline-block w-[2px] align-middle"
                            style={{
                              height: "0.9em",
                              background: SOUL_COLOR,
                              animation: "typewriterCursor 0.9s steps(2,end) infinite",
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      className="max-w-[80%] rounded-[16px] rounded-tr-[4px] px-4 py-2.5 text-sm leading-6"
                      style={{
                        background: "linear-gradient(135deg,rgba(126,109,242,0.82),rgba(165,148,255,0.72))",
                        color: "rgba(230,233,245,0.95)",
                      }}
                    >
                      {msg.displayedText}
                      {!msg.complete && (
                        <span
                          className="ml-0.5 inline-block w-[2px] align-middle"
                          style={{
                            height: "0.9em",
                            background: "rgba(255,255,255,0.8)",
                            animation: "typewriterCursor 0.9s steps(2,end) infinite",
                          }}
                        />
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {typingIndicator && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-2"
              >
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{ background: `${SOUL_COLOR}22`, color: SOUL_COLOR }}
                >
                  {miraInitials.slice(0, 1)}
                </div>
                <div
                  className="flex items-center gap-2 rounded-[14px] px-4 py-2.5"
                  style={{ background: "rgba(20,16,28,0.92)" }}
                >
                  <span className="text-xs italic text-secondary">The soul stirs</span>
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="inline-block h-1 w-1 rounded-full bg-[rgba(157,127,224,0.7)]"
                        style={{ animation: `typingBounce 1.4s ease-in-out ${i * 0.16}s infinite` }}
                      />
                    ))}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
