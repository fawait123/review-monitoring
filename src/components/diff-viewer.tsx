"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { DiffFile, ReviewComment } from "@/lib/types";

interface Props {
  files: DiffFile[];
  comments: ReviewComment[];
  reviewerName: string;
  openThread: { path: string; line: number } | null;
  onOpenThread: (v: { path: string; line: number } | null) => void;
  onAddComment: (path: string, line: number, body: string) => Promise<void>;
}

interface Composer {
  file: DiffFile;
  line: number;
  body: string;
  saving: boolean;
}

const LINE_COLORS: Record<string, string> = {
  add: "bg-emerald-500/10 hover:bg-emerald-500/20",
  del: "bg-red-500/10",
  context: "",
};

export function DiffViewer({ files, comments, reviewerName, openThread, onOpenThread, onAddComment }: Props) {
  const [composer, setComposer] = useState<Composer | null>(null);
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set(files.map((f) => f.path)));
  const [expandedBodies, setExpandedBodies] = useState<Set<number>>(new Set());

  const commentsByLine = useMemo(() => {
    const map = new Map<string, ReviewComment[]>();
    for (const c of comments) {
      const key = `${c.path}:${c.line}`;
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return map;
  }, [comments]);

  const toggleFile = (path: string) => {
    setOpenFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const save = async () => {
    if (!composer || !composer.body.trim()) return;
    setComposer({ ...composer, saving: true });
    try {
      await onAddComment(composer.file.path, composer.line, composer.body.trim());
      setComposer(null);
    } finally {
      setComposer((c) => (c ? { ...c, saving: false } : null));
    }
  };

  return (
    <div className="space-y-4">
      {files.map((file) => {
        const open = openFiles.has(file.path);
        const fileComments = comments.filter((c) => c.path === file.path);
        const adds = file.hunks.reduce((a, h) => a + h.lines.filter((l) => l.kind === "add").length, 0);
        const dels = file.hunks.reduce((a, h) => a + h.lines.filter((l) => l.kind === "del").length, 0);
        return (
          <div key={file.path} className="rounded-lg border overflow-hidden">
            <button
              onClick={() => toggleFile(file.path)}
              className="w-full flex items-center justify-between px-4 py-2 bg-muted/30 hover:bg-muted/50 text-left"
            >
              <span className="font-mono text-sm truncate">{file.path}</span>
              <span className="flex items-center gap-2 shrink-0">
                {fileComments.length > 0 && (
                  <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                    {fileComments.length} komentar
                  </Badge>
                )}
                <span className="font-mono text-xs">
                  <span className="text-emerald-400">+{adds}</span>{" "}
                  <span className="text-red-400">-{dels}</span>
                </span>
              </span>
            </button>

            {open && (
              <div className="font-mono text-[13px] leading-5 overflow-x-auto">
                {file.hunks.map((hunk, hi) => (
                  <div key={hi}>
                    <div className="px-4 py-1 bg-sky-500/10 text-sky-400 text-xs border-y border-sky-500/20">
                      @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                    </div>
                    {hunk.lines.map((line, li) => {
                      const cls = LINE_COLORS[line.kind];
                      const key = `${file.path}:${line.newLine ?? line.oldLine}`;
                      const cs = line.newLine !== null ? commentsByLine.get(`${file.path}:${line.newLine}`) : undefined;
                      const threadOpen =
                        line.newLine !== null &&
                        openThread?.path === file.path &&
                        openThread.line === line.newLine;
                      return (
                        <div key={li}>
                          <div
                            className={`group flex ${cls} ${line.kind === "context" ? "text-muted-foreground" : ""}`}
                          >
                            <span className="w-12 px-2 text-right select-none text-muted-foreground/50 shrink-0">
                              {line.oldLine ?? ""}
                            </span>
                            <span className="w-12 px-2 text-right select-none text-muted-foreground/50 shrink-0 border-r border-border/50">
                              {line.newLine ?? ""}
                            </span>
                            <button
                              className="w-6 shrink-0 text-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
                              onClick={() =>
                                line.newLine !== null &&
                                setComposer({ file, line: line.newLine, body: "", saving: false })
                              }
                              disabled={line.newLine === null}
                              title="Tambah komentar"
                            >
                              +
                            </button>
                            <span className="whitespace-pre-wrap break-words flex-1">{line.content || " "}</span>
                            {cs && cs.length > 0 && (
                              <button
                                className="shrink-0 mr-2 self-center"
                                onClick={() =>
                                  line.newLine !== null &&
                                  onOpenThread(
                                    threadOpen ? null : { path: file.path, line: line.newLine }
                                  )
                                }
                                title={`${cs.length} komentar`}
                              >
                                <Badge
                                  variant={threadOpen ? "default" : "outline"}
                                  className={
                                    threadOpen
                                      ? "text-amber-950 bg-amber-400 border-amber-400"
                                      : "text-amber-400 border-amber-500/30"
                                  }
                                >
                                  {cs.length}
                                </Badge>
                              </button>
                            )}
                          </div>

                          {threadOpen && (
                            <div className="flex justify-end">
                              <div className="w-[min(480px,100%)] font-sans rounded-lg border bg-popover shadow-xl my-1 mr-4">
                                <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-t-lg border-b border-border/50">
                                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center shrink-0">
                                    {reviewerName.slice(0, 1).toUpperCase()}
                                  </span>
                                  <span className="text-xs font-semibold truncate">{reviewerName}</span>
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    {file.path}:{line.newLine}
                                  </span>
                                  <button
                                    className="ml-auto text-muted-foreground hover:text-foreground text-sm leading-none px-1"
                                    onClick={() => onOpenThread(null)}
                                  >
                                    ✕
                                  </button>
                                </div>
                                <div className="divide-y divide-border/50">
                                  {cs?.map((c) => (
                                    <div key={c.id} className="px-3 py-2 space-y-1.5">
                                      <div className="flex items-center gap-2">
                                        <Badge
                                          variant="outline"
                                          className={
                                            c.status === "submitted"
                                              ? "text-emerald-400 border-emerald-500/30"
                                              : "text-amber-400 border-amber-500/30"
                                          }
                                        >
                                          {c.status}
                                        </Badge>
                                        {c.body.length > 120 && (
                                          <button
                                            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
                                            onClick={() =>
                                              setExpandedBodies((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(c.id)) next.delete(c.id);
                                                else next.add(c.id);
                                                return next;
                                              })
                                            }
                                          >
                                            {expandedBodies.has(c.id) ? "Tutup" : "Selengkapnya"}
                                          </button>
                                        )}
                                      </div>
                                      <p
                                        className={`text-sm whitespace-pre-wrap break-words ${
                                          expandedBodies.has(c.id) ? "" : "line-clamp-3"
                                        }`}
                                      >
                                        {c.body}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {composer?.file.path === file.path &&
                      hunk.lines.some((l) => l.newLine === composer.line) && (
                        <div className="px-4 py-2 bg-background border-t border-border/50">
                          <div className="text-xs text-muted-foreground mb-1">
                            Komentar @ {composer.file.path}:{composer.line}
                          </div>
                          <Textarea
                            value={composer.body}
                            onChange={(e) => setComposer({ ...composer, body: e.target.value })}
                            rows={3}
                            placeholder="Tulis komentar review…"
                            className="font-sans text-sm"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <Button variant="ghost" size="sm" onClick={() => setComposer(null)}>
                              Batal
                            </Button>
                            <Button size="sm" onClick={save} disabled={composer.saving || !composer.body.trim()}>
                              Simpan
                            </Button>
                          </div>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
