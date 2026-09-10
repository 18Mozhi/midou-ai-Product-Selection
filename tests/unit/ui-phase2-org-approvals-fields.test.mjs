import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { loadOrgApprovalFieldContract } from "../../scripts/lib/ui-phase2-org-approvals-fields-data.mjs";

const root = "design-plans/ui-phase-2-2026-09-07/design/org-approvals-fields-direction-c";
const e = JSON.parse(readFileSync(`${root}/evidence.json`, "utf8"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
test("P34 approved mobile filter image remains immutable without promoting the whole package", () => {
  assert.equal(
    hash(readFileSync(`${root}/template-filters-matching-390.png`)),
    "5f7b9c927dcb9a7a386255560c4c10e83dc9a11841ce8689dcb917c64201dfcc",
  );
  assert.equal(e.approval, "pending-user-review");
  assert.ok(
    readFileSync(
      "design-plans/ui-phase-2-2026-09-07/P34-MOBILE-FILTER-COMPOSITION-APPROVAL.md",
      "utf8",
    ).includes("截图同时包含的模板目录、分页、详情、版本差异不在本次批准范围内"),
  );
});
test("P34 field catalog binds exactly the ten real local models without invented form constraints", async () => {
  const source = await loadOrgApprovalFieldContract();
  assert.deepEqual(e.sourceInputs, JSON.parse(JSON.stringify(source.inputs)));
  assert.deepEqual(
    e.fields.map((f) => f.binding).sort(),
    source.inputs.map((i) => i.binding).sort(),
  );
  assert.equal(e.fields.length, 10);
  for (const input of source.inputs) {
    assert.ok(!Object.hasOwn(input.attrs, "required"));
    assert.ok(!Object.hasOwn(input.attrs, "maxlength"));
    assert.ok(!Object.hasOwn(input.attrs, "disabled"));
    if (input.tag === "input") assert.equal(input.attrs.type, "search");
  }
  assert.equal(e.approval, "pending-user-review");
});
test("P34 all source select values and editable refresh cases have explicit visual bindings", () => {
  assert.equal(e.cases.length, 67);
  for (const f of e.fields) {
    const cases = e.cases.filter((c) => c.fieldId === f.id);
    assert.ok(cases.some((c) => c.state === "focus"));
    assert.ok(cases.some((c) => c.state === "refreshing"));
    if (f.options) {
      assert.deepEqual(
        cases.filter((c) => c.state.startsWith("option-")).map((c) => c.value),
        f.options.slice(1),
      );
      if (f.key !== "workspace")
        assert.deepEqual(
          f.options,
          e.sourceInputs.find((i) => i.binding === f.binding).options.map((o) => o.value),
        );
    } else {
      assert.equal(cases.find((c) => c.state === "length-220").value.length, 220);
      assert.equal(cases.find((c) => c.state === "restored-200").reload, true);
      for (const width of [1440, 390]) {
        assert.equal(
          e.fieldChecks.find((c) => c.id === `${f.id}-length-220` && c.width === width).value
            .length,
          220,
        );
        assert.equal(
          e.fieldChecks.find((c) => c.id === `${f.id}-restored-200` && c.width === width).value
            .length,
          200,
        );
      }
    }
  }
});
test("P34 150 images bind 67 representative field states and eight combinations, not whole-page approval", () => {
  assert.equal(e.fieldChecks.length, 134);
  assert.equal(e.compositionChecks.length, 16);
  assert.equal(e.workflowChecks.length, 20);
  assert.equal(e.screenshots.length, 150);
  const expected = [...e.cases, ...e.compositions]
    .flatMap((c) => [1440, 390].map((w) => `${c.id}/${w}`))
    .sort();
  assert.deepEqual(e.screenshots.map((s) => `${s.scene}/${s.width}`).sort(), expected);
  assert.equal(new Set(expected).size, 150);
  for (const s of e.screenshots.filter((s) => s.field)) {
    const f = e.fields.find((f) => f.id === s.field.id);
    assert.equal(s.field.binding, f.binding);
    assert.equal(s.field.selector, f.selector);
    assert.ok(
      e.fieldChecks.some(
        (c) =>
          c.id === s.scene &&
          c.width === s.width &&
          c.nativeConstraints &&
          c.sourceOptionsAndResults,
      ),
    );
  }
  assert.match(e.boundary, /Native select popup visuals/);
});
test("P34 source and image fingerprints remain current and old renderer is reused", () => {
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(readFileSync(file, "utf8").replaceAll("\r\n", "\n")), sha, file);
  for (const s of e.screenshots) assert.equal(hash(readFileSync(`${root}/${s.file}`)), s.sha256);
  const html = readFileSync(`${root}/index.html`, "utf8");
  assert.match(html, /\.\.\/org-approvals-direction-c\/approvals\.js/);
  assert.doesNotMatch(html, /<dialog|<form/);
});
test("P34 actual source filter functions retain trimmed search, hidden-ID exclusion and name-based workspaces", async () => {
  const source = await loadOrgApprovalFieldContract();
  const box = { window: {} };
  vm.runInNewContext(
    readFileSync(
      "design-plans/ui-phase-2-2026-09-07/design/org-approvals-direction-c/data.js",
      "utf8",
    ),
    box,
  );
  const data = JSON.parse(JSON.stringify(box.window.ORG_APPROVALS_C_DATA));
  const state = {
    ...data,
    request: { query: "", status: "all", workspace: "all", resource: "all", sort: "created_desc" },
    template: { query: "", status: "all", workspace: "all", resource: "all", sort: "name_asc" },
  };
  state.request.query = "   ";
  assert.equal(source.evaluate(state).requests.length, 10);
  state.request.query = data.templates[0].id;
  state.template.query = data.templates[0].id;
  assert.equal(source.evaluate(state).requests.length, 0);
  assert.equal(source.evaluate(state).templates.length, 0);
  state.template.query = "  首次  ";
  assert.deepEqual(source.evaluate(state).templates, [data.templates[1].id]);
  state.templates.push({
    ...data.templates[0],
    id: "explicit-synthetic-same-workspace",
    current_version: 10,
  });
  state.template.query = "";
  state.template.sort = "updated_desc";
  assert.equal(source.evaluate(state).templates[0], "explicit-synthetic-same-workspace");
  assert.equal(source.evaluate(state).workspaces.length, 2);
});
