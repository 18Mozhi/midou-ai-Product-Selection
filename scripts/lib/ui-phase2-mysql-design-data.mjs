import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

// Existing source, synthetic SQL rows and inert statfs; never a database or recovery run.
export async function buildMysqlDesignData(repo) {
  const sourcePaths = [
      "packages/database/src/index.ts",
      "apps/api/src/mysql-resilience-probe.ts",
      "apps/api/src/mysql-resilience-service.ts",
      "apps/api/src/mysql-resilience-repository.ts",
      "apps/api/src/mysql-resilience-routes.ts",
      "apps/web/src/components/MySqlResilienceCenter.vue",
      "apps/web/src/components/TechnicalDetails.vue",
      "tests/e2e/m08-03-mysql-resilience.spec.ts",
      "infra/baota/mysql-single-primary-manifest.json",
      "packages/config/src/index.ts",
    ],
    read = (f) => readFile(path.join(repo, f), "utf8"),
    plain = (v) => JSON.parse(JSON.stringify(v)),
    ast = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true),
    strip = (s) =>
      ast(s)
        .statements.filter((n) => !ts.isImportDeclaration(n))
        .map((n) => n.getFullText())
        .join("\n")
        .replaceAll("export ", ""),
    compile = (s) =>
      ts.transpileModule(s, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
      }).outputText;
  const source = await read(sourcePaths[0]),
    box = { Date, Number, Error };
  vm.createContext(box);
  vm.runInContext(
    compile(strip(source.slice(0, source.indexOf("export const migrationChecksum")))) +
      "\nglobalThis.evaluateMySqlResilience=evaluateMySqlResilience;",
    box,
  );
  vm.runInContext(
    compile(strip(await read(sourcePaths[2]))) + "\nglobalThis.Service=MySqlResilienceService;",
    box,
  );
  const now = new Date("2026-09-09T08:00:00.000Z"),
    ago = (minutes) => new Date(now.getTime() - minutes * 60000),
    policy = {
      connectionWarningBasisPoints: 7500,
      connectionStopBasisPoints: 9000,
      dataWarningBasisPoints: 7500,
      dataStopBasisPoints: 9000,
      slowQueryWarningPerMinute: 5,
      slowQueryStopPerMinute: 20,
      bufferPoolHitWarningBasisPoints: 9900,
      maximumRecoveryDrillAgeDays: 90,
      maximumRpoMinutes: 15,
      maximumRtoMinutes: 240,
    },
    datasets = {},
    labels = {},
    snapshots = {},
    probeSql = [];
  const pb = {
    Date,
    Number,
    Error,
    statfs: async () => ({ blocks: 100000, bsize: 4096, bavail: 60000 }),
  };
  vm.createContext(pb);
  vm.runInContext(
    compile(strip(await read(sourcePaths[1]))) + "\nglobalThis.Probe=MySqlResilienceProbe;",
    pb,
  );
  async function probe(mutate = () => {}) {
    const input = {
      variables: {
        version: "5.7.44",
        read_only: "OFF",
        log_bin: "ON",
        binlog_format: "ROW",
        binlog_ignore_db: "",
        innodb_flush_log_at_trx_commit: "2",
        sync_binlog: "1",
        innodb_buffer_pool_size: String(4 * 1073741824),
        max_connections: "512",
        long_query_time: "2",
        datadir: "synthetic-datadir",
      },
      status: {
        threads_connected: "20",
        threads_running: "2",
        slow_queries: "12",
        uptime: "3600",
        innodb_buffer_pool_reads: "1",
        innodb_buffer_pool_read_requests: "10000",
        innodb_buffer_pool_bytes_data: String(2 * 1073741824),
        innodb_log_waits: "0",
        innodb_row_lock_waits: "0",
      },
      master: [{}],
      replicas: [],
      previous: [{ slow_queries_total: 10, observed_at: ago(2) }],
      recovery: [
        {
          id: "synthetic-backup",
          run_type: "backup",
          status: "verified",
          actual_rpo_minutes: 1,
          encrypted: 1,
          integrity_verified: 1,
        },
        {
          id: "synthetic-drill",
          run_type: "restore_drill",
          status: "verified",
          actual_rto_minutes: 3,
          finished_at: ago(1440),
          isolated: 1,
          encrypted: 1,
          integrity_verified: 1,
          permission_boundary_verified: 1,
          audit_chain_verified: 1,
          evidence_hash_verified: 1,
        },
      ],
      assets: [
        { asset_kind: "mysql_full", encrypted: 1, integrity_verified: 1 },
        { asset_kind: "mysql_binlog", encrypted: 1, integrity_verified: 1 },
      ],
    };
    mutate(input);
    const pool = {
      query: async (sql, params) => {
        probeSql.push(sql);
        if (sql.startsWith("SHOW GLOBAL VARIABLES"))
          return [params.map((k) => ({ Variable_name: k, Value: input.variables[k] }))];
        if (sql.startsWith("SHOW GLOBAL STATUS"))
          return [params.map((k) => ({ Variable_name: k, Value: input.status[k.toLowerCase()] }))];
        if (sql === "SHOW MASTER STATUS") return [input.master];
        if (sql === "SHOW SLAVE STATUS") return [input.replicas];
        if (sql.includes("SELECT slow_queries_total")) return [input.previous];
        if (sql.includes("FROM backup_recovery_runs")) return [input.recovery];
        if (sql.includes("FROM backup_recovery_assets")) return [input.assets];
        throw new Error("Unexpected inert SQL");
      },
    };
    return plain(await new pb.Probe(pool, () => now).snapshot());
  }
  const base = await probe();
  assert.equal(base.slowQueriesPerMinute, 1);
  assert.equal(base.bufferPoolHitRateBasisPoints, 9999);
  assert.equal(base.backupStatus, "verified");
  async function add(k, label, snapshot = base, patch = {}) {
    let writes = 0;
    snapshots[k] = plain(snapshot);
    datasets[k] = plain(
      await new box.Service(
        { snapshot: async () => snapshot },
        { record: async () => writes++ },
        { ...policy, ...patch },
        () => now,
      ).read({ actorId: "synthetic", requestId: "synthetic", traceId: "synthetic" }),
    );
    labels[k] = label;
    assert.equal(writes, 1);
  }
  await add("ready", "单主运行与恢复证据齐备");
  const cases = [
    [
      "availability-boundary",
      "available=false评估边界（非探针回退）",
      "available",
      false,
      "mysql_unavailable",
    ],
    ["version", "版本不符合5.7", "version", "8.0.synthetic", "mysql_version_incompatible"],
    ["read-only", "主库只读", "readOnly", true, "mysql_primary_read_only"],
    ["binlog-off", "未启用binlog", "logBinEnabled", false, "mysql_binlog_disabled"],
    ["format", "日志非ROW", "binlogFormat", "MIXED", "mysql_binlog_format_invalid"],
    [
      "excluded",
      "业务库被排除",
      "productDatabaseBinlogExcluded",
      true,
      "mysql_product_database_binlog_excluded",
    ],
    ["flush", "刷盘合同不符", "innodbFlushLogAtTrxCommit", 1, "mysql_flush_contract_invalid"],
    ["sync", "同步合同不符", "syncBinlog", 0, "mysql_sync_binlog_invalid"],
    ["master", "主状态不可用", "masterStatusAvailable", false, "mysql_master_status_unavailable"],
    ["replica", "发现非预期副本", "replicaConfigured", true, "mysql_replica_unexpected"],
    ["connections-unbounded", "连接上限未设置", "maxConnections", 0, "mysql_connections_unbounded"],
    [
      "capacity-unknown",
      "数据盘容量未知",
      "dataFilesystemTotalBytes",
      0,
      "mysql_data_capacity_unknown",
    ],
    ["slow-warning", "慢查询预警边界", "slowQueriesPerMinute", 5, "mysql_slow_query_warning"],
    ["slow-stop", "慢查询停止边界", "slowQueriesPerMinute", 20, "mysql_slow_query_stop"],
    [
      "buffer-warning",
      "缓冲命中低于99%",
      "bufferPoolHitRateBasisPoints",
      9899,
      "mysql_buffer_pool_hit_warning",
    ],
    ["log-waits", "累计日志等待非零", "innodbLogWaits", 1, "mysql_innodb_log_waits"],
    ["row-waits", "累计行锁等待非零", "innodbRowLockWaits", 23, "mysql_row_lock_waits"],
    ["rpo-null", "RPO未记录", "actualRpoMinutes", null, "mysql_rpo_exceeded"],
    ["rto-null", "RTO未记录", "actualRtoMinutes", null, "mysql_rto_exceeded"],
    ["age-null", "演练年龄未记录", "recoveryDrillAgeDays", null, "mysql_recovery_stale"],
  ];
  for (const [k, label, field, v, code] of cases) {
    await add(k, label, { ...base, [field]: v });
    assert.ok(
      datasets[k].findings.some((f) => f.code === code),
      k,
    );
  }
  for (const [k, label, patch] of [
    ["connections-warning", "连接75%边界", { maxConnections: 100, threadsConnected: 75 }],
    ["connections-stop", "连接90%边界", { maxConnections: 100, threadsConnected: 90 }],
    [
      "storage-warning",
      "数据盘75%边界",
      { dataFilesystemTotalBytes: 10000, dataFilesystemAvailableBytes: 2500 },
    ],
    [
      "storage-stop",
      "数据盘90%边界",
      { dataFilesystemTotalBytes: 10000, dataFilesystemAvailableBytes: 1000 },
    ],
    [
      "storage-over",
      "可用空间异常负值",
      { dataFilesystemTotalBytes: 10000, dataFilesystemAvailableBytes: -100 },
    ],
    [
      "zero-values",
      "真实零用量与零耗时",
      {
        threadsConnected: 0,
        threadsRunning: 0,
        slowQueriesPerMinute: 0,
        actualRpoMinutes: 0,
        actualRtoMinutes: 0,
      },
    ],
    [
      "negative-recovery",
      "源返回负RPO/RTO仍可能ready",
      { actualRpoMinutes: -1, actualRtoMinutes: -2 },
    ],
    ["long", "长日志格式值", { binlogFormat: "synthetic-long-binlog-format-".repeat(18) }],
  ])
    await add(k, label, { ...base, ...patch });
  const probeCases = [
    ["interval-short", "短间隔按至少一分钟分母", (x) => (x.previous[0].observed_at = ago(0.1))],
    ["no-previous", "没有上次观测用uptime平均", (x) => (x.previous = [])],
    ["counter-reset", "慢查询累计计数下降", (x) => (x.status.slow_queries = "1")],
    [
      "no-buffer-requests",
      "零缓冲请求回退100%",
      (x) => (x.status.innodb_buffer_pool_read_requests = "0"),
    ],
    ["recovery-empty", "没有返回恢复记录", (x) => (x.recovery = [])],
    ["asset-missing", "恢复副本缺binlog资产", (x) => x.assets.pop()],
    ["drill-not-isolated", "演练未隔离", (x) => (x.recovery[1].isolated = 0)],
    [
      "drill-stale",
      "超过90天但显示取整90.00",
      (x) => (x.recovery[1].finished_at = ago(90.001 * 1440)),
    ],
    ["drill-boundary", "恰好90天", (x) => (x.recovery[1].finished_at = ago(90 * 1440))],
    ["drill-future", "未来时间归零年龄", (x) => (x.recovery[1].finished_at = ago(-1440))],
    ["probe-null-rpo", "探针verified但RPO为空", (x) => (x.recovery[0].actual_rpo_minutes = null)],
    ["rpo-probe-stop", "探针固定RPO15分钟之外", (x) => (x.recovery[0].actual_rpo_minutes = 16)],
    ["rto-probe-stop", "探针固定RTO240分钟之外", (x) => (x.recovery[1].actual_rto_minutes = 241)],
    [
      "twenty-drills",
      "最近20条只有演练",
      (x) =>
        (x.recovery = Array.from({ length: 20 }, (_, i) => ({
          ...x.recovery[1],
          id: "synthetic-drill-" + i,
        }))),
    ],
  ];
  for (const [k, label, mutate] of probeCases) await add(k, label, await probe(mutate));
  await add("policy-stricter", "运行policy比探针更严格", base, {
    maximumRpoMinutes: 0,
    maximumRtoMinutes: 2,
  });
  await add("policy-relaxed", "放宽运行policy仍不能绕过探针", snapshots["rpo-probe-stop"], {
    maximumRpoMinutes: 30,
  });
  assert.equal(datasets["interval-short"].slow_queries.per_minute, 2);
  assert.equal(datasets["no-previous"].slow_queries.per_minute, 0.2);
  assert.equal(datasets["counter-reset"].slow_queries.per_minute, 0);
  assert.equal(datasets["no-buffer-requests"].io.buffer_pool_hit_rate_basis_points, 10000);
  assert.equal(datasets["drill-stale"].recovery.drill_age_days, 90);
  assert.equal(datasets["drill-stale"].recovery.status, "stale");
  assert.equal(datasets["drill-boundary"].state, "ready");
  assert.equal(datasets["drill-future"].recovery.drill_age_days, 0);
  assert.equal(datasets["probe-null-rpo"].recovery.status, "verified");
  assert.equal(datasets["probe-null-rpo"].state, "blocked");
  assert.equal(datasets["negative-recovery"].state, "ready");
  assert.equal(datasets["policy-relaxed"].state, "blocked");
  assert.ok(probeSql.some((s) => s.includes("ORDER BY started_at DESC LIMIT 20")));
  const fixture = ast(await read(sourcePaths[7])).statements;
  datasets.original = plain(
    vm.runInNewContext(
      compile(
        fixture
          .slice(
            0,
            fixture.findIndex((n) => ts.isFunctionDeclaration(n)),
          )
          .filter((n) => !ts.isImportDeclaration(n))
          .map((n) => n.getFullText())
          .join("\n"),
      ) + "\nbase;",
    ),
  );
  labels.original = "原始历史E2E夹具";
  for (const [k, d] of Object.entries(datasets)) {
    assert.ok(!JSON.stringify(d).includes("synthetic-datadir"), k);
    for (const f of ["version", "readOnly", "replicaConfigured", "masterStatusAvailable"])
      assert.ok(!(f in d), k);
  }
  const sourceChecks = [
    "Actual probe with inert SHOW/history/recovery/asset rows and statfs: interval>=1-minute versus uptime slow-rate, nonnegative delta/reset, zero requests->10000 hit-rate, 20-row query and full/binlog recovery-copy requirements, isolation, fixed15/240/90, null numeric intermediate versus null DTO, future age clamping/two-decimal round. No real filesystem or SQL executed.",
    "Actual evaluator/service: 5.7/write/binlog/ROW/exclusion/flush2/sync1/master/no replica, independent resource thresholds, cumulative waits, recovery missing/stale/unknown, clamped storage and raw negative recovery, stricter/relaxed policy versus fixed probe state; public DTO excludes raw identity/paths/SQL. Original E2E kept separate.",
  ];
  const uiSource = await read(sourcePaths[5]),
    script = uiSource.split(/<script setup[^>]*>/)[1].split("</script>")[0],
    ref = (value) => ({ value }),
    computed = (fn) => ({
      get value() {
        return fn();
      },
    }),
    decl = ast(script)
      .statements.filter(
        (n) =>
          ts.isVariableStatement(n) &&
          ["findingSeverity", "slowQueryImpact", "rowLockImpact"].includes(
            n.declarationList.declarations[0].name.getText(),
          ),
      )
      .map((n) => n.getFullText())
      .join("\n"),
    logic = compile(
      `window.MYSQL_LOGIC=function(value){const data={value};const computed=fn=>({get value(){return fn()}});${decl}\nreturn {findingSeverity,slowQueryImpact:slowQueryImpact.value,rowLockImpact:rowLockImpact.value};};`,
    );
  class Failure extends Error {
    constructor(kind) {
      super(kind);
      this.kind = kind;
      this.requestId = "synthetic-failure";
      this.actionHint = "隔离失败";
    }
  }
  function mount() {
    const calls = [],
      timers = [],
      hooks = {},
      ctx = {
        Date,
        Number,
        Error,
        DOMException,
        AbortController,
        crypto: { randomUUID },
        ref,
        computed,
        defineProps: () => ({ apiBaseUrl: "/inert" }),
        ApiClientError: Failure,
        onMounted: (f) => (hooks.mount = f),
        onBeforeUnmount: (f) => (hooks.unmount = f),
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
            options.signal.addEventListener("abort", () =>
              reject(new DOMException("abort", "AbortError")),
            );
          }),
      };
    vm.createContext(ctx);
    vm.runInContext(
      compile(strip(script)) + "\nglobalThis.ui={load,data,state,refreshFailure,requestId};",
      ctx,
    );
    return { ...ctx.ui, calls, timers, hooks };
  }
  for (const kind of ["expired", "forbidden", "rate_limited", "unavailable", "timeout", "generic"])
    for (const retained of [false, true]) {
      const m = mount();
      if (retained) {
        const p = m.load();
        m.calls[0].resolve({ data: datasets.ready, request_id: "synthetic-success" });
        await p;
      }
      const p = m.load();
      await m.load();
      assert.equal(m.calls.length, retained ? 2 : 1);
      assert.equal(m.calls.at(-1).url, "/platform/operations/mysql");
      assert.equal(m.calls.at(-1).options.requestId, m.calls.at(-1).options.traceId);
      if (kind === "timeout") {
        assert.equal(m.timers.at(-1).ms, 15000);
        m.timers.at(-1).f();
      } else m.calls.at(-1).reject(kind === "generic" ? new Error("inert") : new Failure(kind));
      await p;
      const keep = retained && !["expired", "forbidden"].includes(kind);
      assert.equal(Boolean(m.data.value), keep);
      assert.equal(
        keep ? m.refreshFailure.value : m.state.value,
        kind === "generic" ? "unavailable" : kind,
      );
      if (kind === "generic") assert.equal(m.requestId.value, "");
    }
  const em = mount(),
    ep = em.load();
  em.calls[0].resolve({ data: null, request_id: "synthetic-empty" });
  await ep;
  assert.equal(em.state.value, "empty");
  const um = mount(),
    up = um.load();
  um.hooks.unmount();
  await up;
  assert.equal(um.data.value, null);
  sourceChecks.push(
    "Actual Vue script: single-flight exact GET/IDs, 15s, null empty, auth clearing/transient retention, generic empty requestID and unmount abort. Severity/row-lock/slow-query helpers extracted from source; new prototype qualifies slow-rate window rather than copying unproven current-window claims. Not mounted Vue/preserve or shared clipboard proof.",
  );
  for (const phase of ["before", "probe", "record"]) {
    const c = new AbortController();
    let records = 0,
      probes = 0;
    if (phase === "before") c.abort();
    const service = new box.Service(
      {
        snapshot: async () => {
          probes++;
          if (phase === "probe") c.abort();
          return base;
        },
      },
      {
        record: async () => {
          records++;
          if (phase === "record") c.abort();
        },
      },
      policy,
      () => now,
    );
    await assert.rejects(
      service.read({ actorId: "x", requestId: "x", traceId: "x", signal: c.signal }),
    );
    assert.equal(probes, phase === "before" ? 0 : 1);
    assert.equal(records, phase === "record" ? 1 : 0);
  }
  const rb = { randomUUID, Date };
  vm.createContext(rb);
  vm.runInContext(
    compile(strip(await read(sourcePaths[3]))) + "\nglobalThis.Repo=MySqlResilienceRepository;",
    rb,
  );
  for (const phase of ["success", "audit-fail", "abort-after-first"]) {
    const events = [],
      c = new AbortController();
    let inserts = 0;
    const connection = {
      beginTransaction: async () => events.push("begin"),
      query: async (sql) => {
        inserts++;
        if (phase === "audit-fail" && sql.includes("platform_audit_events"))
          throw new Error("inert audit");
        if (phase === "abort-after-first" && inserts === 1) c.abort();
      },
      commit: async () => events.push("commit"),
      rollback: async () => events.push("rollback"),
      release: () => events.push("release"),
    };
    const p = new rb.Repo({ getConnection: async () => connection }).record({
      actorId: "x",
      requestId: "x",
      traceId: "x",
      observedAt: now,
      snapshot: base,
      evaluation: box.evaluateMySqlResilience(base, policy),
      signal: c.signal,
    });
    if (phase === "success") await p;
    else await assert.rejects(p);
    assert.deepEqual(
      events,
      phase === "success" ? ["begin", "commit", "release"] : ["begin", "rollback", "release"],
    );
    assert.equal(inserts, phase === "abort-after-first" ? 1 : 3);
  }
  sourceChecks.push(
    "Actual service abort checkpoints before/after probe and after record; actual repository inert connection verifies three inserts/commit, audit-fail rollback and abort after first insert rollback/release. Probe has no signal; cancellation after record may occur after its work. No running-SQL interruption, real durability or transaction proof.",
  );
  class ApiFailure extends Error {
    constructor(status, code) {
      super(code);
      this.statusCode = status;
      this.code = code;
    }
  }
  const routeBox = {
    AbortController,
    ApiError: ApiFailure,
    sessionToken: () => "inert",
    setTimeout: (f, ms) => {
      routeBox.timer = { f, ms };
      return 1;
    },
    clearTimeout: () => (routeBox.cleared = true),
  };
  vm.createContext(routeBox);
  vm.runInContext(
    compile(strip(await read(sourcePaths[4]))) +
      "\nglobalThis.register=registerMySqlResilienceRoutes;",
    routeBox,
  );
  for (const outcome of ["success", "timeout", "dependency", "forbidden"]) {
    let handler,
      input,
      called = 0;
    const raw = new EventEmitter();
    raw.writableEnded = false;
    const reply = {
        raw,
        header: (k, v) => {
          assert.equal(k, "cache-control");
          assert.equal(v, "private, no-store");
        },
      },
      events = [];
    routeBox.timer = null;
    routeBox.cleared = false;
    routeBox.register(
      {
        get: (p, h) => {
          assert.equal(p, "/api/v1/platform/operations/mysql");
          handler = h;
        },
      },
      {
        auth: {
          authenticate: async () => {
            events.push("auth");
            return { user: { id: "synthetic" } };
          },
        },
        authorization: {
          authorize: async (args) => {
            events.push("authorize");
            assert.equal(args.capability, "platform:operate");
            if (outcome === "forbidden") throw new ApiFailure(403, "forbidden");
          },
        },
        service: {
          read: async (args) => {
            called++;
            input = args;
            if (outcome === "dependency")
              throw Object.assign(new Error("inert"), { code: "ER_SYNTHETIC" });
            if (outcome === "timeout") return new Promise(() => {});
            return datasets.ready;
          },
        },
        secureCookie: false,
      },
    );
    const p = handler({ headers: { "x-request-id": "req", "x-trace-id": "trace" } }, reply);
    if (outcome === "timeout") {
      for (let i = 0; i < 8 && !routeBox.timer; i++) await Promise.resolve();
      assert.equal(routeBox.timer.ms, 14000);
      routeBox.timer.f();
      await assert.rejects(p, (e) => e.code === "mysql_resilience_read_timeout");
      assert.equal(input.signal.aborted, true);
    } else if (outcome === "dependency")
      await assert.rejects(p, (e) => e.code === "mysql_resilience_dependency_unavailable");
    else if (outcome === "forbidden") {
      await assert.rejects(p);
      assert.equal(called, 0);
    } else {
      assert.equal((await p).request_id, "req");
      assert.equal(input.traceId, "trace");
    }
    assert.deepEqual(events, ["auth", "authorize"]);
    raw.writableEnded = true;
    raw.emit("finish");
    assert.equal(raw.listenerCount("close"), 0);
  }
  sourceChecks.push(
    "Actual route handler with inert auth/service/timers/events: exact private GET and operate guard before service, default14s race abort, dependency503, correlation and finish cleanup. No real session/RBAC server, socket disconnect or production request executed.",
  );
  return {
    data: {
      sourcePaths,
      sourceChecks,
      datasets,
      labels,
      clock: now.toISOString(),
      provenance:
        "Synthetic source outputs; original E2E independent; no live database/recovery observations.",
    },
    logic,
  };
}
