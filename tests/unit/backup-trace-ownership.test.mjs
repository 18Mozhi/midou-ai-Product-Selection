import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { ref, computed } from "vue";
import { parse } from "@vue/compiler-sfc";
const file = readFileSync("apps/web/src/components/BackupRecoveryCenter.vue", "utf8");
const source = parse(file).descriptor.scriptSetup.content;
const ast = ts.createSourceFile("backup.ts", source, ts.ScriptTarget.Latest, true);
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
    `(function(){${code}; return {load,state,data,requestId,refreshFailure,get failureId(){return typeof readFailureId === 'undefined' ? undefined : readFailureId.value;}};})()`,
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
        data: {
          state: empty ? "empty" : "blocked",
          targets: empty ? [] : [{ asset_kind: "mysql_full" }],
        },
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
for (const empty of [false, true])
  test(`P64 failed refresh preserves ${empty ? "empty" : "populated"} snapshot identity`, async () => {
    const h = harness();
    await h.seed(empty);
    await h.fail("failure-new");
    assert.equal(h.subject.requestId.value, "snapshot-original");
    assert.equal(h.subject.failureId, "failure-new");
    assert.equal(h.subject.state.value, empty ? "empty" : "blocked");
  });
test("P64 first failure has no snapshot identity and later success clears failure", async () => {
  const h = harness();
  await h.fail("first-failure");
  assert.equal(h.subject.requestId.value, "");
  assert.equal(h.subject.failureId, "first-failure");
  await h.seed();
  assert.equal(h.subject.failureId, "");
  assert.equal(h.subject.requestId.value, "snapshot-original");
});
test("P64 restarting read clears old failure without relabeling retained snapshot", async () => {
  const h = harness();
  await h.seed();
  await h.fail("failure-old");
  const pending = h.subject.load();
  assert.equal(h.subject.failureId, "");
  assert.equal(h.subject.requestId.value, "snapshot-original");
  h.calls.at(-1).resolve({ request_id: "snapshot-next", data: { state: "verified" } });
  await pending;
  assert.equal(h.subject.requestId.value, "snapshot-next");
});
for (const seeded of [false, true])
  test(`P64 ${seeded ? "retained" : "initial"} timeout uses its own sent correlation ID`, async () => {
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
  test(`P64 ${kind} clears snapshot ID with cleared facts`, async () => {
    const h = harness();
    await h.seed();
    await h.fail(`failure-${kind}`, kind);
    assert.equal(h.subject.data.value, null);
    assert.equal(h.subject.requestId.value, "");
    assert.equal(h.subject.failureId, `failure-${kind}`);
  });
test("P64 unknown failure cannot reuse unrelated snapshot or failure identity", async () => {
  const h = harness();
  await h.seed();
  await h.fail("previous-failure");
  const pending = h.subject.load();
  h.calls.at(-1).reject(new Error("no response"));
  await pending;
  assert.equal(h.subject.failureId, "");
  assert.equal(h.subject.requestId.value, "snapshot-original");
});
test("P64 late result after unmount cannot replace accepted identities", async () => {
  const h = harness();
  await h.seed();
  const pending = h.subject.load();
  h.unmount();
  h.calls.at(-1).resolve({ request_id: "late", data: { state: "verified" } });
  await pending;
  assert.equal(h.subject.requestId.value, "snapshot-original");
  assert.equal(h.subject.failureId, "");
  assert.equal(h.timers.size, 0);
});
test("P64 template labels snapshot and both failure consumers separately", () => {
  const template = parse(file).descriptor.template.content;
  assert.equal((template.match(/summary="本次失败读取追踪"/g) ?? []).length, 2);
  assert.equal((template.match(/:request-id="readFailureId"/g) ?? []).length, 2);
  assert.equal((template.match(/summary="快照读取追踪"/g) ?? []).length, 1);
});
