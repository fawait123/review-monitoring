import db from "./index";
import type { Repo } from "@/lib/types";

const upsertStmt = db.prepare(
  `INSERT INTO repos (name_with_owner) VALUES (?)
   ON CONFLICT(name_with_owner) DO NOTHING`
);
const allStmt = db.prepare(`SELECT * FROM repos ORDER BY name_with_owner`);
const byNameStmt = db.prepare(`SELECT * FROM repos WHERE name_with_owner = ?`);
const freshStmt = db.prepare(
  `SELECT 1 FROM repos WHERE name_with_owner = ? AND last_collected_at IS NOT NULL AND last_collected_at >= datetime('now', ?)`
);
const markStmt = db.prepare(`UPDATE repos SET last_collected_at = datetime('now') WHERE name_with_owner = ?`);

export function upsertRepo(nameWithOwner: string): Repo {
  upsertStmt.run(nameWithOwner);
  return byNameStmt.get(nameWithOwner) as Repo;
}

export function listRepos(): Repo[] {
  return allStmt.all() as Repo[];
}

export function isFresh(nameWithOwner: string, refreshMinutes: number): boolean {
  return !!freshStmt.get(nameWithOwner, `-${refreshMinutes} minutes`);
}

export function markCollected(nameWithOwner: string): void {
  markStmt.run(nameWithOwner);
}
