"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { motion, AnimatePresence } from "framer-motion";
import { AlignCenter, Bold, Heading2, Italic, List, Maximize2, Minimize2, Quote, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { LoreList } from "@/components/lore/lore-list";
import { ProcessingStatus, type ProcessingStep } from "@/components/lore/processing-status";
import { DestructiveActionModal } from "@/components/shared/destructive-action-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { LoreEntry } from "@/lib/types";
import { stripHtml } from "@/lib/utils";

const baseSteps: ProcessingStep[] = [
  { id: "saved", label: "Saving this lore entry...", status: "idle" },
  { id: "chunking", label: "Chunking your writing...", status: "idle" },
  { id: "embedding", label: "Embedding into world memory...", status: "idle" },
  { id: "entities", label: "Extracting characters & locations...", status: "idle" },
  { id: "complete", label: "Your world remembers.", status: "idle" },
];

// Max words for progress ring (full circle)
const RING_MAX = 400;
const RING_R = 10;
const RING_CIRC = 2 * Math.PI * RING_R;

export function LoomEditor({
  worldId,
  initialEntries,
  isReadonly,
}: {
  worldId: string;
  initialEntries: LoreEntry[];
  isReadonly?: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [selectedEntry, setSelectedEntry] = useState<LoreEntry | null>(null);
  const [title, setTitle] = useState(selectedEntry?.title ?? "");
  const [steps, setSteps] = useState(baseSteps);
  const [processing, setProcessing] = useState(false);
  const [deletingLore, setDeletingLore] = useState<{ id: string; title: string } | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [typewriterMode, setTypewriterMode] = useState(false);
  const [editorHasFocus, setEditorHasFocus] = useState(false);
  const [oracleWhispering, setOracleWhispering] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleDeleteLore = async () => {
    if (!deletingLore) return;
    try {
      const res = await fetch(`/api/lore/${deletingLore.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete lore.");
      setEntries((prev) => prev.filter((e) => e.id !== deletingLore.id));
      if (selectedEntry?.id === deletingLore.id) {
        setSelectedEntry(null);
        editor?.commands.clearContent();
        setTitle("");
      }
      toast.success("Lore entry permanently deleted.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete lore entry.");
    } finally {
      setDeletingLore(null);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder:
          "Write the places, people, rules, and histories that make this world coherent. Grimoire will remember the shape of what you mean.",
      }),
      CharacterCount,
    ],
    content: selectedEntry?.content ?? "",
    editorProps: {
      attributes: { class: "tiptap-loom" },
    },
    immediatelyRender: false,
  });

  // Auto-select first entry in read-only (demo) mode so word count and content are visible
  useEffect(() => {
    if (isReadonly && initialEntries.length > 0 && !selectedEntry) {
      setSelectedEntry(initialEntries[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editor) {
      editor.commands.setContent(selectedEntry?.content ?? "");
      setTitle(selectedEntry?.title ?? "");
    }
  }, [editor, selectedEntry]);

  const currentWordCount = useMemo(
    () => wordCount(stripHtml(editor?.getHTML() ?? "")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, editor?.state],
  );

  const readingTimeMin = Math.max(1, Math.round(currentWordCount / 200));
  const ringProgress = Math.min(1, currentWordCount / RING_MAX);
  const ringDash = ringProgress * RING_CIRC;
  const ringColor =
    currentWordCount === 0
      ? "rgba(255,255,255,0.1)"
      : currentWordCount < 80
        ? "rgba(192,74,74,0.7)"
        : currentWordCount < 200
          ? "rgb(212,168,83)"
          : "rgb(124,92,191)";

  // Track editor focus for Oracle CTA visibility
  useEffect(() => {
    if (!editor) return;
    const onFocus = () => setEditorHasFocus(true);
    const onBlur = () => setEditorHasFocus(false);
    editor.on("focus", onFocus);
    editor.on("blur", onBlur);
    return () => { editor.off("focus", onFocus); editor.off("blur", onBlur); };
  }, [editor]);

  // Writing stats derived from content
  const writingStats = useMemo(() => {
    const text = stripHtml(editor?.getHTML() ?? "").trim();
    if (!text) return null;
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 3).length;
    const paragraphs = (editor?.getHTML() ?? "").split(/<\/p>|<\/h[1-6]>/).filter(Boolean).length;
    const avgSentenceLen = sentences > 0 ? Math.round(currentWordCount / sentences) : 0;
    return { paragraphs, sentences, avgSentenceLen };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, editor?.state, currentWordCount]);

  const updateStep = (id: ProcessingStep["id"], status: ProcessingStep["status"]) => {
    setSteps((current) => current.map((step) => (step.id === id ? { ...step, status } : step)));
  };

  const resetSteps = () => setSteps(baseSteps);

  // Typewriter scroll: keep cursor at 55% from top of the scroll container
  useEffect(() => {
    if (!typewriterMode || !editor) return;
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const container = scrollContainerRef.current;
      if (!container) {
        const targetY = rect.bottom - window.innerHeight * 0.55;
        window.scrollBy({ top: targetY, behavior: "smooth" });
      } else {
        const containerRect = container.getBoundingClientRect();
        const targetY = rect.bottom - containerRect.top - container.clientHeight * 0.55;
        container.scrollBy({ top: targetY, behavior: "smooth" });
      }
    };
    editor.on("update", handler);
    return () => { editor.off("update", handler); };
  }, [typewriterMode, editor]);

  const handleOracleWhisper = useCallback(async () => {
    if (!editor || isReadonly || oracleWhispering) return;
    const text = stripHtml(editor.getHTML());
    if (!text.trim()) return;
    setOracleWhispering(true);
    try {
      const res = await fetch("/api/lore/autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId, content: text }),
      });
      if (!res.ok) throw new Error("Oracle is silent.");
      const data = await res.json();
      const suggestion = data.suggestion ?? data.continuation ?? "";
      if (suggestion) {
        editor.chain().focus().insertContent(" " + suggestion).run();
        toast.success("The Oracle whispers into your quill.");
      }
    } catch {
      toast.error("The Oracle is silent right now.");
    } finally {
      setOracleWhispering(false);
    }
  }, [editor, isReadonly, oracleWhispering, worldId]);

  const submit = useCallback(async () => {
    if (!editor || isReadonly) return;
    const html = editor.getHTML();
    const text = stripHtml(html);

    if (!text.trim()) {
      toast.error("Write at least a few lines before saving.");
      return;
    }

    setProcessing(true);
    resetSteps();

    try {
      const entryTitle = title.trim() || text.split(".")[0]?.slice(0, 48) || "Untitled";

      const response = await fetch("/api/lore/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worldId,
          title: entryTitle,
          content: text,
          entryId: selectedEntry?.id,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json();
        throw new Error(payload.error || "Lore ingest failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const lines = event.split("\n");
          const eventName = lines
            .find((line) => line.startsWith("event:"))
            ?.replace("event:", "")
            .trim();
          const dataLine = lines
            .find((line) => line.startsWith("data:"))
            ?.replace("data:", "")
            .trim();
          const payload = dataLine ? JSON.parse(dataLine) : undefined;

          if (eventName === "saved") updateStep("saved", "complete");
          if (eventName === "chunking") updateStep("chunking", "active");
          if (eventName === "embedding_progress") {
            updateStep("chunking", "complete");
            updateStep("embedding", "active");
          }
          if (eventName === "embedding_complete") updateStep("embedding", "complete");
          if (eventName === "entity_extraction") updateStep("entities", "active");
          if (eventName === "complete") {
            updateStep("entities", "complete");
            updateStep("complete", "complete");
            if (payload?.entry) {
              const nextEntries = [
                payload.entry as LoreEntry,
                ...entries.filter((e) => e.id !== payload.entry.id),
              ];
              setEntries(nextEntries);
              setSelectedEntry(payload.entry);
            }
            toast.success("Lore woven into memory.");
          }
          if (eventName === "error") {
            throw new Error(payload?.error || "Lore ingest failed.");
          }
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lore ingest failed.");
    } finally {
      setProcessing(false);
    }
  }, [editor, isReadonly, title, worldId, selectedEntry, entries]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!processing && !isReadonly) submit();
      }
      if (e.key === "Escape" && focusMode) {
        e.preventDefault();
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submit, processing, isReadonly, focusMode]);

  // Gold when active, not purple
  const toolbarButton = (active: boolean) =>
    active
      ? "bg-[rgba(212,168,83,0.12)] text-[rgb(212,168,83)]"
      : "text-secondary hover:bg-[rgba(255,255,255,0.03)] hover:text-foreground";

  return (
    <div className="space-y-8 pb-24">
      <Card className="rounded-[32px] p-5 sm:p-6">
        {/* ── Header ── */}
        <div className="mb-4 flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="chapter-label">Lore · The Loom</p>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-secondary">
              Write freely. Every paragraph becomes structured, searchable memory.
            </p>
          </div>

          {!isReadonly ? (
            <Button onClick={submit} disabled={processing}>
              {processing ? (
                <>
                  <span
                    className="h-4 w-4 rounded-full border-t-2 border-[rgb(212,168,83)] animate-spin"
                    style={{
                      borderRightColor: "transparent",
                      borderBottomColor: "transparent",
                      borderLeftColor: "transparent",
                    }}
                  />
                  Inscribing...
                </>
              ) : (
                "Inscribe & Remember"
              )}
            </Button>
          ) : null}
        </div>

        {/* ── Toolbar ── */}
        <div className="mb-4 flex items-center gap-1 overflow-x-auto pb-1">
          {[
            {
              icon: <Bold className="h-4 w-4" />,
              active: Boolean(editor?.isActive("bold")),
              action: () => editor?.chain().focus().toggleBold().run(),
            },
            {
              icon: <Italic className="h-4 w-4" />,
              active: Boolean(editor?.isActive("italic")),
              action: () => editor?.chain().focus().toggleItalic().run(),
            },
            {
              icon: <Heading2 className="h-4 w-4" />,
              active: Boolean(editor?.isActive("heading", { level: 2 })),
              action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
            },
            {
              icon: <Quote className="h-4 w-4" />,
              active: Boolean(editor?.isActive("blockquote")),
              action: () => editor?.chain().focus().toggleBlockquote().run(),
            },
            {
              icon: <List className="h-4 w-4" />,
              active: Boolean(editor?.isActive("bulletList")),
              action: () => editor?.chain().focus().toggleBulletList().run(),
            },
          ].map((btn, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                btn.action();
              }}
              className={`shrink-0 rounded-xl px-3 py-2 transition ${toolbarButton(btn.active)}`}
            >
              {btn.icon}
            </button>
          ))}

          {/* Word count + reading time + SVG ring + focus mode */}
          <div className="ml-auto flex shrink-0 items-center gap-2 text-xs text-secondary">
            {currentWordCount >= 50 ? (
              <span className="text-secondary">~{readingTimeMin} min read</span>
            ) : null}
            <motion.span key={currentWordCount} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
              {currentWordCount} words
            </motion.span>
            <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0 -rotate-90">
              <circle
                cx="14"
                cy="14"
                r={RING_R}
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="2.5"
              />
              <circle
                cx="14"
                cy="14"
                r={RING_R}
                fill="none"
                stroke={ringColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${ringDash} ${RING_CIRC}`}
                style={{ transition: "stroke-dasharray 0.3s ease, stroke 0.3s ease" }}
              />
            </svg>
            {!isReadonly && (
              <button
                type="button"
                onClick={() => setFocusMode(true)}
                className="ml-1 shrink-0 rounded-xl px-2.5 py-2 text-secondary transition hover:bg-[var(--surface-raised)] hover:text-foreground"
                title="Enter the Loom (focus mode)"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Writing stats strip ── */}
        <AnimatePresence>
          {writingStats && currentWordCount > 10 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="mb-4 flex flex-wrap items-center gap-2"
            >
              {[
                { label: "Paragraphs", value: writingStats.paragraphs },
                { label: "Sentences", value: writingStats.sentences },
                { label: "Avg length", value: `${writingStats.avgSentenceLen}w` },
                { label: "Read time", value: `~${readingTimeMin}m` },
              ].map(({ label, value }) => (
                <span
                  key={label}
                  className="glass-panel rounded-lg px-3 py-1 text-[11px] text-[var(--text-muted)]"
                >
                  <span className="mr-1.5 text-[var(--text-main)]">{value}</span>
                  {label}
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Editor surface ── */}
        <div className="rounded-[28px] border border-border bg-[color-mix(in_srgb,var(--bg)_72%,transparent)]">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Entry title..."
            readOnly={isReadonly}
            className="w-full border-b border-border bg-transparent px-6 py-5 font-heading text-3xl text-foreground outline-none placeholder:text-[rgba(150,130,100,0.35)] read-only:cursor-default read-only:opacity-60 sm:text-4xl"
          />
          <div className="relative px-6 py-6">
            <AnimatePresence>
              {processing ? (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="scan-line"
                  />
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="scan-line"
                    style={{ animationDelay: "0.3s" }}
                  />
                </>
              ) : null}
            </AnimatePresence>
            <EditorContent editor={editor} />
          </div>
        </div>

        {!isReadonly ? (
          <p className="mt-4 text-xs text-secondary">
            Tip: `Ctrl / Cmd + S` to inscribe and process your latest page.
          </p>
        ) : null}
      </Card>

      <AnimatePresence>
        {processing ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <ProcessingStatus steps={steps} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="chapter-label">Archive</p>
            <h2 className="font-heading text-4xl text-foreground">The Scribe&apos;s Record</h2>
          </div>
          {!isReadonly ? (
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedEntry(null);
                editor?.commands.setContent("");
                setTitle("");
              }}
            >
              New entry
            </Button>
          ) : null}
        </div>
        <LoreList
          entries={entries}
          onSelect={setSelectedEntry}
          selectedEntryId={selectedEntry?.id}
          isReadonly={isReadonly}
          onDelete={(id, title) => setDeletingLore({ id, title: title || "Untitled Scroll" })}
        />
      </div>

      <DestructiveActionModal
        open={!!deletingLore}
        onOpenChange={(open) => !open && setDeletingLore(null)}
        title="Burn the Scroll"
        description={`Are you sure you want to permanently erase "${deletingLore?.title}" from the world's memory? Extracted entities will remain, but this raw lore will be gone forever.`}
        requireString={`burn ${deletingLore?.title}`}
        onConfirm={handleDeleteLore}
        isDemo={isReadonly}
      />

      {/* ── Oracle's Whisper floating CTA ── */}
      <AnimatePresence>
        {editorHasFocus && currentWordCount > 20 && !isReadonly && !focusMode && (
          <motion.button
            type="button"
            onClick={handleOracleWhisper}
            disabled={oracleWhispering}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="glass-panel-elevated fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full px-5 py-3 text-sm text-[var(--accent)] transition-colors hover:text-[var(--text-main)] disabled:opacity-50 active:scale-[0.97] active:transition-none"
          >
            <Sparkles className={`h-4 w-4 ${oracleWhispering ? "animate-spin" : ""}`} />
            {oracleWhispering ? "Oracle speaks…" : "Oracle whispers…"}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Focus / Distraction-free mode overlay ── */}
      <AnimatePresence>
        {focusMode && (
          <motion.div
            className="fixed inset-0 z-[60] flex flex-col"
            style={{ background: "var(--bg)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {/* Atmospheric depth gradient layers */}
            <div
              className="pointer-events-none absolute inset-0 z-0"
              style={{
                backgroundImage: [
                  "radial-gradient(ellipse 100% 60% at 50% 100%, color-mix(in srgb, var(--accent) 5%, transparent), transparent 60%)",
                  "radial-gradient(ellipse 70% 50% at 10% 20%, color-mix(in srgb, var(--ai-pulse) 4%, transparent), transparent 55%)",
                  "radial-gradient(ellipse 60% 40% at 90% 10%, color-mix(in srgb, var(--accent-soft) 3%, transparent), transparent 50%)",
                ].join(", "),
              }}
            />

            {/* Minimal top bar */}
            <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-[var(--border)] px-8 py-4">
              <p className="chapter-label">— The Loom —</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)]">{currentWordCount} words</span>
                <button
                  type="button"
                  onClick={() => setTypewriterMode((v) => !v)}
                  title={typewriterMode ? "Disable typewriter scroll" : "Enable typewriter scroll"}
                  className={`rounded-lg p-2 transition ${typewriterMode ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}
                >
                  <AlignCenter className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setFocusMode(false)}
                  className="rounded-lg p-2 text-[var(--text-muted)] transition hover:text-[var(--text-main)]"
                  title="Exit focus mode (Esc)"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Centred editor */}
            <div ref={scrollContainerRef} className="relative z-10 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-2xl px-8 py-10">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Entry title..."
                  className="mb-8 w-full border-b border-[var(--border)] bg-transparent pb-4 font-heading text-4xl text-[var(--text-main)] outline-none placeholder:text-[var(--text-muted)] placeholder:opacity-40"
                />
                <EditorContent editor={editor} />
              </div>
            </div>

            {/* Minimal bottom bar */}
            <div className="relative z-10 flex shrink-0 items-center justify-center gap-4 border-t border-[var(--border)] px-8 py-4">
              {!isReadonly && (
                <Button size="sm" onClick={submit} disabled={processing}>
                  {processing ? "Inscribing..." : "Inscribe & Remember"}
                </Button>
              )}
              <span className="text-xs text-[var(--text-muted)]">Esc to exit the Loom</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
