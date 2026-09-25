import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { openReviewFixtures } from "../../scripts/lib/open-review-fixtures.mjs";
const source = readFileSync("apps/web/src/components/OpenPlatformCenter.vue", "utf8");
const script = parse(source).descriptor.scriptSetup.content;
const ast = ts.createSourceFile("open.ts", script, ts.ScriptTarget.Latest, true);
const code = ts.transpileModule(
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getText(ast))
    .join("\n") +
    "\nglobalThis.subject={call,load,notice,requestId,actionBusy,secret,data,get result(){return typeof actionResult==='undefined'?undefined:actionResult.value}};",
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const { fixture } = await openReviewFixtures();
function harness() {
  const calls = [],
    timers = new Map();
  let next = 0;
  class ApiClientError extends Error {
    constructor(id = "read-failed") {
      super("local error");
      Object.assign(this, { status: 503, requestId: id, actionHint: "本次读取暂不可用。" });
    }
  }
  const box = {
    ApiClientError,
    AbortController,
    URLSearchParams,
    innerWidth: 1440,
    location: { search: "", pathname: "/platform-admin/open-platform" },
    history: { state: null, replaceState() {} },
    defineProps: () => ({ apiBaseUrl: "/api/v1" }),
    ref: (value) => ({ value }),
    reactive: (value) => value,
    computed: (get) => ({
      get value() {
        return get();
      },
    }),
    nextTick: async () => {},
    watch() {},
    onActivated() {},
    onDeactivated() {},
    onMounted() {},
    onBeforeUnmount() {},
    createApiClient: () => (url, options) =>
      new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })),
    window: {
      setTimeout(fn, delay) {
        assert.equal(delay, 15000);
        timers.set(++next, fn);
        return next;
      },
      clearTimeout(id) {
        timers.delete(id);
      },
    },
  };
  vm.runInNewContext(code, box);
  return {
    subject: box.subject,
    calls,
    timers,
    ApiClientError,
    async ready() {
      const p = box.subject.load();
      calls.at(-1).resolve({ data: structuredClone(fixture), request_id: "read-ok" });
      await p;
    },
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));
for (const queued of [false, true])
  test(`P60 ${queued ? "queued" : "saved"} result survives failed list refresh and GET-only recovery`, async () => {
    const h = harness();
    await h.ready();
    const before = h.subject.data.value;
    const p = h.subject.call("/platform/open/local-test", "POST", { reason: "local test" });
    h.calls.at(-1).resolve({ data: queued ? { status: "queued" } : {}, request_id: "write-ok" });
    await tick();
    h.calls.at(-1).reject(new h.ApiClientError());
    await p;
    assert.equal(h.subject.result.requestId, "write-ok");
    assert.equal(h.subject.result.refresh, "failed");
    assert.match(h.subject.result.message, queued ? /队列/ : /操作成功/);
    assert.equal(h.subject.requestId.value, "read-failed");
    assert.match(h.subject.notice.value, /暂不可用/);
    assert.equal(h.subject.data.value, before);
    assert.equal(h.subject.actionBusy.value, false);
    await h.ready();
    assert.equal(h.subject.result.refresh, "ready");
    assert.equal(h.subject.result.requestId, "write-ok");
    assert.equal(h.calls.filter((c) => c.options.method === "POST").length, 1);
    assert.equal(h.subject.notice.value, "");
  });
test("P60 result is available while its refresh is pending; secret remains intact", async () => {
  const h = harness();
  await h.ready();
  const p = h.subject.call("/platform/open/clients", "POST", {});
  h.calls.at(-1).resolve({ data: { secret: "LOCAL-NON-CREDENTIAL" }, request_id: "write-secret" });
  await tick();
  assert.equal(h.subject.result.refresh, "pending");
  assert.equal(h.subject.secret.value.value, "LOCAL-NON-CREDENTIAL");
  h.calls.at(-1).resolve({ data: fixture, request_id: "read-after" });
  await p;
  assert.equal(h.subject.result.refresh, "ready");
  assert.equal(h.subject.requestId.value, "read-after");
});
test("P60 read begun before a write does not certify that write refreshed the list", async () => {
  const h = harness();
  await h.ready();
  const read = h.subject.load(),
    old = h.calls.at(-1);
  const write = h.subject.call("/platform/open/local-test", "PATCH", {});
  h.calls.at(-1).resolve({ data: {}, request_id: "write-ok" });
  await write;
  assert.equal(h.subject.result.refresh, "unverified");
  old.resolve({ data: fixture, request_id: "older-read" });
  await read;
  assert.equal(h.subject.result.refresh, "unverified");
  await h.ready();
  assert.equal(h.subject.result.refresh, "ready");
});
test("P60 failed write does not fabricate success or trigger a refresh; action remains single-flight", async () => {
  const h = harness();
  await h.ready();
  const write = h.subject.call("/platform/open/local-test", "POST", {});
  await h.subject.call("/platform/open/local-test", "POST", {});
  assert.equal(h.calls.length, 2);
  h.calls.at(-1).reject(new h.ApiClientError("write-failed"));
  await write;
  assert.equal(h.subject.result, null);
  assert.equal(h.subject.requestId.value, "write-failed");
  assert.equal(h.calls.length, 2);
});
