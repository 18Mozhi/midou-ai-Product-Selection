import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { statusReviewFixtures } from "./status-review-fixtures.mjs";
export const backupFixtureFile = "tests/e2e/m07-04-backup-recovery.spec.ts";
export async function backupReviewFixtures() {
  const ast = ts.createSourceFile(
    backupFixtureFile,
    await readFile(backupFixtureFile, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const declarations = ast.statements
    .filter(ts.isVariableStatement)
    .flatMap((s) => s.declarationList.declarations);
  const bases = declarations.filter((d) => d.name.getText(ast) === "base");
  assert.equal(bases.length, 1);
  const base = JSON.parse(
    JSON.stringify(
      vm.runInNewContext("(" + bases[0].initializer.getText(ast) + ")", {}, { timeout: 1000 }),
    ),
  );
  return { fixture: { ...base, state: "blocked" }, nav: (await statusReviewFixtures()).nav };
}
