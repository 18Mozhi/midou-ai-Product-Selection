import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import { pageTurnHandler } from "../../scripts/lib/ui-phase2-adapter-filter-pagination-preview.mjs";
import { paginationFocusHandler } from "../../scripts/lib/ui-phase2-adapter-pagination-focus-baseline.mjs";
import { previewCurrentAdapterFilterPagination as previewAdapterFilterPagination } from "../../scripts/lib/ui-phase2-adapter-current-state-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/ProviderAdapterCenter.vue",
  root = "output/playwright/p47-filter-pagination-current-review";

test("P47 filter/page proposal compiles and preserves original six-model and request script", () => {
  const original = read(component),
    review = previewAdapterFilterPagination(original),
    before = parse(original),
    parsed = parse(review);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p47-filter-page" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p47-filter-page",
    }).errors,
    [],
  );
  assert.equal(
    parsed.descriptor.scriptSetup.content.replace(paginationFocusHandler, ""),
    before.descriptor.scriptSetup.content.replace(paginationFocusHandler, ""),
  );
  assert.equal(parsed.descriptor.scriptSetup.content.split(paginationFocusHandler).length, 2);
  assert.equal(before.descriptor.scriptSetup.content.split(paginationFocusHandler).length, 2);
  for (const preserved of [
    'query = ref("")',
    'mode = ref("all")',
    'providerStatus = ref("all")',
    'registration = ref("all")',
    'health = ref("all")',
    'sort = ref("attention")',
    "pageSize = 20",
    "function resetFilters()",
    'request<AdapterSummary[]>("/platform/provider-adapters"',
  ])
    assert.equal(review.split(preserved).length, original.split(preserved).length, preserved);
  assert.throws(() =>
    previewAdapterFilterPagination(
      original.replace('@click="turnPage(-1, $event)"', '@click="other"'),
    ),
  );
  assert.throws(() =>
    previewAdapterFilterPagination(
      original + '\n<button type="button" :disabled="page === 1" @click="page--">上一页</button>',
    ),
  );
});

test("P47 historical page-turn proposal focuses status when its trigger becomes disabled", async () => {
  for (const scene of ["enabled", "disabled", "missing"]) {
    let focusCount = 0,
      options;
    const status = {
      focus: (value) => {
        focusCount++;
        options = value;
      },
    };
    const trigger = {
      disabled: scene === "disabled",
      closest: () => ({ querySelector: () => (scene === "missing" ? null : status) }),
    };
    const box = { page: { value: 2 }, nextTick: async () => {} };
    vm.runInNewContext(
      ts.transpileModule(pageTurnHandler + "globalThis.run=turnPage;", {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText,
      box,
    );
    await box.run(1, { currentTarget: trigger });
    assert.equal(box.page.value, 3);
    assert.equal(focusCount, scene === "disabled" ? 1 : 0);
    if (scene === "disabled") assert.equal(options.preventScroll, true);
  }
});

test("P47 filter/page CSS remains isolated to review P47 controls", () => {
  const css = postcss.parse(
    read(
      "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-filter-pagination-preview.css",
    ),
  );
  css.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(selector.includes("body.p47-filter-page-review"));
      assert.ok(selector.includes(".adapter-center--c"));
      assert.ok(
        [
          ".adapter-toolbar",
          ".adapter-advanced",
          ".adapter-result-count",
          ".adapter-pagination",
          ".adapter-page-status",
        ].some((value) => selector.includes(value)),
      );
    }
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
});

test("P47 actual45-row filter/page evidence binds current source and all images", () => {
  const e = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(e.reviewOnly, true);
  assert.equal(e.kind, "P47-FILTER-PAGINATION-CURRENT-REVIEW-r1");
  assert.equal(e.productionEmptyFocusPreserved, true);
  assert.equal(e.historicalPackage, "output/playwright/p47-filter-pagination-review");
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 6);
  assert.equal(
    e.runs.reduce((total, run) => total + run.checks.length, 0),
    162,
  );
  assert.equal(Object.keys(e.sourceHashes).length, 178);
  for (const dependency of [
    "scripts/verify-ui-phase2-provider-adapter-current-states.mjs",
    "scripts/lib/ui-phase2-adapter-current-state-preview.mjs",
    "scripts/lib/ui-phase2-adapter-empty-focus-baseline.mjs",
    "scripts/lib/ui-imported-style-sources.mjs",
    "apps/web/src/design/provider-adapter-tokens.css",
  ])
    assert.equal(e.sourceHashes[dependency], hash(read(dependency)), dependency);
  assert.equal(e.screenshots.length, 36);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assert.equal(hash(read(file)), expected, file);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((shot) => shot.file)].sort(),
  );
  for (const shot of e.screenshots) {
    const bytes = readFileSync(`${root}/${shot.file}`);
    assert.equal(hash(bytes), shot.sha256);
    assert.equal(bytes.readUInt32BE(16), shot.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), shot.pixelHeight);
  }
  for (const run of e.runs) {
    const value = (name) => run.checks.find((check) => check.name === name)?.actual;
    assert.equal(value("one initial catalog GET"), 1);
    assert.equal(value("page one has20 rows"), 20);
    assert.equal(value("page two has20 rows"), 20);
    assert.equal(value("page three has5 rows"), 5);
    assert.equal(value("last-page focus target"), run.mode === "review" ? "status" : "BODY");
    assert.equal(value("first-page focus target"), run.mode === "review" ? "status" : "BODY");
    assert.equal(
      value("review hides redundant single-page pagination"),
      run.mode === "review" ? 0 : 1,
    );
    assert.equal(value("single result row"), 1);
    assert.equal(value("query keeps focus"), true);
    assert.equal(value("clear restores search"), "");
    assert.deepEqual(value("clear restores five selects"), [
      "all",
      "all",
      "all",
      "all",
      "attention",
    ]);
    assert.equal(value("clear restores page one"), "第 1 / 3 页 · 每页 20 条");
    assert.equal(value("filters and pages add no GET"), 1);
    assert.equal(value("existing empty reset focus preserved"), true);
    assert.equal(value("no write requests"), 0);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.mode === "review") {
      assert.equal(value("result count announced politely"), "status");
      assert.equal(value("page status announced politely"), "status");
    }
  }
});
