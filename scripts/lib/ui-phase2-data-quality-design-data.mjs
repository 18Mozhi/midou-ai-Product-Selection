import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Inert source execution: no Vue mount, HTTP, database, file download or authorization grant.
export async function buildDataQualityDesignData(repo) {
  const proposalRevision = "3d297b78d6e26abe803a10bd1a688fc4254d38bb";
  const sourcePaths = [
    "apps/web/src/components/DataQualityCenter.vue",
    "apps/web/src/components/ConfirmDialog.vue",
    "apps/api/src/data-quality-service.ts",
    "apps/api/src/data-quality-routes.ts",
    "apps/api/src/mysql-data-quality-repository.ts",
    "tests/e2e/m03-06-evidence-data-quality.spec.ts",
  ];
  const historicalSources = new Set([sourcePaths[0], sourcePaths[5]]);
  const read = (p) =>
    historicalSources.has(p)
      ? Promise.resolve(
          execFileSync("git", ["show", `${proposalRevision}:${p}`], {
            cwd: repo,
            encoding: "utf8",
          }),
        )
      : readFile(path.join(repo, p), "utf8");
  const parse = (s) => ts.createSourceFile("source.ts", s, ts.ScriptTarget.Latest, true);
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
  const fixture = parse(await read(sourcePaths[5]));
  const constants = fixture.statements
    .filter(
      (n) =>
        ts.isVariableStatement(n) &&
        n.declarationList.declarations.some((d) =>
          ["ids", "evidence", "issue", "run"].includes(d.name.getText(fixture)),
        ),
    )
    .map((n) => n.getFullText(fixture))
    .join("\n");
  const dashboardNode = fixture.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name.text === "dashboard",
  );
  assert.ok(dashboardNode.parameters[1].initializer);
  let lineage;
  function visit(n) {
    if (
      ts.isObjectLiteralExpression(n) &&
      n.properties.some((p) => p.name?.getText(fixture) === "field_provenance") &&
      n.properties.some((p) => p.name?.getText(fixture) === "normalized_records")
    )
      lineage = n.getText(fixture);
    ts.forEachChild(n, visit);
  }
  visit(fixture);
  assert.ok(lineage);
  const box = {};
  vm.runInNewContext(
    compile(
      `${constants}\nglobalThis.result={ids,evidence,issue,run,dashboard:${dashboardNode.parameters[1].initializer.getText(fixture)},lineage:${lineage}}`,
    ),
    box,
  );
  const originals = plain(box.result);
  const vue = await read(sourcePaths[0]);
  const script = strip(vue.split(/<script setup[^>]*>/)[1].split("</script>")[0]);
  const names =
    "evidence,issues,runs,totalEvidence,totalIssues,totalOpenIssues,totalCriticalIssues,observedAt,state,query,tab,page,filteredEvidence,filteredIssues,metrics,retentionRisks,qualityHighlights,selectedIssues,selectedIssueIds,memberOptions,batchMembers,batchAction,batchReason,batchAssignee,batchConfirming,previewBatch,executeBatch,drillIntoRun,clearRunDrilldown,openEvidence,detail,grantDownload,beginResolve,resolving,reason,resolveIssue,notice,load,refreshing,saving,confirming";
  const logic = `window.DATA_QUALITY_SOURCE=(b)=>{const {computed,ref,onBeforeUnmount,onMounted,useRoute,useRouter,defineProps,createApiClient,ApiClientError,window,AbortController,URLSearchParams}=b;${compile(script)}\nreturn {${names}};};`;
  class ApiClientError extends Error {
    constructor(status) {
      super("inert");
      this.status = status;
      this.actionHint = "INERT_READ_FAILED";
    }
  }
  function mount() {
    const context = { window: {} };
    vm.runInNewContext(logic, context);
    const calls = [],
      navigations = [];
    const s = context.window.DATA_QUALITY_SOURCE({
      ref: (value) => ({ value }),
      computed: (get) => ({
        get value() {
          return get();
        },
      }),
      onMounted: () => {},
      onBeforeUnmount: () => {},
      useRoute: () => ({ query: {} }),
      useRouter: () => ({ replace: async () => {} }),
      defineProps: () => ({ apiBaseUrl: "inert" }),
      createApiClient: () => (url, options) =>
        new Promise((resolve, reject) => calls.push({ url, options, resolve, reject })),
      ApiClientError,
      window: {
        setTimeout: () => 1,
        clearTimeout: () => {},
        location: { search: "", assign: () => navigations.push("REDACTED_INTENT") },
      },
      AbortController,
      URLSearchParams,
    });
    s.evidence.value = plain(originals.dashboard.evidence);
    s.issues.value = plain(originals.dashboard.issues);
    s.runs.value = plain(originals.dashboard.reconciliationRuns);
    s.observedAt.value = originals.dashboard.observedAt;
    return { s, calls, navigations };
  }
  const checks = [];
  {
    const { s } = mount();
    assert.deepEqual(plain(s.retentionRisks.value), { expiring: 1, expired: 0 });
    s.observedAt.value = originals.evidence.retention_until;
    assert.deepEqual(plain(s.retentionRisks.value), { expiring: 0, expired: 1 });
    s.observedAt.value = "invalid";
    assert.deepEqual(plain(s.retentionRisks.value), { expiring: 0, expired: 0 });
    assert.equal(s.qualityHighlights.value.filter((i) => i.metric).length, 1);
    s.runs.value.push({
      ...originals.run,
      metrics: [{ code: "title_accuracy", value: 1, threshold: 0.98, status: "passed" }],
    });
    assert.equal(s.qualityHighlights.value[0].metric.value, 0.97);
    s.query.value = " title ";
    assert.equal(s.filteredIssues.value.length, 0);
    s.query.value = "title";
    assert.equal(s.filteredIssues.value.length, 1);
    s.selectedIssueIds.value = [originals.issue.id];
    s.drillIntoRun({ ...originals.run, id: "not-on-page" });
    assert.equal(s.filteredIssues.value.length, 0);
    assert.equal(s.selectedIssues.value.length, 1);
    checks.push(
      "Source retention boundary / invalid observation / first metric / local untrimmed search / hidden selection",
    );
  }
  {
    const { s, calls } = mount();
    const pending = s.openEvidence(originals.evidence.id);
    s.detail.value = null;
    calls[0].resolve({ data: originals.lineage, request_id: "inert" });
    await pending;
    assert.equal(s.detail.value.evidence.id, originals.evidence.id);
    const a = s.openEvidence("older"),
      b = s.openEvidence("newer");
    calls[2].resolve({ data: { evidence: { id: "newer" } } });
    await b;
    calls[1].resolve({ data: { evidence: { id: "older" } } });
    await a;
    assert.equal(s.detail.value.evidence.id, "older");
    checks.push("Source late detail reopens and old detail replaces new detail");
  }
  {
    const { s, calls } = mount();
    const a = s.grantDownload(originals.evidence),
      b = s.grantDownload(originals.evidence);
    assert.equal(calls.length, 2);
    assert.deepEqual(plain(calls[0].options.body), {});
    calls.forEach((c) => c.reject(new ApiClientError(503)));
    await Promise.all([a, b]);
    checks.push(
      "Source duplicate authorization requests, both rejected inertly; no grant produced",
    );
  }
  {
    const { s, calls } = mount();
    s.beginResolve(originals.issue);
    s.reason.value = "已核对原文";
    const a = s.resolveIssue(),
      b = s.resolveIssue();
    assert.equal(calls.length, 2);
    calls[1].reject(new ApiClientError(409));
    await b;
    calls[0].resolve({ data: { ...originals.issue, status: "resolved", version: 2 } });
    for (let i = 0; i < 8 && calls.length < 3; i++) await Promise.resolve();
    assert.equal(calls.length, 3);
    calls[2].reject(new ApiClientError(503));
    await a;
    assert.ok(s.notice.value.includes("已记录解决原因"));
    assert.ok(!s.notice.value.includes("INERT_READ_FAILED"));
    checks.push("Source duplicate resolution and successful write notice hides failed reload");
  }
  {
    const { s, calls } = mount();
    s.selectedIssueIds.value = [originals.issue.id];
    s.batchReason.value = "已核对归因";
    s.previewBatch();
    assert.equal(s.batchConfirming.value, true);
    s.batchAction.value = "close";
    const pending = s.executeBatch();
    assert.equal(calls[0].options.body.action, "close");
    calls[0].reject(new ApiClientError(409));
    await pending;
    s.issues.value = Array.from({ length: 51 }, (_, i) => ({
      ...originals.issue,
      id: `synthetic-${i}`,
    }));
    s.selectedIssueIds.value = s.issues.value.map((i) => i.id);
    s.previewBatch();
    assert.equal(s.batchConfirming.value, true);
    s.batchAction.value = "assign";
    s.batchAssignee.value = "stale-member";
    s.batchConfirming.value = false;
    s.previewBatch();
    assert.equal(s.batchConfirming.value, true);
    checks.push(
      "Source batch mutable action / missing client maximum / stale nonempty member accepted by preview",
    );
  }
  {
    const code = strip(await read(sourcePaths[2]));
    const ctx = {};
    vm.runInNewContext(compile(code + "\nglobalThis.Service=DataQualityService;"), ctx);
    const calls = [];
    const service = new ctx.Service(
      {
        resolveIssue: (v) => calls.push(v),
        batchIssues: (v) => calls.push(v),
        dashboard: (v) => (calls.push(v), {}),
      },
      { evidenceRoot: "inert", downloadSigningKey: "", downloadGrantSeconds: 60 },
      () => new Date(originals.dashboard.observedAt),
    );
    const meta = {
      actorId: originals.ids.org,
      idempotencyKey: "inert",
      requestId: "inert",
      traceId: "inert",
    };
    await assert.rejects(
      service.resolveIssue(originals.issue.id, { reason: "有效原因", expected_version: "1" }, meta),
    );
    await service.resolveIssue(
      originals.issue.id,
      { reason: " 有效原因 ", expected_version: 1 },
      meta,
    );
    assert.equal(calls.at(-1).reason, "有效原因");
    const item = { id: originals.issue.id, expected_version: "1" };
    await service.batchIssues(
      { action: "attribute", reason: "有效原因", items: [item], assignee_membership_id: null },
      meta,
    );
    assert.equal(calls.at(-1).items[0].expectedVersion, 1);
    for (const items of [[], [item, item], Array(51).fill(item)])
      await assert.rejects(
        service.batchIssues({ action: "close", reason: "有效原因", items }, meta),
      );
    for (const reason of ["", "字", "字".repeat(501)])
      await assert.rejects(
        service.resolveIssue(originals.issue.id, { reason, expected_version: 1 }, meta),
      );
    await assert.rejects(service.issueDownload(originals.evidence.id, meta));
    await service.dashboard({ page: "2", page_size: "20", status: "all" });
    assert.equal(calls.at(-1).page, 2);
    assert.equal(calls.at(-1).status, undefined);
    checks.push(
      "Actual service validation: reason/version/batch count/duplicates/coercion/dashboard and disabled grant; inert repository only",
    );
  }
  const confirm = await read(sourcePaths[1]);
  assert.ok(confirm.includes("destructive: false"));
  const blocks = vue.match(/<ConfirmDialog[\s\S]*?\/>/g);
  assert.equal(blocks.length, 2);
  assert.ok(blocks.every((b) => !b.includes("destructive")));
  checks.push(
    "Both actual quality confirmation callers are typed-only, not acknowledgement checkbox",
  );
  return {
    data: {
      originals,
      sourcePaths,
      sourceChecks: checks,
      provenance:
        "Original E2E fixtures extracted by TypeScript AST; additional states are labelled synthetic. No actual HTTP, SQL, audit, grant or download.",
    },
    logic,
  };
}
