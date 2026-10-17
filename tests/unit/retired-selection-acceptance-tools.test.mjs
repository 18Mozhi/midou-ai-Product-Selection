import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

for (const script of [
  "run-baota-selection-acceptance.mjs",
  "verify-selection-acceptance-live.mjs",
  "verify-selection-acceptance-production.mjs",
]) {
  for (const args of [[], ["--production"]])
    test(`retired ${script} ${args.join(" ")} refuses before credentials, network or database access`, () => {
      const result = spawnSync(process.execPath, [`scripts/${script}`, ...args], {
        encoding: "utf8",
        timeout: 10_000,
        env: {
          ...process.env,
          SELECTION_ACCEPTANCE_BASE_URL: "http://127.0.0.1:1",
          SELECTION_ACCEPTANCE_EVIDENCE_FILE: "invalid-retired-evidence-path",
        },
      });
      assert.ifError(result.error);
      assert.equal(result.status, 2);
      assert.equal(result.stdout, "");
      const response = JSON.parse(result.stderr);
      assert.equal(response.status, "retired");
      assert.equal(response.code, "manual_selection_acceptance_retired");
      assert.equal(response.production_verified, false);
      assert.match(response.message, /自动整链/);
    });
  test(`retired ${script} contains no old runtime or evidence mutation implementation`, () => {
    const source = readFileSync(`scripts/${script}`, "utf8");
    assert.doesNotMatch(
      source,
      /\bimport\b|\bfetch\b|createDatabasePool|SelectionJourneyService|pool\.query|writeFile|mkdir|chmod|spawnSync/,
    );
  });
}
