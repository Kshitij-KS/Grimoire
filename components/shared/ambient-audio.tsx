"use client";

import { useEffect, useRef, useCallback } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Volume2, VolumeX } from "lucide-react";

// ── Ambient Audio Store ──
interface AmbientStore {
  enabled: boolean;
  volume: number;
  toggle: () => void;
  setVolume: (v: number) => void;
}

export const useAmbientStore = create<AmbientStore>()(
  persist(
    (set) => ({
      enabled: false,
      volume: 0.05,
      toggle: () => set((s) => ({ enabled: !s.enabled })),
      setVolume: (volume) => set({ volume }),
    }),
    { name: "grimoire-ambient" },
  ),
);

// ── Ambient Audio Provider ──
// Place this in the root layout so it persists across routes
export function AmbientAudioProvider() {
  const { enabled, volume } = useAmbientStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element once
    if (!audioRef.current) {
      const audio = new Audio();
      // We'll generate a subtle ambient tone using Web Audio API fallback
      audio.loop = true;
      audio.volume = volume;
      audioRef.current = audio;
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Use Web Audio API for generated ambient sound
  useEffect(() => {
    if (!enabled) {
      audioRef.current?.pause();
      return;
    }

    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const nodes: AudioNode[] = [];

    // Create a very subtle ambient pad
    const createAmbientNode = (freq: number, gain: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "sine";
      osc.frequency.value = freq;

      filter.type = "lowpass";
      filter.frequency.value = 200;
      filter.Q.value = 1;

      g.gain.value = gain * volume;

      osc.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      osc.start();

      nodes.push(osc, g, filter);
      return { osc, gain: g };
    };

    // Very subtle low frequency pads
    createAmbientNode(55, 0.008);
    createAmbientNode(82.5, 0.005);
    createAmbientNode(110, 0.003);

    // Add subtle noise (like crackling fire)
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.002;
    }

    const noiseSource = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();

    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 3000;
    noiseFilter.Q.value = 0.5;
    noiseGain.gain.value = volume * 0.3;

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start();

    return () => {
      ctx.close();
    };
  }, [enabled, volume]);

  return null; // No visual output — this is audio-only
}

// ── Toggle Button ──
export function AmbientToggle() {
  const { enabled, toggle } = useAmbientStore();

  const handleToggle = useCallback(() => {
    toggle();
  }, [toggle]);

  return (
    <button
      onClick={handleToggle}
      className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all duration-200 ${
        enabled
          ? "border-[var(--gold)]33 bg-[rgba(196,168,106,0.12)] text-[var(--gold)]"
          : "border-border bg-[rgba(255,255,255,0.03)] text-dim hover:text-secondary"
      }`}
      title={enabled ? "Disable atmosphere" : "Enable atmosphere"}
    >
      {enabled ? (
        <Volume2 className="h-3.5 w-3.5" />
      ) : (
        <VolumeX className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
