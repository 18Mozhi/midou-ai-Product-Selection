import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  base,
  sourceFile,
  buildOrganizationProfileReview,
} from "../../scripts/build-ui-phase2-organization-profile-review.mjs";

const folder = `${base}/design/organization-profile-fields-direction-c`;
const evidence = JSON.parse(readFileSync(`${folder}/evidence.json`, "utf8"));
const controls = JSON.parse(
  readFileSync(`${base}/design/organization-profile-controls-direction-c/evidence.json`, "utf8"),
);
const source = readFileSync(sourceFile, "utf8");
const hash = (v) => createHash("sha256").update(v).digest("hex");

test("P29 field package binds current sources and 110 unique PNGs", () => {
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(readFileSync(file, "utf8").replaceAll("\r\n", "\n")), sha, file);
  assert.equal(evidence.screenshots.length, 110);
  assert.equal(new Set(evidence.screenshots.map((s) => s.file)).size, 110);
  for (const s of evidence.screenshots) {
    assert.match(s.file, /^[\w-]+\.png$/);
    assert.equal(hash(readFileSync(`${folder}/${s.file}`)), s.sha256);
  }
});
test("P29 six fields expose 47 representative states at both widths, without invented select popup", () => {
  const entries = Object.entries(evidence.fieldVisualReferences);
  assert.equal(entries.length, 6);
  assert.equal(
    entries.reduce((n, [, v]) => n + Object.keys(v.states).length, 0),
    47,
  );
  for (const [binding, v] of entries) {
    assert.ok(v.label);
    assert.equal(v.selector, `#${binding.slice(5)}`);
    for (const scene of Object.values(v.states))
      assert.deepEqual(
        evidence.screenshots
          .filter((s) => s.scene === scene)
          .map((s) => s.width)
          .sort((a, b) => a - b),
        [390, 1440],
      );
  }
  assert.ok(!evidence.fieldVisualReferences["form.default_workspace_id"].states.pressed);
  assert.equal(evidence.combinations.length, 8);
});
test("P29 recorded checks retain accessible labels, descriptions, readable input and editable save state", () => {
  assert.equal(evidence.checks.length, 94);
  for (const check of evidence.checks) {
    const m = check.metrics;
    assert.ok(m.label && m.descriptions && m.hit && !m.overflow && !m.disabled);
    assert.ok(m.font >= 16 && m.width >= 44 && m.height >= 44);
    assert.equal(m.required, check.field !== "logo_url");
    if (check.state === "invalid") assert.equal(m.invalid, "true");
    if (check.state === "corrected") assert.equal(m.invalid, "false");
  }
});
test("P29 field registry is exact, source-bound and cannot omit or invent a field", () => {
  const r = buildOrganizationProfileReview(source, controls, evidence);
  for (const input of r.surfaceReview.inputs)
    assert.deepEqual(input.visualReferences, {
      package: "organization-profile-fields-direction-c",
      ...evidence.fieldVisualReferences[input.binding],
    });
  for (const type of ["missing", "extra", "stale"]) {
    const changed = structuredClone(evidence);
    if (type === "missing") delete changed.fieldVisualReferences["form.reason"];
    if (type === "extra") changed.fieldVisualReferences["form.status"] = {};
    if (type === "stale") changed.sourceHashes[sourceFile] = "stale";
    assert.throws(
      () => buildOrganizationProfileReview(source, controls, changed),
      /exact six field evidence|verify current field proposal/,
    );
  }
});
test("P29 Logo four states are linked, without fabricating busy or approval", () => {
  const r = buildOrganizationProfileReview(source, controls, evidence);
  const logo = r.actions.find((a) => a.actionId === "OG-PROFILE-LOGO");
  assert.deepEqual(Object.keys(logo.visualStateReferences).sort(), [
    "default",
    "focus",
    "hover",
    "pressed",
  ]);
  assert.equal(logo.visualStates.busy, "not-applicable-source-unrepresented");
  assert.equal(r.approval, "pending-user-review");
});
