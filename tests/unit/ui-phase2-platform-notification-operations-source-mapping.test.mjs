import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { digest, scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";

const document = "content-notification-evidence-contract-review.md";
const file = "apps/web/src/components/PlatformNotificationOperations.vue";

test("notification operations governance link maps to navigation only", () => {
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
      record.claim.includes("PN57-OPERATIONS-CURRENT-GOVERNANCE") &&
      record.temporalScope !== "historical",
  );

  assert.equal(rows.length, 1);
  const [record] = rows;
  const candidate = candidates.find((item) => item.candidateId === record.candidateId);
  assert.equal(record.candidateId, `${file}#a2abccb13e9ed5e1.1`);
  assert.equal(record.status, "identity-current");
  assert.equal(record.sourceBinding, "hash-current");
  assert.equal(record.currentLine, candidate?.line);
  assert.equal(record.recordedLine, 29);
  assert.equal(record.recordedKind, candidate?.kind);

  const hashes = audit.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.filter((claim) => claim.temporalScope !== "historical").length, 1);
  assert.equal(hashes.find((claim) => claim.temporalScope !== "historical")?.hash, digest(source));
  assert.equal(audit.unreferenced.filter((item) => item.file === file).length, 0);
  assert.equal(audit.denominatorFrozen, false);
});
