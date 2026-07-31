import { NextRequest, NextResponse } from "next/server";
import { addComment, getReview } from "@/server/db/reviews";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = getReview(Number(id));
  if (!review) return NextResponse.json({ error: "Review tak ditemukan" }, { status: 404 });
  if (review.status === "submitted")
    return NextResponse.json({ error: "Review sudah disubmit, tak bisa diubah" }, { status: 400 });

  const { path, line, body } = (await req.json()) as { path: string; line: number; body: string };
  if (!path || !line || !body?.trim())
    return NextResponse.json({ error: "path, line, body wajib diisi" }, { status: 400 });

  const comment = addComment(review.id, path, line, body.trim());
  return NextResponse.json({ comment });
}
