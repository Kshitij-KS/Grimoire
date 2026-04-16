"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlignCenter, Bold, Code, Heading1, Heading2, Heading3,
  Highlighter, Italic, Layers, List, ListOrdered, Loader2,
  Maximize2, Minimize2, Minus, PanelLeft, Plus, Quote, Search,
  Sparkles, Strikethrough, Upload, X,
} from "lucide-react";
import { toast } from "sonner";
import { ConsistencyChecker } from "@/components/consistency/consistency-checker";
import { LoreImportModal } from "@/components/lore/lore-import-modal";
import { LoreList } from "@/components/lore/lore-list";
import { ProcessingStatus, type ProcessingStep } from "@/components/lore/processing-status";
import { DestructiveActionModal } from "@/components/shared/destructive-action-modal";
import { Button } from "@/components/ui/button";
import { cn, stripHtml } from "@/lib/utils";
import type { LoreEntry } from "@/lib/types";

type SemanticResult = {
  entry_id: string;
  entry_title: string;
  content: string;
  similarity: number;
};

const baseSteps: ProcessingStep[] = [
  { id: "saved",     label: "Saving this lore entry...",            status: "idle" },
  { id: "chunking",  label: "Chunking your writing...",             status: "idle" },
  { id: "embedding", label: "Embedding into world memory...",       status: "idle" },
  { id: "entities",  label: "Extracting characters & locations...", status: "idle" },
  { id: "complete",  label: "Your world remembers.",                status: "idle" },
];

