import { readCaptureSourceRevision } from "../../scripts/lib/ui-phase2-token-copy-baseline.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { buildTemplateKeyboardRunner } from "../../scripts/lib/ui-phase2-org-approvals-template-keyboard.mjs";

// Retired exact driver; current capture entry points remain strict.
const source = readCaptureSourceRevision(
  "scripts/verify-ui-phase2-org-approvals-vue-c.mjs",
  "01db5a52a7073d15d9964b0fad8b451f9da44bf1725a51bfea84e3d677666907",
);
test("Archived P34 template keyboard extension retains original and pagination checks, fixtures and cleanup", () => {
  const runner = buildTemplateKeyboardRunner(source);
  for (const [, name] of source.matchAll(/check\(\s*"([^"\n]+)"/g))
    assert.ok(runner.includes(JSON.stringify(name)), name);
  assert.equal((runner.match(/await verifyAppPaginationFocus\(/g) || []).length, 2);
  assert.equal((runner.match(/await verifyTemplateKeyboard\(/g) || []).length, 1);
  assert.equal((runner.match(/await verifyCrossPageTemplate\(/g) || []).length, 1);
  assert.ok(runner.includes('requests.every((r) => r.key.startsWith("GET ") && r.body === null)'));
  assert.ok(runner.includes("if (capture) await mkdir(output);"));
  assert.ok(runner.includes('output = "output/playwright/p34-template-keyboard-c-r1";'));
  assert.ok(runner.includes("await context.close();"));
  assert.ok(
    runner.endsWith("} finally {\n  await browser?.close();\n  await server?.close();\n}\n"),
  );
  assert.deepEqual(
    ts.createSourceFile("runner.mjs", runner, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
      .parseDiagnostics,
    [],
  );
});
test("Archived P34 template keyboard extension fails closed when original read-only contract changes", () => {
  assert.throws(
    () => buildTemplateKeyboardRunner(source.replace('r.key.startsWith("GET ")', "true")),
    /original P34 App driver drift/,
  );
});
test("Archived P34 technical focus assertions precede screenshots and preserve real keyboard traversal", () => {
  const helper = readFileSync("scripts/lib/ui-phase2-org-approvals-template-keyboard.mjs", "utf8");
  const ast = ts.createSourceFile(
    "helper.mjs",
    helper,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const body = ast.statements
    .find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "verifyTemplateKeyboard")
    .body.getText(ast);
  assert.ok(body.includes('page.keyboard.press("Tab")'));
  assert.ok(!body.includes("summary.focus()") && !body.includes("scrollIntoView"));
  assert.ok(body.indexOf('"expanded technical "') < body.indexOf("await shot("));
  assert.ok(body.includes('"technical ID initially hidden "'));
  assert.ok(body.includes('"template keyboard adds no API requests"'));
});
