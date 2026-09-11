import test from "node:test";
import { historicalAdminControlsSource } from "../../scripts/lib/ui-phase2-admin-controls-baseline.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { adminPagePreview } from "../../scripts/lib/ui-phase2-admin-page-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const parent = "apps/web/src/components/PlatformAccountCenter.vue";
const detail = "apps/web/src/components/PlatformUserDetailDialog.vue";
function contracts(source) {
  const directives = [],
    interpolations = [],
    controls = [];
  function walk(node) {
    if (node.type === 5) interpolations.push(node.content.content);
    if (node.type === 1) {
      for (const prop of node.props) if (prop.type === 7) directives.push(prop.loc.source);
      if (["button", "input", "select", "option", "textarea", "summary"].includes(node.tag)) {
        controls.push(
          JSON.stringify({
            tag: node.tag,
            props: node.props
              .filter((p) => p.name !== "class" && p.name !== "aria-describedby")
              .map((p) => p.loc.source)
              .sort(),
          }),
        );
      }
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(baseParse(parse(source).descriptor.template.content));
  return {
    directives: directives.sort(),
    interpolations: interpolations.sort(),
    controls: controls.sort(),
  };
}
for (const [file, surface] of [
  [parent, "parent"],
  [detail, "detail"],
]) {
  test(`P44 ${surface} composition preserves full script, every directive/expression and native control`, () => {
    const original = read(file),
      transformed = adminPagePreview(original, surface);
    assert.equal(
      parse(transformed).descriptor.scriptSetup.content,
      parse(original).descriptor.scriptSetup.content,
    );
    assert.deepEqual(contracts(transformed), contracts(original));
    assert.deepEqual(parse(transformed).errors, []);
  });
}
test("P44 transformation fails closed on mismatched source and unknown surface", () => {
  assert.throws(() =>
    adminPagePreview(
      read(parent).replace('class="account-metrics"', 'class="unexpected"'),
      "parent",
    ),
  );
  assert.throws(() =>
    adminPagePreview(read(detail).replace("<h4>组织与角色</h4>", "<h4>Changed</h4>"), "detail"),
  );
  assert.throws(() => adminPagePreview(read(parent), "unknown"));
});

test("P44 review pins actual source and exact image inventories", () => {
  const folder = "output/playwright/p44-page-vue-preview",
    e = JSON.parse(read(folder + "/evidence.json"));
  assert.equal(e.kind, "P44-PAGE-VUE-PREVIEW-r1");
  assert.equal(e.approval, "pending-user-review");
  assert.equal(e.processesClosed, true);
  assert.equal(e.checks.length, 282);
  assert.equal(e.screenshots.length, 68);
  assert.equal(Object.keys(e.sourceHashes).length, 39);
  for (const [file, value] of Object.entries(e.sourceHashes))
    assert.equal(hash(historicalAdminControlsSource(file, read(file))), value, file);
  for (const [file, surface] of [
    [parent, "parent"],
    [detail, "detail"],
  ])
    assert.equal(
      hash(adminPagePreview(historicalAdminControlsSource(file, read(file)), surface)),
      e.transformedHashes[file],
    );
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const image of e.screenshots)
    assert.equal(hash(readFileSync(folder + "/" + image.file)), image.sha256, image.file);
  for (const width of [390, 760, 761, 1440]) {
    const images = e.screenshots.filter((s) => s.width === width),
      names = images.map((s) => s.state);
    assert.equal(new Set(names).size, names.length);
    for (const state of [
      "loading",
      "default",
      "directory",
      "filters",
      "filtered-no-role",
      "filtered-empty",
      "comparison-zero",
      "comparison-all",
      "comparison-search-empty",
      "detail-entry",
      "long-multiple-roles",
      "roles-refresh-error",
      "accounts-refresh-error",
      "accounts-first-error",
      "no-accounts",
      "no-role-directory",
    ])
      assert.ok(names.includes(state), width + ":" + state);
    assert.equal(images.length, width <= 760 ? 18 : 16);
    const o = e.observations.find((o) => o.width === width);
    assert.deepEqual(o.errors, []);
    assert.deepEqual(o.unexpected, []);
    assert.ok(o.requests.every((r) => r.method === "GET"));
    assert.equal(o.requests.length, 19);
    assert.equal(o.requests.filter((r) => r.target === "accounts").length, 10);
    assert.equal(o.requests.filter((r) => r.target === "roles").length, 8);
    assert.equal(o.requests.filter((r) => r.target === "detail").length, 1);
    const checks = e.checks.filter((c) => c.width === width);
    for (const name of [
      "authorizable accounts include no-role user",
      "global count not filtered count",
      "comparison changes no URL",
      "comparison changes no request",
      "admin creation defaults operations role",
      "creation cancel no request",
      "old matrix notice not separately exposed",
      "first account failure hides directory",
    ])
      assert.ok(
        checks.some((c) => c.name === name),
        width + ":" + name,
      );
  }
});
test("P44 review scope cannot be confused with production or all dialogs approval", () => {
  assert.ok(!read("apps/web/src/main.ts").includes("admin-page-preview"));
  assert.ok(!read(parent).includes("p44-"));
  const e = JSON.parse(read("output/playwright/p44-page-vue-preview/evidence.json"));
  assert.match(e.scope, /GET-only/);
  assert.match(e.scope, /Creation default\/cancel only/);
  assert.match(e.scope, /no full App/);
  assert.match(e.scope, /global summary untouched/);
});
