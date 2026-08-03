import { NextRequest, NextResponse } from "next/server";
import { searchMyOpenPRs } from "@/server/github";
import { upsertRepo, listRepos } from "@/server/db/repos";
import { upsertPR, listPRs, countPRs } from "@/server/db/prs";

export const dynamic = "force-dynamic";

// GET: baca data dari database (dipakai saat halaman load & setelah refresh).
// Filter repo/state + pagination dieksekusi server-side via SQL.
export async function GET(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get("repo") || undefined;
  const state = req.nextUrl.searchParams.get("state") || undefined;
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("pageSize")) || 20));
  const offset = (page - 1) * pageSize;
  const r = repo === "all" ? undefined : repo;
  const s = state === "all" ? undefined : state;
  return NextResponse.json({
    prs: listPRs(r, s, pageSize, offset),
    repos: listRepos().map((x) => x.name_with_owner),
    total: countPRs(r, s),
    page,
    pageSize,
  });
}

// ponytail: 1-2 call `gh search prs --author @me --state open` menggantikan 200 call per-repo.
export async function POST(_req: NextRequest) {
  const errors: string[] = [];
  try {
    const results = await searchMyOpenPRs();
    const repos = new Set<string>();
    let prCount = 0;
    for (const { repo, pr } of results) {
      repos.add(repo);
      const repoRow = upsertRepo(repo);
      upsertPR({ repo_id: repoRow.id, ...pr });
      prCount++;
    }
    return NextResponse.json({ repos: repos.size, prs: prCount, skipped: 0, errors });
  } catch (err: any) {
    return NextResponse.json({ error: `Collect gagal: ${err.message}` }, { status: 500 });
  }
}
