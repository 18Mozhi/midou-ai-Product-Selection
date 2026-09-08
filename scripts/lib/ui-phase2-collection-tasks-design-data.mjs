import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export async function buildCollectionDesignData(repo) {
  const read = (p) => readFile(path.join(repo, p), "utf8");
  const parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  const compile = (s) =>
    ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const run = (s, bindings = {}) => {
    const b = { ...bindings };
    vm.runInNewContext(compile(s), b);
    return b.result;
  };
  const fixture = parse(await read("tests/e2e/m03-05-collection-tasks.spec.ts"));
  const top = fixture.statements
    .filter(ts.isVariableStatement)
    .flatMap((n) => [...n.declarationList.declarations]);
  const prefix = ["ids", "tasks", "detail"]
    .map((name) => `const ${top.find((n) => n.name.getText(fixture) === name).getText(fixture)};`)
    .join("\n");
  const original = plain(run(prefix + "globalThis.result={ids,tasks,detail:detail()};"));
  let rssStatement, pageDeclaration;
  function visit(n) {
    if (ts.isExpressionStatement(n) && n.getText(fixture).startsWith("rssDetail.subqueries ="))
      rssStatement = n.getText(fixture);
    if (ts.isVariableDeclaration(n) && n.name.getText(fixture) === "pageOne")
      pageDeclaration = n.getText(fixture);
    ts.forEachChild(n, visit);
  }
  visit(fixture);
  assert.ok(rssStatement && pageDeclaration);
  const rss = plain(
    run(prefix + `const rssDetail=detail(tasks[0]);${rssStatement}globalThis.result=rssDetail;`),
  );
  const pageOne = plain(run(prefix + `const ${pageDeclaration};globalThis.result=pageOne;`));
  const vue = await read("apps/web/src/components/CollectionTaskCenter.vue");
  const ast = parse(vue.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const stripped = ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(ast))
    .join("\n");
  const exported = [
    "state,tasks,detail,requestId,status,query,page,total,listLoading,listIssue,detailLoading,detailIssue,replayIssue,confirming,replayReason,notice,saving",
    "filtered,metrics,totalPages,pageStart,pageEnd,detailOpen,taskStatuses,label,time,cell,subqueryRetryText,resultKindText,robotsDecisionText,subqueryDurationText,recoveryAction",
    "load,openTask,replay,closeDetail,changeStatus,changePage,syncListQuery",
  ].join(",");
  const logic = `// Actual Vue script in an inert bridge; no Vue mount or HTTP.\nwindow.COLLECTION_C_SOURCE=(bridge)=>{const {ref,computed,nextTick,onBeforeUnmount,onMounted,watch,useRoute,useRouter,defineProps,createApiClient,ApiClientError,window,document,HTMLElement,AbortController,URLSearchParams}=bridge;\n${compile(stripped)}\nreturn {${exported}};};\n`;
  class ApiClientError extends Error {
    constructor(status) {
      super(String(status));
      this.status = status;
      this.actionHint = `合成拒绝 ${status}`;
      this.requestId = `synthetic-${status}`;
    }
  }
  function mount(query = {}) {
    const b = { window: {} };
    vm.runInNewContext(logic, b);
    const calls = [],
      timers = [],
      watches = [],
      mounted = [],
      unmount = [],
      navigation = [];
    const route = { query: { ...query } };
    const router = {
      replace: async (v) => {
        navigation.push({ kind: "replace", ...plain(v) });
        route.query = { ...v.query };
      },
      push: async (v) => {
        navigation.push({ kind: "push", ...plain(v) });
        route.query = { ...v.query };
      },
      back: () => navigation.push({ kind: "back" }),
    };
    const c = b.window.COLLECTION_C_SOURCE({
      ref: (value) => ({ value }),
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
      nextTick: () => Promise.resolve(),
      watch: (get, fn) => watches.push({ get, fn }),
      onMounted: (fn) => mounted.push(fn),
      onBeforeUnmount: (fn) => unmount.push(fn),
      useRoute: () => route,
      useRouter: () => router,
      defineProps: () => ({ apiBaseUrl: "inert" }),
      createApiClient:
        () =>
        (path, options = {}) =>
          new Promise((resolve, reject) => calls.push({ path, options, resolve, reject })),
      ApiClientError,
      AbortController,
      URLSearchParams,
      HTMLElement: class {},
      document: {
        activeElement: null,
        querySelector: () => null,
        body: { classList: { toggle: () => {}, remove: () => {} } },
      },
      window: {
        setTimeout: (fn, ms) => {
          timers.push({ fn, ms });
          return timers.length;
        },
        clearTimeout: () => {},
      },
    });
    return { c, calls, timers, watches, mounted, unmount, navigation, route };
  }
  const resolve = (call, data, total) =>
    call.resolve({
      data: plain(data),
      request_id: "synthetic-request",
      meta: { total: total ?? data.length },
    });
  const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  const checks = [];
  const { c: pure } = mount();
  pure.tasks.value = original.tasks;
  assert.deepEqual(plain(pure.metrics.value), { active: 1, warnings: 1, blocked: 1, evidence: 38 });
  const filterSequences = {};
  for (const q of ["", "0952", "PARSE_FAILED", original.ids.org, " ", "missing"]) {
    pure.query.value = q;
    filterSequences[q] = plain(pure.filtered.value.map((t) => t.id));
    const expected = original.tasks
      .filter(
        (t) =>
          !q ||
          [t.id, t.organization_id, t.workspace_id, t.last_error_code].some((v) =>
            v?.toLowerCase().includes(q.toLowerCase()),
          ),
      )
      .map((t) => t.id);
    assert.deepEqual(filterSequences[q], expected);
    assert.equal(pure.metrics.value.evidence, 38);
  }
  const labels = {},
    recoveries = {};
  const statusSource = parse(await read("packages/collection-tasks/src/index.ts"));
  const statusDeclaration = statusSource.statements
    .filter(ts.isVariableStatement)
    .flatMap((n) => [...n.declarationList.declarations])
    .find((n) => n.name.getText(statusSource) === "COLLECTION_TASK_STATUSES");
  const statuses = plain(
    run(
      `const ${statusDeclaration.getText(statusSource)};globalThis.result=COLLECTION_TASK_STATUSES;`,
    ),
  );
  assert.equal(statuses.length, 20);
  assert.equal(pure.taskStatuses.length, 19);
  assert.ok(!pure.taskStatuses.includes("automatically_replayed"));
  for (const status of statuses) {
    labels[status] = pure.label(status);
    pure.detail.value = {
      ...original.detail,
      task: { ...original.tasks[1], status, last_error_code: null },
    };
    recoveries[status] = plain(pure.recoveryAction.value);
  }
  for (const value of ["complete", "partial", "insufficient", null])
    labels[String(value)] = pure.label(value);
  assert.equal(labels.draft, "draft");
  assert.equal(labels.automatically_replayed, "凭证续期后已自动重放");
  assert.equal(pure.subqueryDurationText(null, null), "尚未开始");
  assert.equal(
    pure.subqueryDurationText("2026-08-07T18:21:00Z", "2026-08-07T18:37:00Z"),
    "耗时 16 分 0 秒",
  );
  assert.equal(
    pure.subqueryDurationText("2026-08-07T18:37:00Z", "2026-08-07T18:21:00Z"),
    "耗时不可用",
  );
  checks.push(
    "Actual current-page metrics 1/1/1/38, six full filter ID sequences with no trim, 20 labels versus 19 status options, duration and exact recovery destinations; draft falls back to raw code",
  );
  for (const preserve of [false, true])
    for (const status of [401, 403, 404, 503, "timeout"]) {
      const { c, calls, timers, unmount } = mount();
      c.tasks.value = plain(original.tasks);
      const p = c.load({ preserve });
      await c.load({ preserve });
      assert.equal(calls.length, 1);
      assert.equal(timers[0].ms, 15000);
      assert.equal(calls[0].path, "/platform/collection/tasks?page=1&page_size=50");
      if (status === "timeout") {
        timers[0].fn();
        assert.ok(calls[0].options.signal.aborted);
      }
      calls[0].reject(status === "timeout" ? new Error("abort") : new ApiClientError(status));
      await p;
      assert.equal(
        c.state.value,
        preserve
          ? "ready"
          : status === 401
            ? "expired"
            : status === 403
              ? "forbidden"
              : status === 404
                ? "error"
                : "blocked",
      );
      assert.deepEqual(plain(c.tasks.value), original.tasks);
      const next = c.load();
      unmount[0]();
      assert.ok(calls[1].options.signal.aborted);
      calls[1].reject(new Error("unmounted"));
      await next;
    }
  checks.push(
    "Ten actual first/preserved list failures, 15-second abort callback, single flight and unmount; current snapshots retained only on preserve=true, no actual network timeout or KeepAlive proof",
  );
  for (const outcome of ["success", "failure"]) {
    const { c, calls, watches, route } = mount({ task: original.ids.dead });
    const p = c.openTask(original.ids.dead);
    delete route.query.task;
    await watches[0].fn(undefined);
    assert.ok(calls[0].options.signal.aborted);
    if (outcome === "success") resolve(calls[0], original.detail);
    else calls[0].reject(new ApiClientError(404));
    await p;
    assert.equal(c.detailOpen.value, false);
    assert.equal(c.detail.value, null);
  }
  checks.push(
    "Actual existing task-query removal sequence protection rejects late detail success and terminal failure via manually invoked watch; not VueRouter integration",
  );
  {
    const { c, calls } = mount();
    const first = c.load();
    c.status.value = "dead_letter";
    await c.changeStatus();
    assert.equal(calls.length, 1);
    resolve(calls[0], original.tasks, 3);
    await first;
    assert.equal(c.status.value, "dead_letter");
    assert.equal(c.tasks.value.length, 3);
    checks.push(
      "Reproduced source single-flight dropping a changed status read while old all-status response populates rows under the new selector",
    );
  }
  {
    const { c, calls, navigation } = mount({ page: "3", keep: "yes" });
    c.page.value = 3;
    const p = c.load();
    resolve(calls[0], [], 51);
    await flush();
    assert.equal(calls[1].path, "/platform/collection/tasks?page=2&page_size=50");
    resolve(calls[1], [original.tasks[1]], 51);
    await p;
    assert.equal(c.page.value, 2);
    assert.equal(c.pageStart.value, 51);
    assert.equal(c.pageEnd.value, 51);
    assert.equal(navigation[0].query.keep, "yes");
  }
  checks.push(
    "Actual nonzero-total out-of-range fallback from page 3 to 2 and preservation of unrelated URL query; pageSize remains 50",
  );
  const replayResult = plain(
    run(
      prefix +
        `globalThis.result=detail({...tasks[1],id:ids.replay,status:'scheduled',attempt_count:0,replay_of_task_id:ids.dead,replay_reason:'来源已恢复'});`,
    ),
  );
  {
    const { c, calls, route } = mount({ task: original.ids.dead });
    c.detail.value = plain(original.detail);
    c.replayReason.value = "  来源已恢复  ";
    const p = c.replay();
    await c.replay();
    assert.equal(calls.length, 1);
    assert.deepEqual(plain(calls[0].options.body), { reason: "来源已恢复" });
    c.closeDetail();
    c.detail.value = plain(rss);
    c.replayReason.value = "新的原因";
    resolve(calls[0], replayResult);
    await flush();
    assert.equal(c.detail.value.task.id, original.ids.replay);
    assert.equal(c.replayReason.value, "");
    assert.equal(route.query.task, original.ids.replay);
    calls[1].reject(new ApiClientError(503));
    await p;
    assert.match(c.notice.value, /已创建/);
    checks.push(
      "Reproduced old replay success replacing a newly opened task, clearing new draft and changing URL; exact reason body and single POST, no actual replay",
    );
  }
  {
    const { c, calls } = mount();
    c.detail.value = plain(original.detail);
    c.confirming.value = true;
    c.replayReason.value = "原原因";
    c.detail.value = { ...original.detail, task: { ...original.tasks[1], id: original.ids.task } };
    c.replayReason.value = "变更原因";
    const p = c.replay();
    assert.equal(calls[0].path, `/platform/collection/tasks/${original.ids.task}/replay`);
    assert.deepEqual(plain(calls[0].options.body), { reason: "变更原因" });
    calls[0].reject(new ApiClientError(409));
    await p;
    checks.push(
      "Actual confirmation does not snapshot target/reason; changing detail before confirm changes the POST target and body. Prototype snapshot is a proposal",
    );
  }
  const confirm = await read("apps/web/src/components/ConfirmDialog.vue");
  assert.match(confirm, /destructive: false/);
  assert.match(confirm, /v-if="destructive"/);
  const call = vue.slice(vue.lastIndexOf("<ConfirmDialog"));
  assert.ok(!call.includes("destructive"));
  const stateContract = parse(await read("apps/web/src/ui/state-contract.ts"));
  const can = stateContract.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name.text === "canConfirm",
  );
  const canConfirm = run(
    can.getText(stateContract).replace(/^export /, "") + "\nglobalThis.result=canConfirm;",
  );
  assert.equal(
    canConfirm({
      destructive: false,
      acknowledged: false,
      confirmationText: "确认重放",
      typedText: " 确认重放 ",
    }),
    true,
  );
  checks.push(
    "Actual single-replay ConfirmDialog uses destructive=false: typed phrase only, no acknowledgement checkbox; corrected stale page specification without changing product",
  );
  // Execute actual service validation, with an inert repository instead of MySQL.
  const serviceText = await read("apps/api/src/collection-task-service.ts");
  const serviceAst = parse(serviceText);
  const serviceCode = serviceAst.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(serviceAst))
    .join("\n")
    .replace(/export (?=(?:class|const|function|interface|type))/g, "");
  const Service = run(serviceCode + "\nglobalThis.result=CollectionTaskService;", {
    COLLECTION_TASK_STATUSES: statuses,
    randomUUID: () => original.ids.replay,
  });
  const serviceCalls = [];
  const service = new Service({
    list: async (v) => {
      serviceCalls.push(v);
      return { items: [], total: 0 };
    },
    replay: async (v) => {
      serviceCalls.push(v);
      return replayResult;
    },
  });
  await service.list({ page: "2", page_size: "50", status: "automatically_replayed" });
  assert.equal(serviceCalls[0].status, "automatically_replayed");
  for (const reason of ["", "a", " ", "a".repeat(501)])
    await assert.rejects(
      service.replay(
        original.ids.dead,
        { reason },
        { actorId: "inert", idempotencyKey: "inert", requestId: "inert", traceId: "inert" },
      ),
    );
  await service.replay(
    original.ids.dead,
    { reason: " a中 " },
    { actorId: "inert", idempotencyKey: "inert", requestId: "inert", traceId: "inert" },
  );
  assert.equal(serviceCalls.at(-1).reason, "a中");
  checks.push(
    "Actual service accepts auto-replayed status, validates original reason length <=500 and trimmed >=2, and trims payload; inert repository, not transaction/authorization proof",
  );
  return {
    logic,
    data: {
      original,
      rss,
      pageOne,
      replayResult,
      statuses,
      filterStatuses: plain(pure.taskStatuses),
      labels,
      recoveries,
      filterSequences,
      checks,
      sourcePaths: [
        "apps/web/src/components/CollectionTaskCenter.vue",
        "apps/web/src/components/CollectionRuntimeSurface.vue",
        "apps/web/src/components/ConfirmDialog.vue",
        "apps/web/src/components/ResponsiveDataView.vue",
        "apps/web/src/components/TableViewControls.vue",
        "apps/web/src/ui/state-contract.ts",
        "apps/api/src/collection-task-service.ts",
        "apps/api/src/collection-task-routes.ts",
        "apps/api/src/mysql-collection-task-repository.ts",
        "packages/collection-tasks/src/index.ts",
        "tests/e2e/m03-05-collection-tasks.spec.ts",
      ],
    },
  };
}
