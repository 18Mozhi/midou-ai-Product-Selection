import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

export const securityFixtureFile = "tests/e2e/m06-04-security-operations.spec.ts";
export async function securityReviewFixtures() {
  const ast = ts.createSourceFile(
    securityFixtureFile,
    await readFile(securityFixtureFile, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const dataNodes = ast.statements
    .filter(ts.isVariableStatement)
    .flatMap((node) => [...node.declarationList.declarations])
    .filter((node) => node.name.getText(ast) === "data");
  assert.equal(dataNodes.length, 1);
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
  const evaluate = (text) =>
    JSON.parse(JSON.stringify(vm.runInNewContext(`(${text})`, {}, { timeout: 1000 })));
  const fixture = evaluate(dataNodes[0].initializer.getText(ast)),
    nav = evaluate(navigation[0]);
  function snapshot(view) {
    const data = structuredClone(fixture);
    data.view = view;
    const keys = {
      events: ["security_events"],
      sessions: ["sessions"],
      credentials: ["credential_assets", "organization_tokens"],
      audit: ["audit_events"],
    }[view];
    assert.ok(keys);
    for (const key of Object.keys(data.pagination)) {
      if (!keys.includes(key)) data[key] = [];
      data.pagination[key] = { page: 1, page_size: 20, total: data[key].length, total_pages: 1 };
    }
    return data;
  }
  return { fixture, nav, snapshot };
}
export const securityEnvelope = (data, request_id = "security-local-fixture") => ({
  data,
  request_id,
  trace_id: request_id,
});
