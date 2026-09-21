import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { journeyFieldsMode } from "../../scripts/lib/ui-phase2-journey-fields-mode.mjs";

test("P16 field verifier keeps four explicit mutually exclusive modes", () => {
  for (const [args, expected] of [
    [[], { smoke: false, capture: false, current: false }],
    [["--smoke"], { smoke: true, capture: false, current: false }],
    [["--capture"], { smoke: false, capture: true, current: false }],
    [["--current"], { smoke: false, capture: false, current: true }],
  ])
    assert.deepEqual(journeyFieldsMode(args), expected);
});

test("P16 field verifier rejects unknown, repeated and combined flags", () => {
  for (const args of [
    ["--unknown"],
    ["current"],
    ["--current", "--current"],
    ["--smoke", "--smoke"],
    ["--capture", "--capture"],
    ["--current", "--capture"],
    ["--current", "--smoke"],
    ["--smoke", "--capture"],
  ])
    assert.throws(() => journeyFieldsMode(args), /cannot be combined or repeated/);
});

test("P16 current replay preserves the legacy checks and cannot enter capture", async () => {
  const source = await readFile("scripts/verify-ui-phase2-journey-fields.mjs", "utf8");
  assert.match(
    source,
    /if \(!smoke && !capture && !current\) \{[\s\S]*?previous = await verifyJourneyFieldsHistory\(repo\)/,
  );
  assert.match(
    source,
    /else if \(!smoke && !current\) assert\.deepEqual\(previous\.checks, checks\)/,
  );
  assert.match(source, /const shot = async \(scene\) => \{\s*if \(!capture\) return;/);
  assert.match(
    source,
    /if \(current\) \{\s*assert\.equal\(checks\.length, 96\);\s*assert\.equal\(groupChecks\.length, 36\);\s*assert\.equal\(screenshots\.length, 0\);/,
  );
  assert.match(source, /historicalPacketValidated: false/);
  assert.ok(
    source.indexOf("journeyFieldsMode(process.argv.slice(2))") <
      source.indexOf("await createServer("),
  );
});
