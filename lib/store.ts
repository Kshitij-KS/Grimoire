"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Entity, Soul } from "@/lib/types";
import type { WorldSection } from "@/lib/constants";

interface LimitModalState {
  open: boolean;
  action?: string;
  limit?: number;
}

interface WorkspaceStore {
  section: WorldSection;
  rightPanelOpen: boolean;
  selectedEntity: Entity | null;
  selectedSoul: Soul | null;
  limitModal: LimitModalState;
  forgeSoulName: string | null;
  autoSaveDraft: string | null;
  loreDetectedToast: { show: boolean; summary: string | null };
  setSection: (section: WorldSection) => void;
  setRightPanelOpen: (open: boolean) => void;
  setSelectedEntity: (entity: Entity | null) => void;
  setSelectedSoul: (soul: Soul | null) => void;
  showLimitModal: (action?: string, limit?: number) => void;
  hideLimitModal: () => void;
  setForgeSoulName: (name: string | null) => void;
  setAutoSaveDraft: (draft: string | null) => void;
  showLoreDetected: (summary: string) => void;
  hideLoreDetected: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  section: "lore",
  rightPanelOpen: true,
  selectedEntity: null,
  selectedSoul: null,
  limitModal: { open: false },
  forgeSoulName: null,
  autoSaveDraft: null,
  loreDetectedToast: { show: false, summary: null },
  setSection: (section) => set({ section }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setSelectedEntity: (selectedEntity) => set({ selectedEntity }),
  setSelectedSoul: (selectedSoul) => set({ selectedSoul }),
  showLimitModal: (action, limit) =>
    set({ limitModal: { open: true, action, limit } }),
  hideLimitModal: () => set({ limitModal: { open: false } }),
  setForgeSoulName: (forgeSoulName) => set({ forgeSoulName }),
  setAutoSaveDraft: (autoSaveDraft) => set({ autoSaveDraft }),
  showLoreDetected: (summary) =>
    set({ loreDetectedToast: { show: true, summary } }),
  hideLoreDetected: () =>
    set({ loreDetectedToast: { show: false, summary: null } }),
}));

// ── Offline-first auto-save store ──
interface DraftStore {
  drafts: Record<string, { title: string; content: string; savedAt: number }>;
  saveDraft: (entryId: string, title: string, content: string) => void;
  getDraft: (entryId: string) => { title: string; content: string } | null;
  clearDraft: (entryId: string) => void;
}

export const useDraftStore = create<DraftStore>()(
  persist(
    (set, get) => ({
      drafts: {},
      saveDraft: (entryId, title, content) =>
        set((state) => ({
          drafts: {
            ...state.drafts,
            [entryId]: { title, content, savedAt: Date.now() },
          },
        })),
      getDraft: (entryId) => {
        const draft = get().drafts[entryId];
        if (!draft) return null;
        // Discard drafts older than 24 hours
        if (Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) return null;
        return { title: draft.title, content: draft.content };
      },
      clearDraft: (entryId) =>
        set((state) => {
          const newDrafts = { ...state.drafts };
          delete newDrafts[entryId];
          return { drafts: newDrafts };
        }),
    }),
    { name: "grimoire-drafts" },
  ),
);
