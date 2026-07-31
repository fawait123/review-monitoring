import db from "./index";
import type { Review, ReviewComment, ReviewResult } from "@/lib/types";

interface ReviewRow {
  id: number;
  pr_id: number;
  status: string;
  summary: string;
  pi_model: string | null;
  created_at: string;
  submitted_at: string | null;
  gh_review_id: string | null;
}

interface CommentRow {
  id: number;
  review_id: number;
  path: string;
  line: number;
  side: string;
  body: string;
  position: number;
  status: string;
  gh_comment_id: string | null;
}

const createReviewStmt = db.prepare(
  `INSERT INTO reviews (pr_id, summary, pi_model) VALUES (?, ?, ?)`
);
const getReviewStmt = db.prepare(`SELECT * FROM reviews WHERE id = ?`);
const listReviewsStmt = db.prepare(
  `SELECT * FROM reviews WHERE pr_id = ? ORDER BY created_at DESC`
);
const updateReviewStatusStmt = db.prepare(
  `UPDATE reviews SET status = ?, submitted_at = ?, gh_review_id = ? WHERE id = ?`
);
const updateSummaryStmt = db.prepare(`UPDATE reviews SET summary = ? WHERE id = ?`);
const deleteReviewStmt = db.prepare(`DELETE FROM reviews WHERE id = ?`);

const insertCommentStmt = db.prepare(
  `INSERT INTO comments (review_id, path, line, side, body, position) VALUES (?, ?, ?, ?, ?, ?)`
);
const listCommentsStmt = db.prepare(
  `SELECT * FROM comments WHERE review_id = ? ORDER BY position`
);
const getCommentStmt = db.prepare(`SELECT * FROM comments WHERE id = ?`);
const updateCommentStmt = db.prepare(`UPDATE comments SET body = ?, line = ?, path = ? WHERE id = ?`);
const deleteCommentStmt = db.prepare(`DELETE FROM comments WHERE id = ?`);
const markCommentsSubmittedStmt = db.prepare(
  `UPDATE comments SET status = 'submitted', gh_comment_id = ? WHERE id = ?`
);

function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    prId: row.pr_id,
    status: row.status as Review["status"],
    summary: row.summary,
    piModel: row.pi_model,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    ghReviewId: row.gh_review_id,
  };
}

function toComment(row: CommentRow): ReviewComment {
  return {
    id: row.id,
    reviewId: row.review_id,
    path: row.path,
    line: row.line,
    side: row.side,
    body: row.body,
    position: row.position,
    status: row.status as ReviewComment["status"],
    ghCommentId: row.gh_comment_id,
  };
}

export function createReview(prId: number, result: ReviewResult, piModel: string | null): Review {
  const info = createReviewStmt.run(prId, result.summary, piModel);
  const reviewId = Number(info.lastInsertRowid);
  result.comments.forEach((c, i) => {
    insertCommentStmt.run(reviewId, c.path, c.line, "RIGHT", c.body, i);
  });
  return getReviewStmt.get(reviewId) as ReviewRow as unknown as Review;
}

export function getReview(id: number): Review | null {
  const row = getReviewStmt.get(id) as ReviewRow | undefined;
  return row ? toReview(row) : null;
}

export function listReviews(prId: number): Review[] {
  return (listReviewsStmt.all(prId) as ReviewRow[]).map(toReview);
}

export function updateReviewSummary(id: number, summary: string): void {
  updateSummaryStmt.run(summary, id);
}

export function markReviewSubmitted(id: number, ghReviewId: string): void {
  updateReviewStatusStmt.run("submitted", new Date().toISOString(), ghReviewId, id);
}

export function deleteReview(id: number): void {
  deleteReviewStmt.run(id);
}

export function listComments(reviewId: number): ReviewComment[] {
  return (listCommentsStmt.all(reviewId) as CommentRow[]).map(toComment);
}

export function getComment(id: number): ReviewComment | null {
  const row = getCommentStmt.get(id) as CommentRow | undefined;
  return row ? toComment(row) : null;
}

export function updateComment(id: number, body: string, line: number, path: string): void {
  updateCommentStmt.run(body, line, path, id);
}

export function deleteComment(id: number): void {
  deleteCommentStmt.run(id);
}

export function addComment(
  reviewId: number,
  path: string,
  line: number,
  body: string
): ReviewComment {
  const pos = db
    .prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS p FROM comments WHERE review_id = ?`)
    .get(reviewId) as { p: number };
  const info = insertCommentStmt.run(reviewId, path, line, "RIGHT", body, pos.p);
  return getCommentStmt.get(Number(info.lastInsertRowid)) as CommentRow as unknown as ReviewComment;
}

export function markCommentSubmitted(id: number, ghCommentId: string): void {
  markCommentsSubmittedStmt.run(ghCommentId, id);
}
