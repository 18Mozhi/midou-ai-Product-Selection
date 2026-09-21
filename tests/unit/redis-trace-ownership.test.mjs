import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { ref, computed } from "vue";
import { parse } from "@vue/compiler-sfc";
const file = readFileSync("apps/web/src/components/RedisResilienceCenter.vue", "utf8");
const source = parse(file).descriptor.scriptSetup.content;
const ast = ts.createSourceFile("redis.ts", source, ts.ScriptTarget.Latest, true);
const code = ts.transpileModule(
  ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getText(ast))
    .join("\n"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
class ApiClientError extends Error {
  constructor(id, kind = "unavailable") {
    super("local");
    this.requestId = id;
    this.kind = kind;
    this.actionHint = "本地测试";
  }
}
function harness() {
  const calls = [],
    timers = new Map();
  let unmount,
    sequence = 0;
  const subject = vm.runInNewContext(
    `(function(){${code}; return {load,state,data,requestId,refreshFailure,
      get failureId(){return typeof readFailureId === 'undefined' ? undefined : readFailureId.value;}};})()`,
    {
      ref,
      computed,
      ApiClientError,
      AbortController,
      DOMException,
      defineProps: () => ({ apiBaseUrl: "/api/v1" }),
      createApiClient: () => (path, init) =>
        new Promise((resolve, reject) => calls.push({ path, init, resolve, reject })),
      crypto: { randomUUID: () => `local-outbound-${++sequence}` },
      onMounted() {},
      onBeforeUnmount: (fn) => {
        unmount = fn;
      },
      window: {
        setTimeout: (fn, ms) => {
          assert.equal(ms, 15000);
          timers.set(fn, fn);
          return fn;
        },
        clearTimeout: (id) => timers.delete(id),
      },
    },
  );
  return {
    subject,
    calls,
    timers,
    unmount: () => unmount(),
    async seed(empty = false, id = "snapshot-original") {
      const pending = subject.load();
      calls.at(-1).resolve({
        request_id: id,
        data: empty ? null : { state: "blocked" },
      });
      await pending;
    },
    async fail(id, kind) {
      const pending = subject.load();
      calls.at(-1).reject(new ApiClientError(id, kind));
      await pending;
    },
  };
}
for (const kind of ["unavailable", "rate_limited"])
  test(`P67 ${kind} refresh preserves populated snapshot identity`, async () => {
    const h = harness();
    await h.seed();
    await h.fail("failure-new", kind);
    assert.equal(h.subject.requestId.value, "snapshot-original");
    assert.equal(h.subject.failureId, "failure-new");
    assert.equal(h.subject.state.value, "blocked");
    assert.equal(h.subject.refreshFailure.value, kind);
  });
test("P67 first failure has no snapshot identity and later success clears failure", async () => {
  const h = harness();
  await h.fail("first-failure");
  assert.equal(h.subject.requestId.value, "");
  assert.equal(h.subject.failureId, "first-failure");
  await h.seed();
  assert.equal(h.subject.failureId, "");
  assert.equal(h.subject.requestId.value, "snapshot-original");
});
test("P67 restarting read clears old failure without relabeling retained snapshot", async () => {
  const h = harness();
  await h.seed();
  await h.fail("failure-old");
  const pending = h.subject.load();
  assert.equal(h.subject.failureId, "");
  assert.equal(h.subject.requestId.value, "snapshot-original");
  h.calls.at(-1).resolve({ request_id: "snapshot-next", data: { state: "ready" } });
  await pending;
  assert.equal(h.subject.requestId.value, "snapshot-next");
});
for (const seeded of [false, true])
  test(`P67 ${seeded ? "retained" : "initial"} timeout uses its own sent correlation ID`, async () => {
    const h = harness();
    if (seeded) await h.seed();
    const pending = h.subject.load(),
      call = h.calls.at(-1);
    [...h.timers.values()][0]();
    call.reject(new DOMException("local abort", "AbortError"));
    await pending;
    assert.equal(h.subject.failureId, call.init.requestId);
    assert.equal(call.init.requestId, call.init.traceId);
    assert.equal(h.subject.requestId.value, seeded ? "snapshot-original" : "");
    assert.equal(call.init.signal.aborted, true);
  });
for (const kind of ["expired", "forbidden"])
  test(`P67 ${kind} clears snapshot ID with cleared facts`, async () => {
    const h = harness();
    await h.seed();
    await h.fail(`failure-${kind}`, kind);
    assert.equal(h.subject.data.value, null);
    assert.equal(h.subject.requestId.value, "");
    assert.equal(h.subject.failureId, `failure-${kind}`);
  });
test("P67 unknown failure cannot reuse unrelated snapshot or failure identity", async () => {
  const h = harness();
  await h.seed();
  await h.fail("previous-failure");
  const pending = h.subject.load();
  h.calls.at(-1).reject(new Error("no response"));
  await pending;
  assert.equal(h.subject.failureId, "");
  assert.equal(h.subject.requestId.value, "snapshot-original");
});
test("P67 late result after unmount cannot replace accepted identities", async () => {
  const h = harness();
  await h.seed();
  const pending = h.subject.load();
  h.unmount();
  h.calls.at(-1).resolve({ request_id: "late", data: { state: "ready" } });
  await pending;
  assert.equal(h.subject.requestId.value, "snapshot-original");
  assert.equal(h.subject.failureId, "");
  assert.equal(h.timers.size, 0);
});
test("P67 template labels snapshot and both failure consumers separately", () => {
  const template = parse(file).descriptor.template.content;
  assert.equal((template.match(/summary="本次失败读取追踪"/g) ?? []).length, 2);
  assert.equal((template.match(/:request-id="readFailureId"/g) ?? []).length, 2);
  assert.match(template, /summary="本次读取追踪"/);
  assert.equal((template.match(/summary="快照读取追踪"/g) ?? []).length, 1);
});

test("P67 null response has a read ID but not a fabricated snapshot, next failure clears it", async () => {
  const h = harness();
  await h.seed(true, "empty-response");
  assert.equal(h.subject.data.value, null);
  assert.equal(h.subject.state.value, "empty");
  assert.equal(h.subject.requestId.value, "empty-response");
  const pending = h.subject.load();
  assert.equal(h.subject.requestId.value, "");
  h.calls.at(-1).reject(new ApiClientError("after-empty"));
  await pending;
  assert.equal(h.subject.failureId, "after-empty");
  assert.equal(h.subject.requestId.value, "");
});
test("P67 empty success after populated snapshot removes old facts and failure", async () => {
  const h = harness();
  await h.seed();
  await h.fail("old-failure");
  await h.seed(true, "empty-next");
  assert.equal(h.subject.data.value, null);
  assert.equal(h.subject.requestId.value, "empty-next");
  assert.equal(h.subject.failureId, "");
});
