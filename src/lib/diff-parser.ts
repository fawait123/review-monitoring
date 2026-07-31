import type { DiffFile, DiffHunk, DiffLine, DiffLineKind } from "@/lib/types";

/**
 * Parse unified diff (output `gh pr diff`) menjadi per-file hunks + line maps.
 * Line = nomor baris file BARU (new side) untuk komentar GitHub.
 */
export function parseDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;
  let hunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const raw of diff.split("\n")) {
    if (raw.startsWith("diff --git ")) {
      if (current) files.push(current);
      const m = raw.match(/diff --git a\/(.*?) b\/(.*?)$/);
      const path = m ? m[2] : raw.slice(11).trim();
      current = { path, hunks: [] };
      hunk = null;
      continue;
    }
    if (raw.startsWith("+++ ") || raw.startsWith("--- ") || raw.startsWith("index ")) continue;
    if (!current) continue;
    if (raw.startsWith("@@")) {
      const m = raw.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (m) {
        hunk = {
          oldStart: Number(m[1]),
          oldLines: m[2] ? Number(m[2]) : 1,
          newStart: Number(m[3]),
          newLines: m[4] ? Number(m[4]) : 1,
          lines: [],
        };
        oldLine = hunk.oldStart;
        newLine = hunk.newStart;
        current.hunks.push(hunk);
      }
      continue;
    }
    if (!hunk) continue;

    let kind: DiffLineKind;
    const content = raw.slice(1);
    let old: number | null = null;
    let new_: number | null = null;
    if (raw.startsWith("+")) {
      kind = "add";
      new_ = newLine++;
    } else if (raw.startsWith("-")) {
      kind = "del";
      old = oldLine++;
    } else {
      kind = "context";
      old = oldLine++;
      new_ = newLine++;
    }
    hunk.lines.push({ kind, oldLine: old, newLine: new_, content });
  }
  if (current) files.push(current);
  return files;
}

/** Kumpulan new-line numbers yang ada dalam diff (hanya add/context) per file. */
export function hunkLineRanges(files: DiffFile[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const f of files) {
    const lines: number[] = [];
    for (const h of f.hunks) {
      for (const l of h.lines) {
        if (l.newLine !== null && l.kind !== "del") lines.push(l.newLine);
      }
    }
    map.set(f.path, lines);
  }
  return map;
}

/** Clamp line ke nearest diff line (add/context) di file tsb. Return null jika file tak ada. */
export function clampToHunkLine(files: DiffFile[], path: string, line: number): number | null {
  const ranges = hunkLineRanges(files);
  const lines = ranges.get(path);
  if (!lines || lines.length === 0) return null;
  let best = lines[0];
  let bestDist = Infinity;
  for (const l of lines) {
    const d = Math.abs(l - line);
    if (d < bestDist) {
      bestDist = d;
      best = l;
    }
  }
  return best;
}
