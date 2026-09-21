import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { previewShellVue } from "./ui-phase2-shell-vue-preview.mjs";

export const journeyFixtureFile = "tests/e2e/ui-phase2-journey-contracts.spec.ts";
export const journeyCompositionCss =
  "design-plans/ui-phase-2-2026-09-07/implementation/shell-journey-vue-c.css";
export function previewShellJourney(source) {
  const result = previewShellVue(source);
  const before =
    'v-for="item in primaryItems"\n        :key="item.path"\n        :to="item.path"\n        :aria-current="activeItem?.path === item.path ? \'page\' : undefined"';
  assert.equal(result.split(before).length, 2, "Inspect primary-item active indicator");
  return result.replace(
    before,
    before.replace("activeItem?.path ===", "!moreActive && activeItem?.path ==="),
  );
}
export async function buildShellJourneyFixture() {
  const source = await readFile(journeyFixtureFile, "utf8");
  const ast = ts.createSourceFile(journeyFixtureFile, source, ts.ScriptTarget.Latest, true);
  const nodes = [];
  const visit = (node) => {
    nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  const variable = (name) => {
    const matches = nodes.filter(
      (node) => ts.isVariableDeclaration(node) && node.name.getText(ast) === name,
    );
    assert.equal(matches.length, 1, name);
    return `const ${name}=${matches[0].initializer.getText(ast)};`;
  };
  const fn = (name) => {
    const matches = nodes.filter(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
    );
    assert.equal(matches.length, 1, name);
    return matches[0].getText(ast);
  };
  const guard = nodes.filter(
    (node) =>
      ts.isObjectLiteralExpression(node) &&
      node.properties.some(
        (prop) =>
          ts.isPropertyAssignment(prop) &&
          prop.name.getText(ast) === "guard_reason" &&
          prop.initializer.getText(ast) === '"allowed"',
      ),
  );
  assert.equal(guard.length, 1);
  const box = {};
  vm.runInNewContext(
    ts.transpileModule(
      ["id", "journeyId", "at", "storageKey"].map(variable).join("\n") +
        fn("fixture") +
        fn("qualify") +
        `const data={journey:fixture()};data.journey.first_result=data.journey.results[0];qualify(data);globalThis.result={journey:data.journey,navigation:${guard[0].getText(ast)},storageKey};`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
    ).outputText,
    box,
  );
  return JSON.parse(JSON.stringify(box.result));
}
