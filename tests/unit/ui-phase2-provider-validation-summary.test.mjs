import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  historicalProviderSummarySource,
  providerSummaryRevision,
} from "../../scripts/lib/ui-phase2-provider-summary-baseline.mjs";
import vm from "node:vm";
import ts from "typescript";
import { parse } from "@vue/compiler-sfc";
import { ref, reactive, computed, watch } from "vue";

const file = "apps/web/src/components/ProviderRegistry.vue";
const text = readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const read = (f) => readFileSync(f, "utf8").replaceAll("\r\n", "\n");
const root = "output/playwright/p46-validation-summary";
const evidence = (mode) => JSON.parse(read(`${root}/${mode}/evidence.json`));
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
      "\nglobalThis.api={nextStep,applyTemplate,validationScope,editorStep,edit,closeEditor,load,save,form,editorOpen,editing,saving,pendingSaveGeneration,editorRequestId,requestId,message,successMessage,loadMessage,items,state,refreshing,loadController,formErrors};",
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

test("P46 summary changes only feedback ownership/update lines, retaining template/styles/validation/payload", () => {
  assert.equal(hash(text), providerSummaryRevision.after);
  const old = historicalProviderSummarySource(file, text);
  assert.equal(hash(old), providerSummaryRevision.before);
  let stripped = text;
  const start = stripped.indexOf("watch(\n  [editorStep, currentStepErrors,"),
    end = stripped.indexOf("let pageActive", start);
  assert.ok(start > 0 && end > start);
  stripped = stripped.slice(0, start) + stripped.slice(end);
  stripped = stripped.replace(/^  validationScope = ref<"step" \| "all" \| null>\(null\),\n/m, "");
  stripped = stripped.replace(/^\s*validationScope\.value = (?:"step"|"all"|null);\n/gm, "");
  stripped = stripped.replace(
    '  if (currentStepErrors.value.length) {\n    editorRequestId.value = "";\n',
    "  if (currentStepErrors.value.length) {\n",
  );
  stripped = stripped.replace(
    '    editorRequestId.value = "";\n    message.value = `还有 ',
    "    message.value = `还有 ",
  );
  assert.equal(stripped, old);
  assert.equal(historicalProviderSummarySource(file, text + "\n// drift"), text + "\n// drift");
});

test("P46 current raw App captures bind all104 images and prove summary changes without successful writes", () => {
  for (const mode of ["baseline", "current"]) {
    const e = evidence(mode),
      dir = `${root}/${mode}`;
    assert.equal(e.kind, "P46-VALIDATION-SUMMARY-r1");
    assert.equal(e.processesClosed, true);
    assert.equal(
      e.renderedRegistryHash,
      providerSummaryRevision[mode === "baseline" ? "before" : "after"],
    );
    assert.equal(e.observations.length, 52);
    assert.equal(e.checks.length, 136);
    assert.equal(e.screenshots.length, 52);
    for (const [f, sha] of Object.entries(e.sourceHashes)) assert.equal(hash(read(f)), sha, f);
    assert.deepEqual(
      readdirSync(dir).sort(),
      [...e.screenshots.map((s) => s.file), "evidence.json", "index.html"].sort(),
    );
    for (const s of e.screenshots)
      assert.equal(hash(readFileSync(`${dir}/${s.file}`)), s.sha256, s.file);
  }
  const a = evidence("baseline"),
    b = evidence("current");
  assert.deepEqual(a.network, b.network);
  for (const width of [390, 760, 761, 1440]) {
    const obs = (e, state) => e.observations.find((o) => o.width === width && o.state === state);
    for (const state of ["step1-cleared", "direct-step", "step3-cleared", "final-cleared"]) {
      assert.notEqual(obs(a, state).message, "");
      assert.equal(obs(b, state).message, "");
    }
    assert.equal(obs(b, "step1-two").message, "当前步骤还有 2 项需要修正。");
    assert.equal(obs(b, "step1-one").message, "当前步骤还有 1 项需要修正。");
    assert.equal(obs(b, "new-validation").traceVisible, 0);
    for (const state of ["template-preserved", "server-message-preserved"])
      assert.deepEqual(obs(a, state), obs(b, state));
    const requests = b.network.find((n) => n.width === width).requests;
    assert.equal(requests.length, 3);
    assert.equal(requests.filter((r) => r.key.startsWith("POST ")).length, 1);
  }
});

