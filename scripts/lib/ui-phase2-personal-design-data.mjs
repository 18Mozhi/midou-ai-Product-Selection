import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export async function buildPersonalDesignData(repo) {
  async function extract(file, name) {
    const source = await readFile(path.join(repo, file), "utf8");
    const text = file.endsWith(".vue")
      ? source.split('<script setup lang="ts">')[1].split("</script>")[0]
      : source;
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const found = [];
    function visit(node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name)
        found.push(node.initializer.getText(ast));
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.equal(found.length, 1, `${file}:${name}`);
    const context = { exports: {}, reactive: (value) => value };
    vm.runInNewContext(
      ts.transpileModule(`export const value = ${found[0]};`, {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      }).outputText,
      context,
    );
    return JSON.parse(JSON.stringify(context.exports.value));
  }
  const sections = await extract("apps/web/src/components/AccountShell.vue", "sections");
  const profile = await extract("tests/e2e/ui-phase2-account-contracts.spec.ts", "profile");
  const form = await extract("apps/web/src/components/PersonalCenter.vue", "form");
  const catalog = JSON.parse(await readFile(path.join(repo, "config/route-catalog.json"), "utf8"));
  const route = catalog.routes.find((item) => item.path === "/me");
  assert.equal(route.sessionRequired, true);
  return { sections, profile, form, sessionRequired: route.sessionRequired };
}
