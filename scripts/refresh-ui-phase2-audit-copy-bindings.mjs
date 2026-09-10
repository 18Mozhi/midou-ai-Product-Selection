import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  capturedExportDetailHash,
  exportDetailStyle,
} from "./lib/ui-phase2-export-detail-token-delta.mjs";
import {
  readBeforeAuditPage,
  hashBeforeAuditPage,
  hasAuditPageAssociations,
} from "./lib/ui-phase2-audit-page-evidence.mjs";
import {
  historicalAuditSource,
  auditCopyFile,
  auditFixtureFile,
  auditCopyBaseline,
} from "./lib/ui-phase2-audit-copy-baseline.mjs";

const write = process.argv.includes("--write");
assert.ok(process.argv.slice(2).every((v) => v === "--write"));
assert.ok(
  !write || !hasAuditPageAssociations(),
  "Historical copy writer is frozen; use refresh-ui-phase2-audit-page-bindings.mjs for current associations",
);
const text = async (f) => readBeforeAuditPage(f);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const proof = "scripts/lib/ui-phase2-audit-copy-baseline.mjs";
const component = await text(auditCopyFile),
  oldComponent = historicalAuditSource(auditCopyFile, component);
assert.equal(
  component.split("<template>")[1],
  oldComponent.split("<template>")[1],
  "No template/style delta",
);
const currentProof = JSON.parse(
  await text("output/playwright/p37-copy-ownership-vue/evidence.json"),
);
assert.equal(currentProof.kind, "P37-CURRENT-COPY-OWNERSHIP-VUE");
assert.equal(currentProof.checks.length, 62);
for (const [f, sha] of Object.entries(currentProof.sourceHashes))
  assert.equal(
    f === exportDetailStyle ? capturedExportDetailHash(f, await text(f)) : hashBeforeAuditPage(f),
    sha,
    f,
  );
for (const s of currentProof.screenshots)
  assert.equal(
    hash(await readFile(`output/playwright/p37-copy-ownership-vue/${s.file}`)),
    s.sha256,
  );
