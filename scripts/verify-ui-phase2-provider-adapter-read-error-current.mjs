import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Preserve the original driver and review artifacts. Replay the same cases against current Vue.
const file = "scripts/verify-ui-phase2-provider-adapter-read-error.mjs";
let runner = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
assert.equal(
  createHash("sha256").update(runner).digest("hex"),
  "1799619b1e5fa42b8646971ca53310b49c2dbb675130e7999c5a454c1b4cfea1",
  "Inspect changes to the original read-error driver before adapting it",
);
function replace(before, after) {
  assert.equal(runner.split(before).length, 2, before);
  runner = runner.replace(before, after);
}
replace(
  'const output = "output/playwright/p47-read-error-review";',
  'const output = "output/playwright/p47-read-error-current-review";',
);
replace(
  '  "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-read-error-preview.css";',
  '  "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-read-error-current-preview.css";',
);
replace(
  '  "scripts/verify-ui-phase2-provider-adapter-read-error.mjs",',
  '  "scripts/verify-ui-phase2-provider-adapter-read-error.mjs",\n' +
    '  "scripts/verify-ui-phase2-provider-adapter-read-error-current.mjs",\n' +
    '  "scripts/lib/ui-imported-style-sources.mjs",\n' +
    '  "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-read-error-preview.css",',
);
replace(
  '          await page.clock.install({ time: new Date("2026-09-11T06:00:00Z") });',
  '          await page.clock.install({ time: new Date("2026-09-11T06:00:00Z") });\n' +
    '          await page.clock.setFixedTime(new Date("2026-09-11T06:00:00Z"));',
);
replace(
  '          kind: "P47-READ-ERROR-REVIEW-r1",',
  '          kind: "P47-READ-ERROR-CURRENT-REVIEW-r1",\n' +
    '          historicalPackage: "output/playwright/p47-read-error-review",\n' +
    '          userReview: "pending",',
);
replace(
  "  await browser.close();\n  browser = null;",
  '  await includeImportedStyleSources(sources, (file) => file.startsWith("apps/web/src/") ? read(file) : "");\n' +
    "  await browser.close();\n  browser = null;",
);
replace(
  '            check("no write-result claim", !(await panel.textContent()).includes("没有写入成功"));',
  '            check("no write-result claim", !(await panel.textContent()).includes("没有写入成功"));\n' +
    '            check("trace labels preserve 13px floor", await panel.locator("dt").evaluateAll(nodes => nodes.every(el => getComputedStyle(el).fontSize === "13px")));',
);
replace("<h1>P47 首次读取失败 · 独立审核稿</h1>", "<h1>P47 首次读取失败 · 当前 Vue 复核</h1>");
runner =
  'import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";\n' + runner;
runner = runner.replace(
  /from "([^"\n]+)"/g,
  (full, specifier) => "from " + JSON.stringify(import.meta.resolve(specifier)),
);
try {
  await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
