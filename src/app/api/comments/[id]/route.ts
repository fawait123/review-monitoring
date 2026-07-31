import { NextRequest, NextResponse } from "next/server";
import { getComment, updateComment, deleteComment, getReview } from "@/server/db/reviews";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const comment = getComment(Number(id));
  if (!comment) return NextResponse.json({ error: "Comment tak ditemukan" }, { status: 404 });
  const review = getReview(comment.reviewId);
  if (review?.status === "submitted")
    return NextResponse.json({ error: "Review sudah disubmit" }, { status: 400 });

  const { body, line, path } = (await req.json()) as { body?: string; line?: number; path?: string };
  updateComment(
    comment.id,
    body?.trim() || comment.body,
    line ?? comment.line,
    path ?? comment.path
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const comment = getComment(Number(id));
  if (!comment) return NextResponse.json({ error: "Comment tak ditemukan" }, { status: 404 });
  const review = getReview(comment.reviewId);
  if (review?.status === "submitted")
    return NextResponse.json({ error: "Review sudah disubmit" }, { status: 400 });
  deleteComment(comment.id);
  return NextResponse.json({ ok: true });
}
