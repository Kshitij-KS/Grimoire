import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // New Editorial Cartography token system — direct CSS var references
        background:       "var(--bg)",
        foreground:       "var(--text-main)",
        surface:          "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        border:           "var(--border)",
        "border-focus":   "var(--border-focus)",
        muted:            "var(--text-muted)",
        accent:           "var(--accent)",
        "accent-soft":    "var(--accent-soft)",
        "ai-pulse":       "var(--ai-pulse)",
        "ai-pulse-soft":  "var(--ai-pulse-soft)",
        danger:           "var(--danger)",
        success:          "var(--success)",
        ring:             "var(--border-focus)",
        // Semantic aliases (backward compat)
        card:             "var(--surface)",
        "card-elevated":  "var(--surface-raised)",
        primary:          "var(--text-main)",
        // Legacy aliases used in existing components
        void:             "var(--bg)",
        parchment:        "var(--text-main)",
        "parchment-dim":  "var(--text-muted)",
        gold:             "var(--accent)",
        "gold-dim":       "var(--accent)",
        "gold-bright":    "var(--accent-soft)",
        arcane:           "var(--ai-pulse)",
        "arcane-glow":    "var(--ai-pulse-soft)",
        "border-warm":    "var(--border-focus)",
        "text-pulse":     "var(--text-main)",
        "text-muted-aether": "var(--text-muted)",
        "accent-mint":    "var(--accent)",
        "accent-ultra":   "var(--ai-pulse)",
        fracture:         "var(--danger)",
        "border-subtle":  "var(--border)",
      },
      fontFamily: {
        heading: ["var(--font-crimson)", "serif"],
        sans:    ["var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        card:          "0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px var(--border)",
        "card-hover":  "0 8px 24px rgba(0,0,0,0.10), 0 0 0 1px var(--border-focus)",
        "gold-glow":   "0 0 20px color-mix(in srgb, var(--accent) 25%, transparent), 0 0 60px color-mix(in srgb, var(--accent) 10%, transparent)",
        "arcane-glow": "0 0 20px color-mix(in srgb, var(--ai-pulse) 25%, transparent), 0 0 60px color-mix(in srgb, var(--ai-pulse) 10%, transparent)",
        "danger-glow": "0 0 0 2px var(--danger)",
        "soul-active": "0 0 0 2px color-mix(in srgb, var(--accent) 40%, transparent), 0 0 16px color-mix(in srgb, var(--ai-pulse) 20%, transparent)",
        "message-soul": "0 2px 18px color-mix(in srgb, var(--ai-pulse) 18%, transparent), inset 0 1px 0 rgba(255,255,255,0.035)",
        // Legacy
        grimoire:      "0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px var(--border)",
        aether:        "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px var(--border)",
        "mint-glow":   "0 0 20px color-mix(in srgb, var(--accent) 30%, transparent)",
        "ultra-glow":  "0 0 20px color-mix(in srgb, var(--ai-pulse) 40%, transparent)",
        "fracture-glow": "0 0 16px color-mix(in srgb, var(--danger) 40%, transparent)",
      },
      animation: {
        // New
        accentShimmer:    "accentShimmer 5s linear infinite",
        aiPulse:          "aiPulse 2.2s linear infinite",
        // Retained (re-colored)
        goldShimmer:      "accentShimmer 5s linear infinite",
        shimmer:          "aiPulse 2.2s linear infinite",
        shimmerWarm:      "aiPulse 2.2s linear infinite",
        orbPulse:         "orbPulse 2.8s ease-in-out infinite",
        runeGlow:         "runeGlow 2.8s ease-in-out infinite",
        scanLine:         "scanLine 1.4s cubic-bezier(0.4,0,0.2,1) forwards",
        typingBounce:     "typingBounce 1.4s ease-in-out infinite",
        pageFadeIn:       "pageFadeIn 0.35s ease-out both",
        inkReveal:        "inkReveal 0.7s cubic-bezier(0.22,1,0.36,1) both",
        soulAwaken:       "soulAwaken 4s ease-in-out infinite",
        forgeFlare:       "forgeFlare 0.6s ease-out forwards",
        arcaneRipple:     "arcaneRipple 1.2s ease-out forwards",
        glyphRotate:      "glyphRotate 12s linear infinite",
        pulseGold:        "pulseAccent 2.4s ease-in-out infinite",
        pulseAccent:      "pulseAccent 2.4s ease-in-out infinite",
        typewriterCursor: "typewriterCursor 0.9s steps(2,end) infinite",
        messageSlideIn:   "messageSlideIn 0.32s cubic-bezier(0.34,1.56,0.64,1) both",
        flagPulseHigh:    "flagPulseHigh 2s ease-in-out infinite",
        // Removed: candleFlicker, floatUp, glitch, mintFlash, fractureScan
      },
      keyframes: {
        // New animations
        accentShimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        aiPulse: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // Re-colored existing
        runeGlow: {
          "0%, 100%": { boxShadow: "0 0 8px color-mix(in srgb, var(--ai-pulse) 50%, transparent)" },
          "50%":       { boxShadow: "0 0 16px var(--ai-pulse), 0 0 32px color-mix(in srgb, var(--accent) 30%, transparent)" },
        },
        soulAwaken: {
          "0%, 100%": {
            boxShadow: "0 0 0 2px color-mix(in srgb, var(--ai-pulse) 30%, transparent), 0 0 16px color-mix(in srgb, var(--accent) 20%, transparent)",
          },
          "50%": {
            boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent) 50%, transparent), 0 0 24px color-mix(in srgb, var(--ai-pulse) 30%, transparent)",
          },
        },
        pulseAccent: {
          "0%, 100%": { textShadow: "0 0 0px transparent" },
          "50%":       { textShadow: "0 0 18px var(--accent), 0 0 40px color-mix(in srgb, var(--accent) 25%, transparent)" },
        },
        forgeFlare: {
          "from": { transform: "scale(0)", opacity: "0.8" },
          "to":   { transform: "scale(2.2)", opacity: "0" },
        },
        arcaneRipple: {
          "from": { transform: "scale(0.5)", opacity: "0.8" },
          "to":   { transform: "scale(2.2)", opacity: "0" },
        },
        flagPulseHigh: {
          "0%, 100%": { borderLeftColor: "color-mix(in srgb, var(--danger) 50%, transparent)", boxShadow: "-2px 0 8px color-mix(in srgb, var(--danger) 15%, transparent)" },
          "50%":       { borderLeftColor: "var(--danger)", boxShadow: "-4px 0 16px color-mix(in srgb, var(--danger) 40%, transparent)" },
        },
        // Unchanged keyframes (transform/opacity only)
        orbPulse: {
          "0%, 100%": { opacity: "0.55" },
          "50%":      { opacity: "1" },
        },
        scanLine: {
          "0%":   { transform: "translateY(0)", opacity: "0.95" },
          "90%":  { transform: "translateY(100%)", opacity: "0.8" },
          "100%": { transform: "translateY(110%)", opacity: "0" },
        },
        typingBounce: {
          "0%, 60%, 100%": { transform: "translateY(0)" },
          "30%":           { transform: "translateY(-4px)" },
        },
        pageFadeIn: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        inkReveal: {
          "from": { clipPath: "inset(0 100% 0 0)" },
          "to":   { clipPath: "inset(0 0% 0 0)" },
        },
        glyphRotate: {
          "from": { transform: "rotate(0deg)" },
          "to":   { transform: "rotate(360deg)" },
        },
        typewriterCursor: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0" },
        },
        messageSlideIn: {
          "from": { opacity: "0", transform: "translateX(-12px) scale(0.97)" },
          "to":   { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        inkBleed: {
          "from": { opacity: "0", filter: "blur(6px)", transform: "scale(0.98)" },
          "to":   { opacity: "1", filter: "blur(0)", transform: "scale(1)" },
        },
        orbRing1: {
          "from": { transform: "translate(-50%, -50%) rotateX(60deg) rotateZ(0deg)" },
          "to":   { transform: "translate(-50%, -50%) rotateX(60deg) rotateZ(360deg)" },
        },
        orbRing2: {
          "from": { transform: "translate(-50%, -50%) rotateX(30deg) rotateY(45deg) rotateZ(0deg)" },
          "to":   { transform: "translate(-50%, -50%) rotateX(30deg) rotateY(45deg) rotateZ(-360deg)" },
        },
        orbCorePulse: {
          "0%, 100%": { transform: "translate(-50%, -50%) scale(1)", opacity: "0.9" },
          "50%":      { transform: "translate(-50%, -50%) scale(1.08)", opacity: "1" },
        },
        orbAura: {
          "0%, 100%": { transform: "translate(-50%, -50%) scale(1)", opacity: "0.15" },
          "50%":      { transform: "translate(-50%, -50%) scale(1.18)", opacity: "0.08" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "33%":      { transform: "translateY(-6px) rotate(1deg)" },
          "66%":      { transform: "translateY(-3px) rotate(-1deg)" },
        },
        breathe: {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%":      { opacity: "0.85", transform: "scale(1.04)" },
        },
        sparkleIn: {
          "0%":   { opacity: "0", transform: "scale(0) rotate(-90deg)" },
          "60%":  { opacity: "1", transform: "scale(1.2) rotate(8deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(0deg)" },
        },
        borderTrace: {
          "0%":   { backgroundPosition: "0% 50%" },
          "50%":  { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        sectionEnter: {
          "from": { opacity: "0", transform: "translateY(12px)" },
          "to":   { opacity: "1", transform: "translateY(0)" },
        },
        shimmerWarm: {
          "from": { backgroundPosition: "-200% 0" },
          "to":   { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
