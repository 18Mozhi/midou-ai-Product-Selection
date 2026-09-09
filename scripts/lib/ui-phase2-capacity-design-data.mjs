import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID } from "node:crypto";

// Permanent, inert source-contract harness. No HTTP, SQL or production attestation.
export async function buildCapacityDesignData(repo) {
  const sourcePaths = [
    "apps/api/src/capacity-boundary-service.ts",
    "apps/api/src/capacity-boundary-repository.ts",
    "apps/api/src/capacity-boundary-routes.ts",
    "apps/web/src/components/CapacityBoundaryCenter.vue",
    "apps/web/src/components/ConfirmDialog.vue",
    "apps/web/src/ui/state-contract.ts",
    "apps/web/src/components/TechnicalDetails.vue",
    "tests/e2e/m08-06-capacity-boundary.spec.ts",
    "packages/config/src/index.ts",
    "infra/baota/capacity-boundary-manifest.json",
  ];
  const sources = await Promise.all(sourcePaths.map((f) => readFile(path.join(repo, f), "utf8")));
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const ast = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  const strip = (s) =>
    ast(s)
      .statements.filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText())
      .join("\n")
      .replaceAll("export ", "");
  const compile = (s) =>
    ts.transpileModule(s, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
  const box = { Date, Error, Number, randomUUID };
  vm.createContext(box);
  vm.runInContext(
    compile(strip(sources[0])) +
      "\nglobalThis.Service=CapacityBoundaryService;globalThis.evaluate=evaluateCapacityBoundary;",
    box,
  );
  vm.runInContext(
    compile(strip(sources[1])) +
      "\nglobalThis.Repo=CapacityBoundaryRepository;globalThis.stop=boundaryStop;",
    box,
  );
  const clock = "2026-09-09T08:00:00.000Z",
    now = new Date(clock);
  const manifest = JSON.parse(sources[9]),
    g = manifest.stopGates;
  const policy = {
    readP95StopMs: g.readP95Ms,
    writeP95StopMs: g.writeP95Ms,
    errorRateStopBasisPoints: g.errorRatePercent * 100,
    asyncLagStopSeconds: g.asyncLagSeconds,
    maximumLoadBasisPoints: g.maximumLoadPercent * 100,
    minimumAvailableMemoryMb: g.minimumAvailableMemoryMb,
    minimumFreeDiskMb: g.minimumFreeDiskMb,
    maximumEvidenceAgeMinutes: 60,
  };
  assert.match(sources[8], /"CAPACITY_BOUNDARY_EVIDENCE_MAX_AGE_MINUTES",\s*60/);
  const base = {
    measured_concurrency: 20,
    read_p95_ms: 118,
    write_p95_ms: 284,
    error_rate_basis_points: 0,
    async_lag_seconds: 2,
    load_basis_points: 3260,
    available_memory_mb: 6144,
    free_disk_mb: 245760,
    archive_verified: true,
    recovery_verified: true,
    boundary_stop_reason: "planning_ceiling_reached",
    failed_next_concurrency: null,
    failed_next_code: null,
    observed_at: clock,
  };
  const datasets = {},
    labels = {},
    snapshots = {},
    sourceChecks = [];
  const ids = {
    actorId: "synthetic-actor",
    requestId: "synthetic-read",
    traceId: "synthetic-trace",
  };
  async function add(key, label, changes = {}, p = policy) {
    const snapshot = { ...base, ...changes };
    let recorded;
    const service = new box.Service(
      {
        snapshot: async () => snapshot,
        recordView: async (v) => {
          recorded = v;
        },
      },
      p,
      () => now,
    );
    datasets[key] = plain(await service.read(ids));
    labels[key] = label;
    snapshots[key] = snapshot;
    assert.deepEqual(plain(recorded.evaluation), plain(box.evaluate(snapshot, p, now)));
    assert.equal(
      datasets[key].boundary.capacity_claim,
      datasets[key].state === "blocked" ? "unverified" : "measured_single_host_limited",
    );
  }
  await add("ready", "20档规划上限");
  for (const c of [5, 10])
    await add("limited-" + c, c + "档通过/下一档失败", {
      measured_concurrency: c,
      boundary_stop_reason: "next_stage_gate_failed",
      failed_next_concurrency: c === 5 ? 10 : 20,
      failed_next_code: "capacity_write_latency_exceeded",
    });
  const cases = [
    ["missing", "未通过5档", { measured_concurrency: 0, boundary_stop_reason: null }],
    ["stale", "观测过期", { observed_at: "2026-09-09T06:59:59.999Z" }],
    ["fresh-boundary", "恰好60分钟", { observed_at: "2026-09-09T07:00:00.000Z" }],
    ["future", "未来观测", { observed_at: "2026-09-09T08:00:00.001Z" }],
    ["read-warning", "读取预警270", { read_p95_ms: 270 }],
    ["read-boundary", "读取等于300", { read_p95_ms: 300 }],
    ["read-stop", "读取超过300", { read_p95_ms: 301 }],
    ["write-warning", "写入预警540", { write_p95_ms: 540 }],
    ["write-boundary", "写入等于600", { write_p95_ms: 600 }],
    ["write-stop", "写入超过600", { write_p95_ms: 601 }],
    ["error-warning", "错误率0.80%", { error_rate_basis_points: 80 }],
    ["error-stop", "错误率1%", { error_rate_basis_points: 100 }],
    ["lag-warning", "异步滞后48秒", { async_lag_seconds: 48 }],
    ["lag-boundary", "异步滞后60秒", { async_lag_seconds: 60 }],
    ["lag-stop", "异步滞后61秒", { async_lag_seconds: 61 }],
    ["load-warning", "归一化负载76.5%", { load_basis_points: 7650 }],
    ["load-stop", "归一化负载85%", { load_basis_points: 8500 }],
    ["memory-stop", "可用内存不足", { available_memory_mb: 1023 }],
    ["disk-stop", "可用磁盘不足", { free_disk_mb: 4095 }],
    ["resource-boundary", "内存磁盘恰好下限", { available_memory_mb: 1024, free_disk_mb: 4096 }],
    ["archive-missing", "归档未核验", { archive_verified: false }],
    ["recovery-missing", "隔离恢复未核验", { recovery_verified: false }],
    ["both-missing", "两项恢复证据未核验", { archive_verified: false, recovery_verified: false }],
    ["stop-missing", "10档停止事实缺失", { measured_concurrency: 10, boundary_stop_reason: null }],
    [
      "stop-wrong",
      "下一档与当前档不匹配",
      {
        measured_concurrency: 5,
        boundary_stop_reason: "next_stage_gate_failed",
        failed_next_concurrency: 20,
        failed_next_code: "capacity_write_latency_exceeded",
      },
    ],
    [
      "ceiling-invalid",
      "20档仍附下一档失败",
      { failed_next_concurrency: 20, failed_next_code: "capacity_write_latency_exceeded" },
    ],
    ["over-ceiling", "源评价接受21档异常样本", { measured_concurrency: 21 }],
    [
      "off-stage",
      "源评价7档及null下一档边界",
      {
        measured_concurrency: 7,
        boundary_stop_reason: "next_stage_gate_failed",
        failed_next_concurrency: null,
        failed_next_code: "synthetic_failure",
      },
    ],
    [
      "negative-resource",
      "负资源保留原值",
      { available_memory_mb: -1, free_disk_mb: -2, load_basis_points: -10 },
    ],
    ["large-resource", "资源高于旧显示上限", { available_memory_mb: 65536, free_disk_mb: 1048576 }],
    [
      "long",
      "长失败码和处置文本",
      {
        measured_concurrency: 5,
        boundary_stop_reason: "next_stage_gate_failed",
        failed_next_concurrency: 10,
        failed_next_code: "synthetic_long_failure_".repeat(22),
      },
    ],
    [
      "multiple",
      "多项阻断与预警",
      {
        read_p95_ms: 301,
        write_p95_ms: 540,
        error_rate_basis_points: 100,
        async_lag_seconds: 48,
        load_basis_points: 8500,
        available_memory_mb: 1023,
        free_disk_mb: 4095,
        archive_verified: false,
        recovery_verified: false,
      },
    ],
  ];
  for (const [k, l, c] of cases) await add(k, l, c);
  await add(
    "policy-difference",
    "运行策略与合同参考不同",
    { read_p95_ms: 350 },
    { ...policy, readP95StopMs: 400 },
  );
  assert.equal(datasets["over-ceiling"].state, "ready");
  assert.equal(datasets["off-stage"].state, "warning");
  assert.equal(datasets["read-boundary"].state, "warning");
  assert.equal(datasets["resource-boundary"].state, "ready");
  assert.equal(datasets["fresh-boundary"].state, "ready");
  assert.equal(datasets["policy-difference"].state, "ready");
  assert.ok(
    !datasets["read-warning"].findings.some((f) => f.code === "capacity_next_stage_gate_failed"),
  );
  assert.ok(
    box
      .evaluate({ ...base, observed_at: "invalid" }, policy, now)
      .findings.some((f) => f.code === "capacity_evidence_stale"),
  );
  let viewCalls = 0;
  await assert.rejects(
    new box.Service(
      { snapshot: async () => null, recordView: async () => viewCalls++ },
      policy,
      () => now,
    ).read(ids),
    (e) => e.code === "capacity_evidence_unavailable",
  );
  assert.equal(viewCalls, 0);
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(
    new box.Service(
      {
        snapshot: async () => {
          throw new Error("must not read");
        },
      },
      policy,
      () => now,
    ).read({ ...ids, signal: aborted.signal }),
    (e) => e.name === "AbortError",
  );
  sourceChecks.push(
    "Actual evaluator/service: fixed strict/inclusive gates, exact60min/future/invalid time, three degradation modes, fixed topology claims, limited stop facts, metric-only warning and source acceptance of off-plan7/21 values. Null read fails before view audit; pre-aborted read rejected. Synthetic output is not measured capacity.",
  );

  const row = {
    ...base,
    observed_at_utc: clock,
    finding_codes_json: '["capacity_boundary_stop:planning_ceiling_reached:20"]',
  };
  async function mapped(input) {
    let query;
    const r = new box.Repo({
      query: async (sql) => {
        query = sql;
        return [input ? [input] : []];
      },
    });
    const v = await r.snapshot(now);
    assert.match(query, /source='production_benchmark' ORDER BY observed_at DESC LIMIT 1/);
    assert.ok(!/build_sha|signature/i.test(query));
    return v;
  }
  assert.deepEqual(plain(await mapped(row)), base);
  assert.equal(await mapped(null), null);
  await assert.rejects(
    mapped({ ...row, observed_at_utc: "invalid" }),
    /capacity_observed_at_invalid/,
  );
  for (const value of [null, "bad", {}, "[1,null]", "[]"])
    assert.equal(box.stop(value).boundary_stop_reason, null);
  assert.equal(
    box.stop('["capacity_boundary_stop:next_stage_gate_failed:10:bad-code"]').boundary_stop_reason,
    null,
  );
  const mixed = box.stop(
    '["capacity_boundary_stop:planning_ceiling_reached:20","capacity_boundary_stop:next_stage_gate_failed:10:first","capacity_boundary_stop:next_stage_gate_failed:20:second"]',
  );
  assert.equal(mixed.failed_next_concurrency, 10);
  assert.equal(mixed.failed_next_code, "first");
  const nullNumeric = await mapped({
    ...row,
    read_p95_ms: null,
    write_p95_ms: null,
    error_rate_basis_points: null,
    async_lag_seconds: null,
  });
  await add("null-coercion", "仓储null数值转0", nullNumeric);
  assert.equal(datasets["null-coercion"].performance.read_p95_ms, 0);
  sourceChecks.push(
    "Actual repository read with inert pool: latest production row without build/signature filter, canonical UTC parse/failure, malformed stop-code handling and first valid next-stop precedence. Numeric null coerces to0; original raw null is unavailable in DTO. No real SQL execution.",
  );

  function tx({ replay = null, missing = false, fail = false, abortAfterFirst = null } = {}) {
    const events = [],
      queries = [];
    const c = {
      beginTransaction: async () => events.push("begin"),
      commit: async () => events.push("commit"),
      rollback: async () => events.push("rollback"),
      release: () => events.push("release"),
      query: async (sql, params = []) => {
        queries.push({ sql, params });
        assert.equal((sql.match(/\?/g) || []).length, params.length);
        if (sql.startsWith("SELECT result_json")) return [replay ? [{ result_json: replay }] : []];
        if (sql.startsWith("SELECT id"))
          return [missing ? [] : [{ id: "synthetic-observation-B" }]];
        if (queries.length === 1) abortAfterFirst?.abort();
        if (fail && sql.includes("platform_audit_events")) throw new Error("inert-audit-failure");
        return [{}];
      },
    };
    return { repo: new box.Repo({ getConnection: async () => c }), events, queries };
  }
  const attestation = {
    ...ids,
    idempotencyKey: "synthetic-key",
    kind: "archive_recovery",
    reason: "  测试签认  ",
    now,
  };
  const result = { status: "verified", observed_at: clock };
  for (const replay of [null, JSON.stringify(result), result]) {
    const t = tx({ replay });
    assert.deepEqual(plain(await t.repo.attestDrill(attestation)), result);
    assert.deepEqual(t.events, ["begin", "commit", "release"]);
    assert.equal(t.queries.length, replay ? 1 : 5);
    if (!replay) {
      assert.match(t.queries[1].sql, /archive_verified=1 AND recovery_verified=1.*FOR UPDATE/);
      assert.equal(t.queries[2].params[3], "synthetic-observation-B");
    }
  }
  for (const options of [{ missing: true }, { fail: true }]) {
    const t = tx(options);
    await assert.rejects(t.repo.attestDrill(attestation));
    assert.deepEqual(t.events, ["begin", "rollback", "release"]);
  }
  for (const options of [{}, { fail: true }, { abortAfterFirst: new AbortController() }]) {
    const t = tx(options);
    const p = t.repo.recordView({
      ...ids,
      snapshot: base,
      evaluation: box.evaluate(base, policy, now),
      observedAt: now,
      signal: options.abortAfterFirst?.signal,
    });
    if (options.fail || options.abortAfterFirst) {
      await assert.rejects(p);
      assert.deepEqual(t.events, ["begin", "rollback", "release"]);
    } else {
      await p;
      assert.deepEqual(t.events, ["begin", "commit", "release"]);
      assert.equal(t.queries.length, 2);
    }
  }
  let passed;
  const service = (snapshot) =>
    new box.Service(
      {
        snapshot: async () => snapshot,
        attestDrill: async (v) => {
          passed = v;
          return result;
        },
      },
      policy,
      () => now,
    );
  for (const input of [
    { kind: "other" },
    { reason: "x" },
    { reason: "x".repeat(501) },
    { reason: 23 },
  ])
    await assert.rejects(
      service(base).attestDrill({ ...attestation, ...input }),
      (e) => e.statusCode === 400,
    );
  for (const snapshot of [
    null,
    { ...base, archive_verified: false },
    { ...base, recovery_verified: false },
  ])
    await assert.rejects(
      service(snapshot).attestDrill(attestation),
      (e) => e.code === "capacity_drill_not_verified",
    );
  await service({ ...base, observed_at: "2000-01-01T00:00:00Z", read_p95_ms: 99999 }).attestDrill(
    attestation,
  );
  assert.equal(passed.reason, "测试签认");
  assert.ok(!("snapshot" in passed));
  sourceChecks.push(
    "Actual service attestation guards kind/reason/recovery flags but accepts stale/performance-blocked flags-true snapshot and passes no observation ID. Actual repository inert transaction independently selects newest verified row, replays string/object, inserts three records, rolls back missing/audit failure; view writes two records with abort/rollback/release. Does not prove concurrency, row identity binding, durable idempotency, SQL or real recovery.",
  );

  const script = sources[3].split(/<script setup[^>]*>/)[1].split("</script>")[0];
  class Failure extends Error {
    constructor(kind, status = 503, code = "synthetic_error") {
      super(kind);
      this.kind = kind;
      this.status = status;
      this.code = code;
      this.requestId = "synthetic-error-id";
      this.actionHint = "隔离失败提示";
    }
  }
  function mount() {
    const calls = [],
      timers = [],
      hooks = {};
    const ctx = {
      Date,
      Error,
      Number,
      Math,
      Intl,
      AbortController,
      DOMException,
      crypto: { randomUUID },
      ref: (value) => ({ value }),
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
      defineProps: () => ({ apiBaseUrl: "/inert" }),
      ApiClientError: Failure,
      onMounted: (f) => {
        hooks.mount = f;
      },
      window: {
        setTimeout: (f, ms) => {
          timers.push({ f, ms });
          return timers.length;
        },
        clearTimeout: () => {},
      },
      createApiClient: () => (url, options) =>
        new Promise((resolve, reject) => {
          calls.push({ url, options, resolve, reject });
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("abort", "AbortError")),
          );
        }),
    };
    vm.createContext(ctx);
    vm.runInContext(
      compile(strip(script)) +
        "\nglobalThis.ui={load,attest,data,state,requestId,message,operationMessage,confirming,saving,refreshing,refreshFailure,verdict,boundaryHint,nextStageHint};",
      ctx,
    );
    return { ...ctx.ui, calls, timers, hooks };
  }
  for (const kind of [
    "expired",
    "forbidden",
    "rate_limited",
    "empty",
    "unavailable",
    "generic",
    "timeout",
  ])
    for (const retained of [false, true]) {
      const m = mount();
      if (retained) {
        m.data.value = datasets.ready;
        m.state.value = "ready";
        m.requestId.value = "previous-id";
      }
      const p = m.load();
      await m.load();
      assert.equal(m.calls.length, 1);
      assert.equal(m.calls[0].url, "/platform/operations/capacity");
      if (kind === "timeout") {
        assert.equal(m.timers[0].ms, 15000);
        m.timers[0].f();
      } else
        m.calls[0].reject(
          kind === "generic" ? new Error("inert") : new Failure(kind, kind === "empty" ? 404 : 503),
        );
      await p;
      assert.equal(Boolean(m.data.value), retained && !["expired", "forbidden"].includes(kind));
      if (retained && ["generic", "timeout"].includes(kind))
        assert.equal(m.requestId.value, "previous-id");
    }
  const empty = mount(),
    ep = empty.load();
  empty.calls[0].resolve({ data: null, request_id: "empty" });
  await ep;
  assert.equal(empty.state.value, "empty");
  assert.ok(!/onBeforeUnmount|onActivated/.test(script));
  for (const status of [0, 409, 401, 503]) {
    const m = mount();
    m.data.value = datasets.ready;
    m.state.value = "ready";
    let p = m.attest();
    await m.attest();
    assert.equal(m.calls.length, 1);
    const key = m.calls[0].options.idempotencyKey;
    assert.deepEqual(plain(m.calls[0].options.body), {
      kind: "archive_recovery",
      reason: "平台运维确认本轮单机容量收尾演练",
    });
    m.calls[0].reject(
      status === 0
        ? new Error("inert")
        : new Failure(status === 401 ? "expired" : "unavailable", status),
    );
    await p;
    assert.equal(Boolean(m.data.value), status !== 401);
    p = m.attest();
    assert.equal(m.calls[1].options.idempotencyKey, key);
    m.calls[1].reject(new Failure("unavailable"));
    await p;
  }
  const overlap = mount();
  overlap.data.value = datasets.ready;
  overlap.state.value = "ready";
  const ap = overlap.attest(),
    rp = overlap.load();
  assert.equal(overlap.calls.length, 2);
  overlap.calls[0].resolve({ data: result, request_id: "op-id" });
  await ap;
  assert.equal(overlap.calls.length, 2);
  overlap.calls[1].reject(new Failure("unavailable"));
  await rp;
  assert.match(overlap.operationMessage.value, /已签认/);
  assert.equal(overlap.requestId.value, "synthetic-error-id");
  const noData = mount(),
    np = noData.attest();
  assert.equal(noData.state.value, "verifying");
  noData.calls[0].reject(new Failure("unavailable", 409));
  await np;
  assert.equal(noData.operationMessage.value, "隔离失败提示");
  const words = mount();
  words.data.value = datasets["read-warning"];
  words.state.value = "warning";
  assert.match(words.verdict.value[1], /下一档/);
  sourceChecks.push(
    "Actual Vue script with inert request: GET single-flight/15s/null/auth clear/other failures retain, generic and timeout keep previous ID; POST exact fixed body, duplicate guard and same key after every failure including409/401, no-snapshot visible failure, concurrent GET suppresses success reload and overwrites operation ID. Metric-only warning still uses next-stage wording in source; no unmount/activation hook. Not mounted Vue or preserve-lifecycle proof.",
  );

  for (const token of [
    "platform:operate",
    "private, no-store",
    "14_000",
    "controller.abort(timeoutError)",
    "requireIdempotencyKey(r)",
    "r.headers.origin !== o.webOrigin",
    "kind: body.kind",
    "reason: body.reason",
  ])
    assert.ok(sources[2].includes(token));
  assert.ok(!sources[3].includes(":destructive="));
  assert.ok(sources[4].includes("cancelButton.value?.focus()"));
  assert.ok(sources[4].includes("returnFocus?.focus()"));
  sourceChecks.push(
    "Static route/shared consumers: private read, platform operate, same-origin and idempotency-key write, default14s read abort; one non-destructive confirm-word dialog, two request-details consumers and native finding disclosures. No real session/authorization/route handler or shared clipboard proof.",
  );
  const baseNode = ast(sources[7])
    .statements.filter(ts.isVariableStatement)
    .flatMap((s) => [...s.declarationList.declarations])
    .find((d) => d.name.getText() === "base");
  const original = vm.runInNewContext("(" + baseNode.initializer.getText() + ")");
  datasets.original = plain(original);
  labels.original = "独立历史E2E夹具";
  const confirmation = ast(sources[5])
    .statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === "canConfirm")
    .getFullText()
    .replace("export ", "");
  const logic = compile(confirmation + "\nwindow.CAPACITY_CONFIRM=canConfirm;");
  return {
    data: {
      clock,
      sourcePaths,
      sourceChecks,
      policy,
      datasets,
      labels,
      attestationBody: { kind: "archive_recovery", reason: "平台运维确认本轮单机容量收尾演练" },
      attestationResult: result,
      provenance:
        "Inert source outputs and independent historical E2E; not production measurements.",
    },
    logic,
  };
}
