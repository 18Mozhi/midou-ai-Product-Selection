import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { ref, watch as vueWatch } from "vue";
import { buildAutomationDesignData } from "../../scripts/lib/ui-phase2-automation-design-data.mjs";

// Real setup and Vue ref/watch. Requests, router and lifetime are controlled adapters, not a server.
const source = (await readFile("apps/web/src/components/AutomationRuleCenter.vue", "utf8"))
  .split('<script setup lang="ts">')[1]
  .split("</script>")[0];
const ast = ts.createSourceFile("automation.ts", source, ts.ScriptTarget.Latest, true);
const code = ts.transpileModule(
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getText(ast))
    .join("\n") +
    "\nexport const ui={load,open,edit,openCreator,closeDetail,closeEditor,applyRouteState,runPreview,create,form,editing,editReason,showCreate,selected,rules,memberOptions,state,notice,requestId,preview,previewing,editorFormElement,busy};",
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
const data = await buildAutomationDesignData(process.cwd());
const a = data.list[0],
  b = { ...a, id: "00000000-0000-4000-8000-000000000902", name: "合成较新规则B" };
const plain = (value) => JSON.parse(JSON.stringify(value));
const env = (data, request_id = "current") => ({ data, request_id });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
class ApiClientError extends Error {
  constructor(id = "old-failure") {
    super("controlled failure");
    this.kind = "error";
    this.requestId = id;
    this.actionHint = "受控读取失败";
  }
}
function harness(t, request) {
  const hooks = [],
    calls = [],
    navigation = [];
  const route = { query: {}, path: "/automations", fullPath: "/automations" };
  const context = {
    exports: {},
    ref,
    ApiClientError,
    defineProps: () => ({ apiBaseUrl: "/api/v1" }),
    useRoute: () => route,
    useRouter: () => ({
      push: async (v) => navigation.push(plain(v)),
      replace: async (v) => navigation.push(plain(v)),
    }),
    onMounted: () => {},
    onUnmounted: (fn) => hooks.push(fn),
    watch: (getter, fn, options) => {
      const stop = vueWatch(getter, fn, options);
      hooks.push(stop);
      return stop;
    },
    useModalDialog: (_get, close) => ({ dialogElement: ref(null), handleCancel: close }),
    rethrowUnexpectedError: (error) => {
      if (!(error instanceof ApiClientError)) throw error;
    },
    createApiClient:
      () =>
      (url, options = {}) => {
        calls.push({ url, ...plain(options) });
        return request(url, options, calls);
      },
  };
  vm.runInNewContext(code, context);
  const dispose = () => {
    for (const fn of hooks) fn();
  };
  t.after(dispose);
  const ui = context.exports.ui;
  ui.editorFormElement.value = { reportValidity: () => true };
  return { ui, calls, route, navigation, dispose };
}
function defaults(url) {
  if (url === "/automations") return env([b], "new-list");
  if (url === "/tasks/member-options") return env(data.members, "new-members");
  if (url === "/automations/preview") return env(data.fixturePreview, "preview");
  if (url === `/automations/${a.id}`) return env({ ...a, executions: [] }, "detail-A");
  if (url === `/automations/${b.id}`) return env({ ...b, executions: [] }, "detail-B");
  throw new Error(`Unexpected request ${url}`);
}
const snapshot = (ui) =>
  plain({
    rows: ui.rules.value,
    members: ui.memberOptions.value,
    selected: ui.selected.value,
    state: ui.state.value,
    notice: ui.notice.value,
    requestId: ui.requestId.value,
    form: ui.form.value,
    reason: ui.editReason.value,
    editing: ui.editing.value,
    editor: ui.showCreate.value,
    preview: ui.preview.value,
    previewing: ui.previewing.value,
  });

