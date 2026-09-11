import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  configurationReturnCopy,
  previewProviderSourceConfigurationReturnDialog,
  previewProviderSourceConfigurationReturnParent,
} from "../../scripts/lib/ui-phase2-provider-source-configuration-return-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  parent = "apps/web/src/components/ProviderSourceCenter.vue",
  dialog = "apps/web/src/components/ProviderSourceConfigurationDialog.vue",
  root = "output/playwright/p48-source-configuration-return-review";

const compile = (source, filename, id) => {
  const parsed = parse(source);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id });
  assert.deepEqual(
    compileTemplate({ source: parsed.descriptor.template.content, filename, id }).errors,
    [],
  );
};

test("P48 configuration-return review transforms the actual parent and dialog", () => {
  const parentSource = read(parent),
    dialogSource = read(dialog),
    parentReview = previewProviderSourceConfigurationReturnParent(parentSource),
    dialogReview = previewProviderSourceConfigurationReturnDialog(dialogSource);
  compile(parentReview, parent, "p48-source-configuration-return-parent");
  compile(dialogReview, dialog, "p48-source-configuration-return-dialog");
  for (const marker of [
    "configurationReturnState",
    "refreshAfterConfigurationResult",
    "acknowledgeConfigurationSave",
    "p48-source-configuration-return",
    "重新读取来源目录",
  ]) {
    assert.ok(parentReview.includes(marker), marker);
    assert.equal(parentSource.includes(marker), false, `production parent must not contain ${marker}`);
  }
  assert.ok(dialogReview.includes('emit("acknowledge")'));
  assert.equal(dialogSource.includes('emit("acknowledge")'), false);
});

test("P48 configuration-return copy preserves saved, partial, and conflict facts", () => {
  assert.deepEqual(configurationReturnCopy.saved, {
    refreshing: "设置已保存，正在更新来源目录",
    success: "设置已保存，来源目录已更新",
    failed: "设置已保存，但来源目录尚未更新",
  });
  assert.equal(configurationReturnCopy.partial.failed, "停用配置已保存，但来源目录尚未更新");
  assert.equal(configurationReturnCopy.conflict.success, "已读取最新配置");
  const parentReview = previewProviderSourceConfigurationReturnParent(read(parent));
  assert.ok(parentReview.includes("刚才的写入不会撤销"));
  assert.ok(parentReview.includes("不会把旧内容当作最新配置"));
  assert.ok(parentReview.includes("return true"));
  assert.ok(parentReview.includes("return false"));
});

test("P48 configuration-return CSS is isolated and keeps explicit recovery focus", () => {
  const css = postcss.parse(
    read(
      "design-plans/ui-phase-2-2026-09-07/implementation/provider-source-configuration-return-preview.css",
    ),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.ok(selector.includes("body.p48-source-configuration-return-review"), selector);
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes('[data-state="success"]'));
  assert.ok(text.includes('[data-state="failed"]'));
  assert.ok(text.includes(":focus-visible"));
  assert.ok(text.includes("min-height: 44px"));
  assert.ok(text.includes("@media (forced-colors: active)"));
});

test("P48 configuration-return evidence binds acknowledgement, reread, recovery, and images", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P48-SOURCE-CONFIGURATION-RETURN-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.mockedWritesOnly, true);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 32);
  assert.equal(
    evidence.runs.reduce((sum, run) => sum + run.checks.length, 0),
    456,
  );
  assert.equal(evidence.screenshots.length, 35);
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
    assert.equal(value("capture state"), run.capture);
    assert.equal(value("return outcome"), run.outcome);
    assert.equal(value("final state"), run.final);
    assert.equal(value("dialog closed before directory result"), 0);
    assert.equal(value("one source remains visible"), 1);
    assert.equal(value("global message suppressed"), 0);
    assert.equal(value("no horizontal overflow"), true);
    assert.equal(value("all writes have idempotency keys"), true);
    assert.equal(value("catalog read count"), run.scene === "saved-retry" ? 3 : 2);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.outcome === "partial") {
      assert.equal(value("partial has one disabled PUT"), "disabled");
      assert.equal(value("partial has one health check"), 1);
    } else assert.equal(value("no health check"), 0);
  }
});
