import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { assertCaptureSourceRevision } from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { tokenListPreview } from "../../scripts/lib/ui-phase2-token-list-preview.mjs";

const file = "apps/web/src/components/OrganizationTokenPanel.vue";
const folder = "output/playwright/p36-list-vue-preview";
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const original = read(file),
  transformed = tokenListPreview(original),
  evidence = JSON.parse(read(`${folder}/evidence.json`));
function structure(source) {
  const controls = [],
    directives = [],
    interpolations = [],
    filters = [];
  function walk(node) {
    if (node.type === 5) interpolations.push(node.content.content);
    if (node.type === 1) {
      if (["input", "textarea", "select", "button", "summary"].includes(node.tag))
        controls.push(node.loc.source);
      for (const prop of node.props) if (prop.type === 7) directives.push(prop.loc.source);
      if (
        node.props.some(
          (prop) =>
            prop.name === "class" &&
            prop.value?.content === "org-token-toolbar org-token-filters-c",
        )
      )
        filters.push(node.loc.source);
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(baseParse(parse(source).descriptor.template.content));
  return {
    controls: controls.sort(),
    directives: directives.sort(),
    interpolations: interpolations.sort(),
    filters,
  };
}
test("P36 list preview preserves entire script, exact filters, native controls and all directives", () => {
  assert.equal(
    parse(original).descriptor.scriptSetup.content,
    parse(transformed).descriptor.scriptSetup.content,
  );
  assert.deepEqual(structure(original), structure(transformed));
  assert.equal(parse(transformed).errors.length, 0);
  assert.ok(transformed.includes("p36-token-record-main"));
  assert.equal(original.includes("p36-token-record-main"), false);
  assert.throws(() =>
    tokenListPreview(original.replace('class="org-token-ledger"', 'class="unexpected"')),
  );
});
test("P36 list capture pins raw current source, transformed template and60 exact screenshots", () => {
  assert.equal(evidence.kind, "P36-LIST-VUE-PREVIEW-r1");
  assert.equal(evidence.approval, "pending-user-review");
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.checks.length, 264);
  for (const [source, sha] of Object.entries(evidence.sourceHashes))
    assertCaptureSourceRevision(source, read(source), sha);
  // This is an immutable capture-time transform hash; its exact helper revision is pinned above.
  assert.match(evidence.transformedHashes[file], /^[a-f0-9]{64}$/);
  const states = [
    "page-one",
    "page-two",
    "no-result",
    "active-record",
    "technical-open",
    "rotate-focus",
    "rotate-hover",
    "rotate-pressed",
    "revoke-focus",
    "revoke-hover",
    "revoke-pressed",
    "busy-record",
    "no-tokens",
    "expired-record",
    "unknown-long-record",
  ];
  assert.deepEqual(
    evidence.screenshots.map((shot) => shot.file).sort(),
    [390, 760, 761, 1440].flatMap((width) => states.map((state) => `${width}-${state}.png`)).sort(),
  );
  assert.deepEqual(
    readdirSync(folder).sort(),
    ["evidence.json", "index.html", ...evidence.screenshots.map((shot) => shot.file)].sort(),
  );
  for (const shot of evidence.screenshots)
    assert.equal(hash(readFileSync(`${folder}/${shot.file}`)), shot.sha256, shot.file);
});
test("P36 actual pagination and reason-cancel flows stay GET-only with explicit synthetic edge states", () => {
  assert.equal(evidence.fixtureRows.length, 8);
  assert.equal(evidence.fixedTime, "2026-08-26T10:00:00.000Z");
  assert.deepEqual(evidence.supplemental, [
    "empty",
    "expired-clone",
    "unknown-scope-status-long-name-clone",
  ]);
  for (const run of evidence.runs) {
    assert.equal(run.requests.length, 10);
    assert.ok(
      run.requests.every(
        (request) =>
          request.method === "GET" &&
          ["/api/v1/org/admin/summary", "/api/v1/org/admin/tokens"].includes(request.path),
      ),
    );
    const names = evidence.checks
      .filter((check) => check.width === run.width)
      .map((check) => check.name);
    for (const name of [
      "six rows on first page",
      "inactive rows have no write actions",
      "technical IDs initially collapsed",
      "page two exact names",
      "page two URL",
      "filter and paging made no extra GET",
      "exact technical ID",
      "rotate:actual reason target",
      "rotate:original blank reason",
      "rotate:cancel restores trigger",
      "revoke:actual reason target",
      "revoke:original blank reason",
      "revoke:cancel restores trigger",
      "busy record actions disabled",
      "empty-organization copy",
      "expired has no write actions",
      "unknown status is not invented active",
      "unknown scope original fallback",
      "unknown has no actions",
      "zero browser errors",
      "zero external or write requests",
      "zero storage",
    ])
      assert.ok(names.includes(name), name);
    assert.equal(names.filter((name) => name.endsWith(":visible region is unobscured")).length, 15);
  }
  assert.match(
    read("design-plans/ui-phase-2-2026-09-07/implementation/token-list-preview.css"),
    /\.p36-list-preview \.org-token-create \{\s*position: static;/,
  );
});
test("P36 approved filter image and production source remain unchanged", () => {
  assert.equal(
    hash(readFileSync("output/playwright/p36-fields-review/composition-filters-default-390.png")),
    "1bdc3c39fdc4f85483db1ca9a6d8fb2f24d8000321a118e976515029c9eb154b",
  );
  assertCaptureSourceRevision(
    file,
    original,
    "4713e22a2290042efd2ff180046ee15969acc0205917786aaa3e36e9fea71aa0",
  );
  for (const source of [
    file,
    "apps/web/src/components/OrganizationAdminCenter.vue",
    "apps/web/src/main.ts",
  ])
    assert.equal(read(source).includes("token-list-preview"), false);
  assert.match(evidence.scope, /not pixel-identical full-page approval/);
});
