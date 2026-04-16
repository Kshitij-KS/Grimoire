"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bold, Code, Heading1, Heading2, Heading3,
  Highlighter, Italic, List, ListOrdered, Loader2,
  Minus, PanelLeft, Plus, Quote, Search,
  Sparkles, Strikethrough, Upload, X, Layers,
  BookOpen, CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import { ConsistencyChecker } from "@/components/consistency/consistency-checker";
import { LoreImportModal } from "@/components/lore/lore-import-modal";
import { LoreList } from "@/components/lore/lore-list";
import { ProcessingStatus, type ProcessingStep } from "@/components/lore/processing-status";
import { DestructiveActionModal } from "@/components/shared/destructive-action-modal";
import { cn, stripHtml } from "@/lib/utils";
import type { LoreEntry } from "@/lib/types";

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

type SemanticResult = {
  entry_id: string;
  entry_title: string;
  content: string;
  similarity: number;
};

const baseSteps: ProcessingStep[] = [
  { id: "saved", label: "Saving this lore entry...", status: "idle" },
  { id: "chunking", label: "Chunking your writing...", status: "idle" },
  { id: "embedding", label: "Embedding into world memory...", status: "idle" },
  { id: "entities", label: "Extracting characters & locations...", status: "idle" },
  { id: "complete", label: "Your world remembers.", status: "idle" },
];

