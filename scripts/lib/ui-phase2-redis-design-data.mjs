import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID } from "node:crypto";

// Source-backed synthetic design data; no Redis/MySQL/socket/config writes.
export async function buildRedisDesignData(repo) {
  const sourcePaths = [
      "packages/redis/src/index.ts",
      "apps/api/src/redis-resilience-service.ts",
      "apps/api/src/mysql-redis-resilience-repository.ts",
      "apps/api/src/redis-resilience-routes.ts",
      "apps/web/src/components/RedisResilienceCenter.vue",
      "apps/web/src/components/TechnicalDetails.vue",
      "tests/e2e/m08-02-redis-resilience.spec.ts",
      "infra/baota/redis-single-instance-manifest.json",
      "apps/api/src/server.ts",
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
    compile(
      strip(
        source.slice(
          source.indexOf("export type RedisResilienceState"),
          source.indexOf("export function createRedisConnection"),
        ),
      ),
    ) +
      "\nglobalThis.api={evaluateRedisResilience,inspectRedisResilience,inspectRedisKeyspaceHotspots,REDIS_KEYSPACE_SAMPLE_LIMIT};",
    box,
  );
  Object.assign(box, box.api);
  vm.runInContext(
    compile(strip(await read(sourcePaths[1]))) +
      "\nglobalThis.Service=RedisResilienceService;globalThis.unavailable=unavailableRedisResilienceSnapshot;",
    box,
  );
  const now = new Date("2026-09-09T06:00:00.000Z"),
    samples = {},
    sampleChecks = [],
    key = (p, r, i) => `scoutops:v1:${p}:org:synthetic-org:ws:synthetic-workspace:${r}:${i}`;
  async function sample(name, keys, measurement = () => 100, options = {}) {
    let rounds = 0,
      active = 0,
      maxActive = 0;
    const result = await box.inspectRedisKeyspaceHotspots({
      scan: async (cursor, opts) => {
        assert.equal(opts.MATCH, "scoutops:v1:*");
        assert.equal(opts.COUNT, 32);
        rounds++;
        if (options.fail) throw new Error("inert scan");
        return { cursor: options.cursor ?? "0", keys };
      },
      memoryUsage: async (k) => {
        active++;
        maxActive = Math.max(active, maxActive);
        try {
          await Promise.resolve();
          return measurement(k);
        } finally {
          active--;
        }
      },
    });
    samples[name] = plain(result);
    assert.ok(maxActive <= 16);
    assert.ok(rounds <= 32);
    sampleChecks.push({ name, rounds, maxActive });
    return result;
  }
  const allKeys = ["cache", "queue", "rate", "sse"].flatMap((p) =>
    ["collection-ready", "collection-task", "other"].map((r, i) => key(p, r, i)),
  );
  await sample("sampled", allKeys, (k) => (allKeys.indexOf(k) + 1) * 1024);
  await sample("empty", []);
  await sample("ignored", ["outside", key("unknown", "other", 1), key("queue", "%XX", 1)]);
  await sample("partial", allKeys, (k) => (allKeys.indexOf(k) % 2 ? null : 2048));
  await sample("all-failed", allKeys, () => {
    throw new Error("inert memory");
  });
  await sample("zero", allKeys, () => 0);
  await sample("scan-failed", [], undefined, { fail: true });
  await sample(
    "truncated",
    Array.from({ length: 130 }, (_, i) => key("queue", "collection-task", i)),
  );
  await sample("round-limit", [], undefined, { cursor: "1" });
  await sample("dedup", [allKeys[0], allKeys[0]], () => 128);
  await sample("invalid-memory", allKeys, () => -1);
  samples.unsupported = plain(await box.inspectRedisKeyspaceHotspots({}));
  assert.equal(samples["all-failed"].status, "partial");
  assert.equal(samples["all-failed"].hotspots.length, 0);
  assert.equal(samples.truncated.measured_keys, 128);
  assert.equal(samples.truncated.truncated, true);
  assert.equal(samples["round-limit"].status, "empty");
  assert.equal(samples["round-limit"].truncated, true);
  assert.equal(samples.dedup.measured_keys, 1);
  assert.equal(samples.zero.status, "sampled");
  assert.equal(samples.zero.total_sampled_bytes, 0);
  assert.equal(samples.sampled.hotspots.length, 12);
  assert.equal(samples.partial.measured_keys, 6);
  assert.ok(!JSON.stringify(samples).includes("synthetic-org"));
  const probeCalls = [],
    info = {
      server: "uptime_in_seconds:172800",
      persistence: "loading:0\naof_last_write_status:ok\nrdb_last_bgsave_status:ok",
      memory: "used_memory:134217728",
      clients: "connected_clients:18",
      stats: "rejected_connections:0\nevicted_keys:0",
    },
    config = {
      appendonly: "yes",
      save: "900 1",
      maxmemory: "536870912",
      "maxmemory-policy": "noeviction",
      maxclients: "512",
    };
  const probe = async (patch = {}) =>
    plain(
      await box.inspectRedisResilience({
        ping: async () => "PONG",
        info: async (s) => {
          probeCalls.push("INFO " + s);
          return info[s];
        },
        configGet: async (p) => {
          probeCalls.push("CONFIG GET " + p);
          return { [p]: config[p] };
        },
        ...patch,
      }),
    );
  const base = await probe();
  base.keyspaceSample = samples.sampled;
  const failedProbe = await probe({
    ping: async () => {
      throw new Error("inert unavailable");
    },
  });
  assert.deepEqual(failedProbe, plain(box.unavailable()));
  const malformed = await probe({
    info: async (s) => (s === "memory" ? "used_memory:-4" : info[s]),
  });
  assert.equal(malformed.usedMemoryBytes, 0);
  const fallback = await probe({
    info: async (s) =>
      s === "persistence" ? "aof_last_bgrewrite_status:ok\nrdb_last_bgsave_status:ok" : info[s],
  });
  assert.equal(fallback.aofLastWriteStatus, "ok");
  assert.ok(!probeCalls.some((c) => /appendfsync|protected-mode|bind/.test(c)));
  assert.equal(new Set(probeCalls.filter((c) => c.startsWith("INFO "))).size, 5);
  assert.equal(new Set(probeCalls.filter((c) => c.startsWith("CONFIG GET "))).size, 5);
  assert.ok(sampleChecks.some((s) => s.maxActive === 16));
  const policy = {
      memoryWarningBasisPoints: 7500,
      memoryStopBasisPoints: 9000,
      connectionWarningBasisPoints: 7500,
      connectionStopBasisPoints: 9000,
    },
    datasets = {},
    labels = {};
  async function add(k, label, mutate = () => {}, policyPatch = {}) {
    const snapshot = plain(base);
    mutate(snapshot);
    let records = 0;
    datasets[k] = plain(
      await new box.Service(
        { snapshot: async () => snapshot },
        {
          record: async (v) => {
            records++;
            assert.equal(v.snapshot, snapshot);
          },
        },
        { ...policy, ...policyPatch },
        () => now,
      ).read({
        actorId: "synthetic-operator",
        requestId: "synthetic-request",
        traceId: "synthetic-request",
      }),
    );
    labels[k] = label;
    assert.equal(records, 1);
  }
  await add("ready", "完整观测与十二类采样");
  for (const [k, label, field, v] of [
    ["loading-probe", "Redis正在加载", "loading", true],
    ["aof-disabled", "AOF未启用", "appendOnlyEnabled", false],
    ["rdb-disabled", "RDB规则为空", "rdbEnabled", false],
    ["aof-error", "AOF写入失败", "aofLastWriteStatus", "err"],
    ["rdb-error", "RDB保存失败", "rdbLastSaveStatus", "err"],
    ["memory-unbounded", "内存上限未设置", "maxMemoryBytes", 0],
    ["clients-unbounded", "连接上限未设置", "maxClients", 0],
    ["policy-invalid", "非noeviction策略", "maxMemoryPolicy", "allkeys-lru"],
    ["rejected", "累计拒绝非零", "rejectedConnections", 1],
    ["evicted", "累计淘汰非零", "evictedKeys", 2],
  ])
    await add(k, label, (s) => (s[field] = v));
  await add("probe-failed", "探针失败占位不等于实测0", (s) => Object.assign(s, failedProbe));
  for (const [k, label, basis] of [
    ["memory-before", "内存预警前一个基点", 7499],
    ["memory-warning", "内存预警边界", 7500],
    ["local-before", "局部80%提示前", 7999],
    ["local-warning", "局部80%提示触发", 8000],
    ["memory-stop", "内存停止边界", 9000],
    ["memory-over", "实际使用超过上限", 12000],
  ])
    await add(k, label, (s) => {
      s.maxMemoryBytes = 10000;
      s.usedMemoryBytes = basis;
    });
  for (const [k, n] of [
    ["clients-warning", 75],
    ["clients-stop", 90],
  ])
    await add(k, "连接阈值 · " + n + "%", (s) => {
      s.connectedClients = n;
      s.maxClients = 100;
    });
  await add(
    "custom-policy",
    "运行policy不同于界面80%",
    (s) => {
      s.maxMemoryBytes = 10000;
      s.usedMemoryBytes = 8000;
    },
    { memoryWarningBasisPoints: 8500, memoryStopBasisPoints: 9500 },
  );
  await add("zero-resources", "已观测真实零用量", (s) => {
    s.usedMemoryBytes = 0;
    s.connectedClients = 0;
  });
  await add("short-uptime", "不足一天的运行期", (s) => (s.uptimeSeconds = 3599));
  for (const [k, s] of Object.entries(samples).filter(([k]) => k !== "sampled"))
    await add("sample-" + k, "采样 · " + k, (x) => (x.keyspaceSample = s));
  await add("sample-missing", "兼容缺少采样字段", (s) => delete s.keyspaceSample);
  await add(
    "long",
    "长策略与错误代码",
    (s) => (s.maxMemoryPolicy = "synthetic-unknown-policy-".repeat(20)),
  );
  const fixture = ast(await read(sourcePaths[6])).statements;
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
  for (const k of [
    "ready",
    "memory-before",
    "custom-policy",
    "zero-resources",
    "sample-all-failed",
    "sample-unsupported",
  ])
    assert.equal(datasets[k].state, "ready", k);
  for (const k of ["memory-warning", "local-before", "local-warning", "clients-warning"])
    assert.equal(datasets[k].state, "warning", k);
  for (const k of [
    "probe-failed",
    "memory-stop",
    "clients-stop",
    "evicted",
    "rejected",
    "memory-unbounded",
    "clients-unbounded",
  ])
    assert.equal(datasets[k].state, "blocked", k);
  assert.equal(datasets["memory-over"].memory.usage_basis_points, 10000);
  assert.equal(datasets["probe-failed"].memory.usage_basis_points, 10000);
  assert.equal(datasets["sample-all-failed"].keyspace_sample.status, "partial");
  assert.equal(
    datasets["sample-missing"].keyspace_sample.unavailable_reason,
    "command_unsupported",
  );
  const uiSource = await read(sourcePaths[4]),
    script = uiSource.split(/<script setup[^>]*>/)[1].split("</script>")[0],
    wanted = ["evictionRisk", "purposeLabel", "resourceLabel", "sampleStatusLabel"],
    decl = ast(script)
      .statements.filter(
        (n) =>
          ts.isVariableStatement(n) &&
          wanted.includes(n.declarationList.declarations[0].name.getText()),
      )
      .map((n) => n.getFullText())
      .join("\n"),
    logic = compile(
      `window.REDIS_LOGIC=function(value){const data={value};const computed=fn=>({get value(){return fn()}});${decl}\nreturn {risk:evictionRisk.value,purposeLabel,resourceLabel,sampleStatusLabel};};`,
    );
  const lb = { window: {} };
  vm.createContext(lb);
  vm.runInContext(logic, lb);
  assert.equal(lb.window.REDIS_LOGIC(datasets["custom-policy"]).risk.level, "warning");
  assert.equal(lb.window.REDIS_LOGIC(datasets["memory-warning"]).risk.level, "ready");
  const sourceChecks = [
    "Actual keyspace sampler with inert SCAN/MEMORY: twelve purpose/resource groups, duplicates, invalid keys, partial/all failed, measured zero, unsupported/failed scan, 128-key and 32-round truncation, <=16 active measurements, sanitized grouping without keys/scope/payloads. Percentages are of successful measured bytes, not instance memory or access frequency.",
    "Actual probe/evaluator/service: exact five INFO/five CONFIG GET (no appendfsync/bind/protected-mode), failure placeholders, malformed numeric zero and AOF rewrite-status fallback; ready/warning/blocked thresholds, policy-vs-local80%, clamped >100% ratio and missing sample fallback. Service waits for read audit; source tests use synthetic records only.",
  ];
  const ref = (value) => ({ value }),
    computed = (fn) => ({
      get value() {
        return fn();
      },
    });
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
      assert.equal(m.calls.at(-1).url, "/platform/operations/redis");
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
  const empty = mount(),
    ep = empty.load();
  empty.calls[0].resolve({ data: null, request_id: "synthetic-empty" });
  await ep;
  assert.equal(empty.state.value, "empty");
  const unmount = mount(),
    up = unmount.load();
  unmount.hooks.unmount();
  await up;
  assert.equal(unmount.data.value, null);
  sourceChecks.push(
    "Actual Vue script: exact GET/IDs, single-flight, 15s browser abort, null->empty, auth clearing versus transient retention, generic errors clear request ID, unmount abort. Local eviction predicate extracted unchanged for browser. Recovering is a UI-only enum, no source recovery execution; mounted Vue/preserve lifecycle not tested.",
  );
  const rb = { randomUUID, Date };
  vm.createContext(rb);
  vm.runInContext(
    compile(strip(await read(sourcePaths[2]))) +
      "\nglobalThis.Repo=MySqlRedisResilienceRepository;",
    rb,
  );
  for (const fail of [false, true]) {
    const events = [],
      sqls = [],
      connection = {
        beginTransaction: async () => events.push("begin"),
        query: async (sql) => {
          sqls.push(sql);
          if (fail && sql.includes("platform_audit_events")) throw new Error("inert audit");
        },
        commit: async () => events.push("commit"),
        rollback: async () => events.push("rollback"),
        release: () => events.push("release"),
      };
    const p = new rb.Repo({ getConnection: async () => connection }).record({
      actorId: "synthetic",
      requestId: "synthetic",
      traceId: "synthetic",
      observedAt: now,
      snapshot: base,
      evaluation: box.evaluateRedisResilience(base, policy),
    });
    if (fail) await assert.rejects(p, /inert audit/);
    else await p;
    assert.deepEqual(
      events,
      fail ? ["begin", "rollback", "release"] : ["begin", "commit", "release"],
    );
    assert.equal(sqls.length, 3);
  }
  sourceChecks.push(
    "Actual MySQL repository with inert connection: observation/view/platform audit three inserts, commit or audit-failure rollback, connection release. This verifies control flow only, not MySQL syntax/runtime durability/RBAC.",
  );
  const route = await read(sourcePaths[3]),
    server = await read(sourcePaths[8]),
    cfg = await read(sourcePaths[9]);
  assert.match(route, /platform:operate/);
  assert.match(route, /private, no-store/);
  assert.ok(!route.includes("AbortController"));
  assert.match(server, /probeClient\.quit\(\)/);
  assert.match(cfg, /REDIS_MEMORY_WARNING_PERCENT/);
  sourceChecks.push(
    "Static route/server/config: platform:operate private read and dependency boundary, per-read probe connection with quit/destroy, environment policy, no route AbortController. Manifest is historical policy/evidence, not freshly probed everysec/network/restore proof. No service start, Redis commands, env access, deployment or real audit executed.",
  );
  return {
    data: {
      sourcePaths,
      sourceChecks,
      labels,
      datasets,
      sampleChecks,
      clock: now.toISOString(),
      provenance:
        "Synthetic source output and separately preserved historical E2E, not production.",
    },
    logic,
  };
}
