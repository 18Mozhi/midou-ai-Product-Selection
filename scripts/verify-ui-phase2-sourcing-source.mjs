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
      withDefaults: (v) => v,
      onMounted: () => {},
      useRoute: () => route,
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
      replies,
      routes,
    };
  }
  const sw = (props) =>
    setup(
      "SourcingWorkspace",
      "load,detail,items,selected,state,notice,form,showSearch,openSearch,closeSearch,create,quote,quoteCandidate,openQuote,confirm,selectedQuotes,choose,compare,purchaseCandidate,purchaseForm,openPurchase,purchase,deleting,deleteReason,removeSearch,refreshSearch,stabilityText,canManage,canConfirmCost,handleStatePrimary,handleStateSecondary,resetQuery,query,filteredItems",
      props,
    );
  const sc = (props) =>
    setup(
      "SourcingCostConfirmationPanel",
      "load,profit,reviewers,opportunityVersion,costForm,message,submitCost,reviewCost,queueProfit",
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
    s.replies.push(ok([item]), new ApiClientError("error"));
    await s.load();
    assert.equal(s.state.value, "error");
    assert.equal(s.items.value.length, 1);
    checks.push(
      "UNFIXED SC-G02: comparison-history failure blocks otherwise loaded list; no optional degradation in actual setup",
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
    assert.equal(s.notice.value, "");
    checks.push(
      "delete only trimmed reason, no invented revision; refresh success notice erased by reload remains UNFIXED",
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
    return {
      checks,
      limits:
        "Actual setup functions with inert transport/router and checkbox class; no DOM mount, SQL, RBAC, worker, quote validity, asynchronous ownership or actual timezone matrix proof.",
    };
  } finally {
    scopes.forEach((scope) => scope.stop());
  }
}
if (process.argv[1]?.endsWith("verify-ui-phase2-sourcing-source.mjs"))
  console.log(JSON.stringify(await verifySourcingSource()));
