import assert from "node:assert/strict";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";

const sourceFile = "apps/web/src/components/NavigationAccessPanel.vue";
const documentFile =
  "design-plans/ui-phase-2-2026-09-07/shared-shell-role-state-contract-review.md";
const expected = [
  ["c68005f9913103a4.1", 15],
  ["c68005f9913103a4.2", 22],
  ["5689a1a88f3983e9.1", 23],
];

test("NavigationAccessPanel links bind to current M02-03 route states without implying permission writes", () => {
  const audit = runContractAudit();
  const records = audit.records.filter(
    (record) => record.document === documentFile && record.sourceFile === sourceFile,
  );

  assert.deepEqual(
    records.map((record) => [record.signature, record.recordedLine]),
    expected,
  );
  assert.ok(
    records.every(
      (record) =>
        record.temporalScope !== "historical" &&
        record.status === "identity-current" &&
        record.sourceBinding === "hash-current" &&
        record.recordedLine === record.currentLine,
    ),
  );
  assert.ok(!audit.unreferenced.some((candidate) => candidate.file === sourceFile));
  assert.ok(records.at(-1).claim.includes("不直接提交申请或修改权限"));
});
