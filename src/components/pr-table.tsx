"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontalIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PrStatusBadge, ReviewDecisionBadge, DiffStat } from "@/components/pr-badges";
import type { PR } from "@/lib/types";

interface Props {
  prs: PR[];
  loading?: boolean;
  onStateChange?: (id: number, state: PR["state"]) => void;
}

export function PrTable({ prs, loading, onStateChange }: Props) {
  const changeState = async (p: PR, state: PR["state"]) => {
    try {
      const res = await fetch(`/api/prs/${p.id}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal update state");
        return;
      }
      toast.success(`PR #${p.number} → ${state}`);
      onStateChange?.(p.id, state);
    } catch {
      toast.error("Gagal update state");
    }
  };

  return (
    <div>
      {loading ? (
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
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prs.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-mono text-muted-foreground">{p.number}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {p.repo}
                  </TableCell>
                  <TableCell>
                    <a
                      href={`/pr/${p.repo}/${p.number}`}
                      target="_blank"
                      className="hover:underline text-sm line-clamp-1 max-w-80 truncate"
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
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
                        aria-label="Ubah state PR"
                      >
                        <MoreHorizontalIcon className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={p.state === "OPEN"} onClick={() => changeState(p, "OPEN")}>
                          Tandai Open
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={p.state === "MERGED"} onClick={() => changeState(p, "MERGED")}>
                          Tandai Merged
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={p.state === "CLOSED"} onClick={() => changeState(p, "CLOSED")}>
                          Tandai Closed
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {prs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
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
