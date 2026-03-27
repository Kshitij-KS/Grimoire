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
        // Tailwind HSL-mapped tokens (shadcn/radix)
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: "hsl(var(--card) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        primary: "hsl(var(--primary) / <alpha-value>)",
        accent: "hsl(var(--accent) / <alpha-value>)",
        success: "hsl(var(--success) / <alpha-value>)",
        danger: "hsl(var(--danger) / <alpha-value>)",
        // Grimoire warm dark fantasy direct tokens
        void: "rgb(13,11,8)",
        parchment: "rgb(240,234,216)",
        "parchment-dim": "rgba(240,234,216,0.55)",
        gold: "rgb(212,168,83)",
        "gold-dim": "rgb(160,120,48)",
        "gold-bright": "rgb(240,210,130)",
        arcane: "rgb(124,92,191)",
        "arcane-glow": "rgb(157,127,224)",
        "border-warm": "rgba(54,44,34,0.7)",
        // Legacy aliases (component compat)
        "text-pulse": "rgb(240,234,216)",
        "text-muted-aether": "rgba(240,234,216,0.45)",
        "accent-mint": "rgb(212,168,83)",
        "accent-ultra": "rgb(124,92,191)",
        fracture: "rgb(192,74,74)",
        "border-subtle": "rgba(54,44,34,0.55)",
        "border-focus": "rgba(54,44,34,0.9)",
      },
      fontFamily: {
        heading: ["var(--font-crimson)", "serif"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        grimoire: "0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(54,44,34,0.6)",
        "gold-glow": "0 0 20px rgba(212,168,83,0.3), 0 0 60px rgba(212,168,83,0.1)",
        "arcane-glow": "0 0 20px rgba(124,92,191,0.4), 0 0 60px rgba(124,92,191,0.15)",
        "danger-glow": "0 0 16px rgba(192,74,74,0.4)",
        "soul-active": "0 0 28px rgba(126,109,242,0.55), 0 0 56px rgba(196,168,106,0.2)",
        "message-soul": "0 2px 18px rgba(126,109,242,0.18), inset 0 1px 0 rgba(255,255,255,0.04)",
        // Legacy
        aether: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(54,44,34,0.6)",
        "mint-glow": "0 0 20px rgba(212,168,83,0.3), 0 0 60px rgba(212,168,83,0.1)",
        "ultra-glow": "0 0 20px rgba(124,92,191,0.4)",
        "fracture-glow": "0 0 16px rgba(192,74,74,0.4)",
      },
      animation: {
        goldShimmer: "goldShimmer 4s ease-in-out infinite",
        shimmer: "shimmerWarm 2.1s linear infinite",
        shimmerWarm: "shimmerWarm 2.1s linear infinite",
        orbPulse: "orbPulse 2.8s ease-in-out infinite",
        candleFlicker: "candleFlicker 3s ease-in-out infinite",
        floatUp: "floatUp 8s ease-in-out infinite",
        runeGlow: "runeGlow 2.8s ease-in-out infinite",
        glitch: "glitch 2s infinite",
        mintFlash: "mintFlash 1.2s ease-out forwards",
        scanLine: "scanLine 1.4s cubic-bezier(0.4,0,0.2,1) forwards",
        fractureScan: "fractureScan 1.8s linear infinite",
        typingBounce: "typingBounce 1.4s ease-in-out infinite",
        pageFadeIn: "pageFadeIn 0.35s ease-out both",
        // New dark-fantasy animations
        inkReveal: "inkReveal 0.7s cubic-bezier(0.22,1,0.36,1) both",
        soulAwaken: "soulAwaken 4s ease-in-out infinite",
        forgeFlare: "forgeFlare 0.6s ease-out forwards",
        arcaneRipple: "arcaneRipple 1.2s ease-out forwards",
        glyphRotate: "glyphRotate 12s linear infinite",
        pulseGold: "pulseGold 2.4s ease-in-out infinite",
        typewriterCursor: "typewriterCursor 0.9s steps(2,end) infinite",
        messageSlideIn: "messageSlideIn 0.32s cubic-bezier(0.34,1.56,0.64,1) both",
        flagPulseHigh: "flagPulseHigh 2s ease-in-out infinite",
      },
      keyframes: {
        goldShimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        shimmerWarm: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        orbPulse: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        candleFlicker: {
          "0%, 100%": { opacity: "1", filter: "brightness(1)" },
          "20%": { opacity: "0.92", filter: "brightness(0.96)" },
          "40%": { opacity: "0.97", filter: "brightness(1.03)" },
          "60%": { opacity: "0.88", filter: "brightness(0.94)" },
          "80%": { opacity: "0.95", filter: "brightness(1.01)" },
        },
        floatUp: {
          "0%": { transform: "translateY(0) translateX(0) scale(1)", opacity: "0" },
          "8%": { opacity: "0.9" },
          "85%": { opacity: "0.5" },
          "100%": {
            transform: "translateY(-110px) translateX(var(--drift,18px)) scale(0.5)",
            opacity: "0",
          },
        },
        runeGlow: {
          "0%, 100%": {
            boxShadow: "0 0 8px rgba(212,168,83,0.3), 0 0 20px rgba(212,168,83,0.1)",
          },
          "50%": {
            boxShadow: "0 0 16px rgba(212,168,83,0.55), 0 0 40px rgba(212,168,83,0.2)",
          },
        },
        glitch: {
          "0%, 100%": { textShadow: "2px 0 rgb(192,74,74), -2px 0 rgba(212,168,83,0.6)" },
          "25%": { textShadow: "-2px 0 rgb(192,74,74), 2px 0 rgba(212,168,83,0.6)" },
          "50%": { textShadow: "1px 2px rgb(192,74,74), -1px -2px rgba(212,168,83,0.6)" },
          "75%": { textShadow: "-1px 0 rgb(192,74,74), 1px 0 rgba(212,168,83,0.6)" },
        },
        mintFlash: {
          "0%": { color: "rgb(212,168,83)" },
          "60%": { color: "rgb(212,168,83)" },
          "100%": { color: "rgb(240,234,216)" },
        },
        scanLine: {
          "0%": { top: "0", opacity: "1" },
          "95%": { top: "100%", opacity: "1" },
          "100%": { top: "100%", opacity: "0" },
        },
        fractureScan: {
          "0%": { backgroundPosition: "-100% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        typingBounce: {
          "0%, 60%, 100%": { transform: "translateY(0)" },
          "30%": { transform: "translateY(-4px)" },
        },
        pageFadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        inkReveal: {
          "from": { clipPath: "inset(0 100% 0 0)" },
          "to": { clipPath: "inset(0 0% 0 0)" },
        },
        soulAwaken: {
          "0%, 100%": { boxShadow: "0 0 0 2px rgba(126,109,242,0.4), 0 0 20px rgba(126,109,242,0.25), 0 0 40px rgba(126,109,242,0.08)" },
          "50%": { boxShadow: "0 0 0 2px rgba(196,168,106,0.45), 0 0 20px rgba(196,168,106,0.28), 0 0 40px rgba(196,168,106,0.1)" },
        },
        forgeFlare: {
          "from": { transform: "scale(0)", opacity: "0.8" },
          "to": { transform: "scale(2.2)", opacity: "0" },
        },
        arcaneRipple: {
          "from": { transform: "scale(0.5)", opacity: "0.8" },
          "to": { transform: "scale(2.2)", opacity: "0" },
        },
        glyphRotate: {
          "from": { transform: "rotate(0deg)" },
          "to": { transform: "rotate(360deg)" },
        },
        pulseGold: {
          "0%, 100%": { textShadow: "0 0 0px rgba(196,168,106,0)" },
          "50%": { textShadow: "0 0 18px rgba(196,168,106,0.7), 0 0 40px rgba(196,168,106,0.25)" },
        },
        typewriterCursor: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        messageSlideIn: {
          "from": { opacity: "0", transform: "translateX(-12px) scale(0.97)" },
          "to": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        flagPulseHigh: {
          "0%, 100%": { borderLeftColor: "rgba(192,74,74,0.5)", boxShadow: "-2px 0 8px rgba(192,74,74,0.15)" },
          "50%": { borderLeftColor: "rgba(255,100,100,0.85)", boxShadow: "-4px 0 16px rgba(192,74,74,0.4)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
