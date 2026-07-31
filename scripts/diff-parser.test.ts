import { parseDiff, clampToHunkLine } from "../src/lib/diff-parser";

const FIXTURE = `diff --git a/src/server.ts b/src/server.ts
index abc123..def456 100644
--- a/src/server.ts
+++ b/src/server.ts
@@ -10,7 +10,8 @@ import { start } from "./app";
 const port = process.env.PORT || 3000;
 start(port);
-// legacy: no logging
+// boot logging
+console.log("listening", port);
 function handle(req) {
   return "ok";
 }
@@ -40,5 +41,6 @@ function handle(req) {
 async function shutdown() {
   await flush();
 }
+gracefulShutdown();
diff --git a/src/utils.ts b/src/utils.ts
new file mode 100644
--- /dev/null
+++ b/src/utils.ts
@@ -0,0 +1,3 @@
+export const VERSION = "1.0";
+export function clamp(n: number, lo: number, hi: number) {
+  return Math.min(hi, Math.max(lo, n));
+}
`;

const files = parseDiff(FIXTURE);
console.log("files:", files.map((f) => `${f.path} (${f.hunks.length} hunks)`));

const server = files.find((f) => f.path === "src/server.ts")!;
const h1 = server.hunks[0];
console.assert(h1.newStart === 10, "hunk1 newStart", h1.newStart);
console.assert(h1.oldStart === 10, "hunk1 oldStart");
// new side: baris 10-17 (8 baris). add line "console.log(...)" = new line 13
const addLine = h1.lines.find((l) => l.content === "console.log(\"listening\", port);");
console.assert(addLine?.newLine === 13, "add line newLine", addLine?.newLine);
const delLine = h1.lines.find((l) => l.content === "// legacy: no logging");
console.assert(delLine?.oldLine === 12, "del line oldLine", delLine?.oldLine);
console.assert(delLine?.newLine === null, "del line newLine null");

const utils = files.find((f) => f.path === "src/utils.ts")!;
console.assert(utils.hunks[0].newStart === 1 && utils.hunks[0].newLines === 3, "new file hunk");

// clamp: line 12 ada di hunk server (context/add range 10..17)
console.assert(clampToHunkLine(files, "src/server.ts", 12) === 12, "clamp exact");
// line 30 di luar range hunk server → nearest = 17
console.assert(clampToHunkLine(files, "src/server.ts", 30) === 17, "clamp nearest hi");
console.assert(clampToHunkLine(files, "src/server.ts", 1) === 10, "clamp nearest lo");
// file tak ada di diff → null
console.assert(clampToHunkLine(files, "src/missing.ts", 5) === null, "clamp missing file");
// hunk 2 (41..46): line 44 valid
console.assert(clampToHunkLine(files, "src/server.ts", 44) === 44, "clamp hunk2");

console.log("ALL PASS");
