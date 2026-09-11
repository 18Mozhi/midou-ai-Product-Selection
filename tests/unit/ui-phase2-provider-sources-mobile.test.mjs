import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import { previewProviderSourcesMobile } from "../../scripts/lib/ui-phase2-provider-sources-mobile-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/ProviderSourceCenter.vue",
  root = "output/playwright/p48-source-mobile-review";

test("P48 mobile review transforms only the actual source directory and still compiles", () => {
  const source = read(component),
    review = previewProviderSourcesMobile(source),
    parsed = parse(review);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p48-source-mobile" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p48-source-mobile",
    }).errors,
    [],
  );
  for (const marker of [
    "p48-mobile-filter-toggle",
    "p48-mobile-filter-fields",
    "p48-mobile-record-summary",
    "p48-mobile-detail-trigger",
    "p48-mobile-detail-back",
    "p48-source-record-body",
  ]) {
    assert.ok(review.includes(marker), marker);
    assert.equal(source.includes(marker), false, `production must not contain ${marker}`);
  }
  for (const preserved of [
    ">搜索来源<input",
    ">业务类型",
    ">准备状态",
    ">市场",
    ">语言",
    ">接入模式",
    ">排序",
    '@click="testSource(item)"',
    '@click="beginEdit(item)"',
    '@click="loadConfigurationVersions(item)"',
  ])
    assert.ok(review.includes(preserved), preserved);
});

test("P48 mobile review CSS is isolated and keeps explicit focus treatment", () => {
  const css = postcss.parse(
    read("design-plans/ui-phase-2-2026-09-07/implementation/provider-sources-mobile-preview.css"),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(selector.includes("body.p48-mobile-detail-review"), selector);
      assert.ok(selector.includes(".source-center"), selector);
    }
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  const text = css.toString();
  assert.ok(text.includes(":focus-visible"));
  assert.ok(text.includes("min-height: 44px"));
  assert.ok(text.includes("max-height: min(48vh, 440px)"));
});

test("P48 mobile evidence binds all states, images, sources, and zero desktop drift", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P48-SOURCE-MOBILE-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 8);
  assert.equal(
    evidence.runs.reduce((sum, run) => sum + run.checks.length, 0),
    94,
  );
  assert.equal(evidence.screenshots.length, 24);
  assert.equal(evidence.comparisons.length, 4);
  assert.equal(Object.keys(evidence.sourceHashes).length, 172);
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
  for (const comparison of evidence.comparisons) {
    assert.equal(comparison.sameSize, true);
    assert.equal(comparison.changedPixels, 0);
    assert.equal(comparison.maxChannelDelta, 0);
  }
  for (const run of evidence.runs) {
    const value = (name) => run.checks.find((check) => check.name === name)?.actual;
    assert.equal(value("one catalog GET"), 1);
    assert.equal(value("no write requests"), 0);
    assert.equal(value("no request bodies"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    assert.equal(value("no horizontal overflow"), true);
    if (run.mode === "mobile" && run.width <= 760) {
      assert.equal(value("collapsed hides six selects"), 0);
      assert.equal(value("search remains visible"), true);
      assert.equal(value("result count remains visible"), true);
      assert.equal(value("filter toggle44"), true);
      assert.equal(value("expanded shows six selects"), 6);
      assert.equal(value("expanded fields are bounded"), true);
      assert.equal(value("only selected record remains"), 1);
      assert.equal(value("only selected group remains"), 1);
      assert.equal(value("detail preserves source facts"), 7);
      assert.equal(value("detail preserves original actions"), 3);
      assert.equal(value("back target44"), true);
      assert.equal(value("detail cycle adds no GET"), 1);
    }
  }
});
