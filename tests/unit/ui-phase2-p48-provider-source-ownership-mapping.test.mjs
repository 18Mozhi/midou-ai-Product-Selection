import assert from "node:assert/strict";
import test from "node:test";
import { runContractAudit } from "../../scripts/audit-ui-phase2-contracts.mjs";

const documentFile =
  "design-plans/ui-phase-2-2026-09-07/source-channel-credential-contract-review.md";
const expectedByFile = {
  "apps/web/src/components/ProviderSourceEditDialog.vue": [
    "5dde29b862125b0e.1",
    "fd96a0ddfd39623f.1",
    "683678bf384a1e42.1",
    "004f04ff66f655ca.1",
    "1c008f867673db60.1",
    "a3dad946584f7803.1",
    "73764f74b8f1a61a.1",
    "0d47ebf53fe0590e.1",
    "c57686ba7c1f6588.1",
    "c0923c491565b4ef.1",
    "c74c69289cda1b1c.1",
    "a8cf70fb83e27873.1",
    "d166a16792084fe1.1",
  ],
  "apps/web/src/components/ProviderSourceVersionHistoryDialog.vue": [
    "22ecf14cfd3d483f.1",
    "6998c14c2116e210.1",
    "7cef35300d9577fb.1",
    "1c008f867673db60.1",
    "c73ff040b3307a5d.1",
    "ada59de7960940c4.1",
    "812f9da80a8dbb06.1",
    "b7bbd08aecc4de79.1",
  ],
  "apps/web/src/components/ProviderSourceConfigurationDialog.vue": [
    "f8f748c674190729.1",
    "0e32b5a54eb60075.1",
    "ed9b168dbe1f3587.1",
    "6b2f9fa5430c552d.1",
  ],
};

test("P48 configuration candidates bind to the current parent and extracted dialog SFCs", () => {
  const audit = runContractAudit();
  const records = audit.records.filter(
    (record) =>
      record.document === documentFile &&
      record.documentLine >= 300 &&
      record.documentLine <= 340 &&
      Object.hasOwn(expectedByFile, record.sourceFile),
  );

  assert.equal(records.length, 25);
  for (const [file, expected] of Object.entries(expectedByFile)) {
    const fileRecords = records.filter((record) => record.sourceFile === file);
    assert.deepEqual(
      fileRecords.map((record) => record.signature).sort(),
      [...expected].sort(),
      file,
    );
    assert.ok(fileRecords.every((record) => record.temporalScope !== "historical"));
    assert.ok(fileRecords.every((record) => record.status === "identity-current"));
    assert.ok(fileRecords.every((record) => record.sourceBinding === "hash-current"));
    assert.ok(fileRecords.every((record) => record.recordedLine === record.currentLine));
    assert.ok(!audit.unreferenced.some((candidate) => candidate.file === file));
  }
});
