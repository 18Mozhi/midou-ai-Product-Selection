import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { ref, watch } from "vue";
import { buildAutomationDesignData } from "../../scripts/lib/ui-phase2-automation-design-data.mjs";

const data = await buildAutomationDesignData(process.cwd());
const a = data.list[0];
const b = { ...a, id: "00000000-0000-4000-8000-000000000902", name: "合成规则B" };
const plain = (v) => JSON.parse(JSON.stringify(v));
const env = (data, request_id = "current") => ({ data, request_id });
const source = (await readFile("apps/web/src/components/AutomationRuleCenter.vue", "utf8"))
  .split('<script setup lang="ts">')[1]
  .split("</script>")[0];
const ast = ts.createSourceFile("automation.ts", source, ts.ScriptTarget.Latest, true);
const code = ts.transpileModule(
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getText(ast))
    .join("\n") +
    "\nexport const ui={create,status,load,open,edit,openCreator,closeEditor,closeDetail,applyRouteState,form,editing,editReason,showCreate,selected,rules,memberOptions,state,notice,requestId,busy,editorFormElement};",
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
class Failure extends Error {
  kind = "conflict";
  requestId = "old-write-error";
  actionHint = "合成版本冲突";
}
function harness(t, transport, navigation) {
  const hooks = [],
    calls = [],
    navigations = [];
  const route = { path: "/automations", fullPath: "/automations", query: {} };
  const box = {
    exports: {},
    ref,
    watch: (...args) => {
      const stop = watch(...args);
      hooks.push(stop);
      return stop;
    },
    onMounted: () => {},
    onUnmounted: (fn) => hooks.push(fn),
    defineProps: () => ({ apiBaseUrl: "/api/v1" }),
    useRoute: () => route,
    useRouter: () => ({ push: navigate, replace: navigate }),
    useModalDialog: () => ({ dialogElement: ref(null), handleCancel: () => {} }),
    ApiClientError: Failure,
    rethrowUnexpectedError: (e) => {
      if (!(e instanceof Failure)) throw e;
    },
    createApiClient:
      () =>
      async (url, opts = {}) => {
        calls.push({ url, ...plain(opts) });
        if (opts.method) return transport(url, opts);
        if (url === "/automations") return env([a, b], "list");
        if (url === "/tasks/member-options") return env(data.members, "members");
        return env({ ...(url.endsWith(b.id) ? b : a), executions: [] }, "detail");
      },
  };
  async function navigate(value) {
    navigations.push(plain(value));
    await navigation?.(value);
  }
  vm.runInNewContext(code, box);
  const ui = box.exports.ui;
  ui.editorFormElement.value = { reportValidity: () => true };
  ui.rules.value = [a, b];
  const dispose = () => hooks.forEach((fn) => fn());
  t.after(dispose);
  return { ui, route, calls, navigations, dispose };
}
const snapshot = (ui) =>
  plain({
    form: ui.form.value,
    editing: ui.editing.value,
    reason: ui.editReason.value,
    open: ui.showCreate.value,
    selected: ui.selected.value,
    rows: ui.rules.value,
    state: ui.state.value,
    notice: ui.notice.value,
    requestId: ui.requestId.value,
  });

for (const operation of ["create", "edit", "status"]) {
  for (const outcome of ["success", "error"]) {
    for (const transition of ["new-editor", "route", "destroy"]) {
      test(`P27 ${operation} late ${outcome} cannot mutate ${transition}`, async (t) => {
        const pending = deferred();
        const h = harness(t, () => pending.promise),
          { ui } = h;
        if (operation === "create") await ui.openCreator();
        else if (operation === "edit") ui.edit(a, false);
        const writing = operation === "status" ? ui.status(a) : ui.create();
        if (transition === "new-editor") {
          ui.closeEditor();
          ui.edit(b, false);
          ui.form.value.name = "后来草稿";
        } else if (transition === "route") {
          h.route.fullPath = "/reports";
          h.route.path = "/reports";
        } else h.dispose();
        const before = snapshot(ui),
          readCount = h.calls.length,
          navCount = h.navigations.length;
        if (outcome === "success") pending.resolve(env({ ...a, version: 2 }, "old-write"));
        else pending.reject(new Failure());
        await writing;
        assert.deepEqual(snapshot(ui), before);
        assert.equal(h.calls.length, readCount, "no stale write-triggered reads");
        assert.equal(h.navigations.length, navCount, "no stale navigation");
        assert.equal(ui.busy.value, transition === "destroy", "release only live busy state");
      });
    }
  }
}
test("P27 write entrypoints share the existing busy guard", async (t) => {
  const pending = deferred();
  const { ui, calls } = harness(t, () => pending.promise);
  await ui.openCreator();
  const first = ui.create();
  const second = ui.create(),
    third = ui.status(a);
  assert.equal(calls.length, 1);
  pending.resolve(env(a));
  await Promise.all([first, second, third]);
  assert.equal(calls.filter((c) => c.method).length, 1);
  assert.equal(ui.busy.value, false);
});
test("P27 destroyed instance cannot begin either write", async (t) => {
  const h = harness(t, () => env(a));
  h.dispose();
  await h.ui.create();
  await h.ui.status(a);
  assert.equal(h.calls.length, 0);
});
test("P27 unchanged editor still sends exact PATCH and completes", async (t) => {
  const { ui, calls, navigations } = harness(t, () => env({ ...a, version: 2 }));
  ui.edit(a, false);
  ui.editReason.value = "原原因";
  const expected = {
    ...plain(ui.form.value),
    expected_version: a.version,
    reason: "原原因",
    action_assignee_id: null,
  };
  await ui.create();
  assert.equal(calls[0].url, `/automations/${a.id}`);
  assert.equal(calls[0].method, "PATCH");
  assert.deepEqual(JSON.parse(calls[0].body), expected);
  assert.equal(ui.showCreate.value, false);
  assert.equal(ui.editing.value, null);
  assert.match(ui.notice.value, /已更新/);
  assert.equal(navigations.length, 1);
  assert.equal(ui.busy.value, false);
});
test("P27 current pause still sends the existing version and reason", async (t) => {
  const { ui, calls } = harness(t, () => env({ ...a, status: "paused", version: 2 }));
  await ui.status(a);
  assert.deepEqual(JSON.parse(calls[0].body), {
    action: "pause",
    expected_version: a.version,
    reason: "由规则管理页人工暂停",
  });
  assert.match(ui.notice.value, /已人工暂停/);
  assert.equal(ui.busy.value, false);
});
test("P27 completed save navigation cannot later close a new editor", async (t) => {
  const nav = deferred();
  const h = harness(
      t,
      () => env(a),
      () => nav.promise,
    ),
    { ui } = h;
  await ui.openCreator();
  const saving = ui.create();
  while (!h.navigations.length) await Promise.resolve();
  ui.edit(b, false);
  ui.form.value.name = "导航期间草稿";
  nav.resolve();
  await saving;
  assert.equal(ui.showCreate.value, true);
  assert.equal(ui.editing.value.id, b.id);
  assert.equal(ui.form.value.name, "导航期间草稿");
});
