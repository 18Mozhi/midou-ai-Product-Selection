import { historicalAdminResultsSource } from "../../scripts/lib/ui-phase2-admin-results-baseline.mjs";
import test from "node:test";
import { historicalUserCreationSource } from "../../scripts/lib/ui-phase2-user-creation-baseline.mjs";
import { historicalFilterResetSource } from "../../scripts/lib/ui-phase2-filter-reset-baseline.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { userPagePreview } from "../../scripts/lib/ui-phase2-user-page-preview.mjs";

const read = (file) =>
  historicalAdminResultsSource(file, readFileSync(file, "utf8").replaceAll("\r\n", "\n"));
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
  test(`P43 ${surface} composition preserves full script, every directive/expression and native control`, () => {
    const original = read(file),
      transformed = userPagePreview(original, surface);
    assert.equal(
      parse(transformed).descriptor.scriptSetup.content,
      parse(original).descriptor.scriptSetup.content,
    );
    assert.deepEqual(contracts(transformed), contracts(original));
    assert.deepEqual(parse(transformed).errors, []);
  });
}
test("P43 transformation fails closed on mismatched source and unknown surface", () => {
  assert.throws(() =>
    userPagePreview(
      read(parent).replace('class="account-metrics"', 'class="unexpected"'),
      "parent",
    ),
  );
  assert.throws(() =>
    userPagePreview(read(detail).replace("<h4>组织与角色</h4>", "<h4>Changed</h4>"), "detail"),
  );
  assert.throws(() => userPagePreview(read(parent), "unknown"));
});

test("P43 actual Vue review evidence pins captured source revisions and exact image set", () => {
  const folder = "output/playwright/p43-page-vue-preview";
  const evidence = JSON.parse(read(`${folder}/evidence.json`));
  assert.equal(evidence.kind, "P43-PAGE-VUE-PREVIEW-r1");
  assert.equal(evidence.approval, "pending-user-review");
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.checks.length, 266);
  assert.equal(evidence.screenshots.length, 68);
  assert.equal(Object.keys(evidence.sourceHashes).length, 36);
  for (const [file, value] of Object.entries(evidence.sourceHashes))
    assert.equal(
      hash(historicalUserCreationSource(file, historicalFilterResetSource(file, read(file)))),
      value,
      file,
    );
  for (const [file, surface] of [
    [parent, "parent"],
    [detail, "detail"],
  ])
    assert.equal(
      hash(userPagePreview(historicalUserCreationSource(file, read(file)), surface)),
      evidence.transformedHashes[file],
    );
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["evidence.json", "index.html", ...evidence.screenshots.map((s) => s.file)].sort(),
  );
  for (const image of evidence.screenshots)
    assert.equal(hash(readFileSync(`${folder}/${image.file}`)), image.sha256, image.file);
  for (const width of [390, 760, 761, 1440]) {
    const states = evidence.screenshots.filter((s) => s.width === width).map((s) => s.state);
    assert.equal(new Set(states).size, states.length);
    for (const state of [
      "loading",
      "default",
      "filters",
      "empty",
      "detail-loading",
      "detail-top",
      "membership-fields",
      "access-sections",
      "access-actions",
      "status-reason-original",
      "detail-error",
      "disabled-detail",
      "disabled-actions",
      "long-record",
      "refresh-error",
      "first-error",
    ])
      assert.ok(states.includes(state), `${width}:${state}`);
    assert.equal(states.length, width <= 760 ? 18 : 16);
    const observation = evidence.observations.find((s) => s.width === width);
    assert.deepEqual(observation.unexpected, []);
    assert.deepEqual(observation.errors, []);
    assert.equal(observation.requests.length, 11);
    assert.equal(observation.requests.filter((r) => r.target === "detail").length, 4);
    assert.ok(
      observation.requests.every(
        (r) => r.method === "GET" && r.path.startsWith("/api/v1/platform/accounts"),
      ),
    );
    assert.deepEqual(observation.requests[1].query, { query: "missing@example.test" });
    assert.deepEqual(observation.requests[2].query, {});
    const names = new Set(evidence.checks.filter((s) => s.width === width).map((s) => s.name));
    for (const name of [
      "original fixture row count",
      "global summary not row total",
      "unrelated URL retained",
      "reason cancel no HTTP",
      "detail retry restores identity",
      "disabled all role actions disabled",
      "original missing membership ID is not corrected",
      "membership native constraints",
      "first error has no list",
    ])
      assert.ok(names.has(name), `${width}:${name}`);
  }
});

test("P43 remains an isolated review, with no production imports or fabricated permission proof", () => {
  assert.ok(!read("apps/web/src/main.ts").includes("user-page-preview"));
  assert.ok(!read(parent).includes("p43-"));
  assert.ok(!read(detail).includes("p43-"));
  const evidence = JSON.parse(read("output/playwright/p43-page-vue-preview/evidence.json"));
  assert.match(evidence.scope, /omits membership organization_id/);
  assert.match(evidence.scope, /reason dialog remains original appearance/);
  assert.match(evidence.scope, /No full App/);
});
