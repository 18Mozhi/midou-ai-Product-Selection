import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";

const root = "design-plans/ui-phase-2-2026-09-07/design/workspaces-fields-direction-c";
const evidence = JSON.parse(readFileSync(`${root}/evidence.json`, "utf8"));
const source = readFileSync("apps/web/src/components/OrganizationWorkspacePanel.vue", "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const nodes = [];
function visit(n) {
  if (n.type === 1) nodes.push(n);
  for (const c of n.children || []) visit(c);
}
visit(baseParse(parse(source).descriptor.template.content));
const prop = (n, name) => n.props.find((p) => p.type === 6 && p.name === name)?.value?.content;
test("P32 five field references match actual native input models and limits", () => {
  assert.deepEqual(
    evidence.fields.map((f) => f.model),
    ["form.name", "form.slug", "form.reason", "query", "sort"],
  );
  for (const field of evidence.fields) {
    const node = nodes.find(
      (n) =>
        ["input", "textarea", "select"].includes(n.tag) &&
        n.props.some((p) => p.type === 7 && p.name === "model" && p.exp?.content === field.model),
    );
    assert.ok(node, field.model);
    assert.equal(
      node.props.some((p) => p.type === 7 && p.name === "bind" && p.arg?.content === "disabled"),
      false,
      "source field stays editable while busy",
    );
    if (field.max) {
      assert.equal(Number(prop(node, "maxlength")), field.max);
      assert.ok(node.props.some((p) => p.type === 6 && p.name === "required"));
    }
  }
  const slug = nodes.find((n) => prop(n, "id") === "workspace-slug");
  const pattern = new RegExp(prop(slug, "pattern"));
  for (const s of ["a", "0", "north-america", "a".repeat(63)]) assert.ok(pattern.test(s));
  for (const s of ["", "North", "-north", "north-", "a".repeat(64), " north "])
    assert.equal(pattern.test(s), false);
});
test("P32 fields cover exact 34 states plus 8 dual-viewport compositions", () => {
  assert.equal(evidence.approval, "pending-user-review");
  assert.equal(
    evidence.fields.reduce((n, f) => n + f.states.length, 0),
    34,
  );
  assert.equal(Object.keys(evidence.compositions).length, 8);
  assert.equal(evidence.screenshots.length, 84);
  const expected = [
    ...evidence.fields.flatMap((f) => f.states.map((s) => `${f.id}-${s}`)),
    ...Object.keys(evidence.compositions),
  ]
    .flatMap((scene) => [1440, 390].map((w) => `${scene}/${w}`))
    .sort();
  assert.deepEqual(evidence.screenshots.map((s) => `${s.scene}/${s.width}`).sort(), expected);
  assert.equal(evidence.checks.length, 476);
  assert.deepEqual(
    evidence.observations.map((o) => o.width),
    [1440, 390],
  );
});
test("P32 field evidence is source-bound and every permanent PNG matches", () => {
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(readFileSync(file, "utf8").replaceAll("\r\n", "\n")), sha, file);
  for (const s of evidence.screenshots)
    assert.equal(hash(readFileSync(`${root}/${s.file}`)), s.sha256, s.file);
  assert.equal(
    hash(
      readFileSync(
        "design-plans/ui-phase-2-2026-09-07/design/workspaces-controls-direction-c/composition-restore-390.png",
      ),
    ),
    "640c22bdbccc5a6f7fc24b427487f6d0e25f23418d2080a453035aff17c49176",
  );
});
