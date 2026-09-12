import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export async function buildGovernanceDesignData(repo) {
  const proposalRevision = "ce50835aa9972dd2b50b1977270cc998b09ba5fd";
  const sourcePaths = [
    "apps/web/src/components/PlatformGovernanceCenter.vue",
    "apps/api/src/platform-dashboard-service.ts",
    "apps/api/src/platform-dashboard-routes.ts",
    "apps/api/src/mysql-platform-dashboard-repository.ts",
    "tests/e2e/m06-02-platform-dashboard.spec.ts",
  ];
  const historicalSources = new Set([sourcePaths[0], sourcePaths[4]]);
  const read = (f) =>
    historicalSources.has(f)
      ? Promise.resolve(
          execFileSync("git", ["show", `${proposalRevision}:${f}`], {
            cwd: repo,
            encoding: "utf8",
          }),
        )
      : readFile(path.join(repo, f), "utf8");
  const parse = (v) => ts.createSourceFile("input.ts", v, ts.ScriptTarget.Latest, true);
  const compile = (v) =>
    ts.transpileModule(v, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
  const strip = (v) =>
    parse(v)
      .statements.filter((n) => !ts.isImportDeclaration(n))
      .map((n) => n.getFullText())
      .join("\n")
      .replaceAll("export ", "");
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const fixture = parse(await read(sourcePaths[4]));
  let node, expression;
  function find(n) {
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(fixture) === "test" &&
      n.arguments[0]?.text?.startsWith("UI2-DG55")
    )
      node = n;
    ts.forEachChild(n, find);
  }
  find(fixture);
  assert.ok(node);
  function findEnv(n) {
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(fixture) === "env" &&
      n.arguments[0]?.getText(fixture).includes('domain: "governance"')
    )
      expression = n.arguments[0].getText(fixture);
    ts.forEachChild(n, findEnv);
  }
  findEnv(node);
  assert.ok(expression);
  const originals = {};
  for (const section of ["score_rules", "automation_rules"]) {
    const box = { section };
    vm.runInNewContext(
      compile(`const automation=section==="automation_rules";globalThis.result=${expression}`),
      box,
    );
    originals[section] = plain(box.result);
  }
  const vue = await read(sourcePaths[0]);
  const script = strip(vue.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const names =
    "sectionStatuses,sections,section,current,recordSection,recordType,scopeMismatch,snapshotLabel,snapshotScope,data,rows,pagination,rangeLabel,hasLoadedFacts,state,query,queryDraft,status,statusDraft,page,selected,refreshing,message,statusOptions,statusName,typeName,versionText,editHref,summaryName,load,selectSection,applyFilters,resetFilters,goToPage";
  const logic = `window.GOVERNANCE_SOURCE=(b)=>{const {computed,ref,onBeforeUnmount,onMounted,useRoute,useRouter,useModalDialog,defineProps,createApiClient,ApiClientError,window,URLSearchParams,AbortController}=b;${compile(script)}\nreturn {${names}};};`;
  class ApiClientError extends Error {
    constructor(kind) {
      super(kind);
      this.kind = kind;
      this.actionHint = "inert " + kind;
    }
  }
  const mount = (query = {}) => {
    const box = { window: {} };
    vm.runInNewContext(logic, box);
    const calls = [],
      routes = [],
      timers = [],
      unmount = [];
    const s = box.window.GOVERNANCE_SOURCE({
      ref: (value) => ({ value }),
      computed: (get) => ({
        get value() {
          return get();
        },
      }),
      onMounted: () => {},
      onBeforeUnmount: (fn) => unmount.push(fn),
      useRoute: () => ({ query }),
      useRouter: () => ({ replace: async (v) => routes.push(plain(v)) }),
      useModalDialog: () => ({ dialogElement: { value: null }, handleCancel: () => {} }),
      defineProps: () => ({ apiBaseUrl: "inert" }),
      createApiClient: () => (url, options) =>
        new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })),
      ApiClientError,
      window: { setTimeout: (fn, ms) => (timers.push({ fn, ms }), 1), clearTimeout: () => {} },
      URLSearchParams,
      AbortController,
    });
    return { s, calls, routes, timers, unmount };
  };
  const tick = async () => {
    for (let n = 0; n < 8; n++) await Promise.resolve();
  };
  const seed = (s) => {
    s.data.value = plain(originals.score_rules);
    s.snapshotScope.value = { section: "score_rules", query: "", status: "", page: 1 };
    s.state.value = "ready";
  };
  const checks = [];
  const first = mount(),
    sections = plain(first.s.sections),
    statuses = plain(first.s.sectionStatuses);
  assert.equal(sections.length, 5);
  assert.equal(Object.values(statuses).flat().length, 25);
  for (const entry of sections) {
    const s = mount().s;
    s.section.value = entry.value;
    assert.equal(
      s.editHref({ id: "inert" }),
      entry.value === "automation_rules" ? "/automations?rule=inert&action=edit" : entry.href,
    );
  }
  checks.push(
    "Actual five section routes, 25 category/status combinations and automatic-rule-only ID query",
  );
  {
    const { s, calls, timers } = mount();
    seed(s);
    s.selectSection("automation_rules");
    await tick();
    assert.equal(calls.length, 1);
    assert.equal(timers[0].ms, 15000);
    assert.equal(s.current.value.href, "/automations");
    assert.equal(s.recordSection.value, "score_rules");
    assert.equal(s.versionText(s.rows.value[0]), "第 2 版");
    assert.equal(s.editHref(s.rows.value[0]), "/opportunities/scoring-rules");
    s.applyFilters();
    assert.equal(calls.length, 1);
    calls[0].reject(new ApiClientError("error"));
    await tick();
    assert.equal(s.scopeMismatch.value, true);
    const p = s.load();
    await tick();
    calls[1].resolve({ data: originals.automation_rules });
    await p;
    assert.equal(s.versionText(s.rows.value[0]), "第 3 版");
    assert.equal(s.editHref(s.rows.value[0]), "/automations?rule=auto-55&action=edit");
    checks.push(
      "Actual retained score snapshot under target automation held/error request; single-flight and successful recovery",
    );
  }
  {
    for (const kind of ["expired", "forbidden", "blocked", "rate_limited", "error"]) {
      for (const loaded of [false, true]) {
        const { s, calls } = mount();
        if (loaded) seed(s);
        const p = s.load({ updateUrl: false });
        calls[0].reject(new ApiClientError(kind));
        await p;
        assert.equal(s.state.value, loaded ? "ready" : kind === "rate_limited" ? "blocked" : kind);
      }
    }
    const { s, calls, unmount } = mount();
    const p = s.load({ updateUrl: false });
    unmount[0]();
    assert.equal(calls[0].options.signal.aborted, true);
    calls[0].resolve({ data: originals.score_rules });
    await p;
    assert.equal(s.rows.value.length, 1);
    checks.push(
      "Actual ten first/retained failures, including old data after permission errors; ignored abort still updates refs (unfixed lifecycle boundary)",
    );
  }
  {
    const { s, calls, routes } = mount({
      section: "releases",
      status: "active",
      page: "9999",
      q: " query ",
    });
    assert.equal(s.status.value, "");
    assert.equal(s.query.value, "query");
    const p = s.load();
    await tick();
    assert.ok(calls[0].url.includes("page=9999"));
    calls[0].resolve({
      data: {
        ...originals.score_rules,
        section: "releases",
        pagination: { page: 2, page_size: 20, total: 21, total_pages: 2 },
      },
    });
    await p;
    assert.equal(s.page.value, 2);
    assert.equal(routes.at(-1).query.page, "2");
    assert.equal(s.rangeLabel.value, "21–21 / 21 条");
    checks.push("Actual URL initial validation and server-corrected pagination range/URL");
  }
  {
    const box = {};
    vm.runInNewContext(
      compile(strip(await read(sourcePaths[1])) + "\nglobalThis.Service=PlatformDashboardService;"),
      box,
    );
    const calls = [],
      service = new box.Service({ readManagement: (input) => (calls.push(plain(input)), input) });
    for (const entry of sections)
      for (const value of statuses[entry.value]) {
        service.management({
          domain: "governance",
          section: entry.value,
          status: value,
          page: "2",
          pageSize: "20",
          query: " 搜索 ",
        });
        assert.equal(calls.at(-1).page, 2);
        assert.equal(calls.at(-1).query, "搜索");
      }
    for (const change of [
      { section: "invalid" },
      { status: "invalid" },
      { query: "字".repeat(121) },
      { page: 0 },
      { pageSize: 101 },
    ])
      assert.throws(() =>
        service.management({ domain: "governance", section: "score_rules", ...change }),
      );
    checks.push(
      "Actual management service accepts 25 category/status pairs and normalizes query/page; rejects invalid section/status/length/page size",
    );
  }
  {
    const ast = parse(await read(sourcePaths[3]));
    let branch, filterStatement;
    function walk(n) {
      if (ts.isIfStatement(n) && n.expression.getText(ast) === 'i.domain === "governance"')
        branch = n.thenStatement;
      if (
        ts.isVariableStatement(n) &&
        n.declarationList.declarations[0]?.name.getText(ast) === "like"
      )
        filterStatement = n;
      ts.forEachChild(n, walk);
    }
    walk(ast);
    assert.ok(branch && filterStatement);
    const utilities = ast.statements.find(
      (n) =>
        ts.isVariableStatement(n) && n.declarationList.declarations[0]?.name.getText(ast) === "n",
    );
    assert.ok(utilities);
    const box = {};
    vm.runInNewContext(
      compile(
        `${utilities.getText(ast)}\nglobalThis.read=async function(i){${filterStatement.getText(ast)}${branch.getText(ast)}}`,
      ),
      box,
    );
    for (const entry of sections)
      for (const total of [0, 1, 20, 21, 100]) {
        const calls = [];
        const result = await box.read.call(
          {
            now: () => new Date("2026-09-08T00:00:00Z"),
            pool: {
              query: async (sql, parameters) => {
                calls.push({ sql, parameters });
                return sql.startsWith("SELECT (SELECT COUNT(*)")
                  ? [
                      [
                        {
                          score_rules: 101,
                          cost_rules: 11,
                          approval_templates: 12,
                          automation_rules: 13,
                          releases: 14,
                          provider_versions: 15,
                        },
                      ],
                    ]
                  : sql.startsWith("SELECT COUNT(*) total")
                    ? [[{ total }]]
                    : [[]];
              },
            },
          },
          {
            domain: "governance",
            section: entry.value,
            query: "x%_",
            status: "active",
            page: 9999,
            pageSize: 20,
          },
        );
        assert.equal(result.pagination.page, total ? Math.ceil(total / 20) : 1);
        assert.equal(result.pagination.total, total);
        assert.equal(result.summary.score_rules, 101);
        assert.equal(calls[2].parameters.at(-1), (result.pagination.page - 1) * 20);
        assert.ok(calls[2].sql.includes("LIMIT ? OFFSET ?"));
        assert.equal(calls[1].parameters[0], "%x\\%\\_%");
      }
    checks.push(
      "Actual repository branch with inert query adapter: five sections × 0/1/20/21/100 totals, global versus filtered counts, escaped LIKE and clamped offsets; no SQL execution",
    );
  }
  const facts = { sections, statuses, statusNames: {}, typeNames: {} };
  for (const k of [...new Set(Object.values(statuses).flat())])
    facts.statusNames[k] = first.s.statusName(k);
  for (const k of [
    "approval.overdue",
    "approval.node.rejected",
    "competitor.alert.queued",
    "competitor.changed",
    "task.created",
    "notify_owner",
    "create_task",
    ...sections.map((s) => s.value),
  ])
    facts.typeNames[k] = first.s.typeName(k);
  // Five supplemental rows use only fields selected by the actual repository. Not production records.
  const synthetic = {};
  for (const entry of sections) {
    synthetic[entry.value] = {
      ...plain(originals.score_rules),
      section: entry.value,
      summary: {
        score_rules: 21,
        cost_rules: 1,
        approval_templates: 1,
        automation_rules: 1,
        releases: 1,
        provider_versions: 2,
      },
      provider_versions_latest_at: "2026-09-08T00:00:00.000Z",
      items: [
        {
          id: "synthetic-" + entry.value,
          name: "合成 · " + entry.label,
          status: statuses[entry.value][0],
          updated_at: "2026-09-08T00:00:00.000Z",
          organization_name: entry.value === "releases" ? undefined : "合成组织",
          workspace_name: entry.value === "releases" ? undefined : "合成工作区",
          ...(entry.value === "score_rules"
            ? { revision: 2, version_code: "score-demo-v2" }
            : entry.value === "cost_rules"
              ? { revision: 4, version_code: "cost-demo-v4", market: "US", platform: "Amazon" }
              : entry.value === "approval_templates"
                ? { current_version: 3, revision: 8, resource_type: "score_rule" }
                : entry.value === "automation_rules"
                  ? {
                      version: 3,
                      trigger_event_type: "competitor.changed",
                      condition_severity: "any",
                      action_type: "notify_owner",
                      action_title: "合成：通知负责人",
                      rate_limit_count: 3,
                      rate_limit_window_minutes: 60,
                    }
                  : { name: "demo-1.0.0", version_code: "demo-build-sha", stage: "canary" }),
        },
      ],
    };
  }
  return { data: { sourcePaths, sourceChecks: checks, originals, synthetic, ...facts }, logic };
}
