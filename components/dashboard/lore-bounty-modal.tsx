"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { X, ScrollText, Sparkles, CheckSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BountyHole {
  entity: string;
  missing: string;
  suggestion: string;
}

interface LoreBountyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bounty: BountyHole | null;
  worldId: string;
  onResolved?: () => void;
}



export function LoreBountyModal({
  open,
  onOpenChange,
  bounty,
  worldId,
  onResolved,
}: LoreBountyModalProps) {
  const [seeding, setSeeding] = useState(false);
  const [inscribing, setInscribing] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "The Oracle is conjuring a starting verse for you…",
      }),
    ],
    editorProps: {
      attributes: {
        class: "tiptap-loom min-h-[160px] outline-none text-sm leading-7 text-[var(--text-main)]",
      },
    },
    immediatelyRender: false,
  });

  // Seed starting sentences whenever the modal opens with a bounty
  useEffect(() => {
    if (!open || !bounty || !editor) return;

    editor.commands.clearContent();
    setSeeding(true);

    const prompt = `You are inscribing lore for a dark fantasy world. Write 2–3 opening sentences that begin a lore entry about "${bounty.entity}" — specifically focusing on: ${bounty.missing}. 
The tone should be evocative, third-person, past-tense. Do not use generic fantasy clichés. Output only the prose — no headers, no labels.`;

    fetch("/api/lore/autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worldId, content: prompt }),
    })
      .then((res) => res.json())
      .then((data) => {
        const suggestion = data.suggestion ?? data.continuation ?? "";
        if (suggestion && editor) {
          editor.commands.setContent(`<p>${suggestion}</p>`);
          // Move cursor to end
          editor.commands.focus("end");
        }
      })
      .catch(() => {
        // Silently fail — user can write from scratch
      })
      .finally(() => setSeeding(false));
  }, [open, bounty, editor, worldId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    if (inscribing) return;
    onOpenChange(false);
    setTimeout(() => editor?.commands.clearContent(), 300);
  };

  const handleInscribe = async () => {
    if (!editor || !bounty || inscribing) return;
    const html = editor.getHTML();
    const text = html.replace(/<[^>]+>/g, "").trim();
    if (!text || text.length < 20) {
      toast.error("Write at least a few lines before inscribing.");
      return;
    }

    setInscribing(true);
    try {
      const title = `${bounty.entity}: ${bounty.missing}`.slice(0, 70);
      const res = await fetch("/api/lore/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId, title, content: text }),
      });
      if (!res.ok) throw new Error("Inscribe failed");
      // Synchronous ingest streams progress as SSE; drain the body so the
      // server-side processing (chunk -> embed -> store) runs to completion
      // even though this caller doesn't render progress.
      await res.text();
      toast.success(`Bounty claimed — "${title}" inscribed to the archive.`, { duration: 3500 });
      onResolved?.();
      onOpenChange(false);
    } catch {
      toast.error("The ink failed to dry. Try again.");
    } finally {
      setInscribing(false);
    }
  };

  return (
    <AnimatePresence>
      {open && bounty && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Panel */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="glass-panel-elevated w-full max-w-xl overflow-hidden rounded-[24px] shadow-arcane"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-[var(--border)] p-6 pb-5">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]">
                      <ScrollText className="h-4 w-4 text-[var(--accent)]" />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--accent)] font-bold">
                      Lore Bounty
                    </span>
                  </div>
                  <h2 className="font-heading text-2xl text-[var(--text-main)]">{bounty.entity}</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    <span className="text-[var(--danger)]">Missing:</span> {bounty.missing}
                  </p>
                  <p className="mt-2 rounded-xl bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] border border-[var(--border)] px-3 py-2 text-xs italic text-[var(--text-muted)]">
                    {bounty.suggestion}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="ml-4 shrink-0 rounded-xl p-2 text-[var(--text-muted)] transition-colors hover:bg-[color-mix(in_srgb,var(--text-main)_8%,transparent)] hover:text-[var(--text-main)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Editor area */}
              <div className="relative p-6">
                {seeding && (
                  <div className="absolute inset-x-6 top-6 z-10 flex items-center gap-2 text-xs text-[var(--ai-pulse)]">
                    <Sparkles className="h-3 w-3 animate-pulse" />
                    The Oracle is inscribing a starting verse…
                  </div>
                )}
                <div
                  className={cn(
                    "writing-paper rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] px-5 py-4 transition-opacity",
                    seeding && "opacity-40 pointer-events-none",
                  )}
                >
                  <EditorContent editor={editor} />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
                <button
                  onClick={handleClose}
                  disabled={inscribing}
                  className="rounded-xl px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)] disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInscribe}
                  disabled={inscribing || seeding}
                  className="flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-5 py-2 text-sm font-medium text-[var(--accent)] transition-all hover:bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] active:scale-[0.97] active:transition-none disabled:opacity-40"
                >
                  {inscribing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckSquare className="h-3.5 w-3.5" />
                  )}
                  {inscribing ? "Inscribing…" : "Inscribe & Claim Bounty"}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
