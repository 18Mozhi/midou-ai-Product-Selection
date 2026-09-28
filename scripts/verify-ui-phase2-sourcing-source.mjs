import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { ref, reactive, computed, watch, effectScope } from "vue";

export async function verifySourcingSource() {
  const checks = [],
    scopes = [];
  class ApiClientError extends Error {
    constructor(kind) {
      super("synthetic failure");
      Object.assign(this, { kind, requestId: "isolated", actionHint: "隔离失败" });
    }
  }
  class Input {
    checked = false;
  }
  async function setup(file, expose, overrides = {}) {
    const source = await readFile("apps/web/src/components/" + file + ".vue", "utf8");
    let script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
    const ast = ts.createSourceFile("setup.ts", script, ts.ScriptTarget.Latest, true);
    for (const n of [...ast.statements].reverse())
      if (ts.isImportDeclaration(n)) script = script.slice(0, n.pos) + script.slice(n.end);
    const calls = [],
      events = [],
      replies = [],
      routes = [],
      scope = effectScope();
    scopes.push(scope);
    const route = { query: {}, fullPath: "/sourcing" };
    const env = {
      ref,
      reactive,
      computed,
      watch,
      ApiClientError,
      HTMLInputElement: Input,
      defineProps: () => ({
        apiBaseUrl: "inert",
        capabilities: ["supplier_quote:manage", "cost:confirm"],
        opportunityId: "opp",
        canConfirmCost: true,
        ...overrides,
      }),
      defineEmits: () => (name, payload) =>
        events.push({ name, payload: structuredClone(payload) }),
      withDefaults: (v) => v,
      onMounted: () => {},
      useRoute: () => route,
      useSourcingComparisons: (request) => {
        const comparisons = ref([]),
          comparisonFailure = ref(null),
          comparisonLoading = ref(false);
        return {
          comparisons,
          comparisonFailure,
          comparisonLoading,
          loadComparisons: async () => {
            comparisonLoading.value = true;
            comparisonFailure.value = null;
            try {
              const response = await request("/sourcing/comparisons");
              comparisons.value = response.data;
            } catch (error) {
              comparisonFailure.value = {
                actionHint: error.actionHint ?? "对比历史暂不可用，请稍后重试。",
                requestId: error.requestId ?? "",
                retryable: error.kind !== "expired" && error.kind !== "forbidden",
                retainedSnapshot: false,
              };
            } finally {
              comparisonLoading.value = false;
            }
          },
        };
      },
      useRouter: () => ({
        replace: (v) => {
          routes.push(v);
          route.query = v.query;
        },
      }),
      createApiClient: () => async (url, options) => {
        calls.push({ url, options: options ? JSON.parse(JSON.stringify(options)) : undefined });
        assert.ok(replies.length, url);
        const r = await replies.shift();
        if (r instanceof Error) throw r;
        return r;
      },
    };
    const js = ts.transpileModule(script + `\nreturn {${expose}};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    return {
      ...scope.run(() => new Function(...Object.keys(env), js)(...Object.values(env))),
      calls,
      events,
      replies,
      routes,
    };
  }
  const sw = (props) =>
    setup(
      "SourcingWorkspace",
      "load,detail,items,selected,state,notice,form,showSearch,openSearch,closeSearch,create,quote,quoteCandidate,openQuote,confirm,selectedQuotes,choose,compare,purchaseCandidate,purchaseForm,openPurchase,purchase,deleting,deleteReason,removeSearch,refreshSearch,stabilityText,canManage,canConfirmCost,busy,handleStatePrimary,handleStateSecondary,resetQuery,query,filteredItems,comparisonFailure,dialogGeneration,dialogFailure",
      props,
    );
  const sc = (props) =>
    setup(
      "SourcingCostConfirmationPanel",
      "load,profit,reviewers,opportunityVersion,costForm,message,submitCost,reviewCost,queueProfit,busy",
      props,
    );
  const ok = (data) => ({ data, request_id: "synthetic-response" });
  const item = { id: "s1", display_name: "隔离找货", input_ref: "测试", candidates: [] };
  const candidate = {
    id: "c1",
    moq: 100,
    specification: "箱装",
    lead_time_days: 3,
    location: "广东",
    confidence_value: 0,
    observed_at: "2026-09-09T00:00:00.000Z",
    evidence_id: "e1",
    quote: { id: "q1", version: 2, stability_status: "variable", risk_level: "unknown" },
  };
  try {
    for (const kind of ["error", "expired", "forbidden", "blocked"]) {
      for (const handler of ["handleStatePrimary", "handleStateSecondary"]) {
        const recovery = await sw();
        recovery.state.value = kind;
        recovery.selectedQuotes.value = ["old-quote"];
        recovery.replies.push(new ApiClientError(kind));
        recovery[handler]();
        assert.equal(recovery.state.value, "loading");
        assert.deepEqual(recovery.selectedQuotes.value, []);
        assert.equal(recovery.calls[0].url, "/sourcing/searches");
        await new Promise(setImmediate);
        assert.equal(recovery.state.value, kind);
        assert.deepEqual(recovery.routes, [], "recovery does not navigate to login/home/history");
      }
    }
    checks.push(
      "source recovery handlers reload for error/expired/forbidden/blocked; immediate loading clears quote selection, no login/home/history navigation; expired secondary handler exists but shared template hides its absent label",
    );
    for (const managed of [true, false]) {
      const recovery = await sw({ capabilities: managed ? ["supplier_quote:manage"] : [] });
      recovery.state.value = "empty";
      recovery.query.value = "missing";
      recovery.handleStateSecondary();
      assert.equal(recovery.query.value, "");
      assert.equal(recovery.state.value, "empty");
      assert.equal(recovery.calls.length, 0);
      if (!managed) recovery.replies.push(new ApiClientError("forbidden"));
      recovery.handleStatePrimary();
      if (managed) {
        assert.equal(recovery.showSearch.value, true);
        assert.equal(recovery.calls.length, 0);
      } else {
        assert.equal(recovery.showSearch.value, false);
        assert.equal(recovery.calls[0].url, "/sourcing/searches");
        await new Promise(setImmediate);
      }
      recovery.items.value = [{ ...item, input_ref: "ABC-REF", status: "completed" }];
      recovery.query.value = " abc-ref ";
      assert.equal(recovery.filteredItems.value.length, 1);
      const count = recovery.calls.length;
      recovery.query.value = "no-match";
      assert.equal(recovery.filteredItems.value.length, 0);
      recovery.resetQuery();
      assert.equal(recovery.filteredItems.value.length, 1);
      assert.equal(recovery.calls.length, count, "filter/reset only local");
    }
    checks.push(
      "source empty primary is capability-scoped create or load; empty secondary and search reset only clear query; filtering uses trim/lowercase name/input_ref/status without HTTP",
    );
    let s = await sw();
    s.replies.push(ok([item]), new ApiClientError("error"), ok(item));
    await s.load();
    await new Promise(setImmediate);
    assert.equal(s.state.value, "ready");
    assert.equal(s.items.value.length, 1);
    assert.equal(s.comparisonFailure.value.retryable, true);
    checks.push(
      "SC-G02: comparison-history 503 is isolated from the list/detail load and remains retryable in its own panel",
    );
    for (const input_type of ["keyword", "image", "opportunity", "product_url"]) {
      s = await sw();
      Object.assign(s.form, { input_type, input_ref: "  保留显式输入  " });
      s.openSearch();
      s.closeSearch();
      s.openSearch();
      assert.equal(s.calls.length, 0);
      assert.equal(s.form.input_ref, "  保留显式输入  ");
      s.replies.push(new ApiClientError("conflict"));
      await s.create();
      assert.deepEqual(s.calls[0].options.body, { input_type, input_ref: "  保留显式输入  " });
      assert.equal(s.showSearch.value, true);
    }
    checks.push(
      "four search kinds preserve draft/cancel with zero request; exact two-field POST, error retains form",
    );
    s = await sw();
    s.openQuote({
      ...candidate,
      moq: null,
      lead_time_days: null,
      confidence_value: null,
      quote: null,
    });
    assert.equal(s.quote.moq, 1);
    assert.equal(s.quote.lead_time_days, 7);
    assert.equal(s.quote.confidence_value, 80);
    s.openQuote(candidate);
    assert.equal(s.quote.confidence_value, 0);
    assert.equal(new Date(s.quote.observed_at).toISOString(), candidate.observed_at);
    assert.equal(s.stabilityText("variable"), "variable");
    s.replies.push(new ApiClientError("conflict"));
    await s.confirm();
    assert.deepEqual(s.calls[0].options.body, {
      candidate_id: "c1",
      moq: 100,
      specification: "箱装",
      lead_time_days: 3,
      location: "广东",
      confidence_value: 0,
      stability_status: "variable",
      risk_level: "unknown",
      observed_at: candidate.observed_at,
      evidence_id: "e1",
    });
    assert.equal(s.quoteCandidate.value.id, "c1");
    checks.push(
      "quote exact immutable-version intent excludes raw price/currency; existing1/7/80 defaults and variable-label gap remain; zero preserved and local time roundtrips",
    );
    s = await sw();
    s.selected.value = item;
    for (let i = 1; i <= 6; i++) {
      const target = new Input();
      s.choose({ ...candidate, quote: { id: "q" + i } }, { target });
      assert.equal(target.checked, i <= 5);
    }
    assert.equal(s.selectedQuotes.value.length, 5);
    s.replies.push(new ApiClientError("conflict"));
    await s.compare();
    assert.deepEqual(s.calls[0].options.body, {
      name: "隔离找货 报价对比",
      quote_ids: ["q1", "q2", "q3", "q4", "q5"],
    });
    s.choose(candidate, { target: new Input() });
    assert.equal(s.selectedQuotes.value.length, 4);
    checks.push(
      "sixth checkbox is rolled back to accepted five IDs, deselection works, exact comparison quote IDs retained on failure",
    );
    s = await sw();
    s.openPurchase(candidate);
    assert.equal(s.purchaseForm.quantity, 100);
    s.purchaseForm.reason = "  对照报价采购  ";
    s.replies.push(ok({ status: "queued" }));
    await s.purchase();
    assert.deepEqual(s.calls[0].options.body, {
      quote_id: "q1",
      quantity: 100,
      reason: "对照报价采购",
    });
    assert.equal(s.purchaseCandidate.value, null);
    assert.match(s.notice.value, /待消费队列/);
    checks.push(
      "purchase locks quote, resets MOQ, trims reason; queued acceptance never proves procurement executed",
    );
    s = await sw();
    s.deleting.value = item;
    s.deleteReason.value = "  ";
    await s.removeSearch();
    assert.equal(s.calls.length, 0);
    s.deleteReason.value = "  归档测试  ";
    s.replies.push(new ApiClientError("conflict"));
    await s.removeSearch();
    assert.deepEqual(s.calls[0].options, { method: "DELETE", body: { reason: "归档测试" } });
    assert.equal(s.deleteReason.value, "  归档测试  ");
    s.selected.value = item;
    s.replies.push(ok({ task_id: "t1" }), ok([]), ok([]));
    await s.refreshSearch();
    assert.equal(s.notice.value, "重新采集已排队，任务编号 t1。");
    checks.push(
      "delete only trimmed reason, no invented revision; refresh success is shown after its read refresh",
    );
    s = await sw();
    s.busy.value = true;
    s.showSearch.value = true;
    s.form.input_ref = "duplicate guard";
    s.quoteCandidate.value = candidate;
    s.purchaseCandidate.value = candidate;
    s.selected.value = item;
    s.selectedQuotes.value = ["q1", "q2"];
    s.deleting.value = item;
    s.deleteReason.value = "归档测试";
    await s.create();
    await s.confirm();
    await s.purchase();
    await s.compare();
    await s.refreshSearch();
    await s.removeSearch();
    assert.equal(s.calls.length, 0);
    checks.push(
      "all six sourcing write entry points short-circuit while the shared sourcing write is busy",
    );

    s = await sw();
    let resolveLateSuccess;
    s.replies.push(
      new Promise((resolve) => {
        resolveLateSuccess = resolve;
      }),
    );
    s.showSearch.value = true;
    s.form.input_ref = "旧窗口请求";
    const lateCreate = s.create();
    await new Promise(setImmediate);
    assert.equal(s.calls.length, 1);
    s.closeSearch();
    s.openSearch();
    s.form.input_ref = "新草稿保留";
    resolveLateSuccess(ok({ id: "created-late" }));
    await lateCreate;
    assert.equal(s.showSearch.value, true);
    assert.equal(s.form.input_ref, "新草稿保留");
    assert.match(s.notice.value, /当前打开的窗口与页面选择保持不变/);

    s = await sw();
    let resolveLateFailure;
    s.replies.push(
      new Promise((resolve) => {
        resolveLateFailure = resolve;
      }),
    );
    s.showSearch.value = true;
    const staleFailure = s.create();
    await new Promise(setImmediate);
    s.closeSearch();
    s.openSearch();
    s.form.input_ref = "失败不污染新草稿";
    resolveLateFailure(new ApiClientError("error"));
    await staleFailure;
    assert.equal(s.dialogFailure.value, null);
    assert.equal(s.form.input_ref, "失败不污染新草稿");
    checks.push(
      "dialog generation preserves reopened draft on late success and prevents late failure from attaching to a new dialog; sent request is not canceled",
    );
    const p = await setup("SourcingComparisonPanel", "specificationHint");
    assert.equal(
      p.specificationHint([{ specification: "Ａ  B" }, { specification: "a b" }]).status,
      "format_only",
    );
    assert.equal(
      p.specificationHint([{ specification: "1kg" }, { specification: "1000g" }]).status,
      "needs_review",
    );
    checks.push("actual comparison normalizes formatting only, not units/semantic equivalence");
    s = await sc();
    s.replies.push(ok({ version: 7 }), ok({ latest_run: null }), new ApiClientError("error"));
    await s.load();
    assert.equal(s.profit.value, null);
    assert.equal(s.opportunityVersion.value, 0);
    assert.match(s.message.value, /隔离失败/);
    checks.push(
      "SC cost read Promise.all fails atomically on reviewer error; no invented ready snapshot/reviewer count",
    );
    s = await sc();
    s.opportunityVersion.value = 7;
    Object.assign(s.costForm, {
      amount_value: 0,
      source_ref_id: "quote",
      evidence_id: "e1",
      reviewer_id: "other",
      observed_at: "2026-09-09T08:00",
    });
    s.replies.push(new ApiClientError("conflict"));
    await s.submitCost();
    assert.equal(s.calls[0].url, "/opportunities/opp/cost-inputs");
    assert.equal(s.calls[0].options.body.expected_version, 7);
    assert.equal(s.calls[0].options.body.amount_value, 0);
    assert.equal(s.calls[0].options.body.reviewer_id, "other");
    s.replies.push(new ApiClientError("conflict"));
    await s.reviewCost({
      reviewId: "review",
      decision: "rejected",
      reason: "依据不足",
      expectedVersion: 3,
    });
    assert.deepEqual(s.calls.at(-1).options.body, {
      decision: "rejected",
      reason: "依据不足",
      expected_version: 3,
    });
    s.replies.push(new ApiClientError("conflict"));
    await s.queueProfit();
    assert.deepEqual(s.calls.at(-1).options.body, { platform: "amazon", expected_version: 7 });
    checks.push(
      "cost submission uses opportunity version; review uses independent review version; recalculation queues platform/version only",
    );
    const reviewQueue = await setup(
      "OpportunityCostReviewQueue",
      "review,beginReview,submitReview",
      { busy: true },
    );
    const reviewItem = { id: "review-1", version: 3, can_review: true };
    for (const decision of ["approved", "rejected"]) {
      reviewQueue.review.reason = "旧原因";
      reviewQueue.beginReview(reviewItem, decision);
      assert.equal(reviewQueue.review.reason, "");
      assert.equal(reviewQueue.review.id, "review-1");
      reviewQueue.review.reason = " x ";
      const n = reviewQueue.events.length;
      reviewQueue.submitReview(reviewItem);
      assert.equal(reviewQueue.events.length, n);
      reviewQueue.review.reason = "  原始证据已核对  ";
      reviewQueue.submitReview(reviewItem);
      assert.deepEqual(reviewQueue.events.at(-1), {
        name: "reviewCost",
        payload: { reviewId: "review-1", decision, reason: "原始证据已核对", expectedVersion: 3 },
      });
    }
    checks.push(
      "actual review queue resets reason for each decision, trims/requires two characters, emits item version; busy is a template-only submit guard, not a beginReview/submitReview function guard",
    );
    const costOwner = await sc();
    const sourcingOwner = await sw();
    let settle;
    costOwner.replies.push(new Promise((resolve) => (settle = resolve)));
    const pendingCost = costOwner.queueProfit();
    assert.equal(costOwner.busy.value, true);
    assert.equal(sourcingOwner.busy.value, false);
    settle(new ApiClientError("conflict"));
    await pendingCost;
    assert.equal(costOwner.busy.value, false);
    checks.push(
      "cost and sourcing owners have independent busy refs; failed cost write releases only cost owner, not a production async ownership or successful reload proof",
    );
    return {
      checks,
      limits:
        "Actual setup functions with inert transport/router and checkbox class; synthetic busy/generation checks are not mounted DOM proof; no SQL, RBAC, worker, quote validity, read/KeepAlive scope ownership or timezone matrix proof.",
    };
  } finally {
    scopes.forEach((scope) => scope.stop());
  }
}
if (process.argv[1]?.endsWith("verify-ui-phase2-sourcing-source.mjs"))
  console.log(JSON.stringify(await verifySourcingSource()));
