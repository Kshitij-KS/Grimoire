import { cn } from "@/lib/utils";

export function GrimoireLogo({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <div className="moonlit-sheen rune-glow relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(165,148,255,0.28)] shadow-card">
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M11 17.5V7C11 7 8 5.5 4.5 6.5C3.5 6.8 3 7.5 3 8.5V17.5C3 17.5 6 16.5 11 17.5Z"
            fill="rgba(165,148,255,0.72)"
            stroke="rgba(199,191,255,0.9)"
            strokeWidth="0.5"
          />
          <path
            d="M11 17.5V7C11 7 14 5.5 17.5 6.5C18.5 6.8 19 7.5 19 8.5V17.5C19 17.5 16 16.5 11 17.5Z"
            fill="rgba(150,164,220,0.5)"
            stroke="rgba(194,205,255,0.76)"
            strokeWidth="0.5"
          />
          <line
            x1="11"
            y1="7"
            x2="11"
            y2="17.5"
            stroke="rgba(196,168,106,0.72)"
            strokeWidth="0.75"
          />
          <path
            d="M11 6C11 6 9 4 9.5 2C9.5 2 10.5 3.5 11 3.5C11.5 3.5 12.5 2 12.5 2C13 4 11 6 11 6Z"
            fill="rgba(196,168,106,0.95)"
          />
          <path
            d="M11 5.2C11 5.2 10.2 4 10.5 2.8C10.5 2.8 11 3.6 11 3.6C11 3.6 11.5 2.8 11.5 2.8C11.8 4 11 5.2 11 5.2Z"
            fill="rgba(236,221,182,1)"
          />
        </svg>
      </div>

      <div>
        <p className="font-heading text-2xl tracking-wide text-foreground">Grimoire</p>
        <p className="text-[10px] uppercase tracking-[0.32em] text-secondary">Living Worlds</p>
      </div>
    </div>
  );
}
