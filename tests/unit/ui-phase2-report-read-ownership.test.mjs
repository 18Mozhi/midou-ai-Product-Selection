import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { computed, reactive, ref, watch as vueWatch } from "vue";
import { buildReportDesignData } from "../../scripts/lib/ui-phase2-report-design-data.mjs";

// Real setup/ref/computed and synchronous invalidators. Route fetches are invoked explicitly;
// the companion mounted-Vue verifier covers the ordinary router watcher and native dialog.
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
    "\nreturn {load,syncDetailFromRoute,closeDetail,type,state,report,rows:exports,selectedExport,notice,requestId};})();",
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
const data = await buildReportDesignData(process.cwd());
const a = data.exports[0],
  b = data.exports[2];
const plain = (v) => JSON.parse(JSON.stringify(v));
const envelope = (data, request_id = "current") => ({ data, request_id });
class ApiClientError extends Error {
  constructor(id = "old-failure", status = 503, kind = "error") {
    super("controlled failure");
    Object.assign(this, { requestId: id, status, kind, actionHint: "合成读取失败" });
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
function defaults(url) {
  if (url === "/report-exports") return envelope([a, b], "current-list");
  if (url === `/report-exports/${a.id}`) return envelope(a, "detail-A");
  if (url === `/report-exports/${b.id}`) return envelope(b, "detail-B");
  if (url.startsWith("/reports/"))
    return envelope(data.reports[url.split("/").at(-1)], "current-report");
  throw new Error(`Unexpected request ${url}`);
}
function harness(t, request = (url) => Promise.resolve(defaults(url))) {
  const hooks = [],
    calls = [],
    navigation = [];
  const route = reactive({ query: {}, path: "/reports", fullPath: "/reports" });
  const context = {
    exports: {},
    ref,
    computed,
    ApiClientError,
    clearInterval: () => {},
    defineProps: () => ({ apiBaseUrl: "/api/v1" }),
    useRoute: () => route,
    useRouter: () => ({
      push: async (v) => navigation.push(plain(v)),
      replace: async (v) => navigation.push(plain(v)),
    }),
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
        return request(url, options, calls);
      },
    createApiResponseClient: () => () => {
      throw new Error("No download in read-only test");
    },
  };
  vm.runInNewContext(code, context);
  const dispose = () => {
    for (const fn of hooks) fn();
  };
  t.after(dispose);
  const ui = context.exports.ui;
  const query = (value) => {
    route.query = value;
    route.fullPath = "/reports?" + new URLSearchParams(value).toString();
  };
  return { ui, route, query, calls, navigation, dispose };
}
const snapshot = (ui) =>
  plain({
    report: ui.report.value,
    rows: ui.rows.value,
    selected: ui.selectedExport.value,
    state: ui.state.value,
    notice: ui.notice.value,
    requestId: ui.requestId.value,
  });

for (const outcome of ["success", "error"]) {
  test(`P28 newer report/list batch rejects old ${outcome} and its diagnostics`, async (t) => {
    const pending = deferred();
    const h = harness(t, (url, _options, calls) =>
      calls.length === 1 ? pending.promise : Promise.resolve(defaults(url)),
    );
    const old = h.ui.load();
    h.ui.type.value = "trend";
    await h.ui.load();
    const current = snapshot(h.ui);
    if (outcome === "success") pending.resolve(envelope(data.reports.opportunity, "old-report"));
    else pending.reject(new ApiClientError());
    await old;
    assert.deepEqual(snapshot(h.ui), current);
    assert.equal(h.ui.report.value.type, "trend");
  });
}
for (const failed of ["/reports/opportunity", "/report-exports"]) {
  for (const sibling of ["immediate", "late"]) {
    test(`P28 first ${failed} failure owns diagnostics against ${sibling} sibling`, async (t) => {
      const pending = deferred();
      const h = harness(t, (url) =>
        url === failed
          ? Promise.reject(new ApiClientError())
          : sibling === "late"
            ? pending.promise
            : Promise.resolve(defaults(url)),
      );
      await h.ui.load();
      const current = snapshot(h.ui);
      assert.equal(current.requestId, "old-failure");
      assert.equal(current.state, "error");
      assert.equal(current.report, null);
      if (sibling === "late") {
        pending.resolve(envelope([], "late-sibling"));
        await new Promise((r) => setImmediate(r));
        assert.deepEqual(snapshot(h.ui), current);
      }
    });
  }
}
for (const outcome of ["success", "error"]) {
  test(`P28 detail A late ${outcome} cannot overwrite B or clear B query`, async (t) => {
    const pending = deferred();
    const h = harness(t, (url) =>
      url.endsWith(a.id) ? pending.promise : Promise.resolve(defaults(url)),
    );
    h.query({ export: a.id });
    const old = h.ui.syncDetailFromRoute();
    h.query({ export: b.id });
    await h.ui.syncDetailFromRoute();
    const current = snapshot(h.ui);
    if (outcome === "success") pending.resolve(envelope(a, "late-A"));
    else pending.reject(new ApiClientError("late-A", 404));
    await old;
    assert.deepEqual(snapshot(h.ui), current);
    assert.equal(h.navigation.length, 0);
  });
  for (const action of ["close", "clear-query", "destroy"]) {
    test(`P28 pending detail ${outcome} cannot reopen after ${action}`, async (t) => {
      const pending = deferred();
      const h = harness(t, () => pending.promise);
      h.query({ export: a.id });
      const old = h.ui.syncDetailFromRoute();
      if (action === "close") h.ui.closeDetail();
      else if (action === "clear-query") {
        h.query({});
        await h.ui.syncDetailFromRoute();
      } else h.dispose();
      const current = snapshot(h.ui),
        navCount = h.navigation.length;
      if (outcome === "success") pending.resolve(envelope(a, "old-window"));
      else pending.reject(new ApiClientError("old-window", 404));
      await old;
      assert.deepEqual(snapshot(h.ui), current);
      assert.equal(h.navigation.length, navCount);
    });
  }
  test(`P28 destroyed list ignores late ${outcome} and does not start new reads`, async (t) => {
    const pending = deferred();
    const h = harness(t, (url) =>
      url.startsWith("/reports/") ? pending.promise : Promise.resolve(defaults(url)),
    );
    const old = h.ui.load();
    h.dispose();
    const current = snapshot(h.ui);
    if (outcome === "success") pending.resolve(envelope(data.reports.opportunity, "destroyed"));
    else pending.reject(new ApiClientError());
    await old;
    assert.deepEqual(snapshot(h.ui), current);
    const count = h.calls.length;
    await h.ui.load();
    await h.ui.syncDetailFromRoute();
    assert.equal(h.calls.length, count);
  });
}
test("P28 reopening same-id detail owns its own request generation", async (t) => {
  const pending = deferred();
  let count = 0;
  const h = harness(t, () =>
    ++count === 1 ? pending.promise : Promise.resolve(envelope({ ...a, version: 88 }, "reopened")),
  );
  h.query({ export: a.id });
  const old = h.ui.syncDetailFromRoute();
  h.ui.closeDetail();
  await h.ui.syncDetailFromRoute();
  const current = snapshot(h.ui);
  pending.resolve(envelope(a, "old-window"));
  await old;
  assert.deepEqual(snapshot(h.ui), current);
});
test("P28 current detail 404 retains its explanation and removes only export query", async (t) => {
  const h = harness(t, () => Promise.reject(new ApiClientError("missing", 404)));
  h.query({ report: "team", export: a.id, context: "kept" });
  await h.ui.syncDetailFromRoute();
  assert.equal(h.ui.selectedExport.value, null);
  assert.equal(h.ui.requestId.value, "missing");
  assert.match(h.ui.notice.value, /不存在或不在当前工作区/);
  assert.deepEqual(h.navigation.at(-1).query, { report: "team", context: "kept" });
});
test("P28 list completion cannot replay a detail closed while the list was pending", async (t) => {
  const pending = deferred();
  const h = harness(t, (url) =>
    url.startsWith("/reports/") ? pending.promise : Promise.resolve(defaults(url)),
  );
  h.query({ export: a.id });
  const old = h.ui.load();
  h.ui.closeDetail(); // router intentionally held: query has not changed yet
  pending.resolve(envelope(data.reports.opportunity));
  await old;
  assert.equal(h.ui.selectedExport.value, null);
  assert.equal(
    h.calls.some((c) => c.url === `/report-exports/${a.id}`),
    false,
  );
  assert.equal(h.ui.state.value, "ready");
});
test("P28 newer load invalidates the older load's pending detail", async (t) => {
  const pending = deferred();
  let count = 0;
  const h = harness(t, (url) =>
    url.endsWith(a.id) && ++count === 1 ? pending.promise : Promise.resolve(defaults(url)),
  );
  h.query({ export: a.id });
  const old = h.ui.load();
  await new Promise((r) => setImmediate(r));
  await h.ui.load();
  const current = snapshot(h.ui);
  pending.resolve(envelope({ ...a, version: -1 }, "old-load-detail"));
  await old;
  assert.deepEqual(snapshot(h.ui), current);
});
test("P28 current ready/empty and background failure preserve the existing report", async (t) => {
  let fail = false,
    empty = false;
  const h = harness(t, (url) =>
    fail
      ? Promise.reject(new ApiClientError("background"))
      : Promise.resolve(
          empty && url.startsWith("/reports/")
            ? envelope({ ...data.reports.opportunity, summary: { total: 0 } })
            : defaults(url),
        ),
  );
  await h.ui.load();
  assert.equal(h.ui.state.value, "ready");
  const report = plain(h.ui.report.value);
  fail = true;
  await h.ui.load(true);
  assert.equal(h.ui.state.value, "ready");
  assert.deepEqual(plain(h.ui.report.value), report);
  assert.equal(h.ui.requestId.value, "background");
  fail = false;
  empty = true;
  await h.ui.load();
  assert.equal(h.ui.state.value, "empty");
});

test("P28 changing only export query does not strand the initial report in loading", async (t) => {
  const pending = deferred();
  const h = harness(t, (url) =>
    url.startsWith("/reports/") ? pending.promise : Promise.resolve(defaults(url)),
  );
  const old = h.ui.load();
  h.query({ export: b.id });
  await h.ui.syncDetailFromRoute();
  pending.resolve(envelope(data.reports.opportunity));
  await old;
  assert.equal(h.ui.state.value, "ready");
  assert.equal(h.ui.selectedExport.value.id, b.id);
  assert.equal(h.calls.filter((c) => c.url === `/report-exports/${b.id}`).length, 1);
});
for (const change of ["report-roundtrip", "path-roundtrip"]) {
  test(`P28 ${change} invalidates an old list even after returning to its original URL`, async (t) => {
    const pending = deferred();
    const h = harness(t, (url) =>
      url.startsWith("/reports/") ? pending.promise : Promise.resolve(defaults(url)),
    );
    const old = h.ui.load();
    if (change === "report-roundtrip") {
      h.query({ report: "trend" });
      h.query({});
    } else {
      h.route.path = "/tasks";
      h.route.path = "/reports";
    }
    const current = snapshot(h.ui);
    pending.resolve(envelope(data.reports.opportunity, "old-roundtrip"));
    await old;
    assert.deepEqual(snapshot(h.ui), current);
  });
}
