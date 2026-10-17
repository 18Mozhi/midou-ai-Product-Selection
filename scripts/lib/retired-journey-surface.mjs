import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
export const journeyArchiveRevision = "a21e8faafa9879564ab7bb899bcb46d5358cf443";
const files = new Set([
  "tests/e2e/ui-phase2-journey-contracts.spec.ts",
  "apps/web/src/components/SelectionJourney.vue",
  "apps/web/src/selection-journey.css",
  "apps/web/src/selection-journey-validation.css",
  "apps/web/src/design/selection-tokens.css",
]);

// Offline historical input only; never restore these bytes into the product.
export function readArchivedJourneySource(file, repo = root) {
  assert.ok(files.has(file), `unregistered journey archive file: ${file}`);
  return execFileSync("git", ["show", `${journeyArchiveRevision}:${file}`], {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  }).replaceAll("\r\n", "\n");
}

export function assertJourneySurfaceActive(repo = root) {
  if (!existsSync(resolve(repo, "apps/web/src/components/SelectionJourney.vue")))
    throw new Error(
      "journey_surface_retired: /opportunities/start now opens the selection library; historical captures cannot be regenerated as current UI",
    );
}