test("P46 step summary counts down with existing field errors and stays cleared after correction", async () => {
  const { api, requests } = setup();
  api.edit();
  await tick();
  api.nextStep();
  await tick();
  assert.equal(api.message.value, "当前步骤还有 3 项需要修正。");
  api.form.code = "valid_code";
  await tick();
  assert.equal(api.message.value, "当前步骤还有 2 项需要修正。");
  api.form.name = "有效来源";
  await tick();
  assert.equal(api.message.value, "当前步骤还有 1 项需要修正。");
  api.form.target_url = "https://example.test/feed";
  await tick();
  assert.equal(api.message.value, "");
  assert.equal(api.validationScope.value, null);
  api.form.name = "";
  await tick();
  assert.equal(
    api.message.value,
    "",
    "A new invalid edit alone does not create an attempted-submit summary",
  );
  assert.equal(requests.length, 0);
});

test("P46 step navigation clears only a step-scoped summary, not whole-form counts", async () => {
  const { api, requests } = setup();
  api.edit();
  await tick();
  api.nextStep();
  await tick();
  api.editorStep.value = 2;
  await tick();
  assert.equal(api.message.value, "");
  // Direct handler invocation exercises the existing defensive save branch; not a claim
  // that a disabled UI submit button was clicked.
  await api.save();
  await tick();
  assert.equal(api.message.value, "还有 3 项即时校验未通过。");
  api.editorStep.value = 3;
  await tick();
  assert.equal(api.message.value, "还有 3 项即时校验未通过。");
  api.form.schedule_minutes = 0;
  await tick();
  assert.equal(api.message.value, "还有 4 项即时校验未通过。");
  Object.assign(api.form, {
    code: "valid_code",
    name: "有效来源",
    target_url: "https://example.test/feed",
    schedule_minutes: 30,
  });
  await tick();
  assert.equal(api.message.value, "");
  assert.equal(api.validationScope.value, null);
  assert.equal(requests.length, 0);
});

test("P46 technical-template message is not erased by later field validation changes", async () => {
  const { api, open } = setup();
  open();
  await tick();
  api.editorStep.value = 3;
  api.form.schedule_minutes = 0;
  await tick();
  api.nextStep();
  await tick();
  assert.equal(api.message.value, "当前步骤还有 1 项需要修正。");
  api.applyTemplate();
  await tick();
  const message = api.message.value;
  assert.match(message, /已应用/);
  api.form.schedule_minutes = 0;
  await tick();
  assert.equal(api.message.value, message);
  assert.equal(api.validationScope.value, null);
});

test("P46 late current-server error owns its message; field edits preserve it and next validation detaches its trace", async () => {
  const { api, requests, open } = setup();
  open();
  await tick();
  const pending = api.save();
  api.form.name = "";
  await tick();
  api.nextStep();
  await tick();
  assert.equal(api.validationScope.value, "step");
  requests[0].reject(new ApiClientError(409, "当前版本冲突"));
  await pending;
  await tick();
  assert.equal(api.message.value, "当前版本冲突");
  assert.equal(api.validationScope.value, null);
  api.form.code = "";
  await tick();
  assert.equal(api.message.value, "当前版本冲突");
  assert.equal(api.editorRequestId.value, "fixture-error");
  api.nextStep();
  await tick();
  assert.equal(api.message.value, "当前步骤还有 2 项需要修正。");
  assert.equal(api.editorRequestId.value, "");
  api.closeEditor();
  await tick();
  api.edit();
  await tick();
  assert.equal(api.message.value, "");
  assert.equal(api.validationScope.value, null);
});
