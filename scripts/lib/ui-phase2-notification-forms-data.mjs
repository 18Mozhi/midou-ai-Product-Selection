import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";

export async function buildNotificationFormsData(repo) {
  const source = await readFile(
    path.join(repo, "apps/web/src/components/NotificationCenter.vue"),
    "utf8",
  );
  const parsed = parse(source);
  assert.deepEqual(parsed.errors, []);
  const fields = [];
  function visit(node) {
    if (node.type === 1 && node.tag === "input") {
      const model = node.props.find((p) => p.type === 7 && p.name === "model")?.exp?.content;
      if (model?.startsWith("preferences."))
        fields.push({
          key: model.slice(12),
          binding: model,
          type: node.props.find((p) => p.type === 6 && p.name === "type")?.value?.content,
          disabled: node.props.some((p) => p.type === 6 && p.name === "disabled"),
          required: node.props.some((p) => p.type === 6 && p.name === "required"),
        });
    }
    for (const child of node.children ?? []) visit(child);
  }
  visit(baseParse(parsed.descriptor.template.content));
  assert.deepEqual(
    fields.map((v) => v.key),
    ["in_app_enabled", "email_enabled", "task_enabled", "approval_enabled", "competitor_enabled"],
  );
  for (const field of fields) {
    assert.equal(field.type, "checkbox");
    assert.equal(field.required, false);
    assert.equal(field.disabled, field.key === "email_enabled");
  }
  const ast = ts.createSourceFile(
    "notification.ts",
    parsed.descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
  );
  const fn = ast.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === "api");
  assert.ok(fn);
  const clientSource = await readFile(path.join(repo, "apps/web/src/api-client.ts"), "utf8");
  const compile = (code) =>
    ts.transpileModule(code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
  const diagnostics = [];
  for (const [status, expected] of [
    [500, "error"],
    [403, "forbidden"],
    [401, "expired"],
    [429, "rate_limited"],
    [409, "version_conflict"],
  ]) {
    let requests = 0;
    const id = `P26-REVIEW-${status}`;
    const client = {
      exports: {},
      Headers,
      Response,
      crypto: { randomUUID: () => "review-generated-id" },
      window: {
        setTimeout: (fn) => {
          fn();
          return 0;
        },
      },
      fetch: async () => {
        requests++;
        return new Response(JSON.stringify({ request_id: id }), {
          status,
          headers: { "content-type": "application/json" },
        });
      },
    };
    vm.runInNewContext(compile(clientSource), client);
    const box = {
      exports: {},
      request: client.exports.createApiClient("https://inert.invalid/api/v1"),
      ApiClientError: client.exports.ApiClientError,
      requestId: { value: "" },
      state: { value: "ready" },
      notice: { value: "" },
    };
    vm.runInNewContext(compile(fn.getText(ast) + "\nexport {api};"), box);
    await assert.rejects(box.exports.api("/notifications?page=1"), client.exports.ApiClientError);
    assert.equal(box.state.value, expected);
    assert.equal(box.requestId.value, id);
    assert.equal(box.notice.value, "请求未完成，请稍后重试。");
    assert.equal(requests, status === 429 ? 3 : 1);
    diagnostics.push({
      status,
      scene: expected,
      requestId: box.requestId.value,
      notice: box.notice.value,
      inertAttempts: requests,
    });
  }
  return {
    fields,
    diagnostics,
    boundary:
      "合成错误响应经真实api-client及NotificationCenter.api隔离执行；不请求网络、不证明服务或在途结果归属。编号是审核样本，不是真实请求。",
  };
}
