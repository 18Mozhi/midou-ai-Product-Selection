import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
const file = readFileSync("apps/web/src/components/ReleaseRolloutCenter.vue", "utf8");
const { scriptSetup, template } = parse(file).descriptor;
const ast = ts.createSourceFile("release.ts", scriptSetup.content, ts.ScriptTarget.Latest, true);
function metric() {
  const declaration = ast.statements
    .filter(ts.isVariableStatement)
    .flatMap((n) => n.declarationList.declarations)
    .find((d) => d.name.getText(ast) === "metric");
  assert.ok(declaration, "nullable metrics need an explicit display formatter");
  const js = ts.transpile(`const ${declaration.getText(ast)}; metric`, {
    target: ts.ScriptTarget.ES2022,
  });
  return vm.runInNewContext(js, {}, { timeout: 1000 });
}
for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY])
  test(`P65 missing or nonfinite metric ${String(value)} is not a bare unit or zero`, () => {
    for (const unit of ["%", " ms", " s", " 秒"]) assert.equal(metric()(value, unit), "尚无记录");
  });
for (const [value, unit, expected] of [
  [0, "%", "0%"],
  [0, " ms", "0 ms"],
  [0, " 秒", "0 秒"],
  [0.125, "%", "0.125%"],
  [4294967295, " ms", "4294967295 ms"],
  [-1, " ms", "-1 ms"],
])
  test(`P65 formatter preserves raw numeric fact ${expected}`, () =>
    assert.equal(metric()(value, unit), expected));
test("P65 nullable metrics use the same formatter across desktop, mobile summary and detail", () => {
  for (const [field, count] of [
    ["error_rate_percent", 3],
    ["read_p95_ms", 3],
    ["write_p95_ms", 2],
    ["async_lag_seconds", 2],
  ]) {
    assert.equal(
      (template.content.match(new RegExp(`metric\\((?:gate|row)\\.${field},`, "g")) ?? []).length,
      count,
      field,
    );
    assert.doesNotMatch(template.content, new RegExp(`\\{\\{ (?:gate|row)\\.${field} \\}\\}`));
  }
});
test("P65 database nullable metrics are converted to numbers but keep null", () => {
  const repo = readFileSync("apps/api/src/mysql-release-rollout-repository.ts", "utf8");
  for (const field of ["error_rate_percent", "read_p95_ms", "write_p95_ms", "async_lag_seconds"])
    assert.ok(
      repo.includes(`${field}: row.${field} === null ? null : Number(row.${field})`),
      field,
    );
});
