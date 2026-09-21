import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const file = "scripts/verify-ui-phase2-provider-adapter-empty.mjs";
let runner = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
assert.equal(
  createHash("sha256").update(runner).digest("hex"),
  "db56f1e99c7d4e49e9eb8fb1bc7e8ee5120d898da36946bd3c48e90dc0e8d353",
);
function replace(before, after) {
  assert.equal(runner.split(before).length, 2, before);
  runner = runner.replace(before, after);
}
replace(
  'const output = "output/playwright/p47-empty-review";',
  'const output = "output/playwright/p47-empty-refresh-focus-current";',
);
replace(
  "  replacement = previewAdapterEmpty(source);",
  "  replacement = previewCurrentAdapterEmpty(source);",
);
replace('              mode === "review" ? "search" : "BODY",', '              "search",');
replace(
  '  "scripts/verify-ui-phase2-provider-adapter-empty.mjs",',
  '  "scripts/verify-ui-phase2-provider-adapter-empty.mjs",\n' +
    '  "scripts/verify-ui-phase2-provider-adapter-empty-current.mjs",\n' +
    '  "scripts/lib/ui-phase2-adapter-empty-focus-baseline.mjs",\n' +
    '  "scripts/lib/ui-imported-style-sources.mjs",\n' +
    '  "scripts/verify-ui-phase2-provider-adapter-empty-refresh-current.mjs",\n' +
    '  "scripts/lib/ui-phase2-adapter-current-empty-preview.mjs",\n' +
    '  "scripts/lib/ui-phase2-adapter-refresh-focus-baseline.mjs",',
);
replace(
  "  await browser.close();\n  browser = null;",
  "  await includeImportedStyleSources(sources, read);\n  await browser.close();\n  browser = null;",
);
replace(
  '          await page.clock.install({ time: new Date("2026-09-11T06:00:00Z") });',
  '          await page.clock.install({ time: new Date("2026-09-11T06:00:00Z") });\n' +
    '          await page.clock.setFixedTime(new Date("2026-09-11T06:00:00Z"));',
);
replace(
  "Actual Vue baseline and isolated review. Only empty copy/classes/CSS plus local post-reset focus wrapper differ. Existing reset, six filter values, APIs and permissions unchanged. Local empty array/original M03 fixtures; no real API/probe/registration writes or deployment. Not full-page or a11y acceptance.",
  "Actual current Vue and existing visual review both preserve the implemented empty-reset and refresh focus fixes. Review changes only two empty-region classes and four copy strings, with its original scoped CSS; existing reset, six filter values, APIs and permissions unchanged. Historical negative focus/images preserved separately. Local empty array/original M03 fixtures, no real API/probe/registration writes or deployment. Not full-page or complete a11y acceptance.",
);
replace(
  '          kind: "P47-EMPTY-REVIEW-r1",',
  '          kind: "P47-EMPTY-CURRENT-REFRESH-FOCUS-r1",\n' +
    '          historicalPackage: "output/playwright/p47-empty-review",\n' +
    "          productionFocusImplemented: true,\n" +
    "          productionRefreshFocusPreserved: true,",
);
replace("<h1>P47 空态 · 独立审核稿</h1>", "<h1>P47 空态 · 当前双焦点保护</h1>");
replace(
  "生产未改。baseline保留原状，review为待审提案。",
  "baseline为当前生产组件，review为既有视觉提案。",
);
replace(
  "清除筛选焦点修复仅在预览。",
  "两者保留空态与刷新焦点保护；review仅替换原空态文案/样式，不改变生产代码或扩大批准。",
);
runner =
  'import { previewCurrentAdapterEmpty } from "./lib/ui-phase2-adapter-current-empty-preview.mjs";\n' +
  'import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";\n' +
  runner;
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
