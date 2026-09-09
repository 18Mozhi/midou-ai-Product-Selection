import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import ts from "typescript";

// Existing source functions, synthetic rows and inert dependencies; no deployment/probe calls.
export async function buildReleaseDesignData(repo) {
  const sourcePaths = [
    "apps/web/src/components/ReleaseRolloutCenter.vue",
    "apps/web/src/components/ResponsiveDataView.vue",
    "apps/web/src/components/TableViewControls.vue",
    "apps/web/src/components/TechnicalDetails.vue",
    "apps/web/src/api-client.ts",
    "apps/api/src/release-rollout-service.ts",
    "apps/api/src/mysql-release-rollout-repository.ts",
    "apps/api/src/release-rollout-routes.ts",
    "config/route-catalog.json",
    "packages/config/src/index.ts",
    "tests/e2e/m07-05-release-rollout.spec.ts",
    "apps/api/src/bootstrap/register-operations-domain.ts",
    "infra/baota/service-manifest.json",
  ];
  const read = (f) => readFile(path.join(repo, f), "utf8"),
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
  const serviceSource = await read(sourcePaths[5]),
    initializers = {};
  function visit(n) {
    if (ts.isVariableDeclaration(n) && ["gatePassed", "finiteMetric"].includes(n.name.getText()))
      initializers[n.name.getText()] = n.initializer.getText();
    ts.forEachChild(n, visit);
  }
  visit(ast(serviceSource));
  assert.equal(Object.keys(initializers).length, 2);
  const logic = compile(
    `window.RELEASE_LOGIC={gatePassed:function(gate,p){const thresholds={errorRateStopPercent:p.error_rate_stop_percent,readP95StopMs:p.read_p95_stop_ms,writeP95StopMs:p.write_p95_stop_ms,asyncLagStopSeconds:p.async_lag_stop_seconds};return(function(){const finiteMetric=${initializers.finiteMetric};const gatePassed=${initializers.gatePassed};return gatePassed(gate);}).call({policy:{minimumObservationSeconds:p.minimum_observation_seconds}});}};`,
  );
  const b = { Date, Number, Error };
  vm.createContext(b);
  vm.runInContext(compile(strip(serviceSource)) + "\nglobalThis.Service=ReleaseRolloutService;", b);
  const now = new Date("2026-09-09T04:00:00.000Z"),
    ago = (min) => new Date(now.getTime() - min * 60000).toISOString(),
    shaA = "a".repeat(40),
    shaB = "b".repeat(40),
    policy = {
      percentages: [5, 25, 100],
      minimumObservationSeconds: 1800,
      maximumEvidenceAgeMinutes: 30,
      currentBuildSha: shaA,
      currentAppVersion: "0.1.0",
      currentConfigFingerprint: "f".repeat(64),
      sourceLocalSha: shaA,
      sourceRemoteSha: shaA,
      sourceRemoteBranch: "main",
      sourceRepository: "synthetic/release-review",
      sourceMigrationVersion: "synthetic_migration.up.sql",
    },
    release = {
      id: "synthetic-current",
      stage: "S0",
      app_version: "0.1.0",
      build_sha: shaA,
      config_fingerprint: "f".repeat(64),
      migration_version: "synthetic_migration.up.sql",
      status: "healthy",
      approved_by: "synthetic-operator",
      request_id: "synthetic-release-request",
      trace_id: "synthetic-release-trace",
      started_at: ago(100),
      finished_at: ago(5),
      created_at: ago(100),
      updated_at: ago(5),
    },
    gate = (kind, i = 0) => ({
      id: "synthetic-" + kind,
      release_id: release.id,
      gate_kind: kind,
      status: "passed",
      traffic_percent: Number(kind.split("_")[1]) || 0,
      observe_seconds: 1800,
      sample_count: 20 + i * 15,
      error_rate_percent: 0,
      read_p95_ms: 100,
      write_p95_ms: 200,
      async_lag_seconds: 2,
      failure_code: null,
      started_at: ago(95 - i * 30),
      finished_at: ago(65 - i * 30),
      request_id: "synthetic-gate-request",
      trace_id: "synthetic-gate-trace",
      metadata: { synthetic_not_public: true },
    }),
    timed = (kind, status = "passed") => ({
      ...gate(kind),
      status,
      observe_seconds: 0,
      sample_count: 0,
      error_rate_percent: null,
      read_p95_ms: null,
      write_p95_ms: null,
      async_lag_seconds: null,
      started_at: ago(98),
      finished_at: new Date(Date.parse(ago(98)) + 1250).toISOString(),
      metadata: { timing_schema: 2, synthetic_not_public: true },
    }),
    gates = [...[5, 25, 100].map((p, i) => gate("canary_" + p, i)), timed("migration")],
    datasets = {},
    labels = {};
  async function add(key, label, mutate = () => {}, patch = {}) {
    const result = plain({ releases: [release], gates });
    mutate(result);
    datasets[key] = plain(
      await new b.Service({ read: async () => result }, { ...policy, ...patch }, () => now).read({
        actorId: "synthetic-operator",
        requestId: "synthetic-request",
        traceId: "synthetic-trace",
      }),
    );
    labels[key] = label;
  }
  await add("verified", "当前SHA匹配历史门");
  await add("empty", "没有发布记录", (r) => {
    r.releases = [];
    r.gates = [];
  });
  await add("current-missing", "当前SHA没有匹配证据", () => {}, {
    currentBuildSha: shaB,
    sourceLocalSha: shaB,
    sourceRemoteSha: shaB,
  });
  await add("newest-other", "最近历史记录不是当前SHA", (r) =>
    r.releases.unshift({
      ...release,
      id: "synthetic-newer-other",
      build_sha: shaB,
      started_at: ago(1),
      finished_at: ago(0.5),
    }),
  );
  await add("identity-app", "应用版本不同源", () => {}, { currentAppVersion: "0.2.0" });
  await add("identity-config", "配置指纹不同源", () => {}, {
    currentConfigFingerprint: "e".repeat(64),
  });
  await add("identity-migration", "迁移不同源", () => {}, {
    sourceMigrationVersion: "synthetic_next.up.sql",
  });
  await add("source-mismatch", "部署捕获SHA不一致", () => {}, { sourceRemoteSha: shaB });
  await add("source-fallback", "来源SHA缺失回退", () => {}, {
    sourceLocalSha: undefined,
    sourceRemoteSha: undefined,
    sourceRepository: undefined,
    sourceRemoteBranch: undefined,
  });
  await add("missing-current-policy", "服务未传运行SHA回退历史", () => {}, {
    currentBuildSha: undefined,
  });
  await add(
    "missing-gate",
    "缺25%观察门",
    (r) => (r.gates = r.gates.filter((g) => g.gate_kind !== "canary_25")),
  );
  await add("no-gates", "没有匹配门记录", (r) => (r.gates = []));
  await add("pending", "发布状态待观察", (r) => (r.releases[0].status = "pending"));
  await add("gate-pending", "门状态待观察", (r) => (r.gates[1].status = "pending"));
  await add("status-stopped", "发布failed但无自动停止门", (r) => (r.releases[0].status = "failed"));
  await add("stopped", "存在自动停止门", (r) => r.gates.push(timed("automatic_stop", "stopped")));
  await add(
    "status-rollback",
    "发布rolled_back但无回滚门",
    (r) => (r.releases[0].status = "rolled_back"),
  );
  await add("rolled_back", "回滚门与真实计时", (r) =>
    r.gates.push(timed("rollback", "rolled_back")),
  );
  await add(
    "identity-before-rollback",
    "身份阻断优先于回滚门",
    (r) => r.gates.push(timed("rollback", "rolled_back")),
    { currentAppVersion: "0.2.0" },
  );
  await add("rollback-before-stop", "回滚优先于自动停止", (r) =>
    r.gates.push(timed("rollback", "rolled_back"), timed("automatic_stop", "stopped")),
  );
  for (const [key, label, field, value] of [
    ["error-equal", "错误率等于阈值仍阻断", "error_rate_percent", 1],
    ["error-under", "错误率略低于阈值", "error_rate_percent", 0.999],
    ["read-equal", "读取P95等于阈值", "read_p95_ms", 300],
    ["read-over", "读取P95超过阈值", "read_p95_ms", 301],
    ["write-over", "写入P95超过阈值", "write_p95_ms", 601],
    ["lag-over", "异步延迟超过阈值", "async_lag_seconds", 61],
    ["missing-metric", "指标空值不是0", "read_p95_ms", null],
    ["non-finite", "非有限指标", "read_p95_ms", "invalid"],
    ["negative-metric", "负数指标保留", "read_p95_ms", -1],
    ["zero-samples", "样本数为0", "sample_count", 0],
    ["zero-traffic", "实际流量为0", "traffic_percent", 0],
    ["wrong-traffic", "流量值不等于门标签", "traffic_percent", 3],
    ["short-observe", "观察时长少1秒", "observe_seconds", 1799],
  ])
    await add(key, label, (r) => (r.gates[0][field] = value));
  await add("all-zero-metrics", "四项指标为0", (r) =>
    r.gates
      .filter((g) => g.gate_kind.startsWith("canary_"))
      .forEach((g) => {
        g.error_rate_percent = 0;
        g.read_p95_ms = 0;
        g.write_p95_ms = 0;
        g.async_lag_seconds = 0;
      }),
  );
  await add("stale", "最新完成证据超过30分钟", (r) =>
    r.gates.slice(0, 3).forEach((g, i) => (g.finished_at = ago(91 - i * 30))),
  );
  await add("age-exact", "恰好达到30分钟", (r) =>
    r.gates.slice(0, 3).forEach((g) => (g.finished_at = ago(30))),
  );
  await add("no-finish", "所有门完成时间缺失", (r) =>
    r.gates.slice(0, 3).forEach((g) => (g.finished_at = null)),
  );
  await add("future-finish", "门完成时间在未来", (r) => (r.gates[2].finished_at = ago(-1)));
  await add("duplicate-first-failed", "重复门首条失败", (r) =>
    r.gates.unshift({ ...r.gates[0], id: "synthetic-duplicate", status: "failed" }),
  );
  await add("extra-gate", "非策略要求的额外门", (r) => r.gates.push(gate("canary_50")));
  await add(
    "zero-duration",
    "迁移耗时0毫秒",
    (r) => (r.gates[3].finished_at = r.gates[3].started_at),
  );
  await add("legacy-duration", "旧计时协议不显示0", (r) => {
    r.gates[3].metadata = { timing_schema: 1 };
    r.gates[3].finished_at = r.gates[3].started_at;
  });
  await add("reverse-duration", "逆序时间区间未知", (r) => (r.gates[3].finished_at = ago(99)));
  await add("missing-duration", "不完整时间区间未知", (r) => (r.gates[3].started_at = null));
  await add(
    "long",
    "长版本仓库迁移和代码",
    (r) => {
      r.gates[0].failure_code = "synthetic-long-code-".repeat(15);
      r.releases[0].migration_version = "synthetic_".repeat(24) + ".up.sql";
    },
    {
      sourceRepository: "synthetic/" + "very-long-repository-".repeat(20),
      sourceMigrationVersion: "synthetic_".repeat(24) + ".up.sql",
    },
  );
  const fixtureStatements = ast(await read(sourcePaths[10])).statements;
  const end = fixtureStatements.findIndex((s) => ts.isFunctionDeclaration(s));
  const fixtureCode = fixtureStatements
    .slice(0, end)
    .filter((s) => !ts.isImportDeclaration(s))
    .map((s) => s.getFullText())
    .join("\n");
  const original = vm.runInNewContext(compile(fixtureCode) + "\n({...base,state:'verified'});");
  datasets.original = plain(original);
  labels.original = "原始E2E部分且矛盾夹具";
  const expectState = (keys, state) =>
    keys.forEach((k) => assert.equal(datasets[k].state, state, k));
  expectState(
    [
      "verified",
      "source-fallback",
      "missing-current-policy",
      "error-under",
      "read-equal",
      "all-zero-metrics",
      "negative-metric",
      "wrong-traffic",
      "age-exact",
      "no-finish",
      "future-finish",
      "extra-gate",
      "zero-duration",
      "legacy-duration",
      "reverse-duration",
      "missing-duration",
      "newest-other",
    ],
    "verified",
  );
  expectState(
    [
      "current-missing",
      "identity-app",
      "identity-config",
      "identity-migration",
      "source-mismatch",
      "missing-gate",
      "no-gates",
      "pending",
      "gate-pending",
      "identity-before-rollback",
      "error-equal",
      "read-over",
      "write-over",
      "lag-over",
      "missing-metric",
      "non-finite",
      "zero-samples",
      "zero-traffic",
      "short-observe",
      "duplicate-first-failed",
    ],
    "blocked",
  );
  expectState(["stopped", "status-stopped"], "stopped");
  expectState(["rolled_back", "status-rollback", "rollback-before-stop"], "rolled_back");
  expectState(["stale"], "stale");
  expectState(["empty"], "empty");
  assert.equal(datasets["source-fallback"].versions.remote.build_sha, shaA);
  assert.equal(datasets["current-missing"].gates.length, 0);
  assert.equal(datasets["status-stopped"].automatic_stop_verified, false);
  assert.equal(datasets["status-rollback"].rollback_verified, false);
  for (const [k, n] of [
    ["verified", 1250],
    ["zero-duration", 0],
    ["legacy-duration", null],
    ["reverse-duration", null],
    ["missing-duration", null],
  ])
    assert.equal(datasets[k].gates.find((g) => g.gate_kind === "migration").duration_ms, n);
  for (const [key, d] of Object.entries(datasets).filter(([k]) => k !== "original"))
    assert.ok(
      d.gates.every((g) => !("metadata" in g)),
      key,
    );
  const logicBox = { window: {}, Number };
  vm.createContext(logicBox);
  vm.runInContext(logic, logicBox);
  assert.equal(
    logicBox.window.RELEASE_LOGIC.gatePassed(
      datasets["error-equal"].gates[0],
      datasets.verified.policy,
    ),
    false,
  );
  assert.equal(
    logicBox.window.RELEASE_LOGIC.gatePassed(
      datasets["missing-metric"].gates[0],
      datasets.verified.policy,
    ),
    false,
  );
  assert.equal(
    logicBox.window.RELEASE_LOGIC.gatePassed(
      datasets["read-equal"].gates[0],
      datasets.verified.policy,
    ),
    true,
  );
  const sourceChecks = [
    "Actual ReleaseRolloutService with inert rows: six states, current vs newest historical selection, five blocker codes, source fallback, identity/rollback/stop priority, strict error and inclusive latency thresholds, sample/traffic/observation limits, null/nonfinite/negative metrics, missing/future finish and latest-finish age, duplicate first-match/extra gates, timing_schema2 zero/legacy/reversed/incomplete intervals, metadata removed. Browser gate condition is extracted from the same source; no release execution.",
  ];
  const uiSource = await read(sourcePaths[0]),
    script = uiSource.split(/<script setup[^>]*>/)[1].split("</script>")[0];
  class Failure extends Error {
    constructor(kind) {
      super(kind);
      this.kind = kind;
      this.requestId = "synthetic-failure";
      this.actionHint = "隔离读取提示";
    }
  }
  const ref = (v) => ({ value: v }),
    computed = (fn) => ({
      get value() {
        return fn();
      },
    });
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
        defineProps: () => ({ apiBaseUrl: "/inert", capabilities: [] }),
        ApiClientError: Failure,
        onMounted: (fn) => (hooks.mount = fn),
        onBeforeUnmount: (fn) => (hooks.unmount = fn),
        window: {
          setTimeout: (fn, ms) => {
            timers.push({ fn, ms });
            return timers.length;
          },
          clearTimeout: () => {},
        },
        createApiClient: () => (url, options) =>
          new Promise((resolve, reject) => {
            calls.push({ url, options, resolve, reject });
            options.signal.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      };
    vm.createContext(ctx);
    vm.runInContext(
      compile(strip(script)) +
        "\nglobalThis.ui={load,data,state,refreshFailure,refreshing,duration,sha,statusText,gate};",
      ctx,
    );
    return { ...ctx.ui, calls, timers, hooks };
  }
  for (const kind of ["expired", "forbidden", "rate_limited", "unavailable", "timeout"]) {
    for (const retained of [false, true]) {
      const m = mount();
      if (retained) {
        const p = m.load();
        m.calls[0].resolve({ data: datasets.verified, request_id: "synthetic-ok" });
        await p;
      }
      const p = m.load();
      await m.load();
      assert.equal(m.calls.length, retained ? 2 : 1);
      assert.equal(m.calls.at(-1).url, "/platform/operations/releases");
      assert.equal(m.calls.at(-1).options.requestId, m.calls.at(-1).options.traceId);
      if (kind === "timeout") {
        assert.equal(m.timers.at(-1).ms, 15000);
        m.timers.at(-1).fn();
      } else m.calls.at(-1).reject(new Failure(kind));
      await p;
      const keep = retained && !["expired", "forbidden"].includes(kind);
      assert.equal(Boolean(m.data.value), keep);
      assert.equal(keep ? m.refreshFailure.value : m.state.value, kind);
    }
  }
  const u = mount(),
    up = u.load();
  u.hooks.unmount();
  await up;
  assert.equal(u.data.value, null);
  assert.equal(u.calls[0].options.signal.aborted, true);
  assert.equal(u.duration(0), "0 ms");
  assert.equal(u.duration(null), "尚无记录");
  assert.equal(u.sha(shaA), "aaaaaaaaaa");
  assert.ok(
    !datasets["current-missing"].blockers.some((i) =>
      ["release_source_mismatch", "release_identity_mismatch"].includes(i.code),
    ),
  );
  assert.ok(uiSource.includes("capabilities?.includes('platform:superadmin')"));
  assert.ok(uiSource.includes('to="/platform-admin/api-coverage"'));
  sourceChecks.push(
    "Actual Vue script: single-flight, exact GET/IDs, 15-second abort, first failure vs retained snapshot, 401/403 clearing, retryable retention, unmount abort, zero/unknown duration and SHA10 truncation. Current-missing fixture has neither of the old UI alignment blockers; old card would say consistent. Superadmin link condition statically bound; no mounted Vue/auth/cache lifecycle proof.",
  );
  const rb = { Date, Number, randomUUID };
  vm.createContext(rb);
  vm.runInContext(
    compile(strip(await read(sourcePaths[6]))) + "\nglobalThis.Repo=MySqlReleaseRolloutRepository;",
    rb,
  );
  const events = [],
    sqls = [];
  let fail = false;
  const connection = {
    beginTransaction: async () => events.push("begin"),
    commit: async () => events.push("commit"),
    rollback: async () => events.push("rollback"),
    release: () => events.push("release"),
    query: async (sql, params) => {
      sqls.push({ sql, params });
      if (sql.startsWith("INSERT")) {
        if (fail) throw new Error("synthetic audit failure");
        return [];
      }
      return [
        sql.startsWith("SELECT id,")
          ? [release]
          : [{ ...gates[0], error_rate_percent: null, read_p95_ms: "100", sample_count: "20" }],
      ];
    },
  };
  const rr = new rb.Repo({
      getConnection: async () => connection,
      query: () => {
        throw new Error("write probe forbidden");
      },
    }),
    ri = {
      actorId: "synthetic-operator",
      requestId: "synthetic-request",
      traceId: "synthetic-trace",
      now,
    };
  const records = await rr.read(ri);
  assert.equal(records.gates[0].error_rate_percent, null);
  assert.equal(records.gates[0].sample_count, 20);
  assert.deepEqual(events, ["begin", "commit", "release"]);
  assert.match(sqls[0].sql, /LIMIT 10/);
  assert.match(sqls[1].sql, /recent.id=g.release_id/);
  assert.match(sqls[1].sql, /ORDER BY g.started_at,g.gate_kind/);
  assert.match(sqls[2].sql, /platform.release_rollout.read/);
  assert.equal(sqls[2].params[2], release.id);
  events.length = 0;
  fail = true;
  await assert.rejects(rr.read(ri), /synthetic audit failure/);
  assert.deepEqual(events, ["begin", "rollback", "release"]);
  sourceChecks.push(
    "Actual repository read only: recent10 release query and matching gate join/order, nullable numeric mapping, latest-history audit target, commit and audit-failure rollback/release with inert SQL connection. No real database transaction or write-probe.",
  );
  const timers = [],
    registered = [],
    rbx = {
      AbortController,
      Error,
      Number,
      sessionToken: () => "inert",
      setTimeout: (fn, ms) => {
        timers.push({ fn, ms });
        return timers.length;
      },
      clearTimeout: () => {},
      ApiError: class extends Error {
        constructor(status, code, message) {
          super(message);
          this.status = status;
          this.code = code;
        }
      },
    };
  vm.createContext(rbx);
  vm.runInContext(
    compile(strip(await read(sourcePaths[7]))) +
      "\nglobalThis.register=registerReleaseRolloutRoutes;",
    rbx,
  );
  let resolveRead, rejectRead, readInput;
  const order = [];
  rbx.register(
    { get: (url, fn) => registered.push({ url, fn }), post: (url) => registered.push({ url }) },
    {
      auth: {
        authenticate: async () => {
          order.push("auth");
          return { user: { id: "synthetic-operator" } };
        },
      },
      authorization: {
        authorize: async (v) => {
          order.push("authorize");
          assert.equal(v.capability, "platform:operate");
        },
      },
      service: {
        read: (v) => {
          order.push("read");
          readInput = v;
          return new Promise((resolve, reject) => {
            resolveRead = resolve;
            rejectRead = reject;
          });
        },
      },
      writeProbeService: {
        record: () => {
          throw new Error("write probe forbidden");
        },
      },
      secureCookie: false,
    },
  );
  assert.equal(registered.length, 2);
  assert.equal(registered[1].url, "/api/v1/platform/operations/releases/write-probe");
  const request = { headers: { "x-request-id": "synthetic-r", "x-trace-id": "synthetic-t" } },
    headers = {},
    raw = new EventEmitter();
  raw.writableEnded = false;
  const reply = {
    raw,
    header: (k, v) => {
      headers[k] = v;
    },
  };
  const tick = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  const p = registered[0].fn(request, reply);
  await tick();
  assert.deepEqual(order, ["auth", "authorize", "read"]);
  assert.equal(timers.at(-1).ms, 14000);
  resolveRead(datasets.verified);
  assert.equal((await p).data.state, "verified");
  assert.equal(headers["cache-control"], "private, no-store");
  raw.emit("finish");
  assert.equal(raw.listenerCount("close"), 0);
  const timeoutP = registered[0].fn(request, reply);
  await tick();
  timers.at(-1).fn();
  await assert.rejects(
    timeoutP,
    (e) => e.code === "release_rollout_read_timeout" && e.status === 503,
  );
  assert.equal(readInput.signal.aborted, true);
  resolveRead(datasets.verified);
  const dependencyP = registered[0].fn(request, reply);
  await tick();
  rejectRead(Object.assign(new Error("inert"), { code: "ECONNREFUSED" }));
  await assert.rejects(dependencyP, (e) => e.code === "release_rollout_dependency_unavailable");
  sourceChecks.push(
    "Actual GET handler with inert auth/service/reply and manual timer: authorization before read, private/no-store, 14-second timeout/abort, dependency503 mapping and finish removes close handler. POST write-probe registration recorded but never invoked; no server/network or real authorization test.",
  );
  const tc = {
    ref,
    computed,
    defineProps: () => ({ requestId: "synthetic", traceId: "", items: [] }),
    withDefaults: (p) => p,
    navigator: {
      clipboard: {
        writeText: async () => {
          throw new Error("synthetic clipboard denial");
        },
      },
    },
    window: { setTimeout: () => 0 },
  };
  vm.createContext(tc);
  const technical = (await read(sourcePaths[3]))
    .split(/<script setup[^>]*>/)[1]
    .split("</script>")[0];
  vm.runInContext(compile(strip(technical)) + "\nglobalThis.t={copy,copied};", tc);
  await assert.rejects(tc.t.copy("请求编号", "synthetic"), /synthetic clipboard denial/);
  assert.equal(tc.t.copied.value, "");
  sourceChecks.push(
    "Actual TechnicalDetails.copy rejects on denied clipboard with no local error state. Prototype feedback remains a design proposal; no operating-system clipboard call.",
  );
  const manifest = JSON.parse(await read(sourcePaths[12]));
  assert.equal(manifest.objects.filter((o) => o.kind === "baota-node-project").length, 1);
  assert.equal(manifest.target.deployRoot, "/www/wwwroot/ai选品");
  const bootstrap = await read(sourcePaths[11]),
    config = await read(sourcePaths[9]);
  assert.match(bootstrap, /percentages: \[5, 25, 100\]/);
  assert.match(bootstrap, /currentBuildSha: context\.config\.app\.buildSha/);
  assert.match(
    config,
    /sourceLocalSha: text\(env, "RELEASE_SOURCE_LOCAL_SHA", text\(env, "BUILD_SHA", "development"\)\)/,
  );
  assert.match(config, /"RELEASE_SOURCE_REMOTE_SHA",\s*text\(env, "BUILD_SHA", "development"\)/);
  sourceChecks.push(
    "Static current manifest/bootstrap/config: one Baota Node project and fixed root, percentages5/25/100 read policy, config/source SHA fallback. Manifest historical deployed flag is not a live health verification. No deployer, historical runner or probe signing executed.",
  );
  return {
    data: {
      sourcePaths,
      sourceChecks,
      datasets,
      labels,
      clock: now.toISOString(),
      provenance:
        "Synthetic service outputs and separately preserved original partial E2E; no live release data.",
    },
    logic,
  };
}
