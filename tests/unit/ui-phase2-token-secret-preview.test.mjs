import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { assertCaptureSourceRevision } from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";
import { tokenSecretPreview } from "../../scripts/lib/ui-phase2-token-secret-preview.mjs";

const component = "apps/web/src/components/OrganizationTokenPanel.vue";
const folder = "output/playwright/p36-secret-vue-preview";
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const original = read(component),
  transformed = tokenSecretPreview(original);
const evidence = JSON.parse(read(`${folder}/evidence.json`));
function controls(source) {
  const result = [];
  const walk = (node) => {
    if (node.type === 1) {
      if (["input", "textarea", "select", "button"].includes(node.tag))
        result.push(
          JSON.stringify([
            node.tag,
            node.props.map((prop) => prop.loc.source),
            node.children.map((child) => child.loc.source),
          ]),
        );
      for (const prop of node.props)
        if (prop.type === 7 && prop.arg?.content !== "data-copy-state")
          result.push(prop.loc.source);
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(baseParse(parse(source).descriptor.template.content));
  return result.sort();
}
test("P36 secret preview preserves complete script, original directives and native actions", () => {
  assert.equal(
    parse(original).descriptor.scriptSetup.content,
    parse(transformed).descriptor.scriptSetup.content,
  );
  assert.deepEqual(controls(original), controls(transformed));
  assert.equal(parse(transformed).errors.length, 0);
  assert.equal(original.includes("p36-secret-c"), false);
  assert.ok(transformed.includes("p36-secret-c"));
  assert.throws(() =>
    tokenSecretPreview(original.replace('class="org-token-secret"', 'class="unknown"')),
  );
});
test("P36 secret evidence binds current originals and review template, without relabeling approval", () => {
  assert.equal(evidence.approval, "pending-user-review");
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.checks.length, 160);
  assert.equal(evidence.runs.length, 4);
  for (const [file, sha] of Object.entries(evidence.sourceHashes))
    assertCaptureSourceRevision(file, read(file), sha);
  // This is an immutable capture-time transform hash; its exact helper revision is pinned above.
  assert.match(evidence.transformedHashes[component], /^[a-f0-9]{64}$/);
  const states = [
    "parent-refreshing",
    "default",
    "copy-focus",
    "saved-focus",
    "copy-hover",
    "copy-pressed",
    "saved-hover",
    "saved-pressed",
    "copy-pending",
    "copied",
    "failed",
    "replacement-long",
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
test("P36 actual parent creation, clipboard states and dismissal retain bounded contracts", () => {
  for (const run of evidence.runs) {
    const names = evidence.checks
      .filter((check) => check.width === run.width)
      .map((check) => check.name);
    for (const name of [
      "no secret before creation",
      "actual parent pending reread",
      "original secret actions remain enabled during reread",
      "blue rail and white content",
      "keyboard reaches copy",
      "blue keyboard focus",
      "keyboard proceeds to saved",
      "pending feedback remains original idle",
      "real success wording",
      "real failure wording",
      "manual selection retains exact text",
      "long value completely selectable",
      "old completion never marks replacement",
      "actual parent dismissal remains cleared",
      "no external or unexpected API",
      "no browser errors",
      "no storage",
    ])
      assert.ok(names.includes(name), name);
    const posts = run.requests.filter((request) => request.method === "POST");
    assert.equal(posts.length, 2);
    for (const post of posts) {
      assert.equal(post.path, "/api/v1/org/admin/tokens");
      assert.equal(post.idempotency, true);
      assert.deepEqual(post.body, {
        name: "明文审核测试",
        scopes: ["task:read"],
        ttl_days: 90,
        reason: "界面审核，不创建真实凭据",
      });
    }
    assert.equal(run.requests.filter((request) => request.method === "GET").length, 6);
    assert.ok(
      run.requests
        .filter((request) => request.method === "GET")
        .every((request) =>
          ["/api/v1/org/admin/summary", "/api/v1/org/admin/tokens"].includes(request.path),
        ),
    );
  }
});
test("P36 existing approved filters, previous source and production imports remain untouched", () => {
  assert.equal(
    hash(readFileSync("output/playwright/p36-fields-review/composition-filters-default-390.png")),
    "1bdc3c39fdc4f85483db1ca9a6d8fb2f24d8000321a118e976515029c9eb154b",
  );
  assertCaptureSourceRevision(
    component,
    original,
    "4713e22a2290042efd2ff180046ee15969acc0205917786aaa3e36e9fea71aa0",
  );
  for (const file of [
    component,
    "apps/web/src/components/OrganizationAdminCenter.vue",
    "apps/web/src/main.ts",
  ])
    assert.equal(read(file).includes("token-secret-preview"), false);
  assert.match(
    evidence.scope,
    /not real authorization, persistence, OS clipboard, App shell, rotation contract or production acceptance/,
  );
});
