import test from "node:test";
import { acceptanceHistoricalCapture } from "../../scripts/lib/ui-phase2-acceptance-historical-capture.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  acceptanceReadStateCopy,
  previewAlibaba1688AcceptanceReadStates,
} from "../../scripts/lib/ui-phase2-1688-acceptance-read-states-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/Alibaba1688AcceptanceCenter.vue",
  cssFile =
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-read-states-preview.css",
  root = "output/playwright/p49-acceptance-read-states-review";

test("P49 read-state review transforms the actual Vue page and compiles", () => {
  const source = read(component),
    review = previewAlibaba1688AcceptanceReadStates(source),
    parsed = parse(review);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p49-read-states" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p49-read-states",
    }).errors,
    [],
  );
  for (const marker of [
    "p49-read__state",
    "p49-read__notice",
    "查看服务提示",
    "仍显示上次读取的启用条件",
    "本次失败不会启用或停用来源",
  ]) {
    assert.ok(review.includes(marker), marker);
    assert.equal(source.includes(marker), false, `production must not contain ${marker}`);
  }
});

test("P49 read-state messages are factual, actionable, and gentle", () => {
  assert.deepEqual(acceptanceReadStateCopy, {
    loading: "正在核对启用条件",
    error: "这次没有读到启用条件",
    forbidden: "当前无法查看启用条件",
    expired: "登录状态已失效",
    preserved: "仍显示上次读取的启用条件",
  });
  const review = previewAlibaba1688AcceptanceReadStates(read(component));
  for (const marker of [
    "当前账号还没有查看此页面的权限",
    "返回平台概览继续处理其他工作",
    "重新登录后可以返回此页继续检查",
    "重新读取",
    "重新刷新",
  ])
    assert.ok(review.includes(marker), marker);
  assert.equal(review.includes("权限拒绝"), false);
});

test("P49 read-state CSS is isolated, responsive, and keyboard compatible", () => {
  const css = postcss.parse(read(cssFile));
  css.walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.ok(selector.includes("body.p49-acceptance-read-review"), selector);
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes('[data-kind="error"]'));
  assert.ok(text.includes('[data-tone="danger"]'));
  assert.ok(text.includes("@media (max-width: 760px)"));
  assert.ok(text.includes("@media (forced-colors: active)"));
});

test("P49 historical read-state evidence binds retries, recovery, and images", () => {
  const historical = acceptanceHistoricalCapture("read-states");
  assert.equal(read(`${root}/evidence.json`), historical.manifest);
  const evidence = JSON.parse(historical.manifest);
  assert.equal(evidence.kind, "P49-ACCEPTANCE-READ-STATES-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.layoutMechanicalScan.status, "not_run");
  assert.equal(evidence.runs.length, 24);
  assert.equal(evidence.screenshots.length, 27);
  assert.ok(Object.keys(evidence.sourceHashes).length >= 45);
  for (const [file, expected] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(historical.source(file)), expected, file);
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
    assert.equal(value("no horizontal overflow"), true);
    assert.ok(value("44px representative controls").every(Boolean));
    assert.equal(value("no write requests"), 0);
    assert.equal(value("no request bodies"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    assert.equal(
      value("expected acceptance GET count"),
      run.mode === "error" ? 3 : run.mode === "preserved" ? 4 : run.mode === "refreshing" ? 2 : 1,
    );
    if (run.mode === "refreshing") assert.equal(value("old verdict retained while refreshing"), 1);
    if (run.mode === "preserved") {
      assert.equal(value("old verdict retained after failure"), 1);
      assert.equal(value("preserved state ready"), "ready");
    }
  }
});
