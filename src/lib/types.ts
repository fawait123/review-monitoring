export type PRState = "OPEN" | "MERGED" | "CLOSED";
export type ReviewStatus = "draft" | "submitted";
export type CommentStatus = "draft" | "submitted";

export interface Repo {
  id: number;
  nameWithOwner: string;
  discoveredAt: string;
}

export interface PR {
  id: number;
  repoId: number;
  number: number;
  title: string;
  authorLogin: string;
  authorName: string | null;
  state: PRState;
  isDraft: boolean;
  additions: number;
  deletions: number;
  reviewDecision: string | null;
  headRefOid: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  repo?: string;
}

export interface Review {
  id: number;
  prId: number;
  status: ReviewStatus;
  summary: string;
  piModel: string | null;
  createdAt: string;
  submittedAt: string | null;
  ghReviewId: string | null;
}

export interface ReviewComment {
  id: number;
  reviewId: number;
  path: string;
  line: number;
  side: string;
  body: string;
  position: number;
  status: CommentStatus;
  ghCommentId: string | null;
}

export interface CollectedPR {
  number: number;
  title: string;
  authorLogin: string;
  authorName: string | null;
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

export interface ReviewResult {
  summary: string;
  comments: { path: string; line: number; body: string }[];
}

export interface DiffFile {
  path: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export type DiffLineKind = "context" | "add" | "del";

export interface DiffLine {
  kind: DiffLineKind;
  oldLine: number | null;
  newLine: number | null;
  content: string;
}
