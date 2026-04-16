"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, BookMarked, Castle, Moon, Landmark, Stars, Sparkles, Trees,
  Mountain, Skull, Eye, Ghost, Sun, Wand2, Check,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2),
  genre: z.string().min(1),
  tone: z.string().min(1),
  premise: z.string().min(10).max(280),
});

type Values = z.infer<typeof schema>;

const genres = [
  { value: "Fantasy", icon: Castle },
  { value: "Sci-Fi", icon: Stars },
  { value: "Horror", icon: Moon },
  { value: "Historical", icon: Landmark },
  { value: "Contemporary", icon: BookMarked },
  { value: "Mythology", icon: Sparkles },
  { value: "Other", icon: Trees },
];

const tones = [
  { value: "Dark & Gritty", icon: Skull },
  { value: "Epic & Grand", icon: Mountain },
  { value: "Whimsical", icon: Wand2 },
  { value: "Mystery", icon: Eye },
  { value: "Horror", icon: Ghost },
  { value: "Hopeful", icon: Sun },
];

export function WorldCreationFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      genre: "",
      tone: "",
      premise: "",
    },
  });

  const fields = useMemo(() => ["name", "genre", "tone", "premise"] as const, []);

  const next = async () => {
    const valid = await form.trigger(fields[step]);
    if (valid) setStep((value) => Math.min(value + 1, 3));
  };

  const submit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/worlds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const payload = await response.json();

      if (!response.ok) throw new Error(payload.error || "World creation failed.");
      toast.success("World created.");
      router.push(`/worlds/${payload.world.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "World creation failed.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Card className="glass-panel-elevated mx-auto w-full max-w-3xl rounded-2xl p-8">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
      <div className="mb-8 space-y-4">
        <p className="text-sm uppercase tracking-[0.28em] text-secondary">World Forge</p>
        <h1 className="font-heading text-5xl text-foreground">Name the realm. Set the tone. Light the first page.</h1>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-secondary">
            <span className="uppercase tracking-[0.2em]">
              {["Name Your World", "Choose a Genre", "Set the Tone", "Write the Premise"][step]}
            </span>
            <span>{step + 1} of 4</span>
          </div>
          <Progress value={((step + 1) / 4) * 100} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {step === 0 ? (
            <div className="space-y-4">
              <h2 className="font-heading text-4xl text-foreground">Name your world</h2>
              <Input
                placeholder="The Realm of Ashveil..."
                className="h-16 text-lg"
                {...form.register("name")}
              />
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <h2 className="font-heading text-4xl text-foreground">Pick a genre</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {genres.map((genre) => {
                  const Icon = genre.icon;
                  const active = form.watch("genre") === genre.value;
                  return (
                    <button
                      key={genre.value}
                      type="button"
                      onClick={() => form.setValue("genre", genre.value, { shouldValidate: true })}
                      className={cn(
                        "glass-panel relative rounded-xl p-4 text-left transition-all duration-150 active:scale-[0.97] active:transition-none",
                        active
                          ? "border-2 border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] scale-[1.02]"
                          : "border-border hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)]"
                      )}
                    >
                      {active && (
                        <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)]">
                          <Check className="h-3 w-3 text-[var(--bg)]" strokeWidth={2.5} />
                        </span>
                      )}
                      <Icon className="mb-3 h-5 w-5 text-[var(--accent)]" />
                      <div className="font-medium text-foreground">{genre.value}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <h2 className="font-heading text-4xl text-foreground">Pick a tone</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tones.map(({ value: tone, icon: ToneIcon }) => {
                  const active = form.watch("tone") === tone;
                  return (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => form.setValue("tone", tone, { shouldValidate: true })}
                      className={cn(
                        "glass-panel relative flex items-center gap-3 rounded-xl p-4 text-left transition-all duration-150 active:scale-[0.97] active:transition-none",
                        active
                          ? "border-2 border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] scale-[1.02]"
                          : "border-border hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)]"
                      )}
                    >
                      {active && (
                        <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)]">
                          <Check className="h-3 w-3 text-[var(--bg)]" strokeWidth={2.5} />
                        </span>
                      )}
                      <ToneIcon className={cn("h-4 w-4 shrink-0", active ? "text-[var(--accent)]" : "text-[var(--ai-pulse)]")} />
                      <span className="text-sm font-medium text-foreground">{tone}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <h2 className="font-heading text-4xl text-foreground">Write the premise</h2>
              <Textarea
                maxLength={280}
                placeholder="A dying empire's last archmage..."
                className="min-h-[180px]"
                {...form.register("premise")}
              />
              <div className="text-right text-xs text-secondary">{form.watch("premise")?.length ?? 0}/280</div>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((value) => Math.max(value - 1, 0))}>
          Back
        </Button>
        {step === 3 ? (
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Forging..." : "Create World"}
          </Button>
        ) : (
          <Button onClick={next}>
            Continue
          </Button>
        )}
      </div>
    </Card>
  );
}
