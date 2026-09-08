import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID } from "node:crypto";

export async function buildCommercialDesignData(repo) {
  const sourcePaths = [
    "apps/web/src/components/CommercialOperationsCenter.vue",
    "apps/api/src/commercial-service.ts",
    "apps/api/src/mysql-commercial-repository.ts",
    "apps/api/src/commercial-routes.ts",
    "apps/web/src/use-modal-dialog.ts",
    "apps/web/src/api-client.ts",
    "config/route-catalog.json",
    "tests/e2e/m06-06-commercial.spec.ts",
    "tests/m06-06/commercial.test.mjs",
  ];
  const read = (p) => readFile(path.join(repo, p), "utf8");
  const parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
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
  const ast = parse(await read(sourcePaths[7]));
  const declaration = ast.statements
    .filter(ts.isVariableStatement)
    .flatMap((n) => [...n.declarationList.declarations])
    .find((n) => n.name.getText(ast) === "data");
  assert.ok(declaration);
  const fixtureBox = {};
  vm.runInNewContext(
    compile(`globalThis.result=${declaration.initializer.getText(ast)}`),
    fixtureBox,
  );
  const original = plain(fixtureBox.result);
  const vue = await read(sourcePaths[0]);
  const script = strip(vue.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const names =
    "data,state,loadedOnce,refreshing,mutating,organizationId,organizationInput,assignment,adjustment,plan,editingPlan,creatingPlan,pending,query,status,page,adjustmentPage,notice,noticeKind,requestId,selectablePlans,quotaNames,localDate,buildImpact,load,createPlan,beginEditPlan,savePlan,assignOrRenew,submitAdjustment,prepare,confirm,readOrganization,clearOrganization,applyFilters,changePage,changeAdjustmentPage,handlePopState";
  const logic = `window.COMMERCIAL_SOURCE=(b)=>{const {computed,ref,onBeforeUnmount,onMounted,defineProps,createApiClient,ApiClientError,useModalDialog,location,history,crypto,window,URLSearchParams,AbortController,DOMException}=b;${compile(script)}\nreturn {${names}};};`;
  class ApiClientError extends Error {
    constructor(status) {
      super(String(status));
      this.status = status;
      this.actionHint = "惰性错误";
      this.requestId = "inert-request";
    }
  }
  const tick = async () => {
    for (let n = 0; n < 10; n++) await Promise.resolve();
  };
  function mount() {
    const box = { window: {} },
      calls = [],
      urls = [],
      timers = [];
    vm.runInNewContext(logic, box);
    const s = box.window.COMMERCIAL_SOURCE({
      ref: (value) => ({ value }),
      computed: (get) => ({
        get value() {
          return get();
        },
      }),
      onMounted: () => {},
      onBeforeUnmount: () => {},
      defineProps: () => ({ apiBaseUrl: "inert" }),
      createApiClient: () => (url, options) =>
        new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })),
      ApiClientError,
      useModalDialog: () => ({ dialogElement: { value: null }, handleCancel: () => {} }),
      location: { search: "", pathname: "/platform-admin/commercial" },
      history: {
        state: null,
        pushState: (_a, _b, u) => urls.push(u),
        replaceState: (_a, _b, u) => urls.push(u),
      },
      crypto: { randomUUID },
      window: { setTimeout: (fn, ms) => (timers.push({ fn, ms }), 1), clearTimeout: () => {} },
      URLSearchParams,
      AbortController,
      DOMException,
    });
    return { s, calls, urls, timers };
  }
  const seed = (s) => {
    s.data.value = plain(original);
    s.organizationId.value = "o1";
    s.organizationInput.value = "o1";
    s.loadedOnce.value = true;
    s.state.value = "ready";
  };
  const checks = [],
    findings = [];
  {
    const { s, calls, timers } = mount();
    seed(s);
    s.organizationInput.value = "o2";
    s.readOrganization();
    await tick();
    s.readOrganization();
    assert.equal(calls.length, 1);
    assert.equal(timers[0].ms, 15000);
    const params = new URL(calls[0].url, "https://inert.invalid").searchParams;
    assert.equal(params.get("page_size"), "20");
    assert.equal(params.get("adjustment_page_size"), "10");
    calls[0].reject(new ApiClientError(404));
    await tick();
    assert.equal(s.data.value.organization.id, "o1");
    assert.equal(s.organizationId.value, "o2");
    s.assignOrRenew();
    assert.equal(s.pending.value.body.organization_id, "o2");
    findings.push({
      id: "CS-G01",
      title: "组织目标与保留快照分离不足",
      observed: "读取 o2 失败后 data.organization=o1，但分配请求目标=o2。",
      proposal: "已读取组织与输入/请求分开；切换失败不能沿用旧事实生成新目标确认。",
    });
    checks.push(
      "Actual Vue read single-flight, 15-second timer, 20/10 query sizes and stale organization target mismatch reproduced without HTTP.",
    );
  }
  {
    const { s } = mount();
    seed(s);
    s.data.value.plans = [];
    assert.equal(s.selectablePlans.value[0].id, "p1");
    const missing = s.buildImpact("/platform/commercial/assignments", {
      organization_id: "o1",
      plan_id: "p1",
      period_start: s.localDate(original.assignment.period_start),
      period_end: s.localDate(original.assignment.period_end),
    });
    assert.equal(missing.rows[0].after, "未选择");
    const future = s.buildImpact("/platform/commercial/adjustments", {
      organization_id: "o1",
      quota_key: "collection_tasks",
      delta_value: 50,
      effective_at: "2099-01-01T00:00",
    });
    assert.match(future.rows[0].after, /150/);
    s.data.value.effective_quotas.collection_tasks = 0;
    s.data.value.plans = plain(original.plans);
    s.data.value.plans[0].quotas.collection_tasks = 200;
    const clamped = s.buildImpact("/platform/commercial/assignments", {
      plan_id: "p1",
      organization_id: "o1",
    });
    assert.match(clamped.rows[2].after, /100/);
    findings.push({
      id: "CS-G02",
      title: "影响值不足以作为执行事实",
      observed:
        "当前方案可选但分页外预览显示未选择；未来 +50 也立即预览为150；截零后不能恢复原负调整总额。",
      proposal:
        "缺失方案/未到期/过期/截零反推场景展示限制与待核对值，不猜变更后余量。需实现阶段修正预览算法。",
    });
    checks.push(
      "Actual Vue selectable-current-plan fallback versus preview lookup, future adjustment and clamped-negative reverse-calculation limitations reproduced.",
    );
  }
  {
    const { s, calls } = mount();
    seed(s);
    s.plan.value = {
      code: "audit",
      name: "审核草稿",
      description: "",
      collection_tasks: 100,
      open_api_requests: 1000,
      report_exports: 20,
      reason: "验证",
    };
    const p = s.createPlan();
    await tick();
    await s.createPlan();
    assert.equal(calls.length, 1);
    const key = calls[0].options.idempotencyKey;
    calls[0].reject(new ApiClientError(503));
    await p;
    const retry = s.createPlan();
    await tick();
    assert.equal(calls[1].options.idempotencyKey, key);
    s.creatingPlan.value = false;
    s.creatingPlan.value = true;
    calls[1].resolve({ data: { id: "inert" }, request_id: "inert-write" });
    await tick();
    assert.equal(s.creatingPlan.value, false);
    assert.equal(calls[2].options.method, "GET");
    calls[2].reject(new ApiClientError(503));
    await retry;
    assert.equal(s.noticeKind.value, "success");
    assert.match(s.notice.value, /草稿已创建/);
    findings.push({
      id: "CS-G03",
      title: "写入结果与刷新、窗口实例需要分开",
      observed:
        "创建单飞与原幂等键重试存在；旧创建成功仍关闭新开窗口，重读失败被创建成功提示覆盖。",
      proposal:
        "保留写事务身份；窗内错误、旧结果单独通知、成功/刷新失败双结果；关闭不声称撤回事务。",
    });
    checks.push(
      "Actual Vue create single-flight and retained idempotency key verified; late response closes newer dialog and overwrites reload error reproduced.",
    );
  }
  {
    const { s, calls } = mount();
    seed(s);
    s.beginEditPlan(original.plans[0]);
    s.savePlan();
    assert.equal(s.editingPlan.value, null);
    assert.equal(s.pending.value.body.expected_version, 2);
    assert.equal(s.pending.value.method, "PATCH");
    const p = s.confirm();
    await tick();
    await s.confirm();
    assert.equal(calls.length, 1);
    const key = s.pending.value.idempotencyKey;
    calls[0].reject(new ApiClientError(409));
    await p;
    assert.equal(s.pending.value.idempotencyKey, key);
    s.adjustment.value.delta_value = 0;
    s.pending.value = null;
    s.submitAdjustment();
    assert.equal(s.pending.value, null);
    assert.match(s.notice.value, /非零整数/);
    checks.push(
      "Actual Vue edit-to-impact frozen full PATCH/version, confirmation single-flight, pending key retention on 409 and zero-adjustment guard verified.",
    );
  }
  const serviceBox = { randomUUID };
  vm.runInNewContext(
    compile(
      strip(await read(sourcePaths[1])) +
        "\nglobalThis.Service=CommercialService;globalThis.CommercialError=CommercialError;",
    ),
    serviceBox,
  );
  const echo = new Proxy({}, { get: () => async (i) => i });
  const service = new serviceBox.Service(echo);
  const id = "00000000-0000-4000-8000-000000000058";
  {
    assert.equal((await service.read({})).pageSize, 20);
    for (const value of [
      { page: 0 },
      { query: "x".repeat(121) },
      { status: "deleted" },
      { organizationId: "o1" },
    ])
      assert.throws(() => service.read(value));
    const value = {
      code: " Audit_58 ",
      name: "验证",
      quotas: { collection_tasks: 0, open_api_requests: 1000000000, report_exports: 20 },
      reason: "x",
    };
    assert.equal((await service.createPlan({ value })).value.code, "audit_58");
    for (const amount of [-1, 1.2, 1000000001])
      assert.throws(() =>
        service.createPlan({ value: { ...value, quotas: { collection_tasks: amount } } }),
      );
    for (const amount of [-1000000000, 1000000000])
      assert.equal(
        (
          await service.adjust({
            value: {
              organization_id: id,
              assignment_id: id,
              quota_key: "collection_tasks",
              delta_value: amount,
              reason: "x",
            },
          })
        ).value.delta_value,
        amount,
      );
    for (const amount of [0, 1.2, 1000000001])
      assert.throws(() =>
        service.adjust({ value: { delta_value: amount, quota_key: "collection_tasks" } }),
      );
    assert.throws(() =>
      service.assign({ value: { period_start: "2026-09-01", period_end: "2026-09-01" } }),
    );
    assert.throws(() =>
      service.adjust({
        value: {
          delta_value: 1,
          quota_key: "collection_tasks",
          effective_at: "2026-09-02",
          expires_at: "2026-09-01",
        },
      }),
    );
    for (const status of ["draft", "active", "retired"])
      assert.equal(
        (
          await service.updatePlan({
            planId: id,
            value: {
              name: "验证",
              quotas: { collection_tasks: 0 },
              status,
              expected_version: 2,
              reason: "x",
            },
          })
        ).value.status,
        status,
      );
    findings.push({
      id: "CS-G06",
      title: "服务与表单约束差异保留",
      observed:
        "服务原因 trim 后1–500；编辑与分配前端 minlength=2；服务 code 先小写化而前端只收小写。",
      proposal: "逐字段保留来源约束并展示差异，不新增收费字段或扩大服务规则。",
    });
    checks.push(
      "Actual service validation executed: three quota keys, integer/max/zero bounds, UUIDs, dates, three editable states, one-character service reason and lowercase code normalization.",
    );
  }
  {
    const queries = [];
    const source = strip(await read(sourcePaths[2]));
    const box = { randomUUID, CommercialError: serviceBox.CommercialError };
    vm.runInNewContext(compile(source + "\nglobalThis.Repository=MySqlCommercialRepository;"), box);
    const query = async (sql, params = []) => {
      queries.push({ sql, params });
      if (sql.includes("SUM(status=")) return [[{ total: 1, draft: 0, active: 1, retired: 0 }]];
      if (sql.startsWith("SELECT COUNT(*) total FROM commercial_plans")) return [[{ total: 1 }]];
      if (sql.startsWith("SELECT p.id"))
        return [[{ ...original.plans[0], quotas_json: JSON.stringify(original.plans[0].quotas) }]];
      if (sql.startsWith("SELECT id,name,status FROM organizations"))
        return [[original.organization]];
      if (sql.startsWith("SELECT a.id"))
        return [
          [{ ...original.assignment, quotas_json: JSON.stringify(original.assignment.quotas) }],
        ];
      if (sql.startsWith("SELECT COUNT(*) total FROM commercial_quota_adjustments"))
        return [[{ total: 1 }]];
      if (sql.startsWith("SELECT id,quota_key")) return [[original.adjustments[0]]];
      if (sql.startsWith("SELECT (SELECT COUNT(*)")) return [[original.usage]];
      if (sql.startsWith("SELECT quota_key,SUM"))
        return [
          [
            { quota_key: "collection_tasks", delta_value: -150 },
            { quota_key: "open_api_requests", delta_value: 50 },
          ],
        ];
      if (sql.startsWith("INSERT")) return [{ affectedRows: 1 }];
      throw new Error("Unexpected inert SQL: " + sql);
    };
    const c = {
      query,
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
    };
    const repository = new box.Repository(
      { query, getConnection: async () => c },
      () => new Date(original.observed_at),
    );
    const result = await repository.read({
      organizationId: "o1",
      actorId: "inert",
      query: "_%",
      status: "active",
      page: 99,
      pageSize: 20,
      adjustmentPage: 99,
      adjustmentPageSize: 10,
    });
    assert.equal(result.effective_quotas.collection_tasks, 0);
    assert.equal(result.effective_quotas.open_api_requests, 1050);
    assert.equal(result.pagination.page, 1);
    const sum = queries.find((q) => q.sql.startsWith("SELECT quota_key,SUM"));
    assert.match(sum.sql, /assignment_id=\?/);
    assert.match(sum.sql, /expires_at>\?/);
    assert.equal(sum.params[1], "a1");
    assert.doesNotMatch(
      queries.find((q) => q.sql.startsWith("SELECT (SELECT COUNT(*)")).sql,
      /status/,
    );
    assert.ok(queries.some((q) => q.sql.startsWith("INSERT INTO commercial_views")));
    checks.push(
      "Actual repository read with inert SQL adapter verifies global catalog/paging, escaped search, all-status period COUNT, assignment-scoped effective SUM and zero clamp plus read-audit query intent; no MySQL executed.",
    );
  }
  const models = [...vue.matchAll(/v-model(?:\.number)?="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(models.length, 26);
  assert.equal((vue.match(/<dialog /g) || []).length, 3);
  const routes = await read(sourcePaths[3]);
  assert.match(routes, /platform:operate/);
  assert.match(routes, /requireIdempotencyKey/);
  assert.match(routes, /r.headers.origin !== o.webOrigin/);
  checks.push(
    "Static boundaries: 26 model fields, three native business dialogs, platform:operate/origin/idempotency route predicates; not authentication or transaction acceptance.",
  );
  return {
    data: {
      sourcePaths,
      sourceChecks: checks,
      original,
      findings,
      models,
      quotaNames: plain(mount().s.quotaNames),
    },
    logic,
  };
}
