import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildProfitDesignData(repo) {
  const read = async (f) => (await readFile(path.join(repo, f), "utf8")).replaceAll("\r\n", "\n");
  const main = (await read("apps/web/src/components/OpportunityWorkspace.vue"))
      .split('<script setup lang="ts">')[1]
      .split("</script>")[0],
    queue = await read("apps/web/src/components/OpportunityCostReviewQueue.vue"),
    forms = await read("apps/web/src/components/opportunity-workspace-forms.ts"),
    fixture = await read("tests/e2e/m04-04-profit.spec.ts"),
    service = await read("apps/api/src/profit-service.ts"),
    repository = await read("apps/api/src/mysql-profit-repository.ts"),
    presentation = await read("apps/web/src/components/opportunity-workspace-presentation.ts");
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
      if (
        kind === "analysis" &&
        ts.isObjectLiteralExpression(n) &&
        n.properties.some((p) => p.name?.getText(ast) === "latest_run") &&
        n.properties.some((p) => p.name?.getText(ast) === "cost_input_reviews")
      )
        matches.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
    assert.equal(matches.length, 1, name);
    return matches[0];
  }
  const fixedNow = "2026-08-08T12:00:00.000Z";
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [fixedNow]));
    }
    static now() {
      return new Date(fixedNow).valueOf();
    }
  }
  function run(code, bindings = {}) {
    const context = { exports: {}, reactive: (v) => v, Date: FixedDate, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      context,
    );
    return context.exports;
  }
  const vars = (text, names) => names.map((n) => `const ${n}=${extract(text, n)};`).join("\n");
  const facts = plain(
    run(
      `${vars(fixture, ["opportunityId", "ruleId", "reviewerId", "reviewId", "detail", "components"])}\nconst reviewStatus="pending"; export const analysis=${extract(fixture, "analysis", "analysis")}; export {detail,reviewerId,reviewId};`,
    ),
  );
  const defaults = plain(
    run(
      `${extract(forms, "createOpportunityWorkspaceForms", "function")}\nexport const value=createOpportunityWorkspaceForms().costForm;`,
    ).value,
  );
  assert.equal(defaults.observed_at, "2026-08-08T12:00");
  assert.equal(
    new Date(defaults.observed_at).getTimezoneOffset(),
    -480,
    "This source-local-time probe requires Asia/Shanghai host timezone",
  );
  const defaultParsed = new Date(defaults.observed_at).toISOString();
  assert.equal(defaultParsed, "2026-08-08T04:00:00.000Z");
  const form = {
    ...defaults,
    platform: "Amazon",
    amount_value: 40,
    currency: "cny",
    source_type: "manual_confirmation",
    source_ref_id: "  verified:purchase_price  ",
    evidence_id: facts.analysis.cost_input_reviews[0].evidence_id,
    observed_at: "2026-08-08T12:00",
    reviewer_id: facts.analysis.cost_input_reviews[0].submitter_id,
  };
  const intents = {},
    reason = "  报价证据与币种一致  ";
  for (const input_type of ["sale_price", "purchase_price", "logistics"]) {
    const costForm = { ...form, input_type };
    let reads = 0;
    await run(`${extract(main, "confirmCost", "function")}\nexport const result=confirmCost();`, {
      detail: { value: facts.detail },
      costForm,
      write: async (p, body) => {
        intents[input_type] = { method: "POST", path: p, body: plain(body) };
        return {};
      },
      load: async () => {
        reads++;
      },
      message: { value: "" },
    }).result;
    assert.equal(reads, 1);
    assert.equal(costForm.source_ref_id, form.source_ref_id);
  }
  const validation = run(
    `${extract(service, "ProfitServiceError", "class")}\n${vars(service, ["bounded", "uuid", "currency", "amount"])}\n${extract(service, "validateCostInput", "function")}\nexport {validateCostInput};`,
  ).validateCostInput;
  const Service = run(
    `${extract(service, "ProfitServiceError", "class")}\n${vars(service, ["bounded", "uuid", "currency", "amount"])}\n${extract(service, "validateCostInput", "function")}\n${extract(service, "ProfitService", "class")}\nexport {ProfitService};`,
    { randomUUID: () => "00000000-0000-4000-8000-000000900450" },
  ).ProfitService;
  let recorded = 0;
  const serviceProbe = new Service({
    recordCost: async () => {
      recorded++;
      return {};
    },
  });
  assert.throws(
    () =>
      serviceProbe.recordCost({
        actorId: facts.reviewerId,
        opportunityId: facts.detail.id,
        value: { ...intents.purchase_price.body, reviewer_id: facts.reviewerId },
      }),
    (e) => e.code === "cost_input_self_review_forbidden",
  );
  assert.equal(recorded, 0);
  await serviceProbe.recordCost({
    actorId: facts.reviewerId,
    opportunityId: facts.detail.id,
    value: intents.purchase_price.body,
  });
  assert.equal(recorded, 1);
  for (const type of ["sale_price", "purchase_price", "logistics"]) {
    const normalized = validation(intents[type].body);
    assert.equal(normalized.currency, "CNY");
    assert.equal(normalized.platform, "amazon");
    assert.equal(normalized.source_ref_id, "verified:purchase_price");
    const input = { ...intents[type].body, amount_value: 0 };
    if (type === "sale_price") assert.throws(() => validation(input));
    else assert.equal(validation(input).amount_value, 0);
  }
  assert.throws(() => validation({ ...intents.purchase_price.body, observed_at: "invalid" }));
  const reviewIntents = {};
  for (const decision of ["approved", "rejected"]) {
    let payload;
    const review = { id: "old", decision: "approved", reason: "旧原因" };
    run(`${extract(queue, "beginReview", "function")}\nbeginReview(id,decision);`, {
      review,
      id: facts.reviewId,
      decision,
    });
    assert.equal(review.reason, "");
    review.reason = reason;
    run(`${extract(queue, "submitReview", "function")}\nsubmitReview(item);`, {
      review,
      item: facts.analysis.cost_input_reviews[0],
      emit: (_, p) => {
        payload = plain(p);
      },
    });
    assert.equal(payload.reason, reason.trim());
    let reads = 0;
    await run(
      `${extract(main, "reviewCost", "function")}\nexport const result=reviewCost(payload);`,
      {
        payload,
        detail: { value: facts.detail },
        write: async (p, body) => {
          reviewIntents[decision] = { method: "POST", path: p, body: plain(body) };
          return {};
        },
        load: async () => {
          reads++;
        },
        message: { value: "" },
      },
    ).result;
    assert.equal(reads, 1);
    assert.equal(review.id, facts.reviewId);
    assert.equal(review.reason, reason);
  }
  let queueIntent;
  await run(`${extract(main, "queueProfit", "function")}\nexport const result=queueProfit();`, {
    detail: { value: facts.detail },
    costForm: form,
    write: async (p, body) => {
      queueIntent = { method: "POST", path: p, body: plain(body) };
      return {};
    },
    load: async () => {},
    message: { value: "" },
  }).result;
  // Repository execution with an inert DB adapter proves overdue is not an expiry guard.
  const repositoryClass = run(
    `${extract(repository, "MySqlProfitRepository", "class")}\nexport {MySqlProfitRepository};`,
    { ProfitServiceError: class extends Error {}, iso: (v) => v },
  ).MySqlProfitRepository;
  const queries = [],
    reviewRow = {
      reviewer_id: facts.reviewerId,
      submitter_id: "00000000-0000-4000-8000-000000000451",
      status: "pending",
      version: 1,
      opportunity_version: 8,
      cost_input_id: "00000000-0000-4000-8000-000000000450",
      platform: "amazon",
      input_type: "purchase_price",
      input_version: 1,
      market: "US",
      due_at: "2020-01-01T00:00:00Z",
    };
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
    query: async (sql) => {
      queries.push(sql);
      return [sql.startsWith("SELECT r.*") ? [reviewRow] : []];
    },
  };
  const repoProbe = new repositoryClass(
    { getConnection: async () => connection },
    () => new FixedDate(),
  );
  repoProbe.operation = async () => null;
  repoProbe.record = async () => {};
  repoProbe.save = async () => {};
  const overdueResult = await repoProbe.reviewCost({
    actorId: facts.reviewerId,
    opportunityId: facts.detail.id,
    reviewId: facts.reviewId,
    expectedVersion: 1,
    decision: "rejected",
    reason: reason.trim(),
  });
  assert.equal(overdueResult.review_status, "rejected");
  assert.equal(overdueResult.job_status, "not_queued");
  const readOnlyGate = repository.includes(
    'can_review: item.status === "pending" && String(item.reviewer_id) === input.actorId',
  );
  assert.equal(readOnlyGate, true);
  const reviewerOptions = { value: [{ id: "old", label: "旧成员" }] },
    loadState = { value: "loading" };
  await run(`${extract(main, "load", "function")}\nexport const result=load();`, {
    props: { opportunityId: facts.detail.id },
    state: loadState,
    message: { value: "" },
    detail: { value: null },
    profit: { value: null },
    canConfirmCost: { value: true },
    costReviewerOptions: reviewerOptions,
    read: async (p) => ({ data: p.endsWith("profit-analysis") ? facts.analysis : facts.detail }),
    request: async () => {
      throw new Error("isolated reviewer read failure");
    },
    loadAi: async () => {},
    loadDownstream: async () => {},
  }).result;
  assert.deepEqual(plain(reviewerOptions.value), []);
  assert.equal(loadState.value, "ready");
  return {
    version: "PROFIT-C-r1",
    fixedNow,
    facts,
    defaults,
    form,
    intents,
    reviewIntents,
    queueIntent,
    reason,
    componentLabels: plain(
      run(`export const value=${extract(presentation, "profitComponentLabels")};`).value,
    ),
    knownGaps: {
      historicalReviewerFixtureConflictsWithSelfReviewGuard: true,
      utcDefault: defaults.observed_at,
      parsedDefault: defaultParsed,
      offsetHours: -8,
      reviewSuccessKeepsForm: true,
      reviewerFailureBecomesEmpty: true,
      sourceFixed: false,
    },
    boundary:
      "Historical isolated M04-04 fixture; source functions and inert repository adapter, no actual Vue/API/DB/RBAC/production. Overdue does not disable assigned pending review. Profit figures are source snapshots, never browser-calculated.",
  };
}
