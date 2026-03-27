"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { motion, AnimatePresence } from "framer-motion";
import { Bold, Heading1, Heading2, Heading3, Italic, List, Minus, Quote, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoreList } from "@/components/lore/lore-list";
import { ProcessingStatus, type ProcessingStep } from "@/components/lore/processing-status";
import type { LoreEntry } from "@/lib/types";
import { stripHtml } from "@/lib/utils";

const baseSteps: ProcessingStep[] = [
  { id: "saved", label: "Saving this lore entry...", status: "idle" },
  { id: "chunking", label: "Chunking your writing...", status: "idle" },
  { id: "embedding", label: "Embedding into world memory...", status: "idle" },
  { id: "entities", label: "Extracting characters & locations...", status: "idle" },
  { id: "complete", label: "Your world remembers.", status: "idle" },
];

const toolbar = [
  { icon: Bold, action: "toggleBold", label: "Bold" },
  { icon: Italic, action: "toggleItalic", label: "Italic" },
  { icon: Heading1, action: "toggleHeading", label: "Heading 1", level: 1 },
  { icon: Heading2, action: "toggleHeading", label: "Heading 2", level: 2 },
  { icon: Heading3, action: "toggleHeading", label: "Heading 3", level: 3 },
  { icon: Quote, action: "toggleBlockquote", label: "Quote" },
  { icon: List, action: "toggleBulletList", label: "Bullet list" },
  { icon: Minus, action: "setHorizontalRule", label: "Rule" },
] as const;

export function LoreEditor({
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

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Describe the places, people, and events of your world. The more you write, the more the archive remembers...",
      }),
      CharacterCount,
    ],
    content: selectedEntry?.content ?? "",
    editorProps: {
      attributes: {
        class: "tiptap",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor) {
      editor.commands.setContent(selectedEntry?.content ?? "");
      setTitle(selectedEntry?.title ?? "");
    }
  }, [editor, selectedEntry]);

  const currentWordCount = useMemo(() => {
    return wordCount(stripHtml(editor?.getHTML() ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, editor?.state]);

  const updateStep = (id: ProcessingStep["id"], status: ProcessingStep["status"]) => {
    setSteps((current) => current.map((step) => (step.id === id ? { ...step, status } : step)));
  };

  const resetSteps = () => setSteps(baseSteps);

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
          const eventName = lines.find((line) => line.startsWith("event:"))?.replace("event:", "").trim();
          const dataLine = lines.find((line) => line.startsWith("data:"))?.replace("data:", "").trim();
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
              const nextEntries = [payload.entry as LoreEntry, ...entries.filter((e) => e.id !== payload.entry.id)];
              setEntries(nextEntries);
              setSelectedEntry(payload.entry);
            }
            toast.success("Lore processed successfully.");
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

  // Ctrl+S / Cmd+S shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!processing && !isReadonly) {
          submit();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submit, processing, isReadonly]);

  return (
    <div className="space-y-6">
      <Card className="editor-surface rounded-[32px] p-5">
        {/* Title input */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Entry title..."
          disabled={isReadonly}
          className="mb-3 w-full bg-transparent font-heading text-3xl text-[rgb(212,168,83)] outline-none placeholder:text-[rgba(212,168,83,0.3)] disabled:opacity-50"
        />

        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-wrap gap-2">
            {toolbar.map((item) => {
              const Icon = item.icon;
              const run = () => {
                if (!editor || isReadonly) return;
                if (item.action === "toggleHeading") {
                  editor.chain().focus().toggleHeading({ level: item.level as 1 | 2 | 3 }).run();
                } else {
                  editor.chain().focus()[item.action]().run();
                }
              };

              return (
                <Button key={item.label} size="sm" variant="ghost" onClick={run} disabled={isReadonly}>
                  <Icon className="h-4 w-4" />
                </Button>
              );
            })}
          </div>
          <p className="text-sm text-secondary">{currentWordCount} words</p>
        </div>

        <EditorContent editor={editor} />
      </Card>

      {!isReadonly ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-secondary">⌘S or Ctrl+S to inscribe</p>
          <Button onClick={submit} disabled={processing}>
            <Save className="h-4 w-4" />
            {processing ? "Inscribing..." : "Inscribe & Remember"}
          </Button>
        </div>
      ) : null}

      <AnimatePresence>
        {processing ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ProcessingStatus steps={steps} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-secondary">The Scribe&apos;s Record</p>
            <h2 className="font-heading text-4xl text-foreground">Lore Archive</h2>
          </div>
          {!isReadonly ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedEntry(null);
                editor?.commands.setContent("");
                setTitle("");
              }}
            >
              + New Scroll
            </Button>
          ) : null}
        </div>
        <LoreList entries={entries} onSelect={setSelectedEntry} selectedEntryId={selectedEntry?.id} />
      </div>
    </div>
  );
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}
