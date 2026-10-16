import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
export const competitorArchiveRevision = "dc7c862a725249d67b29011de508664ae3714432";
const files = new Set([
  "apps/web/src/components/CompetitorMonitor.vue",
  "apps/web/src/competitor.css",
  "apps/web/src/design/competitor-review-tokens.css",
  "tests/e2e/m04-05-competitors.spec.ts",
  "tests/e2e/ui-phase2-competitor-races.spec.ts",
]);
/** Explicit historical UI evidence only. Never imported into the production app. */
export function readArchivedCompetitorSource(file, repo = root) {
  assert.ok(files.has(file), `unregistered competitor archive file: ${file}`);
  return execFileSync("git", ["show", `${competitorArchiveRevision}:${file}`], {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  }).replaceAll("\r\n", "\n");
}
/** Used only by retained historical review tests; all unrelated files remain live. */
export async function readCompetitorReviewFile(file, options) {
  const name = relative(root, resolve(file instanceof URL ? fileURLToPath(file) : file)).replaceAll(
    "\\",
    "/",
  );
  if (!files.has(name)) return readFile(file, options);
  const source = readArchivedCompetitorSource(name);
  return (typeof options === "string" ? options : options?.encoding) ? source : Buffer.from(source);
}

/** Initial review diagnostics had intentional UNFIXED assertions; bind them to their own original epoch. */
export function readOriginalCompetitorReviewSource() {
  return execFileSync(
    "git",
    [
      "show",
      "b30fb8a2f07a84825037a4a52dba7796109801c5:apps/web/src/components/CompetitorMonitor.vue",
    ],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    },
  ).replaceAll("\r\n", "\n");
}
