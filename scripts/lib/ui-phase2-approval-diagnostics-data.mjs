import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export async function approvalDiagnosticsData(repo) {
  const read = async (file) =>
    (await readFile(path.join(repo, file), "utf8")).replaceAll("\r\n", "\n");
  const fixture = await read("tests/e2e/m05-02-approval-workflow.spec.ts");
  const source = await read("apps/web/src/components/ApprovalWorkspace.vue");
  const fixtureAst = ts.createSourceFile("fixture.ts", fixture, ts.ScriptTarget.Latest, true);
  const responses = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(fixtureAst) === "route.fulfill") {
      const literal = node.arguments[0]?.getText(fixtureAst);
      if (literal?.includes('request_id: "ui2-an-conflict"')) responses.push(literal);
    }
    ts.forEachChild(node, visit);
  }
  visit(fixtureAst);
  assert.equal(responses.length, 1);
  const response = vm.runInNewContext(`(${responses[0]})`);
  assert.equal(response.status, 409);
  assert.equal(response.json.error.code, "approval_version_conflict");
  const ast = ts.createSourceFile(
    "source.ts",
    source.split('<script setup lang="ts">')[1].split("</script>")[0],
    ts.ScriptTarget.Latest,
    true,
  );
  const functions = ["api", "closeDetail"].map((name) => {
    const matches = ast.statements.filter(
      (n) => ts.isFunctionDeclaration(n) && n.name?.text === name,
    );
    assert.equal(matches.length, 1, name);
    return matches[0].getText(ast);
  });
  assert.match(
    source,
    /<div v-if="notice" class="approval-notice" aria-live="polite">\s*\{\{ notice \}\}\s*<details v-if="requestId">\s*<summary>技术详情<\/summary>\s*<code>\{\{ requestId \}\}<\/code>/u,
  );
  // Isolated error boundary, not a replacement for ApiClientError's HTTP parser.
  class BoundaryError extends Error {
    constructor(body) {
      super(body.error.message);
      this.kind = "conflict";
      this.requestId = body.request_id;
      this.actionHint = body.error.action_hint;
    }
  }
  async function execute(error) {
    const requestId = { value: "" },
      notice = { value: "" },
      state = { value: "ready" };
    const context = {
      exports: {},
      requestId,
      notice,
      state,
      ApiClientError: BoundaryError,
      request: async () => {
        throw error;
      },
      selected: { value: { id: "isolated-boundary" } },
      router: { replace: async () => {} },
      route: { query: {} },
    };
    vm.runInNewContext(
      ts.transpileModule(`${functions.join("\n")} export {api, closeDetail};`, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      context,
    );
    await assert.rejects(context.exports.api("/isolated", {}, false), (thrown) => thrown === error);
    await context.exports.closeDetail();
    assert.equal(context.selected.value, null);
    assert.equal(state.value, "ready");
    const display = { notice: notice.value, requestId: requestId.value };
    // A later unrelated successful response overwrites the shared ID, not the notice.
    context.request = async () => ({ data: [], request_id: "later-response-boundary" });
    await context.exports.api("/isolated-later", {}, false);
    assert.equal(requestId.value, "later-response-boundary");
    assert.equal(notice.value, display.notice);
    return display;
  }
  const conflict = await execute(new BoundaryError(response.json));
  const unexpected = await execute(new Error("isolated unexpected failure"));
  assert.deepEqual(conflict, {
    notice: response.json.error.action_hint,
    requestId: response.json.request_id,
  });
  assert.deepEqual(unexpected, { notice: "稍后重试。", requestId: "" });
  return {
    conflict,
    unexpected,
    provenance:
      "409 response from existing UI2-AN04 fixture; source api/closeDetail isolated with error-parser boundary stub. Unexpected fallback is an isolated Error, not a server response.",
    sharedIdOverwrite:
      "Source later response overwrites page ID while retaining earlier notice; unchanged, no per-dialog ownership claim.",
  };
}
