import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

class ClientError extends Error {
  constructor(kind) {
    super(kind);
    Object.assign(this, { kind, actionHint: kind, requestId: "error", traceId: "error" });
  }
}
async function component(name, request, query = {}) {
  const source = await readFile(`apps/web/src/components/${name}.vue`, "utf8");
  let script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
  const ast = ts.createSourceFile("component.ts", script, ts.ScriptTarget.Latest, true);
  for (const statement of [...ast.statements].reverse())
    if (ts.isImportDeclaration(statement))
      script = script.slice(0, statement.getStart(ast)) + script.slice(statement.end);
  const props = {
    apiBaseUrl: "/api/v1",
    organizationId: "org-a",
    workspaceId: "workspace-a",
    capabilities: ["trend:manage"],
  };
  const route = { query, fullPath: "/trends" },
    watchers = [];
  const router = {
    push: async (value) => {
      route.query = value.query;
    },
    replace: async (value) => {
      route.query = value.query;
    },
  };
  const context = {
    exports: {},
    AbortController,
    URLSearchParams,
    queueMicrotask,
    setTimeout,
    clearTimeout,
    defineProps: () => props,
    withDefaults: (value) => value,
    ref: (value) => ({ value }),
    reactive: (value) => value,
    computed: (getter) => ({
      get value() {
        return getter();
      },
    }),
    watch: (getter, callback) => watchers.push({ getter, callback }),
    onMounted() {},
    onBeforeUnmount() {},
    onActivated() {},
    onDeactivated() {},
    useRoute: () => route,
    useRouter: () => router,
    createApiClient: () => (path, options) => request(path, options, props),
    ApiClientError: ClientError,
  };
  const expose =
    name === "TrendDashboard"
      ? "({load,syncFromRoute,get state(){return state.value},get selected(){return selected.value},get topics(){return topics.value}})"
      : "({load,get state(){return state.value},get data(){return data.value}})";
  const compiled = ts.transpileModule(script + `\nglobalThis.surface=${expose};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(compiled, context);
  return { surface: context.surface, props, route, watchers, source };
}
const envelope = (data) => ({
  data,
  meta: { total: data.length ?? 1 },
  request_id: "request",
  trace_id: "trace",
});
const tick = () => new Promise(setImmediate);

test("market intelligence loads list and evidence without calling retired management APIs", async () => {
  const calls = [];
  const app = await component("TrendDashboard", async (path, options) => {
    calls.push([path, options?.method ?? "GET"]);
    if (path.startsWith("/trends?")) return envelope([{ id: "topic" }]);
    if (path === "/trends/topic") return envelope({ id: "topic", evidence: [] });
    throw Error("retired API must not be called");
  });
  await app.surface.load();
  assert.equal(app.surface.state, "ready");
  assert.equal(app.surface.selected.id, "topic");
  assert.deepEqual(
    calls.map((c) => c[1]),
    ["GET", "GET"],
  );
  assert.equal(calls.length, 2);
  assert.doesNotMatch(
    app.source,
    /monitoring-rules|change-requests|provider-sources\/refresh|\/follow|TrendRuleDialog|TrendChangeQueue/,
  );
});

test("empty and failed intelligence reads never request a fabricated detail", async () => {
  for (const fails of [false, true]) {
    const calls = [];
    const app = await component("TrendDashboard", async (path) => {
      calls.push(path);
      if (fails) throw Error("offline");
      return envelope([]);
    });
    await app.surface.load();
    assert.equal(calls.length, 1);
    assert.equal(app.surface.state, fails ? "blocked" : "empty");
    assert.equal(app.surface.selected, null);
  }
});

test("scope change aborts the old intelligence read and cannot restore another workspace's response", async () => {
  let releaseOld, oldSignal;
  const app = await component("TrendDashboard", async (path, options, props) => {
    if (props.organizationId === "org-a") {
      oldSignal = options.signal;
      return new Promise((resolve) => {
        releaseOld = resolve;
      });
    }
    return path.startsWith("/trends?")
      ? envelope([{ id: "new-topic" }])
      : envelope({ id: "new-topic" });
  });
  const old = app.surface.load();
  const scopeWatcher = app.watchers.find((w) =>
    w.getter.toString().includes("props.organizationId"),
  );
  assert.ok(scopeWatcher);
  app.props.organizationId = "org-b";
  app.props.workspaceId = "workspace-b";
  scopeWatcher.callback();
  await tick();
  assert.equal(oldSignal.aborted, true);
  releaseOld(envelope([{ id: "old-topic" }]));
  await old;
  assert.equal(app.surface.selected.id, "new-topic");
  assert.equal(app.surface.topics[0].id, "new-topic");
});

test("legacy management links fall back to intelligence while retaining topic and filters", async () => {
  for (const section of ["rules", "governance"]) {
    const app = await component(
      "TrendDashboard",
      async () => {
        throw Error("no fetch expected");
      },
      { section, tab: "rules", q: "storage", topic: "topic", sort: "followed" },
    );
    app.surface.syncFromRoute();
    assert.equal(app.route.query.section, undefined);
    assert.equal(app.route.query.tab, undefined);
    assert.equal(app.route.query.sort, undefined);
    assert.equal(app.route.query.q, "storage");
    assert.equal(app.route.query.topic, "topic");
  }
});

test("home only reads its existing summary and retains actual completion facts", async () => {
  const calls = [],
    daily = { completed_count: 0, discovered_count: 30, qualified_count: 0, target_minimum: 100 };
  const app = await component("HomeDashboard", async (path, options) => {
    calls.push([path, options?.method ?? "GET"]);
    return envelope({
      actions: [],
      changes: [],
      follows: [],
      health: [],
      automatic_selection: { state: "attention", daily_production: daily },
    });
  });
  await app.surface.load();
  await app.surface.load();
  assert.deepEqual(calls, [
    ["/me/home-dashboard", "GET"],
    ["/me/home-dashboard", "GET"],
  ]);
  assert.equal(app.surface.data.automatic_selection.daily_production.completed_count, 0);
  assert.doesNotMatch(app.source, /monitoring-rules|setupForm|resumeRule|createRule|section=rules/);
});

test("home still clears protected cached data after authorization expires", async () => {
  let expires = false;
  const app = await component("HomeDashboard", async () => {
    if (expires) throw new ClientError("expired");
    return envelope({
      actions: [],
      changes: [],
      follows: [],
      health: [],
      automatic_selection: { state: "running" },
    });
  });
  await app.surface.load();
  assert.ok(app.surface.data);
  expires = true;
  await app.surface.load();
  assert.equal(app.surface.data, null);
  assert.equal(app.surface.state, "expired");
});
