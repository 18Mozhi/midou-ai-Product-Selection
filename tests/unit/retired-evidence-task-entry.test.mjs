import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildOpportunityDetailDesignData } from "../../scripts/lib/ui-phase2-opportunity-detail-design-data.mjs";

test("retired manual-task design data cannot be reported as current UI evidence", async () => {
  await assert.rejects(
    () => buildOpportunityDetailDesignData(process.cwd()),
    /manual_evidence_task_surface_retired/,
  );
});

test("retired P18 capture refuses before altering the historical evidence packet", () => {
  const file =
    "design-plans/ui-phase-2-2026-09-07/design/opportunity-detail-direction-c/evidence.json";
  const before = readFileSync(file);
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-ui-phase2-opportunity-detail-c.mjs", "--capture"],
    {
      encoding: "utf8",
      timeout: 10000,
      windowsHide: true,
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /manual_evidence_task_surface_retired/);
  assert.deepEqual(readFileSync(file), before);
});
