import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { buildApprovalsAppPaginationRunner } from "../../scripts/lib/ui-phase2-org-approvals-app-pagination.mjs";

const source = readFileSync("scripts/verify-ui-phase2-org-approvals-vue-c.mjs", "utf8").replaceAll(
  "\r\n",
  "\n",
);
test("P34 App pagination extends the exact driver without replacing existing checks or fixture requests", () => {
  const runner = buildApprovalsAppPaginationRunner(source);
  for (const [, name] of source.matchAll(/check\(\s*"([^"\n]+)"/g))
    assert.ok(runner.includes(JSON.stringify(name)), name);
  assert.ok(runner.includes('requests.every((r) => r.key.startsWith("GET ") && r.body === null)'));
  assert.ok(runner.includes('".org-approval-c-selection-note"'));
  assert.ok(runner.includes("if (capture) await mkdir(output);"));
  assert.ok(runner.includes('output = "output/playwright/p34-pagination-app-c-r3";'));
  assert.equal((runner.match(/await verifyAppPaginationFocus\(/g) || []).length, 2);
  assert.ok(runner.includes("C preview must retain the entire current child script"));
  assert.deepEqual(
    ts.createSourceFile("runner.mjs", runner, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
      .parseDiagnostics,
    [],
  );
});
test("P34 App original-driver contract rejects fixture, assertion and output drift", () => {
  for (const [before, after] of [
    ['requests.every((r) => r.key.startsWith("GET ") && r.body === null)', "true"],
    ['"p34-synthetic-template-"', '"different-fixture-"'],
    ["p34-approvals-vue-c-r4", "p34-approvals-vue-c-r5"],
  ]) {
    assert.ok(source.includes(before));
    assert.throws(
      () => buildApprovalsAppPaginationRunner(source.replace(before, after)),
      /original P34 App driver drift/,
    );
  }
});
test("P34 App validates on-screen ownership before screenshot framing and keeps cleanup in original finally", () => {
  const helper = readFileSync("scripts/lib/ui-phase2-org-approvals-app-pagination.mjs", "utf8");
  const ast = ts.createSourceFile(
    "helper.mjs",
    helper,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const body = ast.statements
    .find(
      (node) => ts.isFunctionDeclaration(node) && node.name?.text === "verifyAppPaginationFocus",
    )
    .body.getText(ast);
  const verifyOrder = (text) => {
    const visibility = text.indexOf("focused status inside viewport"),
      screenshot = text.indexOf("await shot(");
    assert.ok(visibility >= 0 && screenshot > visibility);
  };
  verifyOrder(body);
  assert.throws(() =>
    verifyOrder(
      body.replace("const beforeRequests", 'await shot("unsafe-framing");\nconst beforeRequests'),
    ),
  );
  assert.ok(body.includes("document.elementFromPoint"));
  const runner = buildApprovalsAppPaginationRunner(source);
  assert.ok(runner.includes("await context.close();"));
  assert.ok(
    runner.endsWith("} finally {\n  await browser?.close();\n  await server?.close();\n}\n"),
  );
});
