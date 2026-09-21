import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { statusReviewFixtures } from "./status-review-fixtures.mjs";
export const releaseFixtureFile = "tests/e2e/m07-05-release-rollout.spec.ts";
export async function releaseReviewFixtures() {
  const ast = ts.createSourceFile(
    releaseFixtureFile,
    await readFile(releaseFixtureFile, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const statements = ast.statements.filter(
    (s) =>
      (ts.isVariableStatement(s) &&
        s.declarationList.declarations.some((d) =>
          ["gates", "base"].includes(d.name.getText(ast)),
        )) ||
      (ts.isExpressionStatement(s) &&
        ts.isCallExpression(s.expression) &&
        s.expression.expression.getText(ast) === "gates.push"),
  );
  assert.equal(statements.length, 3);
  const js = ts.transpile(
    statements.map((s) => s.getText(ast)).join("\n") + "\nJSON.stringify(base)",
    { target: ts.ScriptTarget.ES2022 },
  );
  const base = JSON.parse(vm.runInNewContext(js, {}, { timeout: 1000 }));
  // Original E2E intentionally retained: verified with rollback gate but rollback_verified=false.
  return { fixture: { ...base, state: "verified" }, nav: (await statusReviewFixtures()).nav };
}
