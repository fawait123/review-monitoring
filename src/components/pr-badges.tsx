import { Badge } from "@/components/ui/badge";
import type { PR } from "@/lib/types";

export function PrStatusBadge({ state }: { state: PR["state"] }) {
  const map = {
    OPEN: { label: "OPEN", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    MERGED: { label: "MERGED", cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
    CLOSED: { label: "CLOSED", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  } as const;
  const s = map[state];
  return (
    <Badge variant="outline" className={s.cls}>
      {s.label}
    </Badge>
  );
}

export function ReviewDecisionBadge({ decision, draft }: { decision: string | null; draft: boolean }) {
  if (draft) return <Badge variant="outline" className="border-dashed text-muted-foreground">DRAFT</Badge>;
  if (!decision) return <span className="text-xs text-muted-foreground">—</span>;
  const map: Record<string, string> = {
    APPROVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    CHANGES_REQUESTED: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    REVIEW_REQUIRED: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  };
  const label = decision === "CHANGES_REQUESTED" ? "CHANGES REQ" : decision;
  return (
    <Badge variant="outline" className={map[decision] ?? "bg-slate-500/15 text-slate-300 border-slate-500/30"}>
      {label}
    </Badge>
  );
}

export function DiffStat({ additions, deletions }: { additions: number; deletions: number }) {
  return (
    <span className="text-xs font-mono whitespace-nowrap">
      <span className="text-emerald-400">+{additions}</span>{" "}
      <span className="text-red-400">-{deletions}</span>
    </span>
  );
}
