import Link from "next/link";
import { notFound } from "next/navigation";
import { getPRByKey } from "@/server/db/prs";
import { listReviews, listComments } from "@/server/db/reviews";
import { getPRDiff, getPRDetail, getUserLogin } from "@/server/github";
import { parseDiff } from "@/lib/diff-parser";
import { ReviewWorkspace } from "@/components/review-workspace";
import { PrStatusBadge, ReviewDecisionBadge, DiffStat } from "@/components/pr-badges";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PrDetailPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string; number: string }>;
}) {
  const { owner, repo, number } = await params;
  const num = Number(number);
  if (!Number.isInteger(num)) notFound();

  const pr = getPRByKey(`${owner}/${repo}`, num);
  if (!pr) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">PR belum ter-<i>collect</i></h1>
        <p className="text-muted-foreground">
          PR {owner}/{repo}#{num} belum ada di database lokal. Kembali ke dashboard dan klik <b>Refresh</b> untuk mengumpulkan data dari GitHub.
        </p>
        <Button variant="outline"><Link href="/">← Dashboard</Link></Button>
      </div>
    );
  }

  let diff = "";
  let baseRef = "";
  let headRef = "";
  let diffError: string | null = null;
  try {
    const [d, detail] = await Promise.all([getPRDiff(owner, repo, num), getPRDetail(owner, repo, num)]);
    diff = d;
    baseRef = detail.baseRefName;
    headRef = detail.headRefName;
  } catch (err: any) {
    diffError = err.message;
  }
  const files = diff ? parseDiff(diff) : [];

  const reviewerName = await getUserLogin();

  const reviews = listReviews(pr.id);
  const commentsByReview: Record<number, ReturnType<typeof listComments>> = {};
  for (const r of reviews) commentsByReview[r.id] = listComments(r.id);

  return (
    <div className="space-y-6 max-w-dvw">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Dashboard
        </Link>
        <div className="flex items-start justify-between gap-4 mt-2 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight wrap-break-word">
              {pr.title}
              <span className="text-muted-foreground font-mono text-base"> #{pr.number}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-mono">{pr.repo}</span> · oleh <b>{pr.authorLogin}</b>
              {baseRef && headRef && (
                <span className="font-mono"> · {baseRef} ← {headRef}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PrStatusBadge state={pr.state} />
            <ReviewDecisionBadge decision={pr.reviewDecision} draft={pr.isDraft} />
            <DiffStat additions={pr.additions} deletions={pr.deletions} />
          </div>
        </div>
      </div>

      {diffError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Gagal mengambil diff: {diffError}
        </div>
      )}

      {!diffError && (
        <ReviewWorkspace
          pr={pr}
          files={files}
          reviews={reviews}
          commentsByReview={commentsByReview}
          reviewerName={reviewerName}
        />
      )}
    </div>
  );
}
