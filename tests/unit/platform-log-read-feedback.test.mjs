import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { ref, computed, markRaw } from "vue";
import { parse, compileScript, compileTemplate } from "@vue/compiler-sfc";
const file = "apps/web/src/components/PlatformLogCenter.vue",
  source = readFileSync(file, "utf8"),
  script = parse(source).descriptor.scriptSetup.content,
  ast = ts.createSourceFile(file + ".ts", script, ts.ScriptTarget.Latest, true),
  code = ts.transpileModule(
    ast.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getText(ast))
      .join("\n"),
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
class ApiClientError extends Error {
  constructor(actionHint, requestId = "local-failure") {
    super(actionHint);
    this.actionHint = actionHint;
    this.requestId = requestId;
  }
}
function harness() {
  const calls = [],
    timers = new Map(),
    unmount = [],
    route = { query: {}, path: "/platform-admin/logs" };
  const subject = vm.runInNewContext(
    `(function(){${code};return {load,state,items,summary,observedAt,message,refreshing,requestId,refreshButton,retryButton,keepRetryVisible,handoffRetryFocus};})()`,
    {
      ref,
      computed,
      AbortController,
      DOMException,
      URLSearchParams,
      ApiClientError,
      defineProps: () => ({ apiBaseUrl: "/api/v1" }),
      useRoute: () => route,
      useRouter: () => ({}),
      createApiClient: () => (path, init) =>
        new Promise((resolve, reject) => calls.push({ path, init, resolve, reject })),
      createApiResponseClient: () => () => {
        throw new Error("Export is outside read tests");
      },
      useAuditedReason: () => ({}),
      watch() {},
      onMounted() {},
      onActivated() {},
      onDeactivated() {},
      onBeforeUnmount: (fn) => unmount.push(fn),
      window: {
        innerHeight: 844,
        setTimeout(fn, ms) {
          assert.equal(ms, 15000);
          timers.set(fn, fn);
          return fn;
        },
        clearTimeout(id) {
          timers.delete(id);
        },
      },
    },
  );
  return {
    subject,
    route,
    calls,
    timers,
    stop: () => unmount.forEach((fn) => fn()),
    timeout() {
      [...timers.values()][0]();
      calls.at(-1).reject(new DOMException("local abort", "AbortError"));
    },
    async seed(empty = false) {
      const pending = subject.load();
      calls.at(-1).resolve({
        request_id: "local-snapshot",
        data: {
          items: empty ? [] : [{ id: "local-event" }],
          summary: { total: empty ? 0 : 1 },
          observed_at: "2026-08-18T12:00:03Z",
        },
      });
      await pending;
    },
  };
}
test("P62 initial loading hides retry but an existing retry survives subsequent waiting", async () => {
  const h = harness(),
    first = h.subject.load();
  assert.equal(h.subject.keepRetryVisible.value, false);
  h.calls[0].reject(new ApiClientError("test"));
  await first;
  const retry = h.subject.load();
  assert.equal(h.subject.keepRetryVisible.value, true);
  assert.equal(h.subject.state.value, "loading");
  await h.subject.load();
  assert.equal(h.calls.length, 2);
  h.calls[1].reject(new ApiClientError("test"));
  await retry;
  assert.equal(h.subject.state.value, "error");
  assert.equal(h.subject.keepRetryVisible.value, false);
});
function focusHarness(change = {}) {
  const h = harness(),
    doc = markRaw({ activeElement: null }),
    calls = [];
  const from = markRaw({ isConnected: true, ownerDocument: doc, closest: () => null });
  const to = markRaw({
    isConnected: true,
    ownerDocument: doc,
    closest: () => null,
    getClientRects: () => [1],
    getBoundingClientRect: () => ({ top: 20, bottom: 64, left: 10, width: 100, height: 44 }),
    contains: (el) => el === to,
    focus: (options) => {
      calls.push(["focus", options.preventScroll]);
      doc.activeElement = to;
    },
    scrollIntoView: (options) => calls.push(["scroll", options.block]),
  });
  doc.activeElement = from;
  doc.elementFromPoint = () => to;
  Object.assign(from, change.from);
  Object.assign(to, change.to);
  Object.assign(doc, change.doc);
  h.subject.retryButton.value = from;
  h.subject.refreshButton.value = to;
  if (change.path) h.route.path = change.path;
  return { ...h, from, to, doc, focusCalls: calls };
}
test("P62 successful read hands off owned retry focus before removing its state region", async () => {
  const h = focusHarness();
  await h.seed();
  assert.equal(h.doc.activeElement, h.to);
  assert.deepEqual(h.focusCalls, [["focus", true]]);
  assert.equal(h.subject.state.value, "ready");
});
for (const [name, change] of [
  ["focus moved elsewhere", { doc: { activeElement: {} } }],
  ["different route", { path: "/platform-admin/status" }],
  ["detached retry", { from: { isConnected: false } }],
  ["detached refresh", { to: { isConnected: false } }],
  ["inert retry", { from: { closest: () => ({}) } }],
  ["inert refresh", { to: { closest: () => ({}) } }],
  ["hidden refresh", { to: { getClientRects: () => [] } }],
])
  test(`P62 ${name} prevents focus handoff`, () => {
    const h = focusHarness(change);
    h.subject.handoffRetryFocus();
    assert.deepEqual(h.focusCalls, []);
  });
