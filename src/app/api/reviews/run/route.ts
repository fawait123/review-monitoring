import { NextRequest } from "next/server";
import { getPRDiff, getPRDetail, getPRFull } from "@/server/github";
import { upsertRepo } from "@/server/db/repos";
import { upsertPR, getPRByKey } from "@/server/db/prs";
import { createReview } from "@/server/db/reviews";
import { runReview } from "@/server/review/runner";
import { parseDiff, clampToHunkLine } from "@/lib/diff-parser";
import type { DiffFile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const { owner, repo, number } = (await req.json()) as {
    owner: string;
    repo: string;
    number: number;
  };
  if (!owner || !repo || !number) {
    return new Response("body butuh {owner, repo, number}", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));
      const reqAborted = req.signal;
      reqAborted.addEventListener("abort", () => controller.error(new Error("aborted")));

      try {
        // pastikan repo + PR ada di DB (kalau belum ke-collect)
        const repoRow = upsertRepo(`${owner}/${repo}`);
        let pr = getPRByKey(`${owner}/${repo}`, number);
        if (!pr) {
          const full = await getPRFull(owner, repo, number);
          upsertPR({ repo_id: repoRow.id, ...full });
          pr = getPRByKey(`${owner}/${repo}`, number)!;
        }

        const [diff, detail] = await Promise.all([
          getPRDiff(owner, repo, number),
          getPRDetail(owner, repo, number),
        ]);
        const files: DiffFile[] = parseDiff(diff);
        const clampLine = (path: string, line: number) => clampToHunkLine(files, path, line);
        send("diff", { size: diff.length, files: files.map((f) => f.path) });

        const { result, model } = await runReview({
          diff,
          owner,
          repo,
          number,
          title: detail.title,
          baseRef: detail.baseRefName,
          headRef: detail.headRefName,
          clampLine,
          cb: {
            onDelta: (t) => send("delta", { text: t }),
            onTool: (toolName, input, output, isError) =>
              send("tool", { toolName, input, output, isError }),
            onDone: (model) => send("model", { model }),
          },
        });

        const review = createReview(pr.id, result, model);
        send("complete", {
          reviewId: review.id,
          summary: result.summary,
          comments: result.comments,
        });
      } catch (err: any) {
        send("error", { message: err.message ?? String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
