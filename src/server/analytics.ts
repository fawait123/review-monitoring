import db from "./db";

export interface StateCount {
  state: string;
  count: number;
}

export interface RepoBreakdown {
  repo: string;
  OPEN: number;
  MERGED: number;
  CLOSED: number;
}

export interface AuthorBreakdown {
  author: string;
  count: number;
}

export interface TrendPoint {
  week: string;
  OPEN: number;
  MERGED: number;
  CLOSED: number;
}

export interface AnalyticsData {
  total: number;
  repoCount: number;
  stateRatio: StateCount[];
  avgTimeToReviewDays: number | null;
  reviewedCount: number;
  perRepo: RepoBreakdown[];
  perAuthor: AuthorBreakdown[];
  trend: TrendPoint[];
}

export function getAnalytics(): AnalyticsData {
  const stateRatio = db
    .prepare(`SELECT state, COUNT(*) AS count FROM prs GROUP BY state`)
    .all() as StateCount[];

  const reviewRow = db
    .prepare(
      `SELECT AVG(julianday(r.submitted_at) - julianday(p.created_at)) AS avg_days,
              COUNT(*) AS reviewed
       FROM reviews r JOIN prs p ON p.id = r.pr_id
       WHERE r.status = 'submitted' AND r.submitted_at IS NOT NULL`
    )
    .get() as { avg_days: number | null; reviewed: number };

  const perRepo = db
    .prepare(
      `SELECT r.name_with_owner AS repo,
              SUM(CASE WHEN p.state='OPEN' THEN 1 ELSE 0 END) AS OPEN,
              SUM(CASE WHEN p.state='MERGED' THEN 1 ELSE 0 END) AS MERGED,
              SUM(CASE WHEN p.state='CLOSED' THEN 1 ELSE 0 END) AS CLOSED
       FROM prs p JOIN repos r ON r.id = p.repo_id
       GROUP BY r.name_with_owner ORDER BY (OPEN+MERGED+CLOSED) DESC LIMIT 15`
    )
    .all() as RepoBreakdown[];

  const perAuthor = db
    .prepare(
      `SELECT author_login AS author, COUNT(*) AS count
       FROM prs GROUP BY author_login ORDER BY count DESC LIMIT 15`
    )
    .all() as AuthorBreakdown[];

  const trend = db
    .prepare(
      `SELECT strftime('%Y-W%W', created_at) AS week,
              SUM(CASE WHEN state='OPEN' THEN 1 ELSE 0 END) AS OPEN,
              SUM(CASE WHEN state='MERGED' THEN 1 ELSE 0 END) AS MERGED,
              SUM(CASE WHEN state='CLOSED' THEN 1 ELSE 0 END) AS CLOSED
       FROM prs WHERE created_at >= datetime('now', '-365 days')
       GROUP BY week ORDER BY week`
    )
    .all() as TrendPoint[];

  const repoRow = db.prepare(`SELECT COUNT(*) AS c FROM repos`).get() as { c: number };

  return {
    total: stateRatio.reduce((a, s) => a + s.count, 0),
    repoCount: repoRow.c,
    stateRatio,
    avgTimeToReviewDays: reviewRow.avg_days,
    reviewedCount: reviewRow.reviewed,
    perRepo,
    perAuthor,
    trend,
  };
}
