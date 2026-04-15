"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { motion, AnimatePresence } from "framer-motion";
import { AlignCenter, Bold, BookOpen, Code, Heading1, Heading2, Heading3, Highlighter, Italic, List, ListOrdered, Maximize2, Minimize2, Minus, Quote, Search, Sparkles, Strikethrough, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { LoreSearchPanel } from "@/components/lore/lore-search-panel";
import { LoreImportModal } from "@/components/lore/lore-import-modal";
import { LoreList } from "@/components/lore/lore-list";
import { ProcessingStatus, type ProcessingStep } from "@/components/lore/processing-status";
import { DestructiveActionModal } from "@/components/shared/destructive-action-modal";
import { Button } from "@/components/ui/button";
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
  const [oracleWhispering, setOracleWhispering] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lastMilestone, setLastMilestone] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchAnchorRef = useRef<HTMLButtonElement>(null);

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
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({
        placeholder:
          "Write the places, people, rules, and histories that make this world coherent. Grimoire will remember the shape of what you mean.",
      }),
      CharacterCount,
    ],
    content: selectedEntry?.content ?? "",
    editorProps: {
      attributes: { class: "tiptap-loom-diary" },
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

  const ringProgress = Math.min(1, currentWordCount / RING_MAX);
  const ringDash = ringProgress * RING_CIRC;
  const ringColor =
    currentWordCount === 0
      ? "color-mix(in srgb, var(--text-main) 10%, transparent)"
      : currentWordCount < 80
        ? "var(--danger)"
        : currentWordCount < 200
          ? "var(--accent)"
          : "var(--primary)";


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

  // Word count milestone toasts
  useEffect(() => {
    if (isReadonly) return;
    const milestones = [100, 500, 1000, 2000];
    for (const m of milestones) {
      if (currentWordCount >= m && lastMilestone < m) {
        setLastMilestone(m);
        toast.success(`${m.toLocaleString()} words inscribed into the archive ✦`, { duration: 2800 });
        break;
      }
    }
    if (currentWordCount < 100 && lastMilestone > 0) setLastMilestone(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWordCount]);

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
      if ((e.ctrlKey || e.metaKey) && e.key === "f" && !focusMode && !isReadonly) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submit, processing, isReadonly, focusMode, setSearchOpen]);

  // Gold when active, not purple
  const toolbarButton = (active: boolean) =>
    active
      ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]"
      : "text-secondary hover:bg-[color-mix(in_srgb,var(--text-main)_4%,transparent)] hover:text-foreground";

  const dateStamp = selectedEntry
    ? new Date(selectedEntry.created_at).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const formatButtons = [
    // Group: Headings / structure
    { icon: <Heading1 className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("heading", { level: 1 })), action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), title: "Chapter (H1)" },
    { icon: <Heading2 className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("heading", { level: 2 })), action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), title: "Section (H2)" },
    { icon: <Heading3 className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("heading", { level: 3 })), action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), title: "Subsection (H3)" },
    // Separator then inline formatting
    { icon: <Bold className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("bold")), action: () => editor?.chain().focus().toggleBold().run(), title: "Bold", sep: true },
    { icon: <Italic className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("italic")), action: () => editor?.chain().focus().toggleItalic().run(), title: "Italic" },
    { icon: <Strikethrough className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("strike")), action: () => editor?.chain().focus().toggleStrike().run(), title: "Strikethrough" },
    { icon: <Highlighter className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("highlight")), action: () => editor?.chain().focus().toggleHighlight().run(), title: "Highlight" },
    { icon: <Code className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("code")), action: () => editor?.chain().focus().toggleCode().run(), title: "Inline code" },
    // Separator then blocks
    { icon: <Quote className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("blockquote")), action: () => editor?.chain().focus().toggleBlockquote().run(), title: "Quote", sep: true },
    { icon: <List className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("bulletList")), action: () => editor?.chain().focus().toggleBulletList().run(), title: "Bullet list" },
    { icon: <ListOrdered className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("orderedList")), action: () => editor?.chain().focus().toggleOrderedList().run(), title: "Numbered list" },
    { icon: <Minus className="h-3.5 w-3.5" />, active: false, action: () => editor?.chain().focus().setHorizontalRule().run(), title: "Chapter break (✦ · ✦)" },
  ] satisfies Array<{ icon: React.ReactNode; active: boolean; action: () => void; title: string; sep?: boolean }>;

  return (
    <div className="relative flex min-h-0 flex-col pb-16">
      {/* ── Entry sidebar (slides in from left) ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] backdrop-blur-[2px]"
            />
            {/* Panel */}
            <motion.aside
              key="sidebar-panel"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="fixed left-0 top-0 z-50 flex h-full w-[min(300px,88vw)] flex-col border-r border-[var(--border)] bg-[var(--surface)] shadow-[4px_0_32px_rgba(0,0,0,0.22)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                <p className="chapter-label">— The Scribe&apos;s Record —</p>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  title="Close entries"
                  className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:text-[var(--text-main)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {!isReadonly && (
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEntry(null);
                      editor?.commands.setContent("");
                      setTitle("");
                      setSidebarOpen(false);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] px-3 py-2 text-sm text-[var(--accent)] transition hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] active:scale-[0.97] active:transition-none"
                  >
                    + New Entry
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                <LoreList
                  entries={entries}
                  onSelect={(entry) => { setSelectedEntry(entry); setSidebarOpen(false); }}
                  selectedEntryId={selectedEntry?.id}
                  isReadonly={isReadonly}
                  onDelete={(id, t) => setDeletingLore({ id, title: t || "Untitled Scroll" })}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Top minimal toolbar ── */}
      <div className="mb-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            title="Browse entries"
            className="flex items-center gap-1.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-[var(--border-focus)] hover:text-[var(--text-main)] active:scale-[0.97] active:transition-none"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Entries{entries.length > 0 ? ` (${entries.length})` : ""}</span>
          </button>

          {!isReadonly && (
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              title="Import .txt or .md files"
              className="flex items-center gap-1.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-[var(--border-focus)] hover:text-[var(--text-main)] active:scale-[0.97] active:transition-none"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Import</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Search */}
          {!isReadonly && (
            <div className="relative">
              <button
                ref={searchAnchorRef}
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                title="Search lore memory (Ctrl+F)"
                className={`flex items-center gap-1.5 rounded-[12px] border px-3 py-1.5 text-xs transition active:scale-[0.97] active:transition-none ${
                  searchOpen
                    ? "border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text-main)]"
                }`}
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Search</span>
              </button>
              <LoreSearchPanel
                worldId={worldId}
                isOpen={searchOpen}
                onClose={() => setSearchOpen(false)}
                anchorRef={searchAnchorRef as React.RefObject<HTMLElement>}
              />
            </div>
          )}

          {/* Focus mode */}
          {!isReadonly && (
            <button
              type="button"
              onClick={() => setFocusMode(true)}
              title="Enter focus mode"
              className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[var(--text-muted)] transition hover:border-[var(--border-focus)] hover:text-[var(--text-main)] active:scale-[0.97] active:transition-none"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Inscribe */}
          {!isReadonly && (
            <Button onClick={submit} disabled={processing} size="sm">
              {processing ? (
                <><span className="loom-spinner h-3.5 w-3.5 animate-spin rounded-full border-t-2 border-[var(--accent)]" />Inscribing…</>
              ) : "Inscribe & Remember"}
            </Button>
          )}
        </div>
      </div>

      {/* ── Diary writing canvas ── */}
      <div className="writing-paper relative overflow-hidden rounded-[28px] border border-[var(--border)] shadow-[0_2px_24px_color-mix(in_srgb,var(--accent)_4%,transparent)]">

        {/* Date stamp header */}
        <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--border)_60%,transparent)] px-8 py-4">
          <span className="loom-date-stamp">✦ {dateStamp}</span>
          <div className="flex items-center gap-3">
            {/* Writing stats pills */}
            <AnimatePresence>
              {writingStats && currentWordCount > 10 && (
                <motion.div
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2 }}
                  className="hidden items-center gap-1.5 sm:flex"
                >
                  {[
                    { v: writingStats.paragraphs, l: "¶" },
                    { v: writingStats.sentences, l: "s" },
                  ].map(({ v, l }) => (
                    <span key={l} className="rounded-md bg-[color-mix(in_srgb,var(--text-main)_5%,transparent)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                      {v}{l}
                    </span>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            {/* Word count ring */}
            <div className="flex items-center gap-1.5">
              <motion.span key={currentWordCount} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }} className="text-[11px] text-[var(--text-muted)]">
                {currentWordCount} words
              </motion.span>
              <svg width="22" height="22" viewBox="0 0 28 28" className="-rotate-90 shrink-0">
                <circle cx="14" cy="14" r={RING_R} fill="none" stroke="color-mix(in srgb, var(--text-main) 7%, transparent)" strokeWidth="2.5" />
                <circle cx="14" cy="14" r={RING_R} fill="none" stroke={ringColor} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={`${ringDash} ${RING_CIRC}`} className="loom-ring-arc" />
              </svg>
            </div>
          </div>
        </div>

        {/* Title input */}
        <div className="px-8 pt-7">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name this entry…"
            readOnly={isReadonly}
            aria-label="Entry title"
            className="loom-title-input read-only:cursor-default read-only:opacity-60"
          />
        </div>

        {/* Ruled divider */}
        <div className="mx-8 mt-4 h-px bg-[color-mix(in_srgb,var(--border)_70%,transparent)]" />

        {/* Body editor */}
        <div className="relative px-8 py-6">
          <AnimatePresence>
            {processing && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="scan-line" />
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="scan-line" style={{ animationDelay: "0.3s" }} />
              </>
            )}
          </AnimatePresence>
          <EditorContent editor={editor} />
        </div>

        {/* Processing status strip */}
        <AnimatePresence>
          {processing && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="border-t border-[var(--border)] px-8 py-3"
            >
              <ProcessingStatus steps={steps} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Floating bottom formatting toolbar ── */}
      <AnimatePresence>
        {!focusMode && (
          <div className="relative mt-4">
            {/* Right-edge fade hint on mobile */}
            <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-8 z-10 rounded-r-full bg-gradient-to-l from-[color-mix(in_srgb,var(--surface-raised)_90%,transparent)] to-transparent sm:hidden" />
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="loom-floating-toolbar"
            >
              {formatButtons.map((btn, i) => (
                <Fragment key={i}>
                  {btn.sep && <span className="mx-1 h-4 w-px shrink-0 bg-[var(--border)]" />}
                  <button
                    type="button"
                    title={btn.title}
                    onMouseDown={(e) => { e.preventDefault(); btn.action(); }}
                    className={`loom-toolbar-btn shrink-0 rounded-full px-2.5 py-1.5 ${toolbarButton(btn.active)}`}
                  >
                    {btn.icon}
                  </button>
                </Fragment>
              ))}
              <span className="mx-2 h-4 w-px shrink-0 bg-[var(--border)]" />
              <span className="shrink-0 px-2 text-[10px] italic text-[var(--text-muted)] hidden sm:inline">
                The Archive listens…
              </span>
              {!isReadonly && (
                <button
                  type="button"
                  onClick={handleOracleWhisper}
                  disabled={oracleWhispering || currentWordCount < 20}
                  title="Oracle's Whisper — AI writing continuation"
                  className="loom-toolbar-btn flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] disabled:opacity-40"
                >
                  <Sparkles className={`h-3.5 w-3.5 ${oracleWhispering ? "animate-spin" : ""}`} />
                  <span className="hidden text-[11px] sm:inline">{oracleWhispering ? "Speaking…" : "Oracle"}</span>
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Keyboard hint (first mount) ── */}
      {!isReadonly && (
        <p className="mt-3 text-center text-[10px] text-[color-mix(in_srgb,var(--text-muted)_55%,transparent)]">
          Ctrl+S to inscribe · Ctrl+F to search · Esc for focus mode
        </p>
      )}

      {/* ── Modals ── */}
      <DestructiveActionModal
        open={!!deletingLore}
        onOpenChange={(open) => !open && setDeletingLore(null)}
        title="Burn the Scroll"
        description={`Are you sure you want to permanently erase "${deletingLore?.title}" from the world's memory? Extracted entities will remain, but this raw lore will be gone forever.`}
        requireString={`burn ${deletingLore?.title}`}
        onConfirm={handleDeleteLore}
        isDemo={isReadonly}
      />

      {!isReadonly && (
        <LoreImportModal
          open={importModalOpen}
          onOpenChange={setImportModalOpen}
          worldId={worldId}
          onImportComplete={(imported) => {
            setEntries((prev) => [...imported, ...prev]);
          }}
        />
      )}

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
            {/* Atmospheric depth gradient */}
            <div className="loom-focus-atmosphere pointer-events-none absolute inset-0 z-0" />
            {/* Top bar */}
            <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-[var(--border)] px-8 py-4">
              <p className="chapter-label">— The Loom —</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)]">{currentWordCount} words</span>
                <button type="button" onClick={() => setTypewriterMode((v) => !v)} title={typewriterMode ? "Disable typewriter" : "Enable typewriter"} className={`rounded-lg p-2 transition ${typewriterMode ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"}`}>
                  <AlignCenter className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setFocusMode(false)} title="Exit focus mode (Esc)" className="rounded-lg p-2 text-[var(--text-muted)] transition hover:text-[var(--text-main)]">
                  <Minimize2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* Editor */}
            <div ref={scrollContainerRef} className="relative z-10 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-2xl px-8 py-10">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Name this entry…"
                  aria-label="Entry title"
                  className="loom-title-input mb-6 border-b border-[var(--border)] pb-4"
                />
                <div className="h-px bg-[color-mix(in_srgb,var(--border)_60%,transparent)] mb-6" />
                <EditorContent editor={editor} />
              </div>
            </div>
            {/* Floating toolbar inside focus mode */}
            <div className="relative z-10 flex shrink-0 items-center justify-center border-t border-[var(--border)] px-4 py-3 overflow-x-auto scrollbar-none gap-0">
              {formatButtons.map((btn, i) => (
                <Fragment key={i}>
                  {btn.sep && <span className="mx-1 h-4 w-px shrink-0 bg-[var(--border)]" />}
                  <button type="button" title={btn.title} onMouseDown={(e) => { e.preventDefault(); btn.action(); }} className={`loom-toolbar-btn shrink-0 rounded-full px-2.5 py-1.5 ${toolbarButton(btn.active)}`}>
                    {btn.icon}
                  </button>
                </Fragment>
              ))}
              <span className="mx-2 h-4 w-px shrink-0 bg-[var(--border)]" />
              {!isReadonly && (
                <Button size="sm" onClick={submit} disabled={processing} className="shrink-0">
                  {processing ? "Inscribing…" : "Inscribe & Remember"}
                </Button>
              )}
              <span className="ml-3 shrink-0 text-xs text-[var(--text-muted)] hidden sm:inline">Esc to exit</span>
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
