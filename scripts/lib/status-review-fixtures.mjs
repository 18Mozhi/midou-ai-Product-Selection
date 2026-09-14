import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
export const statusFixtureFile = "tests/e2e/m06-02-platform-dashboard.spec.ts";
export async function statusReviewFixtures() {
  const ast = ts.createSourceFile(
    statusFixtureFile,
    await readFile(statusFixtureFile, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const tests = [];
  const visit = (n, fn) => {
    fn(n);
    ts.forEachChild(n, (c) => visit(c, fn));
  };
  visit(ast, (n) => {
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(ast) === "test" &&
      n.arguments[0]?.text ===
        "system status aggregates real operations observations and management links"
    )
      tests.push(n);
  });
  assert.equal(tests.length, 1);
  const objects = [];
  visit(tests[0], (n) => {
    if (ts.isObjectLiteralExpression(n)) objects.push(n);
  });
  const get = (key) => {
    const matches = objects.filter((n) => n.properties.some((p) => p.name?.getText(ast) === key));
    assert.equal(matches.length, 1, key);
    return matches[0].getText(ast);
  };
  const evaluate = (s, context = {}) =>
    JSON.parse(JSON.stringify(vm.runInNewContext(`(${s})`, context, { timeout: 1000 })));
  const navs = [];
  visit(ast, (n) => {
    if (
      ts.isObjectLiteralExpression(n) &&
      n.properties.some((p) => p.name?.getText(ast) === "platform_capabilities")
    )
      navs.push(n);
  });
  assert.equal(navs.length, 1);
  return {
    fixture: evaluate(get("domain")),
    metrics: evaluate(get("session_started_at")),
    nav: evaluate(navs[0].getText(ast), {
      platformRole: "platform_operations_admin",
      platformCapability: "platform:operate",
    }),
  };
}
export const statusEnvelope = (data) => ({
  data,
  request_id: "p61-local-fixture",
  trace_id: "p61-local-fixture",
});
