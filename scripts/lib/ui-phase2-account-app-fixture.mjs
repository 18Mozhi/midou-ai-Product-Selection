import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";

export const accountFixtureFile = "tests/e2e/m06-01-platform-accounts.spec.ts";

// Read established E2E examples, not a second invented API schema.
export function accountAppFixture(source) {
  const ast = ts.createSourceFile(accountFixtureFile, source, ts.ScriptTarget.Latest, true);
  const declarations = ast.statements
    .filter(ts.isVariableStatement)
    .flatMap((node) => [...node.declarationList.declarations]);
  const names = ["user", "org", "session", "overview", "platformRoles"];
  const code = names.map((name) => {
    const matches = declarations.filter((node) => node.name.getText(ast) === name);
    assert.equal(matches.length, 1, `Fixture declaration ${name}`);
    return `const ${name}=${matches[0].initializer.getText(ast)};`;
  });
  const objects = [];
  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node)) objects.push(node);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const keys = (node, names) =>
    names.every((name) => node.properties.some((property) => property.name?.getText(ast) === name));
  const unique = (matches, label) => {
    assert.equal(matches.length, 1, label);
    return matches[0].getText(ast);
  };
  const detail = unique(
    objects.filter(
      (node) =>
        keys(node, ["user", "memberships", "sessions"]) &&
        node.getText(ast).includes('device_label: "Chrome"'),
    ),
    "Original Chrome detail fixture",
  );
  const navigation = unique(
    objects.filter((node) => keys(node, ["shell", "platform_capabilities", "guard_reason"])),
    "Original navigation fixture",
  );
  const dashboards = objects.filter((node) => keys(node, ["window", "summary", "health_signals"]));
  assert.ok(dashboards.length > 0, "Original dashboard fixture");
  // Several existing history tests repeat this exact fixture. Fail on schema/value drift.
  const evaluate = (expression) =>
    JSON.parse(JSON.stringify(vm.runInNewContext(`${code.join("\n")}\n(${expression})`)));
  const dashboard = evaluate(dashboards[0].getText(ast));
  for (const node of dashboards) assert.deepEqual(evaluate(node.getText(ast)), dashboard);
  const result = evaluate(`{overview,platformRoles,navigation:${navigation},detail:${detail}}`);
  assert.equal(result.detail.memberships[0].organization_id, undefined);
  return { ...result, dashboard };
}
