import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export async function buildProviderAdaptersDesignData(repo) {
  const read = (p) => readFile(path.join(repo, p), "utf8");
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  const compile = (s) =>
    ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const noImports = (ast) =>
    ast.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText(ast).replace(/^\s*export /, "\n"))
      .join("\n");
  const fixture = parse(await read("tests/e2e/m03-03-provider-adapter.spec.ts"));
  const declarations = [];
  function visit(n) {
    if (
      ts.isVariableDeclaration(n) &&
      ["base", "items", "catalog"].includes(n.name.getText(fixture))
    )
      declarations.push(n);
    ts.forEachChild(n, visit);
  }
  visit(fixture);
  assert.equal(declarations.length, 3);
  const box = {};
  vm.runInNewContext(
    compile(
      declarations.map((n) => `const ${n.getText(fixture)};`).join("\n") +
        "globalThis.result={items,catalog};",
    ),
    box,
  );
  const { items, catalog } = plain(box.result);
  assert.equal(items.length, 2);
  assert.equal(catalog.length, 45);
  const source = await read("apps/web/src/components/ProviderAdapterCenter.vue");
  const ast = parse(source.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const exports =
    "state,items,requestId,query,mode,providerStatus,registration,health,sort,page,probing,refreshing,lastUpdatedAt,message,failure,accessModeText,providerStatusText,healthText,errorText,runtimeCategoryText,circuitText,recoveryText,percentText,filtered,sorted,totalPages,pageItems,registered,resetFilters,load,probe";
  const body = compile(noImports(ast));
  const sourceLogic = `// Derived from ProviderAdapterCenter.vue; inert bridge, not mounted Vue.\nwindow.ADAPTER_C_SOURCE=(bridge)=>{\nconst {ref,computed,watch,onMounted,defineProps,createApiClient,ApiClientError,window,AbortController,DOMException}=bridge;\n${body}\nreturn {${exports}};\n};\n`;
  class ApiClientError extends Error {
    constructor(status) {
      super(String(status));
      this.status = status;
      this.actionHint = `合成 ${status} 拒绝`;
      this.requestId = `synthetic-${status}`;
    }
  }
  function mount(rows = items) {
    const watchers = [],
      reads = [],
      timers = [],
      cleared = [],
      global = { window: {} };
    vm.runInNewContext(sourceLogic, global);
    const c = global.window.ADAPTER_C_SOURCE({
      ref: (value) => ({ value }),
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
      watch: (s, cb) => watchers.push(cb),
      onMounted: () => {},
      defineProps: () => ({ apiBaseUrl: "" }),
      createApiClient: () => (url, options) =>
        new Promise((resolve, reject) => reads.push({ url, options, resolve, reject })),
      ApiClientError,
      AbortController,
      DOMException,
      window: {
        setTimeout: (cb, ms) => {
          timers.push({ cb, ms });
          return timers.length;
        },
        clearTimeout: (id) => cleared.push(id),
      },
    });
    c.items.value = plain(rows);
    return { c, watchers, reads, timers, cleared };
  }
  const controls = ["query", "mode", "providerStatus", "registration", "health", "sort"];
  const cases = [];
  const scenarios = [
    ["default", "items", {}, 2],
    ["catalog", "catalog", {}, 45],
    ["name", "catalog", { sort: "name" }, 45],
    ["recent", "items", { sort: "recent" }, 2],
    ["query-code", "catalog", { query: " CATALOG_SOURCE_45 " }, 1],
    ["query-version", "catalog", { query: "catalog-v1" }, 30],
    ["query-error", "items", { query: "adapter_not_registered" }, 1],
    ["mode", "catalog", { mode: "public_page" }, 22],
    ["status", "items", { providerStatus: "disabled" }, 2],
    ["registration", "catalog", { registration: "unregistered" }, 15],
    ["health", "items", { health: "ready" }, 1],
    ["no-match", "items", { query: "不存在的来源" }, 0],
    [
      "combined",
      "catalog",
      { mode: "public_rss", registration: "registered", health: "unknown", sort: "name" },
      15,
    ],
  ];
  for (const [key, scope, values, count] of scenarios) {
    const { c, watchers } = mount(scope === "catalog" ? catalog : items);
    for (const [k, v] of Object.entries(values)) c[k].value = v;
    assert.equal(c.filtered.value.length, count, key);
    cases.push({
      key,
      scope,
      controls: Object.fromEntries(controls.map((k) => [k, c[k].value])),
      ids: plain(c.sorted.value.map((i) => i.id)),
    });
    c.page.value = 3;
    c.resetFilters();
    watchers[0]();
    assert.equal(c.page.value, 1);
    assert.deepEqual(
      controls.map((k) => c[k].value),
      ["", "all", "all", "all", "all", "attention"],
    );
  }
  const { c, watchers, reads, timers } = mount(catalog);
  c.page.value = 3;
  assert.equal(c.pageItems.value.length, 5);
  c.items.value = plain(items);
  watchers[1](c.totalPages.value);
  assert.equal(c.page.value, 1);
  assert.equal(c.percentText(null), "暂无样本");
  assert.equal(c.percentText(0), "0.0%");
  assert.equal(c.percentText(8750), "87.5%");
  const write = c.probe(c.items.value[1]);
  await c.probe(c.items.value[0]);
  assert.equal(reads.length, 1);
  assert.equal(reads[0].url, `/platform/provider-adapters/${items[1].id}/health-check`);
  assert.deepEqual(plain(reads[0].options), { method: "POST" });
  const response = {
    ...items[1],
    health_status: "ready",
    runtime_recovery_gate_met: true,
    last_latency_ms: 0,
  };
  reads[0].resolve({ data: response, request_id: "inert-probe" });
  await write;
  assert.equal(c.items.value[1].runtime_circuit_state, "open");
  assert.equal(c.items.value[0].id, items[0].id);
  // Source has no generation guard: an older GET can overwrite a newer probe result.
  const pendingRead = c.load();
  assert.equal(timers.at(-1).ms, 12000);
  const probe = c.probe(c.items.value[1]);
  reads.at(-1).resolve({ data: { ...response, version: 9 }, request_id: "new-probe" });
  await probe;
  reads[1].resolve({ data: items, request_id: "old-list" });
  await pendingRead;
  assert.equal(c.items.value[1].version, 1);
  for (const status of [401, 403, 503]) {
    const attempt = c.load();
    reads.at(-1).reject(new ApiClientError(status));
    await attempt;
    assert.equal(c.state.value, "ready");
    assert.equal(c.items.value.length, 2);
  }
  const initial = mount([]);
  for (const [status, expected] of [
    [401, "expired"],
    [403, "forbidden"],
    [503, "blocked"],
    [500, "error"],
  ]) {
    const attempt = initial.c.load();
    initial.reads.at(-1).reject(new ApiClientError(status));
    await attempt;
    assert.equal(initial.c.state.value, expected);
  }
  const serviceAst = parse(await read("apps/api/src/provider-adapter-service.ts"));
  const serviceBox = {};
  vm.runInNewContext(
    compile(noImports(serviceAst)) + "globalThis.Service=ProviderAdapterService;",
    serviceBox,
  );
  const service = new serviceBox.Service({}, { describe: () => [] });
  const provider = {
    id: items[1].id,
    code: items[1].code,
    name: items[1].name,
    accessMode: items[1].access_mode,
    status: "disabled",
    circuitFailureThreshold: 3,
  };
  const health = {
    healthStatus: "ready",
    lastCheckedAt: "2026-08-07T19:31:00.000Z",
    consecutiveFailures: 0,
  };
  const circuit = { state: "open", openedAt: "2026-08-07T19:29:00.000Z", consecutiveFailures: 4 };
  assert.equal(
    service.summary(provider, health, undefined, circuit).runtime_recovery_gate_met,
    true,
  );
  assert.equal(
    service.summary(provider, health, undefined, circuit).runtime_error_budget_remaining,
    0,
  );
  assert.equal(
    service.summary(provider, { ...health, lastCheckedAt: circuit.openedAt }, undefined, circuit)
      .runtime_recovery_gate_met,
    false,
  );
  assert.equal(
    service.summary(provider, health, undefined, { ...circuit, state: "closed" })
      .runtime_recovery_gate_met,
    false,
  );
  return {
    sourceLogic,
    data: {
      items,
      catalog,
      cases,
      controls,
      sourcePaths: [
        "apps/web/src/components/ProviderAdapterCenter.vue",
        "apps/web/src/components/ProviderRuntimeSurface.vue",
        "apps/web/src/components/ResponsiveDataView.vue",
        "apps/web/src/components/TableViewControls.vue",
        "apps/web/src/components/UiStatePanel.vue",
        "apps/api/src/provider-adapter-service.ts",
        "apps/api/src/mysql-provider-adapter-repository.ts",
        "apps/api/src/provider-adapter-routes.ts",
        "tests/e2e/m03-03-provider-adapter.spec.ts",
      ],
      checks: [
        "Unchanged original 2-row and 45-row fixtures extracted separately by TypeScript AST",
        "13 actual computed sorted-ID/filter cases; reset six controls, 20/20/5 pagination and page clamp via explicit watch callbacks; not mounted Vue",
        "Actual probe exact POST without body and global single-flight; same-ID replacement leaves runtime circuit open",
        "Actual GET 12000ms timer, first-load 401/403/503/500 states and retained records on supplied 401/403/503",
        "Reproduced actual stale GET overwriting newer probe version; no production fix",
        "Actual service summary strictly newer ready probe for open circuit and max(threshold-failures,0); no API, database, real network or authentication verification",
      ],
    },
  };
}
