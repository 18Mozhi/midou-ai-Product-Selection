import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  configurationSaveCopy,
  previewProviderSourceConfigurationStatesDialog,
  previewProviderSourceConfigurationStatesParent,
} from "../../scripts/lib/ui-phase2-provider-source-configuration-states-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  parent = "apps/web/src/components/ProviderSourceCenter.vue",
  dialog = "apps/web/src/components/ProviderSourceConfigurationDialog.vue",
  root = "output/playwright/p48-source-configuration-states-review";

const compile = (source, filename, id) => {
  const parsed = parse(source);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id });
  assert.deepEqual(
    compileTemplate({ source: parsed.descriptor.template.content, filename, id }).errors,
    [],
  );
};

test("P48 configuration-state review transforms the actual parent and dialog", () => {
  const parentSource = read(parent),
    dialogSource = read(dialog),
    parentReview = previewProviderSourceConfigurationStatesParent(parentSource),
    dialogReview = previewProviderSourceConfigurationStatesDialog(dialogSource);
  compile(parentReview, parent, "p48-source-configuration-states-parent");
  compile(dialogReview, dialog, "p48-source-configuration-states-dialog");
  for (const marker of [
    "configurationSaveStage",
    "setConfigurationSaveFeedback",
    "saving_disabled",
    "smoke_testing",
    "enabling",
  ]) {
    assert.ok(parentReview.includes(marker), marker);
    assert.equal(parentSource.includes(marker), false, `production parent must not contain ${marker}`);
  }
  for (const marker of [
    "p48-source-configuration-save-feedback",
    "saveFeedbackTitle",
    "saveRequestId",
    'aria-live="polite"',
  ]) {
    assert.ok(dialogReview.includes(marker), marker);
    assert.equal(dialogSource.includes(marker), false, `production dialog must not contain ${marker}`);
  }
});

test("P48 configuration-state copy distinguishes writes, smoke, partial save, and conflict", () => {
  assert.equal(configurationSaveCopy.saving.title, "正在保存采集设置");
  assert.equal(configurationSaveCopy.saving_disabled.title, "正在先保存停用配置");
  assert.equal(
    configurationSaveCopy.smoke_testing.title,
    "停用配置已保存，正在进行真实页面烟测",
  );
  assert.equal(configurationSaveCopy.enabling.title, "烟测已通过，正在启用来源");
  assert.equal(configurationSaveCopy.partial.title, "停用配置已保存，来源尚未启用");
  assert.equal(configurationSaveCopy.conflict.title, "配置已经更新，请重新读取");
  const parentReview = previewProviderSourceConfigurationStatesParent(read(parent));
  assert.ok(parentReview.includes("刚才验证过的配置"));
  assert.ok(parentReview.includes("停用配置已经保留"));
  assert.ok(parentReview.includes("其他操作已经产生了新版本"));
  assert.ok(parentReview.includes("formSnapshot"));
});

test("P48 configuration-state CSS is isolated and preserves feedback accessibility", () => {
  const css = postcss.parse(
    read(
      "design-plans/ui-phase-2-2026-09-07/implementation/provider-source-configuration-states-preview.css",
    ),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.ok(selector.includes("body.p48-source-configuration-states-review"), selector);
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes('[data-stage="success"]'));
  assert.ok(text.includes('[data-stage="partial"]'));
  assert.ok(text.includes('[data-stage="failed"]'));
  assert.ok(text.includes('[data-stage="conflict"]'));
  assert.ok(text.includes(":focus-visible"));
  assert.ok(text.includes("min-height: 44px"));
  assert.ok(text.includes("@media (forced-colors: active)"));
});

test("P48 configuration-state evidence binds every state, write order, and image", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P48-SOURCE-CONFIGURATION-STATES-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.mockedWritesOnly, true);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 44);
  assert.equal(
    evidence.runs.reduce((sum, run) => sum + run.checks.length, 0),
    632,
  );
  assert.equal(evidence.screenshots.length, 49);
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
    assert.equal(value("capture stage"), run.capture);
    assert.equal(value("final stage"), run.final);
    assert.equal(value("dialog remains until acknowledged"), true);
    assert.equal(value("all writes have idempotency keys"), true);
    assert.equal(value("one catalog GET"), 1);
    assert.equal(value("no catalog reread before acknowledgement"), 1);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (["saving", "saving_disabled", "smoke_testing", "enabling"].includes(run.capture)) {
      assert.equal(value("feedback busy"), "true");
      assert.equal(value("fields disabled while progressing"), true);
    } else {
      assert.equal(value("feedback busy"), "false");
      assert.equal(value("fields disabled while progressing"), false);
    }
    if (run.scene.startsWith("smoke-") || ["enabling", "enable-failure"].includes(run.scene))
      assert.equal(value("one health check"), 1);
  }
});
