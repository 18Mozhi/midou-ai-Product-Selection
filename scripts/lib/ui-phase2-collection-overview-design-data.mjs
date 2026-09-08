import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export async function buildOverviewData(repo) {
  const read = (p) => readFile(path.join(repo, p), "utf8");
  const parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  const compile = (s) =>
    ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const fixturePath = "tests/e2e/m06-03-collection-console.spec.ts";
  const fixture = parse(await read(fixturePath));
  const declarations = [];
  const visit = (n) => {
    if (ts.isVariableDeclaration(n)) declarations.push(n);
    ts.forEachChild(n, visit);
  };
  visit(fixture);
  const decl = (name) =>
    declarations.find((n) => n.name.getText(fixture) === name)?.getText(fixture);
  const prefix = `const ${decl("providerId")}; const ${decl("data")};`;
  function run(text, bindings = {}) {
    const b = { ...bindings };
    vm.runInNewContext(compile(text), b);
    return b.result;
  }
  const original = plain(run(prefix + "globalThis.result=data;"));
  const batch = plain(
    run(
      prefix +
        `const ${decl("secondTaskId")};const ${decl("batchData")};globalThis.result=batchData;`,
    ),
  );
  const catalog = plain(run(prefix + `const ${decl("sources")};globalThis.result=sources;`));
  const paged = plain(run(prefix + `const ${decl("paged")};globalThis.result=paged;`));
  assert.equal(catalog.length, 14);
  const vuePath = "apps/web/src/components/CollectionOperationsConsole.vue";
  const vue = await read(vuePath);
  const ast = parse(vue.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const stripped = ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(ast))
    .join("\n");
  const labelsPath = "apps/web/src/ui/status-labels.ts";
  const labels = compile((await read(labelsPath)).replaceAll("export ", ""));
  const names =
    "state,data,org,workspace,provider,timeWindow,errorCode,attemptPage,deadLetterPage,requestId,hint,refreshNotice,refreshing,selectedDeadLetterIds,batchReason,batchPreview,batchId,batchBusy,batchNotice,batchFailures,sourcesExpanded,selectedDeadLetters,batchImpact,scopeFilterCount,orderedSources,visibleSources,hiddenSourceCount,scopeValidation,syncUrl,load,when,linkLabels,healthLabel,errorLabel,errorCategory,drillRootCause,applyScope,resetScope,goToPage,rangeLabel,toggleDeadLetter,previewBatchReplay,confirmBatchReplay,statusLabel";
  const logic = `// Actual Vue script and status labels; inert bridge, not a Vue mount.\nwindow.OVERVIEW_C_SOURCE=(bridge)=>{const {ref,computed,nextTick,onBeforeUnmount,onMounted,useRoute,useRouter,defineProps,createApiClient,ApiClientError,window,AbortController,URLSearchParams,crypto}=bridge;\n${labels}\n${compile(stripped)}\nreturn {${names}};};`;
  class ApiClientError extends Error {
    constructor(kind) {
      super(kind);
      this.kind = kind;
      this.actionHint = `合成${kind}`;
      this.requestId = "inert-error";
    }
  }
  function mount(query = {}) {
    const b = { window: {} };
    vm.runInNewContext(logic, b);
    const calls = [],
      timers = [],
      unmount = [],
      navigation = [];
    const route = { query };
    const c = b.window.OVERVIEW_C_SOURCE({
      ref: (value) => ({ value }),
      computed: (get) => ({
        get value() {
          return get();
        },
      }),
      nextTick: async () => {},
      onMounted: () => {},
      onBeforeUnmount: (fn) => unmount.push(fn),
      useRoute: () => route,
      useRouter: () => ({
        replace: async (v) => {
          navigation.push(plain(v));
          route.query = { ...v.query };
        },
      }),
      defineProps: () => ({ apiBaseUrl: "inert" }),
      createApiClient:
        () =>
        (url, options = {}) =>
          new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })),
      ApiClientError,
      AbortController,
      URLSearchParams,
      crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000999" },
      window: {
        setTimeout: (fn, ms) => {
          timers.push({ fn, ms });
          return timers.length;
        },
        clearTimeout: () => {},
      },
    });
    return { c, calls, timers, unmount, navigation, route };
  }
  const tick = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  const success = (call, value = original) =>
    call.resolve({ data: plain(value), request_id: "m06-03-e2e" });
  const checks = [];
  const m = mount(),
    c = m.c;
  c.data.value = plain(original);
  assert.equal(c.visibleSources.value.length, 1);
  assert.equal(c.rangeLabel(original.pagination.attempts), "1–1 / 1 条");
  for (const count of [0, 1, 8, 9, 14]) {
    c.data.value.sources = plain(catalog.slice(0, count));
    assert.equal(c.visibleSources.value.length, Math.min(count, 8));
    c.sourcesExpanded.value = true;
    assert.equal(c.visibleSources.value.length, count);
    c.sourcesExpanded.value = false;
  }
  assert.equal(c.orderedSources.value[0].id, catalog[13].id);
  c.data.value = plain(batch);
  c.selectedDeadLetterIds.value = ["d1", "d2"];
  assert.equal(
    c.batchImpact.value,
    "2 条开放死信；2 个组织；2 个工作区；根因：页面解析失败 1 条、请求超时 1 条。",
  );
  const target = { checked: true };
  c.selectedDeadLetterIds.value = Array.from({ length: 20 }, (_, i) => String(i));
  c.toggleDeadLetter("21", { target });
  assert.equal(target.checked, false);
  assert.equal(c.selectedDeadLetterIds.value.length, 20);
  checks.push(
    "Actual computed source priority/0,1,8,9,14 disclosure, range labels, two-organization impact and 21st-selection rejection.",
  );
  for (const preserved of [false, true])
    for (const kind of ["expired", "forbidden", "rate_limited", "blocked", "timeout"]) {
      const x = mount();
      if (preserved) x.c.data.value = plain(original);
      const work = x.c.load();
      await tick();
      assert.equal(x.timers[0].ms, 15000);
      await x.c.load();
      assert.equal(x.calls.length, 1);
      if (kind === "timeout") x.timers[0].fn();
      x.calls[0].reject(new ApiClientError(kind === "timeout" ? "blocked" : kind));
      await work;
      assert.equal(x.c.state.value, preserved ? "ready" : kind === "timeout" ? "blocked" : kind);
      if (preserved) assert.deepEqual(plain(x.c.data.value), original);
    }
  checks.push(
    "Ten first/preserved error branches with actual 15-second abort callback and single-flight; no real clock or permission proof.",
  );
  {
    const x = mount({
      window: "7d",
      attempt_page: "2",
      dead_letter_page: "3",
      root_cause: "1",
      unknown: "drop",
    });
    x.c.org.value = " " + original.dead_letters[0].organization_id + " ";
    const work = x.c.load();
    await tick();
    const q = new URLSearchParams(x.calls[0].url.split("?")[1]);
    assert.equal(q.get("attempt_page"), "2");
    assert.equal(q.get("dead_letter_page"), "3");
    assert.equal(x.route.query.root_cause, "1");
    assert.equal(x.route.query.unknown, undefined);
    x.c.timeWindow.value = "30d";
    x.c.applyScope();
    await tick();
    assert.equal(x.calls.length, 1);
    success(x.calls[0]);
    await work;
    assert.equal(x.c.timeWindow.value, "30d");
    assert.equal(x.c.data.value.filters.window, "24h");
    x.c.org.value = "wrong";
    await x.c.load();
    assert.equal(x.calls.length, 1);
    checks.push(
      "Initial URL/trim/exact paging and unknown-query removal verified; pending scope change ignored and draft/response mismatch reproduced.",
    );
  }
  {
    const x = mount();
    const onlyAttempts = {
      ...plain(original),
      sources: [],
      task_states: [],
      quality: [],
      dead_letters: [],
      root_causes: [],
    };
    const work = x.c.load();
    await tick();
    success(x.calls[0], onlyAttempts);
    await work;
    assert.equal(x.c.state.value, "empty");
    assert.equal(x.c.data.value.attempts.length, 1);
    const work2 = x.c.load();
    await tick();
    x.unmount[0]();
    assert.equal(x.calls[1].options.signal.aborted, true);
    success(x.calls[1]);
    await work2;
    assert.equal(x.c.state.value, "ready");
    checks.push(
      "Attempt-only response is hidden by ready predicate; success after abort still mutates source refs under controlled transport (not production reachability).",
    );
  }
  {
    const x = mount();
    x.c.data.value = plain(batch);
    x.c.selectedDeadLetterIds.value = ["d1", "d2"];
    x.c.batchReason.value = "原始恢复原因";
    x.c.previewBatchReplay();
    const work = x.c.confirmBatchReplay();
    await tick();
    await x.c.confirmBatchReplay();
    assert.equal(x.calls.length, 1);
    x.c.batchReason.value = "中途变更原因";
    success(x.calls[0]);
    await tick();
    assert.equal(x.calls[1].options.body.reason, "中途变更原因");
    assert.equal(x.calls[0].options.body.reason, "原始恢复原因");
    assert.equal(new Set(x.calls.slice(0, 2).map((v) => v.options.idempotencyKey)).size, 2);
    x.calls[1].reject(new ApiClientError("blocked"));
    await tick();
    assert.ok(x.c.batchNotice.value.includes("成功 1 条，失败 1 条"));
    assert.deepEqual(plain(x.c.selectedDeadLetterIds.value), ["d2"]);
    x.calls[2].reject(new ApiClientError("blocked"));
    await work;
    assert.ok(x.c.refreshNotice.value);
    assert.ok(x.c.batchNotice.value);
    checks.push(
      "Serial replay/single-flight/independent keys, partial selection and read/write messages verified; per-request reason drift reproduced.",
    );
  }
  const servicePath = "apps/api/src/collection-console-service.ts";
  const service = run(
    (await read(servicePath)).replaceAll("export ", "") +
      "globalThis.result=CollectionConsoleService;",
  );
  const serviceCalls = [];
  const svc = new service({ read: (v) => serviceCalls.push(plain(v)) });
  for (const window of ["24h", "7d", "30d", "all"])
    svc.read({ window, errorCode: " parser_failed ", attemptPage: "2" });
  assert.equal(serviceCalls[0].recentLimit, 50);
  assert.equal(serviceCalls[0].errorCode, "parser_failed");
  for (const bad of [
    { window: "1h" },
    { attemptPage: 0 },
    { deadLetterPage: "1000000" },
    { errorCode: "a b" },
    { organizationId: "wrong" },
  ])
    assert.throws(() => svc.read(bad));
  const repoPath = "apps/api/src/mysql-collection-console-repository.ts";
  const repoAst = parse(await read(repoPath));
  const repoText = repoAst.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(repoAst))
    .join("\n")
    .replaceAll("export ", "");
  const Repo = run(repoText + "globalThis.result=MySqlCollectionConsoleRepository;", {
    CollectionConsoleError: Error,
  });
  const repository = new Repo({});
  const input = {
    organizationId: "org",
    workspaceId: "ws",
    providerId: "provider",
    errorCode: "parser_failed",
  };
  const since = new Date("2026-08-01T00:00:00Z");
  const filters = {};
  for (const kind of ["task", "dead", "attempt", "quality"])
    filters[kind] = plain(repository[kind + "Filter"](input, since));
  assert.ok(filters.task.sql.includes("t.updated_at >= ?"));
  assert.ok(!filters.task.sql.includes("error_code"));
  assert.ok(filters.dead.sql.includes("d.created_at >= ?"));
  assert.ok(filters.attempt.sql.includes("a.error_code = ?"));
  assert.ok(filters.quality.sql.includes("q.updated_at >= ?"));
  assert.ok(
    !repository.deadFilter({ ...input, errorCode: null }, since).sql.includes("error_code"),
  );
  checks.push(
    "Actual service validation and repository SQL-filter builders verify distinct time/error scopes; no SQL execution or audit writes.",
  );
  const confirm = await read("apps/web/src/components/ConfirmDialog.vue");
  assert.ok(vue.includes('confirm-label="确认批量重放"\n      destructive'));
  assert.ok(confirm.includes('v-if="destructive"'));
  checks.push(
    "Actual batch caller is destructive: acknowledgement plus typed phrase, unlike P51 single replay.",
  );
  return {
    data: {
      original,
      batch,
      catalog,
      paged,
      checks,
      sourcePaths: [
        fixturePath,
        vuePath,
        labelsPath,
        servicePath,
        repoPath,
        "apps/api/src/collection-console-routes.ts",
        "apps/web/src/components/ConfirmDialog.vue",
        "apps/web/src/components/ResponsiveFilterDrawer.vue",
        "apps/web/src/components/ResponsiveDataView.vue",
      ],
    },
    logic,
  };
}
