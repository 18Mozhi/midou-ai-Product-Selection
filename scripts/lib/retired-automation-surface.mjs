import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
export const automationArchiveRevision = "a273eb914055247a8122b400249e7edcd3274904";
const files = new Set([
  "apps/web/src/components/AutomationRuleCenter.vue",
  "apps/web/src/automation-rules.css",
  "apps/web/src/design/automation-rule-tokens.css",
  "tests/e2e/m05-05-automation-rules.spec.ts",
]);

// Offline historical input only; never restore these bytes into the product.
export function readArchivedAutomationSource(file, repo = root) {
  assert.ok(files.has(file), `unregistered automation archive file: ${file}`);
  return execFileSync("git", ["show", `${automationArchiveRevision}:${file}`], {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  }).replaceAll("\r\n", "\n");
}

export function assertAutomationSurfaceActive(repo = root) {
  if (!existsSync(resolve(repo, "apps/web/src/components/AutomationRuleCenter.vue")))
    throw new Error(
      "automation_surface_retired: /automations now opens the selection library; historical captures cannot be regenerated as current UI",
    );
}
