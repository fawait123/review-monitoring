"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PrTable } from "@/components/pr-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PR } from "@/lib/types";

export default function DashboardPage() {
  const [prs, setPrs] = useState<PR[]>([]);
  const [repos, setRepos] = useState<string[]>([]);
  const [repo, setRepo] = useState<string>("all");
  const [state, setState] = useState<string>("OPEN");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const PAGE_SIZE = 20;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // GET collect: filter + pagination dikirim ke API → SQL dieksekusi server-side.
  const fetchData = useCallback(async (r: string, s: string, pg: number) => {
    const q = new URLSearchParams();
    if (r !== "all") q.set("repo", r);
    if (s !== "all") q.set("state", s);
    q.set("page", String(pg));
    q.set("pageSize", String(PAGE_SIZE));
    const res = await fetch(`/api/collect?${q.toString()}`);
    if (!res.ok) throw new Error("Gagal memuat data");
    return res.json();
  }, []);

  useEffect(() => {
    let active = true;
    fetchData(repo, state, page)
      .then((data) => {
        if (active) {
          setPrs(data.prs);
          setRepos(data.repos);
          setTotal(data.total);
        }
      })
      .catch(() => {
        if (active) toast.error("Gagal memuat data dari database");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repo, state, page, fetchData]);

  // Refresh: POST collect (sync ke database) → GET collect lagi dengan filter aktif.
  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/collect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Collect gagal");
        return;
      }
      toast.success(
        `Collect selesai: ${data.repos} repo, ${data.prs} PR` +
          (data.errors?.length ? `, ${data.errors.length} error` : "")
      );
      const fresh = await fetchData(repo, state, page);
      setPrs(fresh.prs);
      setRepos(fresh.repos);
      setTotal(fresh.total);
    } catch {
      toast.error("Gagal refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  const handleStateChange = (id: number, newState: PR["state"]) => {
    setPrs((prev) => prev.map((p) => (p.id === id ? { ...p, state: newState } : p)));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Monitoring</h1>
        <p className="text-sm text-muted-foreground">
          Pull request open dari repo yang bisa diakses ({repos.length} repo, {prs.length} PR)
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={repo} onValueChange={(v) => { setRepo(v ?? "all"); setPage(1); }}>
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
          <Select value={state} onValueChange={(v) => { setState(v ?? "all"); setPage(1); }}>
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
          <span className="text-sm text-muted-foreground">{prs.length} PR</span>
        </div>
        <Button onClick={refresh} disabled={refreshing}>
          {refreshing ? "Mengumpulkan…" : "↻ Refresh"}
        </Button>
      </div>
      <PrTable prs={prs} loading={loading} onStateChange={handleStateChange} />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {prs.length} dari {total} PR
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ← Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground">Hal {page} / {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Berikutnya →
          </Button>
        </div>
      </div>
    </div>
  );
}