for (const [name, change] of [
  [
    "offscreen",
    {
      to: {
        getBoundingClientRect: () => ({ top: -60, bottom: -16, left: 10, width: 100, height: 44 }),
      },
    },
  ],
  ["covered", { doc: { elementFromPoint: () => ({}) } }],
])
  test(`P62 ${name} refresh is scrolled only after focus was accepted`, () => {
    const h = focusHarness(change);
    h.subject.handoffRetryFocus();
    assert.deepEqual(h.focusCalls, [
      ["focus", true],
      ["scroll", "center"],
    ]);
  });
for (const kind of ["first", "ready", "empty"]) {
  test(`P62 ${kind} timeout reports client waiting and only an existing snapshot`, async () => {
    const h = harness();
    if (kind !== "first") await h.seed(kind === "empty");
    const previous = h.subject.items.value,
      observedAt = h.subject.observedAt.value;
    const pending = h.subject.load();
    h.timeout();
    await pending;
    assert.equal(
      h.subject.message.value,
      "读取超过 15 秒，已停止本次等待。" +
        (kind === "first" ? " 尚未取得链路日志。" : " 已保留上次成功日志。"),
    );
    assert.equal(h.subject.state.value, kind === "first" ? "error" : kind);
    assert.equal(h.subject.items.value, previous);
    assert.equal(h.subject.observedAt.value, observedAt);
    assert.equal(h.subject.refreshing.value, false);
    assert.equal(h.calls.at(-1).init.signal.aborted, true);
    assert.equal(h.timers.size, 0);
  });
  test(`P62 ${kind} failure retains the original hint and successful retry clears it`, async () => {
    const h = harness();
    if (kind !== "first") await h.seed(kind === "empty");
    const previous = h.subject.items.value,
      pending = h.subject.load();
    h.calls.at(-1).reject(new ApiClientError("本地测试读取失败。"));
    await pending;
    assert.equal(
      h.subject.message.value,
      "本地测试读取失败。" + (kind === "first" ? "" : " 已保留上次成功日志。"),
    );
    assert.equal(h.subject.items.value, previous);
    assert.equal(h.subject.state.value, kind === "first" ? "error" : kind);
    await h.seed();
    assert.equal(h.subject.state.value, "ready");
    assert.equal(h.subject.message.value, "");
    assert.equal(h.subject.requestId.value, "local-snapshot");
    assert.equal(h.timers.size, 0);
  });
}
test("P62 single-flight and unmount invalidation retain the existing read contract", async () => {
  const h = harness(),
    pending = h.subject.load();
  await h.subject.load();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].path, "/platform/management?domain=logs");
  assert.deepEqual(Object.keys(h.calls[0].init), ["signal"]);
  h.stop();
  assert.equal(h.calls[0].init.signal.aborted, true);
  h.calls[0].resolve({ request_id: "late", data: { items: [], observed_at: "late" } });
  await pending;
  assert.equal(h.subject.observedAt.value, "");
  assert.equal(h.subject.requestId.value, "");
  assert.equal(h.timers.size, 0);
});
test("P62 refused focus does not scroll an unrelated target", () => {
  const h = focusHarness({ to: { focus: () => {} }, doc: { elementFromPoint: () => ({}) } });
  h.subject.handoffRetryFocus();
  assert.equal(h.doc.activeElement, h.from);
  assert.deepEqual(h.focusCalls, []);
});
test("P62 initial read has a named busy region and compiles without changing ready feedback", () => {
  assert.match(source, /:aria-busy="refreshing"\s+aria-labelledby="platform-log-read-title"/);
  assert.match(source, /<h3 id="platform-log-read-title">/);
  assert.match(source, /v-if="message && state === 'ready'"/);
  const { descriptor, errors } = parse(source);
  assert.deepEqual(errors, []);
  const compiled = compileScript(descriptor, { id: "p62-read" });
  assert.deepEqual(
    compileTemplate({
      source: descriptor.template.content,
      filename: file,
      id: "p62-read",
      compilerOptions: { bindingMetadata: compiled.bindings },
    }).errors,
    [],
  );
});
