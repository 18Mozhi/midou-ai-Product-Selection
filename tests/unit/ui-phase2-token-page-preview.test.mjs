import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { tokenPagePreview } from "../../scripts/lib/ui-phase2-token-page-preview.mjs";

const file = "apps/web/src/components/OrganizationTokenPanel.vue";
const folder = "output/playwright/p36-page-vue-preview";
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const original = read(file),
  transformed = tokenPagePreview(original);
const evidence = JSON.parse(read(`${folder}/evidence.json`));
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
      for (const prop of node.props)
        if (prop.type === 7 && prop.arg?.content !== "data-copy-state")
          directives.push(prop.loc.source);
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
test("P36 whole-page composition retains original script, controls, filter markup, directives and field expressions", () => {
  assert.equal(parse(transformed).errors.length, 0);
  assert.equal(
    parse(original).descriptor.scriptSetup.content,
    parse(transformed).descriptor.scriptSetup.content,
  );
  assert.deepEqual(structure(original), structure(transformed));
  assert.ok(
    transformed.indexOf('class="org-token-ledger p36-ledger-c"') <
      transformed.indexOf('class="p36-safety-c"'),
  );
  assert.ok(
    transformed.indexOf('class="p36-safety-c"') <
      transformed.indexOf('class="org-token-create p36-create-c"'),
  );
  assert.equal(transformed.split('aria-label="令牌安全边界"').length, 2);
  assert.equal(transformed.split('aria-label="组织令牌安全说明"').length, 2);
  assert.throws(() =>
    tokenPagePreview(original.replace('class="org-token-workbench"', 'class="unexpected"')),
  );
});
test("P36 page capture binds current source and44 exact four-width rendered states", () => {
  assert.equal(evidence.kind, "P36-PAGE-VUE-PREVIEW-r1");
  assert.equal(evidence.approval, "pending-user-review");
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.checks.length, 164);
  for (const [source, sha] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(read(source)), sha, source);
  assert.equal(evidence.transformedHashes[file], hash(transformed));
  const states = [
    "loading",
    "default",
    "default-viewport",
    "page-two",
    "no-results",
    "create-scope-error",
    "secret-shown",
    "secret-cleared",
    "rotate-dialog",
    "revoke-dialog",
    "first-read-failure",
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
test("P36 integrated filters, creation, reread, secret clear and original modal cancellation remain scoped to fixtures", () => {
  for (const run of evidence.runs) {
    assert.equal(run.requests.length, 7);
    const posts = run.requests.filter((req) => req.method === "POST");
    assert.equal(posts.length, 1);
    assert.equal(posts[0].path, "/api/v1/org/admin/tokens");
    assert.equal(posts[0].idempotency, true);
    assert.deepEqual(posts[0].body, {
      name: "整页审核接入",
      scopes: ["task:read"],
      ttl_days: 90,
      reason: "验证整页组合",
    });
    const names = evidence.checks
      .filter((check) => check.width === run.width)
      .map((check) => check.name);
    for (const name of [
      "management DOM precedes creation",
      "blue overview",
      "old grid removed",
      "creation remains nonsticky",
      "original eight total",
      "original blank creation",
      "page two URL",
      "scope failure no POST",
      "total after reread",
      "saved removes secret",
      "rotate:actual modal",
      "rotate:restore focus",
      "revoke:actual modal",
      "revoke:restore focus",
      "no external or unexpected writes",
      "zero browser errors",
      "zero storage",
    ])
      assert.ok(names.includes(name), name);
    assert.equal(names.filter((name) => name.endsWith(":unobscured")).length, 7);
  }
  assert.match(evidence.scope, /not App shell/);
  assert.match(evidence.scope, /policies remain pending/);
});
test("P36 approved mobile filter capture and production imports unchanged; new desktop filter styles only live in review CSS", () => {
  assert.equal(
    hash(readFileSync("output/playwright/p36-fields-review/composition-filters-default-390.png")),
    "1bdc3c39fdc4f85483db1ca9a6d8fb2f24d8000321a118e976515029c9eb154b",
  );
  for (const source of [
    file,
    "apps/web/src/main.ts",
    "apps/web/src/components/OrganizationAdminCenter.vue",
  ])
    assert.equal(read(source).includes("token-page-preview"), false);
  assert.match(
    read("design-plans/ui-phase-2-2026-09-07/implementation/token-page-preview.css"),
    /@media \(min-width: 761px\) \{\s*\.p36-page-preview #app \.org-token-filters-c/,
  );
});
