import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
export const reportArchiveRevision = "d9f1e8b3c2ae7f5f0ad1ddee9b2d18505cfef84f";
const archivedFiles = new Set([
  "apps/web/src/components/ReportCenter.vue",
  "apps/web/src/report-center.css",
  "apps/web/src/design/report-center-tokens.css",
  "tests/e2e/m05-06-reports.spec.ts",
]);

/** Read-only historical tests; these bytes are never put back into the app. */
export function readArchivedReportSource(file, repo = root) {
  assert.ok(archivedFiles.has(file), `unregistered report archive file: ${file}`);
  return execFileSync("git", ["show", `${reportArchiveRevision}:${file}`], {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  }).replaceAll("\r\n", "\n");
}

export function assertReportSurfaceActive(repo = root) {
  if (!existsSync(resolve(repo, "apps/web/src/components/ReportCenter.vue")))
    throw new Error(
      "report_surface_retired: /reports now opens the selection library; historical captures cannot be regenerated as current UI",
    );
}
