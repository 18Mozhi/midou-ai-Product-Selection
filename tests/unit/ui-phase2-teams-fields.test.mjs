import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { buildTeamsDesignData } from "../../scripts/lib/ui-phase2-teams-design-data.mjs";

const root = "design-plans/ui-phase-2-2026-09-07/design/teams-fields-direction-c";
const e = JSON.parse(readFileSync(`${root}/evidence.json`, "utf8"));
const source = readFileSync("apps/web/src/components/OrganizationTeamPanel.vue", "utf8");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const nodes = [];
function visit(n) {
  if (n.type === 1) nodes.push(n);
  for (const c of n.children || []) visit(c);
}
visit(baseParse(parse(source).descriptor.template.content));
test("P33 seven field models retain actual required limits and editable busy semantics", () => {
  assert.deepEqual(
    e.fields.map((f) => f.model),
    [
      "form.name",
      "form.lead_membership_id",
      "form.default_workflow_key",
      "form.reason",
      "query",
      "sort",
      "selectedMembershipId",
    ],
  );
  for (const f of e.fields) {
    const node = nodes.find(
      (n) =>
        ["input", "select", "textarea"].includes(n.tag) &&
        n.props.some((p) => p.type === 7 && p.name === "model" && p.exp?.content === f.model),
    );
    assert.ok(node, f.model);
    assert.equal(
      node.props.some((p) => p.type === 6 && p.name === "required"),
      f.required,
    );
    assert.equal(
      node.props.some((p) => p.type === 7 && p.name === "bind" && p.arg?.content === "disabled"),
      false,
    );
    if (f.max)
      assert.equal(
        Number(node.props.find((p) => p.type === 6 && p.name === "maxlength")?.value?.content),
        f.max,
      );
  }
});
test("P33 49 field states and nine combinations bind exactly 116 dual viewport images", () => {
  assert.equal(e.approval, "pending-user-review");
  assert.equal(
    e.fields.reduce((n, f) => n + f.states.length, 0),
    49,
  );
  assert.equal(Object.keys(e.combinations).length, 9);
  assert.equal(e.screenshots.length, 116);
  const expected = [
    ...e.fields.flatMap((f) => f.states.map((s) => `${f.id}-${s}`)),
    ...Object.keys(e.combinations).map((s) => `composition-${s}`),
  ]
    .flatMap((s) => [1440, 390].map((w) => `${s}/${w}`))
    .sort();
  assert.deepEqual(e.screenshots.map((s) => `${s.scene}/${s.width}`).sort(), expected);
  assert.equal(e.checks.length, 566);
  for (const o of e.observations) {
    assert.equal(o.noProductionWrites, true);
    assert.deepEqual(o.exactCreateIntent.body, {
      name: "北美新品团队",
      lead_membership_id: "",
      default_workflow_key: "",
      reason: "划分协作职责",
    });
  }
});
test("P33 field evidence rejects source and image drift without modifying approved P32 image", () => {
  for (const [file, sha] of Object.entries(e.sourceHashes))
    assert.equal(hash(readFileSync(file, "utf8").replaceAll("\r\n", "\n")), sha, file);
  for (const s of e.screenshots)
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
test("P33 real extracted contracts remain separate from proposed field visuals and pending response policy", async () => {
  const data = await buildTeamsDesignData(process.cwd());
  assert.equal(data.sourceChecks.length, 5);
  assert.ok(data.sourceChecks.some((s) => s.includes("OG-G02")));
  assert.match(e.boundary, /not real Vue or production/);
  assert.match(e.boundary, /Shared reason dialog excluded/);
});
