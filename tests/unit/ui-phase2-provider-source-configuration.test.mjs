import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  configurationDialogCopy,
  previewProviderSourceConfiguration,
} from "../../scripts/lib/ui-phase2-provider-source-configuration-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/ProviderSourceConfigurationDialog.vue",
  root = "output/playwright/p48-source-configuration-review";

test("P48 configuration review transforms the actual dialog and still compiles", () => {
  const source = read(component),
    review = previewProviderSourceConfiguration(source),
    parsed = parse(review);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p48-source-configuration" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p48-source-configuration",
    }).errors,
    [],
  );
  for (const marker of [
    "p48-source-configuration-modal",
    "p48-source-configuration-identity",
    "p48-source-configuration-fields",
    "p48-source-configuration-preview",
    "handleEditKeydown",
    "setEditBackgroundInert",
    "closeEditDialog",
  ]) {
    assert.ok(review.includes(marker), marker);
    assert.equal(source.includes(marker), false, `production must not contain ${marker}`);
  }
});

test("P48 configuration review preserves all five factual inputs and smoke consequence", () => {
  const review = previewProviderSourceConfiguration(read(component));
  for (const marker of [
    'min="1"',
    'max="10080"',
    'min="1000"',
    'max="120000"',
    'min="0"',
    'max="10"',
    '<option value="enabled">启用</option>',
    '<option value="disabled">停用</option>',
    'minlength="2"',
    'maxlength="500"',
    "刚才保存的停用配置仍会保留",
    "烟测并启用",
  ])
    assert.ok(review.includes(marker), marker);
  assert.equal(configurationDialogCopy.reasonHelp, "填写 2–500 个字符，说明这次调整的原因。");
});

test("P48 configuration CSS is isolated, responsive, and keyboard-visible", () => {
  const css = postcss.parse(
    read(
      "design-plans/ui-phase-2-2026-09-07/implementation/provider-source-configuration-preview.css",
    ),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.ok(selector.includes("body.p48-source-configuration-review"), selector);
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes(":focus-visible"));
  assert.ok(text.includes("min-height: 44px"));
  assert.ok(text.includes("@media (max-width: 760px)"));
  assert.ok(text.includes("@media (forced-colors: active)"));
});

test("P48 configuration evidence binds fields, modal behavior, network, and every image", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P48-SOURCE-CONFIGURATION-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 8);
  assert.equal(
    evidence.runs.reduce((sum, run) => sum + run.checks.length, 0),
    120,
  );
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
    assert.equal(value("dialog title focused"), true);
    assert.equal(value("background inert"), true);
    assert.equal(value("form validity"), true);
    assert.equal(value("no horizontal overflow"), true);
    assert.deepEqual(value("44px representative controls"), [true, true, true]);
    assert.equal(value("tab loop stays in dialog"), true);
    assert.equal(value("escape restores trigger"), true);
    assert.equal(value("background inert cleared"), 0);
    assert.equal(value("one source GET"), 1);
    assert.equal(value("no write requests"), 0);
    assert.equal(value("no request bodies"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    assert.equal(value("smoke notice visibility"), run.scene === "public-smoke-enable");
  }
});
