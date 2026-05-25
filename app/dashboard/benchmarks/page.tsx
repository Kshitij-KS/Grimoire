import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { BenchmarkDashboard } from "@/components/benchmarks/benchmark-dashboard";
import type { EvalRun } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Crucible — Model Benchmarks | Grimoire",
  description:
    "Benchmark your AI models against academic evaluation tasks. Measure reasoning, common sense, and knowledge for your worldbuilding AI.",
};

export default async function BenchmarksPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  // Restrict access to local development only
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  // Fetch the user's existing eval runs (server-side for initial render)
  const { data: runs } = await supabase
    .from("eval_runs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <BenchmarkDashboard initialRuns={(runs as EvalRun[]) ?? []} />
    </main>
  );
}
