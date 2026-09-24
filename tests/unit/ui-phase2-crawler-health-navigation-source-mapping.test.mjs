import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { digest, scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";

const document = "scheduler-capacity-contract-review.md";
const file = "apps/web/src/components/CrawlerSchedulerCenter.vue";
const targetFile = "apps/web/src/components/ProviderAdapterCenter.vue";
const routeCatalog = "config/route-catalog.json";

test("scheduler health link is navigation-only and target query is not currently consumed", () => {
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
  const target = readFileSync(new URL(`../../${targetFile}`, import.meta.url), "utf8");
  const routes = readFileSync(new URL(`../../${routeCatalog}`, import.meta.url), "utf8");
  const audit = runContractAudit();
  const candidates = scanSource(source, file).candidates;
  const [record] = audit.records.filter(
    (item) =>
      item.document.endsWith(document) &&
      item.sourceFile === file &&
      item.claim.includes("SC70-HEALTH-NAV") &&
      item.temporalScope !== "historical",
  );

  assert.ok(record);
  const candidate = candidates.find((item) => item.candidateId === record.candidateId);
  assert.equal(record.candidateId, `${file}#c198ccff780259e3.1`);
  assert.equal(record.status, "identity-current");
  assert.equal(record.sourceBinding, "hash-current");
  assert.equal(record.currentLine, candidate?.line);
  assert.equal(record.recordedLine, 585);
  assert.equal(record.recordedKind, candidate?.kind);
  assert.match(source, /\/platform-admin\/providers\/adapters\?provider_id=' \+ item\.id/);
  assert.match(routes, /"path": "\/platform-admin\/providers\/adapters"/);
  assert.doesNotMatch(target, /useRoute|route\.query|provider_id/);

  const hashes = audit.sourceClaims.filter(
    (claim) => claim.document.endsWith(document) && claim.file === file,
  );
  assert.equal(hashes.filter((claim) => claim.temporalScope !== "historical").length, 1);
  assert.equal(hashes.find((claim) => claim.temporalScope !== "historical")?.hash, digest(source));
  assert.equal(audit.unreferenced.filter((item) => item.file === file).length, 0);
  assert.equal(audit.denominatorFrozen, false);
});
