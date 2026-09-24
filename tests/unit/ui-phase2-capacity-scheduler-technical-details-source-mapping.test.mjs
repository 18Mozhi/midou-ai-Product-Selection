import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { digest, scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";

const mappings = [
  {
    document: "scheduler-capacity-contract-review.md",
    file: "apps/web/src/components/CrawlerSchedulerEvidence.vue",
    contract: "P70-SCHEDULER-LEASE-TECH",
    candidateId: "apps/web/src/components/CrawlerSchedulerEvidence.vue#1d663944bdde1289.1",
    line: 132,
  },
  {
    document: "scheduler-capacity-contract-review.md",
    file: "apps/web/src/components/CapacityBoundaryEvidence.vue",
    contract: "P71-CAPACITY-FINDING-TECH",
    candidateId: "apps/web/src/components/CapacityBoundaryEvidence.vue#1c008f867673db60.1",
    line: 192,
  },
];

test("capacity and scheduler technical-details controls map to their current display-only source", () => {
  const audit = runContractAudit();

  for (const mapping of mappings) {
    const source = readFileSync(
      new URL(`../../${mapping.file}`, import.meta.url),
      "utf8",
    ).replaceAll("\r\n", "\n");
    const candidates = scanSource(source, mapping.file).candidates;
    const [record] = audit.records.filter(
      (item) =>
        item.document.endsWith(mapping.document) &&
        item.sourceFile === mapping.file &&
        item.claim.includes(mapping.contract) &&
        item.temporalScope !== "historical",
    );

    assert.ok(record, mapping.contract);
    const candidate = candidates.find((item) => item.candidateId === record.candidateId);
    assert.equal(record.candidateId, mapping.candidateId);
    assert.equal(record.status, "identity-current");
    assert.equal(record.sourceBinding, "hash-current");
    assert.equal(record.currentLine, candidate?.line);
    assert.equal(record.recordedLine, mapping.line);
    assert.equal(record.recordedKind, candidate?.kind);

    const hashes = audit.sourceClaims.filter(
      (claim) => claim.document.endsWith(mapping.document) && claim.file === mapping.file,
    );
    assert.equal(hashes.filter((claim) => claim.temporalScope !== "historical").length, 1);
    assert.equal(
      hashes.find((claim) => claim.temporalScope !== "historical")?.hash,
      digest(source),
    );
    assert.equal(audit.unreferenced.filter((item) => item.file === mapping.file).length, 0);
  }

  assert.equal(audit.denominatorFrozen, false);
});
