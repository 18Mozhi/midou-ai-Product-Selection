import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const adapterRefreshFocusDriverHash =
  "ed261c30178dc65d251d87ffe4d4a4b01b446dc3da321f8bd63fc9da79ea5975";

// Preserve historical assertions/images; exercise only the untransformed current App.
export function buildAdapterRefreshFocusCurrentRunner(source) {
  let runner = source.replaceAll("\r\n", "\n");
  assert.equal(createHash("sha256").update(runner).digest("hex"), adapterRefreshFocusDriverHash);
  function replace(before, after) {
    assert.equal(runner.split(before).length, 2, before);
    runner = runner.replace(before, after);
  }
  replace(
    'assert.ok(process.argv.slice(2).every((arg) => arg === "--capture"));',
    'assert.equal(process.argv.length, 2, "Current refresh-focus verifier takes no arguments");',
  );
  replace('const capture = process.argv.includes("--capture");', "const capture = false;");
  replace(
    'import { beforeAdapterRefreshFocus } from "./lib/ui-phase2-adapter-refresh-focus-baseline.mjs";',
    'import { beforeAdapterRefreshFocus } from "./lib/ui-phase2-adapter-refresh-focus-baseline.mjs";\n' +
      'import { beforeAdapterEmptyMobile } from "./lib/ui-phase2-adapter-empty-mobile-baseline.mjs";\n' +
      'import { beforeAdapterPaginationFocus } from "./lib/ui-phase2-adapter-pagination-focus-baseline.mjs";',
  );
  // Validate pagination -> mobile -> pre-mobile -> pre-focus without rendering the inverse.
  replace(
    "  before = beforeAdapterRefreshFocus(source);",
    "  before = beforeAdapterRefreshFocus(beforeAdapterEmptyMobile(beforeAdapterPaginationFocus(source)));",
  );
  replace('for (const mode of ["before", "current"]) {', 'for (const mode of ["current"]) {');
  replace(
    '  "scripts/lib/ui-phase2-adapter-refresh-focus-baseline.mjs",',
    '  "scripts/lib/ui-phase2-adapter-refresh-focus-baseline.mjs",\n' +
      '  "scripts/lib/ui-phase2-adapter-empty-mobile-baseline.mjs",\n' +
      '  "scripts/lib/ui-phase2-adapter-pagination-focus-baseline.mjs",\n' +
      '  "scripts/lib/ui-adapter-refresh-focus-current-runner.mjs",\n' +
      '  "scripts/verify-provider-adapter-refresh-focus-current.mjs",',
  );
  replace(
    "      runs: runs.length,",
    "      runs: runs.length,\n" +
      "      currentOnly: true,\n" +
      "      currentSha: hash(source),\n" +
      "      sources: sources.size,\n" +
      "      outcomes: runs.map(({ mode, width, outcome, checks, requests }) => ({ mode, width, outcome, checks: checks.length, requests })),",
  );
  return runner;
}
