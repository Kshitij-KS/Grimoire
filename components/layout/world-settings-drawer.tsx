"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Globe2,
  Sparkles,
  Clock,
  CreditCard,
  ChevronRight,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { World, UsageMeter } from "@/lib/types";

interface WorldSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  world: World;
  usage: UsageMeter[];
  isDemo?: boolean;
}

const GENRES = ["Fantasy", "Dark Fantasy", "Sci-Fi", "Horror", "Historical", "Mythology", "Steampunk", "Post-Apocalyptic"];
const TONES = ["Dark & Gritty", "Epic", "Melancholic", "Whimsical", "Mysterious", "Hopeful", "Cynical", "Cosmic Horror"];

export function WorldSettingsDrawer({
  open,
  onClose,
  world,
  usage,
  isDemo = false,
}: WorldSettingsDrawerProps) {
  const [tab, setTab] = useState<"world" | "plan">("world");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Editable world fields
  const [name, setName] = useState(world.name);
  const [genre, setGenre] = useState(world.genre ?? "");
  const [tone, setTone] = useState(world.tone ?? "");
  const [premise, setPremise] = useState(world.premise ?? "");

  const resetUTC = (() => {
    const now = new Date();
    const msUntilMidnight =
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).getTime() - now.getTime();
    const h = Math.floor(msUntilMidnight / 3600000);
    const m = Math.floor((msUntilMidnight % 3600000) / 60000);
    return `${h}h ${m}m`;
  })();

  const handleSave = async () => {
    if (isDemo) return;
    setSaving(true);
    try {
      await fetch(`/api/worlds/${world.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, genre, tone, premise }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Failed to save world settings:", e);
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    name !== world.name ||
    genre !== (world.genre ?? "") ||
    tone !== (world.tone ?? "") ||
    premise !== (world.premise ?? "");

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className="fixed left-0 top-0 z-50 flex h-full w-[320px] flex-col glass-panel-elevated border-r border-border shadow-2xl"
            initial={{ x: -340 }}
            animate={{ x: 0 }}
            exit={{ x: -340 }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-secondary">Configure</p>
                <h2 className="font-heading text-2xl text-foreground">World Settings</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl p-1.5 text-secondary transition hover:bg-[rgba(54,44,34,0.4)] hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-4 pt-2">
              {(["world", "plan"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-xs uppercase tracking-widest transition-colors border-b-2 -mb-px ${
                    tab === t
                      ? "border-[var(--gold)] text-[var(--gold)]"
                      : "border-transparent text-secondary hover:text-foreground"
                  }`}
                >
                  {t === "world" ? <Globe2 className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}
                  {t === "world" ? "World" : "Plan"}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <AnimatePresence mode="wait">
                {tab === "world" && (
                  <motion.div
                    key="world"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-4"
                  >
                    {isDemo && (
                      <div className="rounded-[14px] border border-[rgba(196,168,106,0.3)] bg-[rgba(196,168,106,0.08)] px-3 py-2.5 text-xs text-[var(--gold)]">
                        Demo world — settings are read-only.
                      </div>
                    )}

                    {/* World Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-widest text-secondary">World Name</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        readOnly={isDemo}
                        className="w-full rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-foreground placeholder:text-dim focus:border-[var(--violet)] focus:outline-none transition-colors"
                      />
                    </div>

                    {/* Genre */}
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-widest text-secondary">Genre</label>
                      {isDemo ? (
                        <div className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.02)] px-3 py-2 text-sm text-secondary">{genre || "—"}</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {GENRES.map((g) => (
                            <button
                              key={g}
                              onClick={() => setGenre(g === genre ? "" : g)}
                              className={`rounded-[10px] px-2.5 py-1 text-xs transition-all border ${
                                genre === g
                                  ? "border-[var(--violet)] bg-[rgba(126,109,242,0.18)] text-[var(--violet-soft)]"
                                  : "border-border text-secondary hover:border-[var(--violet)]33 hover:text-foreground"
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Tone */}
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-widest text-secondary">Tone</label>
                      {isDemo ? (
                        <div className="rounded-[12px] border border-border bg-[rgba(255,255,255,0.02)] px-3 py-2 text-sm text-secondary">{tone || "—"}</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {TONES.map((t) => (
                            <button
                              key={t}
                              onClick={() => setTone(t === tone ? "" : t)}
                              className={`rounded-[10px] px-2.5 py-1 text-xs transition-all border ${
                                tone === t
                                  ? "border-[var(--gold)] bg-[rgba(196,168,106,0.18)] text-[var(--gold)]"
                                  : "border-border text-secondary hover:border-[var(--gold)]33 hover:text-foreground"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Premise */}
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase tracking-widest text-secondary">Premise</label>
                      <textarea
                        value={premise}
                        onChange={(e) => setPremise(e.target.value)}
                        readOnly={isDemo}
                        rows={4}
                        placeholder="The world's core premise and setting..."
                        className="w-full resize-none rounded-[12px] border border-border bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-foreground placeholder:text-dim focus:border-[var(--violet)] focus:outline-none transition-colors"
                      />
                    </div>
                  </motion.div>
                )}

                {tab === "plan" && (
                  <motion.div
                    key="plan"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-4"
                  >
                    {/* Current Plan */}
                    <div className="rounded-[16px] border border-[rgba(126,109,242,0.3)] bg-[rgba(126,109,242,0.08)] p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-[var(--violet-soft)]" />
                        <span className="text-sm font-medium text-foreground">
                          {isDemo ? "Demo" : "Free"} Plan
                        </span>
                      </div>
                      <p className="text-xs text-secondary leading-5">
                        {isDemo
                          ? "You're viewing the demo world. Sign up free to create your own."
                          : "1 world · 3 souls · 50 lore entries · 5 consistency checks/day"}
                      </p>
                      {!isDemo && (
                        <button className="mt-3 flex w-full items-center justify-between rounded-[12px] border border-[rgba(196,168,106,0.3)] bg-[rgba(196,168,106,0.08)] px-3 py-2.5 text-xs text-[var(--gold)] transition hover:border-[var(--gold)]55">
                          <span>Upgrade to Pro</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Daily Usage */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-widest text-secondary">Today&apos;s Usage</p>
                        <div className="flex items-center gap-1 text-[10px] text-dim">
                          <Clock className="h-3 w-3" />
                          Resets in {resetUTC}
                        </div>
                      </div>
                      {usage.map((meter) => {
                        const pct = Math.min((meter.count / meter.limit) * 100, 100);
                        const isWarning = pct >= 80;
                        return (
                          <div key={meter.action} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-secondary capitalize">
                                {meter.action.replace(/_/g, " ")}
                              </span>
                              <span className={isWarning ? "text-[var(--gold)]" : "text-dim"}>
                                {meter.count} / {meter.limit}
                              </span>
                            </div>
                            <div className="h-1 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                style={{
                                  background: isWarning
                                    ? "rgb(212,168,83)"
                                    : "rgba(126,109,242,0.7)",
                                }}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer — save button only on world tab, non-demo */}
            {tab === "world" && !isDemo && (
              <div className="border-t border-border p-4">
                <Button
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="w-full"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : saved ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : null}
                  {saved ? "Saved" : "Save Changes"}
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
