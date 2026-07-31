import type { ReviewResult } from "@/lib/types";

export interface ReviewRunCallbacks {
  onDelta: (text: string) => void;
  onTool: (toolName: string, input: string, output: string, isError: boolean) => void;
  onDone: (model: string | null) => void;
}

interface RunOptions {
  diff: string;
  owner: string;
  repo: string;
  number: number;
  title: string;
  baseRef: string;
  headRef: string;
  clampLine: (path: string, line: number) => number | null;
  cb: ReviewRunCallbacks;
}

/** Ekstrak teks terakhir dari assistant message (defensive thd bentuk content parts). */
function lastAssistantText(messages: any[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "assistant") continue;
    const parts = m.content;
    if (Array.isArray(parts)) {
      const texts = parts.filter((p: any) => p?.type === "text" && typeof p.text === "string").map((p: any) => p.text);
      if (texts.length > 0) return texts.join("\n");
    }
    if (typeof m.text === "string" && m.text.length > 0) return m.text;
  }
  return "";
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse(candidate.trim());
}

export function parseReviewResult(text: string): ReviewResult {
  const parsed = extractJson(text) as any;
  if (!parsed || typeof parsed !== "object") throw new Error("Output bukan JSON object");
  const summary = typeof parsed.summary === "string" ? parsed.summary : "";
  const comments = Array.isArray(parsed.comments)
    ? parsed.comments
        .filter((c: any) => c && typeof c.path === "string" && typeof c.body === "string")
        .map((c: any) => ({ path: c.path, line: Number(c.line) || 0, body: c.body }))
    : [];
  return { summary, comments };
}

export async function runReview(
  opts: RunOptions
): Promise<{ result: ReviewResult; model: string | null }> {
  const pi = await import("@earendil-works/pi-coding-agent");
  const { REVIEW_SYSTEM_PROMPT, buildReviewUserPrompt } = await import("./prompt");

  const modelRuntime = await pi.ModelRuntime.create();
  const { session } = await pi.createAgentSession({
    modelRuntime,
    sessionManager: pi.SessionManager.inMemory(),
    tools: ["read", "grep", "find", "ls"],
    cwd: process.cwd(),
  });

  let lastModel: string | null = null;
  session.subscribe((event: any) => {
    switch (event.type) {
      case "message_update":
        if (event.assistantMessageEvent?.type === "text_delta") {
          opts.cb.onDelta(event.assistantMessageEvent.delta);
        }
        break;
      case "tool_execution_start":
        opts.cb.onTool(event.toolName, event.input ?? "", "", false);
        break;
      case "tool_execution_end":
        opts.cb.onTool(event.toolName, "", event.output ?? "", !!event.isError);
        break;
      case "agent_end":
        lastModel = session.model?.id ?? null;
        break;
    }
  });

  const userPrompt = buildReviewUserPrompt({
    owner: opts.owner,
    repo: opts.repo,
    number: opts.number,
    title: opts.title,
    baseRef: opts.baseRef,
    headRef: opts.headRef,
    diff: opts.diff,
  });

  // SATU prompt: system + diff barengan. Kalau dipisah, agent jawab dulu "Belum ada diff"
  // utk prompt system (tanpa diff) sebelum terima diff → stream berantakan.
  await session.prompt(`${REVIEW_SYSTEM_PROMPT}\n\n${userPrompt}`);

  let text = lastAssistantText(session.agent.state.messages);
  let result: ReviewResult;
  try {
    result = parseReviewResult(text);
  } catch {
    // retry 1x: minta JSON murni
    await session.prompt(
      "Output kamu tidak valid JSON. Balas ULANG dengan SATU objek JSON valid sesuai format yang diminta, tanpa teks lain, tanpa markdown code fence."
    );
    text = lastAssistantText(session.agent.state.messages);
    result = parseReviewResult(text);
  }
  session.dispose();

  // validasi + clamp line ke hunk diff
  const clamped = [];
  for (const c of result.comments) {
    const line = opts.clampLine(c.path, c.line);
    if (line === null) continue; // file tak ada di diff → drop
    clamped.push({ ...c, line });
  }
  opts.cb.onDone(lastModel);
  return { result: { summary: result.summary, comments: clamped }, model: lastModel };
}
