import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import {
  previewAdapterRefreshFailure,
  refreshFailureCopy,
  retryWrapper,
} from "../../scripts/lib/ui-phase2-adapter-refresh-failure-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const component = "apps/web/src/components/ProviderAdapterCenter.vue";
const root = "output/playwright/p47-refresh-failure-review";
const captured = (file) =>
  execFileSync("git", ["show", `7691b4679bfe75e06c30f0999991c5ce8f83c734:${file}`], {
    encoding: "utf8",
  }).replaceAll("\r\n", "\n");

test("P47 production refresh failure UI and archived proposal preserve request/filter contracts", () => {
  const original = captured(component),
    review = previewAdapterRefreshFailure(original),
    parsed = parse(review);
  assert.deepEqual(parsed.errors, []);
  compileScript(parsed.descriptor, { id: "p47-refresh-failure" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p47-refresh-failure",
    }).errors,
    [],
  );
  for (const value of Object.values(refreshFailureCopy)) {
    assert.ok(review.includes(value));
    assert.ok(!original.includes(value));
  }
  for (const preserved of [
    'request<AdapterSummary[]>("/platform/provider-adapters"',
    "signal: controller.signal",
    "window.setTimeout(() => controller.abort(), 12_000)",
    "function resetFilters()",
    'query = ref("")',
    'sort = ref("attention")',
    "probing.value === null",
  ])
    assert.equal(review.split(preserved).length, original.split(preserved).length, preserved);
  const production = read(component),
    productionParsed = parse(production);
  assert.deepEqual(productionParsed.errors, []);
  compileScript(productionParsed.descriptor, { id: "p47-refresh-failure-production" });
  assert.deepEqual(
    compileTemplate({
      source: productionParsed.descriptor.template.content,
      filename: component,
      id: "p47-refresh-failure-production",
    }).errors,
    [],
  );
  for (const value of Object.values(refreshFailureCopy)) assert.ok(production.includes(value));
  for (const preserved of [
    'request<AdapterSummary[]>("/platform/provider-adapters"',
    "window.setTimeout(() => controller.abort(), 12_000)",
    'method: "POST"',
    "probeRevision += 1",
  ])
    assert.ok(production.includes(preserved), preserved);
  assert.ok(production.includes('refreshNotice.value = "failure"'));
  assert.ok(production.includes('refreshNotice.value = "success"'));
  assert.ok(production.includes('refreshNotice.value = "none"'));
  assert.ok(production.includes("function retryRefresh(event: MouseEvent)"));
  assert.ok(
    production.indexOf('class="adapter-refresh-failure"') <
      production.indexOf("<ResponsiveDataView"),
  );
  assert.ok(production.includes("message && refreshNotice !== 'failure'"));
  assert.equal(review.split("retryRefresh").length, 3);
  assert.equal(review.split('refreshNotice.value = "none"').length, 3);
  assert.equal(review.split('refreshNotice.value = "success"').length, 2);
  assert.equal(review.split('refreshNotice.value = "failure"').length, 2);
  assert.throws(() =>
    previewAdapterRefreshFailure(original.replace('message = ref("")', 'message = ref("changed")')),
  );
  assert.throws(() =>
    previewAdapterRefreshFailure(original + '\n<header class="adapter-heading">'),
  );
});

test("P47 inline retry wrapper targets only a live local persistent heading", () => {
  for (const scene of ["live", "disconnected", "missing"]) {
    let focusCount = 0,
      loadCount = 0,
      options;
    const heading = {
      isConnected: scene !== "disconnected",
      focus: (value) => {
        focusCount++;
        options = value;
      },
    };
    const box = { load: () => loadCount++ };
    vm.runInNewContext(
      ts.transpileModule(retryWrapper + "globalThis.run=retryRefresh;", {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText,
      box,
    );
    box.run({
      currentTarget: {
        closest: () => ({ querySelector: () => (scene === "missing" ? null : heading) }),
      },
    });
    assert.equal(loadCount, 1);
    assert.equal(focusCount, scene === "live" ? 1 : 0);
    if (scene === "live") assert.equal(options.preventScroll, true);
  }
});

test("P47 production refresh failure CSS stays scoped to the active adapter page", () => {
  const css = postcss.parse(read("apps/web/src/provider-adapters-c-page.css"));
  const splitTopLevelSelectors = (selector) => {
    const selectors = [];
    let depth = 0,
      start = 0;
    for (let index = 0; index < selector.length; index++) {
      if (selector[index] === "(") depth++;
      else if (selector[index] === ")") depth--;
      else if (selector[index] === "," && depth === 0) {
        selectors.push(selector.slice(start, index).trim());
        start = index + 1;
      }
      assert.ok(depth >= 0, `Unbalanced selector: ${selector}`);
    }
    assert.equal(depth, 0, `Unbalanced selector: ${selector}`);
    selectors.push(selector.slice(start).trim());
    return selectors;
  };
  css.walkRules((rule) => {
    if (
      !rule.selector.includes(".adapter-refresh-failure") &&
      !rule.selector.includes(".adapter-heading:focus")
    )
      return;
    for (const selector of splitTopLevelSelectors(rule.selector.replace(/\s+/g, " "))) {
      if (
        !selector.includes(".adapter-refresh-failure") &&
        !selector.includes(".adapter-heading:focus")
      )
        continue;
      assert.ok(selector.includes(".adapter-center--c"));
      assert.ok(
        selector.includes(".adapter-refresh-failure") ||
          selector.includes(".adapter-heading:focus"),
      );
    }
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
});

test("P47 archived refresh failure preserves negative focus and binds its complete original packet", () => {
  const e = JSON.parse(read(`${root}/evidence.json`));
  assert.deepEqual(e, JSON.parse(captured(`${root}/evidence.json`)));
  assert.equal(e.reviewOnly, true);
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 18);
  assert.equal(e.screenshots.length, 54);
  for (const [file, expected] of Object.entries(e.sourceHashes))
    assert.equal(hash(captured(file)), expected, file);
  assert.deepEqual(
    readdirSync(root).sort(),
    ["evidence.json", "index.html", ...e.screenshots.map((s) => s.file)].sort(),
  );
  for (const s of e.screenshots) {
    const bytes = readFileSync(`${root}/${s.file}`);
    assert.equal(hash(bytes), s.sha256);
    assert.equal(bytes.readUInt32BE(16), s.pixelWidth);
    assert.equal(bytes.readUInt32BE(20), s.pixelHeight);
  }
  const attempts = { conflict: 1, forbidden: 1, dependency: 3 };
  for (const r of e.runs) {
    const value = (name) => r.checks.find((c) => c.name === name)?.actual;
    assert.equal(value("safe retry attempts"), attempts[r.scene]);
    assert.deepEqual(value("old metrics retained"), ["2", "1", "1", "1"]);
    assert.equal(value("search retained"), "公开趋势");
    assert.equal(value("filtered snapshot retained"), "1 个结果");
    assert.equal(value("status semantics"), "status");
    assert.equal(value("retry focus target"), r.mode === "review" ? "heading" : "BODY");
    assert.equal(value("retry settlement keeps chosen focus"), true);
    assert.equal(value("one explicit retry GET"), 1 + attempts[r.scene] + 1);
    assert.equal(value("no write requests"), 0);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (r.mode === "review") {
      assert.equal(value("atomic composed message"), "true");
      assert.equal(value("notice appears before retained directory"), true);
      assert.equal(value("legacy bottom message suppressed"), 0);
    }
  }
});
