import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  previewProviderSourceVersions,
  versionDialogCopy,
} from "../../scripts/lib/ui-phase2-provider-source-versions-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/ProviderSourceConfigurationDialog.vue",
  root = "output/playwright/p48-source-versions-review";

test("P48 source versions review transforms the actual dialog and still compiles", () => {
  const source = read(component),
    review = previewProviderSourceVersions(source),
    parsed = parse(review);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p48-source-versions" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p48-source-versions",
    }).errors,
    [],
  );
  for (const marker of [
    "p48-source-versions-modal",
    "p48-source-versions-identity",
    "p48-source-versions-timeline",
    "handleVersionKeydown",
    "setVersionBackgroundInert",
    "configurationValueText",
  ]) {
    assert.ok(review.includes(marker), marker);
    assert.equal(source.includes(marker), false, `production must not contain ${marker}`);
  }
});

test("P48 source versions copy preserves the immutable rollback and privacy contracts", () => {
  const review = previewProviderSourceVersions(read(component));
  for (const marker of [
    "这里只显示采集频率、超时、重试和启停状态",
    "凭证、Cookie 与受限配置不会进入历史详情",
    'minlength="2"',
    'maxlength="500"',
    "恢复操作会追加新的当前版本，现有历史保持不变",
    "恢复第 ",
    "未设置",
    "毫秒",
  ])
    assert.ok(review.includes(marker), marker);
  assert.equal(
    versionDialogCopy.rollbackHelp,
    "填写 2–500 个字符。恢复会生成新版本，不会删除或覆盖历史。",
  );
});

test("P48 source versions CSS is isolated, responsive, and keyboard-visible", () => {
  const css = postcss.parse(
    read("design-plans/ui-phase-2-2026-09-07/implementation/provider-source-versions-preview.css"),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.ok(selector.includes("body.p48-source-versions-review"), selector);
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes(":focus-visible"));
  assert.ok(text.includes("min-height: 44px"));
  assert.ok(text.includes("@media (max-width: 760px)"));
  assert.ok(text.includes("@media (forced-colors: active)"));
});

test("P48 source versions evidence binds all states, modal behavior, network, and images", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P48-SOURCE-VERSIONS-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 20);
  assert.equal(evidence.screenshots.length, 26);
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
    assert.equal(value("no horizontal overflow"), true);
    assert.deepEqual(
      value("44px representative controls"),
      run.scene === "loading" || run.scene === "empty" ? [true, true] : [true, true, true],
    );
    assert.equal(value("tab loop stays in dialog"), true);
    assert.equal(value("escape restores trigger"), true);
    assert.equal(value("background inert cleared"), 0);
    assert.equal(value("one source GET"), 1);
    assert.equal(value("one versions GET"), 1);
    assert.equal(value("no write requests"), 0);
    assert.equal(value("no request bodies"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.scene === "loading" || run.scene === "empty")
      assert.equal(value("rollback reason hidden"), 0);
    if (run.scene === "reason-required") assert.equal(value("all restore actions disabled"), true);
    if (run.scene === "no-visible-change") assert.equal(value("two no-diff messages"), 2);
  }
});
