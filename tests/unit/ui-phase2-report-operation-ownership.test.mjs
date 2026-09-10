import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { computed, reactive, ref, watch as vueWatch } from "vue";
import { buildReportDesignData } from "../../scripts/lib/ui-phase2-report-design-data.mjs";

const source = (await readFile("apps/web/src/components/ReportCenter.vue", "utf8"))
  .split('<script setup lang="ts">')[1]
  .split("</script>")[0];
const ast = ts.createSourceFile("report.ts", source, ts.ScriptTarget.Latest, true);
const code = ts.transpileModule(
  "export const ui=(()=>{\n" +
    ast.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getText(ast))
      .join("\n") +
    "\nreturn {createExport,download,refresh,load,syncDetailFromRoute,closeDetail,type,state,report,rows:exports,selectedExport,notice,requestId,busy,refreshing,downloadingId};})();",
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
const data = await buildReportDesignData(process.cwd()),
  a = data.exports[0],
  b = data.exports[2];
const plain = (value) => JSON.parse(JSON.stringify(value));
const env = (data, request_id = "current") => ({ data, request_id });
class ApiClientError extends Error {
  constructor(id = "old-error") {
    super("controlled");
    Object.assign(this, { requestId: id, kind: "error", actionHint: "合成请求失败" });
  }
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function defaults(url, options) {
  if (options.method === "POST") return env(data.replacement, "created");
  if (url === "/report-exports") return env([a, b]);
  if (url.startsWith("/reports/")) return env(data.reports[url.split("/").at(-1)]);
  if (url === `/report-exports/${a.id}`) return env(a, "current-detail-A");
  if (url === `/report-exports/${b.id}`) return env(b, "current-detail-B");
  throw new Error(url);
}
// Real setup and synchronous Vue watchers. Transport, normal routing and blob/DOM are adapters.
function harness(t, request = (url, options) => Promise.resolve(defaults(url, options)), raw) {
  const hooks = [],
    calls = [],
    files = [];
  const route = reactive({ query: {}, path: "/reports", fullPath: "/reports" });
  const context = {
    exports: {},
    ref,
    computed,
    ApiClientError,
    clearInterval: () => {},
    defineProps: () => ({ apiBaseUrl: "/api/v1" }),
    useRoute: () => route,
    useRouter: () => ({ push: async () => {}, replace: async () => {} }),
    onMounted: () => {},
    onUnmounted: (fn) => hooks.push(fn),
    watch: (getter, fn, options) => {
      if (options?.flush === "sync") hooks.push(vueWatch(getter, fn, options));
    },
    useModalDialog: (_get, close) => ({ dialogElement: ref(null), handleCancel: close }),
    rethrowUnexpectedError: (error) => {
      if (!(error instanceof ApiClientError)) throw error;
    },
    createApiClient:
      () =>
      (url, options = {}) => {
        calls.push({ url, ...plain(options) });
        return request(url, options);
      },
    createApiResponseClient: () => (url, options) => {
      calls.push({ url, ...plain(options) });
      return raw ? raw(url, options) : Promise.resolve({ blob: async () => "fixture-bytes" });
    },
    crypto: { randomUUID: () => "correlation-fixture" },
    URL: {
      createObjectURL: (blob) => {
        files.push({ create: blob });
        return "blob:fixture";
      },
      revokeObjectURL: (url) => files.push({ revoke: url }),
    },
    document: {
      createElement: () => ({
        click() {
          files.push({ filename: this.download, href: this.href });
        },
      }),
    },
  };
  vm.runInNewContext(code, context);
  const dispose = () => {
    for (const fn of hooks) fn();
  };
  t.after(dispose);
  const query = (value) => {
    route.query = value;
    route.fullPath = "/reports?" + new URLSearchParams(value).toString();
  };
  return { ui: context.exports.ui, calls, route, query, dispose, files, context };
}
const snapshot = (ui) =>
  plain({
    report: ui.report.value,
    rows: ui.rows.value,
    selected: ui.selectedExport.value,
    notice: ui.notice.value,
    requestId: ui.requestId.value,
    state: ui.state.value,
  });

for (const transition of ["detail-B", "close-before-navigation", "type-roundtrip", "destroy"]) {
  for (const outcome of ["success", "error"]) {
    test(`P28 create ${outcome} ignores a superseded ${transition} view`, async (t) => {
      const pending = deferred();
      const h = harness(t, (url, options) =>
        options.method === "POST" ? pending.promise : Promise.resolve(defaults(url, options)),
      );
      if (transition === "close-before-navigation") {
        h.query({ export: a.id });
        await h.ui.syncDetailFromRoute();
      }
      const old = h.ui.createExport();
      if (transition === "detail-B") {
        h.query({ export: b.id });
        await h.ui.syncDetailFromRoute();
      } else if (transition === "close-before-navigation") h.ui.closeDetail();
      else if (transition === "type-roundtrip") {
        h.query({ report: "trend" });
        h.query({});
      } else h.dispose();
      const before = snapshot(h.ui),
        count = h.calls.length;
      if (outcome === "success") pending.resolve(env(data.replacement, "late-create"));
      else pending.reject(new ApiClientError());
      await old;
      assert.deepEqual(snapshot(h.ui), before);
      assert.equal(h.calls.length, count, "old success must not start a new list/detail refresh");
      assert.equal(h.ui.busy.value, transition === "destroy");
    });
  }
}
test("P28 create guard sends once while busy and permits a later retry", async (t) => {
  const pending = deferred();
  let first = true;
  const h = harness(t, (url, options) =>
    options.method === "POST" && first ? pending.promise : Promise.resolve(defaults(url, options)),
  );
  const old = h.ui.createExport();
  const repeat = h.ui.createExport();
  const sent = h.calls.filter((c) => c.method === "POST").length;
  pending.reject(new ApiClientError("current-error"));
  await Promise.all([old, repeat]);
  assert.equal(sent, 1);
  assert.equal(h.ui.busy.value, false);
  assert.equal(h.ui.requestId.value, "current-error");
  first = false;
  await h.ui.createExport();
  assert.equal(h.calls.filter((c) => c.method === "POST").length, 2);
  assert.match(h.ui.notice.value, /导出任务已提交/);
});
for (const type of ["opportunity", "trend", "team"]) {
  test(`P28 current ${type} creation retains exact CSV body and successful refresh`, async (t) => {
    const h = harness(t);
    h.ui.type.value = type;
    await h.ui.createExport();
    assert.deepEqual(
      h.calls.find((c) => c.method === "POST"),
      { url: "/report-exports", method: "POST", body: { report_type: type, format: "csv" } },
    );
    assert.equal(h.ui.state.value, "ready");
    assert.equal(h.ui.report.value.type, type);
    assert.equal(h.ui.busy.value, false);
  });
}
test("P28 normal background detail polling does not invalidate a current create receipt", async (t) => {
  const pending = deferred();
  const h = harness(t, (url, options) =>
    options.method === "POST" ? pending.promise : Promise.resolve(defaults(url, options)),
  );
  h.query({ export: a.id });
  await h.ui.syncDetailFromRoute();
  const old = h.ui.createExport();
  await h.ui.syncDetailFromRoute();
  pending.resolve(env(data.replacement));
  await old;
  assert.match(h.ui.notice.value, /导出任务已提交/);
  assert.equal(h.ui.state.value, "ready");
});
test("P28 an already-started follow-up read may finish facts without replaying a later detail", async (t) => {
  const pending = deferred();
  const h = harness(t, (url, options) =>
    url.startsWith("/reports/") ? pending.promise : Promise.resolve(defaults(url, options)),
  );
  const old = h.ui.createExport();
  await new Promise((r) => setImmediate(r));
  h.query({ export: b.id });
  await h.ui.syncDetailFromRoute();
  pending.resolve(env(data.reports.opportunity, "old-followup"));
  await old;
  assert.equal(h.ui.selectedExport.value.id, b.id);
  assert.equal(h.ui.state.value, "ready");
  assert.equal(h.calls.filter((c) => c.url === `/report-exports/${b.id}`).length, 1);
});
for (const transition of ["detail-B", "close", "destroy"]) {
  test(`P28 download failure after ${transition} does not replace current diagnostics`, async (t) => {
    const pending = deferred();
    const h = harness(t, undefined, () => pending.promise);
    const old = h.ui.download(a);
    if (transition === "detail-B") {
      h.query({ export: b.id });
      await h.ui.syncDetailFromRoute();
    } else if (transition === "close") h.ui.closeDetail();
    else h.dispose();
    const before = snapshot(h.ui);
    pending.reject(new ApiClientError("old-download"));
    await old;
    assert.deepEqual(snapshot(h.ui), before);
    assert.equal(h.ui.downloadingId.value, transition === "destroy" ? a.id : "");
  });
}
for (const transition of ["current", "changed-view", "destroy"]) {
  test(`P28 ${transition} download still saves requested bytes and revokes its object URL`, async (t) => {
    const blob = deferred();
    const h = harness(t, undefined, async () => ({ blob: () => blob.promise }));
    const old = h.ui.download(a);
    if (transition === "changed-view") {
      h.query({ export: b.id });
      await h.ui.syncDetailFromRoute();
    } else if (transition === "destroy") h.dispose();
    const before = snapshot(h.ui);
    blob.resolve("fixture-csv");
    await old;
    assert.deepEqual(h.files, [
      { create: "fixture-csv" },
      { filename: a.filename, href: "blob:fixture" },
      { revoke: "blob:fixture" },
    ]);
    assert.deepEqual(snapshot(h.ui), before);
    assert.deepEqual(h.calls[0], {
      url: `/report-exports/${a.id}/download`,
      requestId: "correlation-fixture",
      traceId: "correlation-fixture",
      headers: { accept: "application/octet-stream" },
    });
  });
}
test("P28 download click error still releases allocated object URL", async (t) => {
  const h = harness(t);
  h.context.document.createElement = () => ({
    click() {
      throw new Error("synthetic click failure");
    },
  });
  await h.ui.download(a);
  assert.deepEqual(h.files, [{ create: "fixture-bytes" }, { revoke: "blob:fixture" }]);
  assert.equal(h.ui.downloadingId.value, "");
});
test("P28 global download guard and current error retry behavior remain unchanged", async (t) => {
  const pending = deferred();
  const h = harness(t, undefined, () => pending.promise);
  const old = h.ui.download(a);
  await h.ui.download(b);
  assert.equal(h.calls.length, 1);
  pending.reject(new ApiClientError("current-download"));
  await old;
  assert.equal(h.ui.requestId.value, "current-download");
  assert.equal(h.ui.downloadingId.value, "");
});
test("P28 manual refresh is guarded while pending and releases on completion", async (t) => {
  const pending = deferred();
  const h = harness(t, (url, options) =>
    url.startsWith("/reports/") ? pending.promise : Promise.resolve(defaults(url, options)),
  );
  const old = h.ui.refresh(),
    repeat = h.ui.refresh(),
    sent = h.calls.length;
  pending.resolve(env(data.reports.opportunity));
  await Promise.all([old, repeat]);
  assert.equal(sent, 2);
  assert.equal(h.ui.refreshing.value, false);
});
test("P28 destroyed refresh does not mutate its flag or start any later operation", async (t) => {
  const pending = deferred();
  const h = harness(t, () => pending.promise);
  const old = h.ui.refresh();
  h.dispose();
  pending.resolve(env(data.reports.opportunity));
  await old;
  assert.equal(h.ui.refreshing.value, true);
  const count = h.calls.length;
  await h.ui.refresh();
  await h.ui.createExport();
  await h.ui.download(a);
  assert.equal(h.calls.length, count);
});
