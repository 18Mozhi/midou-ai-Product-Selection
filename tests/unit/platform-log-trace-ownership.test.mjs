import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { ref, computed } from "vue";
import { parse } from "@vue/compiler-sfc";
const source = parse(readFileSync("apps/web/src/components/PlatformLogCenter.vue", "utf8"))
  .descriptor.scriptSetup.content;
const ast = ts.createSourceFile("trace.ts", source, ts.ScriptTarget.Latest, true);
const code = ts.transpileModule(
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getText(ast))
    .join("\n"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
class ApiClientError extends Error {
  constructor(requestId) {
    super("local failure");
    this.requestId = requestId;
    this.actionHint = "本地测试失败。";
  }
}
function harness() {
  const calls = [],
    writes = [],
    timers = new Map(),
    downloads = [];
  let reason = "本地测试原因";
  const subject = vm.runInNewContext(
    `(function(){${code};return {load,exportCsv,state,items,requestId,readFailureId,exportRequestId,refreshing,exporting,message,exportMessage};})()`,
    {
      ref,
      computed,
      ApiClientError,
      AbortController,
      DOMException,
      URLSearchParams,
      defineProps: () => ({ apiBaseUrl: "/api/v1" }),
      useRoute: () => ({
        path: "/platform-admin/logs",
        query: { source: "crawler", query: "trace-shared" },
      }),
      useRouter: () => ({}),
      createApiClient: () => (path, init) =>
        new Promise((resolve, reject) => calls.push({ path, init, resolve, reject })),
      createApiResponseClient: () => (path, init) =>
        new Promise((resolve, reject) => writes.push({ path, init, resolve, reject })),
      useAuditedReason: () => ({ ask: async () => reason }),
      watch() {},
      onMounted() {},
      onActivated() {},
      onDeactivated() {},
      onBeforeUnmount() {},
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
      URL: {
        createObjectURL: () => "blob:local-test",
        revokeObjectURL: (url) => downloads.push(["revoke", url]),
      },
      document: { createElement: () => ({ click: () => downloads.push(["click"]) }) },
    },
  );
  return {
    subject,
    calls,
    writes,
    timers,
    downloads,
    setReason: (value) => {
      reason = value;
    },
    async seed(empty = false) {
      const pending = subject.load();
      calls.at(-1).resolve({
        request_id: "read-snapshot",
        data: {
          items: empty ? [] : [{ id: "sample" }],
          summary: { total: empty ? 0 : 1 },
          observed_at: "2026-08-18T12:00:03Z",
        },
      });
      await pending;
    },
    async fail(id) {
      const pending = subject.load();
      calls.at(-1).reject(new ApiClientError(id));
      await pending;
    },
  };
}
for (const empty of [false, true])
  test(`P62 failed read cannot relabel ${empty ? "empty" : "populated"} snapshot`, async () => {
    const h = harness();
    await h.seed(empty);
    await h.fail("read-failure");
    assert.equal(h.subject.requestId.value, "read-snapshot");
    assert.equal(h.subject.readFailureId.value, "read-failure");
    assert.equal(h.subject.exportRequestId.value, "");
    assert.equal(h.subject.state.value, empty ? "empty" : "ready");
  });
test("P62 first failure has only its own trace and recovery clears it", async () => {
  const h = harness();
  await h.fail("first-failure");
  assert.equal(h.subject.requestId.value, "");
  assert.equal(h.subject.readFailureId.value, "first-failure");
  await h.seed();
  assert.equal(h.subject.readFailureId.value, "");
  assert.equal(h.subject.requestId.value, "read-snapshot");
});
test("P62 timeout without a response does not reuse previous failure or snapshot ID", async () => {
  const h = harness();
  await h.seed();
  await h.fail("prior-failure");
  const pending = h.subject.load();
  assert.equal(h.subject.readFailureId.value, "");
  [...h.timers.values()][0]();
  h.calls.at(-1).reject(new DOMException("local abort", "AbortError"));
  await pending;
  assert.equal(h.subject.readFailureId.value, "");
  assert.equal(h.subject.requestId.value, "read-snapshot");
});
test("P62 failure without requestId leaves no unrelated fallback ID", async () => {
  const h = harness();
  await h.seed();
  await h.fail(undefined);
  assert.equal(h.subject.readFailureId.value, "");
  assert.equal(h.subject.requestId.value, "read-snapshot");
});
test("P62 export failure has a distinct trace and retains original POST contract", async () => {
  const h = harness();
  await h.seed();
  await h.fail("read-failure");
  const pending = h.subject.exportCsv();
  await new Promise(setImmediate);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].path, "/platform/management/logs/exports");
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes[0].init)), {
    method: "POST",
    headers: { accept: "text/csv" },
    body: { query: "trace-shared", source: "crawler", reason: "本地测试原因" },
  });
  h.writes[0].reject(new ApiClientError("export-failure"));
  await pending;
  assert.equal(h.subject.requestId.value, "read-snapshot");
  assert.equal(h.subject.readFailureId.value, "read-failure");
  assert.equal(h.subject.exportRequestId.value, "export-failure");
});
test("P62 export restart clears prior export ID, cancellation preserves the recent attempt", async () => {
  const h = harness();
  let pending = h.subject.exportCsv();
  await new Promise(setImmediate);
  h.writes[0].reject(new ApiClientError("export-old"));
  await pending;
  h.setReason(null);
  await h.subject.exportCsv();
  assert.equal(h.writes.length, 1);
  assert.equal(h.subject.exportRequestId.value, "export-old");
  h.setReason("重新尝试");
  pending = h.subject.exportCsv();
  await new Promise(setImmediate);
  assert.equal(h.subject.exportRequestId.value, "");
  h.writes[1].reject(new Error("no response"));
  await pending;
  assert.equal(h.subject.exportRequestId.value, "");
});
test("P62 export response trace never overwrites snapshot even when blob conversion fails", async () => {
  const h = harness();
  await h.seed();
  const pending = h.subject.exportCsv();
  await new Promise(setImmediate);
  h.writes[0].resolve({
    headers: { get: () => "export-response" },
    blob: async () => {
      throw new Error("local blob failure");
    },
  });
  await pending;
  assert.equal(h.subject.requestId.value, "read-snapshot");
  assert.equal(h.subject.exportRequestId.value, "export-response");
  assert.deepEqual(h.downloads, []);
});
test("P62 successful local export stub keeps read identity and later read keeps recent export trace", async () => {
  const h = harness();
  await h.seed();
  const pending = h.subject.exportCsv();
  await new Promise(setImmediate);
  h.writes[0].resolve({ headers: { get: () => "export-response" }, blob: async () => ({}) });
  await pending;
  assert.equal(h.subject.requestId.value, "read-snapshot");
  assert.equal(h.subject.exportRequestId.value, "export-response");
  assert.deepEqual(h.downloads, [["click"], ["revoke", "blob:local-test"]]);
  await h.seed();
  assert.equal(h.subject.exportRequestId.value, "export-response");
});
test("P62 an in-flight export ignores subsequent handler activation", async () => {
  const h = harness();
  const first = h.subject.exportCsv();
  await new Promise(setImmediate);
  const second = h.subject.exportCsv();
  await new Promise(setImmediate);
  assert.equal(h.writes.length, 1);
  h.writes[0].reject(new ApiClientError("first-export"));
  await Promise.all([first, second]);
  assert.equal(h.subject.exporting.value, false);
});
test("P62 two already-resolving reasons cannot dispatch two exports", async () => {
  const h = harness();
  const first = h.subject.exportCsv(),
    second = h.subject.exportCsv();
  await new Promise(setImmediate);
  assert.equal(h.writes.length, 1);
  h.writes[0].reject(new ApiClientError("first-export"));
  await Promise.all([first, second]);
});
test("P62 read-busy export activation remains blocked by the handler", async () => {
  const h = harness();
  h.subject.refreshing.value = true;
  const pending = h.subject.exportCsv();
  await new Promise(setImmediate);
  assert.equal(h.writes.length, 0);
  await pending;
});
test("P62 starting and failing export cannot erase the last read failure", async () => {
  const h = harness();
  await h.seed();
  await h.fail("read-failure");
  const readMessage = h.subject.message.value;
  const pending = h.subject.exportCsv();
  await new Promise(setImmediate);
  assert.equal(h.subject.message.value, readMessage);
  h.writes[0].reject(new ApiClientError("export-failure"));
  await pending;
  assert.equal(h.subject.message.value, readMessage);
  assert.equal(h.subject.exportMessage.value, "本地测试失败。");
});
for (const empty of [false, true])
  test(`P62 ${empty ? "empty" : "populated"} read recovery retains export feedback`, async () => {
    const h = harness();
    await h.seed();
    const pending = h.subject.exportCsv();
    await new Promise(setImmediate);
    h.writes[0].reject(new ApiClientError("export-failure"));
    await pending;
    assert.equal(h.subject.exportMessage.value, "本地测试失败。");
    await h.seed(empty);
    assert.equal(h.subject.message.value, "");
    assert.equal(h.subject.exportMessage.value, "本地测试失败。");
  });
