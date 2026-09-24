import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { digest, scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";

const document = "content-notification-evidence-contract-review.md";
const file = "apps/web/src/components/PlatformManagementCenter.vue";

test("current platform management parent mappings keep filter and email editor wiring explicit", () => {
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const audit = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const rows = audit.records.filter(
    (record) =>
      record.document.endsWith(document) &&
      record.sourceFile === file &&
      (record.claim.includes("PM-CURRENT-GENERIC-FILTER-WIRING") ||
        record.claim.includes("EMAIL-CURRENT-EDITOR-WIRING")),
  );
  const expectedIds = ["3e86a7a4cbf4b231.1", "5b14488b26b010e3.1"].map(
    (signature) => `${file}#${signature}`,
  );

  assert.deepEqual(rows.map((record) => record.candidateId).sort(), expectedIds.sort());
  for (const record of rows) {
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.status, "identity-current", record.candidateId);
    assert.equal(record.sourceBinding, "hash-current", record.candidateId);
    assert.equal(record.currentLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedLine, candidate?.line, record.candidateId);
    assert.equal(record.recordedKind, candidate?.kind, record.candidateId);
  }

  const hashes = audit.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.filter((claim) => claim.temporalScope !== "historical").length, 1);
  assert.equal(hashes.find((claim) => claim.temporalScope !== "historical")?.hash, digest(source));
  assert.equal(audit.unreferenced.filter((candidate) => candidate.file === file).length, 0);
  assert.equal(audit.denominatorFrozen, false);
});
