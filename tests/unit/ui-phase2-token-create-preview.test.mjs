import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { tokenCreatePreview } from "../../scripts/lib/ui-phase2-token-create-preview.mjs";

const component = "apps/web/src/components/OrganizationTokenPanel.vue";
const folder = "output/playwright/p36-create-vue-preview";
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const original = read(component),
  transformed = tokenCreatePreview(original);
const evidence = JSON.parse(read(`${folder}/evidence.json`));
function fields(source) {
  const result = [];
  const walk = (node) => {
    if (node.type === 1) {
      if (["input", "textarea", "select", "button"].includes(node.tag))
        result.push(JSON.stringify([node.tag, node.props.map((prop) => prop.loc.source)]));
      for (const prop of node.props) if (prop.type === 7) result.push(prop.loc.source);
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(baseParse(parse(source).descriptor.template.content));
  return result.sort();
}
test("P36 creation preview preserves complete scripts, native controls and all directives", () => {
  assert.equal(
    parse(original).descriptor.scriptSetup.content,
    parse(transformed).descriptor.scriptSetup.content,
  );
  assert.deepEqual(fields(transformed), fields(original));
  assert.equal(parse(transformed).errors.length, 0);
  assert.equal(transformed.includes("p36-form-layout"), true);
  assert.equal(original.includes("p36-form-layout"), false);
  assert.ok(
    transformed.indexOf('class="org-token-duration"') <
      transformed.indexOf('class="org-token-scope-field"'),
  );
  assert.throws(() =>
    tokenCreatePreview(original.replace('class="org-token-create"', 'class="unexpected"')),
  );
});
test("P36 new preview binds current originals and transformed template without relabeling approval", () => {
  assert.equal(evidence.approval, "pending-user-review");
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.checks.length, 152);
  assert.equal(evidence.runs.length, 4);
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(read(file)), sha, file);
  assert.equal(evidence.transformedHashes[component], hash(transformed));
  assert.equal(evidence.screenshots.length, 32);
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["index.html", "evidence.json", ...evidence.screenshots.map((shot) => shot.file)].sort(),
  );
  for (const shot of evidence.screenshots)
    assert.equal(hash(readFileSync(`${folder}/${shot.file}`)), shot.sha256, shot.file);
});
test("P36 creation flows retain exact post contracts, real pending edits and native validation", () => {
  for (const run of evidence.runs) {
    const checks = evidence.checks
      .filter((check) => check.width === run.width)
      .map((check) => check.name);
    for (const name of [
      "original four scopes unchecked",
      "missing scopes sends no POST",
      "pending fields remain editable",
      "failed creation exposes no secret",
      "success unchecks all scopes",
      "C paper and no inherited primary containers",
      "no unexpected requests",
      "no Vue errors",
    ])
      assert.ok(checks.includes(name), name);
    const posts = run.requests.filter((request) => request.method === "POST");
    assert.equal(posts.length, 2);
    for (const [index, post] of posts.entries()) {
      assert.equal(post.path, "/api/v1/org/admin/tokens");
      assert.equal(post.key, true);
      assert.deepEqual(post.body, {
        name: index ? "失败后保留的后续草稿" : "月度报表接入",
        scopes: ["task:read", "trend:read", "opportunity:read", "report:read"],
        ttl_days: 90,
        reason: "经营团队按月核对报表",
      });
    }
    assert.equal(run.requests.filter((request) => request.method === "GET").length, 4);
  }
});
test("P36 approved mobile filter image and application imports are untouched", () => {
  assert.equal(
    hash(readFileSync("output/playwright/p36-fields-review/composition-filters-default-390.png")),
    "1bdc3c39fdc4f85483db1ca9a6d8fb2f24d8000321a118e976515029c9eb154b",
  );
  for (const file of [
    component,
    "apps/web/src/components/OrganizationAdminCenter.vue",
    "apps/web/src/main.ts",
  ])
    assert.equal(read(file).includes("token-create-preview"), false);
  assert.match(
    read("design-plans/ui-phase-2-2026-09-07/P36-MOBILE-FILTER-COMPOSITION-APPROVAL.md"),
    /不包含顶部折叠按钮、创建表单/,
  );
});
