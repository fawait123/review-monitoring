import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CollectedPR } from "@/lib/types";

const exec = promisify(execFile);

export class GhError extends Error {
  constructor(message: string, public stderr: string) {
    super(message);
    this.name = "GhError";
  }
}

async function gh(args: string[], opts: { json?: boolean } = {}): Promise<string> {
  try {
    const { stdout } = await exec("gh", args, { maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  } catch (err: any) {
    throw new GhError(`gh ${args[0]} gagal: ${err.message}`, err.stderr ?? "");
  }
}

interface GhPRListItem {  number: number;
  title: string;
  author: { login: string; name?: string | null };
  state: "OPEN" | "MERGED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  url: string;
  headRefOid: string;
  isDraft: boolean;
  additions: number;
  deletions: number;
  reviewDecision: string | null;
}

const PR_JSON_FIELDS =
  "number,title,author,state,createdAt,mergedAt,closedAt,updatedAt,url,headRefOid,isDraft,additions,deletions,reviewDecision";

/** Semua repo yang bisa diakses user (owner + collaborator + org member), exclude archived. */
export async function listAccessibleRepos(): Promise<string[]> {
  const names: string[] = [];
  let page = 1;
  for (;;) {
    const out = await gh([
      "api",
      `user/repos?affiliation=owner,collaborator,organization_member&per_page=100&page=${page}`,
      "--jq",
      '.[] | select(.archived == false) | .full_name',
    ]);
    const batch = out.split("\n").filter(Boolean);
    if (batch.length === 0) break;
    names.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return [...new Set(names)].sort();
}

export async function listPRs(repo: string, limit = 100): Promise<CollectedPR[]> {
  const out = await gh([
    "pr", "list", "-R", repo, "--state", "all", "--limit", String(limit),
    "--json", PR_JSON_FIELDS,
  ]);
  return (JSON.parse(out) as GhPRListItem[]).map((p) => ({
    number: p.number,
    title: p.title,
    authorLogin: p.author.login,
    authorName: p.author.name ?? null,
    state: p.state,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    mergedAt: p.mergedAt,
    closedAt: p.closedAt,
    url: p.url,
    headRefOid: p.headRefOid,
    isDraft: p.isDraft,
    additions: p.additions,
    deletions: p.deletions,
    reviewDecision: p.reviewDecision,
  }));
}

interface SearchPR {
  number: number;
  title: string;
  state: string;
  author: { login: string; name: string | null };
  repository: { nameWithOwner: string };
  url: string;
  createdAt: string;
  updatedAt: string;
  isDraft: boolean;
}
/** PR open milik user ATAU yang minta review ke user — 2 call, dedupe. */
export async function searchMyOpenPRs(): Promise<{ repo: string; pr: CollectedPR }[]> {
  // ponytail: gh search tak punya --page; --limit 1000 di-paginate internal oleh gh
  const queries = [
    ["search", "prs", "--author", "@me", "--state", "open", "--limit", "1000"],
    ["search", "prs", "--review-requested", "@me", "--state", "open", "--limit", "1000"],
  ];
  const seen = new Set<string>();
  const rows: SearchPR[] = [];
  for (const q of queries) {
    const out = await gh([
      ...q,
      "--json", "number,title,repository,url,author,state,createdAt,updatedAt,isDraft",
    ]);
    for (const r of JSON.parse(out) as SearchPR[]) {
      const key = `${r.repository.nameWithOwner}#${r.number}`;
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(r);
      }
    }
  }
  return rows.map((p) => ({
    repo: p.repository.nameWithOwner,
    pr: {
      number: p.number,
      title: p.title,
      authorLogin: p.author.login,
      authorName: p.author.name ?? null,
      state: p.state.toUpperCase() as CollectedPR["state"],
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      mergedAt: null,
      closedAt: null,
      url: p.url,
      // search API tak punya field ini — isi kosong/0, detail di-fetch saat buka PR
      headRefOid: "",
      isDraft: p.isDraft,
      additions: 0,
      deletions: 0,
      reviewDecision: null,
    },
  }));
}

export async function getPRDetail(
  owner: string,
  repo: string,
  number: number
): Promise<{ headRefOid: string; title: string; body: string; state: string; baseRefName: string; headRefName: string }> {
  const out = await gh([
    "pr", "view", "-R", `${owner}/${repo}`, String(number),
    "--json", "headRefOid,title,body,state,baseRefName,headRefName",
  ]);
  return JSON.parse(out);
}

/** Satu PR lengkap (shape sama dgn listPRs) — dipakai utk ensure PR ada di DB. */
export async function getPRFull(owner: string, repo: string, number: number): Promise<CollectedPR> {
  const out = await gh([
    "pr", "view", "-R", `${owner}/${repo}`, String(number),
    "--json", PR_JSON_FIELDS,
  ]);
  const p = JSON.parse(out) as GhPRListItem;
  return {
    number: p.number,
    title: p.title,
    authorLogin: p.author.login,
    authorName: p.author.name ?? null,
    state: p.state,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    mergedAt: p.mergedAt,
    closedAt: p.closedAt,
    url: p.url,
    headRefOid: p.headRefOid,
    isDraft: p.isDraft,
    additions: p.additions,
    deletions: p.deletions,
    reviewDecision: p.reviewDecision,
  };
}

export async function getUserLogin(): Promise<string> {
  try {
    const out = await gh(["api", "user", "--jq", ".login"]);
    return out.trim() || "Anda";
  } catch {
    return "Anda";
  }
}

export async function getPRDiff(owner: string, repo: string, number: number): Promise<string> {
  try {
    return await gh(["pr", "diff", "-R", `${owner}/${repo}`, String(number)]);
  } catch (err) {
    // PR >300 file → GitHub tolak diff (HTTP 406 "exceeded the maximum number of files").
    // Fallback: files API paginated, rakit ulang unified diff dari tiap .patch.
    try {
      return await gh([
        "api", `repos/${owner}/${repo}/pulls/${number}/files`,
        "--paginate", "--jq",
        '.[] | "diff --git a/" + .filename + " b/" + .filename + "\n"' +
          '+ (if .status == "added" then "new file mode 100644\n"' +
          ' elif .status == "removed" then "deleted file mode 100644\n" else "" end)' +
          '+ "--- a/" + .filename + "\n+++ b/" + .filename + "\n" + (.patch // "")',
      ]);
    } catch {
      throw err; // error asli kalau fallback juga gagal
    }
  }
}

export interface SubmitComment {
  path: string;
  line: number;
  side: string;
  body: string;
}

export async function submitReview(
  owner: string,
  repo: string,
  number: number,
  commitId: string | null,
  summary: string,
  comments: SubmitComment[]
): Promise<string> {
  const body: Record<string, unknown> = {
    event: "COMMENT",
    body: summary,
    comments,
  };
  // commit_id kosong → biarkan API terapkan ke commit terbaru PR
  if (commitId) body.commit_id = commitId;
  // gh -f mengirim string → API butuh array JSON asli → tulis body ke file, pakai --input
  const tmp = path.join(os.tmpdir(), `review-${owner}-${repo}-${number}-${Date.now()}.json`);
  fs.writeFileSync(tmp, JSON.stringify(body), "utf8");
  try {
    const out = await gh(["api", `repos/${owner}/${repo}/pulls/${number}/reviews`, "--input", tmp]);
    const parsed = JSON.parse(out) as { id: number };
    return String(parsed.id);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
