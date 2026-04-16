"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Search,
  AlertTriangle,
  TrendingUp,
  Loader2,
  Zap,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NarratorToolsProps {
  worldId: string;
}

interface ImpactResult {
  affected?: Array<{
    name: string;
    type: string;
    impact: string;
    severity: string;
  }>;
  orphaned?: string[];
  invalidated?: string[];
}

interface BlankSpot {
  entity: string;
  missing: string;
  suggestion: string;
}

type Tab = "impact" | "blank-spots";

const severityColors: Record<string, string> = {
  low: "var(--success)",
  medium: "var(--accent)",
  high: "var(--danger)",
  critical: "var(--danger)",
};

const severityBgColors: Record<string, string> = {
  low: "color-mix(in srgb, var(--success) 15%, transparent)",
  medium: "color-mix(in srgb, var(--accent) 15%, transparent)",
  high: "color-mix(in srgb, var(--danger) 15%, transparent)",
  critical: "color-mix(in srgb, var(--danger) 15%, transparent)",
};

export function NarratorTools({ worldId, isDemo }: NarratorToolsProps & { isDemo?: boolean }) {
  const [tab, setTab] = useState<Tab>("impact");
  const [scenario, setScenario] = useState("");
  const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);
  const [blankSpots, setBlankSpots] = useState<BlankSpot[]>([]);
  const [loading, setLoading] = useState(false);

  const analyzeImpact = async () => {
    if (!scenario.trim()) return;
    setLoading(true);

    if (isDemo) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setImpactResult({
        affected: [
          { name: "Mira Ashveil", type: "character", impact: "Her primary mission would be lost, potentially leading her to seek reconciliation with her past.", severity: "high" },
          { name: "Ember Cult", type: "faction", impact: "The Cult would lose its grip on the bridge, creating a power vacuum in the lower wards.", severity: "critical" },
          { name: "Ashveil", type: "location", impact: "The city's political balance shifts as the northern bells stop ringing.", severity: "medium" },
        ],
        orphaned: ["Kaelen the Silent"],
        invalidated: ["The Treaty of Three Fires depends on the Cult's presence."],
      });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/narrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "impact", worldId, scenario }),
      });
      const data = await res.json();
      setImpactResult(data);
    } catch (e) {
      console.error("Impact analysis failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const findBlankSpots = async () => {
    setLoading(true);

    if (isDemo) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setBlankSpots([
        { entity: "Mira Ashveil", missing: "Early years in the lower wards", suggestion: "Write about her life before the Ember Cult recruited her at the Glass Fair." },
        { entity: "Ember Cult", missing: "The Founding Covenant", suggestion: "Explain what original promise the first High Priest made to the commoners." },
        { entity: "Glass Fair", missing: "Origins and why it matters to the city", suggestion: "Describe the first fair and the 'Hollow Glass' tradition." },
      ]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/narrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "blank-spots", worldId }),
      });
      const data = await res.json();
      setBlankSpots(data.holes ?? []);
    } catch (e) {
      console.error("Blank spot detection failed:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl py-6">
      <div className="mb-6">
        <h2 className="font-heading text-3xl text-foreground">
          Narrator&rsquo;s Tools
        </h2>
        <p className="text-sm text-secondary">
          Peer beyond the veil. Analyze what-if scenarios and find gaps in your
          world.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setTab("impact")}
          className={`rounded-[14px] px-4 py-2 text-sm transition-all ${
            tab === "impact"
              ? "bg-[color-mix(in_srgb,var(--ai-pulse)_15%,transparent)] text-[var(--ai-pulse-soft)] border border-[color-mix(in_srgb,var(--ai-pulse)_30%,transparent)]"
              : "text-secondary hover:text-foreground border border-transparent"
          }`}
        >
          <Zap className="mr-1.5 inline h-3.5 w-3.5" />
          Impact Simulator
        </button>
        <button
          onClick={() => setTab("blank-spots")}
          className={`rounded-[14px] px-4 py-2 text-sm transition-all ${
            tab === "blank-spots"
              ? "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)]"
              : "text-secondary hover:text-foreground border border-transparent"
          }`}
        >
          <MapPin className="mr-1.5 inline h-3.5 w-3.5" />
          Lore Holes
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === "impact" && (
          <motion.div
            key="impact"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <div className="glass-panel rounded-xl p-5 space-y-3">
              <p className="chapter-label">— What-If Scenario —</p>
              <textarea
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder="What if the Ember Cult was destroyed? What if Kael discovered the truth?"
                className="w-full resize-none rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] p-3 text-sm text-foreground placeholder:text-dim focus:border-[var(--border-focus)] focus:outline-none transition-colors"
                rows={3}
              />
              <Button
                onClick={analyzeImpact}
                disabled={!scenario.trim() || loading}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <TrendingUp className="mr-2 h-4 w-4" />
                )}
                Analyze Impact
              </Button>
            </div>

            {impactResult && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Affected Entities */}
                {(impactResult.affected?.length ?? 0) > 0 && (
                  <div className="glass-panel rounded-xl p-5">
                    <p className="chapter-label mb-3">— Affected Entities —</p>
                    <div className="space-y-2">
                      {impactResult.affected?.map((entity, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-start gap-3 rounded-[14px] border border-border p-3"
                        >
                          <span
                            className="shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide font-bold"
                            style={{
                              background: severityBgColors[entity.severity] ?? severityBgColors.medium,
                              color: severityColors[entity.severity] ?? severityColors.medium,
                              borderLeft: `2px solid ${severityColors[entity.severity] ?? severityColors.medium}`,
                            }}
                          >
                            {entity.severity}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {entity.name}
                              </span>
                              <span className="text-[10px] text-secondary uppercase">
                                {entity.type}
                              </span>
                            </div>
                            <p className="text-xs text-secondary leading-5">
                              {entity.impact}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Orphaned */}
                {(impactResult.orphaned?.length ?? 0) > 0 && (
                  <div className="glass-panel rounded-xl p-5">
                    <p className="chapter-label mb-3 text-[var(--danger)]">
                      — Orphaned Characters —
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {impactResult.orphaned?.map((name, i) => (
                        <span
                          key={i}
                          className="rounded-lg bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-2.5 py-1 text-xs text-[var(--danger)]"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invalidated */}
                {(impactResult.invalidated?.length ?? 0) > 0 && (
                  <div className="glass-panel rounded-xl p-5">
                    <p className="chapter-label mb-3">
                      — Invalidated World Rules —
                    </p>
                    <ul className="space-y-1">
                      {impactResult.invalidated?.map((rule, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-secondary"
                        >
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--gold)]" />
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {tab === "blank-spots" && (
          <motion.div
            key="blank-spots"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <div className="glass-panel rounded-xl p-5 text-center">
              <Search className="mx-auto mb-2 h-6 w-6 text-[var(--gold)]" />
              <p className="mb-3 text-sm text-secondary">
                Discover what&rsquo;s missing from your world. The Oracle examines your most referenced entities for gaps.
              </p>
              <Button onClick={findBlankSpots} disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Find Lore Holes
              </Button>
            </div>

            {blankSpots.length > 0 && (
              <div className="space-y-3">
                {blankSpots.map((hole, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="glass-panel rounded-[20px] p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-3.5 w-3.5 text-[var(--gold)]" />
                      <span className="text-sm font-medium text-foreground">
                        {hole.entity}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--danger)] mb-1">
                      Missing: {hole.missing}
                    </p>
                    <p className="text-xs text-secondary">
                      <span className="text-[var(--accent)] text-[10px] uppercase tracking-wide mr-1.5 opacity-70">Oracle</span>
                      <span className="italic">{hole.suggestion}</span>
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
