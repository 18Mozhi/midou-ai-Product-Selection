import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import { p47HistoricalSource } from "../../scripts/lib/ui-phase2-adapter-historical-source.mjs";
import { beforeAdapterRefreshFocus } from "../../scripts/lib/ui-phase2-adapter-refresh-focus-baseline.mjs";
import { previewCurrentAdapterEmpty } from "../../scripts/lib/ui-phase2-adapter-current-empty-preview.mjs";
import {
  beforeAdapterEmptyFocus,
  adapterEmptyFocusRevision,
} from "../../scripts/lib/ui-phase2-adapter-empty-focus-baseline.mjs";
import {
  previewAdapterEmpty,
  emptyCopy,
  focusWrapper,
} from "../../scripts/lib/ui-phase2-adapter-empty-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const component = "apps/web/src/components/ProviderAdapterCenter.vue";
const historicalRoot = "output/playwright/p47-empty-review";
const stageRead = (file, stage = "pre-mobile") => p47HistoricalSource(file, read(file), stage);

test("P47 historical empty proposal stays exactly reversible against its pre-focus source", () => {
  const original = beforeAdapterEmptyFocus(stageRead(component, "pre-refresh")),
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

test("P47 actual and preview reset focus respect disconnected inputs, inert dialogs and newer focus", async () => {
  const script = parse(read(component)).descriptor.scriptSetup.content;
  const ast = ts.createSourceFile("adapter.ts", script, ts.ScriptTarget.Latest, true);
  const actual = ast.statements.filter(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === "resetEmptyFilters",
  );
  assert.equal(actual.length, 1);
  for (const implementation of [actual[0].getText(ast), focusWrapper]) {
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
        ts.transpileModule(implementation + "globalThis.run=resetEmptyFilters;", {
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

for (const [root, kind, archive] of [
  ["output/playwright/p47-empty-current-implementation", "P47-EMPTY-CURRENT-FOCUS-r1", true],
  [
    "output/playwright/p47-empty-refresh-focus-current",
    "P47-EMPTY-CURRENT-REFRESH-FOCUS-r1",
    false,
  ],
])
  test(`P47 ${archive ? "pre-refresh archive" : "pre-mobile archive"} empty evidence binds focus, exact sources and all pictures`, () => {
    const e = JSON.parse(read(`${root}/evidence.json`));
    if (archive)
      assert.equal(
        hash(read(`${root}/evidence.json`)),
        "42420fdae81edacb03ad5929ef068482d389831e0a7bb6ba0238261948fa7d5d",
      );
    else
      assert.equal(
        hash(read(`${root}/evidence.json`)),
        "da2a49578469852a608189ccf3c26f14ce28d2fa39b10e23d5d8a63650a0b6c9",
      );
    assert.equal(e.reviewOnly, true);
    assert.equal(e.kind, kind);
    if (!archive) assert.equal(e.productionRefreshFocusPreserved, true);
    assert.equal(e.productionFocusImplemented, true);
    assert.equal(e.historicalPackage, historicalRoot);
    assert.equal(e.processesClosed, true);
    assert.equal(e.runs.length, 18);
    assert.equal(e.screenshots.length, 30);
    assert.equal(Object.keys(e.sourceHashes).length, archive ? 176 : 179);
    if (!archive) {
      for (const file of [
        "scripts/verify-ui-phase2-provider-adapter-empty-refresh-current.mjs",
        "scripts/lib/ui-phase2-adapter-current-empty-preview.mjs",
        "scripts/lib/ui-phase2-adapter-refresh-focus-baseline.mjs",
        "apps/web/src/design/provider-adapter-tokens.css",
      ])
        assert.ok(e.sourceHashes[file], file);
    }
    for (const [file, expected] of Object.entries(e.sourceHashes)) {
      const captured = stageRead(file, archive ? "pre-refresh" : "pre-mobile");
      assert.equal(hash(captured), expected, file);
    }
    assert.deepEqual(
      readdirSync(root).sort(),
      ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
    );
    for (const shot of e.screenshots) {
      const bytes = readFileSync(`${root}/${shot.file}`);
      assert.equal(hash(bytes), shot.sha256);
      assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
      assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
      if (!archive)
        assert.equal(
          hash(bytes),
          hash(readFileSync(`output/playwright/p47-empty-current-implementation/${shot.file}`)),
          `unchanged empty appearance: ${shot.file}`,
        );
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
        assert.equal(value("reset focus target"), "search");
        assert.equal(value("toolbar reset keeps its own focus"), true);
      } else assert.equal(value("registration link reaches P46"), "/platform-admin/providers");
    }
  });

test("P47 empty focus stage remains exact before the verified refresh-only repair", () => {
  const source = stageRead(component, "pre-refresh");
  assert.equal(hash(source), adapterEmptyFocusRevision.after);
  assert.equal(hash(beforeAdapterEmptyFocus(source)), adapterEmptyFocusRevision.before);
  assert.equal(
    beforeAdapterEmptyFocus(source + "\n// unknown drift"),
    source + "\n// unknown drift",
  );
  assert.match(source, /class="adapter-reset" @click="resetFilters"/);
  assert.equal((source.match(/@click="resetEmptyFilters"/g) ?? []).length, 1);
});

test("P47 pre-mobile empty preview changes only six presentation slots and preserves both focus handlers", () => {
  const source = stageRead(component),
    result = previewCurrentAdapterEmpty(source);
  const before = parse(source).descriptor,
    after = parse(result).descriptor;
  assert.equal(after.scriptSetup.content, before.scriptSetup.content);
  assert.deepEqual(
    after.styles.map((s) => [s.content, s.attrs]),
    before.styles.map((s) => [s.content, s.attrs]),
  );
  let template = after.template.content;
  for (const [from, to] of [
    [" p47-empty-catalog", ""],
    [" p47-empty-filtered", ""],
    [emptyCopy.catalog[0], "还没有来源可绑定适配器"],
    [emptyCopy.catalog[1], "先在来源注册中心登记技术合同；不会创建模拟来源。"],
    [emptyCopy.filtered[0], "没有符合筛选条件的适配器"],
    [emptyCopy.filtered[1], "调整搜索或筛选条件，清除后显示当前来源目录。"],
  ]) {
    assert.equal(template.split(from).length, 2);
    template = template.replace(from, to);
  }
  assert.equal(template, before.template.content);
  compileScript(after, { id: "p47-empty-current" });
  assert.deepEqual(
    compileTemplate({
      source: after.template.content,
      filename: component,
      id: "p47-empty-current",
    }).errors,
    [],
  );
  for (const changed of [
    source + "\n// drift",
    source.replace("input.focus();", "input.blur();"),
    source.replace("heading.focus({ preventScroll: true });", "heading.blur();"),
    beforeAdapterRefreshFocus(source),
  ]) {
    assert.throws(() => previewCurrentAdapterEmpty(changed));
  }
  assert.equal(previewCurrentAdapterEmpty(source.replaceAll("\n", "\r\n")), result);
});

test("P47 original empty review retains its negative focus evidence and all approved-region images", () => {
  assert.equal(
    hash(read(`${historicalRoot}/evidence.json`)),
    "487b0e1bd664b5d2e5bf0daec40f99dfe71f8dd69c8c8320c24881ccedc65576",
  );
  const e = JSON.parse(read(`${historicalRoot}/evidence.json`));
  assert.equal(e.screenshots.length, 30);
  for (const shot of e.screenshots)
    assert.equal(hash(readFileSync(`${historicalRoot}/${shot.file}`)), shot.sha256, shot.file);
  for (const run of e.runs.filter((run) => run.scene !== "catalog"))
    assert.equal(
      run.checks.find((check) => check.name === "reset focus target").actual,
      run.mode === "review" ? "search" : "BODY",
    );
  for (const source of [
    "scripts/verify-ui-phase2-provider-adapter-empty.mjs",
    "scripts/lib/ui-phase2-adapter-empty-preview.mjs",
    "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-empty-preview.css",
  ])
    assert.equal(hash(read(source)), e.sourceHashes[source], source);
});
