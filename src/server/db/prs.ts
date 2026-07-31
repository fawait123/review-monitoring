import db from "./index";
import type { PR, CollectedPR } from "@/lib/types";

export interface PRRow {
  id: number;
  repo_id: number;
  number: number;
  title: string;
  author_login: string;
  author_name: string | null;
  state: string;
  is_draft: number;
  additions: number;
  deletions: number;
  review_decision: string | null;
  head_ref_oid: string;
  url: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  repo?: string;
}

const upsertStmt = db.prepare(`
  INSERT INTO prs (repo_id, number, title, author_login, author_name, state, is_draft,
                   additions, deletions, review_decision, head_ref_oid, url,
                   created_at, updated_at, merged_at, closed_at)
  VALUES (@repo_id, @number, @title, @author_login, @author_name, @state, @is_draft,
          @additions, @deletions, @review_decision, @head_ref_oid, @url,
          @created_at, @updated_at, @merged_at, @closed_at)
  ON CONFLICT(repo_id, number) DO UPDATE SET
    title = excluded.title, author_login = excluded.author_login,
    author_name = excluded.author_name, state = excluded.state,
    is_draft = excluded.is_draft, additions = excluded.additions,
    deletions = excluded.deletions, review_decision = excluded.review_decision,
    head_ref_oid = excluded.head_ref_oid, url = excluded.url,
    created_at = excluded.created_at, updated_at = excluded.updated_at,
    merged_at = excluded.merged_at, closed_at = excluded.closed_at
`);

const listStmt = db.prepare(`
  SELECT p.*, r.name_with_owner AS repo FROM prs p
  JOIN repos r ON r.id = p.repo_id
  WHERE (? IS NULL OR r.name_with_owner = ?)
    AND (? IS NULL OR p.state = ?)
  ORDER BY p.updated_at DESC
`);

const byIdStmt = db.prepare(`
  SELECT p.*, r.name_with_owner AS repo FROM prs p
  JOIN repos r ON r.id = p.repo_id WHERE p.id = ?
`);

const byKeyStmt = db.prepare(`
  SELECT p.*, r.name_with_owner AS repo FROM prs p
  JOIN repos r ON r.id = p.repo_id
  WHERE r.name_with_owner = ? AND p.number = ?
`);

function toPR(row: PRRow): PR {
  return {
    id: row.id,
    repoId: row.repo_id,
    number: row.number,
    title: row.title,
    authorLogin: row.author_login,
    authorName: row.author_name,
    state: row.state as PR["state"],
    isDraft: !!row.is_draft,
    additions: row.additions,
    deletions: row.deletions,
    reviewDecision: row.review_decision,
    headRefOid: row.head_ref_oid,
    url: row.url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mergedAt: row.merged_at,
    closedAt: row.closed_at,
    repo: row.repo,
  };
}

export function upsertPR(input: { repo_id: number } & CollectedPR): void {
  upsertStmt.run({
    repo_id: input.repo_id,
    number: input.number,
    title: input.title,
    author_login: input.authorLogin,
    author_name: input.authorName,
    state: input.state,
    is_draft: input.isDraft ? 1 : 0,
    additions: input.additions,
    deletions: input.deletions,
    review_decision: input.reviewDecision,
    head_ref_oid: input.headRefOid,
    url: input.url,
    created_at: input.createdAt,
    updated_at: input.updatedAt,
    merged_at: input.mergedAt,
    closed_at: input.closedAt,
  });
}

export function listPRs(repo?: string, state?: string): PR[] {
  return (listStmt.all(repo ?? null, repo ?? null, state ?? null, state ?? null) as PRRow[]).map(toPR);
}

export function getPR(id: number): PR | null {
  const row = byIdStmt.get(id) as PRRow | undefined;
  return row ? toPR(row) : null;
}

export function getPRByKey(nameWithOwner: string, number: number): PR | null {
  const row = byKeyStmt.get(nameWithOwner, number) as PRRow | undefined;
  return row ? toPR(row) : null;
}
