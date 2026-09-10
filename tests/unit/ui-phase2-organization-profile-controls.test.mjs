import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";
import { buildOrganizationProfileDesignData } from "../../scripts/lib/ui-phase2-organization-profile-design-data.mjs";

const base = "design-plans/ui-phase-2-2026-09-07/design/organization-profile-controls-direction-c";
const evidence = JSON.parse(readFileSync(`${base}/evidence.json`, "utf8"));
const sourceFile = "apps/web/src/components/OrganizationAdminCenter.vue";
const source = readFileSync(sourceFile, "utf8").replaceAll("\r\n", "\n");
const hash = (v) => createHash("sha256").update(v).digest("hex");

test("P29 controls stay linked to current source and exact parent data/controller", () => {
  for (const [file, expected] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(readFileSync(file, "utf8").replaceAll("\r\n", "\n")), expected, file);
  const html = readFileSync(`${base}/index.html`, "utf8");
  for (const file of ["data.js", "profile.js", "profile.css"])
    assert.ok(html.includes(`../organization-profile-direction-c/${file}`));
  assert.equal(evidence.scope, "offline-proposal-not-runtime-or-user-accepted");
});
test("P29 records 162 states plus eight feedback contexts at both widths", () => {
  assert.equal(evidence.screenshots.length, 170);
  assert.equal(evidence.checks.length, 162);
  assert.equal(evidence.interactions.length, 38);
  assert.equal(Object.keys(evidence.controlReferences).length, 22);
  const seen = new Set();
  for (const shot of evidence.screenshots) {
    assert.ok(!seen.has(shot.file));
    seen.add(shot.file);
    assert.equal(hash(readFileSync(`${base}/${shot.file}`)), shot.sha256);
  }
  for (const ref of Object.values(evidence.controlReferences)) {
    for (const scene of [...Object.values(ref.states), ...(ref.context ? [ref.context] : [])])
      assert.deepEqual(
        evidence.screenshots
          .filter((s) => s.scene === scene)
          .map((s) => s.width)
          .sort((a, b) => a - b),
        [390, 1440],
      );
  }
});
test("P29 business source controls remain three actions, not 22 invented actions", () => {
  const refs = Object.values(evidence.controlReferences);
  const business = refs.filter((r) => r.scope === "source-action-representative-or-variant");
  assert.deepEqual([...new Set(business.map((r) => r.actionId))].sort(), [
    "OG-PROFILE-SAVE",
    "OG-REFRESH",
    "OG-RETRY",
  ]);
  const candidates = scanSource(source, sourceFile).candidates;
  for (const signature of [
    "b11692c0597885e3.1",
    "97ed4772fb320d6c.1",
    "d6b520278ab3dd57.1",
    "5878e30377f290ae.1",
    "1cbd108c64b5230c.1",
  ])
    assert.ok(
      candidates.some((c) => c.candidateId === `${sourceFile}#${signature}`),
      signature,
    );
  assert.match(
    source,
    /submit\('\/org\/admin\/profile', \{ \.\.\.form, expected_version: data.version \}, 'PATCH'\)/,
  );
  assert.match(source, /@invalid="validateHttps"/);
  assert.match(source, /@input="clearFieldValidity"/);
});
test("P29 retry does not invent disabled states or a login bypass", () => {
  const retries = Object.values(evidence.controlReferences).filter(
    (r) => r.actionId === "OG-RETRY",
  );
  assert.equal(retries.length, 6);
  for (const r of retries)
    assert.deepEqual(Object.keys(r.states), ["default", "hover", "focus", "pressed"]);
  assert.match(source, /<button @click="load\(\)">重新加载<\/button>/);
  assert.ok(retries.some((r) => r.sourceScene === "forbidden"));
  assert.ok(retries.some((r) => r.sourceScene === "expired"));
});
test("P29 navigation selection, disclosure and unresolved-save protection are proposals", () => {
  const refs = Object.values(evidence.controlReferences);
  assert.equal(refs.filter((r) => r.actionId === "PROPOSAL-NAV").length, 6);
  assert.equal(refs.filter((r) => r.actionId === "PROPOSAL-TECH").length, 3);
  const rechecks = refs.filter((r) => r.actionId === "PROPOSAL-RECHECK");
  assert.equal(rechecks.length, 2);
  for (const r of refs.filter((r) => r.actionId.startsWith("PROPOSAL-")))
    assert.equal(r.scope, "proposal-only-not-source-action");
  for (const r of rechecks) {
    assert.deepEqual(Object.keys(r.states), ["disabled"]);
    assert.ok(r.context);
  }
  assert.ok(evidence.controlReferences.save.states.pending);
  assert.ok(evidence.controlReferences.refresh.states.pending);
});
test("P29 reuses source-function and validator checks without claiming real transactions", async () => {
  const data = await buildOrganizationProfileDesignData(path.resolve("."));
  assert.equal(data.sourceChecks.length, 6);
  assert.ok(data.sourceChecks.some((v) => v.includes("OG-G02 reproduced")));
  assert.equal(data.summary.workspaces.total, 8);
  assert.equal(data.workspaces.length, 1);
});
