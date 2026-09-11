import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  acceptancePageCopy,
  previewAlibaba1688AcceptanceCenter,
} from "../../scripts/lib/ui-phase2-1688-acceptance-page-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/Alibaba1688AcceptanceCenter.vue",
  cssFile = "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-page-preview.css",
  root = "output/playwright/p49-acceptance-page-review";

test("P49 acceptance review transforms the actual Vue page and compiles", () => {
  const source = read(component),
    review = previewAlibaba1688AcceptanceCenter(source),
    parsed = parse(review);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p49-acceptance" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p49-acceptance",
    }).errors,
    [],
  );
  for (const marker of [
    "p49-acceptance__layout",
    "p49-acceptance__gates",
    "p49-acceptance__diagnostics",
    "逐项核对三类证据",
    "三项必须全部通过；它们不是顺序步骤",
  ]) {
    assert.ok(review.includes(marker), marker);
    assert.equal(source.includes(marker), false, `production must not contain ${marker}`);
  }
});

test("P49 acceptance copy preserves privacy and factual boundaries", () => {
  assert.equal(
    acceptancePageCopy.privacy,
    "核对真实浏览器运行、固定样本回放与审批结论；不展示 Cookie 或账号秘密。",
  );
  assert.equal(
    acceptancePageCopy.independence,
    "三项门禁与来源启用互相独立；系统不会自动启用或停用来源。",
  );
  assert.equal(acceptancePageCopy.coverage, "诊断证据，不计入三项启用门禁。");
  const review = previewAlibaba1688AcceptanceCenter(read(component));
  for (const marker of [
    'maxlength="200"',
    "acceptance_run",
    "配置或续期登录档案",
    "定位 1688 固定样本",
    "发起登录验收运行",
    "技术详情",
  ])
    assert.ok(review.includes(marker), marker);
  assert.equal(review.includes("自动启用来源"), false);
});

test("P49 acceptance CSS is isolated, responsive, and keyboard visible", () => {
  const css = postcss.parse(read(cssFile));
  css.walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.ok(selector.includes("body.p49-acceptance-review"), selector);
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes(":focus-visible"));
  assert.ok(text.includes("min-height: 44px"));
  assert.ok(text.includes("font-size: 16px"));
  assert.ok(text.includes("@media (max-width: 760px)"));
  assert.ok(text.includes("@media (forced-colors: active)"));
});

test("P49 acceptance evidence binds states, read-only requests, and images", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P49-ACCEPTANCE-PAGE-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.layoutMechanicalScan.status, "not_run");
  assert.ok(evidence.layoutMechanicalScan.substituteChecks.length >= 7);
  assert.equal(evidence.runs.length, 16);
  assert.equal(evidence.screenshots.length, 16);
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
    assert.equal(value("three gate rows"), 3);
    assert.equal(value("three independent coverage rows"), 3);
    assert.equal(value("no horizontal overflow"), true);
    assert.deepEqual(value("44px representative controls"), [true, true, true, true, true, true]);
    assert.equal(value("query keyboard focus visible"), true);
    assert.equal(value("responsive layout columns"), run.width <= 760 ? 1 : 2);
    assert.equal(value("no write requests"), 0);
    assert.equal(value("no request bodies"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
  }
});
