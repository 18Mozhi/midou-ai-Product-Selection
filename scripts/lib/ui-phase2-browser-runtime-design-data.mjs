import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export async function buildRuntimeDesignData(repo) {
  const read = (p) => readFile(path.join(repo, p), "utf8");
  const parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  const compile = (s) =>
    ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const run = (s, bindings = {}) => {
    const b = { ...bindings };
    vm.runInNewContext(compile(s), b);
    return b.result;
  };
  const fixturePath = "tests/e2e/m03-04-playwright-crawler.spec.ts";
  const ast = parse(await read(fixturePath));
  const declarations = ast.statements
    .filter(ts.isVariableStatement)
    .flatMap((n) => [...n.declarationList.declarations]);
  const prefix = ["profiles", "runs"]
    .map((key) => `const ${declarations.find((n) => n.name.getText(ast) === key).getText(ast)};`)
    .join("\n");
  const snapshotFunction = ast.statements
    .find((n) => ts.isFunctionDeclaration(n) && n.name?.text === "runtimeSnapshot")
    .getText(ast);
  const fixtureSource = prefix + snapshotFunction;
  const original = plain(
    run(fixtureSource + 'globalThis.result=runtimeSnapshot("https://inert.test/?page=1");', {
      URL,
    }),
  );
  const vuePath = "apps/web/src/components/CollectionRuntimeCenter.vue",
    vue = await read(vuePath);
  const script = parse(vue.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const stripped = script.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(script))
    .join("\n");
  const names =
    "state,profiles,runs,pagination,runMetrics,requestId,readNotice,recoveryNotice,recoveryUnknown,query,queryDraft,status,page,observedAt,confirming,saving,refreshing,activeLeases,expiredLeaseRisks,recoveryHelp,recoveryImpact,failure,routeScope,readScope,applyRouteScope,syncUrl,load,applyFilters,resetFilters,goToPage,recover,applyRecoverySettlement,time,statusText,errorText,expiryForecast,leaseExpired,rangeLabel,allowedStatuses";
  const logic = `// Actual Vue script + original E2E snapshot, not a Vue mount or HTTP.\nwindow.RUNTIME_C_SOURCE=(bridge)=>{const {ref,computed,onActivated,onBeforeUnmount,onDeactivated,onMounted,watch,useRoute,useRouter,defineProps,createApiClient,ApiClientError,window,AbortController,URLSearchParams}=bridge;\n${compile(stripped)}\nreturn {${names}};};\nwindow.RUNTIME_C_FIXTURE=(url)=>{${compile(fixtureSource)}\nreturn runtimeSnapshot(url);};`;
  class ApiClientError extends Error {
    constructor(kind, status = 500) {
      super(kind);
      this.kind = kind;
      this.status = status;
      this.actionHint = `合成${kind}`;
      this.requestId = "inert-request";
    }
  }
  function mount(query = {}) {
    const b = { window: {} };
    vm.runInNewContext(logic, b);
    const calls = [],
      timers = [],
      unmount = [],
      deactivate = [],
      activate = [],
      watchers = [],
      navigations = [],
      route = { path: "/platform-admin/collection/browser-runtime", query };
    const c = b.window.RUNTIME_C_SOURCE({
      ref: (value) => ({ value }),
      computed: (get) => ({
        get value() {
          return get();
        },
      }),
      onMounted: () => {},
      onBeforeUnmount: (fn) => unmount.push(fn),
      onDeactivated: (fn) => deactivate.push(fn),
      onActivated: (fn) => activate.push(fn),
      watch: (source, callback) => watchers.push({ source, callback }),
      useRoute: () => route,
      useRouter: () => ({
        replace: async (v) => {
          route.query = { ...v.query };
          navigations.push(plain(v));
        },
      }),
      defineProps: () => ({ apiBaseUrl: "inert" }),
      createApiClient:
        () =>
        (url, options = {}) =>
          new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })),
      ApiClientError,
      AbortController,
      URLSearchParams,
      window: {
        setTimeout: (fn, ms) => {
          timers.push({ fn, ms });
          return timers.length;
        },
        clearTimeout: () => {},
      },
    });
    return { c, calls, timers, unmount, deactivate, activate, watchers, route, navigations };
  }
  const setData = (c, d = original) => {
    c.profiles.value = plain(d.profiles);
    c.runs.value = plain(d.runs);
    c.pagination.value = plain(d.pagination);
    c.runMetrics.value = plain(d.run_metrics);
    c.observedAt.value = d.observed_at;
  };
  const tick = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  const success = (call, d = original) =>
    call.resolve({ data: plain(d), request_id: "m03-04-list" });
  const checks = [],
    m = mount();
  setData(m.c);
  assert.equal(m.c.activeLeases.value.length, 1);
  assert.equal(m.c.expiredLeaseRisks.value.length, 1);
  assert.ok(m.c.expiryForecast(original.profiles[0]).includes("3 天后"));
  assert.equal(m.c.expiryForecast(original.profiles[1]), "未提供有效期，无法预测");
  const boundary = [];
  for (const ms of [-1, 0, 1, 86400000, 7 * 86400000, 7 * 86400000 + 1]) {
    const profile = {
      ...original.profiles[0],
      credential_expires_at: new Date(new Date(original.observed_at).getTime() + ms).toISOString(),
    };
    const text = m.c.expiryForecast(profile);
    boundary.push({ ms, text });
    assert.ok(
      ms <= 0 ? text.startsWith("已到期") : text.includes(`${Math.ceil(ms / 86400000)} 天后`),
    );
  }
  assert.equal(
    m.c.expiryForecast({ ...original.profiles[0], credential_expires_at: "invalid" }),
    "有效期不可用",
  );
  checks.push(
    "Actual global 3 profiles/1 occupied/1 expired and 3-day/null/invalid/0/1/7-day expiry boundaries at response observed_at; no live login test.",
  );
  const filterCases = [];
  for (const q of [
    "",
    "TRACE-SUCCESS",
    "blocked_captcha",
    "000821",
    "market.example.test",
    "no-match",
  ]) {
    const snapshot = plain(
      run(
        fixtureSource +
          `globalThis.result=runtimeSnapshot(${JSON.stringify("https://inert.test/?q=" + encodeURIComponent(q))});`,
        { URL },
      ),
    );
    filterCases.push({ query: q, ids: snapshot.runs.map((r) => r.id) });
    assert.deepEqual(snapshot.profiles, original.profiles);
    assert.deepEqual(snapshot.run_metrics, original.run_metrics);
  }
  assert.equal(filterCases[1].ids[0], original.runs[1].id);
  assert.equal(filterCases[4].ids.length, 0);
  checks.push(
    "Original fixture exact run/error/request/trace filter sequences preserve global profiles/metrics; source/domain is not a search target.",
  );
  for (const preserved of [false, true])
    for (const kind of ["expired", "forbidden", "rate_limited", "error", "timeout"]) {
      const x = mount();
      if (preserved) setData(x.c);
      const work = x.c.load();
      await tick();
      assert.equal(x.calls.length, 1);
      assert.equal(x.timers[0].ms, 15000);
      if (kind === "timeout") x.timers[0].fn();
      x.calls[0].reject(new ApiClientError(kind === "timeout" ? "blocked" : kind));
      await work;
      assert.equal(
        x.c.state.value,
        preserved ? "ready" : kind === "timeout" || kind === "rate_limited" ? "blocked" : kind,
      );
      if (preserved) assert.deepEqual(plain(x.c.profiles.value), original.profiles);
    }
  checks.push(
    "Ten initial/preserved read failures and 15-second abort callback; no real timers or role authorization.",
  );
  {
    const x = mount({ q: " trace-success ", status: "succeeded", page: "99", unknown: "drop" });
    const work = x.c.load();
    await tick();
    assert.ok(x.calls[0].url.includes("q=trace-success"));
    assert.equal(x.route.query.unknown, undefined);
    success(x.calls[0]);
    await work;
    assert.equal(x.c.page.value, 1);
    assert.equal(x.route.query.page, undefined);
    const staleRead = x.c.load();
    await tick();
    x.c.query.value = "TRACE-SUCCESS";
    x.c.queryDraft.value = "TRACE-SUCCESS";
    x.c.status.value = "blocked";
    x.c.page.value = 1;
    const latestRead = x.c.load();
    await tick();
    assert.equal(x.calls.length, 3);
    assert.equal(x.calls[1].options.signal.aborted, true);
    success(x.calls[2], {
      ...original,
      profiles: [{ ...original.profiles[0], name: "latest" }],
    });
    await tick();
    await latestRead;
    success(x.calls[1]);
    await staleRead;
    assert.equal(x.c.status.value, "blocked");
    assert.equal(x.c.profiles.value[0].name, "latest");
    const read2 = x.c.load();
    await tick();
    x.unmount[0]();
    assert.equal(x.calls[3].options.signal.aborted, true);
    success(x.calls[3]);
    await read2;
    assert.equal(x.c.state.value, "ready");
    checks.push(
      "Initial trim/URL correction, superseded read abort and stale response isolation verified in the inert source bridge.",
    );
  }
  {
    const x = mount();
    setData(x.c);
    x.c.confirming.value = true;
    const work = x.c.recover();
    await tick();
    await x.c.recover();
    assert.equal(x.calls.length, 1);
    assert.equal(JSON.stringify(x.calls[0].options.body), "{}");
    success(x.calls[0], { recovered: 1 });
    await tick();
    x.calls[1].reject(new ApiClientError("blocked"));
    await work;
    assert.ok(x.c.recoveryNotice.value.includes("已回收 1 个过期租约"));
    assert.ok(x.c.readNotice.value.includes("合成blocked"));
    assert.equal(x.c.confirming.value, false);
    const failed = x.c.recover();
    await tick();
    x.calls[2].reject(new Error("transport unknown"));
    await failed;
    assert.equal(x.c.recoveryUnknown.value, true);
    assert.ok(x.c.recoveryNotice.value.includes("回收结果未知"));
    checks.push(
      "Exact empty-body recovery and single-flight; successful write stays separate from failed verification, while unknown transport blocks resubmission. No real recovery.",
    );
  }
  const confirmPath = "apps/web/src/components/ConfirmDialog.vue",
    confirm = await read(confirmPath);
  const call = vue.slice(vue.lastIndexOf("<ConfirmDialog"));
  assert.ok(!/\bdestructive\b/.test(call));
  assert.ok(confirm.includes("destructive: false"));
  assert.ok(confirm.includes('v-if="destructive"'));
  checks.push(
    "Runtime ConfirmDialog omits destructive: typed confirmation only; old P53 impact-checkbox claim is incorrect.",
  );
  const servicePath = "apps/api/src/crawler-runtime-service.ts",
    serviceAst = parse(await read(servicePath));
  const serviceText = serviceAst.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(serviceAst))
    .join("\n")
    .replaceAll("export ", "");
  const Service = run(serviceText + "globalThis.result=CrawlerRuntimeService;");
  const serviceCalls = [];
  const svc = new Service(
    {
      list: async (v) => {
        serviceCalls.push(plain(v));
        return plain(original);
      },
    },
    () => new Date(original.observed_at),
  );
  for (const status of ["all", ...m.c.allowedStatuses])
    await svc.list({ page: "2", q: " TRACE-SUCCESS ", status });
  assert.equal(serviceCalls[0].pageSize, 25);
  assert.equal(serviceCalls[0].query, "TRACE-SUCCESS");
  for (const bad of [
    { page: 0 },
    { status: "dead_letter" },
    { q: "a".repeat(161) },
    { q: "a\u0001b" },
  ])
    await assert.rejects(svc.list(bad));
  checks.push(
    "Actual service validates 25-page-size default, seven statuses, trimmed 160-character query and control rejection using inert repository.",
  );
  const repoPath = "apps/api/src/mysql-crawler-runtime-repository.ts",
    repoAst = parse(await read(repoPath));
  const repoText = repoAst.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(repoAst))
    .join("\n")
    .replaceAll("export ", "");
  const Repository = run(repoText + "globalThis.result=MySqlCrawlerRuntimeRepository;", { URL });
  const sql = [];
  const repository = new Repository({
    query: async (text, parameters = []) => {
      sql.push({ text, parameters: plain(parameters) });
      if (text.startsWith("SELECT p.id")) return [[]];
      if (text.startsWith("SELECT COUNT(*) total FROM")) return [[{ total: 26 }]];
      if (text.startsWith("SELECT COUNT(*) total,"))
        return [[{ total: 103, abnormal: 7, duplicate_risk: 2 }]];
      if (text.startsWith("SELECT *")) return [[original.runs[0]]];
      throw new Error("Unexpected inert SQL");
    },
  });
  const projection = plain(
    await repository.list({ page: 99, pageSize: 25, status: "running", query: "Trace" }),
  );
  assert.equal(projection.pagination.page, 2);
  assert.equal(projection.run_metrics.total, 103);
  assert.equal(projection.runs.length, 1);
  assert.equal(sql[0].parameters.length, 0);
  assert.equal(sql[2].parameters.length, 0);
  assert.deepEqual(sql[3].parameters, ["running", "trace", "trace", "trace", "trace", 25, 25]);
  assert.ok(!sql[3].text.includes("organization_id"));
  checks.push(
    "Actual repository list against synthetic query adapter verifies four SQL intents, unfiltered profile/metric scope, literal INSTR search, page clamp/offset and output conversion; no database or SQL execution.",
  );
  return {
    data: {
      original,
      boundary,
      filterCases,
      checks,
      sourcePaths: [
        fixturePath,
        vuePath,
        servicePath,
        repoPath,
        confirmPath,
        "apps/api/src/crawler-runtime-routes.ts",
        "apps/web/src/components/ResponsiveDataView.vue",
        "apps/web/src/components/TableViewControls.vue",
        "apps/web/src/components/UiStatePanel.vue",
        "apps/web/src/ui/state-contract.ts",
      ],
    },
    logic,
  };
}
