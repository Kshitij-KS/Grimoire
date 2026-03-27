"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { FlagCard } from "@/components/consistency/flag-card";
import type { ConsistencyCheck, ConsistencyFlag } from "@/lib/types";

export function ConsistencyChecker({
  worldId,
  initialFlags,
  initialChecks = [],
  isReadonly,
}: {
  worldId: string;
  initialFlags: ConsistencyFlag[];
  initialChecks?: ConsistencyCheck[];
  isReadonly?: boolean;
}) {
  const [text, setText] = useState("");
  const [flags, setFlags] = useState(initialFlags);
  const [checks] = useState(initialChecks);
  const [loading, setLoading] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const resolveFlag = async (id: string) => {
    // Optimistic update with rollback on failure
    const prev = [...flags];
    setFlags((current) => current.map((flag) => (flag.id === id ? { ...flag, resolved: true } : flag)));
    try {
      const res = await fetch("/api/consistency/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Resolve failed.");
    } catch {
      setFlags(prev);
      toast.error("Failed to resolve flag. Please try again.");
    }
  };

  const runCheck = async () => {
    if (!text.trim() || isReadonly) return;
    setLoading(true);
    try {
      const response = await fetch("/api/consistency/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId, text }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Consistency check failed.");
      setFlags(payload.flags);
      setHasChecked(true);
      if (!payload.flags.length) {
        toast.success("The world holds. No contradictions found.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Consistency check failed.");
    } finally {
      setLoading(false);
    }
  };

  const activeFlags = flags.filter((f) => !f.resolved);
  const resolvedFlags = flags.filter((f) => f.resolved);

  return (
    <div className="space-y-6">
      <Card className="rounded-[30px] p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-secondary">The Narrator&apos;s Eye</p>
        <h2 className="mt-1 font-heading text-3xl text-foreground">Scan the Archive</h2>
        <p className="mt-2 text-sm leading-7 text-secondary">
          Bring new writing before the archive. The world&apos;s memory will speak.
        </p>
        <Textarea
          className="mt-4 min-h-[220px] disabled:cursor-not-allowed disabled:opacity-60"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Paste a passage you've written. The archive will check it for contradictions with established lore..."
          disabled={isReadonly}
        />
        {text.length > 0 ? (
          <p className="mt-1 text-right text-xs text-secondary">{text.length} characters</p>
        ) : null}
        {!isReadonly ? (
          <div className="mt-4 flex items-center justify-end gap-4">
            <Button onClick={runCheck} disabled={loading || !text.trim()}>
              {loading ? "Consulting the archive..." : "Scan the Archive"}
            </Button>
          </div>
        ) : null}
      </Card>

      {/* Results */}
      <AnimatePresence mode="wait">
        {hasChecked && activeFlags.length === 0 ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Card className="rounded-[30px] border-[rgba(74,156,109,0.3)] bg-[rgba(74,156,109,0.06)] p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 400 }}
                className="mb-4 flex justify-center"
              >
                <CheckCircle2 className="h-12 w-12 text-[rgb(74,156,109)]" />
              </motion.div>
              <p className="font-heading text-3xl italic text-[rgb(183,247,208)]">
                The world holds.
              </p>
              <p className="mt-3 text-sm text-secondary">No contradictions detected in this passage.</p>
            </Card>
          </motion.div>
        ) : activeFlags.length > 0 ? (
          <motion.div
            key="flags"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.25em] text-secondary">
                {activeFlags.length} {activeFlags.length === 1 ? "tension" : "tensions"} in the canon
              </p>
              {resolvedFlags.length > 0 ? (
                <p className="text-xs text-secondary">{resolvedFlags.length} resolved</p>
              ) : null}
            </div>
            <AnimatePresence>
              {activeFlags.map((flag, index) => (
                <motion.div
                  key={flag.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -24, height: 0, marginBottom: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.25 }}
                >
                  <FlagCard flag={flag} onResolve={resolveFlag} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : initialFlags.length > 0 ? (
          <motion.div
            key="initial-flags"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <p className="text-sm uppercase tracking-[0.25em] text-secondary">
              {initialFlags.filter((f) => !f.resolved).length} unresolved {initialFlags.filter((f) => !f.resolved).length === 1 ? "tension" : "tensions"}
            </p>
            <AnimatePresence>
              {flags.filter((f) => !f.resolved).map((flag, index) => (
                <motion.div
                  key={flag.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -24, height: 0, marginBottom: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.25 }}
                >
                  <FlagCard flag={flag} onResolve={resolveFlag} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Check history */}
      {checks.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.25em] text-secondary">Archive memory — past scans</p>
          <Accordion type="single" collapsible className="space-y-2">
            {checks.map((check) => (
              <AccordionItem key={check.id} value={check.id} className="glass-panel rounded-[20px] border-none px-4">
                <AccordionTrigger className="text-sm text-secondary hover:text-foreground">
                  {new Date(check.created_at).toLocaleString()}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-7 text-secondary">
                  {check.source_text}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </div>
  );
}
