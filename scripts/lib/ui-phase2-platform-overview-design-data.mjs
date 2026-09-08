import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildPlatformOverviewDesignData(repo) {
  const read = (p) => readFile(path.join(repo, p), "utf8"),
    parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  function find(ast, predicate) {
    const result = [];
    function visit(n) {
      if (predicate(n)) result.push(n);
      ts.forEachChild(n, visit);
    }
    visit(ast);
    return result;
  }
  function run(source, bindings = {}) {
    const box = { ...bindings };
    vm.runInNewContext(
      ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
        .outputText,
      box,
    );
    return box.__result;
  }
  const fixture = parse(await read("tests/e2e/m06-02-platform-dashboard.spec.ts"));
  function variable(name) {
    const matches = find(
      fixture,
      (n) => ts.isVariableDeclaration(n) && n.name.getText(fixture) === name,
    );
    assert.equal(matches.length, 1, name);
    return plain(run("globalThis.__result=" + matches[0].initializer.getText(fixture)));
  }
  const dashboard = variable("dashboard"),
    providers15 = variable("providerHealth");
  const trends = find(
    fixture,
    (n) =>
      ts.isPropertyAssignment(n) &&
      n.name.getText(fixture) === "task_trend" &&
      ts.isArrayLiteralExpression(n.initializer) &&
      n.initializer.elements.length === 3,
  );
  assert.equal(trends.length, 1);
  const trend = plain(run("globalThis.__result=" + trends[0].initializer.getText(fixture)));
  const vue = await read("apps/web/src/components/PlatformDashboard.vue"),
    ast = parse(vue.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const script = ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(ast))
    .join("\n");
  class ApiClientError extends Error {
    constructor(kind) {
      super(kind);
      this.kind = kind;
      this.requestId = "fixture-failure";
    }
  }
  function harness(windowCode = "24h") {
    const calls = [],
      replacements = [],
      timers = new Map();
    let response = dashboard,
      failure,
      held,
      resolve,
      reject,
      next = 0;
    const h = run(
      script +
        "\nglobalThis.__result={data,state,windowCode,pending,requestId,refreshError,load,changeWindow,providerHealthExpanded,providerHealthRows,visibleProviderHealth,hiddenProviderHealthCount,bytes,queueText,signalText,signalValue,alertText,trendTotals,successRateText,trendPoints};",
      {
        defineProps: () => ({ apiBaseUrl: "fixture" }),
        useRoute: () => ({ query: { window: windowCode, keep: "yes" } }),
        useRouter: () => ({ replace: async (v) => replacements.push(plain(v)) }),
        ref: (value) => ({ value }),
        computed: (fn) => ({
          get value() {
            return fn();
          },
        }),
        onMounted: () => {},
        ApiClientError,
        AbortController,
        window: {
          setTimeout: (f, ms) => {
            assert.equal(ms, 12000);
            timers.set(++next, f);
            return next;
          },
          clearTimeout: (id) => timers.delete(id),
        },
        createApiClient: () => (url, options) => {
          calls.push(url);
          if (held)
            return new Promise((res, rej) => {
              resolve = res;
              reject = rej;
              options.signal.addEventListener("abort", () => rej(new Error("aborted")));
            });
          return failure
            ? Promise.reject(failure)
            : Promise.resolve({ data: plain(response), request_id: "m06-02-e2e" });
        },
      },
    );
    return {
      h,
      calls,
      replacements,
      timers,
      response: (v) => {
        response = v;
      },
      fail: (kind) => {
        failure = new ApiClientError(kind);
      },
      hold: () => {
        held = true;
      },
      resolve: () => resolve({ data: plain(response), request_id: "m06-02-e2e" }),
      reject: () => reject(new Error("fixture")),
    };
  }
  const a = harness();
  await a.h.load();
  assert.equal(a.h.state.value, "ready");
  assert.deepEqual(plain(a.h.providerHealthRows.value.map((p) => p.id)), ["p2", "p1", "p3"]);
  a.h.data.value.provider_health = providers15;
  assert.equal(a.h.visibleProviderHealth.value.length, 8);
  assert.equal(a.h.visibleProviderHealth.value[0].id, "provider-15");
  assert.equal(a.h.hiddenProviderHealthCount.value, 7);
  a.h.providerHealthExpanded.value = true;
  assert.equal(a.h.visibleProviderHealth.value.length, 15);
  a.h.data.value.task_trend = trend;
  assert.deepEqual(plain(a.h.trendTotals.value), { succeeded: 43, failed: 3 });
  const points = Object.fromEntries(
    ["succeeded", "failed"].map((key) => [key, a.h.trendPoints(key)]),
  );
  assert.equal(a.h.successRateText.value, "96.4%");
  a.h.data.value.summary.task_success_rate = null;
  assert.equal(a.h.successRateText.value, "暂无样本");
  a.h.data.value.summary.task_success_rate = 0;
  assert.equal(a.h.successRateText.value, "0.0%");
  assert.equal(a.h.bytes(734003200), "700.0 MB");
  assert.equal(a.h.bytes(12582912), "12.0 MB");
  assert.equal(a.h.queueText("parsing"), "其他状态");
  a.h.data.value.task_trend = [{ succeeded: 0, failed: 0 }];
  assert.equal(a.h.trendPoints("succeeded"), "0,170");
  const windows = {};
  for (const code of ["15m", "24h", "7d", "30d"]) {
    const b = harness(code);
    await b.h.changeWindow();
    windows[code] = b.calls[0];
    assert.equal(b.replacements[0].query.keep, "yes");
  }
  assert.equal(harness("invalid").h.windowCode.value, "24h");
  const b = harness();
  await b.h.load();
  b.h.windowCode.value = "7d";
  b.fail("blocked");
  await b.h.changeWindow();
  assert.equal(b.h.windowCode.value, "7d");
  assert.equal(b.h.data.value.window, "24h");
  assert.equal(b.h.state.value, "ready");
  for (const kind of ["expired", "forbidden", "rate_limited"]) {
    b.fail(kind);
    await b.h.load();
    assert.equal(b.h.state.value, "ready");
    const c = harness();
    c.fail(kind);
    await c.h.load();
    assert.equal(c.h.state.value, kind);
  }
  const c = harness();
  c.hold();
  const work = c.h.load();
  await c.h.load();
  assert.equal(c.calls.length, 1);
  [...c.timers.values()][0]();
  await work;
  assert.equal(c.h.state.value, "blocked");
  assert.equal(c.timers.size, 0);
  const onlyTrend = {
    ...dashboard,
    summary: {},
    queues: [],
    alerts: [],
    provider_health: [],
    task_trend: trend,
  };
  const d = harness();
  d.response(onlyTrend);
  await d.h.load();
  assert.equal(d.h.state.value, "empty");
  const technical = await read("apps/web/src/components/TechnicalDetails.vue");
  const ta = parse(technical.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const copyNode = find(ta, (n) => ts.isFunctionDeclaration(n) && n.name?.text === "copy")[0];
  const copy = run(copyNode.getText(ta) + ";globalThis.__result=copy", {
    navigator: {
      clipboard: {
        writeText: async () => {
          throw new Error("synthetic denied");
        },
      },
    },
    copied: { value: "" },
  });
  await assert.rejects(copy("请求编号", "fixture"), /synthetic denied/);
  return {
    dashboard,
    providers15,
    trend,
    points,
    windows,
    sourceChecks: {
      fixture:
        "Original dashboard, independent 15-provider and three-point trend fixtures extracted from existing E2E AST; values not reconciled or recomputed.",
      vue: "Actual inert functions/computed: 8/15 priority, 43/3 trend, null/0 rate, bytes, fallback labels, four window URLs, preserved query, invalid default, pending single-flight and 12000ms abort callback.",
      reproduced:
        "Selected 7d with failed refresh retains 24h; existing-ready 401/403 retains data; trend-only is empty; TechnicalDetails copy rejection is uncaught.",
      limits:
        "Not mounted Vue, real API, SQL, authorization, browser history, OS clipboard or production proof. Metric scope and audit writes are source inspection only.",
    },
  };
}
