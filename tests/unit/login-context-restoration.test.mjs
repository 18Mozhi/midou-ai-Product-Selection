import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";

const source = parse(readFileSync("apps/web/src/components/LocalIdentity.vue", "utf8")).descriptor
  .scriptSetup.content;
const ast = ts.createSourceFile("identity.ts", source, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === "enterApplication",
);
assert.ok(declaration);
const compiled = ts.transpileModule(
  declaration.getText(ast) + "\nglobalThis.run = enterApplication;",
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;

async function enter(redirect, result = { data: { route: "/home" } }) {
  const events = [];
  const sandbox = {
    params: new URLSearchParams(redirect ? { redirect } : {}),
    request: async (...args) => {
      events.push(["request", ...args]);
      return result;
    },
    router: {
      replace: async (route) => {
        events.push(["route", route]);
      },
    },
  };
  vm.runInNewContext(compiled, sandbox);
  await sandbox.run();
  return events;
}

for (const redirect of [undefined, "/approvals?view=pending", "//outside.example/"])
  test(`login restores authorized context before navigation: ${redirect ?? "default"}`, async () => {
    assert.deepEqual(await enter(redirect), [
      ["request", "/me/landing", undefined, "GET"],
      ["route", redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/home"],
    ]);
  });
test("a failed landing read cannot bypass context restoration through a redirect", async () => {
  assert.deepEqual(await enter("/approvals", null), [["request", "/me/landing", undefined, "GET"]]);
});
