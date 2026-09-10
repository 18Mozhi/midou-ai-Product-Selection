import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  base,
  dependencies,
  buildMembersReview,
} from "../../scripts/build-ui-phase2-members-review.mjs";
const root = `${base}/design/members-controls-direction-c`;
const evidence = JSON.parse(readFileSync(`${root}/evidence.json`, "utf8"));
const parent = JSON.parse(readFileSync(`${base}/design/members-direction-c/evidence.json`, "utf8"));
const sources = Object.fromEntries(dependencies.map((file) => [file, readFileSync(file, "utf8")]));
const values = Object.values(evidence.controlReferences);
const total = (refs) =>
  Object.values(refs).reduce((n, ref) => n + Object.keys(ref.states).length, 0);
const hash = (value) => createHash("sha256").update(value).digest("hex");

test("P30 controls retain exact source and PNG hashes with 432 state and 12 context images", () => {
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(readFileSync(file, "utf8").replaceAll("\r\n", "\n")), sha, file);
  assert.equal(evidence.screenshots.length, 444);
  assert.equal(new Set(evidence.screenshots.map((s) => s.file)).size, 444);
  assert.equal(evidence.screenshots.filter((s) => s.control).length, 432);
  assert.equal(evidence.screenshots.filter((s) => !s.control).length, 12);
  for (const shot of evidence.screenshots)
    assert.equal(hash(readFileSync(`${root}/${shot.file}`)), shot.sha256, shot.file);
});
test("P30 distinguishes 19 primary controls, 22 variants and ten proposal-only controls", () => {
  assert.equal(values.length, 51);
  assert.equal(Object.keys(evidence.actionVisualReferences).length, 19);
  assert.equal(total(evidence.actionVisualReferences), 84);
  assert.equal(Object.keys(evidence.controlVariantReferences).length, 22);
  assert.equal(total(evidence.controlVariantReferences), 92);
  const proposal = values.filter((c) => c.scope === "proposal-only-not-source-action");
  assert.equal(proposal.length, 10);
  assert.equal(total(proposal), 40);
  const r = buildMembersReview(sources, parent, evidence);
  assert.equal(r.proposalOnlyControls.length, 10);
  assert.equal(r.approval, "pending-user-review");
});
test("P30 maps each exact selector/state to both viewports, not merely full-page context", () => {
  for (const [id, ref] of Object.entries(evidence.controlReferences))
    for (const [state, scene] of Object.entries(ref.states))
      for (const width of [1440, 390]) {
        const shots = evidence.screenshots.filter((s) => s.scene === scene && s.width === width);
        assert.equal(shots.length, 1);
        assert.deepEqual(shots[0].control, {
          key: `P30-${id}`,
          actionId: ref.actionId,
          selector: ref.selector,
          state,
          scope: ref.scope,
        });
      }
});
test("P30 retains native select and shared-reason lifecycle limits instead of inventing busy states", () => {
  for (const id of ["filter-role", "filter-status", "filter-team", "filter-sort", "row-role"])
    assert.deepEqual(Object.keys(evidence.controlReferences[id].states), [
      "default",
      "hover",
      "focus",
    ]);
  for (const action of ["disable", "restore", "role", "revoke"]) {
    assert.deepEqual(Object.keys(evidence.controlReferences[`reason-${action}-confirm`].states), [
      "default",
      "hover",
      "focus",
      "pressed",
      "disabled",
    ]);
    for (const part of ["cancel", "close"])
      assert.deepEqual(Object.keys(evidence.controlReferences[`reason-${action}-${part}`].states), [
        "default",
        "hover",
        "focus",
        "pressed",
      ]);
  }
  assert.equal(
    evidence.controlReferences.invite_interrupted.scope,
    "proposal-only-not-source-action",
  );
  assert.doesNotMatch(sources[dependencies[2]], /maxlength=/);
});
test("P30 browser evidence includes 432 geometry/focus checks and 100 offline interactions", () => {
  assert.equal(evidence.checks.length, 432);
  assert.equal(evidence.interactions.length, 100);
  for (const c of evidence.checks) {
    assert.ok(c.metrics.hit && !c.metrics.overflow && c.metrics.described);
    assert.ok(c.metrics.height >= 44 && c.metrics.width >= 44 && c.metrics.font >= 16);
  }
  for (const interaction of evidence.interactions)
    assert.equal(interaction.outcome, "passed-offline-not-Vue");
  assert.equal(evidence.scope, "offline-proposal-not-runtime-or-user-accepted");
});
test("P30 builder rejects omitted/extra primary actions and stale controls source", () => {
  for (const kind of ["missing", "extra", "stale"]) {
    const bad = structuredClone(evidence);
    if (kind === "missing") delete bad.actionVisualReferences["OG-M-INVITE"];
    if (kind === "extra")
      bad.actionVisualReferences.invented = bad.actionVisualReferences["OG-M-INVITE"];
    if (kind === "stale") bad.sourceHashes[dependencies[2]] = "stale";
    assert.throws(
      () => buildMembersReview(sources, parent, bad),
      /exact reachable|verify current members controls/,
    );
  }
});
