import test from "node:test";
import { assertP34HistoricalSourceHash } from "../../scripts/lib/ui-phase2-org-approvals-owner-path-history.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { scanSource } from "../../scripts/lib/ui-phase2-inventory.mjs";

const root = "design-plans/ui-phase-2-2026-09-07/design/org-approvals-controls-direction-c";
const e = JSON.parse(readFileSync(`${root}/evidence.json`, "utf8"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
test("P34 original 13 positions plus implemented mobile clear binding cover all 14 child positions", () => {
  const candidates = scanSource(readFileSync(e.sourceFile, "utf8"), e.sourceFile).candidates;
  assert.equal(candidates.length, 14);
  const signatures = candidates.map((c) => c.candidateId.split("#")[1]).sort();
  assert.deepEqual(e.sourceSignatures, signatures);
  assert.deepEqual(
    [
      ...e.controls.flatMap((c) => c.signatures),
      ...e.implementedBindings.map((b) => b.sourceSignature),
    ].sort(),
    signatures,
  );
  assert.equal(e.implementedBindings.length, 1);
  const binding = e.implementedBindings[0];
  assert.equal(binding.proposalControlId, "template-clear-empty");
  assert.deepEqual(binding.widths, [390]);
  const implemented = candidates.find((c) => c.candidateId.endsWith("#" + binding.sourceSignature));
  assert.equal(implemented.attributes.class, "org-template-empty-clear");
  assert.equal(
    implemented.attributes["@click"].replace(/\s/g, ""),
    "resetTemplates();templateSearchInput?.focus();",
  );
  const bySignature = new Map(candidates.map((c) => [c.candidateId.split("#")[1], c]));
  for (const c of e.controls)
    for (const signature of c.signatures) {
      const source = bySignature.get(signature);
      if (c.view) assert.equal(source.attributes["@click"], `section = '${c.view}'`);
      if (c.delta) {
        assert.equal(source.attributes["@click"], `${c.kind}Page${c.delta < 0 ? "--" : "++"}`);
        assert.equal(
          source.attributes[":disabled"],
          c.delta < 0 ? `${c.kind}Page <= 1` : `${c.kind}Page >= ${c.kind}PageCount`,
        );
      }
      if (c.href) assert.equal(source.attributes.to, c.href);
      if (c.id.endsWith("-reset"))
        assert.equal(
          source.attributes["@click"],
          c.kind === "request" ? "resetRequests" : "resetTemplates",
        );
      if (c.id === "select")
        assert.equal(source.attributes["@click"], "selectedTemplateId = String(template.id)");
    }
  assert.equal(e.controls.filter((c) => c.proposalOnly).length, 7);
  for (const c of e.controls.filter((c) => c.proposalOnly || c.parentControl))
    assert.deepEqual(c.signatures, []);
});
test("P34 every declared state binds a verified selector and an image at applicable viewports only", () => {
  assert.equal(e.controls.length, 32);
  assert.equal(e.checks.length, 240);
  assert.equal(e.interactions.length, 57);
  assert.equal(e.screenshots.length, 244);
  const expected = e.controls.flatMap((c) =>
    c.states.flatMap((s) => c.widths.map((w) => `${c.id}-${s}/${w}`)),
  );
  expected.push(
    ...["template_page_two", "template_multi_diff"].flatMap((s) =>
      [1440, 390].map((w) => `composition-${s}/${w}`),
    ),
  );
  assert.deepEqual(e.screenshots.map((s) => `${s.scene}/${s.width}`).sort(), expected.sort());
  assert.equal(new Set(expected).size, expected.length);
  for (const s of e.screenshots.filter((s) => s.control)) {
    const c = e.controls.find((c) => c.id === s.control.id);
    assert.equal(s.control.selector, c.selector);
    assert.equal(s.control.actionId, c.actionId);
    assert.equal(s.proposalOnly, Boolean(c.proposalOnly));
    assert.ok(
      e.checks.some(
        (v) =>
          v.id === c.id &&
          v.variant === s.control.variant &&
          v.width === s.width &&
          v.nativeStateVerified &&
          v.noSideEffect,
      ),
    );
  }
});
test("P34 selected, pressed and archived template entries do not invent permission or pending-write rules", () => {
  for (const c of e.controls.filter((c) => c.view || c.actionId === "OG-A-SELECT"))
    assert.deepEqual(c.states, ["default", "hover", "focus", "pressed"]);
  assert.equal(e.controls.find((c) => c.id === "select-archived").selected, true);
  assert.deepEqual(
    e.controls.filter((c) => c.states.includes("busy")).map((c) => c.id),
    ["refresh"],
  );
  for (const r of e.interactions)
    for (const intent of r.intents) {
      if (intent.navigation)
        assert.ok(["/tasks/approvals", "/org-admin/audit"].includes(intent.navigation));
      else {
        assert.equal(intent.method, "GET");
        assert.ok(["/org/admin/summary", "/org/admin/approvals"].includes(intent.path));
      }
    }
  assert.equal(e.approval, "pending-user-review");
  assert.match(e.boundary, /blocked\/conflict/);
});
test("P34 historical controls retain source lineage and unchanged image bytes", () => {
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assertP34HistoricalSourceHash(file, readFileSync(file, "utf8"), sha);
  for (const s of e.screenshots)
    assert.equal(hash(readFileSync(`${root}/${s.file}`)), s.sha256, s.file);
  const html = readFileSync(`${root}/index.html`, "utf8");
  assert.match(html, /\.\.\/org-approvals-direction-c\/approvals\.js/);
  assert.match(html, /\.\.\/org-approvals-direction-c\/data\.js/);
  assert.doesNotMatch(html, /<dialog|<form/);
});
