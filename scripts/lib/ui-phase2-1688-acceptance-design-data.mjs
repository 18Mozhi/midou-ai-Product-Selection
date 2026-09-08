import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export async function buildAcceptanceDesignData(repo) {
  const read = (p) => readFile(path.join(repo, p), "utf8");
  const plain = (v) => JSON.parse(JSON.stringify(v));
  const parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
  const compile = (s) =>
    ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const run = (s, bindings = {}) => {
    const box = { ...bindings };
    vm.runInNewContext(compile(s), box);
    return box.result;
  };
  const fixture = parse(await read("tests/e2e/m03-07-provider-sources.spec.ts"));
  const declarations = [],
    envelopes = [];
  function visit(n) {
    if (ts.isVariableDeclaration(n)) declarations.push(n);
    if (ts.isCallExpression(n) && n.expression.getText(fixture) === "envelope")
      envelopes.push(n.arguments[0]);
    ts.forEachChild(n, visit);
  }
  visit(fixture);
  const declaration = (name) => {
    const matches = declarations.filter((n) => n.name.getText(fixture) === name);
    assert.equal(matches.length, 1, name);
    return matches[0].getText(fixture);
  };
  const prefix = ["org", "ws", "setup"].map((n) => `const ${declaration(n)};`).join("\n");
  const envelope = (needle) => {
    const matches = envelopes.filter((n) => n.getText(fixture).includes(needle));
    assert.equal(matches.length, 1, needle);
    return plain(run(prefix + `globalThis.result=${matches[0].getText(fixture)};`));
  };
  const original = envelope("搜索快照通过当前合同，共 12 条。"),
    pending = plain(
      run(prefix + `const ${declaration("acceptance")};globalThis.result=acceptance;`),
    ),
    organizations = envelope("一次性验收组织"),
    workspaces = envelope("1688 验收工作区"),
    scheduled = envelope('task_id: "00000000-0000-4000-8000-000000001688"');
  const source = await read("apps/web/src/components/Alibaba1688AcceptanceCenter.vue");
  const ast = parse(source.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const stripped = ast.statements
    .filter((n) => !ts.isImportDeclaration(n))
    .map((n) => n.getFullText(ast))
    .join("\n");
  const exports = [
    "state,data,message,requestId,refreshing,lastUpdatedAt,notice,noticeTone,organizations,workspaces",
    "selectedOrganizationId,selectedWorkspaceId,acceptanceQuery,scopeLoading,scheduling,scopeMessage,scheduledTaskId",
    "gateName,gateState,gateAction,matrixName,matrixState,sourceState,overallState,runState,passedGateCount,title,conclusion",
    "stateTitle,lastUpdatedLabel,credentialsLink,sampleLink,currentRunState,canSchedule,time,loadWorkspaces,loadExecutionScopes,scheduleAcceptanceRun,load",
  ].join(",");
  const sourceLogic = `// Actual Vue script in an inert bridge; not mounted Vue.\nwindow.ACCEPTANCE_C_SOURCE=(bridge)=>{const {ref,computed,onMounted,onBeforeUnmount,defineProps,createApiClient,ApiClientError,window,AbortController,DOMException}=bridge;\n${compile(stripped)}\nreturn {${exports}};};\n`;
  class ApiClientError extends Error {
    constructor(status) {
      super(String(status));
      this.status = status;
      this.kind = status === 401 ? "expired" : status === 403 ? "forbidden" : "error";
      this.actionHint = `合成拒绝 ${status}`;
      this.requestId = `synthetic-${status}`;
    }
  }
  function mount() {
    const box = { window: {} };
    vm.runInNewContext(sourceLogic, box);
    const calls = [],
      timers = [],
      unmount = [];
    const c = box.window.ACCEPTANCE_C_SOURCE({
      ref: (value) => ({ value }),
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
      onMounted: () => {},
      onBeforeUnmount: (fn) => unmount.push(fn),
      defineProps: () => ({ apiBaseUrl: "inert" }),
      createApiClient:
        () =>
        (route, options = {}) =>
          new Promise((resolve, reject) => calls.push({ route, options, resolve, reject })),
      ApiClientError,
      AbortController,
      DOMException,
      window: {
        setTimeout: (fn, ms) => {
          timers.push({ fn, ms });
          return timers.length;
        },
        clearTimeout: () => {},
      },
    });
    return { c, calls, timers, unmount };
  }
  const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  const resolve = (call, data) =>
    call.resolve({ data: plain(data), request_id: "fixture-request" });
  const checks = [];
  {
    const { c } = mount();
    c.data.value = original;
    assert.equal(c.passedGateCount.value, 2);
    assert.equal(c.currentRunState.value, "运行成功");
    assert.equal(
      c.credentialsLink.value,
      `/platform-admin/credentials?provider_id=${original.provider_id}&mode=login`,
    );
    assert.equal(
      c.sampleLink.value,
      `/platform-admin/providers/sources?provider_id=${original.provider_id}`,
    );
    for (const [status, label] of Object.entries(c.runState)) {
      c.data.value = { ...original, latest_run: { ...original.latest_run, status } };
      assert.equal(c.currentRunState.value, label);
    }
    c.data.value = pending;
    assert.equal(c.currentRunState.value, "尚无运行");
    checks.push(
      "Original 2/3 gates and 12/3/1 coverage, independent all-pending fixture, exact links and nine run labels from actual source",
    );
  }
  {
    const { c, calls } = mount();
    const p = c.loadExecutionScopes();
    resolve(calls[0], [
      ...organizations,
      { ...organizations[0], id: "inactive", membership_status: "revoked" },
    ]);
    await flush();
    assert.equal(c.organizations.value.length, 1);
    resolve(calls[1], [
      { ...workspaces[0], id: "not-default" },
      ...workspaces,
      { ...workspaces[0], id: "archived", status: "archived" },
    ]);
    await p;
    assert.equal(c.selectedWorkspaceId.value, workspaces[0].id);
    assert.equal(c.workspaces.value.length, 2);
    assert.equal(c.canSchedule.value, false);
    c.data.value = original;
    c.acceptanceQuery.value = "  桌面灯  ";
    assert.equal(c.canSchedule.value, true);
    const saving = c.scheduleAcceptanceRun();
    assert.equal(c.scheduling.value, true);
    const call = calls[2];
    assert.deepEqual(plain(call.options.body), {
      organization_id: organizations[0].id,
      workspace_id: workspaces[0].id,
      query: "桌面灯",
      acceptance_run: true,
    });
    await c.scheduleAcceptanceRun();
    assert.equal(calls.length, 3);
    resolve(call, scheduled);
    await flush();
    assert.equal(calls[3].route, "/platform/provider-sources/1688-acceptance");
    calls[3].reject(new ApiClientError(503));
    await saving;
    assert.equal(c.scheduledTaskId.value, scheduled.task_id);
    assert.equal(c.noticeTone.value, "success");
    assert.match(c.notice.value, /已提交/);
    assert.match(c.message.value, /503/);
    assert.equal(c.data.value.overall, "setup_required");
    checks.push(
      "Actual active scope/default workspace, trim/exact four-field POST, duplicate guard, one follow-up GET; reproduced scheduled success overwriting failed refresh notice while old facts remain",
    );
  }
  for (const preserve of [false, true])
    for (const status of [401, 403, 503, "timeout"]) {
      const { c, calls, timers, unmount } = mount();
      if (preserve) c.data.value = original;
      const p = c.load();
      await c.load();
      assert.equal(calls.length, 1);
      assert.equal(timers[0].ms, 12000);
      if (status === "timeout") {
        timers[0].fn();
        assert.equal(calls[0].options.signal.aborted, true);
      }
      calls[0].reject(
        status === "timeout"
          ? new DOMException("aborted", "AbortError")
          : new ApiClientError(status),
      );
      await p;
      assert.equal(
        c.state.value,
        preserve ? "ready" : status === 401 ? "expired" : status === 403 ? "forbidden" : "error",
      );
      if (preserve) {
        assert.equal(c.data.value, original);
        assert.equal(c.noticeTone.value, "danger");
      }
      const again = c.load();
      unmount[0]();
      assert.equal(calls[1].options.signal.aborted, true);
      calls[1].reject(new DOMException("aborted", "AbortError"));
      await again;
    }
  checks.push(
    "Eight actual first/existing read error paths, 12-second timer callback, single flight and unmount abort; no real elapsed network timeout or KeepAlive proof",
  );
  // Execute the actual read method with controlled SQL row responses; SQL itself is not executed.
  const repositoryText = await read("apps/api/src/mysql-provider-source-sample-repository.ts");
  const repositoryAst = parse(repositoryText);
  const repositoryClass = repositoryAst.statements.find((n) => ts.isClassDeclaration(n));
  const method = repositoryClass.members.find(
    (n) => n.name?.getText(repositoryAst) === "read1688Acceptance",
  );
  const Repository = run(
    `class Reader { constructor(private pool:any) {} ${method.getText(repositoryAst)} } globalThis.result=Reader;`,
    {
      iso: (v) => new Date(v).toISOString(),
      ProviderSourceServiceError: ApiClientError,
      coverageMatrix: () => plain(pending.coverage_matrix),
    },
  );
  const variants = {};
  const timestamp = "2026-08-21T07:12:00.000Z";
  const rowsFor = (scenario, status = "disabled") => ({
    provider: {
      id: original.provider_id,
      status,
      owner_label: original.owner_label,
      parser_version: "1688-browser-contract-v3",
    },
    profile: { active_count: scenario === "no-profile" ? 0 : 1, evidence_at: timestamp },
    run:
      scenario === "no-run"
        ? undefined
        : {
            status: ["login-expired", "captcha-blocked"].includes(scenario)
              ? "blocked"
              : "succeeded",
            error_code:
              scenario === "login-expired"
                ? "session_expired"
                : scenario === "captcha-blocked"
                  ? "captcha"
                  : null,
            started_at: timestamp,
            finished_at: timestamp,
          },
    parser: {
      current_parser_passed: scenario === "all-passed" ? 1 : 0,
      replay_parser_version:
        scenario === "old-parser" ? "1688-browser-contract-v2" : "1688-browser-contract-v3",
      last_replay_status: scenario === "parser-changed" ? "changed" : "passed",
      review_status: scenario === "all-passed" ? "approved" : "pending",
      last_replay_at: timestamp,
    },
  });
  for (const scenario of [
    "no-profile",
    "no-run",
    "login-expired",
    "captcha-blocked",
    "old-parser",
    "parser-changed",
    "review-pending",
    "all-passed",
  ]) {
    for (const status of ["draft", "disabled", "enabled"]) {
      const rows = rowsFor(scenario, status),
        queries = [];
      const reader = new Repository({
        query: async (sql, values) => {
          queries.push({ sql, values });
          const row = sql.includes("FROM providers")
            ? rows.provider
            : sql.includes("COUNT(*)")
              ? rows.profile
              : sql.includes("FROM crawler_browser_runs")
                ? rows.run
                : sql.includes("FROM provider_parser_samples")
                  ? rows.parser
                  : undefined;
          return [row ? [row] : []];
        },
      });
      const value = plain(await reader.read1688Acceptance(new Date(timestamp)));
      assert.equal(queries.length, 5);
      assert.equal(
        value.overall,
        scenario === "all-passed"
          ? status === "enabled"
            ? "production_ready"
            : "ready_for_enable"
          : "setup_required",
      );
      assert.equal(value.source_status, status);
      assert.ok(queries[3].sql.includes("r.created_at=s.last_replay_at"));
      variants[`${scenario}-${status}`] = value;
    }
  }
  assert.match(variants["old-parser-disabled"].gates[2].reason, /v2/);
  assert.equal(variants["parser-changed-disabled"].gates[2].state, "blocked");
  assert.equal(variants["captcha-blocked-enabled"].source_status, "enabled");
  checks.push(
    "24 actual repository read-method combinations using inert SQL rows; aggregate SQL not executed, coverage adapter deliberately returns no observations; enabled plus setup_required retained, no automatic disabling inferred",
  );
  return {
    sourceLogic,
    data: {
      original,
      pending,
      organizations,
      workspaces,
      scheduled,
      variants,
      checks,
      sourcePaths: [
        "apps/web/src/components/Alibaba1688AcceptanceCenter.vue",
        "apps/api/src/mysql-provider-source-sample-repository.ts",
        "apps/api/src/provider-source-service.ts",
        "apps/api/src/provider-source-routes.ts",
        "apps/api/src/mysql-provider-source-repository.ts",
        "tests/e2e/m03-07-provider-sources.spec.ts",
      ],
    },
  };
}
