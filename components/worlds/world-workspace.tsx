"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { WorldSidebar } from "@/components/layout/world-sidebar";
import { ArchiveWorkspace } from "@/components/bible/archive-workspace";
import { FractureLens } from "@/components/consistency/fracture-lens";
import { EchoesInterface } from "@/components/echoes/echoes-interface";
import { LoomEditor } from "@/components/lore/loom-editor";
import { RateLimitModal } from "@/components/shared/rate-limit-modal";
import { CommandPalette } from "@/components/shared/command-palette";
import { TapestryTimeline } from "@/components/tapestry/tapestry-timeline";
import { TavernChat } from "@/components/tavern/tavern-chat";
import { NarratorTools } from "@/components/narrator/narrator-tools";
import { SoulCard } from "@/components/souls/soul-card";
import { SoulCardPanel } from "@/components/souls/soul-card-panel";
import { SoulCreationModal } from "@/components/souls/soul-creation-modal";
import { DestructiveActionModal } from "@/components/shared/destructive-action-modal";
import { Button } from "@/components/ui/button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/shared/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionLoadingScreen } from "@/components/shared/loading-shimmer";
import { useWorkspaceStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { FREE_TIER_LIMITS } from "@/lib/constants";
import type { ConsistencyCheck, Entity, EntityRelationship, Soul, UsageMeter, WorldWorkspaceData } from "@/lib/types";

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
  const pathname = usePathname();
  const { limitModal, hideLimitModal, forgeSoulName, setForgeSoulName, selectedEntity } = useWorkspaceStore();
  const [soulModalOpen, setSoulModalOpen] = useState(false);
  const [activeSoulId, setActiveSoulId] = useState<string | null>(null);
  const [activeSoulCardId, setActiveSoulCardId] = useState<string | null>(null);
  const [souls, setSouls] = useState<Soul[]>(data.souls);
  const [entities, setEntities] = useState<Entity[]>(data.entities);
  const [relationships, setRelationships] = useState<EntityRelationship[]>(data.relationships);
  const [deletingSoulId, setDeletingSoulId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isRefreshingArchive, setIsRefreshingArchive] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(() => new Date().toISOString());
  const [archiveRefreshCount, setArchiveRefreshCount] = useState(0);
  const [prefillDesc, setPrefillDesc] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageMeter[]>(data.usage);

  const incrementUsage = useCallback((action: string) => {
    setUsage((prev) =>
      prev.map((m) => (m.action === action ? { ...m, count: m.count + 1 } : m))
    );
  }, []);

  const suggestedCharacters = useMemo(() => {
    return entities.filter(e => 
      e.type === "character" && 
      !souls.some(s => s.name.toLowerCase() === e.name.toLowerCase())
    );
  }, [entities, souls]);

  const activeSoul = souls.find((s) => s.id === activeSoulId) ?? null;
  const activeSoulCard = souls.find((s) => s.id === activeSoulCardId) ?? null;
  const deletingSoul = souls.find((s) => s.id === deletingSoulId) ?? null;
  const meta = SECTION_META[data.activeSection] ?? SECTION_META.lore;
  const structuredSection = data.activeSection === "lore" || data.activeSection === "consistency" || data.activeSection === "tapestry" || data.activeSection === "narrator";
  const isDemo = data.world.is_demo ?? false;

  // Simulate loading on section change for "perceived performance" and skeletal demo
  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 400);
    return () => clearTimeout(timer);
  }, [data.activeSection]);

  // Incremental archive refresh — only fetches entities updated since last refresh
  const refreshArchive = useCallback(async () => {
    if (isDemo || isRefreshingArchive) return;
    setIsRefreshingArchive(true);
    try {
      const res = await fetch(
        `/api/entities?worldId=${data.world.id}&since=${encodeURIComponent(lastRefreshed)}`
      );
      if (!res.ok) return;
      const json = await res.json() as { entities: Entity[] };
      if (json.entities && json.entities.length > 0) {
        setEntities((prev) => {
          const incoming = json.entities as Entity[];
          const map = new Map(prev.map((e) => [e.id, e]));
          for (const e of incoming) map.set(e.id, e);
          return Array.from(map.values());
        });
        setArchiveRefreshCount((n) => n + json.entities.length);
      }
      setLastRefreshed(new Date().toISOString());
    } catch {
      // silent fail — archive still shows existing data
    } finally {
      setIsRefreshingArchive(false);
    }
  }, [data.world.id, isDemo, isRefreshingArchive, lastRefreshed]);

  const breadcrumbs: BreadcrumbItem[] = [
    { label: data.world.name, href: `/dashboard` }, // Or just some root
    { 
      label: meta.label, 
      active: !activeSoul && !selectedEntity,
      href: activeSoul || selectedEntity ? undefined : undefined // Can click to reset if we had a dedicated handler
    }
  ];

  if (data.activeSection === "souls" && activeSoul) {
    breadcrumbs[1].href = pathname + "?section=souls";
    breadcrumbs.push({ label: activeSoul.name, active: true });
  } else if (data.activeSection === "bible" && selectedEntity) {
    breadcrumbs[1].href = pathname + "?section=bible";
    breadcrumbs.push({ label: selectedEntity.name, active: true });
  }

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

  return (
    <div className="relative min-h-screen pb-20 lg:pb-6">
      <div className="mx-auto max-w-[1560px] px-4 pt-4 lg:px-6 lg:pt-6">
        <div className="flex gap-5 items-start">
          <WorldSidebar
            world={data.world}
            usage={usage}
            activeSection={data.activeSection}
            isDemo={isDemo}
          />
          <main className="flex-1 min-w-0">
        <header className="glass-panel mb-6 flex flex-col gap-4 rounded-[18px] px-6 py-5 lg:flex-row lg:items-center lg:justify-between border border-border/50">
          <div className="space-y-4 min-w-0">
            <Breadcrumbs items={breadcrumbs} className="opacity-80" />
            <div className="flex items-baseline gap-3">
              <h1 className="font-heading text-3xl sm:text-4xl text-foreground tracking-tight truncate max-w-full lg:max-w-xl">
                {activeSoul ? activeSoul.name : (selectedEntity ? selectedEntity.name : data.world.name)}
              </h1>
              <span className="chapter-label text-xs opacity-40 uppercase tracking-[0.3em] font-bold">
                {activeSoul ? "Echo" : (selectedEntity ? "Dossier" : meta.subtitle)}
              </span>
            </div>
            {isTransitioning ? (
              <div className="space-y-2 py-1">
                <Skeleton className="h-4 w-[85%]" />
                <Skeleton className="h-4 w-[60%]" />
              </div>
            ) : (
              <p className="max-w-3xl text-sm leading-7 text-secondary/80 animate-in fade-in slide-in-from-left-2 duration-500 line-clamp-2 lg:line-clamp-none">
                {activeSoul ? `Listening to the echoes of ${activeSoul.name}. Forge their destiny through your dialogue.` : meta.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {isDemo ? (
              <Button variant="ghost" asChild className="rounded-2xl border border-border/50 bg-background/20 hover:bg-background/40">
                <Link href="/auth?mode=signup">
                  <Sparkles className="h-4 w-4 text-[var(--accent-soft)]" />
                  Sign up free
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" asChild className="rounded-lg border border-border/50 bg-background/20 hover:bg-background/40">
                <Link href="/dashboard">
                  <ArrowLeft className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            )}
            {data.activeSection === "souls" && !data.isReadonly && !activeSoul ? (
              <Button onClick={() => setSoulModalOpen(true)}>
                <Sparkles className="h-4 w-4" />
                Forge Soul
              </Button>
            ) : null}
          </div>
        </header>

        <AnimatePresence mode="wait">
          {isTransitioning ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <SectionLoadingScreen
                label={meta.label}
                subtitle={meta.subtitle}
              />
            </motion.div>
          ) : (
            <motion.div
              key={data.activeSection}
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="relative z-10"
            >
            {data.activeSection === "lore" ? (
              <div className={cn("relative h-[calc(100vh-230px)]", structuredSection ? "mx-auto max-w-[1100px]" : "")}>
                <LoomEditor worldId={data.world.id} initialEntries={data.loreEntries} isReadonly={data.isReadonly} onUsageIncrement={incrementUsage} />
              </div>
            ) : null}

            {data.activeSection === "bible" ? (
              <div className="relative h-[calc(100vh-230px)]">
                <ArchiveWorkspace
                  worldId={data.world.id}
                  entities={entities}
                  relationships={relationships}
                  souls={souls}
                  isReadonly={data.isReadonly}
                  isDemo={isDemo}
                  isRefreshing={isRefreshingArchive}
                  refreshCount={archiveRefreshCount}
                  lastRefreshed={lastRefreshed}
                  onRefresh={refreshArchive}
                  onForgeRelationship={(newRel) => setRelationships(prev => [...prev, newRel])}
                  onDeleteRelationship={(relId) => setRelationships(prev => prev.filter(r => r.id !== relId))}
                  onCreateSoul={(name) => {
                    setForgeSoulName(name);
                    // Navigate to souls section
                    const url = new URL(window.location.href);
                    url.searchParams.set("section", "souls");
                    window.history.pushState({}, "", url.toString());
                  }}
                  canCreateSoul={souls.length < FREE_TIER_LIMITS.soulsPerWorld}
                  onEntityCreated={(entity) => setEntities((prev) => [entity, ...prev])}
                  onEntityMerged={(sourceId, updatedTarget) =>
                    setEntities((prev) =>
                      prev
                        .filter((e) => e.id !== sourceId)
                        .map((e) => (e.id === updatedTarget.id ? updatedTarget : e)),
                    )
                  }
                />
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

                    {suggestedCharacters.length > 0 && !data.isReadonly && (
                      <div className="mb-8 overflow-hidden rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] shadow-sm">
                        <div className="flex h-8 items-center border-b border-[color-mix(in_srgb,var(--accent)_15%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-4">
                          <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-[color-mix(in_srgb,var(--accent)_80%,white)] flex items-center gap-1.5 opacity-90">
                            <Sparkles className="h-3 w-3" /> Suggestions from ingested lore
                          </span>
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {suggestedCharacters.map(char => (
                            <button
                              key={char.id}
                              onClick={() => {
                                setForgeSoulName(char.name);
                                setPrefillDesc(char.summary ?? "");
                                setSoulModalOpen(true);
                              }}
                              className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition-all hover:border-[color-mix(in_srgb,var(--accent)_40%,transparent)] hover:text-[var(--text-main)] hover:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] active:scale-[0.98]"
                            >
                              {char.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {souls.map((soul) => (
                        <SoulCard
                          key={soul.id}
                          soul={soul}
                          worldId={data.world.id}
                          isDemo={isDemo}
                          onChat={() => setActiveSoulId(soul.id)}
                          onView={() => setActiveSoulCardId(soul.id)}
                          onDelete={setDeletingSoulId}
                        />
                      ))}

                      {!data.isReadonly ? (
                        <motion.button
                          type="button"
                          onClick={() => setSoulModalOpen(true)}
                          whileHover={{ y: -4, scale: 1.01 }}
                          transition={{ type: "spring", stiffness: 340, damping: 24 }}
                          className="glass-panel relative flex min-h-[240px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--ai-pulse)_35%,transparent)] text-center transition-shadow hover:border-[color-mix(in_srgb,var(--ai-pulse)_55%,transparent)] hover:shadow-arcane-glow"
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
                          <Sparkles className="mb-4 h-8 w-8 text-[var(--accent-soft)]" />
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
                <TapestryTimeline worldId={data.world.id} isDemo={isDemo} />
              </div>
            ) : null}

            {data.activeSection === "tavern" ? (
              <TavernChat worldId={data.world.id} souls={souls} />
            ) : null}

            {data.activeSection === "narrator" ? (
              <div className="mx-auto max-w-[980px]">
                <NarratorTools worldId={data.world.id} isDemo={isDemo} />
              </div>
            ) : null}
          </motion.div>
        )}
        </AnimatePresence>
          </main>
        </div>
      </div>

      <SoulCreationModal
        open={soulModalOpen || !!forgeSoulName}
        onOpenChange={(open) => {
          setSoulModalOpen(open);
          if (!open) {
            setForgeSoulName(null);
            setPrefillDesc(null);
          }
        }}
        worldId={data.world.id}
        prefillName={forgeSoulName ?? undefined}
        prefillDescription={prefillDesc ?? undefined}
        onCreated={(newSoul) => {
          if (newSoul) {
            setSouls((prev) => [...prev, newSoul]);
            incrementUsage("soul_generate");
          }
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
        entities={entities}
        souls={souls}
        loreEntries={data.loreEntries}
      />
      {activeSoulCard ? (
        <SoulCardPanel
          soul={activeSoulCard}
          worldId={data.world.id}
          onClose={() => setActiveSoulCardId(null)}
          onRegenerated={(updatedSoul) =>
            setSouls((current) => current.map((soul) => (soul.id === updatedSoul.id ? updatedSoul : soul)))
          }
        />
      ) : null}
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
