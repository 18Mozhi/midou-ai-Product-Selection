import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";
import { digest, scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";

const cases = [
  {
    document: "log-backup-release-contract-review.md",
    file: "apps/web/src/components/PlatformLogWorkspace.vue",
    contract: "LG62-CHAIN-LOCAL-SELECT",
    candidateId: "apps/web/src/components/PlatformLogWorkspace.vue#d61db9a9a6e44c28.1",
    line: 26,
  },
  {
    document: "provider-definition-contract-review.md",
    file: "apps/web/src/components/ProviderRegistry.vue",
    contract: "PR01-CURRENT-RETRY",
    candidateId: "apps/web/src/components/ProviderRegistry.vue#2e080ad21acf1f26.1",
    line: 677,
  },
  {
    document: "account-home-contract-review.md",
    file: "apps/web/src/components/theme-studio/PreferenceRadioGroup.vue",
    contract: "TH-PREFERENCE-OPTION",
    candidateId: "apps/web/src/components/theme-studio/PreferenceRadioGroup.vue#991f0e9b895c8269.1",
    line: 36,
  },
];

test("remaining log, provider and preference controls bind to their current narrow semantics", () => {
  const audit = runContractAudit();

  for (const mapping of cases) {
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

  const logs = readFileSync(
    new URL("../../apps/web/src/components/PlatformLogWorkspace.vue", import.meta.url),
    "utf8",
  );
  const registry = readFileSync(
    new URL("../../apps/web/src/components/ProviderRegistry.vue", import.meta.url),
    "utf8",
  );
  const preferences = readFileSync(
    new URL("../../apps/web/src/components/theme-studio/PreferenceRadioGroup.vue", import.meta.url),
    "utf8",
  );
  assert.match(logs, /@click="selectedTraceId = chain\.traceId"/);
  assert.match(registry, /@primary="load"/);
  assert.match(registry, /request<Provider\[]>\("\/platform\/providers"/);
  assert.match(preferences, /@click="emit\('select', option\.id\)"/);
  assert.match(preferences, /:aria-checked="selected === option\.id"/);
  assert.equal(audit.denominatorFrozen, false);
});
