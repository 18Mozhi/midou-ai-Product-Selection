import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
export const openFixtureFile = "tests/e2e/m06-05-open-platform.spec.ts";
export async function openReviewFixtures() {
  const ast = ts.createSourceFile(
    openFixtureFile,
    await readFile(openFixtureFile, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const declarations = ast.statements
    .filter(ts.isVariableStatement)
    .flatMap((node) => [...node.declarationList.declarations]);
  const get = (name) => {
    const matches = declarations.filter((node) => node.name.getText(ast) === name);
    assert.equal(matches.length, 1, `Unique original fixture ${name}`);
    return matches[0].initializer.getText(ast);
  };
  const evaluate = (text, context = {}) =>
    JSON.parse(JSON.stringify(vm.runInNewContext(`(${text})`, context, { timeout: 1000 })));
  const orgId = evaluate(get("orgId"));
  const fixture = evaluate(get("data"), { orgId });
  const navigation = [];
  function visit(node) {
    if (
      ts.isObjectLiteralExpression(node) &&
      ["shell", "platform_capabilities", "guard_reason"].every((key) =>
        node.properties.some((property) => property.name?.getText(ast) === key),
      )
    )
      navigation.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(navigation.length, 1);
  return { orgId, fixture, nav: evaluate(navigation[0]) };
}
export const openEnvelope = (data) => ({
  data,
  request_id: "p60-local-fixture",
  trace_id: "p60-local-fixture",
});