test("P27 latest list/member batch owns rows and diagnostics", async (t) => {
  const oldList = deferred(),
    oldMembers = deferred();
  const { ui } = harness(t, (url, _opts, calls) =>
    calls.length <= 2
      ? (url === "/automations" ? oldList : oldMembers).promise
      : Promise.resolve(defaults(url)),
  );
  const old = ui.load();
  await ui.load();
  const current = snapshot(ui);
  oldList.resolve(env([a], "old-list"));
  oldMembers.resolve(env([], "old-members"));
  await old;
  assert.deepEqual(snapshot(ui), current);
});
for (const failed of ["/automations", "/tasks/member-options"]) {
  test(`P27 stale ${failed} error cannot replace the newer ready batch`, async (t) => {
    const pending = deferred();
    let held = false;
    const { ui } = harness(t, (url) => {
      if (url === failed && !held) {
        held = true;
        return pending.promise;
      }
      return Promise.resolve(defaults(url));
    });
    const old = ui.load();
    await ui.load();
    const current = snapshot(ui);
    pending.reject(new ApiClientError());
    await old;
    assert.deepEqual(snapshot(ui), current);
  });
  test(`P27 immediate ${failed} failure retains its diagnostic against a fulfilled sibling`, async (t) => {
    const { ui } = harness(t, (url) =>
      url === failed ? Promise.reject(new ApiClientError()) : Promise.resolve(defaults(url)),
    );
    await ui.load();
    assert.equal(ui.requestId.value, "old-failure");
    assert.equal(ui.state.value, "error");
    assert.equal(ui.rules.value.length, 0);
  });
}
test("P27 failed batch rejects the late sibling metadata", async (t) => {
  const pending = deferred();
  const { ui } = harness(t, (url) =>
    url === "/automations" ? Promise.reject(new ApiClientError()) : pending.promise,
  );
  await ui.load();
  const current = snapshot(ui);
  pending.resolve(env(data.members, "late-member"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(snapshot(ui), current);
});
for (const outcome of ["success", "error"]) {
  test(`P27 destroyed list ignores late ${outcome} and cannot start another batch`, async (t) => {
    const pending = deferred();
    const h = harness(t, (url) =>
      url === "/automations" ? pending.promise : Promise.resolve(defaults(url)),
    );
    const old = h.ui.load();
    h.dispose();
    const current = snapshot(h.ui);
    if (outcome === "error") pending.reject(new ApiClientError());
    else pending.resolve(env([a], "destroyed"));
    await old;
    assert.deepEqual(snapshot(h.ui), current);
    const count = h.calls.length;
    await h.ui.load();
    assert.equal(h.calls.length, count);
  });
  test(`P27 detail A late ${outcome} cannot replace detail B`, async (t) => {
    const pending = deferred();
    const { ui } = harness(t, (url) =>
      url === `/automations/${a.id}` ? pending.promise : Promise.resolve(defaults(url)),
    );
    const old = ui.open(a, false);
    await ui.open(b, false);
    const current = snapshot(ui);
    if (outcome === "error") pending.reject(new ApiClientError());
    else pending.resolve(env(a, "late-A"));
    await old;
    assert.deepEqual(snapshot(ui), current);
  });
}
for (const action of ["close", "clear-query", "creator", "edit", "destroy"]) {
  test(`P27 pending detail cannot reopen after ${action}`, async (t) => {
    const pending = deferred();
    const h = harness(t, () => pending.promise),
      { ui } = h;
    const old = ui.open(a, false);
    if (action === "close") ui.closeDetail();
    else if (action === "clear-query") await ui.applyRouteState();
    else if (action === "creator") await ui.openCreator();
    else if (action === "edit") ui.edit(b, false);
    else h.dispose();
    const current = snapshot(ui);
    pending.resolve(env(a, "late-A"));
    await old;
    assert.deepEqual(snapshot(ui), current);
  });
}
test("P27 reopened same-id detail owns its generation", async (t) => {
  const pending = deferred();
  let count = 0;
  const { ui } = harness(t, () =>
    ++count === 1 ? pending.promise : Promise.resolve(env({ ...a, version: 2 }, "reopened")),
  );
  const old = ui.open(a, false);
  ui.closeDetail();
  await ui.open(a, false);
  const current = snapshot(ui);
  pending.resolve(env(a, "old-window"));
  await old;
  assert.deepEqual(snapshot(ui), current);
});
test("P27 list completion does not close a creator opened while it was pending", async (t) => {
  const pending = deferred();
  const { ui } = harness(t, (url) =>
    url === "/automations" ? pending.promise : Promise.resolve(defaults(url)),
  );
  const old = ui.load();
  await ui.openCreator();
  ui.form.value.name = "新草稿";
  pending.resolve(env([a]));
  await old;
  assert.equal(ui.showCreate.value, true);
  assert.equal(ui.form.value.name, "新草稿");
  assert.equal(ui.rules.value[0].id, a.id);
});
for (const field of ["name", "reason"]) {
  test(`P27 list refresh does not reset an editing ${field} draft`, async (t) => {
    const pending = deferred();
    const { ui, route } = harness(t, (url) =>
      url === "/automations" ? pending.promise : Promise.resolve(defaults(url)),
    );
    route.query = { rule: a.id, action: "edit" };
    route.fullPath = `/automations?rule=${a.id}&action=edit`;
    ui.edit(a, false);
    const old = ui.load();
    if (field === "name") ui.form.value.name = "刷新期间的新名称";
    else ui.editReason.value = "刷新期间的新原因";
    const draft = plain({ form: ui.form.value, reason: ui.editReason.value });
    pending.resolve(env([a]));
    await old;
    assert.deepEqual(plain({ form: ui.form.value, reason: ui.editReason.value }), draft);
  });
}
test("P27 preview cannot mutate a destroyed instance or restart there", async (t) => {
  const pending = deferred();
  const h = harness(t, () => pending.promise);
  await h.ui.openCreator();
  const old = h.ui.runPreview();
  h.dispose();
  const current = snapshot(h.ui);
  pending.resolve(env(data.fixturePreview, "destroyed-preview"));
  await old;
  assert.deepEqual(snapshot(h.ui), current);
  const count = h.calls.length;
  await h.ui.runPreview();
  assert.equal(h.calls.length, count);
});
test("P27 current list, empty state and current detail still resolve normally", async (t) => {
  let empty = false;
  const { ui, calls } = harness(t, (url) =>
    Promise.resolve(empty && url === "/automations" ? env([]) : defaults(url)),
  );
  await ui.load();
  assert.equal(ui.rules.value[0].id, b.id);
  assert.equal(ui.state.value, "ready");
  assert.deepEqual(
    calls.map((c) => c.url),
    ["/automations", "/tasks/member-options"],
  );
  await ui.open(b, false);
  assert.equal(ui.selected.value.id, b.id);
  assert.equal(ui.requestId.value, "detail-B");
  empty = true;
  await ui.load();
  assert.equal(ui.state.value, "empty");
});

test("P27 initial list still opens the latest deep link selected before route sync is ready", async (t) => {
  const pending = deferred();
  const { ui, route } = harness(t, (url) =>
    url === "/automations" ? pending.promise : Promise.resolve(defaults(url)),
  );
  const old = ui.load();
  route.query = { rule: b.id };
  route.fullPath = `/automations?rule=${b.id}`;
  pending.resolve(env([a, b]));
  await old;
  assert.equal(ui.selected.value.id, b.id);
});
