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
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { SoulChatPreview } from "@/components/landing/soul-chat-preview";
import { SocialProofStrip } from "@/components/landing/social-proof-strip";
import { useScrollY } from "@/lib/hooks/use-scroll-y";

// ─── Static data ─────────────────────────────────────────────────────────────

const features = [
  {
    icon: BookOpenText,
    title: "Lore that remembers",
    subtitle: "The Loom",
    description:
      "Write scenes, rules, factions, and history in a focused editor that turns raw pages into searchable world memory — chunked, embedded, and indexed automatically.",
    accentVar: "var(--accent)",
  },
  {
    icon: MessagesSquare,
    title: "Souls with boundaries",
    subtitle: "Echoes",
    description:
      "Forge characters into living personas whose voices, secrets, and blind spots come directly from the canon you have written — not from what you imagine.",
    accentVar: "var(--ai-pulse)",
  },
  {
    icon: ShieldAlert,
    title: "Canon under watch",
    subtitle: "Fracture Lens",
    description:
      "Check new writing against established lore. The archive flags contradictions before they become invisible mistakes that haunt your third act.",
    accentVar: "var(--danger)",
  },
];

const pillars = [
  { icon: Sparkles, label: "Living memory", value: "Vector-backed lore recall", context: "pgvector embeds every paragraph" },
  { icon: MessagesSquare, label: "Character voice", value: "Persona from your canon", context: "bounded by what the archive knows" },
  { icon: Eye, label: "Creative safety", value: "Contradiction detection", context: "checks new scenes before they root" },
];

