import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  acceptanceCaptureRoot,
  acceptanceCaptureDrivers,
  buildAcceptanceCurrentCapture,
} from "../../scripts/lib/ui-phase2-acceptance-current-capture.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
for (const stage of Object.keys(acceptanceCaptureDrivers)) {
  test(`P49 ${stage} current capture changes only output/provenance boundaries`, () => {
    const original = read(`scripts/verify-ui-phase2-1688-acceptance-${stage}.mjs`);
    const runner = buildAcceptanceCurrentCapture(original, stage);
    assert.ok(runner.includes(`output = "${acceptanceCaptureRoot}/${stage}"`));
    assert.ok(runner.includes("const capture = true,"));
    assert.ok(runner.includes("await includeImportedStyleSources(loadedSources, read)"));
    assert.ok(!runner.includes("await rm(output,"));
    const between = (source, start, end) =>
      source.slice(source.indexOf(start), source.indexOf(end));
    assert.equal(
      between(runner, 'await page.route("**/*"', "} finally {"),
      between(original, 'await page.route("**/*"', "} finally {"),
    );
    for (const needle of ["await browser?.close();", "await context.close();"])
      assert.equal(runner.split(needle).length, original.split(needle).length);
    assert.throws(
      () => buildAcceptanceCurrentCapture(original + "\n// drift", stage),
      /Original P49 driver changed/,
    );
    assert.equal(buildAcceptanceCurrentCapture(original.replaceAll("\n", "\r\n"), stage), runner);
  });
}
test("P49 new capture rejects unknown stages and owns a new directory exclusively", () => {
  for (const stage of ["__proto__", "../page", "--capture"])
    assert.throws(() => buildAcceptanceCurrentCapture("", stage), /Unknown P49/);
  const entry = read("scripts/capture-ui-phase2-acceptance-current.mjs");
  assert.ok(entry.includes("await mkdir(output);"));
  assert.ok(!entry.includes("rm("));
  assert.match(entry, /assert\.equal\(\s*process\.argv\.length,\s*3,/);
});
