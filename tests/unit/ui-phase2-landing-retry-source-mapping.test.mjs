import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { digest, scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";

const document = "identity-onboarding-contract-review.md";
const mappings = [
  {
    file: "apps/web/src/components/LandingRedirect.vue",
    candidateId: "apps/web/src/components/LandingRedirect.vue#0f7c864f959a1c13.1",
    contract: "ID-LANDING-RETRY-PARENT",
    line: 41,
  },
  {
    file: "apps/web/src/components/LandingRedirectSurface.vue",
    candidateId: "apps/web/src/components/LandingRedirectSurface.vue#bb7cd7dbbdfa84a2.1",
    contract: "ID-LANDING-RETRY-SURFACE",
    line: 44,
  },
];

test("landing retry surface and parent event edges bind to the same existing resolver", () => {
  const audit = runContractAudit();

  for (const mapping of mappings) {
    const source = readFileSync(
      new URL(`../../${mapping.file}`, import.meta.url),
      "utf8",
    ).replaceAll("\r\n", "\n");
    const candidates = scanSource(source, mapping.file).candidates;
    const [record] = audit.records.filter(
      (item) =>
        item.document.endsWith(document) &&
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
      (claim) => claim.document.endsWith(document) && claim.file === mapping.file,
    );
    assert.equal(hashes.filter((claim) => claim.temporalScope !== "historical").length, 1);
    assert.equal(
      hashes.find((claim) => claim.temporalScope !== "historical")?.hash,
      digest(source),
    );
    assert.equal(audit.unreferenced.filter((item) => item.file === mapping.file).length, 0);
  }

  const parent = readFileSync(
    new URL("../../apps/web/src/components/LandingRedirect.vue", import.meta.url),
    "utf8",
  );
  const surface = readFileSync(
    new URL("../../apps/web/src/components/LandingRedirectSurface.vue", import.meta.url),
    "utf8",
  );
  assert.match(parent, /@retry="resolveLanding"/);
  assert.match(parent, /request<\{ route: string \}>\("\/me\/landing"\)/);
  assert.match(surface, /@primary="emit\('retry'\)"/);
  assert.equal(audit.denominatorFrozen, false);
});