export function LoomEditor({
  worldId,
  initialEntries,
  isReadonly,
}: {
  worldId: string;
  initialEntries: LoreEntry[];
  isReadonly?: boolean;
}) {
  // Entry management
  const [entries, setEntries]           = useState(initialEntries);
  const [selectedEntry, setSelectedEntry] = useState<LoreEntry | null>(null);
  const [title, setTitle]               = useState("");
  const [steps, setSteps]               = useState(baseSteps);
  const [processing, setProcessing]     = useState(false);
  const [deletingLore, setDeletingLore] = useState<{ id: string; title: string } | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [lastMilestone, setLastMilestone]     = useState(0);

  // Triptych panel state
  const [spineOpen, setSpineOpen]   = useState(true);
  const [marginOpen, setMarginOpen] = useState(false);
  const [isMobile, setIsMobile]     = useState(false);

  // Spine search
  const [spineSearch, setSpineSearch]           = useState("");
  const [semanticResults, setSemanticResults]   = useState<SemanticResult[]>([]);
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);

  // Writing modes
  const [focusMode, setFocusMode]         = useState(false);
  const [typewriterMode, setTypewriterMode] = useState(false);
  const [oracleWhispering, setOracleWhispering] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Mobile detection — spine starts closed on mobile
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSpineOpen(false);
    };
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  // Auto-select first entry in readonly (demo) mode
  useEffect(() => {
    if (isReadonly && initialEntries.length > 0 && !selectedEntry) {
      setSelectedEntry(initialEntries[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({
        placeholder: "Write the places, people, rules, and histories that make this world coherent. Grimoire will remember the shape of what you mean.",
      }),
      CharacterCount,
    ],
    content: selectedEntry?.content ?? "",
    editorProps: {
      attributes: { class: "tiptap-loom-diary" },
    },
    immediatelyRender: false,
  });

  // Sync editor when selected entry changes
  useEffect(() => {
    if (editor) {
      editor.commands.setContent(selectedEntry?.content ?? "");
      setTitle(selectedEntry?.title ?? "");
    }
  }, [editor, selectedEntry]);

  // Typewriter scroll & Auto-hide spine
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      // Auto-hide spine when typing
      setSpineOpen(false);

      // Typewriter scroll
      if (typewriterMode) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        const container = scrollContainerRef.current;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          container.scrollBy({ top: rect.bottom - containerRect.top - container.clientHeight * 0.55, behavior: "smooth" });
        }
      }
    };
    editor.on("update", handler);
    return () => { editor.off("update", handler); };
  }, [typewriterMode, editor]);

  const currentWordCount = useMemo(
    () => wordCount(stripHtml(editor?.getHTML() ?? "")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, editor?.state],
  );

  const writingStats = useMemo(() => {
    const text = stripHtml(editor?.getHTML() ?? "").trim();
    if (!text) return null;
    const sentences  = text.split(/[.!?]+/).filter((s) => s.trim().length > 3).length;
    const paragraphs = (editor?.getHTML() ?? "").split(/<\/p>|<\/h[1-6]>/).filter(Boolean).length;
    return { paragraphs, sentences };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, editor?.state, currentWordCount]);

  // Word-count milestone toasts
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

  // Clear semantic results when search is cleared
  useEffect(() => {
    if (!spineSearch.trim()) setSemanticResults([]);
  }, [spineSearch]);

  const updateStep = (id: ProcessingStep["id"], status: ProcessingStep["status"]) =>
    setSteps((curr) => curr.map((s) => (s.id === id ? { ...s, status } : s)));

  const handleDeleteLore = async () => {
    if (!deletingLore) return;
    try {
      const res = await fetch(`/api/lore/${deletingLore.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setEntries((prev) => prev.filter((e) => e.id !== deletingLore.id));
      if (selectedEntry?.id === deletingLore.id) {
        setSelectedEntry(null);
        editor?.commands.clearContent();
        setTitle("");
      }
      toast.success("Lore entry permanently deleted.");
    } catch {
      toast.error("Failed to delete lore entry.");
    } finally {
      setDeletingLore(null);
    }
  };

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
      if (!res.ok) throw new Error();
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

  const handleSemanticSearch = useCallback(async () => {
    if (!spineSearch.trim() || isSemanticSearching) return;
    setIsSemanticSearching(true);
    try {
      const res = await fetch("/api/lore/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId, query: spineSearch }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSemanticResults(data.results ?? []);
    } catch {
      toast.error("Memory search failed.");
    } finally {
      setIsSemanticSearching(false);
    }
  }, [spineSearch, isSemanticSearching, worldId]);

  const submit = useCallback(async () => {
    if (!editor || isReadonly) return;
    const html = editor.getHTML();
    const text = stripHtml(html);
    if (!text.trim()) {
      toast.error("Write at least a few lines before saving.");
      return;
    }
    setProcessing(true);
    setSteps(baseSteps);
    try {
      const entryTitle = title.trim() || text.split(".")[0]?.slice(0, 48) || "Untitled";
      const response = await fetch("/api/lore/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId, title: entryTitle, content: text, entryId: selectedEntry?.id }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json();
        throw new Error(payload.error || "Lore ingest failed.");
      }
      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const lines     = event.split("\n");
          const eventName = lines.find((l) => l.startsWith("event:"))?.replace("event:", "").trim();
          const dataLine  = lines.find((l) => l.startsWith("data:"))?.replace("data:", "").trim();
          const payload   = dataLine ? JSON.parse(dataLine) : undefined;
          if (eventName === "saved")              updateStep("saved", "complete");
          if (eventName === "chunking")           updateStep("chunking", "active");
          if (eventName === "embedding_progress") { updateStep("chunking", "complete"); updateStep("embedding", "active"); }
          if (eventName === "embedding_complete") updateStep("embedding", "complete");
          if (eventName === "entity_extraction")  updateStep("entities", "active");
          if (eventName === "complete") {
            updateStep("entities", "complete");
            updateStep("complete", "complete");
            if (payload?.entry) {
              setEntries((prev) => [payload.entry as LoreEntry, ...prev.filter((e) => e.id !== payload.entry.id)]);
              setSelectedEntry(payload.entry);
            }
            toast.success("Lore woven into memory.");
          }
          if (eventName === "error") throw new Error(payload?.error || "Lore ingest failed.");
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lore ingest failed.");
    } finally {
      setProcessing(false);
    }
  }, [editor, isReadonly, title, worldId, selectedEntry]);

  // Keyboard shortcuts
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

  const toolbarBtnClass = (active: boolean) => cn(
    "loom-toolbar-btn shrink-0 rounded-md px-2 py-1.5",
    active
      ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]"
      : "text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--text-main)_6%,transparent)] hover:text-[var(--text-main)]",
  );

  const dateStamp = selectedEntry
    ? new Date(selectedEntry.created_at).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const lastEditedStamp = selectedEntry?.updated_at && selectedEntry.updated_at !== selectedEntry.created_at
    ? new Date(selectedEntry.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "numeric" })
    : null;

  const blockFormatButtons = [
    { icon: <Bold className="h-4 w-4" />,        active: Boolean(editor?.isActive("bold")),        action: () => editor?.chain().focus().toggleBold().run(),        title: "Bold"          },
    { icon: <Italic className="h-4 w-4" />,      active: Boolean(editor?.isActive("italic")),      action: () => editor?.chain().focus().toggleItalic().run(),      title: "Italic"        },
    { icon: <Strikethrough className="h-4 w-4" />, active: Boolean(editor?.isActive("strike")),    action: () => editor?.chain().focus().toggleStrike().run(),      title: "Strikethrough" },
    { icon: <Highlighter className="h-4 w-4" />, active: Boolean(editor?.isActive("highlight")),   action: () => editor?.chain().focus().toggleHighlight().run(),   title: "Highlight"     },
    { icon: <Code className="h-4 w-4" />,        active: Boolean(editor?.isActive("code")),        action: () => editor?.chain().focus().toggleCode().run(),        title: "Code"          },
    { icon: <Heading1 className="h-4 w-4" />, active: Boolean(editor?.isActive("heading", { level: 1 })), action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), title: "Chapter (H1)", sep: true },
    { icon: <Heading2 className="h-4 w-4" />, active: Boolean(editor?.isActive("heading", { level: 2 })), action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), title: "Section (H2)" },
    { icon: <Heading3 className="h-4 w-4" />, active: Boolean(editor?.isActive("heading", { level: 3 })), action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), title: "Subsection (H3)" },
    { icon: <Quote className="h-4 w-4" />,       active: Boolean(editor?.isActive("blockquote")),  action: () => editor?.chain().focus().toggleBlockquote().run(),  title: "Quote",         sep: true },
    { icon: <List className="h-4 w-4" />,        active: Boolean(editor?.isActive("bulletList")),  action: () => editor?.chain().focus().toggleBulletList().run(),  title: "Bullet list"         },
    { icon: <ListOrdered className="h-4 w-4" />, active: Boolean(editor?.isActive("orderedList")), action: () => editor?.chain().focus().toggleOrderedList().run(), title: "Numbered list"       },
    { icon: <Minus className="h-4 w-4" />,       active: false,                                    action: () => editor?.chain().focus().setHorizontalRule().run(), title: "Chapter break (✦ · ✦)", sep: true },
  ] satisfies Array<{ icon: React.ReactNode; active: boolean; action: () => void; title: string; sep?: boolean }>;

  // Client-side filtered entries for the spine
  const filteredEntries = useMemo(() => {
    if (!spineSearch.trim() || semanticResults.length > 0) return entries;
    const q = spineSearch.toLowerCase();
    return entries.filter((e) =>
      e.title?.toLowerCase().includes(q) ||
      stripHtml(e.content ?? "").toLowerCase().includes(q),
    );
  }, [entries, spineSearch, semanticResults]);

  // ── Spine panel content (shared: desktop inline + mobile drawer) ──────────
  const spineContent = (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <p className="chapter-label">— The Scribe&apos;s Record —</p>
        {isMobile && (
          <button
            type="button"
            onClick={() => setSpineOpen(false)}
            title="Close entries"
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:text-[var(--text-main)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Inline search */}
      <div className="shrink-0 border-b border-[var(--border)] p-3">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={spineSearch}
              onChange={(e) => setSpineSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSemanticSearch()}
              placeholder="Search memory…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] py-1.5 pl-8 pr-3 text-xs text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-focus)] transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={handleSemanticSearch}
            disabled={!spineSearch.trim() || isSemanticSearching}
            title="Semantic search in world memory (Enter)"
            className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-[var(--border-focus)] hover:text-[var(--accent)] disabled:opacity-40 active:scale-[0.97] active:transition-none"
          >
            {isSemanticSearching
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Sparkles className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Entry list or semantic results */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {semanticResults.length > 0 ? (
          <div className="space-y-2">
            <p className="px-1 pb-1 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Memory fragments — {semanticResults.length} match{semanticResults.length !== 1 ? "es" : ""}
            </p>
            {semanticResults.map((result) => (
              <button
                key={result.entry_id}
                type="button"
                onClick={() => {
                  const entry = entries.find((e) => e.id === result.entry_id);
                  if (entry) { setSelectedEntry(entry); if (isMobile) setSpineOpen(false); }
                }}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-left transition hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] active:scale-[0.98] active:transition-none"
              >
                <p className="line-clamp-1 text-xs font-medium text-[var(--text-main)]">
                  {result.entry_title || "Untitled"}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] italic text-[var(--text-muted)]">{result.content}</p>
                <p className="mt-1 text-[10px] text-[var(--text-muted)] opacity-60">
                  {Math.round(result.similarity * 100)}% match
                </p>
              </button>
            ))}
          </div>
        ) : (
          <LoreList
            entries={filteredEntries}
            onSelect={(entry) => {
              setSelectedEntry(entry);
              if (isMobile) setSpineOpen(false);
            }}
            selectedEntryId={selectedEntry?.id}
            isReadonly={isReadonly}
            onDelete={(id, t) => setDeletingLore({ id, title: t || "Untitled Scroll" })}
          />
        )}
      </div>

      {/* New entry button */}
      {!isReadonly && (
        <div className="shrink-0 border-t border-[var(--border)] p-3">
          <button
            type="button"
            onClick={() => {
              setSelectedEntry(null);
              editor?.commands.setContent("");
              setTitle("");
              if (isMobile) setSpineOpen(false);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] px-3 py-2 text-sm text-[var(--accent)] transition hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] active:scale-[0.97] active:transition-none"
          >
            <Plus className="h-3.5 w-3.5" />
            New Entry
          </button>
        </div>
      )}
    </>
  );

  // ── Margin panel content (shared: desktop inline + mobile bottom sheet) ───
  const marginContent = (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <p className="chapter-label">— Lore Lens —</p>
        <button
          type="button"
          onClick={() => setMarginOpen(false)}
          title="Close Lore Lens"
          className="rounded-lg p-1.5 text-[var(--text-muted)] transition hover:text-[var(--text-main)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ConsistencyChecker worldId={worldId} initialFlags={[]} />
      </div>
    </>
  );

  return (
    <div className="relative flex h-full w-full overflow-hidden">

      {/* ── Mobile: Spine drawer ───────────────────────────────────────────── */}
      {isMobile && (
        <AnimatePresence>
          {spineOpen && (
            <>
              <motion.div
                key="spine-backdrop"
                className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] backdrop-blur-[2px]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setSpineOpen(false)}
              />
              <motion.aside
                key="spine-panel"
                className="fixed left-0 top-0 z-50 flex h-full w-[min(300px,88vw)] flex-col border-r border-[var(--border)] bg-[var(--surface)] shadow-[4px_0_32px_rgba(0,0,0,0.22)]"
                initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              >
                {spineContent}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      )}

      {/* ── Mobile: Margin bottom sheet ───────────────────────────────────── */}
      {isMobile && (
        <AnimatePresence>
          {marginOpen && (
            <>
              <motion.div
                key="margin-backdrop"
                className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] backdrop-blur-[2px]"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setMarginOpen(false)}
              />
              <motion.div
                key="margin-sheet"
                className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col rounded-t-2xl border-t border-[var(--border)] bg-[var(--surface)] shadow-[0_-8px_32px_rgba(0,0,0,0.22)]"
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              >
                <div className="mx-auto mt-3 h-1 w-8 shrink-0 rounded-full bg-[var(--border)]" />
                {marginContent}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}

      {/* ── Desktop: Spine (inline collapsible) ───────────────────────────── */}
      {!isMobile && (
        <AnimatePresence initial={false}>
          {spineOpen && (
            <motion.aside
              key="spine"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)]"
            >
              <div className="flex h-full w-[260px] min-w-[260px] flex-col">
                {spineContent}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      )}

      {/* ── The Canvas ────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSpineOpen((v) => !v)}
              title={spineOpen ? "Hide entries" : "Browse entries"}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition active:scale-[0.97] active:transition-none",
                spineOpen
                  ? "border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text-main)]",
              )}
            >
              <PanelLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                Entries{entries.length > 0 ? ` (${entries.length})` : ""}
              </span>
            </button>

            {!isReadonly && (
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                title="Import .txt or .md files"
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-[var(--border-focus)] hover:text-[var(--text-main)] active:scale-[0.97] active:transition-none"
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Import</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">            {/* Lens (consistency) toggle */}
            <button
              type="button"
              onClick={() => setMarginOpen((v) => !v)}
              title={marginOpen ? "Close Lore Lens" : "Open Lore Lens"}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs transition active:scale-[0.97] active:transition-none",
                marginOpen
                  ? "border-[color-mix(in_srgb,var(--ai-pulse)_35%,transparent)] bg-[color-mix(in_srgb,var(--ai-pulse)_8%,transparent)] text-[var(--ai-pulse)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text-main)]",
              )}
            >
              <Layers className="h-3.5 w-3.5" />
            </button>

            {!isReadonly && (
              <button
                type="button"
                onClick={() => setFocusMode(true)}
                title="Enter focus mode"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[var(--text-muted)] transition hover:border-[var(--border-focus)] hover:text-[var(--text-main)] active:scale-[0.97] active:transition-none"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}

            {!isReadonly && (
              <Button onClick={submit} disabled={processing} size="sm">
                {processing ? (
                  <><span className="loom-spinner h-3.5 w-3.5 animate-spin rounded-full border-t-2 border-[var(--accent)]" />Inscribing…</>
                ) : "Inscribe & Remember"}
              </Button>
            )}
          </div>
        </div>

        {/* Static Format Bar (Top-pinned) */}
        {editor && !isReadonly && (
          <div className="flex shrink-0 items-center justify-start gap-1.5 border-b border-[var(--border)] px-4 py-2 sm:px-6 bg-[color-mix(in_srgb,var(--surface-raised)_40%,transparent)] hide-scrollbar overflow-x-auto">
            {blockFormatButtons.map((btn, i) => (
              <Fragment key={i}>
                {btn.sep && <span className="mx-1 h-5 w-px shrink-0 bg-[color-mix(in_srgb,var(--text-muted)_20%,transparent)]" />}
                <button
                  type="button"
                  title={btn.title}
                  onMouseDown={(e) => { e.preventDefault(); btn.action(); }}
                  className={cn(
                    "shrink-0 rounded-xl px-2.5 py-1.5 transition active:scale-[0.95] active:transition-none",
                    btn.active ? "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--text-main)_8%,transparent)] hover:text-[var(--text-main)]"
                  )}
                >
                  {btn.icon}
                </button>
              </Fragment>
            ))}
            <span className="mx-1 h-5 w-px shrink-0 bg-[color-mix(in_srgb,var(--text-muted)_20%,transparent)]" />
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleOracleWhisper(); }}
              disabled={oracleWhispering || currentWordCount < 20}
              title="Oracle's Whisper — AI continuation"
              className="shrink-0 flex items-center gap-2 rounded-xl pl-2.5 pr-4 py-1.5 text-[var(--accent)] font-medium text-[11px] transition hover:bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] active:scale-[0.95] active:transition-none disabled:opacity-40"
            >
              <Sparkles className={cn("h-3.5 w-3.5", oracleWhispering && "animate-spin")} />
              Oracle
            </button>
          </div>
        )}

        {/* Canvas body */}
        <div ref={scrollContainerRef} className="loom-canvas-paper relative min-h-0 flex-1 overflow-y-auto">

          <div className="w-full px-6 py-10 sm:px-14">
            {/* Title input */}
            <div className="mb-6">
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

            {/* Letterhead Stats */}
            <div className="mb-8 flex flex-col items-start gap-2 text-[11px] text-[var(--text-muted)] sm:flex-row sm:items-center sm:gap-6">
              <span className="loom-date-stamp">✦ {dateStamp}</span>
              {lastEditedStamp && (
                <span className="italic opacity-60">
                  Last edited {lastEditedStamp}
                </span>
              )}
              <div className="hidden h-3 w-px bg-[var(--border)] sm:block" />
              <div className="flex items-center gap-3 opacity-80">
                <span>{currentWordCount} words</span>
                {writingStats && currentWordCount > 10 && (
                  <>
                    <span>{writingStats.paragraphs} paragraphs</span>
                    <span>{writingStats.sentences} sentences</span>
                  </>
                )}
              </div>
            </div>

            {/* Ruled divider */}
            <div className="my-8 h-px bg-[color-mix(in_srgb,var(--border)_70%,transparent)]" />

            {/* Editor body */}
            <div className="relative pb-32">
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


            {!isReadonly && (
              <p className="mt-4 text-center text-[10px] text-[color-mix(in_srgb,var(--text-muted)_55%,transparent)]">
                Ctrl+S to inscribe
              </p>
            )}
          </div>
        </div>

        {/* Processing status strip */}
        <AnimatePresence>
          {processing && (
            <motion.div
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="shrink-0 border-t border-[var(--border)] px-6 py-3"
            >
              <ProcessingStatus steps={steps} />
            </motion.div>
          )}
        </AnimatePresence>


      </div>

      {/* ── Desktop: Margin (inline collapsible) ──────────────────────────── */}
      {!isMobile && (
        <AnimatePresence initial={false}>
          {marginOpen && (
            <motion.div
              key="margin"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--surface)]"
            >
              <div className="flex h-full w-[320px] min-w-[320px] flex-col">
                {marginContent}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
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
          onImportComplete={(imported) => setEntries((prev) => [...imported, ...prev])}
        />
      )}

      {/* ── Focus / Distraction-free mode overlay ─────────────────────────── */}
      <AnimatePresence>
        {focusMode && (
          <motion.div
            className="fixed inset-0 z-[60] flex flex-col"
            style={{ background: "var(--bg)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className="loom-focus-atmosphere pointer-events-none absolute inset-0 z-0" />

            {/* Focus top bar */}
            <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-[var(--border)] px-8 py-4">
              <p className="chapter-label">— The Loom —</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-muted)]">{currentWordCount} words</span>
                <button
                  type="button"
                  onClick={() => setTypewriterMode((v) => !v)}
                  title={typewriterMode ? "Disable typewriter" : "Enable typewriter"}
                  className={cn("rounded-lg p-2 transition", typewriterMode ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]")}
                >
                  <AlignCenter className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setFocusMode(false)}
                  title="Exit focus mode (Esc)"
                  className="rounded-lg p-2 text-[var(--text-muted)] transition hover:text-[var(--text-main)]"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Focus canvas */}
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
                <div className="mb-6 h-px bg-[color-mix(in_srgb,var(--border)_60%,transparent)]" />
                <EditorContent editor={editor} />
              </div>
            </div>

            {/* Focus toolbar */}
            <div className="relative z-10 flex shrink-0 items-center justify-center gap-0 overflow-x-auto border-t border-[var(--border)] px-4 py-3 scrollbar-none">
              {formatButtons.map((btn, i) => (
                <Fragment key={i}>
                  {btn.sep && <span className="mx-1 h-4 w-px shrink-0 bg-[var(--border)]" />}
                  <button
                    type="button"
                    title={btn.title}
                    onMouseDown={(e) => { e.preventDefault(); btn.action(); }}
                    className={toolbarBtnClass(btn.active)}
                  >
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
              <span className="ml-3 hidden shrink-0 text-xs text-[var(--text-muted)] sm:inline">Esc to exit</span>
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
