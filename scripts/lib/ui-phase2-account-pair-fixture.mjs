import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { accountAppFixture, accountFixtureFile } from "./ui-phase2-account-app-fixture.mjs";

export function accountPairFixture(source) {
  const fixture = accountAppFixture(source);
  const ast = ts.createSourceFile(accountFixtureFile, source, ts.ScriptTarget.Latest, true);
  const matches = [];
  const visit = (node) => {
    if (
      ts.isObjectLiteralExpression(node) &&
      ["user", "memberships", "sessions"].every((name) =>
        node.properties.some((property) => property.name?.getText(ast) === name),
      ) &&
      node.getText(ast).includes("id: adminId") &&
      node.getText(ast).includes('email: "admin@example.test"')
    )
      matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.equal(matches.length, 1, "Original administrator detail fixture");
  const adminDetail = JSON.parse(
    JSON.stringify(
      vm.runInNewContext(`const adminId=overview.admins[0].id; (${matches[0].getText(ast)})`, {
        overview: fixture.overview,
      }),
    ),
  );
  assert.equal(adminDetail.user.id, fixture.overview.admins[0].id);
  assert.deepEqual(adminDetail.memberships, []);
  assert.deepEqual(adminDetail.sessions, []);
  return { ...fixture, adminDetail };
}
