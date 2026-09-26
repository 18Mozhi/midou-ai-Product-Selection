import test from "node:test";
import { acceptanceHistoricalCapture } from "../../scripts/lib/ui-phase2-acceptance-historical-capture.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { computed, ref } from "vue";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
import postcss from "postcss";

const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n"),
  hash = (value) => createHash("sha256").update(value).digest("hex"),
  component = "apps/web/src/components/Alibaba1688AcceptanceCenter.vue",
  cssFile =
    "design-plans/ui-phase-2-2026-09-07/implementation/1688-acceptance-lifecycle-preview.css",
  composableFile = "apps/web/src/composables/useAlibaba1688Acceptance.ts",
  root = "output/playwright/p49-acceptance-lifecycle-review";

test("P49 production lifecycle status is rendered by the actual Vue page", () => {
  const source = read(component),
    parsed = parse(source);
  assert.deepEqual(parsed.errors, []);
  const compiled = compileScript(parsed.descriptor, { id: "p49-lifecycle" });
  assert.deepEqual(
    compileTemplate({
      source: parsed.descriptor.template.content,
      filename: component,
      id: "p49-lifecycle",
      compilerOptions: { bindingMetadata: compiled.bindings },
    }).errors,
    [],
  );
  assert.match(source, /v-if="reactivating"/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /页面已恢复，正在重新读取启用检查和执行范围。/);
  assert.match(read(composableFile), /onActivated\(\(\) =>/);
  assert.match(read(composableFile), /onDeactivated\(\(\) =>/);
});

test("P49 KeepAlive return announces fresh reads until both requests settle", async () => {
  const source = read(composableFile).replace(
      "export function useAlibaba1688Acceptance",
      "function useAlibaba1688Acceptance",
    ),
    ast = ts.createSourceFile(composableFile, source, ts.ScriptTarget.Latest, true),
    code = ts.transpileModule(
      ast.statements
        .filter((node) => !ts.isImportDeclaration(node))
        .map((node) => node.getText(ast))
        .join("\n") + "\nglobalThis.subject = useAlibaba1688Acceptance('/api/v1');",
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    calls = [],
    hooks = { mounted: [], activated: [], deactivated: [], unmounted: [] },
    box = {
      AbortController,
      ApiClientError: class ApiClientError extends Error {},
      computed,
      ref,
      onMounted: (callback) => hooks.mounted.push(callback),
      onActivated: (callback) => hooks.activated.push(callback),
      onDeactivated: (callback) => hooks.deactivated.push(callback),
      onBeforeUnmount: (callback) => hooks.unmounted.push(callback),
      createApiClient: () => (path, options) =>
        new Promise((resolve, reject) => calls.push({ path, options, resolve, reject })),
      window: { setTimeout: () => 1, clearTimeout: () => {} },
    };
  vm.runInNewContext(code, box);
  const respond = (index, data) => calls[index].resolve({ data, request_id: `request-${index}` });
  const flush = async () => {
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
  };
  hooks.mounted[0]();
  respond(0, { provider_id: "1688_search", overall: "setup_required", gates: [] });
  respond(1, []);
  await flush();
  hooks.deactivated[0]();
  hooks.activated[0]();
  assert.equal(box.subject.reactivating.value, true);
  assert.deepEqual(
    calls.slice(2).map((call) => call.path),
    ["/platform/provider-sources/1688-acceptance", "/org/memberships"],
  );
  respond(2, { provider_id: "1688_search", overall: "setup_required", gates: [] });
  await flush();
  assert.equal(box.subject.reactivating.value, true, "membership read is still pending");
  respond(3, []);
  await flush();
  assert.equal(box.subject.reactivating.value, false);
  assert.equal(calls.length, 4, "reactivation performs reads only");
  hooks.unmounted[0]();
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

test("P49 historical lifecycle evidence binds baseline, proposed return, and images", () => {
  const historical = acceptanceHistoricalCapture("lifecycle");
  assert.equal(read(`${root}/evidence.json`), historical.manifest);
  const evidence = JSON.parse(historical.manifest);
  assert.equal(evidence.kind, "P49-ACCEPTANCE-LIFECYCLE-REVIEW-r1");
  assert.equal(evidence.reviewOnly, true);
  assert.equal(evidence.productionChanged, false);
  assert.equal(evidence.deployed, false);
  assert.equal(evidence.processesClosed, true);
  assert.equal(evidence.baselineRuns.length, 2);
  assert.equal(evidence.proposedRuns.length, 2);
  assert.equal(evidence.screenshots.length, 4);
  for (const [file, expected] of Object.entries(evidence.sourceHashes))
    assert.equal(hash(historical.source(file)), expected, file);
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
