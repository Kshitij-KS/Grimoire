"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { WorldSidebar } from "@/components/layout/world-sidebar";
import { ConstellationCanvas } from "@/components/bible/constellation-canvas";
import { ConstellationDossier } from "@/components/bible/constellation-dossier";
import { EntityGrid } from "@/components/bible/entity-grid";
import { FractureLens } from "@/components/consistency/fracture-lens";
import { EchoesInterface } from "@/components/echoes/echoes-interface";
import { LoomEditor } from "@/components/lore/loom-editor";
import { RateLimitModal } from "@/components/shared/rate-limit-modal";
import { CommandPalette } from "@/components/shared/command-palette";
import { TapestryTimeline } from "@/components/tapestry/tapestry-timeline";
import { TavernChat } from "@/components/tavern/tavern-chat";
import { NarratorTools } from "@/components/narrator/narrator-tools";
import { SoulCard } from "@/components/souls/soul-card";
import { SoulCreationModal } from "@/components/souls/soul-creation-modal";
import { DestructiveActionModal } from "@/components/shared/destructive-action-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspaceStore } from "@/lib/store";
import type { ConsistencyCheck, Soul, WorldWorkspaceData } from "@/lib/types";

const SECTION_META: Record<string, { label: string; subtitle: string; description: string }> = {
  lore: {
    label: "Lore",
    subtitle: "The Loom",
    description: "Write inside the archive and let the world absorb what matters.",
  },
  bible: {
    label: "World Bible",
    subtitle: "Constellation",
    description: "Browse the living map of entities, relationships, and recurring lore.",
  },
  souls: {
    label: "Souls",
    subtitle: "Echoes",
    description: "Forge characters into bounded voices, then speak with them directly.",
  },
  consistency: {
    label: "Consistency",
    subtitle: "Fracture Lens",
    description: "Check new scenes against canon before contradictions take root.",
  },
  tapestry: {
    label: "Timeline",
    subtitle: "The Tapestry",
    description: "Events of your world arranged chronologically by the Oracle.",
  },
  tavern: {
    label: "Tavern",
    subtitle: "The Gathering",
    description: "Gather your souls together and watch them speak, argue, and reveal.",
  },
  narrator: {
    label: "Tools",
    subtitle: "The Narrator",
    description: "Analyze what-if scenarios, find lore holes, and explore your world's depth.",
  },
};