const howItWorks = [
  {
    step: "01",
    title: "Inscribe your lore",
    body: "Write scenes, factions, rules, and history freely. The Loom processes every paragraph into structured world memory.",
    colorVar: "var(--accent)",
  },
  {
    step: "02",
    title: "The archive remembers",
    body: "Entities emerge automatically. Characters, locations, and factions become nodes in your constellation — connected, browsable, and searchable.",
    colorVar: "var(--ai-pulse)",
  },
  {
    step: "03",
    title: "Speak with what you've built",
    body: "Forge characters into bound souls. Chat with them — they answer only from canon, hold secrets, and grow with memory.",
    colorVar: "var(--danger)",
  },
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
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: index * 0.09, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="group h-full rounded-2xl p-7 border transition-[border-color,box-shadow,background] duration-250 relative overflow-hidden shimmer-sweep"
        style={{
          borderColor: `color-mix(in srgb, ${feature.accentVar} 12%, transparent)`,
          background: `var(--surface)`,
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = `color-mix(in srgb, ${feature.accentVar} 36%, transparent)`;
          el.style.boxShadow = `0 16px 48px color-mix(in srgb, ${feature.accentVar} 18%, transparent), 0 0 0 1px color-mix(in srgb, ${feature.accentVar} 20%, transparent)`;
          el.style.background = `linear-gradient(180deg, color-mix(in srgb, ${feature.accentVar} 5%, var(--surface)) 0%, var(--surface) 35%)`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = `color-mix(in srgb, ${feature.accentVar} 12%, transparent)`;
          el.style.boxShadow = "";
          el.style.background = "var(--surface)";
        }}
      >
        {/* Top accent line that expands on hover */}
        <div
          className="absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${feature.accentVar} 60%, transparent), transparent)`,
          }}
        />
        <div
          className="mb-5 flex h-14 w-14 items-center justify-center rounded-[16px] border transition-[transform,box-shadow] duration-200 group-hover:scale-110 group-hover:-translate-y-0.5"
          style={{
            borderColor: `color-mix(in srgb, ${feature.accentVar} 24%, transparent)`,
            background: `color-mix(in srgb, ${feature.accentVar} 10%, transparent)`,
            boxShadow: `0 0 0 0 transparent`,
          }}
        >
          <Icon
            className="h-5 w-5 transition-colors duration-200"
            style={{ color: `color-mix(in srgb, ${feature.accentVar} 90%, transparent)` }}
          />
        </div>
        <p className="chapter-label">{feature.subtitle}</p>
        <h3 className="mt-3 font-heading text-3xl text-[var(--text-main)]">{feature.title}</h3>
        <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">{feature.description}</p>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const heroInView = useInView(heroRef, { once: true });
  const scrollY = useScrollY();
  const headerScrolled = scrollY > 60;

  return (
    <main className="relative overflow-hidden">
      {/* Global grid overlay */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative border-b border-[var(--border)]">
        {/* Three-layer atmospheric depth fog */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: [
              "radial-gradient(ellipse 70% 50% at 30% 40%, color-mix(in srgb, var(--ai-pulse) 8%, transparent), transparent 60%)",
              "radial-gradient(ellipse 50% 40% at 75% 30%, color-mix(in srgb, var(--accent) 5%, transparent), transparent 55%)",
              "radial-gradient(ellipse 90% 40% at 50% 100%, color-mix(in srgb, var(--accent) 6%, transparent), transparent 55%)",
            ].join(", "),
          }}
        />

        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 pb-16 pt-6 lg:px-10">
          {/* Nav — sticky with blur on scroll */}
          <header
            className="sticky top-0 z-50 -mx-6 flex items-center justify-between border-b border-[var(--border)] px-6 py-2.5 transition-[background,backdrop-filter] duration-300 lg:-mx-10 lg:px-10"
            style={headerScrolled ? {
              background: "color-mix(in srgb, var(--bg) 88%, transparent)",
              backdropFilter: "blur(14px)",
            } : {}}
          >
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
              <ThemeToggle />
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
                  <Stars className="h-3.5 w-3.5 text-[var(--accent)]" />
                  Living lore · Bound souls · Canon memory
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
                  className="font-heading text-6xl leading-[0.95] text-[var(--text-main)] md:text-7xl"
                >
                  Your World
                </motion.h1>
                <motion.h1
                  variants={lineVariants}
                  className="font-heading text-6xl leading-[0.95] text-[var(--text-main)] md:text-7xl"
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
                className="max-w-xl text-lg leading-8 text-[var(--text-muted)]"
              >
                Write your world&apos;s lore once. Every character, place, and faction becomes a searchable memory — and those characters can speak in their own voices, bounded by what the archive knows.
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
                {pillars.map((pillar, i) => {
                  const Icon = pillar.icon;
                  return (
                    <motion.div
                      key={pillar.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 1.05 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                      className="group"
                    >
                      <Card className="rounded-xl p-5 transition-[border-color,box-shadow,transform] duration-200 hover:border-[var(--border-focus)] hover:-translate-y-0.5 hover:shadow-[0_8px_28px_color-mix(in_srgb,var(--ai-pulse)_10%,transparent)] active:scale-[0.98]">
                        <Icon className="mb-2 h-4 w-4 text-[var(--accent)] opacity-70 transition-[transform,opacity] duration-200 group-hover:scale-110 group-hover:opacity-100" />
                        <p className="chapter-label">{pillar.label}</p>
                        <p className="mt-2 font-heading text-xl text-[var(--text-main)]">{pillar.value}</p>
                        <p className="mt-1 text-[10px] text-[var(--text-muted)] opacity-65">{pillar.context}</p>
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
                    "radial-gradient(circle, color-mix(in srgb, var(--ai-pulse) 15%, transparent), color-mix(in srgb, var(--accent) 6%, transparent), transparent 70%)",
                }}
              />
              {/* Floating decorative rune — kept subtle */}
              <motion.span
                className="pointer-events-none absolute -right-3 -top-4 font-heading text-3xl select-none"
                animate={{ y: [-4, 4, -4], rotate: [-4, 4, -4] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                style={{ color: "var(--ai-pulse)", opacity: 0.08 }}
              >ᚦ</motion.span>
              <motion.span
                className="pointer-events-none absolute -left-4 bottom-8 font-heading text-2xl select-none"
                animate={{ y: [4, -4, 4], rotate: [3, -3, 3] }}
                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                style={{ color: "var(--accent)", opacity: 0.06 }}
              >ᚠ</motion.span>

              <div className="arcane-border glass-panel-elevated relative overflow-hidden rounded-2xl p-6">
                <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.12]" />
                <div className="relative space-y-5">
                  {/* World header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="chapter-label">Demo world</p>
                      <h2 className="font-heading text-5xl text-[var(--text-main)]">Ashveil</h2>
                    </div>
                    <motion.div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--ai-pulse)_22%,transparent)] bg-[color-mix(in_srgb,var(--ai-pulse)_14%,transparent)]"
                      whileHover={{ scale: 1.08, rotate: 12 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <Compass className="h-5 w-5 text-[var(--ai-pulse-soft)]" />
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
                          <Badge className="text-[10px] transition-all duration-200 hover:border-[color-mix(in_srgb,var(--ai-pulse)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--ai-pulse)_8%,transparent)]">{item}</Badge>
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
          <h2 className="font-heading text-5xl text-[var(--text-main)]">
            Deep enough for a private canon.{" "}
            <span className="text-[var(--text-muted)]">Clear enough to write in every day.</span>
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
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

      {/* ── SOCIAL PROOF STRIP ───────────────────────────────────────── */}
      <SocialProofStrip />

      {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="mb-16 space-y-3"
          >
            <p className="chapter-label">— How it works —</p>
            <h2 className="font-heading text-5xl text-[var(--text-main)]">
              Three steps. One living world.
            </h2>
          </motion.div>
          {/* Connector line — desktop only, drawn behind the step columns */}
          <div className="relative grid gap-0 lg:grid-cols-3">
            <div
              className="pointer-events-none absolute left-[16.67%] right-[16.67%] top-8 hidden h-px lg:block"
              style={{ background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--border) 80%, transparent) 20%, color-mix(in srgb, var(--border) 80%, transparent) 80%, transparent)" }}
            />
            {howItWorks.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.12, ease: "easeOut" }}
                className="relative px-8 py-10"
                style={{
                  borderLeft: i > 0 ? `1px solid var(--border)` : undefined,
                }}
              >
                {/* Ordinal watermark */}
                <span
                  className="pointer-events-none absolute left-6 top-6 select-none font-heading text-8xl leading-none opacity-[0.055]"
                  style={{ color: step.colorVar }}
                  aria-hidden
                >
                  {step.step}
                </span>
                {/* Left accent bar */}
                <div
                  className="mb-6 h-0.5 w-10 rounded-full"
                  style={{ background: `color-mix(in srgb, ${step.colorVar} 70%, transparent)` }}
                />
                <p
                  className="chapter-label mb-3"
                  style={{ color: `color-mix(in srgb, ${step.colorVar} 75%, transparent)` }}
                >
                  Step {step.step}
                </p>
                <h3 className="font-heading text-3xl text-[var(--text-main)]">{step.title}</h3>
                <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BLOCK ─────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden"
          >
            {/* Radial glow from center — re-colored */}
            <div
              className="pointer-events-none absolute inset-0 rounded-[36px]"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--ai-pulse) 10%, transparent), color-mix(in srgb, var(--accent) 3%, transparent) 50%, transparent 70%)",
              }}
            />
            <div className="glass-panel-elevated arcane-border relative flex flex-col gap-8 rounded-2xl p-10 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-4">
                <p className="chapter-label">Begin the first chapter</p>
                <h2 className="max-w-xl font-heading text-5xl text-[var(--text-main)]">
                  Make your canon feel alive without losing control of it.
                </h2>
                <p className="max-w-md text-sm leading-7 text-[var(--text-muted)]">
                  One world on free tier, three souls, and enough daily room to test whether
                  Grimoire fits the way you think and write.
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2">
                  {["Free forever tier", "No credit card", "Cancel anytime"].map((perk, i) => (
                    <motion.span
                      key={perk}
                      className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: 0.1 + i * 0.1, ease: "easeOut" }}
                    >
                      <span className="text-[var(--success)]">✓</span>
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
      <footer className="relative border-t border-[var(--border)] overflow-hidden">
        {/* subtle footer ambient — re-colored */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 60% 80% at 50% 100%, color-mix(in srgb, var(--ai-pulse) 4%, transparent), transparent 70%)",
          }}
        />
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-10 relative">
          <div className="space-y-2">
            <GrimoireLogo className="origin-left scale-90" />
            <p className="text-xs text-[var(--text-muted)] opacity-65 max-w-xs">
              Every word you write becomes structured memory. Every character you forge can speak.
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm text-[var(--text-muted)]">
            <Link href="/auth" className="link-underline transition-colors hover:text-[var(--text-main)]">
              Sign in
            </Link>
            <Link href="/demo" className="link-underline transition-colors hover:text-[var(--text-main)]">
              Demo world
            </Link>
            <span className="h-4 w-px bg-[var(--border)]" />
            <span className="text-xs text-[var(--text-muted)] opacity-65">
              © {new Date().getFullYear()} Grimoire
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
