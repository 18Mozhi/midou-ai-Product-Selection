import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/CredentialAssetCenter.vue",
  cssFile = "design-plans/ui-phase-2-2026-09-07/implementation/credential-assets-page-preview.css",
  root = "output/playwright/p50-credential-page-review";

test("P50 page review keeps the actual credential component and contracts", () => {
  const source = read(component),
    parsed = parse(source);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p50-credential-page" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p50-credential-page",
    }).errors,
    [],
  );
  for (const preserved of [
    'class="credential-center"',
    'class="credential-editor login-editor"',
    "<dialog",
    'ref="editorDialog"',
    'id="credential-login-editor-title"',
    '@cancel="handleEditorCancel"',
    '@submit.prevent="saveLogin"',
    '@click="openLogin()"',
    '@click="openProfile"',
    '@click="openAsset"',
    'type="password"',
    'autocomplete="new-password"',
    "Promise.all([",
    '"/platform/credential-assets"',
    '"/platform/crawler-profiles"',
    '"/platform/credential-provider-options"',
  ])
    assert.ok(source.includes(preserved), preserved);
});

test("P50 review CSS is isolated and rejects the old gradient-card direction", () => {
  const css = postcss.parse(read(cssFile));
  css.walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.ok(selector.includes("body.p50-credential-page-review"), selector);
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes("--p50-blue"));
  assert.ok(text.includes("@media (max-width: 760px)"));
  assert.ok(text.includes("@media (forced-colors: active)"));
  assert.equal(text.includes("linear-gradient"), false);
  assert.equal(text.includes("transition: all"), false);
  assert.equal(text.includes("outline: none"), false);
});

test("P50 actual Vue evidence binds the safe default page and login editor", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P50-CREDENTIAL-PAGE-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 6);
  assert.equal(evidence.screenshots.length, 12);
  assert.ok(Object.keys(evidence.sourceHashes).length >= 50);
  for (const [file, expected] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...evidence.screenshots.map((shot) => shot.file)].sort(),
  );
  for (const shot of evidence.screenshots) {
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256, shot.file);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth, shot.file);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight, shot.file);
  }
  for (const run of evidence.runs) {
    const value = (name) => run.checks.find((check) => check.name === name)?.actual;
    assert.equal(value("three metric facts"), 3);
    assert.equal(value("one credential asset"), 1);
    assert.equal(value("one runtime profile"), 1);
    assert.equal(value("two authenticated sources"), 2);
    assert.equal(value("no secret values in rendered text"), true);
    assert.equal(value("three credential data GETs"), 3);
    assert.equal(value("all requests are GET without bodies"), true);
    assert.deepEqual(value("three import modes"), [
      "上传 Cookie 文件",
      "从当前浏览器读取",
      "完整浏览器档案",
    ]);
    assert.equal(value("file input exists but no file selected"), 1);
    assert.equal(value("no password field in login editor"), 0);
    assert.equal(value("save disabled before material"), true);
    assert.equal(value("opening editor adds no request"), 3);
    assert.equal(value("page has no horizontal overflow"), true);
    assert.equal(value("editor has no horizontal overflow"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.mode === "review") {
      assert.equal(
        value("header action computed styles").container.backgroundColor,
        "rgba(0, 0, 0, 0)",
      );
      assert.equal(value("header action computed styles").container.backgroundImage, "none");
      assert.equal(value("login action is44"), true);
      assert.equal(value("login action is focal white"), true);
      assert.equal(value("visible blue keyboard focus"), true);
      for (const control of ["source", "mode", "cancel", "save"])
        assert.equal(value(`editor target44 ${control}`), true);
      assert.equal(value("editor is single column on mobile"), run.width <= 760 ? 1 : 2);
    }
  }
});
