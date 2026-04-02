"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialsFromName } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Soul } from "@/lib/types";

const AVATAR_COLORS = [
  { label: "Arcane Purple", value: "#7c5cbf" },
  { label: "Gold", value: "#d4a853" },
  { label: "Crimson", value: "#c04a4a" },
  { label: "Teal", value: "#3d9a8b" },
  { label: "Indigo", value: "#4a5cbf" },
  { label: "Rose", value: "#bf4a7c" },
  { label: "Slate", value: "#607090" },
  { label: "Midnight", value: "#2a2a5c" },
];

// Decorative rune glyphs — four corners
const RUNES = ["ᚠ", "ᚢ", "ᚦ", "ᚨ"];

const schema = z.object({
  name: z.string().min(2),
  avatarColor: z.string().min(4),
  description: z.string().min(40),
});

type Values = z.infer<typeof schema>;

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  distance: number;
  duration: number;
  size: number;
}

export function SoulCreationModal({
  open,
  onOpenChange,
  worldId,
  onCreated,
  prefillName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worldId: string;
  onCreated: (soul?: Soul) => void;
  prefillName?: string;
}) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [forging, setForging] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const forgeButtonRef = useRef<HTMLButtonElement>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: prefillName ?? "",
      avatarColor: "#7c5cbf",
      description: "",
    },
  });

  useEffect(() => {
    if (prefillName) form.setValue("name", prefillName);
  }, [prefillName, form]);

  const watchedName = form.watch("name");
  const watchedColor = form.watch("avatarColor");
  const watchedDesc = form.watch("description") ?? "";
  const descLen = watchedDesc.length;

  // Progress bar color: red → gold → purple
  const descBarColor =
    descLen < 40 ? "rgb(192,74,74)" : descLen < 200 ? "rgb(212,168,83)" : "rgb(124,92,191)";
  const descBarWidth = `${Math.min(100, (descLen / 300) * 100)}%`;

  const next = async () => {
    const fields = step === 0 ? ["name", "avatarColor"] : ["description"];
    const valid = await form.trigger(fields as Array<keyof Values>);
    if (valid) setStep((v) => Math.min(v + 1, 1));
  };

  const spawnParticles = () => {
    // Wave 1 — 12 large particles
    const wave1: Particle[] = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      x: 50,
      y: 50,
      angle: (i / 12) * 360,
      distance: 50 + Math.random() * 70,
      duration: 0.55 + Math.random() * 0.35,
      size: 8,
    }));
    // Wave 2 — 8 small particles with 60ms offset
    const wave2: Particle[] = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + 100 + i,
      x: 50,
      y: 50,
      angle: (i / 8) * 360 + 22,
      distance: 30 + Math.random() * 50,
      duration: 0.4 + Math.random() * 0.3,
      size: 5,
    }));
    setParticles(wave1);
    setTimeout(() => setParticles((prev) => [...prev, ...wave2]), 60);
    setTimeout(() => setParticles([]), 1000);
  };

  const submit = form.handleSubmit(async (values) => {
    spawnParticles();
    setLoading(true);
    setForging(true);
    try {
      const response = await fetch("/api/souls/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worldId,
          name: values.name,
          avatarColor: values.avatarColor,
          description: values.description,
        }),
      });
      const payload = await response.json();
      if (response.status === 429) throw new Error("RATE_LIMIT");
      if (!response.ok) throw new Error(payload.error || "Soul forging failed.");
      toast.success("Soul forged. The archive has a new voice.");
      // Three-beat ritual: dim → pulse → close
      setTimeout(() => {
        setForging(false);
        onOpenChange(false);
        setStep(0);
        form.reset();
        onCreated(payload.soul as Soul);
      }, 800);
    } catch (error) {
      setForging(false);
      toast.error(error instanceof Error ? error.message : "Soul forging failed.");
    } finally {
      setLoading(false);
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setStep(0);
      form.reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="relative pb-4 max-w-lg overflow-x-hidden">
        {/* Three-beat forge ritual overlay */}
        <AnimatePresence>
          {forging && (
            <motion.div
              className="absolute inset-0 z-50 flex items-center justify-center rounded-[inherit]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ background: "color-mix(in srgb, var(--bg) 70%, transparent)", backdropFilter: "blur(4px)" }}
            >
              <motion.div
                animate={{ scale: [1, 1.18, 1, 1.18, 1], opacity: [0.6, 1, 0.6, 1, 0.6] }}
                transition={{ duration: 0.9, ease: "easeInOut" }}
                className="font-heading text-5xl"
                style={{ color: "var(--accent)" }}
              >
                ᚷ
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Decorative rune corners ── */}
        {RUNES.map((rune, i) => (
          <span
            key={i}
            className="rune-float pointer-events-none absolute select-none font-heading text-3xl opacity-[0.04]"
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

        <DialogHeader>
          <DialogTitle className="font-heading text-4xl">Forge This Soul</DialogTitle>
          <DialogDescription>
            The more specific your description, the more alive this character becomes.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="space-y-2 py-1">
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: step === 0 ? "rgb(212,168,83)" : "var(--text-secondary)" }}>
              Name & Avatar
            </span>
            <span style={{ color: step === 1 ? "rgb(212,168,83)" : "var(--text-secondary)" }}>
              Description
            </span>
          </div>
          <div className="flex items-center gap-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-0.5 flex-1 rounded-sm transition-all duration-500"
                style={{ background: i <= step ? "rgb(212,168,83)" : "rgba(255,255,255,0.08)" }}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-5"
          >
            {step === 0 ? (
              <>
                {/* Avatar preview with soul-glow-ring */}
                <div className="flex justify-center py-2">
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.05 }}
                    className="soul-glow-ring flex h-20 w-20 items-center justify-center rounded-full border-2 font-heading text-3xl transition-all duration-300"
                    style={{
                      borderColor: watchedColor,
                      background: `${watchedColor}22`,
                      color: watchedColor,
                    }}
                  >
                    {watchedName ? initialsFromName(watchedName) : "?"}
                  </motion.div>
                </div>

                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input placeholder="Mira Ashveil" {...form.register("name")} />
                  {form.formState.errors.name && (
                    <p className="text-xs text-[rgb(192,74,74)]">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>Soul Color</Label>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                    {AVATAR_COLORS.map((color) => (
                      <motion.button
                        key={color.value}
                        type="button"
                        title={color.label}
                        whileHover={{ scale: 1.25 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() =>
                          form.setValue("avatarColor", color.value, { shouldValidate: true })
                        }
                        className={cn(
                          "h-8 w-8 rounded-full border-2 transition-all duration-150",
                          watchedColor === color.value ? "border-white" : "border-transparent",
                        )}
                        style={{
                          background: color.value,
                          boxShadow:
                            watchedColor === color.value
                              ? `0 0 0 3px ${color.value}55, 0 0 12px ${color.value}88`
                              : "none",
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={next}>Continue</Button>
                </div>
              </>
            ) : (
              <>
                {/* Avatar reminder strip */}
                <div className="flex items-center gap-3 rounded-[18px] border border-border bg-[rgba(28,22,14,0.6)] p-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-heading text-base"
                    style={{
                      borderColor: watchedColor,
                      background: `${watchedColor}22`,
                      color: watchedColor,
                    }}
                  >
                    {watchedName ? initialsFromName(watchedName) : "?"}
                  </div>
                  <div>
                    <p className="font-heading text-xl text-foreground">
                      {watchedName || "Unnamed Soul"}
                    </p>
                    <p className="text-xs text-secondary">Describe them freely below</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Character Description</Label>
                  <Textarea
                    placeholder={watchedName
                      ? `Describe ${watchedName}'s history, motivations, secrets, and voice. The more specific, the more alive they become…`
                      : "Describe their history, motivations, secrets, and voice. The more specific, the more alive they become…"}
                    className="min-h-[200px]"
                    {...form.register("description")}
                  />
                  {form.formState.errors.description && (
                    <p className="text-xs text-[rgb(192,74,74)]">
                      {form.formState.errors.description.message}
                    </p>
                  )}

                  {/* Char count progress bar */}
                  <div className="space-y-1">
                    <div className="h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{ width: descBarWidth, background: descBarColor }}
                      />
                    </div>
                    <p className="text-right text-xs text-secondary">
                      {descLen} characters
                      {descLen >= 40 ? "" : ` (${40 - descLen} more to unlock)`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={() => setStep(0)}>
                    Back
                  </Button>

                  {/* Forge button with particle burst */}
                  <div className="relative">
                    <Button
                      ref={forgeButtonRef}
                      onClick={submit}
                      disabled={loading}
                      className="relative overflow-hidden"
                    >
                      {loading ? (
                        <>
                          {/* Spinning arcane ring */}
                          <span
                            className="h-4 w-4 rounded-full border-t-2 border-[rgb(212,168,83)] animate-spin"
                            style={{ borderRightColor: "transparent", borderBottomColor: "transparent", borderLeftColor: "transparent" }}
                          />
                          Weaving into memory...
                        </>
                      ) : (
                        <>Forge This Soul</>
                      )}
                    </Button>

                    {/* Particle burst */}
                    <AnimatePresence>
                      {particles.map((particle) => {
                        const rad = (particle.angle * Math.PI) / 180;
                        const tx = Math.cos(rad) * particle.distance;
                        const ty = Math.sin(rad) * particle.distance;
                        const bg =
                          particle.angle % 3 === 0
                            ? "rgb(212,168,83)"
                            : particle.angle % 2 === 0
                              ? "rgb(157,127,224)"
                              : "rgb(124,92,191)";
                        return (
                          <motion.div
                            key={particle.id}
                            className="pointer-events-none absolute rounded-full"
                            style={{
                              left: "50%",
                              top: "50%",
                              width: particle.size,
                              height: particle.size,
                              background: bg,
                              zIndex: 50,
                            }}
                            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                            animate={{ x: tx, y: ty, scale: 0, opacity: 0 }}
                            transition={{ duration: particle.duration, ease: "easeOut" }}
                          />
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
