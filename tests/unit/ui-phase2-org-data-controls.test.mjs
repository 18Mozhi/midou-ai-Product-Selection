import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";

const output = "output/playwright/p35-controls-review";
const evidence = JSON.parse(readFileSync(`${output}/evidence.json`, "utf8"));
const sourceFile = "apps/web/src/components/OrganizationDataPanel.vue";
const hash = (v) => createHash("sha256").update(v).digest("hex");

test("P35 all 10 real child actions map exactly once; extra controls remain proposals", () => {
  const candidates = scanSource(readFileSync(sourceFile, "utf8"), sourceFile).candidates;
  assert.equal(candidates.length, 10);
  const signatures = candidates.map((c) => c.candidateId.split("#")[1]).sort();
  assert.deepEqual(evidence.sourceSignatures, signatures);
  assert.deepEqual(evidence.controls.flatMap((c) => c.signatures).sort(), signatures);
  const byId = new Map(candidates.map((c) => [c.candidateId.split("#")[1], c]));
  for (const c of evidence.controls)
    for (const id of c.signatures) {
      const source = byId.get(id);
      if (c.view) assert.equal(source.attributes["@click"], `view = '${c.view}'`);
      if (c.href) assert.equal(source.attributes.to, c.href);
      if (c.action === "technical") assert.equal(source.tag, "summary");
      if (c.action === "reset")
        assert.equal(
          source.attributes["@click"],
          c.kind === "workspace" ? "resetWorkspaces" : "resetExports",
        );
      if (c.delta) {
        assert.equal(source.attributes["@click"], `${c.kind}Page ${c.delta < 0 ? "-=" : "+="} 1`);
        assert.equal(
          source.attributes[":disabled"],
          c.delta < 0 ? `${c.kind}Page <= 1` : `${c.kind}Page >= ${c.kind}PageCount`,
        );
      }
    }
  assert.equal(evidence.controls.filter((c) => c.proposalOnly).length, 6);
  for (const c of evidence.controls.filter((c) => c.proposalOnly || c.parentControl))
    assert.deepEqual(c.signatures, []);
});

test("P35 every control/state/viewport has native evidence and exactly one retained image", () => {
  assert.equal(evidence.controls.length, 25);
  assert.equal(evidence.checks.length, 188);
  assert.equal(evidence.interactions.length, 44);
  assert.equal(evidence.screenshots.length, 192);
  const expected = evidence.controls
    .flatMap((c) =>
      c.states.flatMap((variant) => c.widths.map((width) => `${c.id}-${variant}-${width}.png`)),
    )
    .sort();
  const controls = evidence.screenshots.filter((s) => s.controlId);
  assert.deepEqual(controls.map((s) => s.file).sort(), expected);
  assert.equal(new Set(expected).size, expected.length);
  for (const s of controls) {
    const c = evidence.controls.find((c) => c.id === s.controlId);
    assert.equal(s.proposalOnly, !!c.proposalOnly);
    assert.ok(
      evidence.checks.some(
        (check) =>
          check.controlId === c.id &&
          check.width === s.width &&
          check.variant === s.variant &&
          check.nativeState &&
          check.noSideEffect,
      ),
    );
  }
  assert.deepEqual(
    readdirSync(output)
      .filter((f) => f.endsWith(".png"))
      .sort(),
    evidence.screenshots.map((s) => s.file).sort(),
    "no failed-capture leftovers",
  );
});

test("P35 read-only controls do not invent busy/disabled business rules or promote approval", () => {
  assert.equal(evidence.status, "pending-user-review");
  assert.match(evidence.scope, /not-mounted-Vue-API-SQL-or-production/);
  for (const key of ["businessDialogs", "businessWrites", "externalRequests", "pageErrors"])
    assert.equal(evidence[key], 0);
  assert.deepEqual(
    evidence.controls.filter((c) => c.states.includes("busy")).map((c) => c.id),
    ["refresh"],
  );
  assert.deepEqual(
    evidence.controls
      .filter((c) => c.states.includes("disabled"))
      .map((c) => c.id)
      .sort(),
    [
      "refresh-loading",
      "workspace-previous",
      "workspace-next",
      "export-previous",
      "export-next",
    ].sort(),
  );
  for (const c of evidence.controls.filter(
    (c) => c.view || c.action === "technical" || c.action === "navigate",
  ))
    assert.deepEqual(c.states, ["default", "hover", "focus", "pressed"]);
});

test("P35 verifier binds current source and new images without overwriting the original 94 images", () => {
  for (const [f, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(readFileSync(f, "utf8").replaceAll("\r\n", "\n")), sha, f);
  for (const s of evidence.screenshots)
    assert.equal(hash(readFileSync(`${output}/${s.file}`)), s.sha256, s.file);
  const base = "design-plans/ui-phase-2-2026-09-07/design/org-data-direction-c";
  const retained = JSON.parse(readFileSync(`${base}/evidence.json`, "utf8"));
  assert.equal(evidence.retainedOriginalImages, 94);
  for (const s of retained.screenshots)
    assert.equal(hash(readFileSync(`${base}/${s.file}`)), s.sha256, s.file);
});
