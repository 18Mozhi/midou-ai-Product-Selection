import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID, createHash } from "node:crypto";
import { EventEmitter } from "node:events";

// Run actual source with inert SQL/statfs/access and memory-only hash streams.
export async function buildFilesDesignData(repo) {
  const sourcePaths = [
      "packages/storage/src/index.ts",
      "apps/api/src/file-resilience-probe.ts",
      "apps/api/src/file-resilience-service.ts",
      "apps/api/src/file-resilience-repository.ts",
      "apps/api/src/file-resilience-routes.ts",
      "apps/web/src/components/FileResilienceCenter.vue",
      "apps/web/src/components/TechnicalDetails.vue",
      "tests/e2e/m08-04-file-resilience.spec.ts",
      "infra/baota/local-file-storage-manifest.json",
      "packages/config/src/index.ts",
      "packages/contracts/src/index.ts",
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
      }).outputText,
    scopeDecl = ast(await read(sourcePaths[10]))
      .statements.find(
        (n) => ts.isFunctionDeclaration(n) && n.name?.text === "assertOrganizationScope",
      )
      .getFullText(),
    box = { Date, Number, Error, ...path };
  vm.createContext(box);
  vm.runInContext(
    compile(strip(scopeDecl) + "\n" + strip(await read(sourcePaths[0]))) +
      "\nglobalThis.evaluateFileResilience=evaluateFileResilience;globalThis.buildScopedFilePath=buildScopedFilePath;",
    box,
  );
  vm.runInContext(
    compile(strip(await read(sourcePaths[2]))) + "\nglobalThis.Service=FileResilienceService;",
    box,
  );
  const now = new Date("2026-09-09T08:00:00.000Z"),
    ago = (d) => new Date(now.getTime() - d * 86400000),
    policy = {
      usageWarningBasisPoints: 7500,
      usageStopBasisPoints: 9000,
      maximumRecoveryDrillAgeDays: 90,
    },
    datasets = {},
    labels = {},
    snapshots = {},
    runs = {},
    payload = Buffer.from("synthetic file content only"),
    digest = createHash("sha256").update(payload).digest("hex"),
    probeSource = await read(sourcePaths[1]);
  async function probe(mutate = () => {}, signal) {
    const roots = ["evidence", "export", "temp"].map((k) => path.resolve(repo, "synthetic-p69", k)),
      input = {
        roots,
        publicRoot: path.resolve(repo, "synthetic-p69", "public"),
        limit: 20,
        maxAge: 90,
        fs: roots.map(() => ({ blocks: 100000, bsize: 4096, bavail: 60000 })),
        accessFail: [],
        statFail: [],
        missing: false,
        abortInStream: null,
        totals: [
          { active_files: 100, indexed_bytes: 20000000 },
          { active_files: 30, indexed_bytes: 5000000 },
        ],
        evidence: Array.from({ length: 2 }, (_, i) => ({
          relative_path: "evidence-" + i,
          content_sha256: digest,
        })),
        exports: [
          {
            organization_id: "synthetic-org",
            workspace_id: "synthetic-work",
            id: "synthetic-export",
            filename: "synthetic.csv",
            content_sha256: digest,
          },
        ],
        recovery: [
          {
            id: "synthetic-backup",
            run_type: "backup",
            status: "verified",
            encrypted: 1,
            integrity_verified: 1,
          },
          {
            id: "synthetic-drill",
            run_type: "restore_drill",
            status: "verified",
            finished_at: ago(1),
            isolated: 1,
            encrypted: 1,
            integrity_verified: 1,
            permission_boundary_verified: 1,
            audit_chain_verified: 1,
            evidence_hash_verified: 1,
          },
        ],
        assets: [
          { asset_kind: "evidence", encrypted: 1, integrity_verified: 1 },
          { asset_kind: "export", encrypted: 1, integrity_verified: 1 },
        ],
        historyFail: false,
        assetsFail: false,
      };
    mutate(input);
    const queries = [],
      streams = [];
    const pool = {
      query: async (sql, params = []) => {
        queries.push({ sql, params });
        if (sql.startsWith("SELECT COUNT"))
          return [[sql.includes("FROM file_assets") ? input.totals[0] : input.totals[1]]];
        if (sql.startsWith("SELECT relative_path")) return [input.evidence.slice(0, params[0])];
        if (sql.startsWith("SELECT organization_id")) return [input.exports.slice(0, params[0])];
        if (sql.includes("FROM backup_recovery_runs")) {
          if (input.historyFail) throw new Error("inert history");
          return [input.recovery];
        }
        if (sql.includes("FROM backup_recovery_assets")) {
          if (input.assetsFail) throw new Error("inert assets");
          return [input.assets];
        }
        throw new Error("Unexpected inert SQL");
      },
    };
    const pb = {
      Date,
      Number,
      Error,
      process: { cwd: () => repo },
      ...path,
      createHash,
      buildScopedFilePath: box.buildScopedFilePath,
      constants: { R_OK: 4, W_OK: 2 },
      access: async (p, mode) => {
        assert.equal(mode, 6);
        if (input.accessFail.includes(input.roots.indexOf(p))) throw new Error("inert access");
      },
      statfs: async (p) => {
        const i = input.roots.indexOf(p);
        if (input.statFail.includes(i)) throw new Error("inert statfs");
        return input.fs[i];
      },
      createReadStream: async function* (p, options) {
        assert.equal(options.signal, signal);
        streams.push(p);
        if (input.missing) throw new Error("inert read");
        if (input.abortInStream) input.abortInStream.abort();
        yield payload;
      },
    };
    vm.createContext(pb);
    vm.runInContext(compile(strip(probeSource)) + "\nglobalThis.Probe=FileResilienceProbe;", pb);
    const instance = new pb.Probe(
        pool,
        ...input.roots,
        input.limit,
        input.maxAge,
        input.publicRoot,
        () => now,
      ),
      snapshot = plain(await instance.snapshot(signal));
    return { snapshot, queries, streamCount: streams.length };
  }
  const readyRun = await probe(),
    base = readyRun.snapshot;
  assert.equal(base.checksumSampledFiles, 3);
  assert.equal(base.checksumVerifiedFiles, 3);
  assert.equal(base.roots[2].activeFiles, 0);
  assert.equal(base.roots[2].indexedBytes, 0);
  async function add(k, label, snapshot = base, patch = {}) {
    snapshots[k] = plain(snapshot);
    let writes = 0;
    datasets[k] = plain(
      await new box.Service(
        { snapshot: async () => snapshot },
        { record: async () => writes++ },
        { ...policy, ...patch },
        () => now,
      ).read({ actorId: "synthetic", requestId: "synthetic", traceId: "synthetic" }),
    );
    assert.equal(writes, 1);
    labels[k] = label;
  }
  await add("ready", "三目录与三个样本的源返回");
  const cases = [
    ["root-count", "仅两目录（评估边界）", (s) => s.roots.pop(), "file_root_unavailable"],
    ["roots-empty", "未返回目录（评估边界）", (s) => (s.roots = []), "file_root_unavailable"],
    [
      "not-writable",
      "可用但不可写（评估边界）",
      (s) => (s.roots[1].writable = false),
      "file_root_unavailable",
    ],
    [
      "public-exposed",
      "目录落在静态根内",
      (s) => (s.publicDirectoryExposed = true),
      "file_root_publicly_exposed",
    ],
    [
      "shared-boundary",
      "非预期共享（评估边界）",
      (s) => (s.sharedStorageEnabled = true),
      "shared_storage_unexpected",
    ],
    [
      "backup-boundary",
      "非预期备用机（评估边界）",
      (s) => (s.backupServerUsed = true),
      "backup_server_unexpected",
    ],
    [
      "capacity-warning",
      "75%预警边界",
      (s) => (s.roots[0].availableBytes = s.roots[0].totalBytes * 0.25),
      "file_capacity_warning",
    ],
    [
      "capacity-stop",
      "90%停止边界",
      (s) => (s.roots[1].availableBytes = s.roots[1].totalBytes * 0.1),
      "file_capacity_stop",
    ],
    [
      "recovery-unencrypted",
      "加密副本条件未满足",
      (s) => (s.encryptedSameHostCopy = false),
      "file_recovery_unverified",
    ],
    [
      "recovery-unisolated",
      "隔离恢复条件未满足",
      (s) => (s.isolatedRestoreVerified = false),
      "file_recovery_unverified",
    ],
    [
      "capacity-unknown",
      "容量0但可用（评估边界）",
      (s) => (s.roots[2].totalBytes = 0),
      "file_capacity_stop",
    ],
  ];
  for (const [k, label, mutate, code] of cases) {
    const s = plain(base);
    mutate(s);
    await add(k, label, s);
    assert.ok(
      datasets[k].findings.some((f) => f.code === code),
      k,
    );
  }
  const pc = [
    ["root-access-failed", "导出根访问失败", (x) => (x.accessFail = [1])],
    ["root-stat-failed", "临时根容量读取失败", (x) => (x.statFail = [2])],
    ["all-roots-failed", "三个根访问均失败", (x) => (x.accessFail = [0, 1, 2])],
    ["same-filesystem", "同盘相同水位不相加", () => {}],
    ["measured-zero", "文件系统真实零用量", (x) => x.fs.forEach((v) => (v.bavail = v.blocks))],
    ["over-capacity", "可用空间负值导致比例封顶", (x) => (x.fs[0].bavail = -100)],
    ["negative-ratio", "可用空间超过总量（源负比例）", (x) => (x.fs[0].bavail = 110000)],
    [
      "no-samples",
      "活动索引非零但本次样本为空",
      (x) => {
        x.evidence = [];
        x.exports = [];
      },
    ],
    [
      "no-assets",
      "无活动资产与样本",
      (x) => {
        x.totals = [
          { active_files: 0, indexed_bytes: 0 },
          { active_files: 0, indexed_bytes: 0 },
        ];
        x.evidence = [];
        x.exports = [];
      },
    ],
    [
      "evidence-first",
      "证据占满抽样名额",
      (x) => {
        x.limit = 2;
      },
    ],
    [
      "one-sample",
      "仅一个配置样本",
      (x) => {
        x.limit = 1;
      },
    ],
    [
      "all-mismatch",
      "所有样本校验不一致",
      (x) => {
        x.evidence.forEach((v) => (v.content_sha256 = "0".repeat(64)));
        x.exports.forEach((v) => (v.content_sha256 = "0".repeat(64)));
      },
    ],
    ["all-missing", "所有样本读取失败", (x) => (x.missing = true)],
    [
      "invalid-paths",
      "证据逃逸与导出片段非法",
      (x) => {
        x.evidence[0].relative_path = "../escape";
        x.exports[0].filename = "../escape";
      },
    ],
    ["recovery-empty", "没有恢复记录", (x) => (x.recovery = [])],
    ["recovery-history-failed", "恢复历史查询失败", (x) => (x.historyFail = true)],
    ["recovery-assets-failed", "恢复资产查询失败", (x) => (x.assetsFail = true)],
    ["recovery-asset-missing", "缺少导出恢复副本", (x) => x.assets.pop()],
    ["drill-not-isolated", "演练未隔离", (x) => (x.recovery[1].isolated = 0)],
    ["drill-stale", "略超90天但返回取整90", (x) => (x.recovery[1].finished_at = ago(90.001))],
    ["drill-boundary", "恰好90天", (x) => (x.recovery[1].finished_at = ago(90))],
    ["drill-null", "演练没有完成时间", (x) => (x.recovery[1].finished_at = null)],
    ["drill-future", "未来演练年龄归零", (x) => (x.recovery[1].finished_at = ago(-1))],
    ["public-probe", "实际路径包含检查命中", (x) => (x.publicRoot = x.roots[2])],
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
  for (const [k, label, mutate] of pc) {
    runs[k] = await probe(mutate);
    await add(k, label, runs[k].snapshot);
  }
  const nullAge = plain(base);
  nullAge.recoveryDrillAgeDays = null;
  await add("verified-null-age", "verified但年龄null（评估边界）", nullAge);
  await add("stricter-policy", "60天运行policy", snapshots["drill-boundary"], {
    maximumRecoveryDrillAgeDays: 60,
  });
  await add("relaxed-policy", "放宽policy不覆盖probe的stale", snapshots["drill-stale"], {
    maximumRecoveryDrillAgeDays: 120,
  });
  const long = plain(base);
  long.roots[0].activeFiles = 999999999999;
  long.roots[0].indexedBytes = 999999999999999;
  await add("long", "长数值布局压力（非生产）", long);
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
  labels.original = "独立原始E2E夹具";
  assert.equal(datasets["drill-stale"].state, "warning");
  assert.equal(datasets["drill-stale"].recovery.drill_age_days, 90);
  assert.equal(datasets["relaxed-policy"].state, "warning");
  assert.equal(datasets["no-samples"].state, "ready");
  assert.equal(datasets["verified-null-age"].state, "ready");
  assert.equal(datasets["negative-ratio"].directories[0].usage_basis_points, -1000);
  assert.equal(datasets["negative-ratio"].directories[0].used_bytes, 0);
  assert.equal(datasets["all-roots-failed"].directories[2].usage_basis_points, 10000);
  assert.equal(datasets["invalid-paths"].integrity.missing_files, 2);
  assert.equal(runs["invalid-paths"].streamCount, 1);
  assert.equal(
    runs["evidence-first"].queries.some((q) => q.sql.startsWith("SELECT organization_id")),
    false,
  );
  assert.equal(datasets["one-sample"].integrity.sampled_files, 1);
  assert.equal(datasets["public-probe"].public_access_enabled, false);
  assert.ok(datasets["public-probe"].findings.some((f) => f.code === "file_root_publicly_exposed"));
  assert.throws(
    () => box.evaluateFileResilience(base, { ...policy, usageWarningBasisPoints: 9000 }),
    /warning threshold/,
  );
  for (const d of Object.values(datasets))
    assert.doesNotMatch(
      JSON.stringify(d),
      /synthetic-org|synthetic-work|synthetic\.csv|content_sha256|relative_path|synthetic-p69/,
    );
  const c = new AbortController();
  await assert.rejects(probe((x) => (x.abortInStream = c), c.signal));
  assert.equal(c.signal.aborted, true);
  const before = new AbortController();
  before.abort();
  await assert.rejects(probe(() => {}, before.signal));
  const sourceChecks = [
    "Actual probe with inert SQL/access/statfs and memory-only SHA256 streams: three roots, retained index counts on access failure, evidence-first remaining-limit export sampling, valid/invalid paths, matching/missing/mismatch, temp excluded, signal before and during stream. SQL text/parameters executed against inert rows, not SQL engine, filesystem, ACL or real stream cancellation.",
    "Actual probe recovery and evaluator/service: recent20 backup/drill, evidence/export encrypted recovery assets, isolation/age rounding/future clamp, stale warning distinct from MySQL, null-age evaluator boundary, probe state versus runtime policy; zero-sample ready preserved, max filesystem usage not sum, 10000 unknown sentinel and negative raw ratio versus used_bytes clamp; public/shared/backup fixed flags never override findings. Original E2E separate; no real recovery or public exposure scan.",
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
          ["rootLabel", "rootPurpose", "percent"].includes(
            n.declarationList.declarations[0].name.getText(),
          ),
      )
      .map((n) => n.getFullText())
      .join("\n"),
    logic = compile(
      `window.FILES_LOGIC=function(){${decl}\nreturn {rootLabel,rootPurpose,percent};};`,
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
      assert.equal(m.calls.at(-1).url, "/platform/operations/files");
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
    "Actual Vue script: single-flight exact GET/IDs, 15s, null empty, auth clearing/transient retention, generic empty requestID and unmount abort. Root labels, purpose and one-decimal percent helpers extracted from source; source template progress names bound. Not mounted Vue/preserve or shared clipboard proof.",
  );
  for (const phase of ["before", "probe", "record"]) {
    const c = new AbortController();
    let records = 0,
      probes = 0;
    if (phase === "before") c.abort();
    const service = new box.Service(
      {
        snapshot: async (signal) => {
          assert.equal(signal, c.signal);
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
    compile(strip(await read(sourcePaths[3]))) + "\nglobalThis.Repo=FileResilienceRepository;",
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
      evaluation: box.evaluateFileResilience(base, policy),
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
    "Actual service abort checkpoints before/after probe and after record; actual repository inert connection verifies three inserts/commit, audit-fail rollback and abort after first insert rollback/release. Service passes signal to probe; cancellation after record may occur after its work. No running-SQL interruption, real durability or transaction proof.",
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
      "\nglobalThis.register=registerFileResilienceRoutes;",
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
          assert.equal(p, "/api/v1/platform/operations/files");
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
      await assert.rejects(p, (e) => e.code === "file_resilience_read_timeout");
      assert.equal(input.signal.aborted, true);
    } else if (outcome === "dependency")
      await assert.rejects(p, (e) => e.code === "file_resilience_dependency_unavailable");
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
