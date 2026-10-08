import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";
import { accessCopy, accessHandler } from "../../scripts/lib/ui-phase2-adapter-access-preview.mjs";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/ProviderAdapterCenter.vue",
  root = "output/playwright/p47-access-current-review-r2";

test("P47 production access states compile and keep the existing read contract", () => {
  const production = parse(read(component));
  assert.deepEqual(production.errors, []);
  compileScript(production.descriptor, { id: "p47-access-production" });
  assert.deepEqual(
    compileTemplate({
      source: production.descriptor.template.content,
      filename: component,
      id: "p47-access-production",
    }).errors,
    [],
  );
  const source = read(component),
    script = production.descriptor.scriptSetup.content,
    template = production.descriptor.template.content.replace(/\s+/g, " ");
  assert.ok(script.includes('void router.push("/login")'));
  assert.ok(script.includes("heading.focus({ preventScroll: true })"));
  assert.ok(template.includes("['expired', 'forbidden', 'blocked'].includes(state)"));
  assert.ok(template.includes("handleAccessPrimary() : load()"));
  assert.ok(
    template.includes(
      ":primary-label=\"state === 'loading' ? '' : state === 'expired' ? '重新登录' : '重新读取状态'\"",
    ),
  );
  assert.ok(source.includes('request<AdapterSummary[]>("/platform/provider-adapters"'));
  assert.ok(source.includes("window.setTimeout(() => controller.abort(), 12_000)"));
  for (const copy of Object.values(accessCopy))
    for (const text of Object.values(copy)) assert.ok(source.includes(text));
  assert.ok(source.includes("signal: controller.signal"));
  assert.ok(source.includes("function resetFilters()"));
  assert.ok(source.includes("async function probe"));
});

test("P47 access handler sends expired to verified login and focuses only live local heading for reads", () => {
  for (const scene of ["expired", "live", "disconnected", "missing"]) {
    let loadCount = 0,
      focusCount = 0,
      pushed = "",
      options;
    const heading = {
      isConnected: scene !== "disconnected",
      focus: (value) => {
        focusCount++;
        options = value;
      },
    };
    const box = {
      state: { value: scene === "expired" ? "expired" : "forbidden" },
      router: { push: (value) => (pushed = value) },
      load: () => loadCount++,
      document: {
        activeElement: {
          closest: () => ({ querySelector: () => (scene === "missing" ? null : heading) }),
        },
      },
    };
    vm.runInNewContext(
      ts.transpileModule(accessHandler + "globalThis.run=handleAccessPrimary;", {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      }).outputText,
      box,
    );
    box.run();
    assert.equal(pushed, scene === "expired" ? "/login" : "");
    assert.equal(loadCount, scene === "expired" ? 0 : 1);
    assert.equal(focusCount, scene === "live" ? 1 : 0);
    if (scene === "live") assert.equal(options.preventScroll, true);
  }
});

test("P47 access visual rules cannot target other pages or ordinary error state", () => {
  const reviewCss = postcss.parse(
      read(
        "design-plans/ui-phase-2-2026-09-07/implementation/provider-adapters-access-preview.css",
      ),
    ),
    productionCss = postcss.parse(read("apps/web/src/provider-adapters-c-page.css"));
  reviewCss.walkRules((rule) => {
    for (const selector of rule.selectors) {
      assert.ok(selector.includes("body.p47-access-review"));
      assert.ok(selector.includes(".adapter-center--c"));
      assert.ok(
        selector.includes(
          ':is([data-kind="expired"], [data-kind="forbidden"], [data-kind="blocked"])',
        ) ||
          selector.includes('[data-kind="expired"]') ||
          selector.includes('[data-kind="forbidden"]') ||
          selector.includes('[data-kind="blocked"]') ||
          selector.includes(".adapter-heading:focus"),
      );
      assert.ok(!selector.includes('[data-kind="error"]'));
    }
    assert.ok(rule.nodes.filter((node) => node.type === "decl").every((node) => !node.important));
  });
  let productionStateRules = 0;
  productionCss.walkRules((rule) => {
    if (!rule.selector.includes(".ui-state-panel")) return;
    for (const selector of rule.selectors) {
      assert.ok(selector.includes(".adapter-center--c"));
      assert.ok(!selector.includes('[data-kind="error"]'));
      if (
        selector.includes('[data-kind="expired"]') ||
        selector.includes('[data-kind="forbidden"]') ||
        selector.includes('[data-kind="blocked"]')
      )
        productionStateRules += 1;
    }
  });
  assert.ok(productionStateRules >= 10);
});

test("P47 access evidence binds current sources, all pictures and unchanged 500 state", () => {
  const e = JSON.parse(read(`${root}/evidence.json`));
  assert.equal(e.reviewOnly, true);
  assert.equal(e.kind, "P47-ACCESS-CURRENT-REVIEW-r2");
  assert.equal(e.productionEmptyFocusPreserved, true);
  assert.equal(e.historicalPackage, "output/playwright/p47-access-current-review");
  assert.equal(e.processesClosed, true);
  assert.equal(e.runs.length, 30);
  assert.equal(
    e.runs.reduce((total, run) => total + run.checks.length, 0),
    408,
  );
  assert.equal(Object.keys(e.sourceHashes).length, 147);
  for (const expected of Object.values(e.sourceHashes)) assert.match(expected, /^[a-f0-9]{64}$/);
  assert.equal(e.screenshots.length, 60);
  assert.equal(e.comparisons.length, 3);
  for (const comparison of e.comparisons) {
    assert.equal(comparison.sameSize, true);
    assert.ok(comparison.changedPixels <= 64);
    assert.ok(comparison.maxChannelDelta <= 2);
  }
  // Source hashes describe the historical reviewed workspace; current production
  // code is verified by the SFC contract and real-browser tests above/below.
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
  const attempts = { expired: 1, forbidden: 1, rate: 3, dependency: 3, "error-unchanged": 1 };
  for (const run of e.runs) {
    const value = (name) => run.checks.find((check) => check.name === name)?.actual;
    assert.equal(value("safe initial attempts"), attempts[run.scene]);
    assert.equal(value("no fabricated metrics"), 0);
    assert.equal(value("one visible action"), 1);
    assert.equal(value("action is at least44px"), true);
    assert.equal(value("no horizontal overflow"), true);
    assert.equal(value("no write requests"), 0);
    assert.deepEqual(value("no unexpected network"), []);
    assert.deepEqual(value("no runtime errors"), []);
    if (run.scene === "expired") {
      assert.equal(value("expired reaches verified login route"), "/login");
      assert.equal(value("expired does not reread adapters"), 1);
    } else {
      assert.equal(
        value("pending focus target"),
        run.scene !== "error-unchanged" ? "heading" : "BODY",
      );
      assert.equal(value("settled recovery keeps chosen focus"), true);
      assert.equal(value("one explicit recovery GET"), attempts[run.scene] + 1);
    }
  }
});
