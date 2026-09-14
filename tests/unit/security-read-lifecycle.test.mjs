import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";

const file = "apps/web/src/components/SecurityOperationsCenter.vue";
const script = parse(readFileSync(file, "utf8")).descriptor.scriptSetup.content;
const ast = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true);
const code = ts.transpileModule(
  ast.statements
    .filter((node) => !ts.isImportDeclaration(node))
    .map((node) => node.getText(ast))
    .join("\n") +
    "\nglobalThis.subject={state,data,loadedOnce,refreshing,requestId,notice,activeView,page,tokenPage,load,refresh};",
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;

function harness() {
  const calls = [],
    timers = new Map();
  let timerId = 0;
  class ApiClientError extends Error {
    constructor(status) {
      super("local fixture");
      Object.assign(this, {
        status,
        kind: status === 403 ? "forbidden" : "blocked",
        requestId: "failure-request",
        actionHint: "稍后重试",
      });
    }
  }
  const route = {
    path: "/platform-admin/security",
    fullPath: "/platform-admin/security",
    query: {},
  };
  const box = {
    AbortController,
    DOMException,
    URLSearchParams,
    ApiClientError,
    defineProps: () => ({ apiBaseUrl: "/api/v1" }),
    ref: (value) => ({ value }),
    computed: (get) => ({
      get value() {
        return get();
      },
    }),
    useRoute: () => route,
    useRouter: () => ({}),
    onMounted: (fn) => {
      box.mount = fn;
    },
    onBeforeUnmount: (fn) => {
      box.unmount = fn;
    },
    watch: (_get, fn) => {
      box.changed = fn;
    },
    createApiClient: () => (url, options) =>
      new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })),
    window: {
      setTimeout(fn, delay) {
        assert.equal(delay, 15000);
        timers.set(++timerId, fn);
        return timerId;
      },
      clearTimeout(id) {
        timers.delete(id);
      },
    },
  };
  vm.runInNewContext(code, box);
  const response = (view, observed_at) => ({
    request_id: `request-${view}`,
    data: { view, observed_at },
  });
  return {
    box,
    calls,
    timers,
    response,
    route,
    get subject() {
      return box.subject;
    },
    change(view, path = route.path) {
      Object.assign(route, { path, query: { view }, fullPath: `${path}?view=${view}` });
      return box.changed();
    },
  };
}

for (const late of ["success", "failure"])
  test(`security view change replaces pending read; late ${late} cannot overwrite new scope`, async () => {
    const h = harness(),
      first = h.box.mount();
    const second = h.change("sessions");
    assert.equal(h.calls.length, 2, "new view must initiate its own request even while refreshing");
    assert.equal(h.calls[0].options.signal.aborted, true);
    assert.equal(
      new URL(h.calls[1].url, "https://fixture.invalid").searchParams.get("view"),
      "sessions",
    );
    h.calls[1].resolve(h.response("sessions", "2026-09-15T01:00:00Z"));
    await second;
    if (late === "success") h.calls[0].resolve(h.response("events", "2026-09-15T00:00:00Z"));
    else h.calls[0].reject(new h.box.ApiClientError(403));
    await first;
    assert.equal(h.subject.data.value.view, "sessions");
    assert.equal(h.subject.requestId.value, "request-sessions");
    assert.equal(h.subject.state.value, "ready");
    assert.equal(h.subject.notice.value, "");
    assert.equal(h.timers.size, 0);
  });

test("late old response cannot unlock or populate a newer pending query", async () => {
  const h = harness(),
    first = h.box.mount(),
    second = h.change("audit");
  assert.equal(h.calls.length, 2);
  h.calls[0].resolve(h.response("events", "2026-09-15T00:00:00Z"));
  await first;
  assert.equal(h.subject.refreshing.value, true);
  assert.equal(h.subject.loadedOnce.value, false);
  assert.equal(h.subject.state.value, "loading");
  h.calls[1].resolve(h.response("audit", "2026-09-15T01:00:00Z"));
  await second;
  assert.equal(h.subject.data.value.view, "audit");
});

