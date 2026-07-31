"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PrStatusBadge, ReviewDecisionBadge, DiffStat } from "@/components/pr-badges";
import type { PR } from "@/lib/types";

interface Props {
  prs: PR[];
  repos: string[];
}

export function PrTable({ prs, repos }: Props) {
  const router = useRouter();
  const [repo, setRepo] = useState<string>("all");
  const [state, setState] = useState<string>("OPEN");
  const [isPending, startTransition] = useTransition();

  // Collect otomatis di background saat dashboard dibuka — tidak nge-block tampilan.
  // ponytail: fire-and-forget, tabel tetap instan dari DB.
  useEffect(() => {
    fetch("/api/collect", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          toast.success(
            `Collect: ${data.prs} PR baru` +
              (data.skipped ? ` (${data.skipped} repo fresh)` : "") +
              (data.errors?.length ? `, ${data.errors.length} error` : "")
          );
          router.refresh();
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () =>
      prs.filter(
        (p) =>
          (repo === "all" || p.repo === repo) &&
          (state === "all" || p.state === state)
      ),
    [prs, repo, state]
  );

  const refresh = () => {
    startTransition(async () => {
      const res = await fetch("/api/collect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Collect gagal");
        return;
      }
      toast.success(`Collect selesai: ${data.repos} repo, ${data.prs} PR` + (data.errors.length ? `, ${data.errors.length} error` : ""));
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={repo} onValueChange={(v) => setRepo(v ?? "all")}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Semua repo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua repo</SelectItem>
              {repos.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={state} onValueChange={(v) => setState(v ?? "all")}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Semua state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua state</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="MERGED">Merged</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} PR</span>
        </div>
        <Button onClick={refresh} disabled={isPending}>
          {isPending ? "Mengumpulkan…" : "↻ Refresh"}
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Repo</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Review</TableHead>
                <TableHead className="text-right">Diff</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-mono text-muted-foreground">{p.number}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-40 truncate">
                    {p.repo}
                  </TableCell>
                  <TableCell>
                    <a
                      href={`/pr/${p.repo}/${p.number}`}
                      className="hover:underline text-sm line-clamp-1"
                    >
                      {p.title}
                    </a>
                  </TableCell>
                  <TableCell className="text-sm">{p.authorLogin}</TableCell>
                  <TableCell><PrStatusBadge state={p.state} /></TableCell>
                  <TableCell>
                    <ReviewDecisionBadge decision={p.reviewDecision} draft={p.isDraft} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DiffStat additions={p.additions} deletions={p.deletions} />
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(p.updatedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    Belum ada PR. Klik <b>Refresh</b> untuk mengumpulkan dari GitHub.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
