import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { buildAdapterRefreshFocusCurrentRunner } from "../../scripts/lib/ui-adapter-refresh-focus-current-runner.mjs";
import { beforeAdapterEmptyMobile } from "../../scripts/lib/ui-phase2-adapter-empty-mobile-baseline.mjs";
import { beforeAdapterRefreshFocus } from "../../scripts/lib/ui-phase2-adapter-refresh-focus-baseline.mjs";
import { beforeAdapterPaginationFocus } from "../../scripts/lib/ui-phase2-adapter-pagination-focus-baseline.mjs";

const source = readFileSync("scripts/verify-provider-adapter-refresh-focus.mjs", "utf8").replaceAll(
  "\r\n",
  "\n",
);

test("current refresh-focus runner forbids captures and renders only raw current Vue at four widths", () => {
  const runner = buildAdapterRefreshFocusCurrentRunner(source);
  assert.ok(runner.includes("const capture = false;"));
  assert.ok(runner.includes('for (const mode of ["current"])'));
  assert.ok(!runner.includes('for (const mode of ["before", "current"])'));
  assert.ok(runner.includes("for (const width of [390, 760, 761, 1440])"));
  assert.ok(runner.includes("assert.equal(process.argv.length, 2,"));
  const begin = "    server = await createServer({";
  const end = "    await server.listen();";
  assert.equal(
    runner.slice(runner.indexOf(begin), runner.indexOf(end)),
    source.slice(source.indexOf(begin), source.indexOf(end)),
  );
  assert.ok(runner.includes('mode === "before"\n          ? ['));
  assert.ok(runner.includes("          : [],"));
});

test("current refresh-focus runner retains every interaction, request assertion and cleanup", () => {
  const runner = buildAdapterRefreshFocusCurrentRunner(source);
  const begin = "        const context = await browser.newContext({";
  const end = "    for (const mod of server.moduleGraph.idToModuleMap.values())";
  assert.equal(
    runner.slice(runner.indexOf(begin), runner.indexOf(end)),
    source.slice(source.indexOf(begin), source.indexOf(end)),
  );
  assert.equal(
    runner.slice(runner.lastIndexOf("} finally {")),
    source.slice(source.lastIndexOf("} finally {")),
  );
});

test("current refresh-focus runner validates actual mobile lineage without modifying render source", () => {
  const runner = buildAdapterRefreshFocusCurrentRunner(source);
  assert.ok(
    runner.includes(
      "beforeAdapterRefreshFocus(beforeAdapterEmptyMobile(beforeAdapterPaginationFocus(source)))",
    ),
  );
  const actual = readFileSync("apps/web/src/components/ProviderAdapterCenter.vue", "utf8");
  const lineage = (value) =>
    beforeAdapterRefreshFocus(beforeAdapterEmptyMobile(beforeAdapterPaginationFocus(value)));
  const previous = beforeAdapterPaginationFocus(actual);
  assert.equal(lineage(actual), lineage(previous));
  for (const changed of [
    actual + "\n<!-- drift -->",
    actual.replace("page.value += direction;", "page.value -= direction;"),
    actual.replace("heading.focus({ preventScroll: true })", "heading.focus()"),
    actual.replace("还没有可查看的来源", "空目录改动"),
  ]) {
    assert.notEqual(changed, actual);
    assert.throws(() => lineage(changed));
  }
});

test("current refresh-focus runner rejects unknown driver edits including transport and focus assertions", () => {
  for (const token of [
    "const capture =",
    "await expect(target).toBeFocused();",
    "return route.abort();",
    "await browser?.close();",
  ]) {
    const changed = source.replace(token, "// changed\n" + token);
    assert.notEqual(changed, source);
    assert.throws(() => buildAdapterRefreshFocusCurrentRunner(changed));
  }
});

test("current refresh-focus entry rejects arguments before browser startup or image writes", () => {
  for (const arg of ["--capture", "--unknown"]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/verify-provider-adapter-refresh-focus-current.mjs", arg],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /This verifier takes no arguments; historical images stay intact/);
    assert.equal(result.stdout, "");
  }
});
