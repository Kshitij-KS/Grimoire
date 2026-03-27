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

const DEMO_FLAGS: ConsistencyFlag[] = [
  {
    id: "demo-flag-1",
    world_id: "demo-world",
    check_id: "demo-check",
    flagged_text: "The cathedral bells rang throughout the siege",
    contradiction:
      "Established lore says the western bells have been silent for nine winters, so this event conflicts with canon.",
    existing_reference:
      "The cathedral's western bells have not answered a hand or storm in nine winters.",
    severity: "medium",
    resolved: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-flag-2",
    world_id: "demo-world",
    check_id: "demo-check",
    flagged_text: "Mira smiled warmly at the crowd",
    contradiction:
      "Mira is defined as guarded, suspicious, and difficult to read, so this emotional beat breaks her established voice.",
    existing_reference: "She distrusts anyone who smiles before sunset.",
    severity: "low",
    resolved: false,
    created_at: new Date().toISOString(),
  },
];

const DEMO_SAMPLE_TEXT =
  "The cathedral bells rang throughout the siege, calling the faithful to arms. Mira smiled warmly at the crowd gathered on Ember Bridge, her lantern burning with holy fire as she led the charge against the Ember Cult.";

export function FractureLens({
  worldId,
  initialFlags,
  initialChecks = [],
  isReadonly,
  isDemo,
}: {
  worldId: string;
  initialFlags: ConsistencyFlag[];
  initialChecks?: ConsistencyCheck[];
  isReadonly?: boolean;
  isDemo?: boolean;
}) {
  const [text, setText] = useState("");
  const [flags, setFlags] = useState(initialFlags);
  const [loading, setLoading] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const resolveFlag = async (id: string) => {
    if (isDemo) {
      setFlags((current) => current.map((flag) => (flag.id === id ? { ...flag, resolved: true } : flag)));
      return;
    }

    const previous = [...flags];
    setFlags((current) => current.map((flag) => (flag.id === id ? { ...flag, resolved: true } : flag)));
    try {
      const response = await fetch("/api/consistency/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("Resolve failed.");
    } catch {
      setFlags(previous);
      toast.error("Failed to resolve the contradiction. Please try again.");
    }
  };

  const runCheck = async () => {
    if (!text.trim() || (isReadonly && !isDemo)) return;
    setLoading(true);

    if (isDemo) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const nextFlags = DEMO_FLAGS.filter((flag) => text.toLowerCase().includes(flag.flagged_text.toLowerCase()));
      setFlags(nextFlags.map((flag) => ({ ...flag, resolved: false })));
      setHasChecked(true);
      setLoading(false);
      if (nextFlags.length === 0) toast.success("The world holds.");
      return;
    }

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
      if (!payload.flags.length) toast.success("The world holds.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Consistency check failed.");
    } finally {
      setLoading(false);
    }
  };

  const activeFlags = flags.filter((flag) => !flag.resolved);

  return (
    <div className="space-y-6 pb-24">
      <Card className="rounded-[32px] p-6 sm:p-7">
        <div className="space-y-3">
          <p className="chapter-label">Consistency • Fracture Lens</p>
          <h2 className="font-heading text-4xl text-foreground">Check new writing against the archive</h2>
          <p className="max-w-3xl text-sm leading-7 text-secondary">
            This is intentionally calmer than the older version: write, scan, review, resolve. The idea stays thematic,
            but the workflow stays readable.
          </p>
        </div>

        {isDemo && !hasChecked ? (
          <Card className="mt-5 rounded-[24px] border-[rgba(196,168,106,0.2)] bg-[rgba(196,168,106,0.06)] p-4">
            <p className="text-sm leading-7 text-secondary">
              Demo mode is active. Paste your own text below, or{" "}
              <button type="button" onClick={() => setText(DEMO_SAMPLE_TEXT)} className="text-[rgb(196,168,106)] underline underline-offset-4">
                use the sample contradiction passage
              </button>
              .
            </p>
          </Card>
        ) : null}

        <div className="relative mt-5">
          <p className="chapter-label mb-2">— Scrying Glass —</p>
          <div className="relative">
            <Textarea
              className="min-h-[240px]"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Paste a fresh scene, lore note, or revision. Grimoire will compare it to the world's established memory."
              disabled={loading || (isReadonly && !isDemo)}
            />
            {loading ? <div className="scan-line" /> : null}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-secondary">{text.length} characters</p>
          {(!isReadonly || isDemo) && !hasChecked ? (
            <Button onClick={runCheck} disabled={loading || !text.trim()}>
              {loading ? "Consulting the archive..." : "Scan for contradictions"}
            </Button>
          ) : null}
        </div>
      </Card>

      <AnimatePresence mode="wait">
        {hasChecked && activeFlags.length === 0 ? (
          <motion.div
            key="holds"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="rounded-[30px] border-[rgba(92,180,145,0.28)] bg-[rgba(92,180,145,0.08)] p-8 text-center">
              <div className="mb-4 flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-[rgb(92,180,145)]" />
              </div>
              <p className="font-heading text-3xl italic text-[rgb(201,248,228)]">The world holds.</p>
              <p className="mt-3 text-sm text-secondary">No contradictions appeared in this passage.</p>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {activeFlags.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="chapter-label">{activeFlags.length} active contradictions</p>
            {hasChecked ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setHasChecked(false);
                  if (isDemo) setText("");
                }}
              >
                Clear scan
              </Button>
            ) : null}
          </div>
          <AnimatePresence mode="sync">
            {activeFlags.map((flag) => (
              <FlagCard key={flag.id} flag={flag} onResolve={resolveFlag} />
            ))}
          </AnimatePresence>
        </div>
      ) : null}

      {initialChecks.length > 0 ? (
        <div className="space-y-3">
          <p className="chapter-label">Past scans</p>
          <Accordion type="single" collapsible className="space-y-2">
            {initialChecks.map((check) => (
              <AccordionItem key={check.id} value={check.id} className="glass-panel rounded-[22px] border-none px-4">
                <AccordionTrigger>{new Date(check.created_at).toLocaleString()}</AccordionTrigger>
                <AccordionContent className="text-sm leading-7 text-secondary">{check.source_text}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ) : null}
    </div>
  );
}
