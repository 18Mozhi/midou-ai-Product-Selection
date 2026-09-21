import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const adapterReadDriverHash =
  "86e73a7bc81bd71ed787d02ccdb8ce9c22b32e1e4eaceb333858560885848509";

// Keep the original ordering assertions; run only untransformed current Vue.
export function buildAdapterReadCurrentRunner(source) {
  let runner = source.replaceAll("\r\n", "\n");
  assert.equal(createHash("sha256").update(runner).digest("hex"), adapterReadDriverHash);
  function replace(before, after) {
    assert.equal(runner.split(before).length, 2, before);
    runner = runner.replace(before, after);
  }
  replace('const capture = process.argv.includes("--capture");', "const capture = false;");
  replace(
    'assert.ok(process.argv.slice(2).every((a) => a === "--capture"));',
    'assert.equal(process.argv.length, 2, "Current read-order verifier takes no arguments");',
  );
  replace('for (const mode of ["baseline", "current"]) {', 'for (const mode of ["current"]) {');
  replace(
    "for (const width of [390, 760, 1440]) {",
    "for (const width of [390, 760, 761, 1440]) {",
  );
  // The original end-of-run summary is emitted only after browser/server cleanup.
  replace(
    "      runs: runs.length,",
    "      runs: runs.length,\n      processesClosed: true,\n      currentOnly: true,\n      observations: checks,\n      requests: network,",
  );
  return runner;
}