test("P62 cancelled reason keeps export feedback; a new attempt only clears export feedback", async () => {
  const h = harness();
  await h.seed();
  h.subject.exportMessage.value = "上次导出反馈";
  h.setReason(null);
  await h.subject.exportCsv();
  assert.equal(h.subject.exportMessage.value, "上次导出反馈");
  await h.fail("read-failure");
  const readMessage = h.subject.message.value;
  h.setReason("再次排查");
  const pending = h.subject.exportCsv();
  await new Promise(setImmediate);
  assert.equal(h.subject.exportMessage.value, "");
  assert.equal(h.subject.message.value, readMessage);
  h.writes[0].reject(new Error("local failure"));
  await pending;
  assert.equal(h.subject.exportMessage.value, "链路日志导出未完成");
});
test("P62 local successful export stub does not relabel a read failure as success", async () => {
  const h = harness();
  await h.seed();
  await h.fail("read-failure");
  const readMessage = h.subject.message.value;
  const pending = h.subject.exportCsv();
  await new Promise(setImmediate);
  h.writes[0].resolve({ headers: { get: () => "export-response" }, blob: async () => ({}) });
  await pending;
  assert.equal(h.subject.message.value, readMessage);
  assert.match(h.subject.exportMessage.value, /当前筛选日志已导出/);
});
test("P62 initial read error stays a read error after export failure", async () => {
  const h = harness();
  await h.fail("initial-read-failure");
  const readMessage = h.subject.message.value;
  const pending = h.subject.exportCsv();
  await new Promise(setImmediate);
  h.writes[0].reject(new Error("local export failure"));
  await pending;
  assert.equal(h.subject.state.value, "error");
  assert.equal(h.subject.message.value, readMessage);
  assert.equal(h.subject.exportMessage.value, "链路日志导出未完成");
});
