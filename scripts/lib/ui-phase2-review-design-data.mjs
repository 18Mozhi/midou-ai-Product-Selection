import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildReviewDesignData(repo) {
  const read = async (f) => (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n");
  function extract(text, name, kind = "variable") {
    const ast = ts.createSourceFile("source.ts", text, ts.ScriptTarget.Latest, true),
      matches = [];
    function visit(n) {
      if (kind === "variable" && ts.isVariableDeclaration(n) && n.name.getText(ast) === name)
        matches.push(n.initializer.getText(ast));
      if (kind === "function" && ts.isFunctionDeclaration(n) && n.name?.text === name)
        matches.push(n.getText(ast));
      if (kind === "class" && ts.isClassDeclaration(n) && n.name?.text === name)
        matches.push(n.getText(ast));
      if (kind === "method" && ts.isMethodDeclaration(n) && n.name.getText(ast) === name)
        matches.push(n.getText(ast));
      if (
        kind === "ai" &&
        ts.isObjectLiteralExpression(n) &&
        n.properties.some((p) => p.name?.getText(ast) === "input_sha256") &&
        n.properties.some((p) => p.name?.getText(ast) === "result")
      )
        matches.push(n.getText(ast));
      if (
        kind === "fact" &&
        ts.isObjectLiteralExpression(n) &&
        n.properties.some((p) => p.name?.getText(ast) === "predicted_profit_amount") &&
        n.properties.some((p) => p.name?.getText(ast) === "period_start")
      )
        matches.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
    assert.equal(matches.length, 1, name);
    return matches[0];
  }
  const fixedNow = "2026-08-23T03:00:00.000Z";
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [fixedNow]));
    }
    static now() {
      return new Date(fixedNow).valueOf();
    }
  }
  function run(code, bindings = {}) {
    const context = { exports: {}, Date: FixedDate, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      context,
    );
    return context.exports;
  }
  const vars = (text, names) => names.map((n) => `const ${n}=${extract(text, n)};`).join("\n");
  const main = (await read("apps/web/src/components/OpportunityWorkspace.vue"))
    .split('<script setup lang="ts">')[1]
    .split("</script>")[0];
  const aiFixture = await read("tests/e2e/m04-07-ai-analysis.spec.ts"),
    feedbackFixture = await read("tests/m04-02/operating-feedback.test.mjs"),
    lineageFixture = await read("tests/m04-02/business-lineage.test.mjs");
  const facts = plain(
    run(
      `${vars(aiFixture, ["opportunityId", "resultId", "detail"])} export {detail}; export const analyses=[${extract(aiFixture, "analyses", "ai")}];`,
    ),
  );
  const valid = plain(run(`export const valid=${extract(feedbackFixture, "valid")};`).valid);
  const rawFact = run(`export const row=${extract(feedbackFixture, "row", "fact")};`).row;
  const repository = await read("apps/api/src/mysql-opportunity-repository.ts");
  const Repo = run(
    `${vars(repository, ["iso", "mysqlDateOnly", "numberOrNull", "sqlText"])} class Probe {constructor(pool){this.pool=pool;} ${extract(repository, "lineage", "method")} ${extract(repository, "operatingFeedback", "method")} } export {Probe};`,
  ).Probe;
  const rows = run(`${vars(lineageFixture, ["at", "rows"])} export {rows};`).rows;
  const scope = {
      organizationId: "organization-1",
      workspaceId: "workspace-1",
      opportunityId: "opportunity-1",
    },
    queries = [];
  const lineage = plain(
    await new Repo({
      query: async (sql, params) => {
        queries.push({ sql, params });
        for (const [part, key] of [
          ["SELECT DISTINCT p.id source_id", "source"],
          ["FROM collection_task_attempts", "attempt"],
          ["FROM data_quality_issues", "quality"],
          ["JOIN trend_topics", "trend"],
          ["LEFT JOIN opportunity_events", "opportunity"],
          ["FROM opportunity_score_runs", "score"],
          ["FROM opportunity_profit_runs", "profit"],
          ["FROM tasks t LEFT JOIN task_events", "task"],
          ["FROM notifications", "notification"],
        ])
          if (sql.includes(part)) return [rows[key]];
        throw new Error("Unexpected lineage query");
      },
    }).lineage(scope),
  );
  assert.equal(lineage.nodes.length, 11);
  assert.equal(lineage.failure_impact.level, "blocked");
  assert.equal(lineage.freshness.age_seconds, 3600);
  assert.equal(queries.length, 9);
  assert.ok(
    queries.every(
      (q) => q.params.includes(scope.organizationId) && q.params.includes(scope.workspaceId),
    ),
  );
  const feedbackVersions = {};
  for (const [name, patch] of Object.entries({
    history: {},
    incomparable: { predicted_currency: "CNY", quoted_lead_time_days: null },
    zero: {
      sales_units: 0,
      returned_units: 0,
      revenue_amount: 0,
      ad_spend_amount: 0,
      actual_profit_amount: 0,
      predicted_profit_amount: 0,
      purchase_lead_time_days: 0,
      quoted_lead_time_days: 0,
    },
    loss: { actual_profit_amount: -20 },
  })) {
    feedbackVersions[name] = plain(
      await new Repo({ query: async () => [[{ ...rawFact, ...patch }]] }).operatingFeedback(scope),
    );
  }
  assert.equal(feedbackVersions.history.calibration.profit_variance_amount, -20);
  assert.equal(feedbackVersions.history.calibration.return_rate_percent, 5);
  assert.equal(feedbackVersions.incomparable.calibration.profit_variance_amount, null);
  assert.equal(feedbackVersions.zero.calibration.return_rate_percent, null);
  assert.equal(feedbackVersions.zero.calibration.profit_variance_amount, 0);
  // One explicit successful submission fixture: append, do not reuse the old fact as the new one.
  const submittedRow = {
    ...rawFact,
    ...valid,
    id: "isolated-submitted-fact-1",
    currency: "USD",
    score_rule_version_snapshot: facts.detail.score_rule_version,
    profit_rule_version_snapshot: null,
    decision_status_snapshot: facts.detail.decision_status,
    predicted_profit_amount: null,
    predicted_currency: null,
    quoted_lead_time_days: null,
    observed_at: new FixedDate(),
    created_at: new FixedDate(),
    request_id: "isolated-feedback-submission",
    trace_id: "isolated-feedback-trace",
  };
  const feedbackSubmission = plain(
    await new Repo({ query: async () => [[submittedRow, rawFact]] }).operatingFeedback(scope),
  );
  assert.equal(feedbackSubmission.facts.length, 2);
  assert.equal(feedbackSubmission.facts[0].notes, valid.notes);
  assert.deepEqual(feedbackSubmission.facts[1], feedbackVersions.history.facts[0]);
  assert.equal(feedbackSubmission.calibration.profit_variance_amount, null);
  const service = await read("apps/api/src/opportunity-service.ts");
  const validate = run(
    `${extract(service, "OpportunityServiceError", "class")} ${vars(service, ["bounded", "operatingInteger", "operatingAmount", "operatingDate"])} ${extract(service, "validateOperatingFeedback", "function")} export {validateOperatingFeedback};`,
  ).validateOperatingFeedback;
  assert.equal(validate({ ...valid, actual_profit_amount: -20 }).actual_profit_amount, -20);
  for (const patch of [
    { returned_units: 101 },
    { period_end: "2026-07-31" },
    { sales_units: 1.5 },
    { period_start: "2026-02-30" },
  ])
    assert.throws(() => validate({ ...valid, ...patch }));
  const defaults = plain(
    run(
      `${extract(await read("apps/web/src/components/opportunity-workspace-forms.ts"), "createOpportunityWorkspaceForms", "function")} export const form=createOpportunityWorkspaceForms().feedbackForm;`,
      { reactive: (v) => v },
    ).form,
  );
  const { expected_version: ignoredVersion, ...fields } = valid;
  const feedbackForm = { ...fields, currency: "usd" },
    feedbackIntents = {};
  for (const success of [true, false]) {
    const form = { ...feedbackForm },
      detail = { value: { ...facts.detail, operating_feedback: { facts: [], calibration: null } } };
    await run(
      `${extract(main, "submitOperatingFeedback", "function")} export const result=submitOperatingFeedback();`,
      {
        detail,
        feedbackForm: form,
        message: { value: "" },
        write: async (p, body) => {
          feedbackIntents[success] = plain({ method: "POST", path: p, body });
          return success ? feedbackSubmission : null;
        },
      },
    ).result;
    assert.equal(form.source_ref, success ? "" : valid.source_ref);
    assert.equal(form.notes, success ? "" : valid.notes);
    assert.equal(form.sales_units, valid.sales_units);
    assert.equal(detail.value.version, facts.detail.version);
    assert.equal(detail.value.operating_feedback.facts.length, success ? 2 : 0);
  }
  assert.equal(feedbackIntents.true.body.observed_at, fixedNow);
  assert.equal(feedbackIntents.true.body.expected_version, facts.detail.version);
  assert.equal(feedbackIntents.true.body.currency, "USD");
  const reasonSource = await read("apps/web/src/use-audited-reason.ts"),
    dialog = await read("apps/web/src/components/AuditedReasonDialog.vue"),
    intents = {},
    reason = "  已核对原始证据范围  ";
  const reasonFactory = run(
    `${extract(reasonSource, "useAuditedReason", "function")} export {useAuditedReason};`,
    {
      ref: (value) => ({ value }),
      computed: (fn) => ({
        get value() {
          return fn();
        },
      }),
    },
  ).useAuditedReason;
  for (const outcome of ["approved", "rejected"]) {
    for (const success of [true, false]) {
      const ctl = reasonFactory();
      let reads = 0,
        closedAtWrite = false;
      const promise = run(
        `${extract(main, "reviewAi", "function")} export const result=reviewAi(resultId,outcome);`,
        {
          resultId: facts.analyses[0].result.id,
          outcome,
          askAiReviewReason: ctl.ask,
          write: async (p, body) => {
            closedAtWrite = !ctl.open.value;
            intents[outcome] = plain({ method: "POST", path: p, body });
            return success ? {} : null;
          },
          load: async () => {
            reads++;
          },
          setTab: async (tab) => assert.equal(tab, "ai"),
          message: { value: "" },
        },
      ).result;
      assert.equal(ctl.request.value.minimumLength, 2);
      run(`${extract(dialog, "submit", "function")} submit();`, {
        reason: { value: reason },
        props: { minimumLength: 2 },
        emit: (_, value) => ctl.submit(value),
      });
      await promise;
      assert.equal(closedAtWrite, true);
      assert.equal(reads, success ? 1 : 0);
      assert.equal(ctl.request.value, null);
    }
  }
  let queueReads = 0;
  await run(`${extract(main, "queueAi", "function")} export const result=queueAi();`, {
    detail: { value: facts.detail },
    write: async (p, body) => {
      intents.queue = plain({ method: "POST", path: p, body });
      return {};
    },
    load: async () => {
      queueReads++;
    },
    setTab: async (tab) => assert.equal(tab, "ai"),
    message: { value: "" },
  }).result;
  assert.equal(queueReads, 1);
  const cancelled = reasonFactory();
  let cancelledWrites = 0;
  const cancelledPromise = run(
    `${extract(main, "reviewAi", "function")} export const result=reviewAi(resultId,"approved");`,
    {
      resultId: facts.analyses[0].result.id,
      askAiReviewReason: cancelled.ask,
      write: async () => {
        cancelledWrites++;
      },
    },
  ).result;
  cancelled.cancel();
  await cancelledPromise;
  assert.equal(cancelledWrites, 0);
  assert.ok(
    (await read("apps/web/src/components/OpportunityLineagePanel.vue")).includes(
      "lineage.freshness.age_seconds ?? 0",
    ),
  );
  for (const mode of ["error", "malformed"]) {
    const aiAnalyses = { value: facts.analyses },
      aiLoadState = { value: "ready" };
    await run(`${extract(main, "loadAi", "function")} export const result=loadAi();`, {
      props: { opportunityId: facts.detail.id },
      aiAnalyses,
      aiLoadState,
      ApiClientError: class extends Error {},
      requestId: { value: "" },
      request: async () => {
        if (mode === "error") throw new Error("isolated");
        return { data: {} };
      },
    }).result;
    assert.equal(aiLoadState.value, mode === "error" ? "error" : "ready");
    assert.equal(aiAnalyses.value.length, mode === "error" ? 1 : 0);
  }
  const aiService = await read("apps/api/src/ai-analysis-service.ts");
  const reviewValidator = run(
    `${extract(aiService, "AiAnalysisServiceError", "class")} ${vars(aiService, ["text"])} ${extract(aiService, "validateReview", "function")} export {validateReview};`,
  ).validateReview;
  assert.equal(reviewValidator({ outcome: "approved", notes: "一" }).notes, "一");
  assert.throws(() => reviewValidator({ outcome: "approved", notes: "字".repeat(1001) }));
  return {
    version: "REVIEW-C-r1",
    fixedNow,
    facts,
    lineage,
    feedbackVersions,
    feedbackSubmission,
    defaults,
    feedbackForm,
    feedbackIntent: feedbackIntents.true,
    intents,
    reason,
    knownGaps: {
      aiReadFailureKeepsOldResults: true,
      malformedAiResponseBecomesEmpty: true,
      reviewClosesBeforeWriteAndFailure: true,
      frontendReviewMin2BackendMin1Max1000: true,
      lineageNullAgeRenderedAsZero: true,
      sourceFixed: false,
    },
    boundary:
      "Historical isolated AI/lineage/operating-feedback fixtures; source functions and inert repository read adapters, no real Vue/API/DB/RBAC/worker/production. Lineage fixture retains opportunity-1 and its routes separately from the AI fixture; no cross-object causal graph. Scenario mutations are explicitly synthetic. Calibration is calculated by extracted repository code offline, never by the browser or from AI output.",
  };
}
