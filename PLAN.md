# PLAN — Review-Monitoring App (Next.js)

## Context

Aplikasi review-monitoring baru: dashboard monitoring PR + dashboard analytics + review PR GitHub via Pi agent SDK. Tool lokal, single-user, tanpa login, jalan di mesin ini (`gh` sudah auth scopes repo, Pi auth `~/.pi/agent/auth.json` ready). Repo fresh (hanya `.git` + `.pi`).

Stack: **Next.js (App Router, Node runtime) + Tailwind v4 + shadcn/ui + Recharts**. Backend: `gh` CLI subprocess + Pi SDK `@earendil-works/pi-coding-agent` (v0.83.0) + SQLite `better-sqlite3` (v13).

## Keputusan (dari user)

| # | Keputusan |
|---|-----------|
| 1 | DB SQLite (better-sqlite3) |
| 2 | Scope repo = **semua repo yang bisa diakses** (`gh api user/repos?affiliation=owner,collaborator,organization_member`, paginate, exclude archived) |
| 3 | Review = line comments (file + line number) **+ summary comment** (body review) |
| 4 | Analytics: open/merged/closed ratio, avg time-to-review, per-repo breakdown, per-author breakdown, trend chart |
| 5 | Review Pi agent jalan + **streaming response live via SSE** |
| 6 | Single-user, tanpa auth/login |

## Arsitektur

```
src/
  app/
    layout.tsx / globals.css
    page.tsx                          # Dashboard monitoring: PR table + filter repo/state
    analytics/page.tsx                # Dashboard analytics: KPI + charts
    pr/[owner]/[repo]/[number]/
      page.tsx                        # PR detail: info + diff view + review workspace
    api/
      collect/route.ts                # POST: discover repos → collect/upsert PRs (dipanggil refresh button)
      reviews/run/route.ts            # POST: jalanin Pi agent, stream SSE text_delta live
      reviews/[id]/submit/route.ts    # POST: submit review via gh api → mark submitted
      reviews/[id]/comments/route.ts  # POST/PUT/DELETE: CRUD draft comments
  server/
    db/
      schema.sql                      # DDL
      index.ts                        # better-sqlite3 init + migrations + query helpers
      repos.ts / prs.ts / reviews.ts  # query helpers per domain
    github/
      index.ts                        # gh CLI wrapper (execFile promisified)
        listAccessibleRepos()         # gh api user/repos, paginate
        listPRs(repo)                 # gh pr list --state all --json ...
        getPR(owner, repo, num)
        getDiff(owner, repo, num)     # gh pr diff
        submitReview(owner, repo, num, {commitId, summary, comments[]})
    review/
      runner.ts                       # createAgentSession + prompt(diff) + event stream
      parser.ts                       # parse output JSON → {summary, comments[]} + validasi hunk
    analytics.ts                      # queries: ratio, time-to-review, per-repo, per-author, trend
  lib/
    types.ts                          # PR, Review, Comment, ReviewResult (zod-shared shape)
    diff-parser.ts                    # parse unified diff → files[{path, hunks[{newStart, lines[]}]}]
    diff-utils.ts                     # hunk line lookup, nearest-line clamp, side
  components/
    pr-table.tsx                      # shadcn Table
    pr-status-badge.tsx
    diff-viewer.tsx                   # render diff per file, click line → add comment
    comment-thread.tsx                # list comment draft per file + inline edit/delete
    review-panel.tsx                  # "Run Pi Review" + streaming log + summary textarea + submit
    streaming-console.tsx             # SSE event log (text_delta live)
    analytics/*.tsx                   # KPI cards + Recharts (Pie, Bar, Area)
  scripts/
    diff-parser.test.ts               # self-check parser (bun run / tsx)
```

### Alur Review (Q5)

1. UI klik "Run Pi Review" → `POST /api/reviews/run` (body: owner, repo, number)
2. Server: get diff (`gh pr diff`) → `createAgentSession()` (default model/auth dari settings pi) → `session.prompt(diff + instruksi output JSON)`
3. Route handler stream SSE: forward `message_update`/`text_delta` + `tool_execution_*` events → UI console live
4. `agent_end` → ambil `session.agent.state.messages` → parser ekstrak JSON review → simpan draft review + comments di DB → kirim event `review_complete` (id review)
5. UI render comments di diff viewer (anchored ke file+line), user bisa edit/tambah/hapus
6. "Submit Review" → `POST /api/reviews/[id]/submit` → `gh api repos/{o}/{r}/pulls/{n}/reviews -f event=COMMENT -f commit_id=<headRefOid> -f body=<summary> -f comments='[{path,line,side,body}]'` → update status submitted + simpan gh_review_id

