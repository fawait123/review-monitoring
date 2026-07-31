import { NextRequest, NextResponse } from "next/server";
import { searchMyOpenPRs } from "@/server/github";
import { upsertRepo } from "@/server/db/repos";
import { upsertPR } from "@/server/db/prs";

export const dynamic = "force-dynamic";

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
