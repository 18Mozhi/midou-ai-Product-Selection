import assert from "node:assert/strict";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";

const mappingFile =
  "design-plans/ui-phase-2-2026-09-07/P39-DIRECTORY-SOURCE-MAPPING.md";
const sourceFile = "apps/web/src/components/PlatformAccountDirectoryWorkspace.vue";

test("P39 directory source candidates have exact current semantic references and source hash", () => {
  const audit = runContractAudit();
  const referenced = audit.records.filter(
    (record) => record.document === mappingFile && record.sourceFile === sourceFile,
  );

  assert.equal(referenced.length, 18);
  assert.ok(referenced.every((record) => record.status === "identity-current"));
  assert.ok(referenced.every((record) => record.sourceBinding === "hash-current"));
  assert.ok(!audit.unreferenced.some((candidate) => candidate.file === sourceFile));
});
