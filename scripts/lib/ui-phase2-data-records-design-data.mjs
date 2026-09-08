import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export async function buildDataRecordsDesignData(repo) {
  const read = (f) => readFile(path.join(repo, f), "utf8"),
    parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  const compile = (s) =>
    ts.transpileModule(s, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
  const strip = (s) => {
    const a = parse(s);
    return a.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText(a))
      .join("\n")
      .replaceAll("export ", "");
  };
  const plain = (v) => JSON.parse(JSON.stringify(v)),
    run = (s, bindings = {}) => {
      const b = { ...bindings };
      vm.runInNewContext(compile(s), b);
      return b.result;
    };
  const vuePath = "apps/web/src/components/PlatformDataCenter.vue",
    fixturePath = "tests/e2e/m06-02-platform-dashboard.spec.ts",
    reasonPath = "apps/web/src/use-audited-reason.ts";
  const fixtureAst = parse(await read(fixturePath));
  let testNode, fixture;
  function findTest(n) {
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(fixtureAst) === "test" &&
      n.arguments[0]?.text?.startsWith("UI2-DG54")
    )
      testNode = n;
    ts.forEachChild(n, findTest);
  }
  findTest(fixtureAst);
  assert.ok(testNode);
  function findFixture(n) {
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(fixtureAst) === "env" &&
      n.arguments[0]?.getText(fixtureAst).includes('domain: "data"')
    )
      fixture = n.arguments[0].getText(fixtureAst);
    ts.forEachChild(n, findFixture);
  }
  findFixture(testNode);
  assert.ok(fixture);
  const fixtureCode = `const supplier=entity==="suppliers";return ${fixture};`;
  const originals = {};
  for (const entity of ["trends", "suppliers"])
    originals[entity] = plain(
      run(`const entity=${JSON.stringify(entity)};globalThis.result=(()=>{${fixtureCode}})();`),
    );
  const vue = await read(vuePath),
    script = strip(vue.split(/<script setup[^>]*>/)[1].split("</script>")[0]),
    reason = strip(await read(reasonPath));
  const names =
    "entityStatuses,statusLabels,entities,entity,query,queryDraft,status,statusDraft,page,tab,state,data,snapshotScope,scopeMismatch,snapshotLabel,current,summary,statusOptions,activeFilterCount,statusName,summaryName,pagination,pagedItems,rangeLabel,message,requestId,exporting,refreshing,exportReasonOpen,submitExportReason,cancelExportReason,exportCsv,load,applyFilters,resetFilters,selectEntity,selectTab,goToPage";
  const logic = `window.DATA_RECORDS_SOURCE=(bridge)=>{const {ref,computed,onMounted,onBeforeUnmount,useRoute,useRouter,defineProps,createApiClient,createApiResponseClient,ApiClientError,window,AbortController,URLSearchParams,URL,document}=bridge;${compile(reason)}\n${compile(script)}\nreturn {${names}};};\nwindow.DATA_RECORDS_FIXTURE=(entity)=>{${compile(fixtureCode)}};`;
  class ApiClientError extends Error {
    constructor(kind) {
      super(kind);
      this.kind = kind;
      this.actionHint = "隔离" + kind;
      this.requestId = "inert-request";
    }
  }
  function mount(query = {}) {
    const b = { window: {} };
    vm.runInNewContext(logic, b);
    const calls = [],
      posts = [],
      timers = [],
      unmount = [],
      routes = [],
      downloads = [],
      revoked = [];
    const api = b.window.DATA_RECORDS_SOURCE({
      ref: (value) => ({ value }),
      computed: (get) => ({
        get value() {
          return get();
        },
      }),
      onMounted: () => {},
      onBeforeUnmount: (fn) => unmount.push(fn),
      useRoute: () => ({ query }),
      useRouter: () => ({ replace: async (v) => routes.push(plain(v)) }),
      defineProps: () => ({ apiBaseUrl: "inert" }),
      createApiClient: () => (url, options) =>
        new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })),
      createApiResponseClient: () => (url, options) =>
        new Promise((resolve, reject) => posts.push({ url, options, resolve, reject })),
      ApiClientError,
      window: {
        setTimeout: (fn, ms) => (timers.push({ fn, ms }), timers.length),
        clearTimeout: () => {},
      },
      AbortController,
      URLSearchParams,
      URL: { createObjectURL: () => "blob:inert", revokeObjectURL: (v) => revoked.push(v) },
      document: {
        createElement: () => ({
          click() {
            downloads.push({ href: this.href, download: this.download });
          },
        }),
      },
    });
    return { c: api, calls, posts, timers, unmount, routes, downloads, revoked };
  }
  const checks = [],
    tick = async () => {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    },
    success = (call, data = originals.trends) =>
      call.resolve({ data: plain(data), request_id: "ui2-dg54-design" });
  const ready = (x) => {
    x.c.data.value = plain(originals.trends);
    x.c.snapshotScope.value = { entity: "trends", query: "", status: "" };
    x.c.state.value = "ready";
  };
  const base = mount();
  ready(base);
  assert.equal(base.c.current.value.label, "热点");
  assert.equal(base.c.statusName("active", "competitors"), "监控中");
  assert.equal(base.c.statusName("ready", "suppliers"), "可评估");
  const boundaries = [];
  for (const count of [0, 1, 20, 21, 100]) {
    base.c.data.value = {
      items: Array.from({ length: count }, (_, i) => ({
        ...originals.trends.items[0],
        id: `synthetic-${i}`,
      })),
    };
    base.c.page.value = 9;
    boundaries.push({
      count,
      pagination: plain(base.c.pagination.value),
      rows: base.c.pagedItems.value.length,
    });
    assert.equal(base.c.pagination.value.page, Math.max(1, Math.ceil(count / 20)));
    assert.equal(base.c.pagedItems.value.length, count ? ((count - 1) % 20) + 1 : 0);
  }
  checks.push(
    "Actual Vue four entity labels, 13 status labels and local 0/1/20/21/100 row pagination/clamp; original trend/supplier fixture separated from synthetic boundaries.",
  );
  for (const preserved of [false, true])
    for (const kind of ["expired", "forbidden", "blocked", "error", "timeout"]) {
      const x = mount();
      if (preserved) ready(x);
      const p = x.c.load();
      await tick();
      await x.c.load();
      assert.equal(x.calls.length, 1);
      assert.equal(x.timers[0].ms, 15000);
      if (kind === "timeout") x.timers[0].fn();
      x.calls[0].reject(new ApiClientError(kind === "timeout" ? "blocked" : kind));
      await p;
      assert.equal(x.c.state.value, preserved ? "ready" : kind === "timeout" ? "blocked" : kind);
      if (preserved) assert.equal(x.c.current.value.value, "trends");
    }
  checks.push(
    "Ten first/preserved source read failures, 15-second abort callback and single-flight, retaining entity interpretation; no real request or timer wait.",
  );
  {
    const x = mount();
    ready(x);
    x.c.selectEntity("suppliers");
    await tick();
    assert.equal(x.c.current.value.value, "trends");
    assert.equal(x.c.scopeMismatch.value, true);
    assert.equal(x.c.statusOptions.value[1], "ready");
    x.calls[0].reject(new ApiClientError("error"));
    await tick();
    await x.c.exportCsv();
    assert.equal(x.posts.length, 0);
    const p = x.c.load();
    await tick();
    success(x.calls[1], originals.suppliers);
    await p;
    assert.equal(x.c.current.value.value, "suppliers");
    assert.equal(x.c.scopeMismatch.value, false);
  }
  {
    const x = mount({ entity: "suppliers", q: "  测试  ", status: "bad", page: "999" });
    const p = x.c.load();
    await tick();
    assert.ok(x.calls[0].url.includes("query="));
    assert.ok(!x.calls[0].url.includes("page="));
    success(x.calls[0], originals.suppliers);
    await p;
    assert.equal(x.c.page.value, 1);
    assert.equal(x.c.status.value, "");
    assert.equal(x.routes.at(-1).query.page, undefined);
    const p2 = x.c.load();
    await tick();
    x.unmount[0]();
    assert.equal(x.calls[1].options.signal.aborted, true);
    success(x.calls[1]);
    await p2;
    assert.equal(x.c.data.value.entity, "trends");
  }
  checks.push(
    "Snapshot mismatch blocks export until successful requested scope; initial URL trimming/invalid status/page clamp; ignored-abort late read still updates data reproduced in inert source bridge.",
  );
  {
    const x = mount();
    ready(x);
    const p = x.c.exportCsv();
    assert.ok(x.c.exportReasonOpen.value);
    await x.c.exportCsv();
    assert.equal(x.posts.length, 0);
    x.c.selectEntity("suppliers");
    await tick();
    x.c.submitExportReason("  运营核对  ");
    await tick();
    assert.equal(x.posts.length, 1);
    assert.deepEqual(plain(x.posts[0].options.body), {
      entity: "suppliers",
      query: "",
      status: "",
      reason: "运营核对",
    });
    x.c.entity.value = "competitors";
    x.posts[0].resolve({ headers: { get: () => "inert-export" }, blob: async () => "inert blob" });
    await p;
    assert.ok(x.downloads[0].download.startsWith("platform-competitors-"));
    assert.deepEqual(x.revoked, ["blob:inert"]);
  }
  checks.push(
    "Actual export scope changes after reason await; filename changes again before response despite supplier request. Inert DOM records download intention only; no file, audit or POST executed.",
  );
  const servicePath = "apps/api/src/platform-dashboard-service.ts",
    service = run(strip(await read(servicePath)) + ";globalThis.result=PlatformDashboardService;"),
    serviceCalls = [];
  const svc = new service({
    readManagement: async (v) => (serviceCalls.push(v), {}),
    exportData: async (v) => (serviceCalls.push(v), {}),
  });
  for (const [entity, statuses] of Object.entries(base.c.entityStatuses))
    for (const status of statuses)
      await svc.management({ domain: "data", entity, status, query: " test " });
  assert.equal(serviceCalls.length, 13);
  for (const bad of [
    { entity: "invalid" },
    { entity: "trends", status: "ready" },
    { entity: "suppliers", query: "a".repeat(121) },
  ])
    assert.throws(() => svc.management({ domain: "data", ...bad }));
  for (const length of [2, 300])
    await svc.exportData({ entity: "trends", reason: "字".repeat(length) }, {});
  for (const length of [1, 301])
    assert.throws(() => svc.exportData({ entity: "trends", reason: "字".repeat(length) }, {}));
  checks.push(
    "Actual service accepts 13 entity/status pairs, trims query and rejects invalid entity/status/121 query plus export reason 1/301; accepts 2/300. Inert repository only.",
  );
  const repoPath = "apps/api/src/mysql-platform-dashboard-repository.ts",
    Repository = run(
      strip(await read(repoPath)) + ";globalThis.result=MySqlPlatformDashboardRepository;",
    );
  const synthetic = {},
    sql = [];
  for (const [entity, statuses] of Object.entries(base.c.entityStatuses)) {
    const rows = statuses.map((status, i) => ({
      ...originals.trends.items[0],
      id: `synthetic-${entity}-${i}`,
      title: {
        trends: "家居趋势记录",
        opportunities: "便携照明机会",
        competitors: "充电灯竞品",
        suppliers: "便携灯供应候选",
      }[entity],
      category:
        entity === "suppliers" ? "示例供应商" : entity === "competitors" ? "示例站点" : "家居照明",
      market: entity === "suppliers" ? "广东" : "US",
      status,
      metric_primary: i === 0 ? null : 8 + i,
      metric_secondary: i === 0 ? undefined : 2 + i,
    }));
    const repository = new Repository(
      {
        query: async (text, parameters) => (
          sql.push({ entity, text, parameters: plain(parameters) }),
          [rows]
        ),
      },
      1000,
      20,
      () => new Date("2026-09-08T00:00:00Z"),
      "inert",
    );
    synthetic[entity] = plain(
      await repository.readManagement({ domain: "data", entity, query: "测试", status: "" }),
    );
    assert.equal(synthetic[entity].items[0].metric_primary, 0);
    assert.equal(synthetic[entity].items[0].metric_secondary, 0);
    assert.equal(synthetic[entity].summary.total, statuses.length);
    assert.ok(sql.at(-1).text.endsWith("LIMIT 100"));
    assert.deepEqual(sql.at(-1).parameters, ["%测试%", "%测试%", "%测试%", "%"]);
  }
  assert.ok(!sql.at(-1).text.split("WHERE")[1].includes("w.name"));
  checks.push(
    "Actual four repository readManagement data branches on synthetic SQL-row adapter: LIMIT100, returned-set summary, supplier search excluding workspace and null/undefined converted to zero; SQL was not executed.",
  );
  const routePath = "apps/api/src/platform-dashboard-routes.ts",
    route = await read(routePath),
    routeAst = parse(route);
  let csvDeclaration;
  for (const n of routeAst.statements)
    if (ts.isVariableStatement(n))
      for (const d of n.declarationList.declarations)
        if (d.name.getText(routeAst) === "csvCell") csvDeclaration = d.getText(routeAst);
  const csv = run(`const ${csvDeclaration};globalThis.result=csvCell;`),
    csvCases = ["=SUM(A1:A2)", "+value", "-1", "@value", 'a"b', null].map((v) => ({
      input: v,
      output: csv(v),
    }));
  assert.equal(csvCases[0].output, '"\'=SUM(A1:A2)"');
  assert.equal(csvCases[4].output, '"a""b"');
  const exportRoute = route
    .split('app.post("/api/v1/platform/management/data/exports"')[1]
    .split('app.post("/api/v1/platform/management/logs/exports"')[0];
  assert.ok(!exportRoute.includes("requireIdempotencyKey"));
  assert.ok(exportRoute.includes("return `\\ufeff${csv}`"));
  checks.push(
    "Actual csvCell six cases and data export route BOM/non-idempotency contract checked; no CSV file, audit row, customer material or real download created.",
  );
  return {
    data: {
      originals,
      synthetic,
      boundaries,
      csvCases,
      checks,
      entities: plain(base.c.entities),
      statuses: plain(base.c.entityStatuses),
      labels: plain(base.c.statusLabels),
      sourcePaths: [
        vuePath,
        fixturePath,
        reasonPath,
        servicePath,
        repoPath,
        routePath,
        "apps/web/src/components/AuditedReasonDialog.vue",
        "apps/web/src/components/ResponsiveDataView.vue",
        "apps/web/src/components/ResponsiveFilterDrawer.vue",
        "apps/web/src/components/TableViewControls.vue",
        "apps/web/src/components/TechnicalDetails.vue",
      ],
    },
    logic,
  };
}
