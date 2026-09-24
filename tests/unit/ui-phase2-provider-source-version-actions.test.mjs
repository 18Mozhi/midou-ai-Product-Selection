import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import { versionActionCopy } from "../../scripts/lib/ui-phase2-provider-source-version-actions-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  parent = "apps/web/src/components/ProviderSourceCenter.vue",
  dialog = "apps/web/src/components/ProviderSourceVersionHistoryDialog.vue",
  dialogHost = "apps/web/src/components/ProviderSourceConfigurationDialog.vue",
  composable = "apps/web/src/composables/useProviderSourceConfigurationVersions.ts",
  root = "output/playwright/p48-source-version-actions-review";

const compile = (source, filename, id) => {
  const parsed = parse(source);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id });
  assert.deepEqual(
    compileTemplate({ source: parsed.descriptor.template.content, filename, id }).errors,
    [],
  );
};

test("P48 configuration history and rollback compile with their extracted operation owner", () => {
  const parentSource = read(parent),
    dialogSource = read(dialog),
    dialogHostSource = read(dialogHost),
    composableSource = read(composable);
  compile(parentSource, parent, "p48-version-actions-parent");
  compile(dialogSource, dialog, "p48-version-actions-dialog");
  compile(dialogHostSource, dialogHost, "p48-version-actions-host");
  for (const marker of [
    "configuration/versions",
    "configuration/rollbacks",
    "expected_version: expectedVersion",
    "versionWriteConfirmed.value = true",
    "不会再次提交回滚，只进行安全读取。",
    "本窗仍显示操作前历史，不会把旧内容当作最新结果。",
    "versionOwnership += 1",
  ]) {
    assert.ok(composableSource.includes(marker), marker);
  }
  assert.match(dialogHostSource, /<ProviderSourceVersionHistoryDialog/);
  assert.match(parentSource, /useProviderSourceConfigurationVersions/);
  assert.match(parentSource, /@rollback="rollbackConfiguration"/);
  assert.match(dialogSource, /@click="\$emit\('retryVersions'\)"/);
  assert.match(dialogSource, /rollbackReason\.trim\(\)\.length < 2/);
});

test("P48 version-action copy separates write outcome from reread outcome", () => {
  assert.equal(versionActionCopy.success.title, "已生成新的当前版本");
  assert.equal(versionActionCopy.conflict.description.startsWith("配置没有修改。"), true);
  assert.equal(versionActionCopy.forbidden.title, "当前权限还不能恢复配置");
  assert.equal(versionActionCopy.failed.title, "尚未确认生成新版本");
  assert.ok(versionActionCopy.syncFailed.description.includes("不会把旧内容当作最新结果"));
  const versionOwner = read(composable);
  assert.ok(versionOwner.includes("return true;"));
  assert.ok(versionOwner.includes("return false;"));
  assert.ok(versionOwner.includes("onBeforeUnmount"));
});

test("P48 version-action CSS is isolated and keeps explicit state and focus affordances", () => {
  const css = postcss.parse(
    read(
      "design-plans/ui-phase-2-2026-09-07/implementation/provider-source-version-actions-preview.css",
    ),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.ok(selector.includes("body.p48-source-version-actions-review"), selector);
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes('data-stage="success"'));
  assert.ok(text.includes('data-stage="conflict"'));
  assert.ok(text.includes('data-stage="forbidden"'));
  assert.ok(text.includes('data-stage="failed"'));
  assert.ok(text.includes("min-height: 44px"));
  assert.ok(text.includes("@media (max-width: 760px)"));
  assert.ok(text.includes("@media (forced-colors: active)"));
});

test("P48 version-action evidence binds write, reread, recovery, and every image", () => {
  const evidenceSource = read(`${root}/evidence.json`),
    evidence = JSON.parse(evidenceSource);
  assert.equal(
    hash(evidenceSource),
    "925f234ac784aa50eea004005dbe5bfef73e03ef8ef93f2209638fb8ff853166",
    "archived P48 version-action packet must remain immutable",
  );
  assert.equal(evidence.kind, "P48-SOURCE-VERSION-ACTIONS-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.writesInterceptedLocally, true);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 32);
  assert.equal(evidence.screenshots.length, 52);
  assert.ok(Object.keys(evidence.sourceHashes).length >= 60);
  for (const [file, expected] of Object.entries(evidence.sourceHashes)) {
    assert.match(expected, /^[a-f0-9]{64}$/i, file);
    assert.match(file, /\.(vue|ts|css|html|json|js|mjs)$/i, file);
  }
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
    assert.equal(value("no duplicate page message"), 0);
    assert.equal(value("no horizontal overflow"), true);
    assert.equal(value("background remains inert"), true);
    assert.equal(value("44px action feedback controls"), true);
    assert.equal(value("tab loop stays in dialog"), true);
    assert.equal(value("escape restores trigger"), true);
    assert.equal(value("background inert cleared"), 0);
    assert.equal(value("rollback calls"), run.scene === "initial-read-failed" ? 0 : 1);
    assert.equal(value("rollback requests are POST"), true);
    assert.equal(value("GET requests have no bodies"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.scene !== "initial-read-failed") {
      assert.deepEqual(value("rollback body"), {
        target_version: 2,
        expected_version: 3,
        reason: "恢复稳定采集设置",
      });
      assert.equal(value("rollback idempotency key"), true);
    }
  }
});
