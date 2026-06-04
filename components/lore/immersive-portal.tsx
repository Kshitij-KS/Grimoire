"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { EditorContent, type Editor } from "@tiptap/react";
import { useFullscreen } from "@/lib/hooks/use-fullscreen";
import { useImmersiveKeyboard } from "@/lib/hooks/use-immersive-keyboard";
import { useFocusModeStore } from "@/lib/stores/focus-mode-store";
import { AmbientLayer } from "@/components/lore/ambient-layer";
import { ImmersiveToolbar } from "@/components/lore/immersive-toolbar";

// ── Types ──

interface ImmersivePortalProps {
  editor: Editor | null;
  wordCount: number;
  onSave: () => void;
  onExit: () => void;
  isProcessing: boolean;
  isSaved: boolean;
  isReadonly?: boolean;
}

// ── Framer Motion Variants ──

const portalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.98,
    filter: "blur(8px)",
  },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 1.01,
    filter: "blur(4px)",
    transition: {
      duration: 0.25,
      ease: [0.77, 0, 0.175, 1],
    },
  },
};

// Reduced-motion variant — immediate opacity, no scale/blur
const reducedMotionVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: { duration: 0 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.25 },
  },
};

// ── Component ──

export function ImmersivePortal({
  editor,
  wordCount,
  onSave,
  onExit,
  isProcessing,
  isSaved,
  isReadonly,
}: ImmersivePortalProps) {
  const { ambientIntensity } = useFocusModeStore();
  const { enter, exit } = useFullscreen();
  const reducedMotionRef = useRef(false);
  const isActive = !isReadonly;

  // Detect prefers-reduced-motion on mount
  useEffect(() => {
    reducedMotionRef.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Enter fullscreen on mount, exit on unmount/exit
  useEffect(() => {
    if (!isActive) return;
    enter();
    return () => {
      exit();
    };
  }, [isActive, enter, exit]);

  // Register immersive keyboard shortcuts
  useImmersiveKeyboard({
    isImmersive: isActive,
    onExit,
    onSave,
    isSaving: isProcessing,
  });

  // Block rendering if editor is in readonly mode
  if (!isActive) return null;

  const variants = reducedMotionRef.current
    ? reducedMotionVariants
    : portalVariants;

  const portalContent = (
    <AnimatePresence>
      <motion.div
        key="immersive-portal"
        variants={variants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 z-[9999] flex flex-col items-center bg-[var(--bg)] overflow-hidden"
      >
        {/* Ambient atmospheric layer */}
        <AmbientLayer intensity={ambientIntensity} enabled />

        {/* Writing column — narrow, centered, generous padding */}
        <div className="w-full max-w-[680px] px-8 pt-[12vh] pb-[30vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <EditorContent editor={editor} />
        </div>

        {/* Minimal floating toolbar */}
        <ImmersiveToolbar
          editor={editor}
          wordCount={wordCount}
          onSave={onSave}
          onExit={onExit}
          isProcessing={isProcessing}
          isSaved={isSaved}
        />
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(portalContent, document.body);
}
