"use client";

import { useCallback, useRef, useState } from "react";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { LoreEntry } from "@/lib/types";

interface ImportFile {
  file: File;
  id: string;
  estimatedWords: number;
}

interface LoreImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worldId: string;
  onImportComplete: (entries: LoreEntry[]) => void;
}

const ALLOWED_EXTS = [".txt", ".md"];
const MAX_FILES = 10;
const MAX_BYTES = 512 * 1024;

function estimateWords(file: File): number {
  // Rough estimate: ~5 bytes/word
  return Math.round(file.size / 5);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function LoreImportModal({
  open,
  onOpenChange,
  worldId,
  onImportComplete,
}: LoreImportModalProps) {
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors?: Array<{ name: string; reason: string }> } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFiles([]);
    setResult(null);
    setIsDragging(false);
  };

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const valid: ImportFile[] = [];
    const rejected: string[] = [];

    for (const file of arr) {
      const ext = file.name.includes(".")
        ? "." + file.name.split(".").pop()!.toLowerCase()
        : "";
      if (!ALLOWED_EXTS.includes(ext)) {
        rejected.push(`${file.name} (unsupported type)`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        rejected.push(`${file.name} (exceeds 500 KB)`);
        continue;
      }
      valid.push({ file, id: `${file.name}-${file.size}`, estimatedWords: estimateWords(file) });
    }

    if (rejected.length > 0) {
      toast.error(`Skipped: ${rejected.join(", ")}`);
    }

    setFiles((prev) => {
      const combined = [...prev, ...valid];
      return combined.slice(0, MAX_FILES);
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleSubmit = async () => {
    if (!files.length || importing) return;
    setImporting(true);
    try {
      const formData = new FormData();
      for (const { file } of files) formData.append("files", file);

      const res = await fetch(`/api/worlds/${worldId}/import`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      setResult({ imported: data.imported, errors: data.errors });
      if (data.entries?.length > 0) {
        onImportComplete(data.entries as LoreEntry[]);
      }
      toast.success(`${data.imported} ${data.imported === 1 ? "entry" : "entries"} imported and queued for processing.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="glass-panel-elevated rounded-[32px] border-[var(--border)] p-0 sm:max-w-lg">
        {/* Decorative rune corners */}
        <span aria-hidden className="pointer-events-none absolute left-4 top-4 select-none font-heading text-2xl text-[var(--accent)] opacity-15">ᚦ</span>
        <span aria-hidden className="pointer-events-none absolute right-4 top-4 select-none font-heading text-2xl text-[var(--accent)] opacity-15">ᚨ</span>

        <DialogHeader className="px-7 pb-4 pt-7">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[14px] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]">
            <Upload className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <DialogTitle className="font-heading text-2xl text-[var(--text-main)]">Import Lore Files</DialogTitle>
          <DialogDescription className="text-sm text-[var(--text-muted)]">
            Upload <span className="text-[var(--text-main)]">.txt</span> or{" "}
            <span className="text-[var(--text-main)]">.md</span> files. Each becomes a lore entry and is queued for
            processing. Max 10 files, 500 KB each.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-7 pb-7">
          <AnimatePresence mode="wait">
            {result ? (
              /* ── Result state ── */
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-3 rounded-[14px] border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_6%,transparent)] px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--success)]" />
                  <p className="text-sm text-[var(--text-main)]">
                    <span className="font-semibold">{result.imported}</span>{" "}
                    {result.imported === 1 ? "entry" : "entries"} imported and queued for processing.
                  </p>
                </div>

                {result.errors && result.errors.length > 0 && (
                  <div className="space-y-1.5 rounded-[14px] border border-[color-mix(in_srgb,var(--danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--danger)_5%,transparent)] px-4 py-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--danger)]">
                      <AlertTriangle className="h-3.5 w-3.5" /> Skipped files
                    </p>
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-[var(--text-muted)]">
                        <span className="text-[var(--text-main)]">{e.name}</span> — {e.reason}
                      </p>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { reset(); onOpenChange(false); }}
                  className="w-full rounded-[14px] border border-[var(--border)] bg-[var(--surface-raised)] py-2.5 text-sm text-[var(--text-main)] transition hover:border-[var(--border-focus)]"
                >
                  Done
                </button>
              </motion.div>
            ) : (
              /* ── Upload state ── */
              <motion.div key="upload" className="space-y-4">
                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`
                    relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[18px] border-2 border-dashed p-8 transition-colors
                    ${isDragging
                      ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]"
                      : "border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] hover:border-[var(--border-focus)] hover:bg-[color-mix(in_srgb,var(--surface-raised)_50%,transparent)]"
                    }
                  `}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]">
                    <Upload className={`h-6 w-6 transition-colors ${isDragging ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-[var(--text-main)]">
                      {isDragging ? "Release to add files" : "Drop your lore files here"}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      .txt and .md — or click to browse
                    </p>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept=".txt,.md,text/plain,text/markdown"
                    className="sr-only"
                    onChange={(e) => e.target.files && addFiles(e.target.files)}
                    aria-label="Select lore files to import"
                  />
                </div>

                {/* File list */}
                <AnimatePresence>
                  {files.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="max-h-48 space-y-1.5 overflow-y-auto">
                        {files.map(({ file, id, estimatedWords }) => (
                          <motion.div
                            key={id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            className="flex items-center gap-3 rounded-[12px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] px-3 py-2"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-[var(--text-main)]">{file.name}</p>
                              <p className="text-[10px] text-[var(--text-muted)]">
                                {formatBytes(file.size)} · ~{estimatedWords.toLocaleString()} words
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFiles((prev) => prev.filter((f) => f.id !== id))}
                              title={`Remove ${file.name}`}
                              className="shrink-0 rounded-md p-0.5 text-[var(--text-muted)] transition hover:text-[var(--danger)]"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                      <p className="mt-2 text-center text-[10px] text-[var(--text-muted)]">
                        {files.length}/{MAX_FILES} files selected
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!files.length || importing}
                  className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[var(--accent)] py-3 text-sm font-medium text-[var(--bg)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {importing ? (
                    <>
                      <LoadingSpinner className="h-4 w-4" />
                      Inscribing…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Import {files.length > 0 ? `${files.length} ${files.length === 1 ? "File" : "Files"}` : "Files"}
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
