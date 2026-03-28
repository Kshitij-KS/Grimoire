"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  BookOpenText,
  ChevronRight,
  Compass,
  MessagesSquare,
  ShieldAlert,
  Stars,
  Sparkles,
  Eye,
} from "lucide-react";
import { GrimoireLogo } from "@/components/shared/grimoire-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SoulChatPreview } from "@/components/landing/soul-chat-preview";

// ─── Static data ─────────────────────────────────────────────────────────────

const features = [
  {
    icon: BookOpenText,
    title: "Lore that remembers",
    subtitle: "The Loom",
    description:
      "Write scenes, rules, factions, and history in a calm editor that turns raw pages into searchable world memory — embedded and indexed as you type.",
    accentColor: "rgba(196,168,106,",
  },
  {
    icon: MessagesSquare,
    title: "Souls with boundaries",
    subtitle: "Echoes",
    description:
      "Forge characters into living personas whose voices, secrets, and blind spots come directly from the canon you have written — not from what you imagine.",
    accentColor: "rgba(126,109,242,",
  },
  {
    icon: ShieldAlert,
    title: "Canon under watch",
    subtitle: "Fracture Lens",
    description:
      "Check new writing against established lore. The archive flags contradictions before they become invisible mistakes that haunt your third act.",
    accentColor: "rgba(192,74,74,",
  },
];

const pillars = [
  { icon: Sparkles, label: "Living memory",       value: "Vector-backed lore recall" },
  { icon: MessagesSquare, label: "Character voice",    value: "Persona from your canon" },
  { icon: Eye,       label: "Creative safety",    value: "Contradiction detection" },
];

// ─── Animation variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.11, delayChildren: 0.05 } },
};

