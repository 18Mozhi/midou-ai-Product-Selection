import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  buildAdapterEmptyMobileCurrentRunner,
  currentEmptyMobileInsertion,
  resolveEmptyMobileRunnerImports,
} from "../../scripts/lib/ui-adapter-empty-mobile-current-runner.mjs";
const original = readFileSync(
  "scripts/verify-provider-adapter-empty-mobile.mjs",
  "utf8",
).replaceAll("\r\n", "\n");
test("nested import resolver preserves its own regex instead of resolving it as a package", () => {
  const built = buildAdapterEmptyMobileCurrentRunner(original);
  const imports = [];
  const resolved = resolveEmptyMobileRunnerImports(
    built,
    (specifier) => {
      assert.ok(!specifier.includes("([^"));
      imports.push(specifier);
      return specifier.startsWith("node:") ? specifier : "file:///verified/" + specifier;
    },
    'import ts from "typescript";',
  );
  assert.ok(imports.includes("typescript"));
  assert.ok(resolved.includes('"typescript":"file:///verified/typescript"'));
  assert.ok(!resolved.includes("import.meta.resolve(specifier)"));
  assert.ok(imports.includes("./lib/ui-phase2-adapter-pagination-focus-baseline.mjs"));
  assert.ok(resolved.includes(String.raw`/from "([^"\n]+)"/g`));
  assert.throws(() =>
    resolveEmptyMobileRunnerImports(built + String.raw`/from "([^"\n]+)"/g`, () => ""),
  );
});
test("current empty runner preserves the complete original driver outside explicit replay insertion", () => {
  const runner = buildAdapterEmptyMobileCurrentRunner(original);
  assert.equal(runner.replace(currentEmptyMobileInsertion, ""), original);
  assert.ok(currentEmptyMobileInsertion.includes("const capture = false;"));
  assert.ok(currentEmptyMobileInsertion.includes('for (const mode of ["current"])'));
  assert.ok(
    currentEmptyMobileInsertion.includes(
      "beforeAdapterEmptyMobile(beforeAdapterPaginationFocus(source))",
    ),
  );
  assert.throws(() => buildAdapterEmptyMobileCurrentRunner(original + "\n"));
  assert.throws(() =>
    buildAdapterEmptyMobileCurrentRunner(
      original.replace("beforeAdapterEmptyMobile(source)", "source"),
    ),
  );
});
test("current empty entry rejects capture and unknown flags before creating browser or artifacts", () => {
  for (const flag of ["--capture", "--unknown"]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/verify-provider-adapter-empty-mobile-current.mjs", flag],
      { encoding: "utf8", windowsHide: true },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Current empty verifier takes no arguments/);
    assert.doesNotMatch(result.stdout, /http:\/\//);
  }
});
