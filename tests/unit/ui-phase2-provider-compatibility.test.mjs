import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  compatibilityCopy,
  previewProviderCompatibilityDialog,
} from "../../scripts/lib/ui-phase2-provider-compatibility-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/ProviderCompatibilityMatrixDialog.vue",
  root = "output/playwright/p48-compatibility-review";

test("P48 compatibility review transforms the actual dialog and still compiles", () => {
  const source = read(component),
    review = previewProviderCompatibilityDialog(source),
    parsed = parse(review);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p48-compatibility" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p48-compatibility",
    }).errors,
    [],
  );
  for (const marker of [
    "p48-compatibility-modal",
    "p48-compatibility-summary",
    "p48-compatibility-ledger",
    "compatibilityFocusable",
    "setCompatibilityBackgroundInert",
    "handleCompatibilityKeydown",
  ]) {
    assert.ok(review.includes(marker), marker);
    assert.equal(source.includes(marker), false, `production must not contain ${marker}`);
  }
});

test("P48 compatibility copy preserves evidence privacy and status boundaries", () => {
  const review = previewProviderCompatibilityDialog(read(component));
  assert.equal(
    compatibilityCopy.description,
    "比较保留期内的页面版本与对应解析器观测，只显示指纹和结果，不读取页面内容。",
  );
  assert.equal(
    compatibilityCopy.boundary,
    "矩阵只反映已留存证据的历史观测，不会自动改变来源状态。",
  );
  for (const marker of [
    "页面版本与解析结果",
    "完整指纹",
    "页面原文不会在此显示",
    "解析不兼容",
    "结果不一致",
    "待验证",
    "采集程序版本未提供",
    "系统只使用已留存的 DOM 或 HTML 证据生成矩阵",
  ])
    assert.ok(review.includes(marker), marker);
  assert.ok(review.includes("fingerprint(row.page_version_sha256)"));
  assert.ok(review.includes("row.page_version_sha256"));
  assert.equal(review.includes("自动启用"), false);
});

test("P48 compatibility CSS is isolated, responsive, and keyboard-visible", () => {
  const css = postcss.parse(
    read("design-plans/ui-phase-2-2026-09-07/implementation/provider-compatibility-preview.css"),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.ok(selector.includes("body.p48-compatibility-review"), selector);
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes('data-status="compatible"'));
  assert.ok(text.includes('data-status="incompatible"'));
  assert.ok(text.includes('data-status="mixed"'));
  assert.ok(text.includes(":focus-visible"));
  assert.ok(text.includes("min-height: 44px"));
  assert.ok(text.includes("@media (max-width: 760px)"));
  assert.ok(text.includes("@media (forced-colors: active)"));
  assert.ok(text.includes(".p48-compatibility-cell-label"));
});

test("P48 compatibility evidence binds all read states, modal behavior, and images", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P48-COMPATIBILITY-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.ok(evidence.fixtureNotice.includes("synthetic review fixtures"));
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.layoutMechanicalScan.status, "not_run");
  assert.ok(evidence.layoutMechanicalScan.substituteChecks.length >= 5);
  assert.equal(evidence.runs.length, 40);
  assert.equal(evidence.screenshots.length, 42);
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
    assert.equal(run.fixtureKind, "synthetic-review-fixture");
    assert.equal(value("dialog title focused"), true);
    assert.equal(value("background inert"), true);
    assert.equal(value("no horizontal overflow"), true);
    assert.equal(value("dialog has no horizontal scroll"), true);
    assert.ok(value("44px representative controls").every(Boolean));
    assert.equal(value("tab loop stays in dialog"), true);
    assert.equal(value("escape restores trigger"), true);
    assert.equal(value("background inert cleared"), 0);
    assert.equal(value("one source GET"), 1);
    assert.equal(value("expected adapter GET count"), run.scene === "service-failed" ? 3 : 1);
    assert.equal(value("no write requests"), 0);
    assert.equal(value("no request bodies"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.scene === "loading") assert.equal(value("ledger hidden while loading"), 0);
    if (["summary-missing", "service-failed"].includes(run.scene))
      assert.equal(value("ledger hidden on error"), 0);
    if (run.scene === "empty") assert.equal(value("ledger hidden when empty"), 0);
    if (run.scene === "all-statuses" && run.width <= 760)
      assert.equal(value("expanded fingerprint has no horizontal scroll"), true);
    if (!["loading", "empty", "summary-missing", "service-failed"].includes(run.scene))
      assert.ok(value("matrix row count") >= 1);
  }
});
