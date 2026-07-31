import { NextRequest, NextResponse } from "next/server";
import { getReview, listComments, markReviewSubmitted, markCommentSubmitted } from "@/server/db/reviews";
import { getPR } from "@/server/db/prs";
import { getPRDetail, submitReview } from "@/server/github";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = getReview(Number(id));
  if (!review) return NextResponse.json({ error: "Review tak ditemukan" }, { status: 404 });
  if (review.status === "submitted")
    return NextResponse.json({ error: "Review sudah disubmit" }, { status: 400 });

  const pr = getPR(review.prId);
  if (!pr || !pr.repo) return NextResponse.json({ error: "PR tak ditemukan" }, { status: 404 });
  const [owner, repo] = pr.repo.split("/");

  const comments = listComments(review.id).filter((c) => c.body.trim());
  const payload = comments.map((c) => ({
    path: c.path,
    line: c.line,
    side: c.side as "RIGHT",
    body: c.body,
  }));

  try {
    // headRefOid di DB bisa stale (PR update/force-push sejak collect) → fetch SHA terbaru
    const detail = await getPRDetail(owner, repo, pr.number);
    let ghReviewId;
    try {
      ghReviewId = await submitReview(owner, repo, pr.number, detail.headRefOid, review.summary, payload);
    } catch (err: any) {
      // 422 masih mungkin: line komentar tak ada di diff commit terbaru (PR diubah).
      // Retry tanpa commit_id → API apply ke commit terbaru, line diverifikasi GitHub.
      if (String(err.message).includes("422")) {
        ghReviewId = await submitReview(owner, repo, pr.number, null, review.summary, payload);
      } else {
        throw err;
      }
    }
    markReviewSubmitted(review.id, ghReviewId);
    for (const c of comments) markCommentSubmitted(c.id, ghReviewId);
    return NextResponse.json({ ghReviewId, comments: comments.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
