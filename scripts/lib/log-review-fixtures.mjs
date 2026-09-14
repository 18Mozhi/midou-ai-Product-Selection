import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { statusReviewFixtures, statusFixtureFile } from "./status-review-fixtures.mjs";
export { statusFixtureFile as logFixtureFile };
export async function logReviewFixtures() {
  const ast = ts.createSourceFile(
      statusFixtureFile,
      await readFile(statusFixtureFile, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    ),
    tests = [],
    objects = [];
  const walk = (n, f) => {
    f(n);
    ts.forEachChild(n, (c) => walk(c, f));
  };
  walk(ast, (n) => {
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(ast) === "test" &&
      n.arguments[0]?.text ===
        "chain logs group trace events and deep-link exceptional task and source facts"
    )
      tests.push(n);
  });
  assert.equal(tests.length, 1);
  walk(tests[0], (n) => {
    if (
      ts.isObjectLiteralExpression(n) &&
      n.properties.some((p) => p.name?.getText(ast) === "domain")
    )
      objects.push(n);
  });
  assert.equal(objects.length, 1);
  return {
    fixture: JSON.parse(
      JSON.stringify(
        vm.runInNewContext("(" + objects[0].getText(ast) + ")", {}, { timeout: 1000 }),
      ),
    ),
    nav: (await statusReviewFixtures()).nav,
  };
}
export const logEnvelope = (data) => ({
  data,
  request_id: "p62-local-fixture",
  trace_id: "p62-local-fixture",
});