const lineVariants = {
  hidden: { clipPath: "inset(0 100% 0 0)", opacity: 0 },
  visible: {
    clipPath: "inset(0 0% 0 0)",
    opacity: 1,
    transition: { duration: 0.72, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};


// ─── Feature card sub-component ───────────────────────────────────────────────

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[number];
  index: number;
}) {
  const Icon = feature.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.45, delay: index * 0.1, ease: "easeOut" }}
      whileHover={{ y: -5 }}
    >
      <Card
        className="group h-full rounded-2xl p-7 transition-all duration-300"
        style={{
          borderColor: `${feature.accentColor}0.08)`,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = `${feature.accentColor}0.28)`;
          (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 40px ${feature.accentColor}0.14)`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = `${feature.accentColor}0.08)`;
          (e.currentTarget as HTMLElement).style.boxShadow = "";
        }}
      >
        <motion.div
          className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border"
          style={{
            borderColor: `${feature.accentColor}0.22)`,
            background: `${feature.accentColor}0.1)`,
          }}
          whileHover={{ scale: 1.15, rotate: 5 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
        >
          <Icon
            className="h-5 w-5 transition-colors duration-200"
            style={{ color: `${feature.accentColor}0.85)` }}
          />
        </motion.div>
        <p className="chapter-label">{feature.subtitle}</p>
        <h3 className="mt-3 font-heading text-3xl text-foreground">{feature.title}</h3>
        <p className="mt-4 text-sm leading-7 text-secondary">{feature.description}</p>
      </Card>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const heroInView = useInView(heroRef, { once: true });

  return (
    <main className="relative overflow-hidden">
      {/* Global grid overlay */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative border-b border-border">
        {/* Radial ambient behind hero */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 30% 40%, rgba(126,109,242,0.09), transparent 60%), radial-gradient(ellipse 50% 40% at 75% 30%, rgba(196,168,106,0.06), transparent 55%)",
          }}
        />

        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 pb-16 pt-6 lg:px-10">
          {/* Nav */}
          <header className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <GrimoireLogo />
            </motion.div>
            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            >
              <Button variant="ghost" asChild className="hidden sm:flex">
                <Link href="/demo">See Demo World</Link>
              </Button>
              <Button asChild>
                <Link href="/auth">Begin Writing</Link>
              </Button>
            </motion.div>
          </header>

          {/* Two-column hero grid */}
          <div
            ref={heroRef}
            className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16"
          >
            {/* ── LEFT: headline + CTAs ─────────────────── */}
            <div className="space-y-8">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.06 }}
                className="w-fit"
              >
                <Badge variant="outline" className="gap-2 px-3 py-1.5">
                  <Stars className="h-3.5 w-3.5 text-[rgb(196,168,106)]" />
                  Premium worldbuilding for fiction writers and game masters
                </Badge>
              </motion.div>

              {/* Headline — line-by-line ink reveal */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate={heroInView ? "visible" : "hidden"}
                className="space-y-1"
              >
                <motion.h1
                  variants={lineVariants}
                  className="font-heading text-6xl leading-[0.95] text-foreground md:text-7xl"
                >
                  Your World
                </motion.h1>
                <motion.h1
                  variants={lineVariants}
                  className="font-heading text-6xl leading-[0.95] text-foreground md:text-7xl"
                >
                  Has Rules.
                </motion.h1>
                <motion.h1
                  variants={lineVariants}
                  className="font-heading text-6xl leading-[0.95] md:text-7xl"
                >
                  <span className="gold-shimmer">Now It Has a Memory.</span>
                </motion.h1>
              </motion.div>

              {/* Sub-copy */}
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.7, ease: "easeOut" }}
                className="max-w-xl text-lg leading-8 text-secondary"
              >
                Grimoire is a creative worldbuilding platform for writers and game masters who
                need lore, structure, and character voice to live together — without compromise.
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.84, ease: "easeOut" }}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" asChild className="w-full sm:w-auto">
                    <Link href="/auth">
                      Begin Writing
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" variant="secondary" asChild className="w-full sm:w-auto">
                    <Link href="/demo">Explore Ashveil</Link>
                  </Button>
                </motion.div>
              </motion.div>

              {/* Pillar cards */}
              <motion.div
                className="grid gap-3 sm:grid-cols-3"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 1.0, ease: "easeOut" }}
              >
                {pillars.map((pillar) => {
                  const Icon = pillar.icon;
                  return (
                    <motion.div
                      key={pillar.label}
                      whileHover={{ y: -4, boxShadow: "0 16px 36px rgba(126,109,242,0.18)" }}
                      transition={{ type: "spring", stiffness: 340, damping: 22 }}
                      className="group"
                    >
                      <Card className="rounded-xl p-5 transition-all duration-200 hover:border-[rgba(165,148,255,0.28)]"
                      >
                        <Icon className="mb-2 h-4 w-4 text-[rgba(196,168,106,0.7)] transition-transform duration-300 group-hover:scale-110 group-hover:text-[rgba(196,168,106,1)]" />
                        <p className="chapter-label">{pillar.label}</p>
                        <p className="mt-2 font-heading text-xl text-foreground">{pillar.value}</p>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>

            {/* ── RIGHT: animated soul chat preview ────── */}
            <motion.div
              initial={{ opacity: 0, y: 34, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              {/* Ambient glow behind card */}
              <div
                className="pointer-events-none absolute -inset-8 rounded-full opacity-40 blur-3xl"
                style={{
                  background:
                    "radial-gradient(circle, rgba(126,109,242,0.18), rgba(196,168,106,0.08), transparent 70%)",
                }}
              />
              {/* Floating decorative rune */}
              <motion.span
                className="pointer-events-none absolute -right-3 -top-4 font-heading text-3xl opacity-20 select-none"
                animate={{ y: [-4, 4, -4], rotate: [-4, 4, -4] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                style={{ color: "rgba(165,148,255,0.6)" }}
              >ᚦ</motion.span>
              <motion.span
                className="pointer-events-none absolute -left-4 bottom-8 font-heading text-2xl opacity-15 select-none"
                animate={{ y: [4, -4, 4], rotate: [3, -3, 3] }}
                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                style={{ color: "rgba(196,168,106,0.5)" }}
              >ᚠ</motion.span>

              <div className="arcane-border glass-panel-elevated relative overflow-hidden rounded-2xl p-6">
                <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.15]" />
                <div className="relative space-y-5">
                  {/* World header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="chapter-label">Demo world</p>
                      <h2 className="font-heading text-5xl text-foreground">Ashveil</h2>
                    </div>
                    <motion.div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(165,148,255,0.22)] bg-[rgba(126,109,242,0.14)]"
                      whileHover={{ scale: 1.08, rotate: 12 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <Compass className="h-5 w-5 text-[rgb(196,205,242)]" />
                    </motion.div>
                  </div>

                  {/* Live soul chat preview */}
                  <SoulChatPreview />

                  {/* Entity badges strip */}
                  <div>
                    <p className="chapter-label mb-2">Detected entities</p>
                    <div className="flex flex-wrap gap-2">
                      {["Mira Ashveil", "Ember Bridge", "Lantern Spirits", "The Hollow Glass"].map((item, i) => (
                        <motion.div
                          key={item}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: 1.2 + i * 0.1 }}
                        >
                          <Badge className="text-[10px] transition-all duration-200 hover:border-[rgba(165,148,255,0.4)] hover:bg-[rgba(165,148,255,0.08)]">{item}</Badge>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="mb-14 max-w-3xl space-y-4"
        >
          <p className="chapter-label">Built for worldbuilders</p>
          <h2 className="font-heading text-5xl text-foreground">
            Deep enough for a private canon.{" "}
            <span className="text-secondary">Clear enough to write in every day.</span>
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-secondary">
            The product stays atmospheric, but the work stays legible — writing, browsing, chatting,
            and checking continuity all happen inside one coherent creative system.
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </section>

      {/* ── CTA BLOCK ─────────────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden"
          >
            {/* Radial glow from center */}
            <div
              className="pointer-events-none absolute inset-0 rounded-[36px]"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(126,109,242,0.12), rgba(196,168,106,0.04) 50%, transparent 70%)",
              }}
            />
            <div className="glass-panel-elevated arcane-border relative flex flex-col gap-8 rounded-2xl p-10 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-4">
                <p className="chapter-label">Begin the first chapter</p>
                <h2 className="max-w-xl font-heading text-5xl text-foreground">
                  Make your canon feel alive without losing control of it.
                </h2>
                <p className="max-w-md text-sm leading-7 text-secondary">
                  One world on free tier, three souls, and enough daily room to test whether
                  Grimoire fits the way you think and write.
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2">
                  {["Free forever tier", "No credit card", "Cancel anytime"].map((perk, i) => (
                    <motion.span
                      key={perk}
                      className="flex items-center gap-1.5 text-xs text-secondary"
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: 0.1 + i * 0.1, ease: "easeOut" }}
                    >
                      <span className="text-[rgba(92,180,145,0.85)]">✓</span>
                      {perk}
                    </motion.span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" asChild className="w-full sm:w-auto">
                    <Link href="/auth">Begin Writing</Link>
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }}>
                  <Button size="lg" variant="secondary" asChild className="w-full sm:w-auto">
                    <Link href="/demo">Explore Ashveil</Link>
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer className="relative border-t border-border overflow-hidden">
        {/* subtle footer ambient */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 60% 80% at 50% 100%, rgba(126,109,242,0.06), transparent 70%)",
          }}
        />
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-10 relative">
          <div className="space-y-2">
            <GrimoireLogo className="origin-left scale-90" />
            <p className="text-xs text-dim max-w-xs">
              A living archive for worldbuilders who take their lore seriously.
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm text-secondary">
            <Link href="/auth" className="link-underline transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Link href="/demo" className="link-underline transition-colors hover:text-foreground">
              Demo world
            </Link>
            <span className="h-4 w-px bg-border" />
            <span className="text-xs text-dim">
              © {new Date().getFullYear()} Grimoire
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
