import { cn } from "@/lib/utils";

export function GrimoireLogo({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-3 group", className)}>
      {/* Icon container: breathes gently, scales on hover */}
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-card overflow-hidden logo-breathe shimmer-sweep"
        style={{
          transition: "box-shadow 300ms ease, transform 200ms var(--ease-snap, cubic-bezier(0.23,1,0.32,1))",
        }}
      >
        {/* Moonlit sheen overlay */}
        <div
          className="pointer-events-none absolute inset-0 rounded-xl opacity-60"
          style={{
            background: "linear-gradient(135deg, color-mix(in srgb, var(--ai-pulse) 10%, transparent) 0%, transparent 50%, color-mix(in srgb, var(--accent) 4%, transparent) 100%)",
          }}
        />
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="relative z-10 transition-transform duration-300 group-hover:scale-110"
        >
          {/* Left page */}
          <path
            d="M11 17.5V7C11 7 8 5.5 4.5 6.5C3.5 6.8 3 7.5 3 8.5V17.5C3 17.5 6 16.5 11 17.5Z"
            fill="color-mix(in srgb, var(--text-main) 55%, transparent)"
            stroke="color-mix(in srgb, var(--text-main) 80%, transparent)"
            strokeWidth="0.5"
          />
          {/* Right page */}
          <path
            d="M11 17.5V7C11 7 14 5.5 17.5 6.5C18.5 6.8 19 7.5 19 8.5V17.5C19 17.5 16 16.5 11 17.5Z"
            fill="color-mix(in srgb, var(--text-main) 35%, transparent)"
            stroke="color-mix(in srgb, var(--text-main) 60%, transparent)"
            strokeWidth="0.5"
          />
          {/* Spine */}
          <line
            x1="11"
            y1="7"
            x2="11"
            y2="17.5"
            stroke="var(--accent)"
            strokeWidth="0.75"
          />
          {/* Flame outer */}
          <path
            d="M11 6C11 6 9 4 9.5 2C9.5 2 10.5 3.5 11 3.5C11.5 3.5 12.5 2 12.5 2C13 4 11 6 11 6Z"
            fill="var(--accent)"
          />
          {/* Flame inner highlight */}
          <path
            d="M11 5.2C11 5.2 10.2 4 10.5 2.8C10.5 2.8 11 3.6 11 3.6C11 3.6 11.5 2.8 11.5 2.8C11.8 4 11 5.2 11 5.2Z"
            fill="var(--accent-soft)"
          />
        </svg>
      </div>

      <div>
        <p className="font-heading text-2xl tracking-wide text-[var(--text-main)] transition-colors duration-200 group-hover:text-[var(--accent)]">Grimoire</p>
        <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--text-muted)]">Living Worlds</p>
      </div>
    </div>
  );
}
