import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { statusReviewFixtures } from "./status-review-fixtures.mjs";
export const topologyFixtureFile = "tests/e2e/m08-01-single-server.spec.ts";
export const topologyPolicyFile = "apps/worker/src/worker-queue-registry.ts";
export async function topologyReviewFixtures() {
  const extract = async (file, names, expression) => {
    const ast = ts.createSourceFile(
      file,
      await readFile(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const statements = ast.statements.filter(
      (s) =>
        ts.isVariableStatement(s) &&
        s.declarationList.declarations.some((d) => names.includes(d.name.getText(ast))),
    );
    assert.equal(statements.length, names.length, file + " exact fixture declarations");
    const code = statements.map((s) => s.getText(ast).replace(/^export /, "")).join("\n");
    return JSON.parse(
      vm.runInNewContext(
        ts.transpile(code + `\nJSON.stringify(${expression})`, { target: ts.ScriptTarget.ES2022 }),
        {},
        { timeout: 1000 },
      ),
    );
  };
  // Preserve original partial E2E values and timestamps; do not recompute a healthy verdict.
  return {
    fixture: await extract(topologyFixtureFile, ["node", "base"], "base"),
    policies: await extract(
      topologyPolicyFile,
      ["policy", "WORKER_QUEUE_POLICIES"],
      "WORKER_QUEUE_POLICIES",
    ),
    nav: (await statusReviewFixtures()).nav,
  };
}
