import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  acceptanceLifecycleCopy,
  previewAlibaba1688AcceptanceLifecycle,
} from "../../scripts/lib/ui-phase2-1688-acceptance-lifecycle-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/Alibaba1688AcceptanceCenter.vue",
  cssFile =
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-lifecycle-preview.css",
  root = "output/playwright/p49-acceptance-lifecycle-review";

test("P49 lifecycle review adds cache ownership to the actual Vue surface and compiles", () => {
  const source = read(component),
    review = previewAlibaba1688AcceptanceLifecycle(source),
    parsed = parse(review);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p49-lifecycle" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p49-lifecycle",
    }).errors,
    [],
  );
  assert.equal(source.includes("onActivated"), false);
  assert.equal(source.includes("onDeactivated"), false);
  for (const marker of [
    "onActivated",
    "onDeactivated",
    "acceptanceReadSequence",
    "scopeReadSequence",
    "ownsAcceptanceRead",
    "ownsScopeRead",
    "p49-lifecycle__notice",
  ])
    assert.ok(review.includes(marker), marker);
});

test("P49 lifecycle copy explains preserved facts and stale-response boundary", () => {
  assert.deepEqual(acceptanceLifecycleCopy, {
    title: "正在重新读取最新启用条件",
    boundary: "读取完成前暂时保留上次成功事实；迟到的旧响应不会覆盖本次结果。",
  });
  const review = previewAlibaba1688AcceptanceLifecycle(read(component));
  assert.ok(review.includes("activeController?.abort()"));
  assert.ok(review.includes("scopeController?.abort()"));
  assert.ok(review.includes("controller.signal.aborted"));
  assert.ok(review.includes("if (!lifecycleActive.value || refreshing.value) return"));
  assert.ok(review.includes("if (!lifecycleActive.value || scopeLoading.value) return"));
  assert.equal(review.includes("scheduleAcceptanceRun();"), false);
});

test("P49 lifecycle CSS is isolated, token-based, and responsive", () => {
  const css = postcss.parse(read(cssFile));
  css.walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.ok(selector.includes("body.p49-acceptance-lifecycle-review"), selector);
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes("var(--so-info-soft)"));
  assert.ok(text.includes("@media (max-width: 760px)"));
  assert.ok(text.includes("@media (forced-colors: active)"));
  assert.equal(/#[0-9a-f]{3,8}\b/i.test(text), false);
  assert.equal(text.includes("outline: none"), false);
});

test("P49 lifecycle evidence binds baseline, proposed return, and images", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P49-ACCEPTANCE-LIFECYCLE-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.baselineRuns.length, 2);
  assert.equal(evidence.proposedRuns.length, 2);
  assert.equal(evidence.screenshots.length, 4);
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
  for (const run of evidence.baselineRuns) {
    const value = (name) => run.checks.find((check) => check.name === name)?.actual;
    assert.equal(value("baseline acceptance reads after return"), 1);
    assert.equal(value("baseline membership reads after return"), 1);
    assert.equal(value("baseline workspace reads after return"), 1);
  }
  for (const run of evidence.proposedRuns) {
    const value = (name) => run.checks.find((check) => check.name === name)?.actual;
    assert.equal(value("old acceptance request aborted"), true);
    assert.equal(value("old workspace request aborted"), true);
    assert.equal(value("fresh acceptance read on return"), 3);
    assert.equal(value("fresh membership read on return"), 2);
    assert.equal(value("fresh first-org workspace read on return"), 2);
    assert.equal(value("no acceptance writes"), 0);
    assert.deepEqual(value("no page runtime errors"), []);
  }
});
