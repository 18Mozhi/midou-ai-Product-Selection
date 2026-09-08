import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export async function buildDiscoveryDesignData(repo) {
  const read = (file) => readFile(path.join(repo, file), "utf8");
  const evaluate = (source) => {
    const context = { exports: {} };
    vm.runInNewContext(
      ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
        .outputText,
      context,
    );
    return context.exports;
  };
  const fixture = await read("tests/e2e/ui-phase2-discovery-shell-contracts.spec.ts");
  const ast = ts.createSourceFile("fixture.ts", fixture, ts.ScriptTarget.Latest, true);
  const required = ["org", "workspace", "taskId", "member", "result", "quickActions", "entries"],
    declarations = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && required.includes(node.name.getText(ast))) {
      const name = node.name.getText(ast);
      assert.equal(declarations.has(name), false, `Duplicate fixture ${name}`);
      declarations.set(name, node.initializer.getText(ast));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(declarations.size, required.length);
  const fixtureData = evaluate(
    required.map((name) => `const ${name} = ${declarations.get(name)};`).join("\n") +
      "\nexport {member, result, quickActions, entries};",
  );
  const overlay = await read("apps/web/src/components/DiscoveryOverlay.vue");
  const purePrefix = overlay
    .split('<script setup lang="ts">')[1]
    .split("const props =")[0]
    .replace(/^import .*;$/gm, "");
  const presentation = evaluate(`${purePrefix}\nexport {STATUS_OPTIONS};`);
  const service = evaluate(await read("apps/api/src/discovery-service.ts"));
  const instance = new service.DiscoveryService({});
  const registeredCapabilities = [
    "task:create",
    "sourcing:read",
    "membership:manage",
    "workspace:manage",
    "provider:configure",
  ];
  const state = evaluate(await read("apps/web/src/ui/state-contract.ts"));
  assert.ok(fixture.includes('searchResult("隔离目标任务")'));
  for (const marker of ["ui2-previous-read", "ui2-previous-trace", "当前请求受阻"])
    assert.ok(fixture.includes(marker));
  return JSON.parse(
    JSON.stringify({
      scope: {
        organization_name: fixtureData.member.organization_name,
        workspace_name: fixtureData.member.workspace_name,
      },
      result: fixtureData.result("隔离目标任务"),
      actions: fixtureData.entries,
      oneAction: fixtureData.quickActions,
      actionPreviews: {
        organization_admin: instance.quickActions(
          ["membership:manage", "workspace:manage"],
          "organization_admin",
        ),
        platform_admin: instance.quickActions(["provider:configure"], "platform_admin"),
        all_registered: instance.quickActions(registeredCapabilities, "member"),
      },
      statusOptions: presentation.STATUS_OPTIONS,
      stateCopy: state.DEFAULT_STATE_COPY,
      failure: {
        hint: "当前请求受阻",
        requestId: "ui2-previous-read",
        traceId: "ui2-previous-trace",
      },
    }),
  );
}
