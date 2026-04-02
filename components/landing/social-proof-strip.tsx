"use client";

import { motion } from "framer-motion";
import { useCountUp } from "@/lib/hooks/use-count-up";

const STATS = [
  { value: 1284, label: "Worlds forged", suffix: "+" },
  { value: 8940, label: "Souls bound", suffix: "+" },
  { value: 34, label: "Countries", suffix: "" },
];

function StatBadge({ value, label, suffix, delay }: { value: number; label: string; suffix: string; delay: number }) {
  const count = useCountUp(value, 1200);
  return (
    <motion.div
      className="glass-panel flex flex-col items-center gap-1 rounded-[18px] px-8 py-5"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="font-heading text-4xl text-[var(--text-main)] tabular-nums">
        {count.toLocaleString()}{suffix}
      </p>
      <p className="text-xs uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
    </motion.div>
  );
}

export function SocialProofStrip() {
  return (
    <section className="border-t border-b border-[var(--border)] py-10">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <motion.p
          className="mb-6 text-center text-[11px] uppercase tracking-[0.25em] text-[var(--text-muted)]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          — Writers already building —
        </motion.p>
        <div className="flex flex-wrap justify-center gap-4">
          {STATS.map((stat, i) => (
            <StatBadge key={stat.label} {...stat} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
}
