import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readEvidenceSourceBytes } from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");

test("evidence resolves exact current and archived bytes without claiming current approval", () => {
  const file = "apps/web/src/components/HomeDashboard.vue";
  const current = read(file);
  assert.equal(readEvidenceSourceBytes(file, hash(current)), current);
  const archivedHash = "e54608bcb9d3b72b2f482b1f47d8559eb7d44b1649f0898a74bb1825e3eacad5";
  const archived = readEvidenceSourceBytes(file, archivedHash);
  assert.equal(hash(archived), archivedHash);
  assert.notEqual(archived, current);
});

test("ignored build bytes require an exact hash; unknown and wrong-path claims fail closed", () => {
  const file = "packages/config/dist/browser.js";
  assert.equal(readEvidenceSourceBytes(file, hash(read(file))), read(file));
  assert.throws(() => readEvidenceSourceBytes(file, "0".repeat(64)), /capture-time source/);
  assert.throws(
    () => readEvidenceSourceBytes("apps/web/src/App.vue", hash(read(file))),
    /capture-time source/,
  );
});