const TOOLBAR_BTN = (active: boolean) => cn(
  "relative flex items-center justify-center rounded-[5px] w-7 h-7 transition-colors",
  "text-[var(--text-muted)]",
  "hover:text-[var(--text-main)] hover:bg-[color-mix(in_srgb,var(--text-main)_8%,transparent)]",
  "active:scale-95 active:transition-none",
  active && "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] !text-[var(--accent)]",
);

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
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState(baseSteps);
  const [processing, setProcessing] = useState(false);
  const [deletingLore, setDeletingLore] = useState<{ id: string; title: string } | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [lastMilestone, setLastMilestone] = useState(0);

  const [spineOpen, setSpineOpen] = useState(true);
  const [marginOpen, setMarginOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [spineSearch, setSpineSearch] = useState("");
  const [semanticResults, setSemanticResults] = useState<SemanticResult[]>([]);
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);

  const [oracleWhispering, setOracleWhispering] = useState(false);
  const [typewriterMode, setTypewriterMode] = useState(false);
  const [liveWordCount, setLiveWordCount] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
    onUpdate: ({ editor }) => {
      setLiveWordCount(wordCount(stripHtml(editor.getHTML())));
    },
    onCreate: ({ editor }) => {
      setLiveWordCount(wordCount(stripHtml(editor.getHTML())));
    },
    editorProps: {
      attributes: { class: "tiptap-loom" },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor) {
      editor.commands.setContent(selectedEntry?.content ?? "");
      setTitle(selectedEntry?.title ?? "");
    }
  }, [editor, selectedEntry]);

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      if (typewriterMode) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        const container = scrollContainerRef.current;
        if (container) {
          const cr = container.getBoundingClientRect();
          container.scrollBy({ top: rect.bottom - cr.top - container.clientHeight * 0.55, behavior: "smooth" });
        }
      }
    };
    editor.on("update", handler);
    return () => { editor.off("update", handler); };
  }, [typewriterMode, editor]);

  // We use liveWordCount from the editor callbacks for 100% reactivity
  const currentWordCount = liveWordCount;

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
          const eventName = lines.find((l) => l.startsWith("event:"))?.replace("event:", "").trim();
          const dataLine = lines.find((l) => l.startsWith("data:"))?.replace("data:", "").trim();
          const payload = dataLine ? JSON.parse(dataLine) : undefined;
          if (eventName === "saved") updateStep("saved", "complete");
          if (eventName === "chunking") updateStep("chunking", "active");
          if (eventName === "embedding_progress") { updateStep("chunking", "complete"); updateStep("embedding", "active"); }
          if (eventName === "embedding_complete") updateStep("embedding", "complete");
          if (eventName === "entity_extraction") updateStep("entities", "active");
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!processing && !isReadonly) submit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submit, processing, isReadonly]);

  /* ── Toolbar definition ── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const inlineButtons = useMemo(() => [
    { icon: <Bold className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("bold")), action: () => editor?.chain().focus().toggleBold().run(), title: "Bold" },
    { icon: <Italic className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("italic")), action: () => editor?.chain().focus().toggleItalic().run(), title: "Italic" },
    { icon: <Strikethrough className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("strike")), action: () => editor?.chain().focus().toggleStrike().run(), title: "Strikethrough" },
    { icon: <Highlighter className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("highlight")), action: () => editor?.chain().focus().toggleHighlight().run(), title: "Highlight" },
    { icon: <Code className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("code")), action: () => editor?.chain().focus().toggleCode().run(), title: "Code" },
  ], [editor, editor?.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const blockButtons = useMemo(() => [
    { icon: <Heading1 className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("heading", { level: 1 })), action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), title: "Heading 1" },
    { icon: <Heading2 className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("heading", { level: 2 })), action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), title: "Heading 2" },
    { icon: <Heading3 className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("heading", { level: 3 })), action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), title: "Heading 3" },
    { icon: <Quote className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("blockquote")), action: () => editor?.chain().focus().toggleBlockquote().run(), title: "Blockquote" },
    { icon: <List className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("bulletList")), action: () => editor?.chain().focus().toggleBulletList().run(), title: "Bullet list" },
    { icon: <ListOrdered className="h-3.5 w-3.5" />, active: Boolean(editor?.isActive("orderedList")), action: () => editor?.chain().focus().toggleOrderedList().run(), title: "Ordered list" },
    { icon: <Minus className="h-3.5 w-3.5" />, active: false, action: () => editor?.chain().focus().setHorizontalRule().run(), title: "Chapter break" },
  ], [editor, editor?.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredEntries = useMemo(() => {
    if (!spineSearch.trim() || semanticResults.length > 0) return entries;
    const q = spineSearch.toLowerCase();
    return entries.filter((e) =>
      e.title?.toLowerCase().includes(q) ||
      stripHtml(e.content ?? "").toLowerCase().includes(q),
    );
  }, [entries, spineSearch, semanticResults]);

  /* ── Date stamps (rendered client-side only) ── */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dateStamp = mounted
    ? (selectedEntry
      ? new Date(selectedEntry.created_at).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
      : new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }))
    : "";
  const lastEditedStamp = mounted && selectedEntry?.updated_at && selectedEntry.updated_at !== selectedEntry.created_at
    ? new Date(selectedEntry.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  /* ── Spine panel content ── */
  const spineContent = (
    <>
      {/* Spine header */}
      <div className="flex h-11 shrink-0 items-center justify-between px-4 border-b border-[var(--border)]">
        <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--accent)]">Chronicles</span>
        {isMobile && (
          <button type="button" onClick={() => setSpineOpen(false)} className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="shrink-0 px-3 py-2.5 border-b border-[var(--border)]">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={spineSearch}
              onChange={(e) => setSpineSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSemanticSearch()}
              placeholder="Search…"
              className="w-full rounded-md border border-[var(--border)] bg-transparent py-1.5 pl-7 pr-2.5 text-[11px] text-[var(--text-main)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-focus)] transition-colors"
            />
          </div>
          <button
            type="button" onClick={handleSemanticSearch}
            disabled={!spineSearch.trim() || isSemanticSearching}
            title="Semantic search"
            className="flex items-center justify-center rounded-md border border-[var(--border)] bg-transparent w-7 h-7 text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
          >
            {isSemanticSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Entry list */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {semanticResults.length > 0 ? (
          <div className="space-y-1.5">
            <p className="px-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {semanticResults.length} match{semanticResults.length !== 1 ? "es" : ""}
            </p>
            {semanticResults.map((r) => (
              <button
                key={r.entry_id} type="button"
                onClick={() => { const e = entries.find((e) => e.id === r.entry_id); if (e) { setSelectedEntry(e); if (isMobile) setSpineOpen(false); } }}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-2.5 text-left text-xs transition hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)]"
              >
                <p className="font-medium text-[var(--text-main)] truncate">{r.entry_title || "Untitled"}</p>
                <p className="mt-1 text-[var(--text-muted)] line-clamp-2 italic">{r.content}</p>
                <p className="mt-1 text-[var(--text-muted)] opacity-50">{Math.round(r.similarity * 100)}% match</p>
              </button>
            ))}
          </div>
        ) : (
          <LoreList
            entries={filteredEntries}
            onSelect={(entry) => { setSelectedEntry(entry); if (isMobile) setSpineOpen(false); }}
            selectedEntryId={selectedEntry?.id}
            isReadonly={isReadonly}
            onDelete={(id, t) => setDeletingLore({ id, title: t || "Untitled Scroll" })}
          />
        )}
      </div>

      {!isReadonly && (
        <div className="shrink-0 border-t border-[var(--border)] p-2.5">
          <button
            type="button"
            onClick={() => { setSelectedEntry(null); editor?.commands.setContent(""); setTitle(""); if (isMobile) setSpineOpen(false); }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--accent)_25%,transparent)] px-3 py-2 text-[11px] font-medium text-[var(--accent)] transition hover:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] active:scale-[0.98] active:transition-none"
          >
            <Plus className="h-3 w-3" />
            New entry
          </button>
        </div>
      )}
    </>
  );

  const marginContent = (
    <>
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
        <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--ai-pulse)]">Lore Lens</span>
        <button type="button" onClick={() => setMarginOpen(false)} className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ConsistencyChecker 
          worldId={worldId} 
          initialFlags={[]} 
          isDemo={isReadonly}
          isReadonly={isReadonly}
        />
      </div>
    </>
  );

  /* ══════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════ */
  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[var(--surface)]">

      {/* Mobile spine drawer */}
      {isMobile && (
        <AnimatePresence>
          {spineOpen && (
            <>
              <motion.div key="bd" className="fixed inset-0 z-40 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={() => setSpineOpen(false)} />
              <motion.aside key="sp" className="fixed left-0 top-0 z-50 flex h-full w-[min(280px,88vw)] flex-col border-r border-[var(--border)] bg-[var(--surface)]" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}>
                {spineContent}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      )}

      {/* Mobile margin sheet */}
      {isMobile && (
        <AnimatePresence>
          {marginOpen && (
            <>
              <motion.div key="mbd" className="fixed inset-0 z-40 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={() => setMarginOpen(false)} />
              <motion.div key="ms" className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-2xl border-t border-[var(--border)] bg-[var(--surface)]" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}>
                <div className="mx-auto mt-2.5 h-[3px] w-8 shrink-0 rounded-full bg-[var(--border)]" />
                {marginContent}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}

      {/* Desktop spine */}
      {!isMobile && (
        <AnimatePresence initial={false}>
          {spineOpen && (
            <motion.aside
              key="spine"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 248, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-col overflow-hidden border-r border-[var(--border)]"
            >
              <div className="flex h-full w-[248px] min-w-[248px] flex-col">{spineContent}</div>
            </motion.aside>
          )}
        </AnimatePresence>
      )}

      {/* ══════════════════════════════════════
          CANVAS
      ══════════════════════════════════════ */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* ── Chrome bar ── */}
        <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-3">
          {/* Left controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSpineOpen((v) => !v)}
              title="Toggle entries"
              className={cn(
                "flex h-7 px-2 items-center justify-center gap-1.5 rounded-md transition-colors",
                spineOpen ? "text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[color-mix(in_srgb,var(--text-main)_6%,transparent)]"
              )}
            >
              <PanelLeft className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium mb-[0.5px]">Chronicles</span>
            </button>

            {!isReadonly && (
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                title="Import file"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[color-mix(in_srgb,var(--text-main)_6%,transparent)] transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Center: word count */}
          {currentWordCount > 0 && (
            <span className="text-[10px] tabular-nums text-[var(--text-muted)] opacity-70">
              {currentWordCount.toLocaleString()} words
            </span>
          )}

          {/* Right controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTypewriterMode((v) => !v)}
              title={typewriterMode ? "Disable typewriter centering" : "Enable typewriter centering"}
              className={cn(
                "hidden sm:flex h-7 px-2 items-center justify-center gap-1.5 rounded-md transition-colors",
                typewriterMode ? "text-[var(--ai-pulse)] bg-[color-mix(in_srgb,var(--ai-pulse)_10%,transparent)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[color-mix(in_srgb,var(--text-main)_6%,transparent)]"
              )}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium mb-[0.5px]">Typewriter</span>
            </button>

            <button
              type="button"
              onClick={() => setMarginOpen((v) => !v)}
              title="Lore Lens — Consistency Check"
              className={cn(
                "flex h-7 px-2 items-center justify-center gap-1.5 rounded-md transition-colors",
                marginOpen ? "text-[var(--ai-pulse)] bg-[color-mix(in_srgb,var(--ai-pulse)_10%,transparent)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[color-mix(in_srgb,var(--text-main)_6%,transparent)]"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium mb-[0.5px]">Lore Lens</span>
            </button>

            {/* Divider */}
            <span className="h-4 w-px bg-[var(--border)] mx-0.5" />

            {!isReadonly && (
              <button
                type="button"
                onClick={submit}
                disabled={processing}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 h-7 text-[11px] font-medium transition-colors",
                  "border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] text-[var(--accent)]",
                  "hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]",
                  "active:scale-95 active:transition-none disabled:opacity-50"
                )}
              >
                {processing ? (
                  <><span className="h-3 w-3 animate-spin rounded-full border-t-[1.5px] border-[var(--accent)]" />Inscribing</>
                ) : (
                  <><CheckSquare className="h-3 w-3" />Inscribe</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════
            FORMAT TOOLBAR
            Simple horizontal strip. Always visible.
            Uses onMouseDown to avoid focus loss.
        ══════════════════════════════════════ */}
        {editor && !isReadonly && (
          <div className="flex shrink-0 items-center gap-0.5 border-b border-[var(--border)] px-2 py-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Inline group */}
            {inlineButtons.map((btn, i) => (
              <button
                key={i}
                type="button"
                title={btn.title}
                onMouseDown={(e) => { e.preventDefault(); btn.action(); }}
                className={TOOLBAR_BTN(btn.active)}
              >
                {btn.icon}
              </button>
            ))}

            {/* Separator */}
            <span className="mx-1 h-4 w-px shrink-0 bg-[var(--border)]" />

            {/* Block group */}
            {blockButtons.map((btn, i) => (
              <button
                key={i}
                type="button"
                title={btn.title}
                onMouseDown={(e) => { e.preventDefault(); btn.action(); }}
                className={TOOLBAR_BTN(btn.active)}
              >
                {btn.icon}
              </button>
            ))}

            {/* Separator */}
            <span className="mx-1 h-4 w-px shrink-0 bg-[var(--border)]" />

            {/* Oracle */}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleOracleWhisper(); }}
              disabled={oracleWhispering || currentWordCount < 20}
              title="Oracle's Whisper — AI continuation"
              className="flex shrink-0 items-center gap-1.5 rounded-[5px] px-2 h-7 text-[11px] font-medium text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] active:scale-95 active:transition-none disabled:opacity-35"
            >
              <Sparkles className={cn("h-3.5 w-3.5", oracleWhispering && "animate-pulse")} />
              <span className="hidden sm:inline">Oracle</span>
            </button>

            {/* Shortcut hint — pushed to right edge */}
            <span className="ml-auto hidden shrink-0 pr-1 text-[10px] text-[var(--text-muted)] opacity-40 lg:block">
              Ctrl S
            </span>
          </div>
        )}

        {/* ─── SCROLLABLE MANUSCRIPT CANVAS ─── */}
        <div
          ref={scrollContainerRef}
          className="relative flex-1 overflow-y-auto min-h-0 writing-paper"
        >
          {/* Subtle inner shadow at top to indicate scrollability */}
          <div className="pointer-events-none sticky top-0 z-10 h-3 bg-gradient-to-b from-[var(--surface)] to-transparent" />

          <div className="px-8 pb-32 sm:px-12 md:px-16 lg:px-20">

            {/* ── Document letterhead ── */}
            <div className="mb-10 mt-2">

              {/* Date line */}
              {mounted && (
                <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--text-muted)] opacity-60">
                  {dateStamp}
                </p>
              )}

              {/* Title */}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled entry"
                readOnly={isReadonly}
                aria-label="Entry title"
                className={cn(
                  "w-full border-none bg-transparent outline-none",
                  "font-heading text-[2rem] leading-[1.2] tracking-[-0.02em] text-[var(--text-main)]",
                  "placeholder:text-[color-mix(in_srgb,var(--text-muted)_45%,transparent)]",
                  "read-only:cursor-default",
                )}
              />

              {/* Thin rule */}
              <div className="mt-4 border-b border-[color-mix(in_srgb,var(--border)_70%,transparent)]" />

              {/* Last edited */}
              {lastEditedStamp && (
                <p className="mt-2 text-[10px] italic text-[var(--text-muted)] opacity-55">
                  Edited {lastEditedStamp}
                </p>
              )}
            </div>

            {/* ── TipTap editor ── */}
            <EditorContent editor={editor} />

            {/* ── Document watermark ── */}
            <div className="mt-20 flex flex-col items-center justify-center opacity-15 pointer-events-none select-none">
              <div className="h-px w-24 bg-gradient-to-r from-transparent via-[var(--border)] to-transparent mb-6" />
              <p className="font-heading text-lg tracking-[0.3em] text-[var(--text-muted)] scale-y-110">
                GRIMOIRE
              </p>
              <p className="mt-1 text-[8px] uppercase tracking-[0.5em] text-[var(--text-muted)] font-medium">
                THE SCRIBE&apos;S SIGNATURE
              </p>
            </div>
          </div>
        </div>

        {/* Processing status */}
        <AnimatePresence>
          {processing && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="shrink-0 border-t border-[var(--border)] px-6 py-3"
            >
              <ProcessingStatus steps={steps} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Desktop margin panel ── */}
      {!isMobile && (
        <AnimatePresence initial={false}>
          {marginOpen && (
            <motion.div
              key="margin"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
              className="flex flex-col overflow-hidden border-l border-[var(--border)]"
            >
              <div className="flex h-full w-[320px] min-w-[320px] flex-col">{marginContent}</div>
            </motion.div>
          )}
        </AnimatePresence>
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
          onImported={(newEntry) => {
            setEntries((prev) => [newEntry, ...prev]);
            setSelectedEntry(newEntry);
          }}
        />
      )}
    </div>
  );
}
