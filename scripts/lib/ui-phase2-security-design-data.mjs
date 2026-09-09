import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID } from "node:crypto";

export async function buildSecurityDesignData(repo) {
  const sourcePaths = [
    "apps/web/src/components/SecurityOperationsCenter.vue",
    "apps/api/src/security-operations-service.ts",
    "apps/api/src/mysql-security-operations-repository.ts",
    "apps/api/src/security-operations-routes.ts",
    "apps/web/src/components/ResponsiveDataView.vue",
    "apps/web/src/components/TableViewControls.vue",
    "apps/web/src/api-client.ts",
    "config/route-catalog.json",
    "tests/e2e/m06-04-security-operations.spec.ts",
    "tests/m06-04/security-operations.test.mjs",
  ];
  const read = (p) => readFile(path.join(repo, p), "utf8"),
    parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  const compile = (s) =>
    ts.transpileModule(s, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
  const strip = (s) =>
    parse(s)
      .statements.filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText())
      .join("\n")
      .replaceAll("export ", "");
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const ast = parse(await read(sourcePaths[8]));
  const n = ast.statements
    .filter(ts.isVariableStatement)
    .flatMap((s) => [...s.declarationList.declarations])
    .find((n) => n.name.getText(ast) === "data");
  assert.ok(n);
  const fixture = {};
  vm.runInNewContext(compile("globalThis.result=" + n.initializer.getText(ast)), fixture);
  const original = plain(fixture.result);
  const vue = await read(sourcePaths[0]),
    script = strip(vue.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const exports =
    "data,state,loadedOnce,refreshing,activeView,windowCode,query,queryInput,status,page,tokenPage,requestId,notice,statusOptions,mainPagination,tokenPagination,searchLabel,routeQuery,viewLocation,readLocation,load,refresh,applyWindow,applyFilters,resetFilters,goPage,statusText,eventText,kindText,scopeText,auditActionText,resourceText,summaryText";
  const logic = `window.SECURITY_SOURCE=(b)=>{const {computed,ref,watch,onBeforeUnmount,onMounted,useRoute,useRouter,defineProps,createApiClient,ApiClientError,window,URLSearchParams,AbortController,DOMException}=b;${compile(script)}\nreturn {${exports}};};`;
  class ApiClientError extends Error {
    constructor(kind, status = 400) {
      super(kind);
      this.kind = kind;
      this.status = status;
      this.requestId = "inert-read";
      this.actionHint = "惰性读取失败";
    }
  }
  const tick = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  function mount(query = {}) {
    const box = { window: {} },
      calls = [],
      watchers = [],
      mounted = [],
      unmount = [],
      timers = [],
      routes = [],
      route = { query, fullPath: "/platform-admin/security" };
    vm.runInNewContext(logic, box);
    const s = box.window.SECURITY_SOURCE({
      ref: (value) => ({ value }),
      computed: (get) => ({
        get value() {
          return get();
        },
      }),
      watch: (_get, fn) => watchers.push(fn),
      onMounted: (fn) => mounted.push(fn),
      onBeforeUnmount: (fn) => unmount.push(fn),
      useRoute: () => route,
      useRouter: () => ({
        resolve: (t) => ({ fullPath: t.path + "?" + new URLSearchParams(t.query) }),
        push: async (t) => routes.push(plain(t)),
      }),
      defineProps: () => ({ apiBaseUrl: "inert" }),
      createApiClient: () => (url, options) =>
        new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })),
      ApiClientError,
      window: {
        setTimeout: (fn, ms) => (timers.push({ fn, ms }), timers.length),
        clearTimeout: () => {},
      },
      URLSearchParams,
      AbortController,
      DOMException,
    });
    return { s, calls, watchers, mounted, unmount, timers, routes, route };
  }
  const collectionViews = {
    events: ["security_events"],
    sessions: ["sessions"],
    credentials: ["credential_assets", "organization_tokens"],
    audit: ["audit_events"],
  };
  function snapshot(view, zero = false) {
    const d = plain(original);
    d.view = view;
    for (const k of Object.keys(d.pagination)) {
      if (!collectionViews[view].includes(k)) d[k] = [];
      d.pagination[k] = { page: 1, page_size: 20, total: d[k].length, total_pages: 1 };
    }
    if (zero) d.summary = Object.fromEntries(Object.keys(d.summary).map((k) => [k, 0]));
    return d;
  }
  const checks = [],
    findings = [];
  {
    const x = mount();
    const p = x.mounted[0]();
    await tick();
    x.route.query = { view: "credentials", window: "7d", page: "2", token_page: "3" };
    await x.watchers[0]();
    assert.equal(x.calls.length, 1);
    assert.equal(x.timers[0].ms, 15000);
    assert.equal(x.s.activeView.value, "credentials");
    x.calls[0].resolve({ data: snapshot("events"), request_id: "old-event" });
    await p;
    assert.equal(x.s.data.value.view, "events");
    assert.equal(x.s.activeView.value, "credentials");
    assert.equal(x.s.state.value, "ready");
    assert.equal(x.s.page.value, 1);
    findings.push({
      id: "CS-G04",
      title: "快速路由切换丢失目标读取",
      observed:
        "事件读取在途时切到凭证，watch更新activeView但load单飞早退；旧事件响应仍写入，页面目标与data.view不一致。",
      proposal:
        "请求快照、已读范围和草稿分开；新请求序号使旧终态失效，避免将事件结果套进凭证列表。",
    });
    checks.push(
      "Actual Vue route watcher + pending single-flight reproduces lost credential read, mismatched response view and overwritten page; 15-second timer and 20/20 query sizes.",
    );
    const params = new URL(x.calls[0].url, "https://inert.invalid").searchParams;
    assert.equal(params.get("page_size"), "20");
    assert.equal(params.get("token_page_size"), "20");
  }
  {
    const x = mount();
    const p = x.mounted[0]();
    await tick();
    x.calls[0].resolve({ data: snapshot("sessions", true), request_id: "seed" });
    await p;
    assert.equal(x.s.state.value, "ready");
    assert.equal(x.s.data.value.sessions.length, 1);
    x.route.fullPath = "/another-route";
    x.route.query = { view: "audit" };
    const q = x.watchers[0]();
    await tick();
    assert.equal(x.calls.length, 2);
    x.unmount[0]();
    assert.equal(x.calls[1].options.signal.aborted, true);
    x.calls[1].resolve({ data: snapshot("audit", true), request_id: "late" });
    await q;
    assert.equal(x.s.requestId.value, "late");
    findings.push({
      id: "CS-G04-LIFECYCLE",
      title: "缓存路由与忽略abort的迟到响应",
      observed:
        "route watcher未限定本页路径；惰性请求忽略abort时，卸载后结果仍写入ref。成功零摘要保留历史记录的既有修复有效。",
      proposal: "进入/离开与请求终态需要实例归属；惰性复现不是挂载Vue、KeepAlive或真实网络验收。",
    });
    checks.push(
      "Actual Vue zero-summary ready behavior preserved; unrelated route watcher and abort-ignoring late response reproduced using manual lifecycle callbacks.",
    );
  }
  {
    for (const [kind, status, expected] of [
      ["expired", 401, "expired"],
      ["forbidden", 403, "forbidden"],
      ["rate_limited", 429, "rate_limited"],
      ["error", 503, "blocked"],
      ["error", 400, "error"],
    ]) {
      const x = mount();
      const p = x.s.load();
      await tick();
      x.calls[0].reject(new ApiClientError(kind, status));
      await p;
      assert.equal(x.s.state.value, expected);
    }
    const x = mount();
    const p = x.s.load();
    await tick();
    x.timers[0].fn();
    x.calls[0].reject(new DOMException("inert timeout", "AbortError"));
    await p;
    assert.match(x.s.notice.value, /保留上次成功/);
    assert.equal(x.s.loadedOnce.value, false);
    const y = mount();
    y.s.data.value = snapshot("events");
    y.s.loadedOnce.value = true;
    y.s.state.value = "ready";
    const q = y.s.load();
    await tick();
    y.calls[0].reject(new ApiClientError("forbidden", 403));
    await q;
    assert.equal(y.s.data.value.security_events.length, 1);
    assert.equal(y.s.state.value, "ready");
    findings.push({
      id: "CS-G04-ERROR",
      title: "首次超时与已有快照错误不混淆",
      observed: "首次超时仍提示保留上次成功数据；已有数据时403保留ready与旧记录。",
      proposal: "首次明确没有快照；保留快照的错误说明归属和时点，不擅自改变访问控制合同。",
    });
    checks.push(
      "Actual first-read 401/403/429/503/400 state mapping, misleading initial-timeout copy and existing snapshot retained on 403 verified.",
    );
  }
  const mapper = mount().s;
  {
    const x = mount();
    x.s.activeView.value = "credentials";
    x.s.windowCode.value = "30d";
    x.s.query.value = " abc ";
    x.s.page.value = 3;
    x.s.tokenPage.value = 4;
    assert.deepEqual(plain(x.s.routeQuery()), {
      view: "credentials",
      window: "30d",
      query: "abc",
      page: "3",
      token_page: "4",
    });
    assert.deepEqual(plain(x.s.viewLocation("sessions").query), {
      view: "sessions",
      window: "30d",
    });
    for (const view of Object.keys(collectionViews)) {
      x.s.activeView.value = view;
      assert.equal(x.s.statusOptions.value.length, 4);
      assert.equal(x.s.searchLabel.value.includes("搜索"), true);
    }
    assert.equal(mapper.eventText("unknown"), "未分类安全事件");
    assert.equal(mapper.scopeText("unknown"), "其他权限");
    const rdv = await read(sourcePaths[4]);
    assert.equal((vue.match(/<ResponsiveDataView\b/g) || []).length, 5);
    assert.equal((vue.match(/v-model=/g) || []).length, 3);
    assert.doesNotMatch(rdv, /keydown\.tab|key === "Tab"/);
    findings.push({
      id: "CS-G07",
      title: "五类共享详情需完整模态验证",
      observed: "共享详情当前只有Escape/关闭/返焦，没有完整Tab圈定；字段由五个消费者分别提供。",
      proposal: "原型用原生模态及显式焦点循环验证五类；桌面列设置分别归属，不能隐藏令牌分页。",
    });
    checks.push(
      "Actual URL defaults/view reset, four status menus/search labels, unknown-label fallback, five ResponsiveDataView consumers and three input bindings; missing shared Tab trap is static evidence only.",
    );
  }
  const serviceBox = {};
  vm.runInNewContext(
    compile(strip(await read(sourcePaths[1])) + "\nglobalThis.Service=SecurityOperationsService;"),
    serviceBox,
  );
  {
    const service = new serviceBox.Service({ read: async (i) => i }, "24h", 50);
    for (const window of ["24h", "7d", "30d"])
      for (const view of Object.keys(collectionViews))
        for (const status of view === "events" || view === "audit"
          ? ["", "succeeded", "failed", "blocked"]
          : ["", "active", "expired", "revoked"]) {
          const r = await service.read({ window, view, status });
          assert.equal(r.pageSize, 20);
          assert.equal(r.tokenPageSize, 20);
        }
    for (const v of [
      { window: "1y" },
      { view: "other" },
      { view: "sessions", status: "blocked" },
      { query: "x".repeat(121) },
      { page: 0 },
      { tokenPageSize: 51 },
    ])
      await assert.rejects(service.read(v));
    assert.equal((await service.read({ query: " a ", page: 1000000, tokenPage: 2 })).query, "a");
    const bad = new serviceBox.Service({
      read: async () => {
        throw Object.assign(new Error("inert"), { code: "ECONNREFUSED" });
      },
    });
    await assert.rejects(bad.read({}), (e) => e.statusCode === 503);
    checks.push(
      "Actual service 48 window/view/status combinations, query120, bounded independent page sizes/pages and dependency error mapping verified; no service connection.",
    );
  }
  {
    const repositoryBox = { randomUUID };
    vm.runInNewContext(
      compile(
        strip(await read(sourcePaths[2])) +
          "\nglobalThis.Repository=MySqlSecurityOperationsRepository;",
      ),
      repositoryBox,
    );
    for (const view of Object.keys(collectionViews)) {
      const queries = [],
        transactions = [];
      const sqlQuery = async (sql, params = []) => {
        queries.push({ sql, params });
        if (sql.startsWith("SELECT (SELECT")) return [[original.summary]];
        if (sql.startsWith("SELECT COUNT(*)")) return [[{ total: 1 }]];
        if (sql.startsWith("INSERT")) return [{ affectedRows: 1 }];
        if (sql.includes("FROM auth_security_events e")) return [[original.security_events[0]]];
        if (sql.includes("FROM user_sessions s"))
          return [
            [
              {
                ...original.sessions[0],
                device_label: "Synthetic Windows device Chrome/123 private-label",
              },
            ],
          ];
        if (sql.includes("FROM credential_assets a")) return [[original.credential_assets[0]]];
        if (sql.includes("FROM organization_api_tokens t")) {
          const { scopes, ...row } = original.organization_tokens[0];
          return [[{ ...row, scopes_json: JSON.stringify(scopes) }]];
        }
        if (sql.includes("FROM platform_audit_events a")) return [[original.audit_events[0]]];
        throw new Error("Unexpected inert SQL " + sql);
      };
      const c = {
        query: sqlQuery,
        beginTransaction: async () => transactions.push("begin"),
        commit: async () => transactions.push("commit"),
        rollback: async () => transactions.push("rollback"),
        release: () => transactions.push("release"),
      };
      const r = new repositoryBox.Repository(
        { query: sqlQuery, getConnection: async () => c },
        () => new Date(original.observed_at),
      );
      const result = await r.read({
        view,
        window: "7d",
        windowHours: 168,
        status: view === "events" || view === "audit" ? "failed" : "expired",
        query: "_%=",
        page: 99,
        pageSize: 20,
        tokenPage: 99,
        tokenPageSize: 20,
        actorId: "inert",
      });
      for (const k of Object.keys(original.pagination))
        assert.equal(result[k].length, collectionViews[view].includes(k) ? 1 : 0);
      assert.deepEqual(transactions, ["begin", "commit", "release"]);
      assert.equal(queries.filter((q) => q.sql.startsWith("INSERT")).length, 2);
      assert.ok(
        queries.findIndex((q) => q.sql.startsWith("INSERT")) >
          queries.findIndex((q) => q.sql.includes("ORDER BY")),
      );
      for (const q of queries.filter(
        (q) => q.sql.startsWith("SELECT") && !q.sql.startsWith("SELECT (SELECT"),
      )) {
        assert.doesNotMatch(
          q.sql,
          /token_hash|payload_ciphertext|payload_nonce|payload_auth_tag|ip_hash|user_agent_hash/,
        );
        if (q.sql.includes("LIKE")) assert.ok(q.params.includes("%=_=%==%"));
      }
      if (view === "sessions") {
        assert.equal(result.sessions[0].device_label, "Windows · Chrome");
        assert.ok(queries.some((q) => q.sql.includes("THEN 'expired'")));
      }
      if (view === "credentials") {
        assert.equal(result.pagination.organization_tokens.page, 1);
        assert.deepEqual(plain(result.organization_tokens[0].scopes), ["report:read"]);
        assert.equal("scopes_json" in result.organization_tokens[0], false);
      }
    }
    checks.push(
      "Actual repository four view branches with inert SQL: separate 20/20 paging/clamp, raw-device-to-coarse-label transform, scope JSON removal, effective-status predicates, escaped query and two read-audit INSERT intents after listing. No SQL/RBAC transaction proof.",
    );
  }
  const route = await read(sourcePaths[3]);
  assert.match(route, /platform:secure/);
  assert.match(route, /private, no-store/);
  assert.equal((route.match(/app\.get\(/g) || []).length, 1);
  assert.doesNotMatch(route, /app\.(post|patch|delete)\(/);
  checks.push(
    "Actual route static read-only capability/cache contract; live authentication, row safety and MySQL are not validated by inert adapters.",
  );
  const labelLogic =
    "window.SECURITY_LABELS={" +
    [
      "statusText",
      "eventText",
      "kindText",
      "scopeText",
      "auditActionText",
      "resourceText",
      "summaryText",
    ]
      .map((k) => k + ":" + mapper[k].toString())
      .join(",") +
    "};";
  return {
    data: { sourcePaths, sourceChecks: checks, original, findings, views: collectionViews },
    logic: logic + "\n" + labelLogic,
  };
}
