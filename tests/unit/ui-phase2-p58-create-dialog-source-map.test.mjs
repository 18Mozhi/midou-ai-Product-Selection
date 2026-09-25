import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";

const sourceFile = "apps/web/src/components/CommercialOperationsCenter.vue";
const documentFile =
  "design-plans/ui-phase-2-2026-09-07/commercial-security-open-platform-contract-review.md";
const expected = new Map([
  ["151c3c8c32d92c80.1", [1001, "dialog-definition"]],
  ["30d28c64a162319d.1", [1001, "event-binding"]],
  ["de9a0d9bc0232967.1", [1008, "form-event"]],
  ["c172959eea18c58e.1", [1017, "control"]],
  ["64a8d5e746c9adce.1", [1122, "control"]],
]);

test("P58 current create-dialog candidates bind to the CO58-CREATE contract", () => {
  const report = runContractAudit();
  const start = readFileSync(documentFile, "utf8").split(/\r?\n/u).findIndex(
    (line) => line === "## 11. P58 创建配额方案窗当前 Vue 候选（2026-09-25）",
  );
  assert.notEqual(start, -1);
  const records = report.records.filter(
    (record) =>
      record.document === documentFile &&
      record.sourceFile === sourceFile &&
      record.documentLine > start + 1 &&
      record.candidateId &&
      [...expected.keys()].some((signature) => record.candidateId.endsWith(`#${signature}`)),
  );
  assert.equal(records.length, expected.size);
  for (const record of records) {
    const signature = record.candidateId.split("#").at(-1);
    assert.deepEqual([record.currentLine, record.recordedKind], expected.get(signature));
    assert.equal(record.status, "identity-current");
    assert.notEqual(record.temporalScope, "historical");
    assert.match(record.claim, /CO58-CREATE/u);
  }
  const source = readFileSync(sourceFile, "utf8").replaceAll("\r\n", "\n");
  const digest = createHash("sha256").update(source).digest("hex");
  const sourceClaims = report.sourceClaims.filter(
    (claim) => claim.file === sourceFile && claim.document === documentFile,
  );
  assert.ok(
    sourceClaims.some((claim) => claim.hash === digest && claim.status === "hash-current"),
  );
  assert.equal(report.unreferenced.filter((candidate) => candidate.file === sourceFile).length, 0);
});
