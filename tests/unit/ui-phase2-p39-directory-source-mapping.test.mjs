import assert from "node:assert/strict";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";

const mappingFile = "design-plans/ui-phase-2-2026-09-07/P39-DIRECTORY-SOURCE-MAPPING.md";
const sourceFile = "apps/web/src/components/PlatformAccountDirectoryWorkspace.vue";
const railFile = "apps/web/src/components/PlatformAccountGlobalRail.vue";

test("P39 directory source candidates have exact current semantic references and source hash", () => {
  const audit = runContractAudit();
  const sourceReferences = audit.records.filter(
    (record) =>
      record.document === mappingFile && [sourceFile, railFile].includes(record.sourceFile),
  );
  const referenced = sourceReferences.filter((record) => record.temporalScope !== "historical");
  const historical = sourceReferences.filter((record) => record.temporalScope === "historical");

  assert.equal(referenced.length, 19);
  assert.deepEqual(
    referenced.map((record) => record.candidateId.split("#")[1]).sort(),
    [
      "03d32a05b1b3fd19.1",
      "103fa7d7798d62d6.1",
      "20080e701de7f5cb.1",
      "29448f61eb8ffc80.1",
      "29448f61eb8ffc80.1",
      "2d610959fc00fb96.1",
      "322a4ac62ce3a305.1",
      "38003e3f7b002f71.1",
      "44e761922e1da1d0.1",
      "86ea70e081f1f8e3.1",
      "86ea70e081f1f8e3.2",
      "8871f6d994e9fced.1",
      "9c9141422bfd2c11.1",
      "e400286c7cd59e44.1",
      "e400286c7cd59e44.1",
      "e9658d470d4cbeaf.1",
      "f68d2406f8c1db70.1",
      "ffed2dd7f439c4b0.1",
      "ffed2dd7f439c4b0.1",
    ].sort(),
  );
  assert.ok(referenced.every((record) => record.status === "identity-current"));
  assert.ok(referenced.every((record) => record.sourceBinding === "hash-current"));
  assert.deepEqual(
    historical.map((record) => record.signature).sort(),
    ["d539742db4335e89.1", "d773d9dd7a465b72.1"].sort(),
  );
  assert.ok(historical.every((record) => record.temporalScope === "historical"));
  assert.ok(
    !audit.unreferenced.some((candidate) => [sourceFile, railFile].includes(candidate.file)),
  );
});
