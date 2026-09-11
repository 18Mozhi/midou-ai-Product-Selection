import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  parserSamplesCopy,
  previewProviderParserSampleDialog,
  previewProviderParserSampleReview,
  previewProviderParserSamplesParent,
} from "../../scripts/lib/ui-phase2-provider-parser-samples-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  parent = "apps/web/src/components/ProviderSourceCenter.vue",
  dialog = "apps/web/src/components/ProviderParserSampleDialog.vue",
  review = "apps/web/src/components/ProviderParserSampleReview.vue",
  root = "output/playwright/p48-parser-samples-review";

const compile = (source, filename, id) => {
  const parsed = parse(source);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id });
  assert.deepEqual(
    compileTemplate({ source: parsed.descriptor.template.content, filename, id }).errors,
    [],
  );
};

test("P48 parser-sample review transforms the actual parent and dialogs", () => {
  const parentSource = read(parent),
    dialogSource = read(dialog),
    reviewSource = read(review),
    parentPreview = previewProviderParserSamplesParent(parentSource),
    dialogPreview = previewProviderParserSampleDialog(dialogSource),
    reviewPreview = previewProviderParserSampleReview(reviewSource);
  compile(parentPreview, parent, "p48-parser-parent");
  compile(dialogPreview, dialog, "p48-parser-dialog");
  compile(reviewPreview, review, "p48-parser-review");
  for (const marker of ["__P48_PARSER_SAMPLE_REPLAY__"])
    assert.equal(
      parentSource.includes(marker),
      false,
      `production parent must not contain ${marker}`,
    );
  for (const marker of [
    "p48-parser-samples-modal",
    "p48-parser-samples-gates",
    "sampleDialogFocusable",
    "setSampleDialogBackgroundInert",
    "handleSampleDialogKeydown",
  ]) {
    assert.ok(dialogPreview.includes(marker), marker);
    assert.equal(
      dialogSource.includes(marker),
      false,
      `production dialog must not contain ${marker}`,
    );
  }
  for (const marker of ["p48-parser-sample-review", "p48-parser-sample-self-note"]) {
    assert.ok(reviewPreview.includes(marker), marker);
    assert.equal(
      reviewSource.includes(marker),
      false,
      `production review must not contain ${marker}`,
    );
  }
});

test("P48 parser-sample copy preserves immutable replay and independent-review boundaries", () => {
  const dialogPreview = previewProviderParserSampleDialog(read(dialog)),
    reviewPreview = previewProviderParserSampleReview(read(review));
  assert.equal(
    parserSamplesCopy.description,
    "用真实浏览器作业建立基线，再核对当前解析器并由另一管理员复核。",
  );
  assert.ok(parserSamplesCopy.gateNote.includes("三项都完成后"));
  for (const marker of [
    "同时保存截图、DOM 和结构化快照",
    "不可变样本",
    "回放只解析已保存快照，不会重新打开外部页面",
    "来源继续停用",
  ])
    assert.ok(dialogPreview.includes(marker), marker);
  for (const marker of [
    'minlength="2"',
    'maxlength="1000"',
    "通过与驳回都必须说明依据",
    "创建人不能审批自己的样本，需要另一管理员处理",
  ])
    assert.ok(reviewPreview.includes(marker), marker);
  assert.equal(dialogPreview.includes("{{ candidate.browser_job_id }}"), false);
  assert.equal(dialogPreview.includes("{{ sample.created_by }}"), false);
});

test("P48 parser-sample CSS is isolated, responsive, and keyboard-visible", () => {
  const css = postcss.parse(
    read("design-plans/ui-phase-2-2026-09-07/implementation/provider-parser-samples-preview.css"),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors)
      assert.ok(selector.includes("body.p48-parser-samples-review"), selector);
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes('data-status="changed"'));
  assert.ok(text.includes('data-status="failed"'));
  assert.ok(text.includes('data-review="approved"'));
  assert.ok(text.includes('data-review="rejected"'));
  assert.ok(text.includes(":focus-visible"));
  assert.ok(text.includes("min-height: 44px"));
  assert.ok(text.includes("@media (max-width: 760px)"));
  assert.ok(text.includes("@media (forced-colors: active)"));
});

test("P48 parser-sample evidence binds all read states, modal behavior, and images", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P48-PARSER-SAMPLES-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.ok(evidence.fixtureNotice.includes("synthetic review fixtures"));
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 40);
  assert.equal(evidence.screenshots.length, 46);
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
    assert.ok(value("44px representative controls").every(Boolean));
    assert.equal(value("tab loop stays in dialog"), true);
    assert.equal(value("escape restores trigger"), true);
    assert.equal(value("background inert cleared"), 0);
    assert.equal(value("one source GET"), 1);
    assert.equal(value("one parser-samples GET"), 1);
    assert.equal(value("no write requests"), 0);
    assert.equal(value("no request bodies"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.scene === "loading") assert.equal(value("sample content hidden"), 0);
    if (run.scene === "candidate") assert.equal(value("raw browser job id hidden"), 0);
    if (run.scene === "self-review") {
      assert.equal(value("self-review input hidden"), 0);
      assert.equal(value("self-review actions hidden"), 0);
    }
  }
});
