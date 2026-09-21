import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildAdapterReadCurrentRunner } from "../../scripts/lib/ui-adapter-read-current-runner.mjs";

const source = readFileSync(
  "scripts/verify-ui-phase2-provider-adapter-read-order.mjs",
  "utf8",
).replaceAll("\r\n", "\n");

test("current P47 runner disables captures and baseline execution, adds desktop boundary", () => {
  const runner = buildAdapterReadCurrentRunner(source);
  assert.ok(runner.includes("const capture = false;"));
  assert.ok(runner.includes('for (const mode of ["current"])'));
  assert.ok(runner.includes("for (const width of [390, 760, 761, 1440])"));
  assert.ok(!runner.includes('for (const mode of ["baseline", "current"])'));
  assert.ok(runner.includes("assert.equal(process.argv.length, 2,"));
});

test("current P47 runner keeps original interactions, assertions, transport and cleanup intact", () => {
  const runner = buildAdapterReadCurrentRunner(source);
  const begin = "        const page = await context.newPage(),";
  const end = "    for (const mod of server.moduleGraph.idToModuleMap.values())";
  assert.equal(
    runner.slice(runner.indexOf(begin), runner.indexOf(end)),
    source.slice(source.indexOf(begin), source.indexOf(end)),
  );
  assert.ok(runner.includes('return mode === "baseline" ? { code: baseline, map: null } : null;'));
  assert.equal(
    runner.slice(runner.lastIndexOf("} finally {")),
    source.slice(source.lastIndexOf("} finally {")),
  );
});

test("current P47 runner rejects changed driver assertions, transport or capture guards", () => {
  for (const token of [
    "const capture =",
    "await expect(drawer).toHaveCount(0);",
    "return route.abort();",
  ]) {
    const changed = source.replace(token, "// changed\n" + token);
    assert.notEqual(changed, source);
    assert.throws(() => buildAdapterReadCurrentRunner(changed));
  }
});