for (const leave of ["unmount", "foreign-route"])
  test(`security ${leave} invalidates late results without reading a foreign query`, async () => {
    const h = harness(),
      first = h.box.mount();
    if (leave === "unmount") h.box.unmount();
    else await h.change("sessions", "/platform-admin/commercial");
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].options.signal.aborted, true);
    h.calls[0].resolve(h.response("events", "2026-09-15T00:00:00Z"));
    await first;
    assert.equal(h.subject.loadedOnce.value, false);
    assert.equal(h.subject.data.value.observed_at, null);
    assert.equal(h.subject.requestId.value, "");
  });

for (const retained of [false, true])
  test(`security timeout with retained=${retained} reports only a real snapshot`, async () => {
    const h = harness();
    let pending = h.box.mount();
    if (retained) {
      h.calls[0].resolve(h.response("events", "2026-09-15T00:00:00Z"));
      await pending;
      pending = h.subject.load();
    }
    const call = h.calls.at(-1);
    [...h.timers.values()][0]();
    assert.equal(call.options.signal.aborted, true);
    call.reject(new DOMException("local timeout", "AbortError"));
    await pending;
    assert.equal(
      h.subject.notice.value,
      retained
        ? "读取超过 15 秒，已停止本次请求并保留上次成功数据。"
        : "读取超过 15 秒，已停止本次请求，尚未取得安全运营数据。",
    );
    assert.equal(h.subject.state.value, retained ? "ready" : "error");
    assert.equal(h.subject.loadedOnce.value, retained);
    assert.equal(h.subject.refreshing.value, false);
    assert.equal(h.timers.size, 0);
  });

test("new scope clears previous trace and retains no old-scope ready state on failure", async () => {
  const h = harness(),
    first = h.box.mount();
  h.calls[0].resolve(h.response("events", "2026-09-15T00:00:00Z"));
  await first;
  const second = h.change("credentials");
  assert.equal(h.subject.state.value, "loading");
  assert.equal(h.subject.requestId.value, "");
  h.calls[1].reject(new h.box.ApiClientError(403));
  await second;
  assert.equal(h.subject.state.value, "forbidden");
  assert.equal(h.subject.requestId.value, "failure-request");
  assert.equal(h.subject.loadedOnce.value, false);
});

test("same-scope manual reads retain single-flight behavior", async () => {
  const h = harness(),
    pending = h.box.mount();
  await h.subject.load();
  await h.subject.refresh();
  assert.equal(h.calls.length, 1);
  h.calls[0].resolve(h.response("events", "2026-09-15T00:00:00Z"));
  await pending;
});

test("route identity rejects a response even before the Vue watcher flushes", async () => {
  const h = harness(),
    first = h.box.mount();
  h.route.fullPath = "/platform-admin/security?view=sessions";
  h.calls[0].resolve(h.response("events", "2026-09-15T00:00:00Z"));
  await first;
  assert.equal(h.subject.loadedOnce.value, false);
  assert.equal(h.subject.requestId.value, "");
  assert.equal(h.subject.data.value.observed_at, null);
});

test("returning from a foreign route starts a fresh owned read", async () => {
  const h = harness(),
    first = h.box.mount();
  await h.change("events", "/platform-admin/commercial");
  const returning = h.change("credentials", "/platform-admin/security");
  assert.equal(h.calls.length, 2);
  h.calls[1].resolve(h.response("credentials", "2026-09-15T01:00:00Z"));
  await returning;
  h.calls[0].resolve(h.response("events", "2026-09-15T00:00:00Z"));
  await first;
  assert.equal(h.subject.data.value.view, "credentials");
  assert.equal(h.subject.activeView.value, "credentials");
  assert.equal(h.timers.size, 0);
});
