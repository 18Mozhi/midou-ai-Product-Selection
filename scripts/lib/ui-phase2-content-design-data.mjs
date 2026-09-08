import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export async function buildContentDesignData(repo) {
  const sourcePaths = [
    "apps/web/src/components/use-platform-content-list.ts",
    "apps/web/src/components/use-platform-content-review.ts",
    "apps/web/src/components/platform-management-presentation.ts",
    "apps/web/src/components/PlatformManagementCenter.vue",
    "apps/web/src/components/PlatformManagementFilter.vue",
    "apps/web/src/components/PlatformManagementRecordList.vue",
    "apps/web/src/components/PlatformContentPagination.vue",
    "apps/web/src/components/ResponsiveDataView.vue",
    "apps/web/src/components/ResponsiveFilterDrawer.vue",
    "apps/web/src/components/TableViewControls.vue",
    "apps/web/src/use-modal-dialog.ts",
    "apps/api/src/platform-dashboard-service.ts",
    "apps/api/src/platform-dashboard-routes.ts",
    "apps/api/src/mysql-platform-dashboard-repository.ts",
    "tests/unit/platform-content.test.mjs",
    "tests/e2e/m06-02-platform-dashboard.spec.ts",
  ];
  const read = (f) => readFile(path.join(repo, f), "utf8");
  const parse = (s) => ts.createSourceFile("input.ts", s, ts.ScriptTarget.Latest, true);
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
  const ast = parse(await read(sourcePaths.at(-1)));
  let fixture;
  function walk(n, inTest = false) {
    if (ts.isCallExpression(n) && n.expression.getText(ast) === "test")
      inTest =
        n.arguments[0]?.text ===
        "platform completion renders trend and management without overflow or console errors";
    if (
      inTest &&
      ts.isCallExpression(n) &&
      n.expression.getText(ast) === "env" &&
      n.arguments[0]?.getText(ast).includes('domain: "content"')
    )
      fixture = n.arguments[0].getText(ast);
    ts.forEachChild(n, (c) => walk(c, inTest));
  }
  walk(ast);
  assert.ok(fixture, "original content E2E fixture");
  const box = {};
  vm.runInNewContext(compile(`globalThis.result=${fixture}`), box);
  const original = plain(box.result);
  assert.equal(original.items.length, 1);
  assert.equal(original.pagination.total, 135);
  const sources = await Promise.all(sourcePaths.slice(0, 3).map(read));
  const logic = `window.CONTENT_SOURCE=(b)=>{const {ref,window,URLSearchParams,AbortController,DOMException,Error}=b;${compile(sources.map(strip).join("\n"))}\nreturn {usePlatformContentList,usePlatformContentReview,platformManagementStateName};};`;
  const ticks = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  const ref = (value) => ({ value });
  function mount() {
    const b = { window: {} },
      calls = [],
      urls = [],
      timers = [];
    vm.runInNewContext(logic, b);
    const api = b.window.CONTENT_SOURCE({
      ref,
      window: {
        location: { search: "", pathname: "/platform-admin/content" },
        history: { replaceState: (_s, _t, url) => urls.push(url) },
        setTimeout: (fn, ms) => (timers.push({ fn, ms }), 1),
        clearTimeout: () => {},
      },
      URLSearchParams,
      AbortController,
      DOMException,
      Error,
    });
    const options = {
      domain: ref("content"),
      query: ref(""),
      status: ref(""),
      data: ref(null),
      state: ref("loading"),
      message: ref(""),
      refreshing: ref(false),
      busy: ref(""),
      request: (url, init) =>
        new Promise((resolve, reject) => calls.push({ url, init, resolve, reject })),
    };
    const list = api.usePlatformContentList({ ...options, reload: () => list.load() });
    const review = api.usePlatformContentReview({ ...options, reload: () => list.load() });
    return { api, options, list, review, calls, urls, timers };
  }
  const checks = [];
  const parent = await read(sourcePaths[3]);
  assert.ok(parent.includes('throw new Error(failure?.actionHint ?? "请求未完成")'));
  assert.ok(parent.includes("v-if=\"state !== 'ready'\""));
  assert.ok(parent.includes('<template v-else-if="data"'));
  {
    const { list, options, calls, urls, timers } = mount();
    options.query.value = " first ";
    const p1 = list.load(),
      p2 = list.load();
    assert.equal(calls[0].init.signal.aborted, true);
    assert.equal(timers[0].ms, 15000);
    calls[0].resolve(original);
    await p1;
    assert.equal(options.data.value, null);
    options.query.value = "unsubmitted";
    calls[1].resolve(original);
    await p2;
    assert.ok(calls[1].url.includes("query=first"));
    assert.ok(urls.at(-1).includes("query=unsubmitted"));
    const p3 = list.load();
    list.stop();
    calls[2].resolve({ ...original, items: [] });
    await p3;
    assert.equal(options.state.value, "empty");
    checks.push(
      "Actual list: 15s timeout, replacement abort/sequence; edited pending query changes success URL without changing request; stop alone does not invalidate ignored-abort response. These are source boundaries, not fixed production code.",
    );
  }
  {
    for (const retained of [false, true]) {
      const { list, options, calls, timers } = mount();
      if (retained) {
        options.data.value = original;
        options.state.value = "ready";
      }
      const p = list.load();
      timers[0].fn();
      calls[0].reject(new DOMException("aborted", "AbortError"));
      await p;
      assert.equal(options.state.value, retained ? "ready" : "error");
      assert.ok(options.message.value.includes("读取超时"));
    }
    checks.push(
      "Actual first and retained timeout states; parent wrapper discards structured failure kind and empty branch hides summary/list/pagination (static consumer boundary).",
    );
  }
  {
    const { review, calls, options } = mount();
    review.begin(original.items[0], "active");
    review.reason.value = " 原因 ";
    const p1 = review.submit(),
      p2 = review.submit();
    assert.equal(calls.length, 2);
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      status: "active",
      expected_version: 1,
      reason: "原因",
    });
    review.begin({ ...original.items[0], id: "new-item" }, "stale");
    calls[0].resolve({});
    await ticks();
    assert.equal(review.item.value, null);
    calls[2].reject(new Error("reload failed"));
    await p1;
    assert.equal(options.message.value, "内容状态已更新并写入审计记录。");
    calls[1].reject(new Error("second failed"));
    await p2;
    checks.push(
      "Actual review: same-status body, duplicate submit reaches two PATCH adapters; old response closes newly opened item; successful write hides reload error. No HTTP or business writes occurred.",
    );
  }
  const serviceBox = {};
  vm.runInNewContext(
    compile(
      strip(await read(sourcePaths[11])) +
        "\nglobalThis.Service=PlatformDashboardService;globalThis.DashboardError=PlatformDashboardError;",
    ),
    serviceBox,
  );
  {
    const calls = [],
      s = new serviceBox.Service({
        moderateTrend: (v) => (calls.push(plain(v)), v),
        readManagement: (v) => v,
      });
    for (const status of ["active", "irrelevant", "stale"]) {
      s.moderateTrend(
        original.items[0].id,
        { status, expected_version: "1", reason: " 依据 " },
        {},
      );
      assert.equal(calls.at(-1).expectedVersion, 1);
    }
    for (const body of [
      { status: "archived" },
      { expected_version: 0 },
      { reason: "一" },
      { reason: "字".repeat(301) },
    ])
      assert.throws(() =>
        s.moderateTrend(
          original.items[0].id,
          { status: "active", expected_version: 1, reason: "依据", ...body },
          {},
        ),
      );
    s.moderateTrend(
      "-".repeat(36),
      { status: "active", expected_version: 1, reason: "字".repeat(300) },
      {},
    );
    for (const status of ["active", "irrelevant", "stale", "archived"])
      assert.equal(
        s.management({ domain: "content", status, page: 1, pageSize: 20 }).status,
        status,
      );
    checks.push(
      "Actual service: four read/three write statuses, numeric-string version conversion, trimmed 2–300 reason boundary, loose 36-character hex/hyphen ID; no fabricated strict UUID or current-state rejection.",
    );
  }
  const repository = parse(await read(sourcePaths[13]));
  let branch, filters, moderation;
  function find(n) {
    if (ts.isIfStatement(n) && n.expression.getText(repository) === 'i.domain === "content"')
      branch = n.thenStatement;
    if (
      ts.isVariableStatement(n) &&
      n.declarationList.declarations[0]?.name.getText(repository) === "like"
    )
      filters = n;
    if (ts.isMethodDeclaration(n) && n.name.getText(repository) === "moderateTrend")
      moderation = n.body;
    ts.forEachChild(n, find);
  }
  find(repository);
  const utilities = repository.statements.find(
    (n) =>
      ts.isVariableStatement(n) &&
      n.declarationList.declarations[0]?.name.getText(repository) === "n",
  );
  assert.ok(branch && filters && moderation && utilities);
  const rb = { PlatformDashboardError: serviceBox.DashboardError, randomUUID: () => "inert-uuid" };
  vm.runInNewContext(
    compile(
      `${utilities.getText(repository)}\nglobalThis.read=async function(i){${filters.getText(repository)}${branch.getText(repository)}};globalThis.moderate=async function(i)${moderation.getText(repository)}`,
    ),
    rb,
  );
  {
    for (const total of [0, 1, 20, 21, 135]) {
      const calls = [];
      const result = await rb.read.call(
        {
          now: () => new Date(original.observed_at),
          pool: {
            query: async (sql, parameters) => {
              calls.push({ sql, parameters });
              return sql.includes("SUM(t.status")
                ? [[original.summary]]
                : sql.startsWith("SELECT COUNT(*)")
                  ? [[{ total }]]
                  : [[]];
            },
          },
        },
        { domain: "content", query: "x%_", status: "archived", page: 9999, pageSize: 20 },
      );
      assert.equal(result.pagination.page, Math.max(1, Math.ceil(total / 20)));
      assert.equal(result.summary.total, 135);
      assert.equal(calls[0].parameters.length, 3);
      assert.equal(calls[1].parameters.length, 4);
      assert.equal(calls[2].parameters.at(-1), (result.pagination.page - 1) * 20);
      assert.ok(calls[2].sql.includes("ORDER BY t.last_seen_at DESC,t.id LIMIT ? OFFSET ?"));
      assert.equal(calls[0].parameters[0], "%x\\%\\_%");
    }
    checks.push(
      "Actual read repository in inert adapter: summary query-only versus status-filtered total, escaped title/category/market LIKE, 0/1/20/21/135 counts, clamped page and deterministic LIMIT/OFFSET. Original fixture has one row, not 135 real records.",
    );
  }
  {
    for (const mode of ["same-status", "conflict", "missing", "idempotent"]) {
      const calls = [];
      const conn = {
        beginTransaction: async () => calls.push("begin"),
        commit: async () => calls.push("commit"),
        rollback: async () => calls.push("rollback"),
        release: () => calls.push("release"),
        query: async (sql) => {
          calls.push(sql);
          if (sql.startsWith("SELECT result_json"))
            return [
              mode === "idempotent"
                ? [{ result_json: JSON.stringify({ id: "saved", version: 2 }) }]
                : [],
            ];
          if (sql.startsWith("SELECT id,"))
            return [
              mode === "missing"
                ? []
                : [
                    {
                      id: "id",
                      organization_id: "org",
                      workspace_id: "ws",
                      status: "active",
                      version: mode === "conflict" ? 2 : 1,
                    },
                  ],
            ];
          return [[]];
        },
      };
      const promise = rb.moderate.call(
        { pool: { getConnection: async () => conn } },
        { topicId: "id", status: "active", expectedVersion: 1, reason: "依据", now: new Date() },
      );
      if (["conflict", "missing"].includes(mode)) {
        await assert.rejects(promise);
        assert.ok(calls.includes("rollback"));
        assert.ok(!calls.some((s) => s.startsWith("UPDATE")));
      } else {
        const r = await promise;
        assert.equal(r.version, 2);
        assert.ok(calls.includes("commit"));
        assert.equal(
          calls.filter((s) => s.startsWith("INSERT")).length,
          mode === "idempotent" ? 0 : 3,
        );
      }
      assert.equal(calls.at(-1), "release");
    }
    checks.push(
      "Actual moderation repository with inert connection: same-status increments version and writes three records, conflict/missing rolls back, idempotent result skips writes, connection always releases. No database was connected.",
    );
  }
  const statuses = ["active", "irrelevant", "stale", "archived"];
  const stateNames = Object.fromEntries(
    [...statuses, "measured", "insufficient_data"].map((s) => [
      s,
      mount().api.platformManagementStateName(s),
    ]),
  );
  return { data: { sourcePaths, sourceChecks: checks, original, statuses, stateNames }, logic };
}
