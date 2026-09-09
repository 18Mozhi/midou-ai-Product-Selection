import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import ts from "typescript";

// Executes existing functions with inert dependencies. Never opens a database or network.
export async function buildBackupRecoveryDesignData(repo) {
  const sourcePaths = [
    "apps/web/src/components/BackupRecoveryCenter.vue",
    "apps/web/src/components/ResponsiveDataView.vue",
    "apps/web/src/components/TableViewControls.vue",
    "apps/web/src/components/TechnicalDetails.vue",
    "apps/web/src/api-client.ts",
    "apps/api/src/backup-recovery-routes.ts",
    "apps/api/src/backup-recovery-service.ts",
    "apps/api/src/mysql-backup-recovery-repository.ts",
    "config/route-catalog.json",
    "packages/config/src/index.ts",
    "tests/e2e/m07-04-backup-recovery.spec.ts",
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
  const now = new Date("2026-09-09T04:00:00.000Z"),
    policy = {
      primaryRegion: "惠州",
      recoveryRegion: "惠州",
      rpoMinutes: 15,
      rtoMinutes: 240,
      maximumDrillAgeDays: 90,
    },
    input = {
      actorId: "synthetic-operator",
      requestId: "synthetic-request",
      traceId: "synthetic-trace",
      now,
    },
    finished = (days) => new Date(now.getTime() - days * 86400000).toISOString();
  const box = { Date, Number, Error };
  vm.createContext(box);
  vm.runInContext(
    compile(strip(await read(sourcePaths[6]))) + "\nglobalThis.Service=BackupRecoveryService;",
    box,
  );
  const run = (type, age) => ({
    id: `synthetic-${type}`,
    run_type: type,
    scope_type: "platform",
    status: "verified",
    primary_region: "惠州",
    recovery_region: "惠州",
    rpo_target_minutes: 15,
    rto_target_minutes: 240,
    actual_rpo_minutes: type === "backup" ? 5 : null,
    actual_rto_minutes: type === "restore_drill" ? 42 : null,
    source_cutoff_at: finished(age),
    started_at: finished(age + 0.03),
    finished_at: finished(age),
    isolated: true,
    encrypted: true,
    integrity_verified: true,
    permission_boundary_verified: true,
    audit_chain_verified: true,
    evidence_hash_verified: true,
    failure_code: null,
    request_id: `synthetic-${type}-request`,
    trace_id: `synthetic-${type}-trace`,
  });
  const kinds = ["mysql_full", "mysql_binlog", "evidence", "export", "config"],
    runs = [run("backup", 0.1), run("restore_drill", 84)],
    assets = kinds.flatMap((kind, i) =>
      ["primary_backup", "recovery_copy"].map((role) => ({
        run_id: "synthetic-backup",
        asset_kind: kind,
        region: "惠州",
        storage_role: role,
        bundle_count: i + 1,
        latest_created_at: finished(0.1),
        size_bytes: (i + 1) * 1048576,
        encrypted: true,
        integrity_verified: true,
      })),
    ),
    datasets = {};
  async function add(key, mutate = () => {}, policyPatch = {}) {
    const result = plain({ runs, assets });
    mutate(result);
    datasets[key] = plain(
      await new box.Service(
        { read: async () => result },
        { ...policy, ...policyPatch },
        () => now,
      ).read(input),
    );
  }
  await add("verified");
  await add("empty", (r) => {
    r.runs = [];
    r.assets = [];
  });
  await add("blocked", (r) => {
    r.runs[0].integrity_verified = false;
    r.runs[1].audit_chain_verified = false;
    r.assets = r.assets.filter((a) => a.storage_role === "primary_backup");
  });
  await add("stale", (r) => {
    r.runs[1].finished_at = finished(91);
  });
  await add("no-drill", (r) => {
    r.runs = r.runs.slice(0, 1);
  });
  await add("no-assets", (r) => {
    r.assets = [];
  });
  await add("rpo-over", (r) => {
    r.runs[0].actual_rpo_minutes = 16;
  });
  await add("rto-over", (r) => {
    r.runs[1].actual_rto_minutes = 241;
  });
  await add("null-measurements", (r) => {
    r.runs[0].actual_rpo_minutes = null;
    r.runs[1].actual_rto_minutes = null;
  });
  await add("negative-measurements", (r) => {
    r.runs[0].actual_rpo_minutes = -1;
    r.runs[1].actual_rto_minutes = -1;
  });
  await add("no-finished-at", (r) => {
    r.runs[1].finished_at = null;
  });
  await add("due-now", (r) => {
    r.runs[1].finished_at = finished(90);
  });
  await add("past-exact-expiry", (r) => {
    r.runs[1].finished_at = finished(90.5);
  });
  await add("future-drill", (r) => {
    r.runs[1].finished_at = finished(-1);
  });
  await add("blocked-stale", (r) => {
    r.runs[1].finished_at = finished(91);
    r.runs[0].encrypted = false;
  });
  await add("window-no-backup", (r) => {
    r.runs = Array.from({ length: 20 }, (_, i) => ({
      ...run("restore_drill", i),
      id: `synthetic-drill-${i}`,
    }));
  });
  await add("one-recovery-kind", (r) => {
    r.assets = r.assets.filter((a) => a.asset_kind === "mysql_full");
  });
  await add("bad-assets", (r) => {
    r.assets.forEach((a) => {
      a.encrypted = false;
      a.integrity_verified = false;
    });
  });
  await add("zero-size", (r) => {
    r.assets[0].size_bytes = 0;
    r.assets[0].bundle_count = 0;
  });
  await add("long", (r) => {
    r.assets[0].region = "合成长区域标识-".repeat(14);
    r.runs[1].failure_code = "synthetic-long-code-".repeat(10);
  });
  await add(
    "policy-30",
    (r) => {
      r.runs[1].finished_at = finished(24);
    },
    { maximumDrillAgeDays: 30 },
  );
  await add("policy-120", () => {}, { maximumDrillAgeDays: 120 });
  for (const flag of [
    "isolated",
    "encrypted",
    "integrity_verified",
    "permission_boundary_verified",
    "audit_chain_verified",
    "evidence_hash_verified",
  ])
    await add("drill-" + flag, (r) => {
      r.runs[1][flag] = false;
    });
  const fixture = ast(await read(sourcePaths[10]))
    .statements.flatMap((s) =>
      ts.isVariableStatement(s) ? [...s.declarationList.declarations] : [],
    )
    .find((d) => d.name.getText() === "base");
  assert.ok(fixture);
  datasets.original = {
    ...plain(vm.runInNewContext("(" + fixture.initializer.getText() + ")")),
    state: "blocked",
  };
  assert.equal(datasets.verified.state, "verified");
  assert.equal(datasets.empty.state, "empty");
  assert.equal(datasets.blocked.state, "blocked");
  assert.equal(datasets.stale.state, "stale");
  for (const k of [
    "null-measurements",
    "negative-measurements",
    "no-finished-at",
    "due-now",
    "past-exact-expiry",
    "future-drill",
    "one-recovery-kind",
  ])
    assert.equal(datasets[k].state, "verified", k);
  assert.equal(datasets["past-exact-expiry"].drill_age_days, 90);
  assert.equal(datasets["past-exact-expiry"].days_until_drill_expiry, 0);
  assert.equal(datasets["no-finished-at"].drill_expires_at, null);
  assert.equal(datasets["window-no-backup"].state, "empty");
  assert.equal(datasets["window-no-backup"].targets.length, 10);
  assert.equal(datasets["blocked-stale"].blockers.length, 2);
  for (const flag of [
    "isolated",
    "encrypted",
    "integrity_verified",
    "permission_boundary_verified",
    "audit_chain_verified",
    "evidence_hash_verified",
  ])
    assert.equal(datasets["drill-" + flag].state, "blocked");
  const sourceChecks = [
    "Actual service executed: four states, four blocker codes, six drill flags, RPO/RTO limits, null/negative measurements, no finish, exact/half-day/91-day expiry, future finish, 20-run window mismatch, one recovery asset kind, policy 30/120; synthetic repository, no SQL.",
  ];

  const script = (await read(sourcePaths[0])).split(/<script setup[^>]*>/)[1].split("</script>")[0];
  class Failure extends Error {
    constructor(kind) {
      super(kind);
      this.kind = kind;
      this.requestId = "synthetic-failure";
      this.actionHint = "隔离测试提示";
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
        ref: (v) => ({ value: v }),
        computed: (fn) => ({
          get value() {
            return fn();
          },
        }),
        defineProps: () => ({ apiBaseUrl: "/inert" }),
        ApiClientError: Failure,
        onMounted: (fn) => {
          hooks.mount = fn;
        },
        onBeforeUnmount: (fn) => {
          hooks.unmount = fn;
        },
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
        "\nglobalThis.ui={load,state,data,refreshing,refreshFailure,refreshNotice,drillReminder,assetText,roleText,blockerText};",
      ctx,
    );
    return { ...ctx.ui, calls, timers, hooks };
  }
  for (const kind of ["expired", "forbidden", "rate_limited", "unavailable"]) {
    for (const retained of [false, true]) {
      const m = mount();
      if (retained) {
        const p = m.load();
        m.calls[0].resolve({ data: datasets.verified, request_id: "synthetic-success" });
        await p;
      }
      const p = m.load();
      await m.load();
      assert.equal(m.calls.length, retained ? 2 : 1);
      const call = m.calls.at(-1);
      assert.equal(call.url, "/platform/operations/backup-recovery");
      assert.equal(call.options.requestId, call.options.traceId);
      call.reject(new Failure(kind));
      await p;
      const keep = retained && !["expired", "forbidden"].includes(kind);
      assert.equal(Boolean(m.data.value), keep);
      assert.equal(keep ? m.refreshFailure.value : m.state.value, kind);
    }
  }
  for (const retained of [false, true]) {
    const m = mount();
    if (retained) {
      const p = m.load();
      m.calls[0].resolve({ data: datasets.verified });
      await p;
    }
    const p = m.load();
    assert.equal(m.timers.at(-1).ms, 15000);
    m.timers.at(-1).fn();
    await p;
    assert.equal(retained ? m.refreshFailure.value : m.state.value, "timeout");
    assert.equal(Boolean(m.data.value), retained);
  }
  const m = mount(),
    pending = m.load();
  m.hooks.unmount();
  await pending;
  assert.equal(m.calls[0].options.signal.aborted, true);
  assert.equal(m.data.value, null);
  assert.equal(m.drillReminder(0), "今天到期");
  assert.equal(m.drillReminder(-1), "已到期 1 天");
  assert.equal(m.drillReminder(null), "尚无演练证据");
  sourceChecks.push(
    "Actual Vue script: single-flight, exact GET/correlation IDs, 401/403 clears snapshot, 429/unavailable preserves snapshot only when present, 15-second timeout with/without snapshot, unmount abort, signed/null reminder. Inert hooks, not mounted Vue or preserve lifecycle.",
  );

  const events = [],
    sqls = [],
    rawRun = { ...runs[0], actual_rpo_minutes: null };
  for (const f of [
    "isolated",
    "encrypted",
    "integrity_verified",
    "permission_boundary_verified",
    "audit_chain_verified",
    "evidence_hash_verified",
  ])
    rawRun[f] = 1;
  let failAudit = false;
  const connection = {
    beginTransaction: async () => events.push("begin"),
    commit: async () => events.push("commit"),
    rollback: async () => events.push("rollback"),
    release: () => events.push("release"),
    query: async (sql, params) => {
      sqls.push({ sql, params });
      if (sql.startsWith("INSERT")) {
        if (failAudit) throw new Error("synthetic audit failure");
        return [];
      }
      return [
        sql.includes("SELECT id,run_type")
          ? [rawRun]
          : [
              {
                ...assets[0],
                encrypted: 1,
                integrity_verified: 0,
                size_bytes: "1048576",
                bundle_count: "1",
              },
            ],
      ];
    },
  };
  const rb = { Date, Number, randomUUID };
  vm.createContext(rb);
  vm.runInContext(
    compile(strip(await read(sourcePaths[7]))) +
      "\nglobalThis.Repository=MySqlBackupRecoveryRepository;",
    rb,
  );
  const repository = new rb.Repository({ getConnection: async () => connection });
  const result = await repository.read(input);
  assert.equal(result.runs[0].actual_rpo_minutes, null);
  assert.equal(result.assets[0].integrity_verified, false);
  assert.deepEqual(events, ["begin", "commit", "release"]);
  assert.match(sqls[0].sql, /ORDER BY started_at DESC LIMIT 20/);
  assert.match(sqls[1].sql, /MIN\(a.encrypted\)/);
  assert.match(sqls[1].sql, /WHERE run_type='backup'.*LIMIT 1/);
  assert.match(sqls[2].sql, /platform.backup_recovery.read/);
  assert.equal(JSON.parse(sqls[2].params[4]).asset_group_count, 1);
  events.length = 0;
  failAudit = true;
  await assert.rejects(repository.read(input), /synthetic audit failure/);
  assert.deepEqual(events, ["begin", "rollback", "release"]);
  sourceChecks.push(
    "Actual repository: recent-20 runs SQL, globally latest backup asset aggregation, numeric/null/boolean mapping, read audit metadata, commit and audit-failure rollback/release; inert connection does not execute SQL or prove real MySQL transaction.",
  );
  const route = await read(sourcePaths[5]);
  assert.equal((route.match(/app\.get\(/g) || []).length, 1);
  assert.ok(!/app\.(post|put|patch|delete)\(/.test(route));
  assert.ok(
    route.indexOf("await options.authorization.authorize") < route.indexOf("timeout = setTimeout"),
  );
  assert.match(route, /14_000/);
  assert.match(route, /private, no-store/);
  sourceChecks.push(
    "Static route inspection only: one GET, no mutation routes, platform:operate authorization precedes the 14-second read timer, private/no-store. No real authentication, API timeout, audit or recovery tested.",
  );
  return {
    sourcePaths,
    sourceChecks,
    datasets,
    clock: now.toISOString(),
    provenance:
      "Synthetic service outputs plus original partial E2E base (separate); no live production records.",
  };
}
