import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "app.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_with_owner TEXT NOT NULL UNIQUE,
  discovered_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL REFERENCES repos(id),
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  author_login TEXT NOT NULL,
  author_name TEXT,
  state TEXT NOT NULL CHECK (state IN ('OPEN','MERGED','CLOSED')),
  is_draft INTEGER NOT NULL DEFAULT 0,
  additions INTEGER NOT NULL DEFAULT 0,
  deletions INTEGER NOT NULL DEFAULT 0,
  review_decision TEXT,
  head_ref_oid TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  merged_at TEXT,
  closed_at TEXT,
  UNIQUE (repo_id, number)
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_id INTEGER NOT NULL REFERENCES prs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  summary TEXT NOT NULL DEFAULT '',
  pi_model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at TEXT,
  gh_review_id TEXT
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  line INTEGER NOT NULL,
  side TEXT NOT NULL DEFAULT 'RIGHT',
  body TEXT NOT NULL,
  position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  gh_comment_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_prs_repo ON prs(repo_id);
CREATE INDEX IF NOT EXISTS idx_prs_state ON prs(state);
CREATE INDEX IF NOT EXISTS idx_reviews_pr ON reviews(pr_id);
CREATE INDEX IF NOT EXISTS idx_comments_review ON comments(review_id);
`);

// migration: incremental collect tracking
const repoCols = db.prepare("PRAGMA table_info(repos)").all() as Array<{ name: string }>;
if (!repoCols.some((c) => c.name === "last_collected_at")) {
  db.exec("ALTER TABLE repos ADD COLUMN last_collected_at TEXT");
  db.exec("UPDATE repos SET last_collected_at = datetime('now')");
}

export default db;
