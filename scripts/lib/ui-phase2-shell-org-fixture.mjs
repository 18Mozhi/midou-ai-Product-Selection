import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

export const orgFixtureFile = "tests/e2e/m06-01-organization-admin.spec.ts";
export const orgReviewCss = "design-plans/ui-phase-2-2026-09-07/implementation/shell-org-vue-c.css";
export function previewOrgSummary(source) {
  const before = "<h2>{{ title }}</h2>";
  assert.equal(source.split(before).length, 2, "Organization heading anchor changed");
  return source.replace(
    before,
    '<h2>{{ view === "summary" && data?.name ? data.name : title }}</h2>',
  );
}
export async function buildShellOrgFixture() {
  const source = await readFile(orgFixtureFile, "utf8");
  const ast = ts.createSourceFile(orgFixtureFile, source, ts.ScriptTarget.Latest, true);
  const nodes = [];
  function visit(node) {
    nodes.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const names = ["org", "ws", "summary", "profile", "workspaces"];
  const declarations = names.map((name) => {
    const matches = nodes.filter(
      (node) => ts.isVariableDeclaration(node) && node.name.getText(ast) === name,
    );
    assert.equal(matches.length, 1, `Ambiguous ${name}`);
    return `const ${name}=${matches[0].initializer.getText(ast)};`;
  });
  const guards = nodes.filter(
    (node) =>
      ts.isObjectLiteralExpression(node) &&
      node.properties.some(
        (prop) =>
          ts.isPropertyAssignment(prop) &&
          prop.name.getText(ast) === "guard_reason" &&
          prop.initializer.getText(ast) === '"navigation_organization_admin_allowed"',
      ),
  );
  assert.equal(guards.length, 1, "Original organization guard must be unique");
  const box = {};
  vm.runInNewContext(
    ts.transpileModule(
      declarations.join("\n") +
        `globalThis.result={summary,profile,workspaces,navigation:${guards[0].getText(ast)}};`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    box,
  );
  return JSON.parse(JSON.stringify(box.result));
}
