import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { createHash, randomUUID } from "node:crypto";
import ts from "typescript";

export async function buildLogDesignData(repo) {
  const sourcePaths = [
    "apps/web/src/components/PlatformLogCenter.vue",
    "apps/web/src/components/AuditedReasonDialog.vue",
    "apps/web/src/components/ResponsiveFilterDrawer.vue",
    "apps/web/src/components/ResponsiveDataView.vue",
    "apps/web/src/components/TableViewControls.vue",
    "apps/web/src/use-audited-reason.ts",
    "apps/web/src/use-modal-dialog.ts",
    "apps/web/src/api-client.ts",
    "apps/api/src/platform-dashboard-routes.ts",
    "apps/api/src/platform-dashboard-service.ts",
    "apps/api/src/mysql-platform-dashboard-repository.ts",
    "config/route-catalog.json",
    "apps/web/src/ui/status-labels.ts",
    "tests/e2e/m06-02-platform-dashboard.spec.ts",
  ];
  const read = (p) => readFile(path.join(repo, p), "utf8"),
    plain = (v) => JSON.parse(JSON.stringify(v)),
    ast = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true),
    compile = (s) =>
      ts.transpileModule(s, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
      }).outputText;
  const strip = (s) =>
    ast(s)
      .statements.filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText())
      .join("\n")
      .replaceAll("export ", "");
  const src = await read(sourcePaths[0]),
    script = src.split(/<script setup[^>]*>/)[1].split("</script>")[0],
    labels = strip(await read(sourcePaths[12]));
  const ref = (v) => ({ value: v }),
    computed = (f) => ({
      get value() {
        return f();
      },
    }),
    tick = async () => {
      for (let i = 0; i < 10; i++) await Promise.resolve();
    };
  class Failure extends Error {
    constructor(status = 403) {
      super("isolated");
      this.status = status;
      this.requestId = "synthetic-failure";
      this.actionHint = "隔离读取被拒绝";
    }
  }
  function mount(routeQuery = {}) {
    const calls = [],
      writes = [],
      asks = [],
      timers = [],
      hooks = {},
      links = [],
      revoked = [],
      route = { query: { ...routeQuery }, path: "/platform-admin/logs" };
    const box = {
      Date,
      Map,
      Set,
      Error,
      DOMException,
      AbortController,
      URLSearchParams,
      ref,
      computed,
      defineProps: () => ({ apiBaseUrl: "/inert" }),
      useRoute: () => route,
      useRouter: () => ({
        replace: async (v) => {
          route.query = v.query;
        },
      }),
      createApiClient: () => (url, options) =>
        new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })),
      createApiResponseClient: () => (url, options) =>
        new Promise((resolve, reject) => writes.push({ url, options, resolve, reject })),
      ApiClientError: Failure,
      watch: (_source, cb) => (hooks.watch = cb),
      onMounted: (cb) => (hooks.mount = cb),
      onBeforeUnmount: (cb) => (hooks.unmount = cb),
      useAuditedReason: () => ({
        ask: (input) => new Promise((resolve) => asks.push({ input, resolve })),
      }),
      window: {
        setTimeout: (cb, ms) => {
          timers.push({ cb, ms });
          return timers.length;
        },
        clearTimeout: () => {},
      },
      URL: {
        createObjectURL: () => "blob:synthetic-only",
        revokeObjectURL: (url) => revoked.push(url),
      },
      document: {
        createElement: () => {
          const a = { click: () => links.push({ href: a.href, download: a.download }) };
          return a;
        },
      },
    };
    vm.runInNewContext(
      compile(labels + "\n" + strip(script)) +
        "\nglobalThis.f={load,applyFilters,resetFilters,exportCsv,routeText,routeSource,traceChains,isException,taskLink,providerLink,sourceName,eventName,resourceName,logStatusName,when,shortId};globalThis.refs={items,summary,query,source,state,message,requestId,observedAt,refreshing,exporting};",
      box,
    );
    return { ...box, calls, writes, asks, timers, hooks, links, revoked, route };
  }
  const testAst = ast(await read(sourcePaths[13]));
  let fixture;
  function visit(n) {
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(testAst) === "env" &&
      n.arguments[0] &&
      ts.isObjectLiteralExpression(n.arguments[0]) &&
      n.arguments[0].properties.some(
        (p) =>
          p.name?.getText(testAst) === "domain" && p.initializer?.getText(testAst) === '"logs"',
      )
    )
      fixture = n.arguments[0];
    ts.forEachChild(n, visit);
  }
  visit(testAst);
  assert.ok(fixture);
  const fb = {};
  vm.runInNewContext(compile("globalThis.data=" + fixture.getText(testAst)), fb);
  const original = plain(fb.data),
    checks = [];
  const x = mount();
  x.refs.items.value = original.items;
  const chains = plain(x.f.traceChains.value);
  assert.equal(chains.length, 2);
  assert.deepEqual(
    chains[0].items.map((r) => r.source),
    ["api", "crawler"],
  );
  assert.equal(chains[0].exceptionCount, 1);
  const noTrace = original.items.map((r, i) => ({ ...r, id: `missing-${i}`, trace_id: "" }));
  x.refs.items.value = noTrace;
  assert.equal(x.f.traceChains.value.length, 3);
  for (const s of [
    "blocked_login",
    "failed_terminal",
    "timed_out",
    "dead_letter",
    "degraded",
    "denied",
  ])
    assert.ok(x.f.isException({ ...original.items[1], status: s }));
  assert.ok(
    x.f.isException({ ...original.items[1], status: "succeeded", error_code: "synthetic_error" }),
  );
  assert.equal(x.f.taskLink(original.items[1]), "");
  assert.equal(x.f.providerLink(original.items[2]), "");
  checks.push(
    "Actual Vue computed groups by trace with independent missing-source-ID keys, preserves group insertion order and sorts events chronologically; exception uses error_code or status substrings; task/provider links only use returned IDs. Group time is not full-chain duration.",
  );
  {
    const y = mount({ keep: "yes", query: " old ", source: "worker" });
    const first = y.hooks.mount();
    await tick();
    assert.equal(y.calls.length, 1);
    assert.ok(y.calls[0].url.includes("status=worker"));
    assert.equal(y.timers[0].ms, 15000);
    y.route.query = { keep: "yes", query: "new", source: "crawler" };
    y.hooks.watch();
    await tick();
    assert.equal(y.calls.length, 1);
    y.calls[0].resolve({ data: original, request_id: "old-scope" });
    await first;
    assert.equal(y.refs.query.value, "new");
    assert.equal(y.refs.items.value.length, 3);
    const denied = y.f.load();
    await tick();
    y.calls[1].reject(new Failure());
    await denied;
    assert.equal(y.refs.state.value, "ready");
    assert.equal(y.refs.items.value.length, 3);
    assert.match(y.refs.message.value, /保留/);
    const late = y.f.load();
    await tick();
    y.hooks.unmount();
    y.calls[2].resolve({ data: { ...original, items: [] }, request_id: "late" });
    await late;
    assert.equal(y.refs.items.value.length, 3);
    const z = mount();
    const timeout = z.f.load();
    await tick();
    z.timers[0].cb();
    z.calls[0].reject(new DOMException("abort", "AbortError"));
    await timeout;
    assert.equal(z.refs.state.value, "error");
    assert.match(z.refs.message.value, /保留上次成功日志/);
    assert.equal(z.refs.items.value.length, 0);
    const w = mount({ keep: "yes", source: "invalid" });
    await w.hooks.mount();
    assert.equal(w.route.query.source, undefined);
    w.refs.query.value = " x ";
    w.refs.source.value = "api";
    await w.f.applyFilters();
    assert.equal(w.route.query.keep, "yes");
    assert.equal(w.route.query.query, "x");
    assert.equal(w.route.query.source, "api");
    checks.push(
      "Actual Vue load/lifecycle with explicit hooks: GET source maps to status, 15s abort, single-flight drops changed-URL read and leaves new draft/old rows; ready 403 retains snapshot, first timeout incorrectly claims previous logs; unmount sequence rejects late GET; invalid source cleanup and router.replace preserve unrelated keys. Not mounted Vue/KeepAlive proof.",
    );
  }
  {
    const y = mount({ query: "old", source: "worker" }),
      cancel = y.f.exportCsv();
    await tick();
    assert.equal(y.refs.exporting.value, false);
    y.asks[0].resolve(null);
    await cancel;
    assert.equal(y.writes.length, 0);
    const pending = y.f.exportCsv();
    await tick();
    y.route.query = { query: "new", source: "crawler" };
    y.asks[1].resolve("故障排查");
    await tick();
    assert.deepEqual(plain(y.writes[0].options.body), {
      query: "new",
      source: "crawler",
      reason: "故障排查",
    });
    const duplicate = y.f.exportCsv();
    await tick();
    y.asks[2].resolve("另一原因");
    await tick();
    assert.equal(y.writes.length, 2);
    y.hooks.unmount();
    for (const w of y.writes)
      w.resolve({ headers: { get: () => "synthetic-export" }, blob: async () => ({}) });
    await Promise.all([pending, duplicate]);
    assert.equal(y.links.length, 2);
    assert.equal(y.revoked.length, 2);
    assert.equal(y.writes[0].options.signal, undefined);
    checks.push(
      "Actual Vue exportCsv with inert response/blob/link: reason cancellation sends nothing, route changes during reason alter POST scope, no handler single-flight allows two writes, unmount does not prevent late download, object URLs revoked. No file, HTTP or audit written; raw client assigns a fresh key on each independent POST call.",
    );
  }
  const method = (s, cls, name) => {
    const a = ast(s);
    return a.statements
      .find((n) => ts.isClassDeclaration(n) && n.name.text === cls)
      .members.find((n) => n.name?.getText(a) === name)
      .getText(a);
  };
  const service = await read(sourcePaths[9]),
    sb = { PlatformDashboardError: Failure };
  vm.runInNewContext(
    compile(
      `globalThis.Service=class {${method(service, "PlatformDashboardService", "management")} ${method(service, "PlatformDashboardService", "exportLogs")}}`,
    ),
    sb,
  );
  const svc = new sb.Service();
  svc.repository = { readManagement: (i) => i, exportLogs: (i) => i };
  svc.now = () => new Date("2026-09-09T04:00:00Z");
  for (const source of ["", "api", "worker", "crawler"]) {
    assert.equal(svc.management({ domain: "logs", status: source }).status, source);
    assert.equal(svc.exportLogs({ source, reason: "原因" }, {}).source, source);
  }
  for (const reason of ["x", "x".repeat(301)]) assert.throws(() => svc.exportLogs({ reason }, {}));
  assert.equal(svc.exportLogs({ reason: "  原因  " }, {}).reason, "原因");
  assert.throws(() => svc.management({ domain: "logs", query: "x".repeat(121) }));
  assert.throws(() => svc.exportLogs({ source: "invalid", reason: "原因" }, {}));
  checks.push(
    "Actual service methods validate four sources, GET query/status and export query 120, trimmed reason 2–300 and exact export route/context. No service permission claims; route context/origin/key are separately source-bound.",
  );
  const repository = await read(sourcePaths[10]),
    rb = { PlatformDashboardError: Failure, createHash, randomUUID, Date };
  vm.runInNewContext(
    compile(
      `const iso=(v:any)=>(v?new Date(v).toISOString():null);globalThis.Repository=class {${method(repository, "MySqlPlatformDashboardRepository", "readManagement")} ${method(repository, "MySqlPlatformDashboardRepository", "exportLogs")}}`,
    ),
    rb,
  );
  const r = new rb.Repository(),
    sql = [];
  r.now = svc.now;
  r.pool = {
    query: async (q, p) => {
      sql.push({ q, p });
      return [original.items];
    },
  };
  const current = plain(
    await r.readManagement({ domain: "logs", query: "a%_\\", status: "crawler" }),
  );
  assert.deepEqual(current.summary, { total: 3, api: 1, worker: 1, crawler: 1 });
  assert.equal(current.limit, 200);
  assert.equal(sql[0].p.length, 21);
  assert.match(sql[0].p[2], /\\%\\_\\\\/);
  assert.match(sql[0].q, /ORDER BY occurred_at DESC,id DESC LIMIT 200/);
  assert.match(sql[0].q, /r.started_at occurred_at/);
  assert.match(sql[0].q, /LEFT JOIN browser_collection_jobs/);
  assert.equal(sql[0].q.includes("p.name LIKE"), false);
  assert.equal(sql[0].q.includes("j.collection_task_id LIKE"), false);
  checks.push(
    "Actual readManagement logs branch against inert SQL adapter: escaped LIKE parameters, three source-specific predicates/UNION, started_at crawler time, actual job/provider joins, descending200 cap and returned-row summary. Crawler query does not search linked task/provider/name; SQL not executed and content redaction not attested.",
  );
  {
    const events = [],
      input = {
        query: "trace",
        source: "worker",
        reason: "原因",
        actorId: "actor",
        route: "/platform/management/logs/exports",
        idempotencyKey: "synthetic-key",
        requestId: "request",
        traceId: "trace",
        now: svc.now(),
      },
      signature = JSON.stringify({
        query: input.query,
        source: input.source,
        reason: input.reason,
      });
    let replay = null,
      acquired = 1,
      saved;
    r.readManagement = async (i) => {
      events.push("read");
      assert.equal(i.status, "worker");
      return current;
    };
    const c = {
      query: async (q, p) => {
        events.push(q);
        if (q.includes("GET_LOCK")) return [[{ acquired }]];
        if (q.startsWith("INSERT")) {
          const meta = JSON.parse(p[4]);
          assert.equal(meta.row_count, 3);
          assert.equal(meta.reason, "原因");
        }
        return [[]];
      },
      beginTransaction: async () => events.push("begin"),
      commit: async () => events.push("commit"),
      rollback: async () => events.push("rollback"),
      release: () => events.push("release"),
    };
    r.pool = { getConnection: async () => c };
    r.replayOperation = async () => replay;
    r.saveOperation = async (_c, _i, _id, data) => (saved = plain(data));
    await r.exportLogs(input);
    assert.equal(events[0], "read");
    assert.equal(saved.idempotency_signature, signature);
    assert.ok(events.some((s) => s.includes("platform_audit_events")));
    assert.equal(events.at(-1), "release");
    replay = { ...saved, items: [] };
    assert.equal((await r.exportLogs(input)).items.length, 0);
    replay = { ...saved, idempotency_signature: "wrong" };
    await assert.rejects(r.exportLogs(input));
    assert.ok(events.includes("rollback"));
    acquired = 0;
    await assert.rejects(r.exportLogs(input));
    assert.equal(events.at(-1), "release");
    checks.push(
      "Actual export repository method with inert connection: rereads before lock/transaction, actor-route-key lock, audit records filters/reason/count, saves signature, replay returns saved rows, mismatched signature rolls back, busy and release paths checked. No MySQL lock/transaction/audit actually ran.",
    );
  }
  const routes = await read(sourcePaths[8]),
    routeAst = ast(routes);
  let handler;
  function findHandler(n) {
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(routeAst) === "app.post" &&
      n.arguments[0]?.getText(routeAst) === '"/api/v1/platform/management/logs/exports"'
    )
      handler = n.arguments[1];
    ts.forEachChild(n, findHandler);
  }
  findHandler(routeAst);
  assert.ok(handler);
  const csvDecl = routeAst.statements
    .find(
      (n) =>
        ts.isVariableStatement(n) &&
        n.declarationList.declarations.some((d) => d.name.getText(routeAst) === "csvCell"),
    )
    .getText(routeAst);
  let columns;
  function findColumns(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText(routeAst) === "columns")
      columns = vm.runInNewContext(n.initializer.getText(routeAst));
    ts.forEachChild(n, findColumns);
  }
  findColumns(handler);
  assert.equal(columns.length, 12);
  const routeBox = {
    ApiError: Failure,
    o: {
      webOrigin: "https://review.invalid",
      service: {
        exportLogs: async () => ({
          items: [{ ...original.items[0], provider_name: '=SUM(1,2)"' }],
        }),
      },
    },
    context: async () => ({ requestId: "request", traceId: "trace" }),
    requireIdempotencyKey: () => "synthetic-key",
    Date,
  };
  vm.runInNewContext(
    compile(
      csvDecl + "\nglobalThis.handler=" + handler.getText(routeAst) + ";globalThis.cell=csvCell;",
    ),
    routeBox,
  );
  const reply = { header: () => reply };
  const csv = await routeBox.handler(
    { headers: { origin: "https://review.invalid" }, body: {} },
    reply,
  );
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.includes("'="));
  assert.ok(csv.includes('""'));
  assert.equal(csv.split("\r\n")[0].slice(1), columns.join(","));
  for (const char of ["=", "+", "-", "@"]) assert.equal(routeBox.cell(char + "a"), `"'${char}a"`);
  assert.equal(routeBox.cell(" =a"), '" =a"');
  await assert.rejects(routeBox.handler({ headers: { origin: "https://other.invalid" } }, reply));
  checks.push(
    "Actual export route handler/csvCell with inert service/auth context: fixed12 columns, BOM/CRLF, quote escaping and leading =+-@ prefix, wrong origin rejection; whitespace-prefixed formulas are outside current guard. No download or real auth/key/session/RBAC execution.",
  );
  const statuses = [
    "blocked_login",
    "failed_terminal",
    "timed_out",
    "dead_letter",
    "degraded",
    "denied",
    "succeeded",
    "unknown_state",
  ];
  const synthetic = [
    ...original.items,
    ...statuses.map((status, i) => ({
      ...original.items[i % 3],
      id: `synthetic-${i}`,
      trace_id: i < 3 ? "synthetic-shared-chain" : `synthetic-chain-${i}`,
      status,
      error_code: i < 6 ? "synthetic_error" : null,
      occurred_at: `2026-08-18T11:${String(i).padStart(2, "0")}:00.000Z`,
    })),
  ];
  const snapshot = (items) => ({
    domain: "logs",
    items: [...items].sort(
      (a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at) || b.id.localeCompare(a.id),
    ),
    summary: {
      total: items.length,
      ...Object.fromEntries(
        ["api", "worker", "crawler"].map((s) => [s, items.filter((r) => r.source === s).length]),
      ),
    },
    limit: 200,
    observed_at: "2026-09-09T04:00:00.000Z",
  });
  const large = Array.from({ length: 200 }, (_, i) => ({
    ...original.items[i % 3],
    id: `synthetic-window-${i}`,
    trace_id: "synthetic-truncated-chain",
    occurred_at: new Date(Date.parse("2026-09-09T03:00:00Z") - i * 1000).toISOString(),
  }));
  const long = synthetic.map((r) => ({ ...r }));
  long[0] = {
    ...long[0],
    trace_id: "synthetic-" + "long-trace-".repeat(30),
    request_id: "synthetic-" + "long-request-".repeat(28),
    error_code: "synthetic_" + "long_error_".repeat(22),
    provider_name: "合成超长来源名称".repeat(30),
  };
  const functions = [
    "isException",
    "taskLink",
    "providerLink",
    "sourceName",
    "eventName",
    "resourceName",
    "logStatusName",
    "when",
    "shortId",
  ]
    .map((k) => `const ${k}=${x.f[k].toString()};`)
    .join("\n");
  const computedNode = ast(script)
    .statements.filter(ts.isVariableStatement)
    .flatMap((n) => [...n.declarationList.declarations])
    .find((d) => d.name.getText() === "traceChains")
    .initializer.arguments[0].getText();
  const logic = `(()=>{${compile(labels)}\n${functions}\nfunction chains(rows){const items={value:rows};return (${compile(
    `const f=${computedNode};`,
  )
    .replace(/^const f = /, "")
    .trim()
    .replace(
      /;$/,
      "",
    )})();}window.LOG_SOURCE={chains,isException,taskLink,providerLink,sourceName,eventName,resourceName,logStatusName,when,shortId};})();`;
  return {
    data: {
      sourcePaths,
      sourceChecks: checks,
      datasets: {
        original,
        current: snapshot(synthetic),
        missing: snapshot(noTrace),
        large: snapshot(large),
        long: snapshot(long),
        empty: snapshot([]),
      },
      columns: plain(columns),
      statuses,
    },
    logic,
  };
}
