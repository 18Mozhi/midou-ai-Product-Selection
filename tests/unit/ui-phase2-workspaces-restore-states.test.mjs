import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const base = "design-plans/ui-phase-2-2026-09-07/design/workspaces-restore-states-direction-c";
const proof = JSON.parse(readFileSync(`${base}/evidence.json`, "utf8"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const sceneIds = [
  "empty",
  "short",
  "valid",
  "keyboard-loop",
  "cancel-return",
  "close-return",
  "escape-return",
  "waiting",
  "failure",
  "reopen",
];

test("P32 restore states bind all ten compositions to both viewports and exact image bytes", () => {
  assert.deepEqual(Object.keys(proof.scenes), sceneIds);
  assert.deepEqual(
    proof.screenshots.map((s) => `${s.scene}/${s.width}`).sort(),
    sceneIds.flatMap((s) => [`${s}/1440`, `${s}/390`]).sort(),
  );
  for (const shot of proof.screenshots) {
    assert.equal(shot.pageId, "P32");
    assert.equal(shot.scope, "restore-state-proposal-not-Vue-or-production");
    assert.equal(hash(readFileSync(`${base}/${shot.file}`)), shot.sha256);
  }
});

test("P32 new state evidence preserves the exact prior approval without approving new states", () => {
  assert.equal(proof.approval, "pending-user-review");
  assert.equal(
    proof.approvedReference.sha256,
    "640c22bdbccc5a6f7fc24b427487f6d0e25f23418d2080a453035aff17c49176",
  );
  assert.equal(hash(readFileSync(proof.approvedReference.file)), proof.approvedReference.sha256);
  assert.match(proof.boundary, /No Vue\/API\/database\/permission\/audit acceptance/u);
  assert.match(proof.boundary, /Maxlength policy excluded/u);
});

test("P32 renderer, visual adapter and verifier are fingerprint-bound", () => {
  for (const [file, expected] of Object.entries(proof.sourceHashes))
    assert.equal(hash(readFileSync(file, "utf8").replaceAll("\r\n", "\n")), expected, file);
  assert.ok(proof.sourceHashes[`${base}/index.html`]);
  assert.ok(proof.sourceHashes[`${base}/states.js`]);
  assert.ok(proof.sourceHashes["apps/web/src/components/AuditedReasonDialog.vue"]);
  assert.ok(proof.sourceHashes["apps/web/src/components/OrganizationAdminCenter.vue"]);
});

test("P32 restore lifecycle proof is exact, offline and does not certify the upper length policy", () => {
  assert.deepEqual(
    proof.observations.map((o) => o.width),
    [1440, 390],
  );
  for (const observation of proof.observations) {
    assert.equal(observation.actionId, "OG-W-STATE");
    assert.equal(observation.dialogId, "D-OG-REASON");
    assert.equal(observation.factsUnchanged, true);
    assert.equal(observation.frontendMaxPolicyTested, false);
    assert.equal(observation.intents.length, 1);
    assert.equal(observation.intents[0].method, "POST");
    assert.match(observation.intents[0].url, /^\/org\/admin\/workspaces\/[^/]+\/actions$/u);
    assert.deepEqual(observation.intents[0].body, {
      action: "restore",
      expected_version: 1,
      reason: "核验后恢复",
    });
    const checks = proof.checks.filter((c) => c.width === observation.width).map((c) => c.name);
    for (const name of [
      "confirmation closes reason before waiting",
      "pending status is announced",
      "failure removes pending notice",
      "disabled entry does not duplicate intent",
      "failure does not reopen reason",
      "failure has no automatic retry",
      "reopening resets to existing default reason",
      "no HTTP request",
      "no storage writes",
    ])
      assert.ok(checks.includes(name), name);
  }
});
