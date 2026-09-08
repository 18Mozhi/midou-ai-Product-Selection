import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export async function buildSourceChannelsDesignData(repo) {
  const read = (p) => readFile(path.join(repo, p), "utf8");
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  const compile = (s) =>
    ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const run = (s, bindings = {}) => {
    const box = { ...bindings };
    vm.runInNewContext(compile(s), box);
    return box.result;
  };
  const strip = (ast) =>
    ast.statements
      .filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText(ast).replace(/^\s*export /, "\n"))
      .join("\n");
  const fixture = parse(await read("tests/e2e/m03-07-provider-sources.spec.ts"));
  const declarations = [],
    calls = [];
  function visit(n) {
    if (ts.isVariableDeclaration(n)) declarations.push(n);
    if (ts.isCallExpression(n) && n.expression.getText(fixture) === "envelope")
      calls.push(n.arguments[0]);
    ts.forEachChild(n, visit);
  }
  visit(fixture);
  const pick = (name) => {
    const rows = declarations.filter((n) => n.name.getText(fixture) === name);
    assert.equal(rows.length, 1, name);
    return rows[0].getText(fixture);
  };
  const prefix = ["automatic", "setup", "manual", "sources", "smokeSource", "provider", "sampleId"]
    .map((n) => `const ${pick(n)};`)
    .join("\n");
  const response = (needle, bindings = "") => {
    const values = calls.filter((n) => n.getText(fixture).includes(needle));
    assert.equal(values.length, 1, needle);
    return plain(run(prefix + bindings + `;globalThis.result=${values[0].getText(fixture)};`));
  };
  const fixtures = plain(run(prefix + "globalThis.result={sources,smokeSource,provider};"));
  assert.equal(fixtures.sources.length, 146);
  const versions = response("current_version: 3");
  const matrix = response(
    "compatibility_matrix:",
    ';const item=automatic[136],pageHash="a".repeat(64);',
  );
  const samples = response("candidates: []", ';const reviewStatus="pending";');
  const src = await read("apps/web/src/components/ProviderSourceCenter.vue");
  const ast = parse(src.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const exports = [
    "items,state,query,category,availability,market,language,accessMode,sort",
    "page,refreshing,lastUpdatedAt,message,requestId,editing,saving,testing,sampleSource",
    "sampleLoading,sampleSaving,sampleReplaying,sampleReviewing,sampleOverview,latestReplay,versionSource,versionLoading,versionHistory",
    "versionCurrentVersion,rollingBack,rollbackReason,compatibilitySource,compatibilityLoading,compatibilityError,compatibilityAdapterVersion,compatibilityRows,form",
    "effectiveAvailability,linkedProviderId,filtered,purposeDefinitions,sourcePurpose,sorted,totalPages,pageItems,groupedSources",
    "resultRange,counts,marketOptions,languageOptions,configurationPreview,syncUrlState,resetFilters,changePage,failure",
    "categoryText,statusText,policyText,modeText,successText,slaText,load,beginEdit,save",
    "loadConfigurationVersions,rollbackConfiguration,testSource,loadCompatibility,loadParserSamples,createParserSample,replayParserSample,reviewParserSample",
  ].join(",");
  const sourceLogic = `// Derived from actual ProviderSourceCenter script; inert bridge, not mounted Vue.\nwindow.CHANNEL_C_SOURCE=(bridge)=>{const {ref,computed,reactive,watch,onMounted,defineProps,useRoute,useRouter,createApiClient,ApiClientError,window,document,AbortController,DOMException}=bridge;\n${compile(strip(ast))}\nreturn {${exports}};};\n`;
  class ApiClientError extends Error {
    constructor(status) {
      super(String(status));
      this.status = status;
      this.actionHint = `合成拒绝 ${status}`;
      this.requestId = `synthetic-${status}`;
    }
  }
  function mount(rows = fixtures.sources, query = {}) {
    const global = { window: {} },
      watchers = [],
      requests = [],
      timers = [],
      replaces = [],
      route = { query: plain(query) };
    vm.runInNewContext(sourceLogic, global);
    const c = global.window.CHANNEL_C_SOURCE({
      ref: (value) => ({ value }),
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
      reactive: (v) => v,
      watch: (s, cb) => watchers.push(cb),
      onMounted: () => {},
      defineProps: () => ({ apiBaseUrl: "" }),
      useRoute: () => route,
      useRouter: () => ({
        replace: (v) => {
          route.query = plain(v.query);
          replaces.push(plain(v.query));
        },
      }),
      createApiClient: () => (url, options) =>
        new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })),
      ApiClientError,
      AbortController,
      DOMException,
      window: {
        setTimeout: (cb, ms) => {
          timers.push({ cb, ms });
          return timers.length;
        },
        clearTimeout: () => {},
        requestAnimationFrame: (cb) => cb(),
        matchMedia: () => ({ matches: true }),
      },
      document: { getElementById: () => null },
    });
    c.items.value = plain(rows);
    return { c, route, watchers, requests, timers, replaces };
  }
  const controls = [
    "query",
    "category",
    "availability",
    "market",
    "language",
    "accessMode",
    "sort",
  ];
  const cases = [];
  for (const [key, values, count] of [
    ["default", {}, 146],
    ["name", { sort: "name" }, 146],
    ["attention", { sort: "attention" }, 146],
    ["recent", { sort: "recent" }, 146],
    ["query", { query: "amazon" }, 1],
    ["category", { category: "ecommerce" }, 39],
    ["availability", { availability: "manual" }, 2],
    ["market", { market: "GLOBAL" }, 146],
    ["language", { language: "zh-CN" }, 146],
    ["access-mode", { accessMode: "public_page" }, 2],
    ["combined", { category: "ecommerce", availability: "setup_required" }, 4],
    ["no-match", { query: "not-a-real-source" }, 0],
  ]) {
    const { c } = mount();
    for (const [k, v] of Object.entries(values)) c[k].value = v;
    assert.equal(c.filtered.value.length, count, key);
    cases.push({
      key,
      controls: Object.fromEntries(controls.map((k) => [k, c[k].value])),
      ids: plain(c.sorted.value.map((i) => i.code)),
      groups: plain(
        c.groupedSources.value.map((g) => ({ key: g.key, count: g.items.length, total: g.total })),
      ),
    });
  }
  const { c, route, watchers } = mount(fixtures.sources, {
    provider_id: fixtures.sources[138].provisioned.id,
    keep: "untouched",
    page: "8",
  });
  assert.equal(c.page.value, 8);
  watchers[2](c.totalPages.value);
  assert.equal(c.page.value, 1);
  c.query.value = "none";
  c.resetFilters();
  watchers[0]();
  assert.equal(c.filtered.value.length, 1);
  assert.deepEqual(route.query, {
    provider_id: fixtures.sources[138].provisioned.id,
    keep: "untouched",
  });
  route.query.q = "different";
  assert.equal(c.query.value, "");
  assert.equal(watchers.length, 3);
  const catalog = mount();
  catalog.c.changePage(8);
  assert.equal(catalog.c.pageItems.value.length, 6);
  assert.equal(catalog.c.resultRange.value.start, 141);
  assert.deepEqual(plain(catalog.c.counts.value), {
    all: 146,
    automatic: 138,
    nonGoogle: 42,
    markets: 1,
  });
  catalog.c.beginEdit(catalog.c.items.value[0]);
  assert.equal(catalog.c.form.schedule_minutes, undefined);
  assert.equal(catalog.c.configurationPreview.value.active_count, 0);
  assert.equal(catalog.c.items.value[0].provisioned.concurrency_snapshot, undefined);
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const m = mount([fixtures.smokeSource]);
  m.c.beginEdit(m.c.items.value[0]);
  m.c.form.status = "enabled";
  const before = plain(m.c.form),
    pending = m.c.save();
  assert.deepEqual(JSON.parse(m.requests[0].options.body), {
    ...before,
    status: "disabled",
    expected_version: 1,
  });
  m.c.form.retry_limit = 9;
  m.requests[0].resolve({
    data: { ...fixtures.smokeSource.provisioned, version: 2 },
    request_id: "inert-stage",
  });
  await tick();
  assert.equal(
    m.requests[1].url,
    `/platform/provider-adapters/${fixtures.smokeSource.provisioned.id}/health-check`,
  );
  assert.deepEqual(plain(m.requests[1].options), { method: "POST" });
  m.requests[1].resolve({ data: { health_status: "ready" }, request_id: "inert-smoke" });
  await tick();
  assert.equal(JSON.parse(m.requests[2].options.body).retry_limit, 9); // Actual second PUT re-reads mutable form.
  m.requests[2].resolve({
    data: { ...fixtures.smokeSource.provisioned, version: 3, status: "enabled" },
    request_id: "inert-enable",
  });
  await tick();
  m.requests[3].reject(new ApiClientError(503));
  await pending;
  assert.match(m.c.message.value, /烟测已通过/);
  assert.doesNotMatch(m.c.message.value, /503/);
  const partial = mount([fixtures.smokeSource]);
  partial.c.beginEdit(partial.c.items.value[0]);
  partial.c.form.status = "enabled";
  const attempt = partial.c.save();
  partial.requests[0].resolve({
    data: { ...fixtures.smokeSource.provisioned, version: 2 },
    request_id: "stage",
  });
  await tick();
  partial.requests[1].resolve({
    data: { health_status: "blocked", last_error_code: "synthetic" },
    request_id: "smoke",
  });
  await attempt;
  assert.equal(partial.requests.length, 2);
  assert.equal(partial.c.editing.value.provisioned.version, 2);
  assert.match(partial.c.message.value, /已安全保存为停用/);
  const stale = mount();
  stale.c.beginEdit(stale.c.items.value[138]);
  const oldSave = stale.c.save();
  stale.c.beginEdit(stale.c.items.value[139]);
  stale.requests[0].resolve({ data: { version: 2 }, request_id: "old" });
  await tick();
  assert.equal(stale.c.editing.value, null);
  stale.requests[1].resolve({ data: fixtures.sources, request_id: "load" });
  await oldSave;
  const history = mount();
  const h = history.c.loadConfigurationVersions(history.c.items.value[138]);
  history.requests[0].resolve({ data: versions, request_id: "versions" });
  await h;
  history.c.rollbackReason.value = "恢复已核对版本";
  const rollback = history.c.rollbackConfiguration(versions.versions[1]);
  const rollbackIntent = {
    method: history.requests[1].options.method,
    path: history.requests[1].url,
    body: JSON.parse(history.requests[1].options.body),
  };
  assert.deepEqual(rollbackIntent.body, {
    target_version: 1,
    expected_version: 3,
    reason: "恢复已核对版本",
  });
  history.requests[1].reject(new ApiClientError(409));
  await rollback;
  const readFailures = mount();
  for (const status of [401, 403, 503]) {
    const p = readFailures.c.load();
    readFailures.requests.at(-1).reject(new ApiClientError(status));
    await p;
    assert.equal(readFailures.c.items.value.length, 146);
    assert.equal(readFailures.c.state.value, "ready");
  }
  assert.equal(readFailures.timers[0].ms, 12000);
  const sampleMount = mount([fixtures.provider]);
  sampleMount.c.sampleSource.value = sampleMount.c.items.value[0];
  const candidate = {
    browser_job_id: "40000000-0000-4000-8000-000000000001",
    captured_at: "2026-09-09T01:20:00.000Z",
    item_count: 2,
    parser_version: "1688-browser-contract-v3",
  };
  const sampleIntents = [];
  for (const [name, invoke] of [
    ["create", () => sampleMount.c.createParserSample(candidate)],
    ["replay", () => sampleMount.c.replayParserSample(samples.samples[0])],
    [
      "approve",
      () => sampleMount.c.reviewParserSample(samples.samples[0], "approved", " 核对字段 "),
    ],
    [
      "reject",
      () => sampleMount.c.reviewParserSample(samples.samples[0], "rejected", " 字段缺失 "),
    ],
  ]) {
    const p = invoke(),
      r = sampleMount.requests.at(-1);
    sampleIntents.push({
      name,
      method: r.options.method,
      path: r.url,
      ...(r.options.body ? { body: JSON.parse(r.options.body) } : {}),
    });
    r.reject(new ApiClientError(409));
    await p;
  }
  assert.equal(sampleIntents[0].body.browser_job_id, candidate.browser_job_id);
  assert.deepEqual(sampleIntents[2].body, {
    decision: "approved",
    reason: "核对字段",
    expected_version: 1,
  });
  assert.equal("body" in sampleIntents[1], false);
  const serviceAst = parse(await read("apps/api/src/provider-source-service.ts"));
  const Service = run(strip(serviceAst) + "globalThis.result=ProviderSourceService;");
  const validationCalls = [];
  const svc = new Service({
    updateConfiguration: (v) => validationCalls.push(v),
    rollbackConfiguration: (v) => validationCalls.push(v),
    parserSampleByOperation: async () => null,
    reviewParserSample: async (v) => validationCalls.push(v),
  });
  const valid = {
    schedule_minutes: 30,
    timeout_ms: 20000,
    retry_limit: 3,
    status: "enabled",
    expected_version: 1,
    reason: " 核对参数 ",
  };
  const id = fixtures.provider.provisioned.id;
  svc.updateConfiguration(id, valid, {});
  assert.equal(validationCalls[0].reason, "核对参数");
  for (const [field, min, max] of [
    ["schedule_minutes", 1, 10080],
    ["timeout_ms", 1000, 120000],
    ["retry_limit", 0, 10],
  ]) {
    for (const value of [min, max]) svc.updateConfiguration(id, { ...valid, [field]: value }, {});
    for (const value of [min - 1, max + 1, 1.5])
      assert.throws(() => svc.updateConfiguration(id, { ...valid, [field]: value }, {}));
  }
  for (const reason of ["x", "x".repeat(501)])
    assert.throws(() => svc.updateConfiguration(id, { ...valid, reason }, {}));
  assert.throws(() =>
    svc.rollbackConfiguration(id, { target_version: 3, expected_version: 3, reason: "回滚" }, {}),
  );
  await assert.rejects(
    svc.reviewParserSample(
      id,
      samples.samples[0].id,
      { decision: "approved", reason: "x".repeat(1001), expected_version: 1 },
      {},
    ),
  );
  return {
    sourceLogic,
    data: {
      ...fixtures,
      versions,
      matrix,
      samples,
      candidate,
      controls,
      cases,
      rollbackIntent,
      sampleIntents,
      sourcePaths: [
        "apps/web/src/components/ProviderSourceCenter.vue",
        "apps/web/src/components/ProviderSourceConfigurationDialog.vue",
        "apps/web/src/components/ProviderParserSampleDialog.vue",
        "apps/web/src/components/ProviderParserSampleReview.vue",
        "apps/web/src/components/ProviderCompatibilityMatrixDialog.vue",
        "apps/web/src/components/provider-source-types.ts",
        "apps/api/src/provider-source-service.ts",
        "apps/api/src/provider-source-routes.ts",
        "apps/api/src/mysql-provider-source-version-repository.ts",
        "apps/api/src/mysql-provider-source-sample-review-repository.ts",
        "tests/e2e/m03-07-provider-sources.spec.ts",
      ],
      checks: [
        "Original 146-source, standalone smoke, 1688, versions, matrix and approval fixtures extracted by AST; candidate is explicitly synthetic",
        "12 actual filter/sort/group cases, 146/138/42/1 global counts, 20-page and 6 last rows, seven reset controls preserve provider_id, URL init only/no reverse watcher",
        "Actual beginEdit retains missing original fixture fields; concurrency fallback zero is not measured idle",
        "Actual disabled PUT -> bodyless smoke -> enabled PUT; second PUT reads changed form; partial smoke failure retains saved disabled version; reload failure message overwritten",
        "Actual stale save closes a newer editor; actual bodyless sample replay/create/review and rollback payloads captured with inert requests",
        "Actual service numeric endpoints/reason/version/review validation; no API, SQL, authentication, audit, network or mounted Vue verification",
      ],
    },
  };
}
