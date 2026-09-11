import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  acceptanceActionCopy,
  previewAlibaba1688AcceptanceActions,
} from "../../scripts/lib/ui-phase2-1688-acceptance-actions-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/Alibaba1688AcceptanceCenter.vue",
  cssFile = "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-actions-preview.css",
  root = "output/playwright/p49-acceptance-actions-review";

test("P49 action review transforms the actual Vue form and compiles", () => {
  const source = read(component),
    review = previewAlibaba1688AcceptanceActions(source),
    parsed = parse(review);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p49-actions" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p49-actions",
    }).errors,
    [],
  );
  for (const marker of [
    "p49-action__feedback",
    "p49-action__result",
    "p49-run-requirements",
    "p49-scope-message",
    "p49-submit-message",
  ]) {
    assert.ok(review.includes(marker), marker);
    assert.equal(source.includes(marker), false, `production must not contain ${marker}`);
  }
});

test("P49 action feedback preserves task, scope, and enablement boundaries", () => {
  assert.deepEqual(acceptanceActionCopy, {
    requirements: "选择活动组织、工作区并填写验收关键词后可以提交。",
    scopeFailure: "当前还不能选择完整执行范围",
    submitFailure: "本次验收没有提交",
    taskCreated: "验收任务已进入队列",
    taskBoundary: "任务已经创建，但这不代表运行完成或来源已启用。",
    rereadFailure: "任务已提交，但最新检查结果没有刷新",
    rereadPreserved: "最新检查结果未刷新",
  });
  const review = previewAlibaba1688AcceptanceActions(read(component));
  for (const marker of [
    'maxlength="200"',
    "acceptance_run",
    "loadExecutionScopes",
    "正在读取可用执行范围",
    "正在创建一次受控验收运行",
    "查看任务编号",
    "下方仍显示提交前成功读取的启用条件",
  ])
    assert.ok(review.includes(marker), marker);
  assert.equal(review.includes("任务已完成"), false);
  assert.equal(review.includes("来源已自动启用"), false);
});

test("P49 action CSS is isolated, responsive, and does not suppress focus", () => {
  const css = postcss.parse(read(cssFile));
  css.walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.ok(selector.includes("body.p49-acceptance-actions-review"), selector);
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes('[aria-invalid="true"]'));
  assert.ok(text.includes("@media (max-width: 760px)"));
  assert.ok(text.includes("@media (forced-colors: active)"));
  assert.equal(text.includes("outline: none"), false);
});

test("P49 action evidence binds scope, POST, feedback, and images", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P49-ACCEPTANCE-ACTIONS-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.layoutMechanicalScan.status, "not_run");
  assert.equal(evidence.runs.length, 52);
  assert.equal(evidence.screenshots.length, 54);
  assert.ok(Object.keys(evidence.sourceHashes).length >= 45);
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
    assert.equal(value("no horizontal overflow"), true);
    assert.ok(value("44px representative controls").every(Boolean));
    assert.deepEqual(value("no unknown network"), []);
    assert.deepEqual(value("no page runtime errors"), []);
    assert.equal(value("no unexpected writes"), value("expected acceptance POST count"));
    if (value("expected acceptance POST count") === 1) {
      assert.deepEqual(value("exact acceptance body"), {
        organization_id: "00000000-0000-4000-8000-000000000b72",
        workspace_id: "00000000-0000-4000-8000-000000000b73",
        query: "桌面灯",
        acceptance_run: true,
      });
      assert.equal(value("idempotency key present"), true);
    }
    if (run.mode === "succeeded")
      assert.equal(value("dual reread warning absent on clean success"), 0);
    if (["submit-failed", "submit-forbidden", "submit-expired"].includes(run.mode))
      assert.equal(value("task result absent after failed POST"), 0);
  }
});
