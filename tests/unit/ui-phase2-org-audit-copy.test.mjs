import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { computed, effectScope, nextTick, reactive, ref, watch } from "vue";

const source = readFileSync("apps/web/src/components/OrganizationAuditPanel.vue", "utf8");
const script = source.split(/<script setup[^>]*>/)[1].split("</script>")[0];
const ast = ts.createSourceFile("component.ts", script, ts.ScriptTarget.Latest, true);
const body = ast.statements
  .filter((n) => !ts.isImportDeclaration(n))
  .map((n) => n.getFullText(ast))
  .join("\n");
function mount() {
  const events = [1, 2].map((i) => ({
    id: `event-${i}`,
    organization_id: "synthetic-org",
    request_id: `request-${i}`,
    trace_id: `trace-${i}`,
    action: "synthetic",
    outcome: "succeeded",
  }));
  const props = reactive({
    events,
    filters: {
      action: "",
      outcome: "",
      resource_type: "",
      request_id: "",
      trace_id: "",
      occurred_from: "",
      occurred_to: "",
    },
  });
  const route = reactive({ path: "/org-admin/audit", query: {} });
  const hooks = {},
    pending = [],
    scope = effectScope();
  const sandbox = {
    computed,
    ref,
    watch,
    defineProps: () => props,
    useRoute: () => route,
    useRouter: () => ({ replace: async () => {} }),
    onActivated: (f) => (hooks.activate = f),
    onDeactivated: (f) => (hooks.deactivate = f),
    onBeforeUnmount: (f) => (hooks.unmount = f),
    navigator: {
      clipboard: {
        writeText: (value) =>
          new Promise((resolve, reject) => pending.push({ value, resolve, reject })),
      },
    },
  };
  scope.run(() =>
    vm.runInNewContext(
      ts.transpileModule(
        body + "\nglobalThis.result={copy,choose,copyState,selectedEvent,loadedQuery};",
        { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
      ).outputText,
      sandbox,
    ),
  );
  const h = sandbox.result;
  return {
    ...h,
    props,
    route,
    hooks,
    pending,
    finish: () => {
      hooks.unmount();
      scope.stop();
    },
  };
}
async function run(callback) {
  const h = mount();
  try {
    await callback(h);
  } finally {
    h.finish();
    await nextTick();
  }
}

test("P37 current request/trace copies keep exact payload and success/failure feedback", () =>
  run(async (h) => {
    for (const field of ["request", "trace"])
      for (const outcome of ["resolve", "reject"]) {
        const value = h.selectedEvent.value[`${field}_id`],
          p = h.copy(value, field);
        assert.equal(h.copyState.value, "");
        assert.equal(h.pending.at(-1).value, value);
        h.pending.at(-1)[outcome]();
        await p;
        assert.equal(h.copyState.value, `${field}:${outcome === "resolve" ? "copied" : "failed"}`);
      }
  }));
test("P37 late success and rejection do not label a different selected record", () =>
  run(async (h) => {
    for (const outcome of ["resolve", "reject"]) {
      h.choose(h.props.events[0]);
      const p = h.copy("request-1", "request");
      h.choose(h.props.events[1]);
      h.pending.at(-1)[outcome]();
      await p;
      assert.equal(h.copyState.value, "");
      assert.equal(h.selectedEvent.value.id, "event-2");
    }
  }));
test("P37 A-B-A in the same tick and explicit reselection invalidate the old operation", () =>
  run(async (h) => {
    for (const reselect of [false, true]) {
      h.choose(h.props.events[0]);
      const p = h.copy("request-1", "request");
      if (!reselect) h.choose(h.props.events[1]);
      h.choose(h.props.events[0]);
      h.pending.at(-1).resolve();
      await p;
      assert.equal(h.copyState.value, "");
    }
  }));
test("P37 latest copy wins across fields and out-of-order success/failure", () =>
  run(async (h) => {
    const first = h.copy("request-1", "request"),
      second = h.copy("trace-1", "trace");
    h.pending[1].resolve();
    await second;
    h.pending[0].reject();
    await first;
    assert.equal(h.copyState.value, "trace:copied");
  }));
test("P37 filtered-out selection, emptied list and same-ID context replacement invalidate feedback", () =>
  run(async (h) => {
    for (const change of [
      () => (h.loadedQuery.value = "request-2"),
      () => (h.props.events = []),
      () => (h.props.events = h.props.events.map((v) => ({ ...v }))),
      () => (h.props.events[0].request_id = "replaced"),
      () => (h.props.events[0].trace_id = "replaced"),
      () => (h.props.events[0].organization_id = "other-synthetic-org"),
    ]) {
      h.loadedQuery.value = "";
      h.props.events = [
        {
          id: "event-1",
          organization_id: "synthetic-org",
          request_id: "request-1",
          trace_id: "trace-1",
          action: "synthetic",
        },
      ];
      const p = h.copy("request-1", "request");
      change();
      h.pending.at(-1).resolve();
      await p;
      assert.equal(h.copyState.value, "");
      await nextTick();
    }
  }));
test("P37 route departure and cached deactivate/reactivate cannot revive old feedback", () =>
  run(async (h) => {
    for (const change of [
      () => {
        h.route.path = "/away";
        h.route.path = "/org-admin/audit";
      },
      () => {
        h.hooks.deactivate();
        h.hooks.activate();
      },
    ]) {
      const p = h.copy("request-1", "request");
      change();
      h.pending.at(-1).resolve();
      await p;
      assert.equal(h.copyState.value, "");
    }
    h.hooks.deactivate();
    const count = h.pending.length;
    await h.copy("request-1", "request");
    assert.equal(h.pending.length, count);
    h.hooks.activate();
    h.route.path = "/away";
    await h.copy("request-1", "request");
    assert.equal(h.pending.length, count);
  }));
test("P37 unmount suppresses both pending feedback and further clipboard calls", () =>
  run(async (h) => {
    const p = h.copy("request-1", "request");
    h.hooks.unmount();
    h.pending[0].reject();
    await p;
    assert.equal(h.copyState.value, "");
    await h.copy("request-1", "request");
    assert.equal(h.pending.length, 1);
  }));
