import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { digest, scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";

const document = "identity-onboarding-contract-review.md";
const file = "apps/web/src/components/TenancyChooser.vue";

test("P08 current tenancy chooser candidates bind root, read-only organization choice and scope write", () => {
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
      record.claim.includes("P08-CURRENT-") &&
      record.temporalScope !== "historical",
  );
  const expectedIds = ["d545c6b53ab2b2a8.1", "51f99d2206301d80.1", "9d6c9b22e4716bb9.1"].map(
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
