"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { GrimoireLogo } from "@/components/shared/grimoire-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { hasSupabaseEnv } from "@/lib/env";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type AuthValues = z.infer<typeof authSchema>;

export function AuthShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const mode = useMemo(() => (searchParams.get("mode") === "signup" ? "signup" : "signin"), [searchParams]);
  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const submit = form.handleSubmit(async (values) => {
    if (!hasSupabaseEnv()) {
      toast.error("Supabase env vars are missing. Add them to enable auth.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createBrowserSupabaseClient();
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            emailRedirectTo: `${window.location.origin}/api/auth/callback`,
          },
        });

        if (error) throw error;
        toast.success("Account created. Check your inbox if email confirmation is enabled.");
      } else {
        const { error } = await supabase.auth.signInWithPassword(values);
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  });

  const signInWithGoogle = async () => {
    if (!hasSupabaseEnv()) {
      toast.error("Supabase env vars are missing. Add them to enable auth.");
      return;
    }

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) toast.error(error.message);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      {/* Background grid */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />

      {/* Atmospheric radial glows */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 15% 50%, color-mix(in srgb, var(--ai-pulse) 8%, transparent), transparent 55%), " +
            "radial-gradient(ellipse 50% 60% at 85% 50%, color-mix(in srgb, var(--accent) 5%, transparent), transparent 50%)",
        }}
      />

      {/* Floating background runes */}
      {["ᚠ","ᚱ","ᚷ","ᚦ","ᚨ","ᚲ","ᛏ"].map((rune, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute select-none font-heading"
          style={{
            top: i < 5 ? `${15 + i * 16}%` : "auto",
            bottom: i >= 5 ? `${(i - 5) * 12 + 6}%` : "auto",
            left: i % 2 === 0 ? `${6 + (i % 5) * 2}%` : undefined,
            right: i % 2 === 1 ? `${6 + (i % 5) * 2}%` : undefined,
            fontSize: `${18 + (i % 5) * 4}px`,
            opacity: 0.04 + (i % 5) * 0.01,
            color: i % 2 === 0 ? "color-mix(in srgb, var(--ai-pulse) 60%, transparent)" : "color-mix(in srgb, var(--accent) 60%, transparent)",
            animationDelay: `${i * 3}s`,
          }}
          animate={{
            y: [0, i % 2 === 0 ? -10 : 10, 0],
            rotate: [0, i % 2 === 0 ? 5 : -5, 0],
          }}
          transition={{ duration: 8 + i * 2, repeat: Infinity, ease: "easeInOut", delay: i * 1.5 }}
        >
          {rune}
        </motion.span>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[calc(100vw-32px)] sm:max-w-md"
      >
      <Card className="aether-panel-elevated arcane-border relative z-10 w-full rounded-2xl p-6 sm:p-8">
        <div className="mb-8 space-y-4 text-center">
          <div className="flex justify-center">
            <GrimoireLogo className="scale-90" />
          </div>
          <div>
            <h1 className="font-heading text-4xl text-foreground">
              {mode === "signup" ? "Begin the first chapter." : "Return to your world."}
            </h1>
            <p className="mt-2 text-sm text-secondary">
              {mode === "signup"
                ? "Create an account to start building your living world."
                : "Sign in to continue shaping your worlds."}
            </p>
          </div>
        </div>

        <Tabs value={mode} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin" onClick={() => router.replace("/auth?mode=signin")}>
              Return
            </TabsTrigger>
            <TabsTrigger value="signup" onClick={() => router.replace("/auth?mode=signup")}>
              Begin
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="scribe@ashveil.com" className="input-glow" {...form.register("email")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              className="input-glow"
              {...form.register("password")}
            />
          </div>
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
            <Button className="w-full" type="submit" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "signup" ? "Begin the first chapter" : "Return to the archive"}
              {!busy && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </motion.div>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-secondary">
          <span className="h-px flex-1 bg-border" />
          Or
          <span className="h-px flex-1 bg-border" />
        </div>

        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
          <Button className="w-full" variant="secondary" onClick={signInWithGoogle}>
            Continue with Google
          </Button>
        </motion.div>
      </Card>
      </motion.div>
    </div>
  );
}