### Prompt Pi agent

Dedicated **professional code review system prompt** (`server/review/prompt.ts`), bukan generic. Isi prompt:

**System prompt (role) — verbatim dari user:**
> Kamu adalah seorang Senior Tech Lead dengan lebih dari 10 tahun pengalaman dalam rekayasa perangkat lunak skala besar. Tugas utamamu HANYA SATU: melakukan tinjauan kode (code review) pada perubahan kode (diff) secara komprehensif, profesional, objektif, dan berwawasan arsitektural.
>
> Sebagai Tech Lead, saat mereview kode, evaluasi hal-hal berikut:
> 1. Kesesuaian Arsitektur & Desain: Apakah perubahan ini sejalan dengan pola sistem yang ada? Apakah ada risiko technical debt?
> 2. Performa & Skalabilitas: Apakah ada potensi bottleneck atau penggunaan resource yang tidak efisien?
> 3. Keamanan (Security): Apakah ada celah kerentanan (misal: injeksi, kebocoran data, otorisasi yang buruk)?
> 4. Standar Penamaan & Bahasa (SANGAT PENTING):
>    - Variabel dan fungsi HARUS menggunakan `camelCase`.
>    - Kelas (Class) HARUS menggunakan `PascalCase`.
>    - Konstanta (Constant) HARUS menggunakan `UPPERCASE` (atau `UPPER_SNAKE_CASE`).
>    - Seluruh nama variabel, fungsi, dan kelas WAJIB ditulis dalam Bahasa Inggris yang jelas dan deskriptif. Tegur dengan sopan jika ada penamaan menggunakan bahasa lokal/selain bahasa Inggris.
> 5. Maintainability: Apakah kode mudah dibaca, diuji (testable), dan mengikuti standar clean code? Berikan umpan balik yang konstruktif dan mendidik.
>
> BATASAN SISTEM (SANGAT KETAT):
> - Kamu BUKAN eksekutor atau penulis kode dalam sesi ini.
> - DILARANG KERAS mengedit file, membuat file baru, atau menjalankan perintah sistem yang memutasi data.
> - Gunakan HANYA tools read-only (seperti cat, read, grep, find, ls) secara strategis untuk memahami konteks file yang diubah di dalam repositori.
>
> Format Umpan Balik:
> Berikan ringkasan dampak dari diff tersebut, soroti isu-isu kritikal (jika ada), lalu berikan poin-poin saran perbaikan. Khusus untuk pelanggaran penamaan (naming) atau penggunaan bahasa non-Inggris, tunjukkan baris kodenya dan berikan contoh perbaikannya. Gunakan nada yang tegas namun suportif layaknya seorang mentor.

**Output format (wajib, strict — appended setelah teks di atas):**
```json
{
  "summary": "ringkasan review level PR: penilaian keseluruhan, top issues, verdict (APPROVE / REQUEST_CHANGES / COMMENT)",
  "comments": [ { "path": "src/foo.ts", "line": 42, "body": "..." } ]
}
```
- `line` = nomor baris file **baru** (new side)
- Dilarang output selain JSON (no markdown wrapper, no extra text) — parser akan gagal parsing jika melanggar, lalu retry 1x dengan peringatan
- Maks ~20 komentar, hanya yang berdampak

**User prompt (per-run):**
> Review PR berikut. Diff:
> ```\n<diff>\n```
> Konteks tambahan: repo, PR title, branch base/head.

Validasi di parser: line harus dalam range hunk file tsb; di luar range → clamp ke nearest hunk line (dengan catatan di body) atau drop + warning.

### DB Schema (SQLite)

```sql
repos    (id PK, name_with_owner UNIQUE, discovered_at)
prs      (id PK, repo_id FK, number, title, author_login, author_name, state, is_draft,
          additions, deletions, review_decision, head_ref_oid, url,
          created_at, updated_at, merged_at, closed_at, UNIQUE(repo_id, number))
reviews  (id PK, pr_id FK, status TEXT CHECK(draft|submitted), summary TEXT,
          pi_model TEXT, created_at, submitted_at, gh_review_id)
comments (id PK, review_id FK, path, line, side TEXT DEFAULT 'RIGHT', body,
          position INT, status TEXT CHECK(draft|submitted), gh_comment_id)
```

### Analytics (Q4)

- **Ratio**: count prs by state (OPEN/MERGED/CLOSED) → Pie
- **Avg time-to-review**: `avg(reviews.submitted_at - prs.created_at)` utk PR yg sudah direview
- **Per-repo**: count PR per repo → Bar (bisa stacked by state)
- **Per-author**: count PR per author_login → Bar
- **Trend**: PR created per week (state stacked) → Area/Bar; range pilihan (30/90/365 hari)
- Query via SQL aggregate di `server/analytics.ts`, chart via Recharts di `components/analytics/`

