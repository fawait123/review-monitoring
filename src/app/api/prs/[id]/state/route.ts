import { NextRequest, NextResponse } from "next/server";
import { getPR, updatePRState } from "@/server/db/prs";

export const dynamic = "force-dynamic";

// Update state PR manual — hanya di database, tanpa sync GitHub.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let state: unknown;
  try {
    ({ state } = await req.json());
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }
  if (!["OPEN", "MERGED", "CLOSED"].includes(state as string)) {
    return NextResponse.json({ error: "State harus OPEN, MERGED, atau CLOSED" }, { status: 400 });
  }
  const pr = getPR(Number(id));
  if (!pr) return NextResponse.json({ error: "PR tak ditemukan" }, { status: 404 });

  updatePRState(pr.id, state as "OPEN" | "MERGED" | "CLOSED");
  return NextResponse.json({ ok: true, state });
}
