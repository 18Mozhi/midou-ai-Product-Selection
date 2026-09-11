import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { ref, reactive, computed, watch } from "vue";

const file = "apps/web/src/components/ProviderRegistry.vue";
const text = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const source = parse(text).descriptor.scriptSetup.content;
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
let isolated = source;
for (const n of [...ast.statements].reverse())
  if (ts.isImportDeclaration(n)) isolated = isolated.slice(0, n.pos) + isolated.slice(n.end);
const code = ts.transpileModule(isolated, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const envelope = (data, request_id = "fixture-response") => ({ data, request_id });
const tick = async () => {
  for (let n = 0; n < 6; n++) await Promise.resolve();
};
class ApiClientError extends Error {
  constructor(status, actionHint = "请稍后重试。") {
    super(actionHint);
    this.status = status;
    this.actionHint = actionHint;
    this.requestId = "fixture-error";
  }
}
function setup() {
  const requests = [],
    hooks = {},
    timers = new Map();
  let timerId = 0;
  const box = {
    ref,
    reactive,
    computed,
    watch,
    ApiClientError,
    AbortController,
    URL,
    Date,
    // This VM suite isolates request ownership without DOM; the real modal hook has its
    // own actual-App browser replay and lifecycle tests in provider-editor-isolation.
    useProviderEditorIsolation: (panel, isOpen) => {
      assert.equal(panel.value, null);
      assert.equal(isOpen(), false);
    },
    nextTick: () => {},
    onMounted: (f) => {
      hooks.mount = f;
    },
    onBeforeUnmount: (f) => {
      hooks.unmount = f;
    },
    onDeactivated: (f) => {
      hooks.deactivate = f;
    },
    onActivated: (f) => {
      hooks.activate = f;
    },
    HTMLElement: class {},
    document: { activeElement: null },
    window: {
      setTimeout: (fn) => {
        timers.set(++timerId, fn);
        return timerId;
      },
      clearTimeout: (id) => timers.delete(id),
      requestAnimationFrame: () => {},
    },
    defineProps: () => ({ apiBaseUrl: "/api/v1" }),
    createApiClient:
      () =>
      (path, options = {}) => {
        const d = deferred();
        requests.push({ path, options, ...d });
        return d.promise;
      },
  };
  vm.runInNewContext(
    code +
      "\nglobalThis.api={edit,closeEditor,load,save,form,editorOpen,editing,saving,pendingSaveGeneration,editorRequestId,requestId,message,successMessage,loadMessage,items,state,refreshing,loadController,formErrors};",
    box,
  );
  const api = box.api;
  const open = (name = "审核来源") => {
    api.edit();
    Object.assign(api.form, {
      code: "review_source",
      name,
      target_url: "https://example.test/feed",
    });
    assert.deepEqual(Object.keys(api.formErrors.value), []);
  };
  return { api, requests, hooks, timers, open };
}

test("P46 stale success and failure cannot close or overwrite a newer editor; global save stays serial", async () => {
  for (const outcome of ["success", "failure"]) {
    const { api, requests, open } = setup();
    open();
    const old = api.save();
    assert.equal(requests.length, 1);
    api.closeEditor();
    open("新窗口草稿");
    api.message.value = "新窗口自己的反馈";
    api.editorRequestId.value = "new-window-id";
    await api.save();
    assert.equal(requests.length, 1, "No second write while first request is pending");
    if (outcome === "success") requests[0].resolve(envelope({}));
    else requests[0].reject(new ApiClientError(409, "旧版本冲突"));
    await old;
    assert.equal(api.editorOpen.value, true);
    assert.equal(api.form.name, "新窗口草稿");
    assert.equal(api.message.value, "新窗口自己的反馈");
    assert.equal(api.editorRequestId.value, "new-window-id");
    assert.equal(api.successMessage.value, "");
    assert.equal(requests.length, 1, "Stale save must not initiate a reload");
    assert.equal(api.saving.value, false);
    assert.equal(api.pendingSaveGeneration.value, null);
  }
});

test("P46 current save distinguishes confirmed mutation from successful or failed refresh", async () => {
  for (const refreshed of [true, false]) {
    const { api, requests, open } = setup();
    open();
    const saved = api.save();
    requests[0].resolve(envelope({}));
    await tick();
    assert.equal(requests.length, 2);
    assert.equal(requests[1].path, "/platform/providers");
    assert.equal(api.editorOpen.value, false);
    if (refreshed) requests[1].resolve(envelope([]));
    else requests[1].reject(new ApiClientError(500));
    await saved;
    assert.equal(
      api.successMessage.value,
      refreshed
        ? "审核来源已创建，来源定义列表已刷新。"
        : "审核来源已创建；列表未能刷新，请重新读取。",
    );
    assert.equal(api.saving.value, false);
  }
});

test("P46 refresh after accepted save cannot overwrite new editor feedback or read/write trace ownership", async () => {
  const { api, requests, open } = setup();
  open();
  const saved = api.save();
  requests[0].resolve(envelope({}, "write-id"));
  await tick();
  assert.equal(requests.length, 2);
  open("更新后的窗口");
  api.message.value = "当前窗口反馈";
  api.editorRequestId.value = "current-editor-id";
  requests[1].resolve(envelope([], "read-id"));
  await saved;
  assert.equal(api.editorOpen.value, true);
  assert.equal(api.form.name, "更新后的窗口");
  assert.equal(api.message.value, "当前窗口反馈");
  assert.equal(api.editorRequestId.value, "current-editor-id");
  assert.equal(api.requestId.value, "read-id");
  assert.equal(api.successMessage.value, "");
});

test("P46 superseded reads cannot replace data or clear the newer busy/controller state", async () => {
  for (const outcome of ["success", "failure"]) {
    const { api, requests } = setup();
    api.items.value = [{ id: "old-snapshot" }];
    const a = api.load(),
      b = api.load();
    const currentController = api.loadController.value;
    assert.equal(requests[0].options.signal.aborted, true);
    if (outcome === "success") requests[0].resolve(envelope([{ id: "stale-result" }]));
    else requests[0].reject(new ApiClientError(500));
    assert.equal(await a, false);
    assert.equal(api.items.value[0].id, "old-snapshot");
    assert.equal(api.refreshing.value, true);
    assert.equal(api.loadController.value, currentController);
    requests[1].resolve(envelope([{ id: "current-result" }]));
    assert.equal(await b, true);
    assert.equal(api.items.value[0].id, "current-result");
    assert.equal(api.refreshing.value, false);
  }
});

test("P46 timed-out resolve is a failed read, not a successful refresh", async () => {
  const { api, requests, timers } = setup();
  api.items.value = [{ id: "retained" }];
  const reading = api.load();
  [...timers.values()][0]();
  requests[0].resolve(envelope([{ id: "late" }]));
  assert.equal(await reading, false);
  assert.equal(api.items.value[0].id, "retained");
  assert.match(api.loadMessage.value, /超过 12 秒/);
  assert.equal(api.state.value, "ready");
  assert.equal(timers.size, 0);
});

test("P46 deactivated and unmounted sessions reject late save/read results; interrupted read resumes", async () => {
  for (const phase of ["deactivate", "unmount"]) {
    const { api, requests, hooks, open } = setup();
    open();
    const saving = api.save();
    hooks[phase]();
    requests[0].resolve(envelope({}));
    await saving;
    assert.equal(api.editorOpen.value, true, "Inactive cached draft is not closed by stale save");
    assert.equal(api.successMessage.value, "");
    assert.equal(requests.length, 1);
    await api.load();
    await api.save();
    assert.equal(requests.length, 1);
  }
  const { api, requests, hooks } = setup();
  const reading = api.load();
  hooks.deactivate();
  assert.equal(requests[0].options.signal.aborted, true);
  requests[0].resolve(envelope([{ id: "late" }]));
  assert.equal(await reading, false);
  assert.equal(api.items.value.length, 0);
  hooks.activate();
  assert.equal(requests.length, 2);
  requests[1].resolve(envelope([]));
  await tick();
  assert.equal(api.state.value, "empty");
});