## Files to create

Semua file di atas (greenfield). Konfigurasi:

- `config.json` (root): `{ "excludeArchived": true, "collectLimitPerRepo": 100, "refreshMinutes": 15 }` — kecil, default dipakai
- DB file: `data/app.db` (gitignore)

## Reuse

- **Pi SDK**: `@earendil-works/pi-coding-agent` — pola `createAgentSession` + `session.subscribe` dari docs (sudah di-fetch); contoh: `github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/sdk`
- **Auth/model pi**: `ModelRuntime.create()` default baca `~/.pi/agent/auth.json` + settings (default model deepseek-v4-flash-free via 9router) — tanpa config tambahan
- **gh CLI**: sudah auth (`fawait123`, scopes repo); `gh pr list --json` field exact sudah diverifikasi (number, title, author, state, createdAt, mergedAt, closedAt, updatedAt, url, headRefOid, isDraft, additions, deletions, reviewDecision, files)
- **Repo discovery**: `gh api 'user/repos?affiliation=owner,collaborator,organization_member&per_page=100'` — satu endpoint cover own + collab + org member (termasuk org Geekgarden-Dev)
- **shadcn/ui**: `npx shadcn@latest init` + add (table, card, badge, button, dialog, dropdown-menu, select, tabs, textarea, sonner)
- **Recharts**: sudah standard shadcn chart add-on

## Steps

1. [x] Scaffold: `npx create-next-app@latest` (TS, App Router, Tailwind v4, src/) + `npx shadcn@latest init` (dark theme) + install `@earendil-works/pi-coding-agent`, `better-sqlite3`, `recharts`
2. [x] DB layer: `schema.sql` + `server/db/index.ts` (init, migrate on boot, prepared statements) + query helpers repos/prs/reviews
3. [x] `lib/diff-parser.ts`: parse unified diff → per-file hunks + line maps; self-check script
4. [x] `server/github/index.ts`: wrapper gh (listAccessibleRepos, listPRs, getPR, getDiff, submitReview) — execFile, error surfaced
5. [x] `POST /api/collect`: discover repos → upsert PRs (limit + pagination, exclude archived) → return stats
6. [x] `server/review/runner.ts` + `POST /api/reviews/run` (SSE): stream text_delta → parse JSON → persist draft review + comments → complete event
7. [x] CRUD comments route + submit route (`gh api .../reviews`)
8. [x] Dashboard monitoring: `page.tsx` + `pr-table.tsx` (filter repo/state, refresh button panggil /api/collect)
9. [x] PR detail: info header, `diff-viewer.tsx` (per-file, hunk, click line → add comment), `comment-thread.tsx` (edit/delete), `review-panel.tsx` (run review + streaming console + summary + submit)
10. [x] Analytics: `server/analytics.ts` + halaman + charts (KPI, Pie ratio, Bar per-repo/per-author, Area trend)
11. [x] Polish: status badge, error/empty states, loading skeleton, sonner toast
12. [x] Verifikasi end-to-end (di bawah)

## Verification

1. [x] **Parser**: `bun scripts/diff-parser.test.ts` — assert hunk parsing + nearest-line clamp (file nyata dari `gh pr diff`) → ALL PASS
2. [x] **Collect**: `curl -X POST localhost:3000/api/collect` → PRs masuk DB (`repos` 200, `prs` 4215) + **incremental** (skipped 200 dalam 4.8s, pakai kolom `repos.last_collected_at` + `refreshMinutes`)
3. [x] **Review flow**: PR nyata `fawait123/chattbot-be#16` → Run Pi Review → SSE streaming live (666 delta events, model `oc/deepseek-v4-flash-free`) → komentar anchored `src/main.ts:9` → edit/tambah/hapus → Submit → **terverifikasi di GitHub** (review `4826296479` COMMENTED + 2 line comments)
4. [x] **Analytics**: `/analytics` render dengan data (4215 PRs: 8 OPEN / 4157 MERGED / 50 CLOSED, 56 author)
5. [x] **Regresi**: `npm run build` sukses; collect idempotent (run 2x, no duplicate)

### Fix yang ditemukan saat verifikasi
- `POST /api/collect` lambat (200 repo sequential, >120s) → incremental skip via `last_collected_at` (migration di `db/index.ts`)
- Submit review gagal: `gh -f comments='[{...}]'` mengirim string → GitHub 422 "not an array" → fix: body JSON + `--input` file (`server/github/index.ts`)
- Turbopack quirk: jangan sisipkan kode JS di dalam template literal SQL `db.exec` (parse error semu)
