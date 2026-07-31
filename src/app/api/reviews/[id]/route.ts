import { NextRequest, NextResponse } from "next/server";
import { getReview, updateReviewSummary, listComments } from "@/server/db/reviews";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = getReview(Number(id));
  if (!review) return NextResponse.json({ error: "Review tak ditemukan" }, { status: 404 });
  const comments = listComments(review.id);
  return NextResponse.json({ review, comments });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = getReview(Number(id));
  if (!review) return NextResponse.json({ error: "Review tak ditemukan" }, { status: 404 });
  if (review.status === "submitted")
    return NextResponse.json({ error: "Review sudah disubmit" }, { status: 400 });

  const { summary } = (await req.json()) as { summary?: string };
  if (typeof summary !== "string")
    return NextResponse.json({ error: "summary wajib string" }, { status: 400 });
  updateReviewSummary(review.id, summary.trim());
  return NextResponse.json({ ok: true });
}