const outputs = new Map();
let images = 0;
for (const dir of [
  "design-plans/ui-phase-2-2026-09-07/design/org-audit-direction-c/",
  "output/playwright/p37-fields-review/",
  "output/playwright/p37-controls-review/",
]) {
  const file = dir + "evidence.json",
    raw = await text(file),
    current = JSON.parse(raw),
    old = structuredClone(current);
  if (old.sourceAssociation) {
    const association = old.sourceAssociation;
    assert.equal(association.kind, "copy-feedback-only-current-source-historical-design-evidence");
    old.sourceHashes = association.historicalSourceHashes;
    if (old.retainedManifest) old.retainedManifest = association.historicalRetainedManifest;
    if (old.retained) old.retained = association.historicalRetained;
    delete old.sourceAssociation;
    assert.equal(hash(JSON.stringify(old, null, 2) + "\n"), association.originalManifestHash);
  }
  for (const [f, sha] of Object.entries(old.sourceHashes))
    assert.equal(capturedExportDetailHash(f, historicalAuditSource(f, await text(f))), sha, f);
  for (const s of old.screenshots) {
    assert.equal(hash(await readFile(dir + s.file)), s.sha256);
    images++;
  }
  const next = structuredClone(old);
  for (const f of [auditCopyFile, auditFixtureFile]) next.sourceHashes[f] = hashBeforeAuditPage(f);
  next.sourceAssociation = {
    kind: "copy-feedback-only-current-source-historical-design-evidence",
    baselineCommit: auditCopyBaseline,
    originalManifestHash: hash(JSON.stringify(old, null, 2) + "\n"),
    historicalSourceHashes: old.sourceHashes,
    ...(old.retainedManifest ? { historicalRetainedManifest: old.retainedManifest } : {}),
    ...(old.retained ? { historicalRetained: old.retained } : {}),
    proof,
    proofHash: hashBeforeAuditPage(proof),
    currentCopyEvidence: "output/playwright/p37-copy-ownership-vue/evidence.json",
    images: "unchanged",
    template: "unchanged",
    approval: "unchanged",
    fixture:
      "original baseline functions and assertions; sourceChecks describe capture-time findings, not current copy behavior",
  };
  if (next.retainedManifest)
    next.retainedManifest = hash(
      outputs.get("design-plans/ui-phase-2-2026-09-07/design/org-audit-direction-c/evidence.json"),
    );
  if (next.retained)
    for (const [retainedDir, value] of Object.entries(next.retained))
      value.manifest = hash(outputs.get(retainedDir + "evidence.json"));
  const serialized = JSON.stringify(next, null, 2) + "\n";
  if (!write) assert.deepEqual(current, next, file);
  outputs.set(file, serialized);
}
// The P36 parent eagerly imports the audit child even though the token route never
// renders it. Retain its screenshots and prove that only this imported copy code moved.
{
  const dir = "output/playwright/p36-parent-read-vue-r2/",
    file = dir + "evidence.json",
    current = JSON.parse(await text(file)),
    old = structuredClone(current);
  if (old.sourceAssociation) {
    const a = old.sourceAssociation;
    assert.equal(a.kind, "unrendered-P37-import-copy-only");
    old.sourceHashes = a.historicalSourceHashes;
    delete old.sourceAssociation;
    assert.equal(hash(JSON.stringify(old, null, 2) + "\n"), a.originalManifestHash);
  }
  for (const [f, sha] of Object.entries(old.sourceHashes))
    assert.equal(capturedExportDetailHash(f, historicalAuditSource(f, await text(f))), sha, f);
  for (const s of old.screenshots) assert.equal(hash(await readFile(dir + s.file)), s.sha256);
  const next = structuredClone(old);
  next.sourceHashes[auditCopyFile] = hash(component);
  next.sourceAssociation = {
    kind: "unrendered-P37-import-copy-only",
    originalManifestHash: hash(JSON.stringify(old, null, 2) + "\n"),
    historicalSourceHashes: old.sourceHashes,
    proof,
    proofHash: hashBeforeAuditPage(proof),
    template: "unchanged",
    images: "unchanged",
    approval: "unchanged",
  };
  if (!write) assert.deepEqual(current, next, file);
  outputs.set(file, JSON.stringify(next, null, 2) + "\n");
}
{
  const dir = "output/playwright/p36-read-states-review/",
    file = dir + "evidence.json",
    parentDir = "output/playwright/p36-parent-read-vue-r2",
    current = JSON.parse(await text(file)),
    old = structuredClone(current);
  if (old.sourceAssociation) {
    const a = old.sourceAssociation;
    assert.equal(a.kind, "retained-P36-parent-import-association-only");
    old.retained = a.historicalRetained;
    delete old.sourceAssociation;
    assert.equal(hash(JSON.stringify(old, null, 2) + "\n"), a.originalManifestHash);
  }
  for (const [f, sha] of Object.entries(old.sourceHashes))
    assert.equal(hash(await text(f)), sha, f);
  for (const s of old.screenshots) assert.equal(hash(await readFile(dir + s.file)), s.sha256);
  const parent = JSON.parse(outputs.get(parentDir + "/evidence.json"));
  assert.equal(old.retained[parentDir].manifest, parent.sourceAssociation.originalManifestHash);
  const next = structuredClone(old);
  next.retained[parentDir].manifest = hash(outputs.get(parentDir + "/evidence.json"));
  next.sourceAssociation = {
    kind: "retained-P36-parent-import-association-only",
    originalManifestHash: hash(JSON.stringify(old, null, 2) + "\n"),
    historicalRetained: old.retained,
    images: "unchanged",
    approval: "unchanged",
  };
  if (!write) assert.deepEqual(current, next, file);
  outputs.set(file, JSON.stringify(next, null, 2) + "\n");
}
if (write) for (const [file, contents] of outputs) await writeFile(file, contents);
console.log(
  JSON.stringify({ manifests: outputs.size, retainedImages: images, imagesRewritten: 0, write }),
);
