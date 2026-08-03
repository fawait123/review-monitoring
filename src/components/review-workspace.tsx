"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DiffViewer } from "@/components/diff-viewer";
import { ReviewThread } from "@/components/review-thread";
import type { DiffFile, PR, Review, ReviewComment } from "@/lib/types";

interface Props {
  pr: PR;
  files: DiffFile[];
  reviews: Review[];
  commentsByReview: Record<number, ReviewComment[]>;
  reviewerName: string;
}

type Mode = "idle" | "running" | "editing" | "submitted";

interface LogLine {
  kind: "info" | "tool" | "text";
  text: string;
}

export function ReviewWorkspace({ pr, files, reviews, commentsByReview, reviewerName }: Props) {
  const router = useRouter();
  const draft = reviews.find((r) => r.status === "draft");
  const submitted = reviews.filter((r) => r.status === "submitted");

  const [mode, setMode] = useState<Mode>(submitted.length > 0 ? "submitted" : draft ? "editing" : "idle");
  const [activeReviewId, setActiveReviewId] = useState<number | null>(draft?.id ?? null);
  const [summary, setSummary] = useState<string>(draft?.summary ?? submitted[0]?.summary ?? "");
  const [comments, setComments] = useState<ReviewComment[]>(
    activeReviewId ? commentsByReview[activeReviewId] ?? [] : []
  );
  const [log, setLog] = useState<LogLine[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");
  const [openThread, setOpenThread] = useState<{ path: string; line: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const pushLog = (line: LogLine) => setLog((l) => [...l, line]);

  const runReview = async () => {
    setLog([]);
    setMode("running");
    pushLog({ kind: "info", text: "Mengambil diff + menjalankan Pi agent…" });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`/api/reviews/run?pr=${pr.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: pr.repo!.split("/")[0],
          repo: pr.repo!.split("/")[1],
          number: pr.number,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (; ;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const event = block.match(/^event: (.+)$/m)?.[1] ?? "message";
          const data = JSON.parse(block.replace(/^event: .+\n?/m, "").replace(/^data: /m, ""));
          handleEvent(event, data);
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        pushLog({ kind: "info", text: `❌ ${err.message}` });
        toast.error(err.message);
        setMode("idle");
      }
    }
  };

  const handleEvent = (event: string, data: any) => {
    switch (event) {
      case "delta":
        // gabung delta ke line text terakhir, jangan tiap token jadi baris sendiri
        setLog((prev) => {
          const last = prev[prev.length - 1];
          if (last?.kind === "text") return [...prev.slice(0, -1), { kind: "text", text: last.text + data.text }];
          return [...prev, { kind: "text", text: data.text }];
        });
        break;
      case "tool":
        pushLog({
          kind: "tool",
          text: `${data.isError ? "⚠" : "▶"} tool ${data.toolName}${data.input ? `: ${String(data.input).slice(0, 120)}` : ""}`,
        });
        break;
      case "diff":
        pushLog({ kind: "info", text: `Diff: ${data.size.toLocaleString()} bytes, ${data.files.length} file` });
        break;
      case "model":
        pushLog({ kind: "info", text: `Model: ${data.model}` });
        break;
      case "complete": {
        pushLog({ kind: "info", text: `✅ Review selesai (id ${data.reviewId}). Memuat hasil…` });
        loadReview(data.reviewId);
        break;
      }
      case "error":
        pushLog({ kind: "info", text: `❌ ${data.message}` });
        toast.error(data.message);
        setMode("idle");
        break;
    }
  };

  const loadReview = async (id: number) => {
    const res = await fetch(`/api/reviews/${id}`);
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Gagal memuat review");
      setMode("idle");
      return;
    }
    setActiveReviewId(id);
    setSummary(data.review.summary);
    setComments(data.comments);
    setMode("editing");
    toast.success("Review siap diedit");
  };

  const cancelRun = () => {
    abortRef.current?.abort();
    setMode("idle");
  };

  const addComment = async (path: string, line: number, body: string) => {
    if (!activeReviewId) return;
    const res = await fetch(`/api/reviews/${activeReviewId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, line, body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Gagal tambah komentar");
    setComments((c) => [...c, data.comment]);
    toast.success("Komentar ditambahkan");
  };

  const saveEdit = async (c: ReviewComment) => {
    const res = await fetch(`/api/comments/${c.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editBody }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Gagal simpan");
      return;
    }
    setComments((cs) => cs.map((x) => (x.id === c.id ? { ...x, body: editBody } : x)));
    setEditingId(null);
    toast.success("Komentar diperbarui");
  };

  const removeComment = async (id: number) => {
    if (!confirm("Hapus komentar ini?")) return;
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Gagal hapus");
      return;
    }
    setComments((cs) => cs.filter((x) => x.id !== id));
    toast.success("Komentar dihapus");
  };

  const saveSummary = async () => {
    if (!activeReviewId) return;
    const res = await fetch(`/api/reviews/${activeReviewId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Gagal simpan summary");
      return;
    }
    toast.success("Summary disimpan");
  };

  const submit = async () => {
    if (!activeReviewId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reviews/${activeReviewId}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Submit gagal");
        return;
      }
      toast.success(`Review disubmit ke GitHub (${data.comments} komentar)`);
      setMode("submitted");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      <div className="min-w-0">
        <DiffViewer
          submitted={submitted.length > 0}
          files={files}
          comments={comments}
          reviewerName={reviewerName}
          openThread={openThread}
          onOpenThread={setOpenThread}
          onAddComment={addComment}
          editingId={editingId}
          editBody={editBody}
          onEditBody={setEditBody}
          onEdit={(c) => {
            setEditingId(c.id);
            setEditBody(c.body);
          }}
          onSaveEdit={saveEdit}
          onCancelEdit={() => setEditingId(null)}
          onDelete={removeComment}
        />
      </div>

      <div className="space-y-4 lg:sticky lg:top-6">
        {mode === "idle" && (
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold text-sm">Review dengan Pi agent</h3>
            <p className="text-xs text-muted-foreground">
              Pi agent menganalisis diff dan menghasilkan draft komentar review. Kamu bisa edit sebelum submit ke GitHub.
            </p>
            <Button className="w-full" onClick={runReview}>
              ▶ Jalankan Review
            </Button>
          </div>
        )}

        {mode === "running" && (
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Pi agent sedang mereview…
            </h3>
            <div className="rounded bg-black/40 p-3 h-64 overflow-y-auto font-mono text-xs space-y-1">
              {log.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.kind === "info"
                      ? "text-sky-400"
                      : l.kind === "tool"
                        ? "text-amber-400/80"
                        : "text-emerald-300/90 whitespace-pre-wrap break-words"
                  }
                >
                  {l.kind === "text" ? l.text : l.text}
                </div>
              ))}
              {log.length === 0 && <span className="text-muted-foreground">menunggu stream…</span>}
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={cancelRun}>
              Batalkan
            </Button>
          </div>
        )}

        {mode === "editing" && (
          <div className="space-y-4 max-h-[calc(100vh-4rem)] overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm">Summary review</h3>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={6}
                placeholder="Ringkasan review level PR…"
              />
              <Button size="sm" variant="outline" className="w-full" onClick={saveSummary}>
                Simpan summary
              </Button>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold text-sm">
                Komentar <span className="text-muted-foreground font-normal">({comments.length})</span>
              </h3>
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Belum ada komentar. Klik <b>+</b> pada baris di diff untuk menambah.
                </p>
              )}
              <div className="space-y-2">
                <ReviewThread
                  files={files}
                  comments={comments}
                  editingId={editingId}
                  editBody={editBody}
                  onEditBody={setEditBody}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => setEditingId(null)}
                  onEdit={(c) => {
                    setEditingId(c.id);
                    setEditBody(c.body);
                    setOpenThread({ path: c.path, line: c.line });
                  }}
                  onDelete={removeComment}
                  reviewerName={reviewerName}
                />
              </div>
            </div>

            <Button className="w-full" onClick={submit} disabled={submitting || comments.filter((c) => c.body.trim()).length === 0}>
              {submitting ? "Mengirim…" : `🚀 Submit Review ke GitHub (${comments.filter((c) => c.body.trim()).length})`}
            </Button>
            <Button variant="outline" className="w-full" onClick={runReview}>
              ↻ Review Ulang
            </Button>
          </div>
        )}

        {mode === "submitted" && (
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold text-sm text-emerald-400">✓ Review terkirim</h3>
            <p className="text-xs text-muted-foreground">Review sudah disubmit ke GitHub. Lihat di PR:</p>
            <Button variant="outline" className="w-full">
              <a href={pr.url} target="_blank" rel="noreferrer" className="w-full">
                Buka di GitHub ↗
              </a>
            </Button>
            <Button variant="outline" className="w-full" onClick={runReview}>
              ↻ Review Ulang
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
