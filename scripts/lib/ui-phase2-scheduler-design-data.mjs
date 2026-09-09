import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID } from "node:crypto";

// Real source, inert connections and host inputs. No SQL/health/recovery side effects.
export async function buildSchedulerDesignData(repo) {
  const sourcePaths = [
      "apps/api/src/crawler-scheduler-service.ts",
      "apps/api/src/crawler-scheduler-repository.ts",
      "apps/api/src/crawler-scheduler-probe.ts",
      "apps/api/src/crawler-scheduler-routes.ts",
      "apps/web/src/components/CrawlerSchedulerCenter.vue",
      "apps/web/src/components/ConfirmDialog.vue",
      "apps/web/src/ui/state-contract.ts",
      "apps/web/src/components/TechnicalDetails.vue",
      "tests/e2e/m08-05-crawler-scheduler.spec.ts",
      "packages/config/src/index.ts",
      "infra/baota/crawler-single-host-scheduler-manifest.json",
      "apps/web/src/ui/status-labels.ts",
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
  const box = { Date, Number, Error, randomUUID };
  vm.createContext(box);
  vm.runInContext(
    compile(strip(await read(sourcePaths[0]))) +
      "\nglobalThis.Service=CrawlerSchedulerService;globalThis.evaluate=evaluateCrawlerScheduler;",
    box,
  );
  vm.runInContext(
    compile(strip(await read(sourcePaths[1]))) + "\nglobalThis.Repo=CrawlerSchedulerRepository;",
    box,
  );
  const now = new Date("2026-09-09T08:00:00.000Z"),
    ago = (s) => new Date(now.getTime() - s * 1000).toISOString(),
    uuid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    policy = {
      maximumWorkers: 1,
      maximumCrawlers: 1,
      maximumProviderConcurrency: 1,
      maximumLoadBasisPoints: 8500,
      minimumAvailableMemoryMb: 1024,
      minimumFreeDiskMb: 4096,
      staleAfterSeconds: 90,
    },
    datasets = {},
    labels = {},
    snapshots = {};
  const provider = (i) => ({
    id: uuid(i + 501),
    code:
      ["catalog_search", "market_source", "news_source"][i] ||
      `source_${String(i).padStart(2, "0")}`,
    configured_concurrency: 3,
    effective_concurrency: 1,
    active_leases: 0,
    queued_tasks: i === 0 ? 3 : 0,
    longest_queue_wait_seconds: i === 0 ? 180 : 0,
    circuit_failure_threshold: 5,
    consecutive_failures: 0,
    last_error_code: null,
    runtime_circuit_state: "closed",
  });
  async function snapshot(mutate = () => {}) {
    const rows = {
      leases: [
        { slot_type: "worker", total: 1 },
        { slot_type: "crawler", total: 0 },
      ],
      providers: [provider(0), provider(1), provider(2)],
      profiles: [{ id: uuid(601), active_leases: 0 }],
      duplicates: [{ total: 0 }],
      expired: [
        {
          total: 3,
          task_count: 1,
          worker: 1,
          crawler: 1,
          provider: 1,
          oldest_expired_at: ago(300),
        },
      ],
      active: [
        {
          slot_type: "worker",
          provider_name: null,
          task_id: uuid(701),
          task_status: "running",
          run_id: null,
          lease_owner: "synthetic-worker",
          heartbeat_at: ago(2),
          expires_at: ago(-60),
        },
      ],
      samples: [
        {
          provider_id: uuid(501),
          status: "succeeded",
          duration_ms: 1000,
          queue_wait_seconds: null,
        },
        { provider_id: uuid(501), status: "failed", duration_ms: 2000, queue_wait_seconds: null },
        { provider_id: uuid(501), status: "queued", duration_ms: null, queue_wait_seconds: 0 },
        { provider_id: uuid(501), status: "queued", duration_ms: null, queue_wait_seconds: 120 },
      ],
      trend: [{ bucket_at: ago(3600), total: 5, succeeded: 2, failed: 1 }],
      spool: [
        {
          pending_count: 2,
          pending_bytes: 2048,
          quarantined_count: 0,
          quarantined_bytes: 0,
          oldest_pending_at: ago(3600),
          retention_days: 7,
          max_bytes: 1048576,
          minimum_free_disk_mb: 1024,
          free_disk_mb: 10000,
          observed_at: ago(0),
        },
      ],
    };
    mutate(rows);
    const queries = [],
      events = [],
      c = {
        query: async (sql, params = []) => {
          queries.push({ sql, params });
          if (sql.startsWith("SET ") || sql.startsWith("START ")) return [[]];
          const index = queries.length - 3;
          return [
            [
              rows.leases,
              rows.providers,
              rows.profiles,
              rows.duplicates,
              rows.expired,
              rows.active,
              rows.samples,
              rows.trend,
              rows.spool,
            ][index],
          ];
        },
        commit: async () => events.push("commit"),
        rollback: async () => events.push("rollback"),
        release: () => events.push("release"),
      };
    const result = plain(await new box.Repo({ getConnection: async () => c }).snapshot(now));
    assert.equal(queries.length, 11);
    assert.match(queries[0].sql, /REPEATABLE READ/);
    assert.match(queries[1].sql, /READ ONLY/);
    assert.match(queries[8].sql, /LIMIT 5000/);
    assert.match(queries[7].sql, /LIMIT 100/);
    assert.deepEqual(events, ["commit", "release"]);
    return result;
  }
  const host = {
      worker_instances: 1,
      crawler_instances: 1,
      resource: {
        load_basis_points: 3000,
        available_memory_mb: 8192,
        free_disk_mb: 100000,
        observed_at: ago(0),
      },
    },
    base = { ...(await snapshot()), ...host };
  async function add(k, label, s = base, p = {}) {
    snapshots[k] = plain(s);
    let recorded = 0;
    datasets[k] = plain(
      await new box.Service(
        { snapshot: async () => s, record: async () => recorded++ },
        {
          snapshot: async () => ({
            worker_instances: s.worker_instances,
            crawler_instances: s.crawler_instances,
            resource: s.resource,
          }),
        },
        { ...policy, ...p },
        () => now,
      ).read({ actorId: "synthetic", requestId: "synthetic", traceId: "synthetic" }),
    );
    assert.equal(recorded, 1);
    labels[k] = label;
  }
  await add("ready", "三个来源与混合等待/完成样本");
  const cases = [
    ["worker-zero", "Worker为0", (s) => (s.worker_instances = 0), "crawler_worker_count_exceeded"],
    [
      "crawler-two",
      "Crawler为2",
      (s) => (s.crawler_instances = 2),
      "crawler_process_count_exceeded",
    ],
    [
      "global-over",
      "全局槽位超限",
      (s) => (s.active_worker_leases = 2),
      "crawler_global_concurrency_exceeded",
    ],
    ["duplicate", "重复租约", (s) => (s.duplicate_lease_count = 1), "crawler_lease_duplicate"],
    [
      "profile-over",
      "档案独占超限",
      (s) => (s.profiles[0].active_leases = 2),
      "crawler_lease_duplicate",
    ],
    [
      "provider-over",
      "来源有效并发超限",
      (s) => (s.providers[0].effective_concurrency = 2),
      "crawler_provider_quota_exceeded",
    ],
    [
      "provider-active-over",
      "来源活动超限",
      (s) => (s.providers[0].active_leases = 2),
      "crawler_provider_quota_exceeded",
    ],
    [
      "circuit",
      "来源已熔断",
      (s) => {
        s.providers[0].circuit_state = "open";
        s.providers[0].consecutive_failures = 5;
        s.providers[0].last_error_code = "provider_runtime_circuit_open";
      },
      "crawler_provider_circuit_open",
    ],
    [
      "resource-stale",
      "资源观测过期",
      (s) => (s.resource.observed_at = ago(91)),
      "crawler_resource_observation_stale",
    ],
    [
      "resource-future",
      "资源时间在未来",
      (s) => (s.resource.observed_at = ago(-1)),
      "crawler_resource_observation_stale",
    ],
    [
      "resource-load-stop",
      "负载85%停止边界",
      (s) => (s.resource.load_basis_points = 8500),
      "crawler_resource_stop",
    ],
    [
      "resource-load-warning",
      "负载76.5%预警边界",
      (s) => (s.resource.load_basis_points = 7650),
      "crawler_resource_warning",
    ],
    [
      "resource-memory-stop",
      "内存低于1024MB",
      (s) => (s.resource.available_memory_mb = 1023),
      "crawler_resource_stop",
    ],
    [
      "resource-disk-warning",
      "磁盘接近停止线",
      (s) => (s.resource.free_disk_mb = 5000),
      "crawler_resource_warning",
    ],
    [
      "spool-missing",
      "没有回执水位",
      (s) => (s.receipt_spool = null),
      "crawler_completion_spool_missing",
    ],
    [
      "spool-stale",
      "回执观测过期",
      (s) => (s.receipt_spool.observed_at = ago(91)),
      "crawler_completion_spool_stale",
    ],
    [
      "spool-future",
      "回执时间在未来",
      (s) => (s.receipt_spool.observed_at = ago(-1)),
      "crawler_completion_spool_stale",
    ],
    [
      "spool-disk-stop",
      "回执盘低于停止线",
      (s) => (s.receipt_spool.free_disk_mb = 1023),
      "crawler_completion_spool_disk_stop",
    ],
    [
      "spool-capacity-stop",
      "回执容量触线",
      (s) => (s.receipt_spool.pending_bytes = 1048576),
      "crawler_completion_spool_capacity_stop",
    ],
    [
      "spool-capacity-warning",
      "回执容量80%",
      (s) => (s.receipt_spool.pending_bytes = Math.round(1048576 * 0.8)),
      "crawler_completion_spool_capacity_warning",
    ],
    [
      "spool-retention",
      "达到七天保留期",
      (s) => (s.receipt_spool.oldest_pending_at = ago(7 * 86400)),
      "crawler_completion_spool_retention_warning",
    ],
    [
      "spool-quarantine",
      "隔离区有待审阅",
      (s) => {
        s.receipt_spool.quarantined_count = 1;
        s.receipt_spool.quarantined_bytes = 100;
      },
      "crawler_completion_spool_quarantine_pending",
    ],
  ];
  for (const [k, t, fn, code] of cases) {
    const s = plain(base);
    fn(s);
    await add(k, t, s);
    assert.ok(
      datasets[k].findings.some((f) => f.code === code),
      k,
    );
  }
  const repoCases = [
    [
      "no-providers",
      "没有启用来源",
      (r) => {
        r.providers = [];
        r.samples = [];
      },
    ],
    ["no-samples", "有排队但无完成样本", (r) => (r.samples = [])],
    [
      "no-attention",
      "来源均不需关注",
      (r) =>
        r.providers.forEach((p) => {
          p.queued_tasks = 0;
          p.longest_queue_wait_seconds = 0;
        }),
    ],
    [
      "many",
      "25来源分页",
      (r) =>
        (r.providers = Array.from({ length: 25 }, (_, i) => ({
          ...provider(i),
          queued_tasks: 25 - i,
          longest_queue_wait_seconds: i * 10,
          runtime_circuit_state: i < 2 ? "open" : "closed",
          consecutive_failures: i < 2 ? 5 : 0,
        }))),
    ],
    [
      "expired-zero",
      "快照中过期槽位为0",
      (r) =>
        (r.expired = [
          { total: 0, task_count: 0, worker: 0, crawler: 0, provider: 0, oldest_expired_at: null },
        ]),
    ],
    [
      "expired-time-unknown",
      "过期槽位没有最早时间",
      (r) => (r.expired[0].oldest_expired_at = null),
    ],
    ["spool-time-unknown", "有待回写但最老时间null", (r) => (r.spool[0].oldest_pending_at = null)],
    [
      "spool-zero",
      "真实零回执",
      (r) => {
        r.spool[0].pending_count = 0;
        r.spool[0].pending_bytes = 0;
        r.spool[0].oldest_pending_at = null;
      },
    ],
    [
      "all-empty-lists",
      "无趋势/关联/档案",
      (r) => {
        r.active = [];
        r.trend = [];
        r.profiles = [];
      },
    ],
    [
      "circuit-below-threshold",
      "源open但失败数未到阈值",
      (r) => {
        r.providers[0].runtime_circuit_state = "open";
        r.providers[0].consecutive_failures = 4;
      },
    ],
    [
      "long",
      "长来源与进程标识",
      (r) => {
        r.providers[0].code = "synthetic_source_".repeat(14);
        r.active[0].lease_owner = "synthetic-worker-".repeat(16);
      },
    ],
  ];
  for (const [k, t, fn] of repoCases) await add(k, t, { ...(await snapshot(fn)), ...host });
  await add("resource-boundary", "资源90秒仍有效", {
    ...base,
    resource: { ...base.resource, observed_at: ago(90) },
  });
  assert.equal(datasets.ready.providers[0].sample_count_24h, 2);
  assert.equal(datasets.ready.providers[0].queue_wait_p50_seconds, 0);
  assert.equal(datasets.ready.providers[0].queue_wait_p95_seconds, 120);
  assert.equal(datasets.ready.providers[0].success_rate_basis_points_24h, 5000);
  assert.equal(datasets.ready.trend[0].total, 5);
  assert.equal(datasets.ready.trend[0].failure_rate_basis_points, 2000);
  assert.equal(datasets["circuit-below-threshold"].providers[0].circuit_state, "closed");
  const fixture = ast(await read(sourcePaths[8])).statements;
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
  labels.original = "历史E2E（无回执字段，非现行服务输出）";
  for (const platform of ["linux", "win32"]) {
    const pb = {
      Date,
      Math,
      process: { platform },
      cpus: () => [{}, {}],
      freemem: () => 8192 * 1048576,
      loadavg: () => [0.6],
      statfs: async () => ({ bavail: 100000, bsize: 1048576 }),
      readdir: async () => [1, 2, 3].map((n) => ({ name: String(n), isDirectory: () => true })),
      readFile: async (p) =>
        p.includes("/1/")
          ? "node apps/worker/dist/index.js"
          : p.includes("/2/")
            ? "python3.12 -m scoutops_crawler"
            : "node unrelated",
    };
    vm.createContext(pb);
    vm.runInContext(
      compile(strip(await read(sourcePaths[2]))) + "\nglobalThis.Host=CrawlerSchedulerHostProbe;",
      pb,
    );
    const h = plain(await new pb.Host("inert", () => now).snapshot());
    assert.equal(h.worker_instances, 1);
    assert.equal(h.crawler_instances, 1);
    assert.equal(h.resource.load_basis_points, 3000);
  }
  const sourceChecks = [
    "Actual repository snapshot against nine inert result sets in read-only repeatable-read: provider completed duration versus current waiting samples/P50/P95, source circuit state AND failure threshold, bounded5000/100 SQL, trend includes nonterminal total, receipt null/time. Query strings and transformations, not real SQL isolation or cardinality proof.",
    "Actual evaluator/service plus inert Linux/nonLinux host probe: counts/quotas, profile duplicates, 90s/future and resource thresholds, receipt missing/stale/disk/80%-100%/retention/quarantine. NonLinux1/1 remains development placeholder; service records synthetic snapshot; no real host or scheduler execution.",
  ];
  const recoveryResults = {};
  for (const type of ["expired", "provider"])
    for (const variant of [
      "success",
      "zero",
      "replay",
      "audit-fail",
      ...(type === "provider"
        ? ["not-found", "disabled", "health-missing", "health-equal", "health-before"]
        : []),
    ]) {
      const calls = [],
        events = [],
        input = {
          actorId: "synthetic",
          providerId: uuid(501),
          requestId: "req",
          traceId: "trace",
          idempotencyKey: "inert-key",
          now,
        },
        c = {
          beginTransaction: async () => events.push("begin"),
          commit: async () => events.push("commit"),
          rollback: async () => events.push("rollback"),
          release: () => events.push("release"),
          query: async (sql, params = []) => {
            calls.push({ sql, params });
            assert.equal((sql.match(/\?/g) || []).length, params.length);
            if (sql.includes("SELECT result_json"))
              return [
                variant === "replay"
                  ? [
                      {
                        result_json: JSON.stringify(
                          type === "expired"
                            ? { recovered: 2 }
                            : { provider_id: uuid(501), recovered: true },
                        ),
                      },
                    ]
                  : [],
              ];
            if (sql.startsWith("SELECT slot_type"))
              return [
                variant === "zero" ? [] : [{ slot_type: "worker" }, { slot_type: "provider" }],
              ];
            if (sql.startsWith("SELECT id,status"))
              return [
                variant === "not-found"
                  ? []
                  : [{ id: uuid(501), status: variant === "disabled" ? "disabled" : "enabled" }],
              ];
            if (sql.startsWith("SELECT state,opened"))
              return [[{ state: variant === "zero" ? "closed" : "open", opened_at: ago(10) }]];
            if (sql.startsWith("SELECT health_status"))
              return [
                variant === "health-missing"
                  ? []
                  : [
                      {
                        health_status: "ready",
                        last_checked_at: ago(
                          variant === "health-equal" ? 10 : variant === "health-before" ? 11 : 1,
                        ),
                      },
                    ],
              ];
            if (variant === "audit-fail" && sql.includes("INSERT INTO platform_audit_events"))
              throw new Error("inert audit");
            return [[]];
          },
        };
      const instance = new box.Repo({ getConnection: async () => c }),
        p = type === "expired" ? instance.recoverExpired(input) : instance.recoverProvider(input),
        failure = [
          "audit-fail",
          "not-found",
          "disabled",
          "health-missing",
          "health-equal",
          "health-before",
        ].includes(variant);
      if (failure) await assert.rejects(p);
      else recoveryResults[type + "-" + variant] = plain(await p);
      assert.deepEqual(
        events,
        failure ? ["begin", "rollback", "release"] : ["begin", "commit", "release"],
      );
      if (variant === "replay") assert.equal(calls.length, 1);
      if (type === "expired")
        assert.ok(
          calls
            .filter((x) => x.sql.startsWith("DELETE"))
            .every((x) => x.sql === "DELETE FROM crawler_scheduler_leases WHERE expires_at<=?"),
        );
      if (type === "provider" && variant === "success")
        assert.ok(calls.some((x) => x.sql.startsWith("UPDATE provider_runtime_circuits")));
      if (type === "provider" && variant === "zero")
        assert.ok(!calls.some((x) => x.sql.startsWith("UPDATE")));
    }
  const svc = new box.Service(
    {
      recoverExpired: async () => ({ recovered: 0 }),
      recoverProvider: async () => ({ provider_id: uuid(501), recovered: false }),
    },
    {},
    policy,
    () => now,
  );
  await assert.rejects(
    svc.recoverExpired({ idempotencyKey: "!" }),
    (e) => e.code === "crawler_scheduler_idempotency_invalid",
  );
  await assert.rejects(
    svc.recoverProvider({ providerId: "bad", idempotencyKey: "good" }),
    (e) => e.code === "crawler_provider_id_invalid",
  );
  sourceChecks.push(
    "Actual recovery repository with inert transaction: expired current-time slot-only deletion/zero/replay/audit rollback; provider missing/disabled, open versus closed, health absent/equal/before refusal, strictly later ready update, replay and rollback. Actual service UUID/key guards. No live lease mutation, locking/race, health check or durable idempotency proof.",
  );
  const script = (await read(sourcePaths[4])).split(/<script setup[^>]*>/)[1].split("</script>")[0],
    ref = (value) => ({ value }),
    computed = (fn) => ({
      get value() {
        return fn();
      },
    }),
    selected = [
      "providerPageSize",
      "queueSummary",
      "filteredProviders",
      "providerPageCount",
      "pagedProviders",
      "expiredLeaseImpact",
      "time",
      "processLabel",
      "duration",
      "rate",
      "milliseconds",
      "bytes",
      "queueRiskText",
    ],
    decl = ast(script)
      .statements.filter(
        (n) =>
          ts.isVariableStatement(n) &&
          selected.includes(n.declarationList.declarations[0].name.getText()),
      )
      .map((n) => n.getFullText())
      .join("\n"),
    confirmation = ast(await read(sourcePaths[6]))
      .statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === "canConfirm")
      .getFullText(),
    logic = compile(
      `window.SCHEDULER_LOGIC=function(value,query='',filter='attention',page=1){const data={value},providerQuery={value:query},providerFilter={value:filter},providerPage={value:page},computed=fn=>({get value(){return fn()}});${decl}\nreturn {providers:pagedProviders.value,total:filteredProviders.value.length,pages:providerPageCount.value,page:providerPage.value,summary:queueSummary.value,expired:expiredLeaseImpact.value,duration,rate,milliseconds,bytes,queueRiskText};};${confirmation.replace("export ", "")}\nwindow.SCHEDULER_CONFIRM=canConfirm;`,
    );
  class Failure extends Error {
    constructor(kind, status = 503) {
      super(kind);
      this.kind = kind;
      this.status = status;
      this.requestId = "synthetic-failure";
      this.actionHint = "隔离失败提示";
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
        Math,
        Intl,
        DOMException,
        AbortController,
        crypto: { randomUUID },
        ref,
        computed,
        statusLabel: (v) => v,
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
            options?.signal?.addEventListener("abort", () =>
              reject(new DOMException("abort", "AbortError")),
            );
          }),
      };
    vm.createContext(ctx);
    vm.runInContext(
      compile(strip(script)) +
        "\nglobalThis.ui={load,recover,recoverProvider,data,state,message,circuitConfirm,refreshFailure,requestId,expiredLeaseImpact};",
      ctx,
    );
    return { ...ctx.ui, calls, timers, hooks };
  }
  for (const kind of ["expired", "forbidden", "rate_limited", "unavailable", "timeout", "generic"])
    for (const retained of [false, true]) {
      const m = mount();
      if (retained) m.data.value = datasets.ready;
      const p = m.load();
      await m.load();
      assert.equal(m.calls.length, 1);
      assert.equal(m.calls[0].url, "/platform/operations/crawler-scheduler");
      if (kind === "timeout") {
        assert.equal(m.timers[0].ms, 15000);
        m.timers[0].f();
      } else m.calls[0].reject(kind === "generic" ? new Error("inert") : new Failure(kind));
      await p;
      assert.equal(Boolean(m.data.value), retained && !["expired", "forbidden"].includes(kind));
      if (kind === "generic") assert.equal(m.requestId.value, "");
    }
  const empty = mount(),
    ep = empty.load();
  empty.calls[0].resolve({ data: null, request_id: "empty" });
  await ep;
  assert.equal(empty.state.value, "empty");
  assert.match(empty.expiredLeaseImpact.value, /没有过期/);
  const gone = mount(),
    gp = gone.load();
  gone.hooks.unmount();
  await gp;
  for (const type of ["expired", "provider"])
    for (const status of [0, 503, 409, 401]) {
      const m = mount();
      m.data.value = datasets.circuit;
      const act = () => {
        if (type === "provider") m.circuitConfirm.value = datasets.circuit.providers[0];
        return type === "provider" ? m.recoverProvider() : m.recover();
      };
      let p = act();
      assert.deepEqual(plain(m.calls[0].options.body), {});
      const key = m.calls[0].options.idempotencyKey;
      m.calls[0].reject(new Failure(status === 401 ? "expired" : "unavailable", status));
      await p;
      assert.ok(m.data.value);
      p = act();
      assert.equal(m.calls[1].options.idempotencyKey === key, status === 0 || status >= 500);
      m.calls[1].reject(new Failure("unavailable", 503));
      await p;
    }
  const overlap = mount();
  overlap.data.value = datasets.circuit;
  const op = overlap.recover(),
    overlapRead = overlap.load();
  assert.equal(overlap.calls.length, 2);
  overlap.calls[0].resolve({ data: { recovered: 2 }, request_id: "op-id" });
  await op;
  assert.equal(overlap.calls.length, 2);
  overlap.calls[1].reject(new Failure("unavailable"));
  await overlapRead;
  assert.match(overlap.message.value, /已回收 2/);
  assert.equal(overlap.requestId.value, "synthetic-failure");
  sourceChecks.push(
    "Actual Vue script: GET single-flight/15s/auth clearing/null/unmount/generic no ID, and two real recovery functions inert POST{} key retention on network5xx versus 4xx clearing. POST401 retains source data; POST plus in-flight GET suppresses post-success re-read and read ID replaces operation ID. Source filter/sort/12-pagination/summary and canConfirm extracted; no mounted Vue/preserve/shared clipboard proof.",
  );
  const route = await read(sourcePaths[3]);
  for (const token of [
    "private, no-store",
    "14_000",
    "platform:operate",
    "requireIdempotencyKey(request)",
    "assertOrigin(request)",
    "options.webOrigin",
    "recover-expired",
    "providers/:providerId/recover",
    "controller.abort(timeoutError)",
  ])
    assert.ok(route.includes(token));
  const confirm = await read(sourcePaths[5]);
  assert.ok(confirm.includes("cancelButton.value?.focus()"));
  assert.ok(confirm.includes("returnFocus?.focus()"));
  assert.ok(confirm.includes("previousBodyOverflow"));
  assert.ok(!(await read(sourcePaths[4])).includes(":destructive="));
  sourceChecks.push(
    "Static source route/ConfirmDialog: private GET/default14s and abort, origin/operate/key guarded two POSTs; two non-destructive confirmation-word consumers, cancel focus/escape/tab/return/scroll contract. Static binding is not real RBAC/session or shared modal execution.",
  );
  return {
    data: {
      sourcePaths,
      sourceChecks,
      datasets,
      labels,
      recoveryResults,
      clock: now.toISOString(),
      provenance: "Synthetic source outputs; original E2E independent; no live scheduler requests.",
    },
    logic,
  };
}
