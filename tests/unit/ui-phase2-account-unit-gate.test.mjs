import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { summarizeAccountUnitTap } from "../../scripts/verify-ui-phase2-account-unit-gate.mjs";

test("unit gate preserves every CLI failure including non-ASCII diagnostics", () => {
  const result = summarizeAccountUnitTap(
    "TAP version 13\nnot ok 1 - 中文失败\n  ---\n  error: 原因\n  ...\nok 2 - pass\nnot ok 3 - second\n  ---\n  code: ERR_TEST_FAILURE\n  ...\n# tests 3\n# pass 1\n# fail 2\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 12.5\n",
  );
  assert.equal(result.counts.tests, 3);
  assert.equal(result.counts.fail, 2);
  assert.deepEqual(
    result.failures.map((item) => item.name),
    ["中文失败", "second"],
  );
  assert.match(result.failures[0].diagnostic, /原因/);
});
test("unit gate rejects incomplete or unreconciled reports rather than inferring success", () => {
  assert.throws(() => summarizeAccountUnitTap("TAP version 13\nok 1 - pass\n"), /Missing complete/);
  assert.throws(
    () => summarizeAccountUnitTap("# tests 2\n# pass 1\n# fail 1\n"),
    /does not reconcile/,
  );
});
test("completed full-unit report refuses a second run before starting child tests", () => {
  assert.ok(existsSync("design-plans/ui-phase-2-2026-09-07/P39-CAPTURE-UNIT-RESULT.json"));
  const result = spawnSync(process.execPath, ["scripts/verify-ui-phase2-account-unit-gate.mjs"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /P39 full-unit report already exists/);
  assert.doesNotMatch(result.stdout, /"state":"running"/);
  assert.equal(result.error, undefined);
});
