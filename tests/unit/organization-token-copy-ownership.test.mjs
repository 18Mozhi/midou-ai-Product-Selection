import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { computed, effectScope, nextTick, reactive, ref, watch } from "vue";

const file = "apps/web/src/components/OrganizationTokenPanel.vue";
const current = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const baseline = execFileSync("git", ["show", `b4fc398d:${file}`], { encoding: "utf8" }).replaceAll(
  "\r\n",
  "\n",
);
function mount(t, source = current) {
  const script = parse(source).descriptor.scriptSetup.content;
  const ast = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true);
  const compiled = ts.transpileModule(
    ast.statements
      .filter((node) => !ts.isImportDeclaration(node))
      .map((node) => node.getFullText(ast))
      .join("\n"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const scope = effectScope();
  t.after(() => scope.stop());
  const props = reactive({ tokens: [], secret: "synthetic-A", busy: false });
  const route = reactive({ path: "/org-admin/tokens", query: {} });
  const requests = [],
    hooks = {};
  const bindings = {
    computed,
    ref,
    watch,
    nextTick,
    defineProps: () => props,
    useRoute: () => route,
    useRouter: () => ({ replace: async () => {} }),
    onDeactivated: (fn) => {
      hooks.deactivate = fn;
    },
    onBeforeUnmount: (fn) => {
      hooks.unmount = fn;
    },
    navigator: {
      clipboard: {
        writeText: (value) =>
          new Promise((resolve, reject) => requests.push({ value, resolve, reject })),
      },
    },
  };
  const state = scope.run(() =>
    new Function(...Object.keys(bindings), compiled + "\nreturn {copySecret,copyState};")(
      ...Object.values(bindings),
    ),
  );
  return { ...state, props, route, requests, hooks };
}
for (const outcome of ["success", "failure"]) {
  for (const change of [
    "stay",
    "replace",
    "clear",
    "same-again",
    "route",
    "deactivate",
    "unmount",
  ]) {
    test(`token clipboard ${outcome} after ${change} stays with original display`, async (t) => {
      const h = mount(t),
        pending = h.copySecret();
      assert.equal(h.requests[0].value, "synthetic-A");
      if (change === "replace") h.props.secret = "synthetic-B";
      if (change === "clear") h.props.secret = "";
      if (change === "same-again") {
        h.props.secret = "";
        h.props.secret = "synthetic-A";
      }
      if (change === "route") h.route.path = "/org-admin/data";
      if (change === "deactivate") h.hooks.deactivate?.();
      if (change === "unmount") h.hooks.unmount?.();
      if (outcome === "success") h.requests[0].resolve();
      else h.requests[0].reject(Error("synthetic denial"));
      await pending;
      await nextTick();
      assert.equal(
        h.copyState.value,
        change === "stay" ? (outcome === "success" ? "copied" : "failed") : "",
      );
    });
  }
}
test("latest copy result wins if requests settle in reverse order", async (t) => {
  const h = mount(t),
    first = h.copySecret(),
    second = h.copySecret();
  h.requests[1].reject(Error("second denied"));
  await second;
  assert.equal(h.copyState.value, "failed");
  h.requests[0].resolve();
  await first;
  assert.equal(h.copyState.value, "failed");
});
test("completed feedback clears synchronously when secret or route changes", async (t) => {
  const h = mount(t),
    pending = h.copySecret();
  h.requests[0].resolve();
  await pending;
  assert.equal(h.copyState.value, "copied");
  h.props.secret = "synthetic-B";
  assert.equal(h.copyState.value, "");
});
test("pre-fix source reproduces stale replacement feedback", async (t) => {
  const h = mount(t, baseline),
    pending = h.copySecret();
  h.props.secret = "synthetic-B";
  await nextTick();
  h.requests[0].resolve();
  await pending;
  assert.equal(h.copyState.value, "copied");
});
test("copy ownership change preserves template and original non-copy functions", () => {
  assert.equal(
    parse(current).descriptor.template.content,
    parse(baseline).descriptor.template.content,
  );
  const functions = (source) => {
    const ast = ts.createSourceFile(
      file,
      parse(source).descriptor.scriptSetup.content,
      ts.ScriptTarget.Latest,
      true,
    );
    return Object.fromEntries(
      ast.statements
        .filter(
          (node) =>
            ts.isFunctionDeclaration(node) &&
            !["copySecret", "invalidateTokenCopy"].includes(node.name.text),
        )
        .map((node) => [node.name.text, node.getText(ast)]),
    );
  };
  assert.deepEqual(functions(current), functions(baseline));
});
