"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { DiffFile, ReviewComment } from "@/lib/types";

interface Props {
  files: DiffFile[];
  comments: ReviewComment[];
  editingId: number | null;
  editBody: string;
  onEditBody: (v: string) => void;
  onSaveEdit: (c: ReviewComment) => void;
  onCancelEdit: () => void;
  onEdit: (c: ReviewComment) => void;
  onDelete: (id: number) => void;
  reviewerName: string;
}

const LINE_COLORS: Record<string, string> = {
  add: "bg-emerald-500/10",
  del: "bg-red-500/10",
  context: "",
};

export function ReviewThread({
  files,
  comments,
  editingId,
  editBody,
  onEditBody,
  onSaveEdit,
  onCancelEdit,
  onEdit,
  onDelete,
  reviewerName,
}: Props) {
  const commentsByFile = useMemo(() => {
    const map = new Map<string, ReviewComment[]>();
    for (const c of comments) map.set(c.path, [...(map.get(c.path) ?? []), c]);
    return map;
  }, [comments]);

  const lineContent = useMemo(() => {
    const map = new Map<string, { content: string; kind: string; oldLine: number | null; newLine: number | null }>();
    for (const f of files)
      for (const h of f.hunks)
        for (const l of h.lines)
          if (l.newLine !== null) map.set(`${f.path}:${l.newLine}`, l);
    return map;
  }, [files]);

  const filesWithComments = files.filter((f) => commentsByFile.has(f.path));

  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      {filesWithComments.map((file) => {
        const fc = [...(commentsByFile.get(file.path) ?? [])].sort((a, b) => a.line - b.line);
        const adds = file.hunks.reduce((a, h) => a + h.lines.filter((l) => l.kind === "add").length, 0);
        const dels = file.hunks.reduce((a, h) => a + h.lines.filter((l) => l.kind === "del").length, 0);
        return (
          <div key={file.path} className="rounded-lg border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/50">
              <span className="font-mono text-sm truncate ">{file.path}</span>
              <span className="font-mono text-xs shrink-0">
                <span className="text-emerald-400">+{adds}</span>{" "}
                <span className="text-red-400">-{dels}</span>
              </span>
            </div>
            <div className="divide-y divide-border/50">
              {fc.map((c) => {
                const l = lineContent.get(`${c.path}:${c.line}`);
                const editing = editingId === c.id;
                const open = expanded.has(c.id) || editing;
                return (
                  <div key={c.id} className="px-4 py-3">
                    <button
                      className="w-full flex items-center gap-2 px-1 py-1 text-left rounded hover:bg-muted/40"
                      onClick={() => toggleExpanded(c.id)}
                    >
                      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center shrink-0">
                        {reviewerName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="text-xs font-semibold truncate">{reviewerName}</span>
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
                      <span className="text-[11px] text-muted-foreground ml-auto font-mono">
                        {c.path}:{c.line}
                      </span>
                      <span className="text-muted-foreground text-xs leading-none shrink-0">
                        {open ? "▾" : "▸"}
                      </span>
                    </button>

                    {open && (
                      <div className="space-y-2 mt-2">
                        {l && (
                          <div
                            className={`flex font-mono text-[13px] leading-5 rounded overflow-hidden ${LINE_COLORS[l.kind] ?? ""}`}
                          >
                            <span className="w-10 px-2 text-right select-none text-muted-foreground/50 shrink-0 border-r border-border/50 py-0.5">
                              {l.newLine ?? c.line}
                            </span>
                            <span className="whitespace-pre-wrap break-words flex-1 px-2 py-0.5">{l.content || " "}</span>
                          </div>
                        )}
                        <div className="rounded-md border">
                          {editing ? (
                            <div className="p-3 space-y-2">
                              <Textarea
                                value={editBody}
                                onChange={(e) => onEditBody(e.target.value)}
                                rows={3}
                                className="font-sans text-sm"
                                autoFocus
                              />
                              <div className="flex gap-2 justify-end">
                                <Button variant="ghost" size="sm" onClick={onCancelEdit}>
                                  Batal
                                </Button>
                                <Button size="sm" onClick={() => onSaveEdit(c)} disabled={!editBody.trim()}>
                                  Simpan
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p
                                className={`text-sm whitespace-pre-wrap break-words px-3 py-2.5 ${expanded.has(c.id) ? "" : "line-clamp-3"
                                  }`}
                              >
                                {c.body}
                              </p>
                              {c.body.length > 120 && (
                                <button
                                  className="text-[11px] text-muted-foreground hover:text-foreground px-3 pb-1"
                                  onClick={() => toggleExpanded(c.id)}
                                >
                                  {expanded.has(c.id) ? "Tutup" : "Selengkapnya"}
                                </button>
                              )}
                              <div className="flex gap-1 px-3 pb-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[11px] text-muted-foreground"
                                  onClick={() => onEdit(c)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[11px] text-red-400 hover:text-red-300"
                                  onClick={() => onDelete(c.id)}
                                >
                                  Hapus
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
