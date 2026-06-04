"use client";

import { type Editor } from "@tiptap/react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Bold, Italic, Heading2, Quote, X, Save } from "lucide-react";
import { useToolbarVisibility } from "@/lib/hooks/use-toolbar-visibility";
import { cn } from "@/lib/utils";

interface ImmersiveToolbarProps {
  editor: Editor | null;
  wordCount: number;
  onSave: () => void;
  onExit: () => void;
  isProcessing: boolean;
  isSaved: boolean;
}

const toolbarVariants: Variants = {
  hidden: { opacity: 0, y: 20, transition: { duration: 0.2, ease: "easeIn" } },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};

const TOOLBAR_BTN = (active: boolean) =>
  cn(
    "flex items-center justify-center rounded-md w-8 h-8 transition-colors",
    "text-[var(--text-muted)]",
    "hover:text-[var(--text-main)] hover:bg-white/10",
    "active:scale-95 active:transition-none",
    active && "bg-white/15 !text-[var(--accent)]"
  );

export function ImmersiveToolbar({
  editor,
  wordCount,
  onSave,
  onExit,
  isProcessing,
  isSaved,
}: ImmersiveToolbarProps) {
  const { isVisible, resetTimer } = useToolbarVisibility(3000);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          variants={toolbarVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onMouseEnter={resetTimer}
          onMouseMove={resetTimer}
          className="fixed bottom-6 left-1/2 z-[10000] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl px-4 py-2 shadow-2xl"
        >
          {/* Formatting controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Bold"
              className={TOOLBAR_BTN(Boolean(editor?.isActive("bold")))}
              onMouseDown={(e) => {
                e.preventDefault();
                editor?.chain().focus().toggleBold().run();
              }}
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Italic"
              className={TOOLBAR_BTN(Boolean(editor?.isActive("italic")))}
              onMouseDown={(e) => {
                e.preventDefault();
                editor?.chain().focus().toggleItalic().run();
              }}
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Heading"
              className={TOOLBAR_BTN(Boolean(editor?.isActive("heading", { level: 2 })))}
              onMouseDown={(e) => {
                e.preventDefault();
                editor?.chain().focus().toggleHeading({ level: 2 }).run();
              }}
            >
              <Heading2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Quote"
              className={TOOLBAR_BTN(Boolean(editor?.isActive("blockquote")))}
              onMouseDown={(e) => {
                e.preventDefault();
                editor?.chain().focus().toggleBlockquote().run();
              }}
            >
              <Quote className="h-4 w-4" />
            </button>
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-white/15" />

          {/* Word count */}
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>

          {/* Divider */}
          <div className="h-5 w-px bg-white/15" />

          {/* Save status */}
          <button
            type="button"
            title="Save"
            className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              if (!isProcessing) onSave();
            }}
            disabled={isProcessing}
          >
            <Save className="h-3.5 w-3.5" />
            {isSaved ? "Saved ✓" : "Unsaved"}
          </button>

          {/* Divider */}
          <div className="h-5 w-px bg-white/15" />

          {/* Exit button */}
          <button
            type="button"
            title="Exit immersive mode"
            className="flex items-center justify-center rounded-md w-8 h-8 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/10 transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              onExit();
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
