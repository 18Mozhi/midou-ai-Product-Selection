import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { ref, computed } from "vue";
import { buildNotificationDesignData } from "../../scripts/lib/ui-phase2-notification-design-data.mjs";

// Read-batch regressions plus remaining write/draft characterization, not server acceptance.
// Real setup and Vue refs;
// router/lifecycle/SSE/request/error adapters are inert and explicitly controlled.
const source = (await readFile("apps/web/src/components/NotificationCenter.vue", "utf8"))
  .split('<script setup lang="ts">')[1]
  .split("</script>")[0];
const ast = ts.createSourceFile("notification.ts", source, ts.ScriptTarget.Latest, true);
const code = ts.transpileModule(
  ast.statements
    .filter((node) => !ts.isImportDeclaration(node))
    .map((node) => node.getText(ast))
    .join("\n") +
    "\nexport const ui={load,open,openById,closeDetail,updateWorkflow,savePreferences,markAll,items,summary,total,state,notice,requestId,selected,busy,preferences,showPreferences};",
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  },
).outputText;
const data = await buildNotificationDesignData(process.cwd());
const a = structuredClone(data.list.data[0]);
const b = { ...a, id: "00000000-0000-4000-8000-000000000902", title: "合成后打开消息B" };
const plain = (value) => JSON.parse(JSON.stringify(value));
const env = (data, request_id = "new", meta) => ({ data, request_id, meta });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
class ApiClientError extends Error {
  constructor() {
    super("controlled failure");
    this.kind = "error";
    this.requestId = "old-failure";
    this.actionHint = "旧请求失败";
  }
}
function harness(request) {
  const calls = [],
    hooks = { mounted: [], unmounted: [], watches: [] };
  const modal = [];
  const context = {
    exports: {},
    ref,
    computed,
    URLSearchParams,
    ApiClientError,
    defineProps: () => ({ apiBaseUrl: "/api/v1" }),
    useRoute: () => ({ query: {}, fullPath: "/notifications" }),
    useRouter: () => ({ replace: async () => {} }),
    onMounted: (fn) => hooks.mounted.push(fn),
    onUnmounted: (fn) => hooks.unmounted.push(fn),
    watch: (getter, fn) => hooks.watches.push({ getter, fn }),
    useModalDialog: (_get, close) => {
      modal.push(close);
      return { dialogElement: ref(null), handleCancel: close };
    },
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
  return { ui: context.exports.ui, hooks, calls, modal };
}
function defaults(url) {
  if (url.startsWith("/notifications?")) return env([b], "new-list", { total: 1 });
  if (url === "/notifications/summary") return env(data.summary, "new-summary");
  if (url === "/me/notification-preferences") return env(data.preferences, "new-preferences");
  throw new Error(`Unexpected request ${url}`);
}

test("P26 newer read owns rows, pagination and request ID", async () => {
  const old = deferred();
  let lists = 0;
  const { ui } = harness((url) =>
    url.startsWith("/notifications?") && ++lists === 1
      ? old.promise
      : Promise.resolve(defaults(url)),
  );
  const first = ui.load();
  await ui.load();
  assert.equal(ui.items.value[0].id, b.id);
  assert.equal(ui.total.value, 1);
  const currentRequest = ui.requestId.value;
  old.resolve(env([a], "old-list", { total: 99 }));
  await first;
  assert.equal(ui.items.value[0].id, b.id);
  assert.equal(ui.total.value, 1);
  assert.equal(ui.requestId.value, currentRequest);
});

test("P26 late failed list cannot replace a newer ready page", async () => {
  const old = deferred();
  let lists = 0;
  const { ui } = harness((url) =>
    url.startsWith("/notifications?") && ++lists === 1
      ? old.promise
      : Promise.resolve(defaults(url)),
  );
  const first = ui.load();
  await ui.load();
  assert.equal(ui.state.value, "ready");
  const currentRequest = ui.requestId.value;
  old.reject(new ApiClientError());
  await first;
  assert.equal(ui.state.value, "ready");
  assert.equal(ui.items.value[0].id, b.id);
  assert.equal(ui.requestId.value, currentRequest);
  assert.equal(ui.notice.value, "");
});

test("P26 siblings arriving after a failed batch cannot replace its diagnostic", async () => {
  const lateSummary = deferred(),
    latePreferences = deferred();
  const { ui } = harness((url) => {
    if (url.startsWith("/notifications?")) return Promise.reject(new ApiClientError());
    if (url === "/notifications/summary") return lateSummary.promise;
    return latePreferences.promise;
  });
  await ui.load();
  assert.equal(ui.requestId.value, "old-failure");
  lateSummary.resolve(env(data.summary, "late-summary"));
  latePreferences.resolve(env(data.preferences, "late-preferences"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ui.requestId.value, "old-failure");
  assert.equal(ui.notice.value, "旧请求失败");
});

test("P26 unmounted read cannot apply late data or meta", async () => {
  const pending = deferred();
  const { ui, hooks } = harness((url) =>
    url.startsWith("/notifications?") ? pending.promise : Promise.resolve(defaults(url)),
  );
  const run = ui.load();
  for (const unmount of hooks.unmounted) unmount();
  const state = ui.state.value,
    requestId = ui.requestId.value;
  pending.resolve(env([a], "destroyed-list", { total: 99 }));
  await run;
  assert.equal(ui.items.value.length, 0);
  assert.equal(ui.total.value, 0);
  assert.equal(ui.state.value, state);
  assert.equal(ui.requestId.value, requestId);
});

test("P26 current read still applies data, totals and forces email off", async () => {
  const { ui, calls } = harness((url) => Promise.resolve(defaults(url)));
  await ui.load();
  assert.equal(ui.items.value[0].id, b.id);
  assert.equal(ui.total.value, 1);
  assert.equal(ui.state.value, "ready");
  assert.equal(ui.preferences.value.email_enabled, false);
  assert.deepEqual(
    calls.map((c) => c.url),
    [
      "/notifications?page=1&page_size=20",
      "/notifications/summary",
      "/me/notification-preferences",
    ],
  );
});

test("P26 immediate sibling completions cannot overwrite the first batch failure", async () => {
  const { ui } = harness((url) =>
    url.startsWith("/notifications?")
      ? Promise.reject(new ApiClientError())
      : Promise.resolve(defaults(url)),
  );
  await ui.load();
  assert.equal(ui.requestId.value, "old-failure");
  assert.equal(ui.state.value, "error");
});

test("P26 load invoked after unmount does not issue a new read batch", async () => {
  const { ui, hooks, calls } = harness((url) => Promise.resolve(defaults(url)));
  for (const unmount of hooks.unmounted) unmount();
  await ui.load();
  assert.equal(calls.length, 0);
});

test("P26 late automatic-read receipt replaces subsequently opened B with A", async () => {
  const old = deferred(),
    started = deferred();
  const { ui, calls } = harness((url, options) => {
    if (url === `/notifications/${a.id}`) return Promise.resolve(env({ ...a, read_at: null }));
    if (url === `/notifications/${b.id}`)
      return Promise.resolve(env({ ...b, read_at: "2026-09-10T00:00:00Z" }));
    if (url === `/notifications/${a.id}/actions`) {
      assert.equal(options.body.action, "read");
      started.resolve();
      return old.promise;
    }
    throw new Error(url);
  });
  const first = ui.openById(a.id);
  await started.promise;
  await ui.openById(b.id);
  assert.equal(ui.selected.value.id, b.id);
  old.resolve(
    env({
      id: a.id,
      read_at: "2026-09-10T00:00:00Z",
      workflow_status: a.workflow_status,
      version: a.version + 1,
    }),
  );
  await first;
  assert.equal(ui.selected.value.id, a.id);
  assert.equal(calls.filter((call) => call.method === "POST").length, 1);
});

test("P26 workflow receipt can combine A identity with B title after deep-link open", async () => {
  const old = deferred();
  const { ui } = harness((url) => {
    if (url === `/notifications/${a.id}/actions`) return old.promise;
    if (url === `/notifications/${b.id}`)
      return Promise.resolve(env({ ...b, read_at: "2026-09-10T00:00:00Z" }));
    return Promise.resolve(defaults(url));
  });
  ui.selected.value = structuredClone(a);
  const first = ui.updateWorkflow("start");
  assert.equal(ui.busy.value, true);
  await ui.openById(b.id);
  assert.equal(ui.selected.value.id, b.id);
  // Exact partial result fields returned by MysqlNotificationRepository.action.
  old.resolve(
    env({ id: a.id, read_at: a.read_at, workflow_status: "in_progress", version: a.version + 1 }),
  );
  await first;
  assert.equal(ui.selected.value.id, a.id);
  assert.equal(ui.selected.value.title, b.title);
});

test("P26 reload replaces open preference draft, including SSE-triggered reload path", async () => {
  const { ui } = harness((url) => Promise.resolve(defaults(url)));
  ui.showPreferences.value = true;
  ui.preferences.value.task_enabled = false;
  await ui.load();
  assert.equal(ui.showPreferences.value, true);
  assert.equal(ui.preferences.value.task_enabled, data.preferences.task_enabled);
  assert.equal(ui.preferences.value.email_enabled, false);
});

test("P26 saved old preferences close a later reopened dialog; emitted body stays original", async () => {
  const old = deferred();
  const { ui, calls, modal } = harness((url, options) =>
    options.method === "PUT" ? old.promise : Promise.resolve(defaults(url)),
  );
  ui.showPreferences.value = true;
  const first = ui.savePreferences();
  modal[0]();
  assert.equal(ui.showPreferences.value, false);
  ui.showPreferences.value = true;
  ui.preferences.value.task_enabled = false;
  old.resolve(env({ ...data.preferences, version: 2 }));
  await first;
  assert.equal(ui.showPreferences.value, false);
  assert.equal(calls.find((call) => call.method === "PUT").body.task_enabled, true);
  assert.equal(calls.find((call) => call.method === "PUT").body.email_enabled, false);
});

test("P26 normal row-open blocks busy, direct deep-link open bypasses it, detail close preserves busy window", async () => {
  const { ui, calls, modal } = harness((url) =>
    Promise.resolve(env({ ...b, read_at: "2026-09-10T00:00:00Z" })),
  );
  ui.busy.value = true;
  ui.selected.value = structuredClone(a);
  await ui.open(b);
  assert.equal(calls.length, 0);
  await modal[1]();
  assert.equal(ui.selected.value.id, a.id);
  await ui.openById(b.id);
  assert.equal(calls.length, 1);
  assert.equal(ui.selected.value.id, b.id);
});
