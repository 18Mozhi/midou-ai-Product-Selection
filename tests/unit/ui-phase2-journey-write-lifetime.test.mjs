import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { ref, reactive, computed } from "vue";

// Execute the actual setup with real Vue refs; lifecycle and HTTP are explicit test boundaries.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = (
  await readFile(path.join(repo, "apps/web/src/components/SelectionJourney.vue"), "utf8")
)
  .split('<script setup lang="ts">')[1]
  .split("</script>")[0];
const ast = ts.createSourceFile("journey.ts", source, ts.ScriptTarget.Latest, true);
const setup = ast.statements
  .filter((node) => !ts.isImportDeclaration(node))
  .map((node) => node.getText(ast))
  .join("\n");
const code = ts.transpileModule(
  setup +
    "\nexport const exposed={create,decide,form,decision,journey,state,message,requestId,busy};",
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;
const key = "scoutops.selection-journey.active-id";
const oldId = "00000000-0000-4000-8000-000000008101",
  newId = "00000000-0000-4000-8000-000000008102";
const result = (action) => ({
  id: oldId,
  state: action === "create" ? "running" : "decided",
  results: [],
  first_result: null,
  elapsed_ms: 0,
  decision: action === "create" ? null : { action: "observe", reason: "原提交原因" },
});
class ApiClientError extends Error {}
function harness() {
  const hooks = { mounted: [], activated: [], deactivated: [], unmounted: [] },
    storage = new Map(),
    storageCalls = [],
    requests = [],
    timers = [];
  let resolve, reject;
  const pending = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const context = {
    exports: {},
    ref,
    reactive,
    computed,
    AbortController,
    ApiClientError,
    statusLabel: (v) => v,
    defineProps: () => ({ apiBaseUrl: "/api/v1" }),
    onMounted: (f) => hooks.mounted.push(f),
    onActivated: (f) => hooks.activated.push(f),
    onDeactivated: (f) => hooks.deactivated.push(f),
    onUnmounted: (f) => hooks.unmounted.push(f),
    createApiClient: () => (url, options) => {
      requests.push({
        url,
        method: options?.method ?? "GET",
        body: options?.body ? JSON.parse(JSON.stringify(options.body)) : undefined,
      });
      return pending;
    },
    localStorage: {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => {
        storageCalls.push(["set", k, v]);
        storage.set(k, v);
      },
      removeItem: (k) => {
        storageCalls.push(["remove", k]);
        storage.delete(k);
      },
    },
    window: {
      setTimeout: (f, ms) => {
        timers.push(ms);
        return timers.length;
      },
      clearTimeout() {},
      history: { back() {} },
    },
  };
  vm.runInNewContext(code, context);
  hooks.mounted.forEach((f) => f());
  return {
    ui: context.exports.exposed,
    hooks,
    storage,
    storageCalls,
    requests,
    timers,
    resolve,
    reject,
  };
}
const snapshot = (ui) =>
  JSON.stringify({
    state: ui.state.value,
    message: ui.message.value,
    requestId: ui.requestId.value,
    busy: ui.busy.value,
    journey: ui.journey.value,
    reason: ui.decision.reason,
  });
function submit(h, action) {
  if (action === "create") {
    h.ui.form.input_value = "原商品关键词";
    return h.ui.create();
  }
  h.ui.journey.value = result("create");
  h.ui.decision.reason = "原提交原因";
  h.storage.set(key, oldId);
  return h.ui.decide();
}
for (const action of ["create", "decide"]) {
  for (const outcome of ["success", "failure"]) {
    test(`${action}: disposed instance ignores late ${outcome} including storage and finally`, async () => {
      const h = harness(),
        work = submit(h, action);
      assert.equal(h.requests.length, 1);
      assert.equal(h.ui.busy.value, true);
      h.hooks.unmounted.forEach((f) => f());
      h.storage.set(key, newId);
      const before = snapshot(h.ui);
      if (outcome === "success") h.resolve({ data: result(action), request_id: "old-response" });
      else h.reject(new Error("old failure"));
      await work;
      assert.equal(
        h.storage.get(key),
        newId,
        "old response must not overwrite/clear a later instance bookmark",
      );
      assert.deepEqual(h.storageCalls, []);
      assert.equal(
        snapshot(h.ui),
        before,
        "disposed refs must not be mutated by success/catch/finally",
      );
      assert.deepEqual(h.timers, []);
    });
  }
  test(`${action}: ordinary KeepAlive deactivation still retains its result without polling`, async () => {
    const h = harness(),
      work = submit(h, action);
    h.hooks.deactivated.forEach((f) => f());
    h.resolve({ data: result(action), request_id: "current-response" });
    await work;
    assert.equal(h.ui.journey.value.state, action === "create" ? "running" : "decided");
    assert.equal(h.storage.get(key) ?? null, action === "create" ? oldId : null);
    assert.equal(h.ui.busy.value, false);
    assert.deepEqual(h.timers, []);
  });
  test(`${action}: active instance preserves request and normal success lifecycle`, async () => {
    const h = harness(),
      work = submit(h, action);
    const expected =
      action === "create"
        ? {
            url: "/selection-journeys",
            method: "POST",
            body: { input_kind: "keyword", input_value: "原商品关键词" },
          }
        : {
            url: `/selection-journeys/${oldId}/decisions`,
            method: "POST",
            body: { action: "observe", reason: "原提交原因", selected_raw_evidence_id: null },
          };
    assert.deepEqual(h.requests, [expected]);
    await (action === "create" ? h.ui.create() : h.ui.decide());
    assert.equal(h.requests.length, 1, "busy submit guard remains");
    h.resolve({ data: result(action), request_id: "current-response" });
    await work;
    assert.equal(h.ui.state.value, "ready");
    assert.equal(h.ui.busy.value, false);
    assert.deepEqual(h.timers, action === "create" ? [2000] : []);
  });
}
