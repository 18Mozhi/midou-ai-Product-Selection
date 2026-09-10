import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { baseParse } from "@vue/compiler-dom";

// Source-function comparison only: inert refs/computed getters, not mounted Vue or async scheduling.
export async function loadOrgApprovalFieldContract() {
  const sourceFile = "apps/web/src/components/OrganizationApprovalPanel.vue";
  const source = await readFile(sourceFile, "utf8");
  const { descriptor } = parse(source);
  const inputs = [];
  function walk(n) {
    if (n.type === 1) {
      const binding = n.props.find((p) => p.type === 7 && p.name === "model")?.exp?.content;
      if (binding) {
        const attrs = Object.fromEntries(
          n.props.filter((p) => p.type === 6).map((p) => [p.name, p.value?.content ?? ""]),
        );
        const options = (n.children || [])
          .filter((c) => c.type === 1 && c.tag === "option")
          .map((o) => ({
            value: o.props.find((p) => p.type === 6 && p.name === "value")?.value?.content,
            dynamic: o.props.some((p) => p.type === 7 && p.name === "for"),
          }));
        inputs.push({ binding, tag: n.tag, attrs, options });
      }
    }
    for (const child of n.children || []) walk(child);
  }
  walk(baseParse(descriptor.template.content));
  assert.equal(inputs.length, 10);
  const ast = ts.createSourceFile(
    "approval.ts",
    descriptor.scriptSetup.content,
    ts.ScriptTarget.Latest,
    true,
  );
  const script = ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(ast))
    .join("\n");
  const keys = inputs
    .map((i) => i.binding)
    .concat("filteredRequests", "filteredTemplates", "workspaces");
  const compiled = ts.transpileModule(`${script}\nexport const fields={${keys.join(",")}};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  function evaluate(state) {
    const payload = JSON.parse(JSON.stringify(state));
    const box = {
      exports: {},
      defineProps: () => ({
        approvals: payload.items,
        templates: payload.templates,
        summary: payload.summary,
      }),
      useRoute: () => ({ path: "/org-admin/approvals", query: {} }),
      useRouter: () => ({ replace: () => Promise.resolve() }),
      ref: (value) => ({ value }),
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
      nextTick: async () => {},
      watch: (get, cb, opts) => {
        if (opts?.immediate) cb(get());
      },
    };
    vm.runInNewContext(compiled, box);
    for (const kind of ["request", "template"])
      for (const key of ["query", "status", "workspace", "resource", "sort"])
        box.exports.fields[kind + key[0].toUpperCase() + key.slice(1)].value = state[kind][key];
    return JSON.parse(
      JSON.stringify({
        requests: box.exports.fields.filteredRequests.value.map((r) => r.id),
        templates: box.exports.fields.filteredTemplates.value.map((t) => t.id),
        workspaces: box.exports.fields.workspaces.value,
      }),
    );
  }
  return { sourceFile, inputs, evaluate };
}
