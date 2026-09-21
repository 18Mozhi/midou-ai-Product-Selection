import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { computed, reactive, ref, watch, nextTick, effectScope } from "vue";
import { parse } from "@vue/compiler-sfc";
const file = "apps/web/src/components/PlatformLogCenter.vue",
  script = parse(readFileSync(file, "utf8")).descriptor.scriptSetup.content;
const ast = ts.createSourceFile(file + ".ts", script, ts.ScriptTarget.Latest, true);
const code = ts.transpileModule(
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getText(ast))
    .join("\n"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const cleanups = [];
test.afterEach(() => cleanups.splice(0).forEach((fn) => fn()));
const flush = async () => {
  await nextTick();
  await Promise.resolve();
  await nextTick();
};
function harness(query = {}) {
  const route = reactive({ path: "/platform-admin/logs", query }),
    calls = [],
    timers = new Map(),
    hooks = { mounted: [], activated: [], deactivated: [], unmounted: [] },
    scope = effectScope();
  class ApiClientError extends Error {}
  const subject = scope.run(() =>
    vm.runInNewContext(
      `(function(){${code}; return {load,state,items,query,source,message,requestId,observedAt,refreshing,keepRetryVisible,displayedScope,appliedScope,scopeMismatch};})()`,
      {
        computed,
        ref,
        watch,
        URLSearchParams,
        AbortController,
        DOMException,
        ApiClientError,
        defineProps: () => ({ apiBaseUrl: "/api/v1" }),
        useRoute: () => route,
        useRouter: () => ({
          replace: async ({ query }) => {
            route.query = query;
            await flush();
          },
        }),
        createApiClient: () => (path, init) =>
          new Promise((resolve, reject) => calls.push({ path, init, resolve, reject })),
        createApiResponseClient: () => () => {
          throw new Error("No export in lifecycle tests");
        },
        useAuditedReason: () => ({}),
        onMounted: (fn) => hooks.mounted.push(fn),
        onActivated: (fn) => hooks.activated.push(fn),
        onDeactivated: (fn) => hooks.deactivated.push(fn),
        onBeforeUnmount: (fn) => hooks.unmounted.push(fn),
        window: {
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
    ),
  );
  const run = (name) => hooks[name].forEach((fn) => void fn());
  cleanups.push(() => {
    run("unmounted");
    scope.stop();
  });
  return {
    route,
    subject,
    calls,
    timers,
    run,
    resolve(index, id = "sample") {
      calls[index].resolve({
        request_id: id,
        data: { items: [{ id }], summary: { total: 1 }, observed_at: "2026-08-18T12:00:03Z" },
      });
    },
    async start() {
      run("mounted");
      run("activated");
      await flush();
    },
    async move(path, query = {}) {
      route.path = path;
      route.query = query;
      await flush();
    },
  };
}
test("P62 a changed filter replaces the pending GET and rejects its late success", async () => {
  const h = harness({ query: "trace-shared" });
  await h.start();
  h.route.query = { query: "trace-shared", source: "crawler" };
  await flush();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].init.signal.aborted, true);
  assert.equal(
    h.calls[1].path,
    "/platform/management?domain=logs&query=trace-shared&status=crawler",
  );
  assert.equal(h.timers.size, 1);
  h.resolve(1, "new");
  await flush();
  h.resolve(0, "old");
  await flush();
  assert.equal(h.subject.items.value[0].id, "new");
  assert.equal(h.subject.requestId.value, "new");
  assert.equal(h.timers.size, 0);
});
test("P62 old rejection cannot clear a replacement pending flag or timer", async () => {
  const h = harness();
  await h.start();
  h.route.query = { source: "worker" };
  await flush();
  assert.equal(h.calls.length, 2);
  h.calls[0].reject(new Error("old failure"));
  await flush();
  assert.equal(h.subject.refreshing.value, true);
  assert.equal(h.subject.message.value, "");
  assert.equal(h.timers.size, 1);
  h.resolve(1);
  await flush();
  assert.equal(h.subject.refreshing.value, false);
});
test("P62 inactive route changes neither request logs nor overwrite preserved draft fields", async () => {
  const h = harness();
  await h.start();
  h.resolve(0);
  await flush();
  h.subject.query.value = "draft";
  await h.move("/platform-admin/status", { query: "foreign" });
  h.run("deactivated");
  h.route.query = { query: "other", source: "crawler" };
  await flush();
  await h.subject.load();
  assert.equal(h.calls.length, 1);
  assert.equal(h.subject.query.value, "draft");
  await h.move("/platform-admin/logs");
  h.run("activated");
  await flush();
  assert.equal(h.calls.length, 1);
  assert.equal(h.subject.query.value, "draft");
});
test("P62 leaving a pending read clears its timer and reentry resumes once", async () => {
  const h = harness();
  await h.start();
  await h.move("/platform-admin/status");
  h.run("deactivated");
  assert.equal(h.calls[0].init.signal.aborted, true);
  assert.equal(h.timers.size, 0);
  assert.equal(h.subject.refreshing.value, false);
  await h.move("/platform-admin/logs");
  h.run("activated");
  await flush();
  assert.equal(h.calls.length, 2);
  h.resolve(0, "late");
  await flush();
  assert.equal(h.subject.requestId.value, "");
  assert.equal(h.subject.refreshing.value, true);
  h.resolve(1, "resumed");
  await flush();
  assert.equal(h.subject.requestId.value, "resumed");
});
test("P62 a cached page reads once when returning with different filters", async () => {
  const h = harness();
  await h.start();
  h.resolve(0);
  await flush();
  await h.move("/platform-admin/status");
  h.run("deactivated");
  await h.move("/platform-admin/logs", { source: "api", query: " exact " });
  h.run("activated");
  await flush();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].path, "/platform/management?domain=logs&query=exact&status=api");
  assert.equal(h.subject.query.value, "exact");
  assert.equal(h.subject.source.value, "api");
});
test("P62 equivalent normalized query does not restart a completed or pending read", async () => {
  const h = harness({ query: "term" });
  await h.start();
  h.route.query = { query: " term " };
  await flush();
  assert.equal(h.calls.length, 1);
  h.resolve(0);
  await flush();
  h.route.query = { query: "term", ignored: "no-api-field" };
  await flush();
  assert.equal(h.calls.length, 1);
});
test("P62 invalid initial source is normalized with exactly one valid read", async () => {
  const h = harness({ source: "invalid", query: "kept" });
  await h.start();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].path, "/platform/management?domain=logs&query=kept");
  assert.equal(h.route.query.source, undefined);
});
test("P62 replacing a pending retry keeps its existing focusable button mounted", async () => {
  const h = harness();
  await h.start();
  h.calls[0].reject(new Error("first failure"));
  await flush();
  void h.subject.load();
  await flush();
  assert.equal(h.subject.keepRetryVisible.value, true);
  h.route.query = { source: "worker" };
  await flush();
  assert.equal(h.calls.length, 3);
  assert.equal(h.subject.keepRetryVisible.value, true);
});
test("P62 unmount clears the timer and forbids later manual or activation reads", async () => {
  const h = harness();
  await h.start();
  h.run("unmounted");
  assert.equal(h.timers.size, 0);
  await h.subject.load();
  h.run("activated");
  await flush();
  assert.equal(h.calls.length, 1);
  h.resolve(0, "late");
  await flush();
  assert.equal(h.subject.requestId.value, "");
});
const scopeValue = (value) => JSON.parse(JSON.stringify(value));
test("P62 scope is unknown before success and captures the normalized successful request", async () => {
  const h = harness({ query: "  trace-shared  ", source: "crawler" });
  await h.start();
  assert.equal(h.subject.displayedScope.value, null);
  h.resolve(0);
  await flush();
  assert.deepEqual(scopeValue(h.subject.displayedScope.value), {
    query: "trace-shared",
    source: "crawler",
  });
  assert.equal(h.subject.scopeMismatch.value, false);
});
test("P62 editing drafts cannot relabel applied or displayed scope", async () => {
  const h = harness();
  await h.start();
  h.resolve(0);
  await flush();
  h.subject.query.value = "unsubmitted draft";
  h.subject.source.value = "worker";
  await flush();
  assert.deepEqual(scopeValue(h.subject.appliedScope.value), { query: "", source: "" });
  assert.deepEqual(scopeValue(h.subject.displayedScope.value), { query: "", source: "" });
  assert.equal(h.subject.scopeMismatch.value, false);
  assert.equal(h.calls.length, 1);
});
for (const empty of [false, true])
  test(`P62 failed changed filter keeps ${empty ? "empty" : "populated"} snapshot scope until successful retry`, async () => {
    const h = harness();
    await h.start();
    h.calls[0].resolve({
      request_id: "initial",
      data: { items: empty ? [] : [{ id: "initial" }], observed_at: "2026-08-18T12:00:03Z" },
    });
    await flush();
    h.route.query = { query: "trace-shared", source: "crawler" };
    await flush();
    assert.deepEqual(scopeValue(h.subject.appliedScope.value), {
      query: "trace-shared",
      source: "crawler",
    });
    assert.deepEqual(scopeValue(h.subject.displayedScope.value), { query: "", source: "" });
    assert.equal(h.subject.scopeMismatch.value, true);
    h.calls[1].reject(new Error("local read failure"));
    await flush();
    assert.deepEqual(scopeValue(h.subject.displayedScope.value), { query: "", source: "" });
    const pending = h.subject.load();
    h.calls[2].resolve({
      request_id: "new-empty",
      data: { items: [], observed_at: "2026-08-18T12:00:04Z" },
    });
    await pending;
    await flush();
    assert.deepEqual(scopeValue(h.subject.displayedScope.value), {
      query: "trace-shared",
      source: "crawler",
    });
    assert.equal(h.subject.scopeMismatch.value, false);
    assert.equal(h.subject.state.value, "empty");
  });
test("P62 rejected late success cannot overwrite current snapshot scope", async () => {
  const h = harness({ query: "old" });
  await h.start();
  h.route.query = { query: "new", source: "api" };
  await flush();
  h.resolve(1, "new-response");
  await flush();
  h.resolve(0, "old-response");
  await flush();
  assert.deepEqual(scopeValue(h.subject.displayedScope.value), { query: "new", source: "api" });
  assert.equal(h.subject.scopeMismatch.value, false);
});
