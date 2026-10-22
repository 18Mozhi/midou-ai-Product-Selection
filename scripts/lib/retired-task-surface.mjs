import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readLegacyCssFileSync as readFileSync } from "./retired-runtime-css.mjs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { readCompetitorReviewFile } from "./retired-competitor-surface.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
export const taskArchiveRevision = "d206bb018442bb2d4d24fc92c85de6fe41c55a7a";
export const retiredTaskFiles = new Set([
  "apps/web/src/components/TaskWorkspace.vue",
  "apps/web/src/components/TaskActionDialog.vue",
  "apps/web/src/components/TaskBatchActions.vue",
  "apps/web/src/components/TaskDetailPanel.vue",
  "apps/web/src/components/TaskExportJobsPanel.vue",
  "apps/web/src/components/TaskListPanel.vue",
  "apps/web/src/components/task-workspace-types.ts",
  "apps/web/src/components/task-page-header.css",
  "apps/web/src/task-workspace.css",
  "apps/web/src/task-workspace-enhancements.css",
  "apps/web/src/design/task-workspace-tokens.css",
]);
const cache = new Map();
export function readArchivedTaskSource(file) {
  assert.ok(retiredTaskFiles.has(file), `unregistered task archive file: ${file}`);
  if (!cache.has(file))
    cache.set(
      file,
      execFileSync("git", ["show", `${taskArchiveRevision}:${file}`], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      }).replaceAll("\r\n", "\n"),
    );
  return cache.get(file);
}
function archived(file, options) {
  const name = relative(root, resolve(file instanceof URL ? fileURLToPath(file) : file)).replaceAll(
    "\\",
    "/",
  );
  if (!retiredTaskFiles.has(name)) return null;
  const source = readArchivedTaskSource(name);
  return (typeof options === "string" ? options : options?.encoding) ? source : Buffer.from(source);
}
/** Explicit historical UI bytes only; all unrelated files remain current. */
export async function readTaskReviewFile(file, options) {
  return archived(file, options) ?? readCompetitorReviewFile(file, options);
}
export function readTaskReviewFileSync(file, options) {
  return archived(file, options) ?? readFileSync(file, options);
}
export function assertTaskSurfaceActive(repo = root) {
  if (!existsSync(resolve(repo, "apps/web/src/components/TaskWorkspace.vue")))
    throw new Error(
      "task_surface_retired: member task editors and directories have been removed; legacy URLs open the selection workspace",
    );
}
