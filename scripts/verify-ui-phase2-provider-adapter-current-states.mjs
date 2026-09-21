import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { paginationFocusRevision } from "./lib/ui-phase2-adapter-pagination-focus-baseline.mjs";

const args = process.argv.slice(2);
assert.ok(
  args.every((arg) => arg === "--capture" || /^--state=(access|filter-pagination)$/.test(arg)),
);
const selectors = args.filter((arg) => arg.startsWith("--state="));
assert.equal(selectors.length, 1);
const state = selectors[0].slice(8);
const paginationFocusPreserved =
  createHash("sha256")
    .update(
      (await readFile("apps/web/src/components/ProviderAdapterCenter.vue", "utf8")).replaceAll(
        "\r\n",
        "\n",
      ),
    )
    .digest("hex") === paginationFocusRevision.current;
assert.ok(
  !paginationFocusPreserved || !args.includes("--capture"),
  "Pagination-focus revision is replay-only here; do not overwrite historical current-review images",
);
process.argv = process.argv.filter((arg) => arg !== selectors[0]);
const file = `scripts/verify-ui-phase2-provider-adapter-${state}.mjs`;
let runner = (await readFile(file, "utf8")).replaceAll("\r\n", "\n");
assert.equal(
  createHash("sha256").update(runner).digest("hex"),
  {
    access: "87f51b00ac903101ad56b6fd75ba2240c3b985c6203b88dc13527dc465ca954a",
    "filter-pagination": "a359593927984f5af15a989f8885789124d0119ebeca0589b521e688b8a24c13",
  }[state],
);
function replace(before, after) {
  assert.equal(runner.split(before).length, 2, before);
  runner = runner.replace(before, after);
}
const name = state === "access" ? "Access" : "FilterPagination";
replace(
  `replacement = previewAdapter${name}(source);`,
  `replacement = previewCurrentAdapter${name}(source);`,
);
replace(
  `output = "output/playwright/p47-${state}-review"`,
  `output = "output/playwright/p47-${state}-current-review"`,
);
replace(
  `    "${file}",`,
  `    "${file}",\n` +
    [
      "scripts/verify-ui-phase2-provider-adapter-current-states.mjs",
      "scripts/lib/ui-phase2-adapter-current-state-preview.mjs",
      "scripts/lib/ui-phase2-adapter-empty-focus-baseline.mjs",
      "scripts/lib/ui-phase2-adapter-refresh-focus-baseline.mjs",
      "scripts/lib/ui-phase2-adapter-empty-mobile-baseline.mjs",
      "scripts/lib/ui-phase2-adapter-pagination-focus-baseline.mjs",
      "scripts/lib/ui-imported-style-sources.mjs",
      `scripts/lib/ui-phase2-adapter-${state === "access" ? "filter-pagination" : "access"}-preview.mjs`,
    ]
      .map((dependency) => `    "${dependency}",`)
      .join("\n"),
);
replace(
  "  await browser.close();\n  browser = null;",
  "  await includeImportedStyleSources(sources, read);\n  await browser.close();\n  browser = null;",
);
replace(
  'await page.clock.install({ time: new Date("2026-09-11T06:00:00Z") });',
  'await page.clock.install({ time: new Date("2026-09-11T06:00:00Z") });\n          await page.clock.setFixedTime(new Date("2026-09-11T06:00:00Z"));',
);
replace(
  `kind: "P47-${state.toUpperCase()}-REVIEW-r1",`,
  `kind: "P47-${state.toUpperCase()}-CURRENT-REVIEW-r1",\n          historicalPackage: "output/playwright/p47-${state}-review",\n          productionEmptyFocusPreserved: true,\n          productionRefreshFocusPreserved: true,\n          productionMobileEmptyPreserved: true,`,
);
replace(
  "          boundary:\n",
  '          currentBoundary: "Current raw Vue baseline; review preserves verified empty-reset and refresh focus fixes plus approved mobile empty implementation. Original artifacts stay immutable. No production changes, approval promotion or deployment.",\n          boundary:\n',
);
replace("独立审核稿</h1>", "当前源码审核稿</h1>");
replace("生产未改", "本轮生产未改；保留已实施的手机空态及两处焦点保护");
if (state === "filter-pagination") {
  if (paginationFocusPreserved) {
    const legacyExpected = 'mode === "review" ? "status" : "BODY"';
    assert.equal(runner.split(legacyExpected).length, 3);
    runner = runner.replaceAll(legacyExpected, '"status"');
    assert.equal(runner.split('document.activeElement?.matches(".adapter-page-status")').length, 3);
    runner = runner.replaceAll(
      'document.activeElement?.matches(".adapter-page-status")',
      'document.activeElement?.matches(".adapter-pagination span")',
    );
  }
  replace(
    '        check("filters and pages add no GET", reads, 1);',
    '        await expect(input).toBeFocused();\n        check("existing empty reset focus preserved", await input.evaluate((el) => document.activeElement === el));\n        check("filters and pages add no GET", reads, 1);',
  );
}
replace(
  "      runs: runs.length,",
  `      paginationFocusPreserved: ${paginationFocusPreserved},\n      runs: runs.length,`,
);
runner =
  `import { previewCurrentAdapter${name} } from "./lib/ui-phase2-adapter-current-state-preview.mjs";\n` +
  'import { includeImportedStyleSources } from "./lib/ui-imported-style-sources.mjs";\n' +
  runner;
runner = runner.replace(
  /from "([^"\n]+)"/g,
  (_, specifier) => "from " + JSON.stringify(import.meta.resolve(specifier)),
);
try {
  await import("data:text/javascript;base64," + Buffer.from(runner).toString("base64"));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