export function WorldWorkspace({
  data,
  checks = [],
}: {
  data: WorldWorkspaceData;
  checks?: ConsistencyCheck[];
}) {
  const { limitModal, hideLimitModal, forgeSoulName, setForgeSoulName } = useWorkspaceStore();
  const [soulModalOpen, setSoulModalOpen] = useState(false);
  const [activeSoulId, setActiveSoulId] = useState<string | null>(null);
  const [souls, setSouls] = useState<Soul[]>(data.souls);
  const [entities, setEntities] = useState<Entity[]>(data.entities);
  const [deletingSoulId, setDeletingSoulId] = useState<string | null>(null);

  const activeSoul = souls.find((s) => s.id === activeSoulId) ?? null;
  const deletingSoul = souls.find((s) => s.id === deletingSoulId) ?? null;
  const meta = SECTION_META[data.activeSection] ?? SECTION_META.lore;
  const structuredSection = data.activeSection === "lore" || data.activeSection === "consistency" || data.activeSection === "tapestry" || data.activeSection === "narrator";

  const handleDeleteSoul = async () => {
    if (!deletingSoulId) return;
    try {
      const res = await fetch(`/api/souls/${deletingSoulId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete soul.");
      setSouls((prev) => prev.filter((s) => s.id !== deletingSoulId));
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingSoulId(null);
    }
  };

  const isDemo = data.world.is_demo ?? false;

  return (
    <div className="relative min-h-screen pb-20 lg:pb-6">
      <div className="mx-auto max-w-[1560px] px-4 pt-4 lg:px-6 lg:pt-6">
        <div className="flex gap-5 items-start">
          <WorldSidebar
            world={data.world}
            usage={data.usage}
            activeSection={data.activeSection}
            isDemo={isDemo}
          />
          <main className="flex-1 min-w-0">
        <header className="glass-panel mb-6 flex flex-col gap-4 rounded-[30px] px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">{meta.label}</Badge>
              <span className="chapter-label">{meta.subtitle}</span>
            </div>
            <div>
              <h1 className="font-heading text-5xl text-foreground">{data.world.name}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-secondary">{meta.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isDemo ? (
              <Button variant="ghost" asChild>
                <Link href="/auth?mode=signup">
                  <Sparkles className="h-4 w-4" />
                  Sign up free
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            )}
            {data.activeSection === "souls" && !data.isReadonly ? (
              <Button onClick={() => setSoulModalOpen(true)}>
                <Sparkles className="h-4 w-4" />
                Forge Soul
              </Button>
            ) : null}
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={data.activeSection}
            initial={{ opacity: 0, x: 20, filter: "blur(6px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: -20, filter: "blur(6px)" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative z-10"
          >
            {data.activeSection === "lore" ? (
              <div className={structuredSection ? "mx-auto max-w-[1100px]" : ""}>
                <LoomEditor worldId={data.world.id} initialEntries={data.loreEntries} isReadonly={data.isReadonly} />
              </div>
            ) : null}

            {data.activeSection === "bible" ? (
              <div className="relative h-[calc(100vh-230px)] overflow-hidden rounded-[34px] border border-border bg-[rgba(17,21,33,0.52)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-between px-6 py-5">
                  <div className="glass-panel rounded-[22px] px-4 py-3">
                    <p className="chapter-label">World Bible</p>
                    <p className="mt-1 text-sm text-secondary">
                      Explore the constellation, then open a dossier to read the archive.
                    </p>
                  </div>
                </div>
                <ConstellationCanvas entities={entities} />
                <AnimatePresence>
                  <ConstellationDossier worldId={data.world.id} allEntities={entities} />
                </AnimatePresence>
                <div className="sr-only">
                  <EntityGrid
                    entities={entities}
                    souls={souls}
                    worldId={data.world.id}
                    onSoulCreated={(newSoul) => setSouls((prev) => [...prev, newSoul])}
                    onEntityUpdate={(updated) => setEntities(prev => prev.map(e => e.id === updated.id ? updated : e))}
                    onEntityDelete={(id) => setEntities(prev => prev.filter(e => e.id !== id))}
                    isReadonly={data.isReadonly}
                  />
                </div>
              </div>
            ) : null}

            {data.activeSection === "souls" ? (
              <AnimatePresence mode="wait">
                {activeSoul ? (
                  <motion.div
                    key={activeSoul.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <EchoesInterface soul={activeSoul} worldId={data.world.id} onBack={() => setActiveSoulId(null)} isDemo={isDemo} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="souls-grid"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mx-auto max-w-5xl pb-10"
                  >
                    <div className="mb-8 flex flex-col gap-2">
                      <p className="chapter-label">Souls • Echoes</p>
                      <h2 className="font-heading text-4xl text-foreground">Bound voices within {data.world.name}</h2>
                      <p className="max-w-3xl text-sm leading-7 text-secondary">
                        Forge characters into bounded voices from your world&apos;s lore. Then speak with them directly.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {souls.map((soul) => (
                        <SoulCard
                          key={soul.id}
                          soul={soul}
                          worldId={data.world.id}
                          isDemo={isDemo}
                          onView={() => setActiveSoulId(soul.id)}
                          onDelete={setDeletingSoulId}
                        />
                      ))}

                      {!data.isReadonly ? (
                        <motion.button
                          type="button"
                          onClick={() => setSoulModalOpen(true)}
                          whileHover={{ y: -4, scale: 1.01 }}
                          transition={{ type: "spring", stiffness: 340, damping: 24 }}
                          className="glass-panel relative flex min-h-[240px] flex-col items-center justify-center overflow-hidden rounded-[30px] border border-dashed border-[rgba(124,92,191,0.35)] text-center transition-shadow hover:border-[rgba(124,92,191,0.55)] hover:shadow-arcane-glow"
                        >
                          {/* Rotating rune glyphs at corners */}
                          {["ᚠ", "ᚢ", "ᚦ", "ᚨ"].map((rune, i) => (
                            <span
                              key={i}
                              className="rune-float pointer-events-none absolute select-none font-heading text-2xl opacity-[0.08]"
                              style={{
                                top: i < 2 ? "1rem" : "auto",
                                bottom: i >= 2 ? "1rem" : "auto",
                                left: i % 2 === 0 ? "1rem" : "auto",
                                right: i % 2 === 1 ? "1rem" : "auto",
                                animationDelay: `${i * 3}s`,
                              }}
                              aria-hidden
                            >
                              {rune}
                            </span>
                          ))}
                          <Sparkles className="mb-4 h-8 w-8 text-[rgb(196,168,106)]" />
                          <p className="font-heading text-3xl text-foreground">Forge a new soul</p>
                          <p className="mt-2 max-w-xs text-sm text-secondary">
                            Create a bounded persona from what your world already knows.
                          </p>
                        </motion.button>
                      ) : null}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            ) : null}

            {data.activeSection === "consistency" ? (
              <div className="mx-auto max-w-[980px]">
                <FractureLens
                  worldId={data.world.id}
                  initialFlags={data.flags}
                  initialChecks={checks}
                  isReadonly={data.isReadonly}
                  isDemo={data.world.is_demo ?? false}
                />
              </div>
            ) : null}

            {data.activeSection === "tapestry" ? (
              <div className="mx-auto max-w-[980px]">
                <TapestryTimeline worldId={data.world.id} />
              </div>
            ) : null}

            {data.activeSection === "tavern" ? (
              <TavernChat worldId={data.world.id} souls={souls} />
            ) : null}

            {data.activeSection === "narrator" ? (
              <div className="mx-auto max-w-[980px]">
                <NarratorTools worldId={data.world.id} />
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
          </main>
        </div>
      </div>

      <SoulCreationModal
        open={soulModalOpen || !!forgeSoulName}
        onOpenChange={(open) => {
          setSoulModalOpen(open);
          if (!open) setForgeSoulName(null);
        }}
        worldId={data.world.id}
        prefillName={forgeSoulName ?? undefined}
        onCreated={(newSoul) => {
          if (newSoul) setSouls((prev) => [...prev, newSoul]);
        }}
      />

      <RateLimitModal
        open={limitModal.open}
        onOpenChange={(open) => (open ? undefined : hideLimitModal())}
        action={limitModal.action}
        limit={limitModal.limit}
      />

      <CommandPalette
        worldId={data.world.id}
        entities={data.entities}
        souls={souls}
        loreEntries={data.loreEntries}
      />
      <DestructiveActionModal
        open={!!deletingSoulId}
        onOpenChange={(open) => !open && setDeletingSoulId(null)}
        title="Destroy Soul"
        description={`Are you sure you want to permanently delete the soul of ${deletingSoul?.name}? All their memories and chat history will be erased from the world.`}
        requireString={`delete ${deletingSoul?.name}`}
        onConfirm={handleDeleteSoul}
        isDemo={isDemo}
      />
    </div>
  );
}
