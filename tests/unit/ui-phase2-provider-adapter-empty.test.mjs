import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  previewAdapterEmpty,
  emptyCopy,
  focusWrapper,
} from "../../scripts/lib/ui-phase2-adapter-empty-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const component = "apps/web/src/components/ProviderAdapterCenter.vue";
const root = "output/playwright/p47-empty-review";

test("P47 empty review changes only presentation and an explicit local focus wrapper", () => {
  const original = read(component),
    review = previewAdapterEmpty(original);
  const parsed = parse(review),
    before = parse(original);
  assert.deepEqual(parsed.errors, []);
  assert.equal(
    parsed.descriptor.scriptSetup.content
      .replace(focusWrapper, "")
      .replace("computed, nextTick,", "computed,"),
    before.descriptor.scriptSetup.content,
  );
  compileScript(parsed.descriptor, { id: "p47-empty" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p47-empty",
    }).errors,
    [],
  );
  let template = parsed.descriptor.template.content;
  for (const [after, value] of [
    [" p47-empty-catalog", ""],
    [" p47-empty-filtered", ""],
    [emptyCopy.catalog[0], "还没有来源可绑定适配器"],
    [emptyCopy.catalog[1], "先在来源注册中心登记技术合同；不会创建模拟来源。"],
    [emptyCopy.filtered[0], "没有符合筛选条件的适配器"],
    [emptyCopy.filtered[1], "调整搜索或筛选条件，清除后显示当前来源目录。"],
    ['@click="resetEmptyFilters">清除筛选', '@click="resetFilters">清除筛选'],
  ])
    template = template.replace(after, value);
  assert.equal(template, before.descriptor.template.content);
  assert.throws(() =>
    previewAdapterEmpty(original.replace("onMounted(load);", "onMounted(other);")),
  );
  assert.throws(() => previewAdapterEmpty(original + "\nonMounted(load);"));
  assert.ok(!original.includes("resetEmptyFilters"));
});

test("P47 preview reset focus respects disconnected inputs, inert dialogs and newer focus", async () => {
  for (const scenario of ["body", "new-focus", "disconnected", "disabled", "inert", "missing"]) {
    let resolveTick,
      focusCount = 0,
      resets = 0;
    const body = {},
      document = { body, activeElement: body };
    const input = {
      isConnected: scenario !== "disconnected",
      disabled: scenario === "disabled",
      closest: () => (scenario === "inert" ? {} : null),
      focus: () => focusCount++,
    };
    const box = {
      document,
      resetFilters: () => resets++,
      nextTick: () =>
        new Promise((resolve) => {
          resolveTick = resolve;
        }),
    };
    vm.runInNewContext(
      ts.transpileModule(focusWrapper + "globalThis.run=resetEmptyFilters;", {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText,
      box,
    );
    const pending = box.run({
      currentTarget: {
        closest: () => ({ querySelector: () => (scenario === "missing" ? null : input) }),
      },
    });
    assert.equal(resets, 1);
    assert.equal(focusCount, 0);
    if (scenario === "new-focus") document.activeElement = {};
    resolveTick();
    await pending;
    assert.equal(focusCount, scenario === "body" ? 1 : 0, scenario);
  }
});

test("P47 empty styling is restricted to its review body and empty region", () => {
  const css = postcss.parse(
    read("design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-empty-preview.css"),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(selector.includes("body.p47-empty-review"));
      assert.ok(selector.includes(".adapter-center--c"));
      assert.ok(selector.includes(".adapter-empty"));
    }
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
});

test("P47 empty evidence preserves baseline focus failure and binds current sources and all pictures", () => {
  const e = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(e.reviewOnly, true);
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 18);
  assert.equal(e.screenshots.length, 30);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const shot of e.screenshots) {
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
  for (const run of e.runs) {
    const value = (name) => run.checks.find((c) => c.name === name)?.actual;
    assert.equal(value("no extra adapter GET"), 1);
    assert.equal(value("no write requests"), 0);
    assert.equal(value("44px action"), true);
    assert.equal(value("no horizontal overflow"), true);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.scene !== "catalog") {
      assert.equal(value("reset focus target"), run.mode === "review" ? "search" : "BODY");
      assert.equal(value("toolbar reset keeps its own focus"), true);
    } else assert.equal(value("registration link reaches P46"), "/platform-admin/providers");
  }
});
