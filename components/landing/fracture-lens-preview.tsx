"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, ScanSearch } from "lucide-react";

// Script sequence
const INITIAL_TEXT = "The King's army marched relentlessly across the plains of Ashveil. By nightfall, they reached the crossing.";
const TYPING_TEXT = " Setting up camp, the King rallied his commanders and confidently rode his heavy destrier warhorse across the Ember Bridge.";

const CHAR_DELAY = 45; // ms per char

export function FractureLensPreview() {
  const [typedCount, setTypedCount] = useState(0);
  const [phase, setPhase] = useState<"typing" | "scanning" | "flagged" | "resetting">("typing");
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const clearAllTimers = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (intervalsRef.current) clearInterval(intervalsRef.current);
  };

  const startLoop = () => {
    setTypedCount(0);
    setPhase("typing");
    
    // Pause briefly before typing starts
    timeoutsRef.current.push(
      setTimeout(() => {
        if (reducedMotion.current) {
          setTypedCount(TYPING_TEXT.length);
          triggerScanning();
          return;
        }

        let currentCount = 0;
        intervalsRef.current = setInterval(() => {
          currentCount++;
          setTypedCount(currentCount);

          if (currentCount >= TYPING_TEXT.length) {
            if (intervalsRef.current) clearInterval(intervalsRef.current);
            triggerScanning();
          }
        }, CHAR_DELAY);
      }, 1000)
    );
  };

  const triggerScanning = () => {
    setPhase("scanning");
    timeoutsRef.current.push(
      setTimeout(() => {
        setPhase("flagged");
        
        // Hold on the flagged state for 5 seconds before reset
        timeoutsRef.current.push(
          setTimeout(() => {
            setPhase("resetting");
            timeoutsRef.current.push(setTimeout(() => startLoop(), 600));
          }, 5000)
        );
      }, 1200) // Scanner takes 1.2s to find the contradiction
    );
  };

  useEffect(() => {
    startLoop();
    return () => clearAllTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTyping = TYPING_TEXT.slice(0, Math.max(0, typedCount));

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start max-w-5xl mx-auto w-full">
      {/* ── LEFT: MOCK EDITOR ──────────────────────────────────────────────── */}
      <div className="relative">
        {/* Editor chrome */}
        <div className="arcane-border glass-panel-elevated relative overflow-hidden rounded-2xl">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.06]" />
          
          {/* Toolbar */}
          <div className="flex h-12 items-center gap-2 border-b border-[var(--border)] px-4 bg-[rgba(20,16,28,0.4)]">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-[var(--border)] opacity-40" />
              <div className="h-3 w-3 rounded-full bg-[var(--border)] opacity-40" />
              <div className="h-3 w-3 rounded-full bg-[var(--border)] opacity-40" />
            </div>
            <div className="mx-2 h-4 w-px bg-[var(--border)] opacity-50" />
            <div className="h-4 w-24 rounded-full bg-[var(--border)] opacity-20" />
            <div className="h-4 w-12 rounded-full bg-[var(--border)] opacity-20" />
          </div>

          {/* Typing Area */}
          <div className="relative min-h-[260px] p-6 lg:p-8">
            <h3 className="mb-4 font-heading text-3xl text-[var(--text-main)] opacity-90">
              The March on the Hollows
            </h3>
            <p className="text-sm leading-8 text-[var(--text-muted)] sm:text-base sm:leading-8">
              <span>{INITIAL_TEXT}</span>
              <span className="relative">
                <span className="text-[var(--text-main)] transition-colors duration-200" style={{
                  color: phase === "flagged" ? "var(--danger)" : "var(--text-main)"
                }}>{currentTyping}</span>
                
                {/* Typewriter cursor - hide when scanning flags */}
                {phase === "typing" && (
                  <span className="ml-0.5 inline-block h-[1em] w-[2px] align-middle bg-[var(--accent)]" style={{ animation: "typewriterCursor 0.9s steps(2,end) infinite" }} />
                )}

                {/* Animated squiggly red underline when flagged */}
                {phase === "flagged" && (
                  <motion.span
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="absolute -bottom-1 left-0 right-0 h-0.5 origin-left rounded-full bg-[var(--danger)] opacity-80"
                  />
                )}
              </span>
            </p>

            {/* Sweep scanner effect */}
            <AnimatePresence>
              {phase === "scanning" && (
                <motion.div
                  initial={{ top: 0, opacity: 0 }}
                  animate={{ top: "100%", opacity: [0, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, ease: "linear" }}
                  className="pointer-events-none absolute left-0 right-0 h-12 bg-gradient-to-b from-transparent to-[color-mix(in_srgb,var(--ai-pulse)_20%,transparent)] border-b border-[var(--ai-pulse)]"
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── RIGHT: FRACTURE LENS UI ────────────────────────────────────────── */}
      <div className="relative flex flex-col gap-4">
        {/* Module Header */}
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] shadow-sm">
            {phase === "scanning" ? (
              <ScanSearch className="h-5 w-5 animate-pulse text-[var(--ai-pulse)]" />
            ) : phase === "flagged" ? (
              <AlertTriangle className="h-5 w-5 text-[var(--danger)]" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-[var(--success)]" />
            )}
          </div>
          <div>
            <h3 className="font-heading text-lg text-[var(--text-main)]">The Narrator&apos;s Eye</h3>
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-muted)] opacity-80">
              {phase === "scanning" ? "Scanning canon..." : phase === "flagged" ? "Tension Detected" : "Canon Secure"}
            </p>
          </div>
        </div>

        {/* Flag Card */}
        <div className="h-[220px] relative">
          <AnimatePresence mode="popLayout">
            {phase === "flagged" && (
               <motion.div
                key="flag"
                initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.96, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="w-full"
               >
                 <div className="rounded-[16px] border border-[color-mix(in_srgb,var(--border)_40%,transparent)] bg-[var(--surface-raised)] p-5 shadow-[0_8px_30px_color-mix(in_srgb,var(--danger)_12%,transparent)]"
                      style={{ 
                        borderLeftColor: "color-mix(in srgb, var(--danger) 60%, transparent)", 
                        borderLeftWidth: "4px" 
                 }}>
                   
                   <div className="flex items-center gap-2 mb-3">
                     <AlertTriangle className="h-4 w-4 text-[var(--danger)]" />
                     <div className="rounded-full border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-2.5 py-0.5 text-[10px] sm:text-xs uppercase tracking-[0.15em] text-[var(--danger)] font-medium">
                       High Tension
                     </div>
                   </div>

                   <p className="text-[13px] leading-relaxed text-[var(--text-main)]">
                    <span className="font-medium">Canon violation:</span> The Ember Bridge cannot support heavy destrier warhorses.
                   </p>
                   
                   <div className="mt-3 rounded-xl bg-[rgba(6,8,14,0.4)] p-3 border border-[var(--border)] border-opacity-40">
                     <p className="text-[11px] text-[var(--text-muted)] italic leading-relaxed opacity-80">
                       From the archive: &ldquo;The Ember Bridge is an ancient pedestrian crossing constructed entirely of hollow glass. It can scarcely bear the weight of a running child.&rdquo;
                     </p>
                   </div>
                 </div>
               </motion.div>
            )}

            {(phase === "typing" || phase === "scanning" || phase === "resetting") && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex flex-col items-center justify-center rounded-[16px] border border-dashed border-[var(--border)] bg-[rgba(20,16,28,0.2)] text-center opacity-60"
              >
                <div className="h-8 w-8 rounded-full bg-[var(--surface-raised)] flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-4 w-4 text-[var(--text-muted)] opacity-50" />
                </div>
                <p className="text-sm text-[var(--text-muted)]">Lore is perfectly aligned.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
