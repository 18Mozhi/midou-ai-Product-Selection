import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/TableViewControls.vue",
  root = "output/playwright/p47-table-tools-review";

test("P47 table tools use the existing shared component contract", () => {
  const source = read(component),
    parsed = parse(source);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p47-table-tools" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p47-table-tools",
    }).errors,
    [],
  );
  for (const preserved of [
    "选择显示列",
    "首列已冻结",
    "首列未冻结",
    "表格密度",
    'value="standard"',
    'value="compact"',
    "visibleColumnCount.value <= 1",
  ])
    assert.ok(source.includes(preserved), preserved);
});

test("P47 table-tools CSS is isolated to the review body and active page", () => {
  const css = postcss.parse(
    read(
      "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-table-tools-preview.css",
    ),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(selector.includes("body.p47-table-tools-review"), selector);
      assert.ok(selector.includes(".adapter-center--c"), selector);
      assert.ok(selector.includes(".table-view-controls"), selector);
    }
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
});

test("P47 table-tools evidence binds current sources, images, and interaction boundaries", () => {
  const evidence = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(evidence.kind, "P47-TABLE-TOOLS-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.runs.length, 6);
  assert.equal(
    evidence.runs.reduce((sum, run) => sum + run.checks.length, 0),
    90,
  );
  assert.equal(evidence.screenshots.length, 18);
  assert.equal(Object.keys(evidence.sourceHashes).length, 169);
  for (const [file, expected] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...evidence.screenshots.map((shot) => shot.file)].sort(),
  );
  for (const shot of evidence.screenshots) {
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
  assert.deepEqual(evidence.comparisons, [
    {
      width: 390,
      suffix: "mobile-unchanged",
      sameSize: true,
      changedPixels: 0,
      maxChannelDelta: 0,
    },
  ]);
  for (const run of evidence.runs) {
    const value = (name) => run.checks.find((check) => check.name === name)?.actual;
    assert.equal(value("one adapters GET"), 1);
    assert.equal(value("controls create no write"), 0);
    assert.equal(value("no request bodies"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    assert.equal(value("no page horizontal overflow"), true);
    if (run.width === 390) {
      assert.equal(value("desktop controls hidden on mobile"), false);
      assert.equal(value("two mobile records remain"), 2);
      continue;
    }
    assert.deepEqual(value("five source-derived columns"), [
      "程序与来源",
      "健康探针",
      "24 小时实际采集",
      "暂停与恢复",
      "操作",
    ]);
    assert.deepEqual(value("five checked columns"), [true, true, true, true, true]);
    assert.equal(value("third header hidden"), true);
    assert.equal(value("third cells hidden"), true);
    assert.equal(value("compact does not increase row height"), true);
    assert.equal(value("freeze off removes all sticky cells"), 0);
    assert.equal(value("one visible column protected"), 1);
    assert.equal(value("remaining visible column is frozen"), true);
    assert.equal(value("all five columns restore"), 5);
    if (run.mode === "review") {
      assert.equal(value("review controls at least44px"), true);
      assert.equal(value("column rows at least44px in review"), true);
    }
  }
});
