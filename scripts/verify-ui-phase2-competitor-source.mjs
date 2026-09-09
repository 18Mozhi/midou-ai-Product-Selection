import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { ref, reactive, computed, watch, nextTick, effectScope } from "vue";

// Execute the real setup script, with inert transport/router/timers. Not a Vue mount or DB test.
export async function verifyCompetitorSource() {
  const checks = [],
    scopes = [];
  const source = await readFile("apps/web/src/components/CompetitorMonitor.vue", "utf8");
  let script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
  const ast = ts.createSourceFile("setup.ts", script, ts.ScriptTarget.Latest, true);
  for (const node of [...ast.statements].reverse())
    if (ts.isImportDeclaration(node)) script = script.slice(0, node.pos) + script.slice(node.end);
  class ApiClientError extends Error {
    constructor(kind) {
      super("synthetic failure");
      Object.assign(this, { kind, requestId: "synthetic-request", actionHint: "保留输入，请重试" });
    }
  }
  function setup(mode = "list", capabilities = ["competitor:manage", "task:create"], query = {}) {
    const scope = effectScope();
    scopes.push(scope);
    const calls = [],
      replies = [],
      routes = [],
      timers = new Map(),
      unmounts = [];
    const route = { query, fullPath: "/competitors" };
    const env = {
      ref,
      reactive,
      computed,
      watch,
      nextTick,
      ApiClientError,
      defineProps: () => ({ mode, capabilities, apiBaseUrl: "inert" }),
      withDefaults: (p) => p,
      useRoute: () => route,
      useRouter: () => ({
        push: (v) => routes.push(v),
        replace: (v) => {
          routes.push(v);
          route.query = v.query;
        },
        back: () => routes.push("back"),
      }),
      onMounted: () => {},
      onUnmounted: (v) => unmounts.push(v),
      window: { addEventListener() {}, removeEventListener() {} },
      buildCompetitionMonitoringReadiness: () => ({}),
      setTimeout: (fn, ms) => {
        const id = {};
        timers.set(id, { fn, ms });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      createApiClient: () => async (url, options) => {
        calls.push({ url, options });
        assert.ok(replies.length, "unexpected request: " + url);
        const v = await replies.shift();
        if (v instanceof Error) throw v;
        return v;
      },
    };
    const expose =
      "items,rules,selected,query,filteredItems,baseline,activityTimeline,applicableRules,enabledRules,ruleText,changeText,form,rule,state,notice,showCreate,createStep,showRule,deleting,deleteReason,validationTasks,openCreate,closeCreate,submitCreateStep,openRule,closeRule,createRule,openDelete,remove,toggle,collect,createValidationTask,load,detail,collectionPending";
    const js = ts.transpileModule(script + `\nreturn {${expose}};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    return {
      ...scope.run(() => new Function(...Object.keys(env), js)(...Object.values(env))),
      calls,
      replies,
      routes,
      timers,
      unmounts,
    };
  }
  const response = (data) => ({ data, request_id: "synthetic-response" });
  const snapshot = {
    id: "s1",
    current_price: 28,
    currency: "USD",
    captured_at: "2026-09-09T00:00:00Z",
    evidence_id: "e1",
  };
  const change = {
    id: "c1",
    field: "current_price",
    previous: "30",
    current: "28",
    evidence_id: "e1",
    changed_at: "2026-09-09T00:00:00Z",
    impact_explanation: "价格变化",
  };
  const item = {
    id: "i1",
    title: "隔离竞品",
    external_id: "B000000001",
    source_site: "amazon.com",
    status: "active",
    revision: 7,
    latest_snapshot: snapshot,
    snapshots: [snapshot, { ...snapshot, id: "old" }],
    changes: [change],
    alerts: [
      { id: "a1", change_id: "c1" },
      { id: "a2", change_id: "different" },
    ],
  };
  try {
    let s = setup();
    s.items.value = [item];
    s.selected.value = item;
    assert.equal(s.activityTimeline.value[0].alerts.length, 1);
    assert.equal(s.changeText(change), "USD 30 → 28");
    assert.equal(s.changeText({ ...change, evidence_id: "missing" }), "币种未采到 30 → 28");
    assert.equal(s.baseline.value.id, "old");
    checks.push(
      "changes join alerts by change_id and currency by evidence_id; baseline is last returned snapshot, not full history",
    );
    s.rules.value = [
      {
        competitor_id: null,
        metric: "price",
        direction: "decrease",
        threshold_value: 1,
        status: "disabled",
      },
    ];
    assert.equal(s.enabledRules.value.length, 0);
    assert.equal(s.applicableRules.value.length, 1);
    assert.match(s.ruleText(s.rules.value[0]), /USD/);
    checks.push(
      "UNFIXED: disabled applicable rule included; global price rule borrows selected currency",
    );
    s = setup();
    s.replies.push(response([item]), new ApiClientError("error"), response(item));
    await s.load();
    assert.equal(s.state.value, "ready");
    assert.equal(s.rules.value.length, 0);
    assert.equal(s.notice.value, "");
    s = setup("rules");
    s.replies.push(response([item]), new ApiClientError("error"));
    await s.load();
    assert.equal(s.state.value, "error");
    checks.push(
      "UNFIXED: optional list rules failure silently becomes []; rules route instead shows error",
    );
    s = setup();
    Object.assign(s.form, {
      product_url: "https://www.amazon.com/dp/B000000001",
      market: "US",
      title: "隔离竞品",
    });
    s.openCreate();
    await s.submitCreateStep();
    await s.submitCreateStep();
    assert.equal(s.calls.length, 0);
    s.replies.push(new ApiClientError("conflict"));
    await s.submitCreateStep();
    assert.deepEqual(s.calls[0], {
      url: "/competitors",
      options: {
        method: "POST",
        body: { market: "US", product_url: s.form.product_url, title: "隔离竞品" },
      },
    });
    assert.equal(s.createStep.value, 3);
    assert.equal(s.showCreate.value, true);
    s.closeCreate();
    s.openCreate();
    assert.equal(s.createStep.value, 1);
    assert.equal(s.form.title, "隔离竞品");
    checks.push(
      "create first two steps zero request; exact optional omission; conflict retains step3; close/reopen retains fields",
    );
    s = setup("rules");
    await s.openRule(item);
    s.rule.metric = "availability";
    await nextTick();
    assert.equal(s.rule.direction, "change");
    s.rule.direction = "became_unavailable";
    s.replies.push(new ApiClientError("conflict"));
    await s.createRule();
    assert.deepEqual(s.calls[0].options.body, {
      competitor_id: "i1",
      metric: "availability",
      direction: "became_unavailable",
    });
    assert.equal(s.showRule.value, true);
    s.closeRule();
    await s.openRule();
    assert.deepEqual(
      { ...s.rule },
      { competitor_id: "", metric: "price", direction: "decrease", threshold_value: 1 },
    );
    s.rule.threshold_value = 0;
    s.replies.push(new ApiClientError("conflict"));
    await s.createRule();
    assert.deepEqual(s.calls.at(-1).options.body, {
      competitor_id: null,
      metric: "price",
      direction: "decrease",
      threshold_value: 0,
    });
    checks.push(
      "rule availability omits threshold; global numeric target null with zero preserved; new open resets defaults; conflicts retain input",
    );
    s = setup();
    s.selected.value = item;
    s.openDelete();
    s.deleteReason.value = "   ";
    await s.remove();
    assert.equal(s.calls.length, 0);
    s.deleteReason.value = "  重复监控  ";
    s.replies.push(new ApiClientError("conflict"));
    await s.remove();
    assert.deepEqual(s.calls[0].options, {
      method: "DELETE",
      body: { expected_revision: 7, reason: "重复监控" },
    });
    assert.equal(s.deleteReason.value, "  重复监控  ");
    s.openDelete();
    assert.equal(s.deleteReason.value, "");
    s.replies.push(new ApiClientError("conflict"));
    await s.toggle();
    assert.deepEqual(s.calls.at(-1).options.body, { status: "paused", expected_revision: 7 });
    checks.push(
      "delete trims required reason and uses revision7, failed input retained, reopen clears; toggle uses exact status/revision",
    );
    s = setup("list", ["task:create"]);
    s.selected.value = item;
    s.openCreate();
    s.openDelete();
    await s.collect();
    await s.toggle();
    assert.equal(s.calls.length, 0);
    s.replies.push(response({ id: "t1", title: "复核" }));
    await s.createValidationTask(change);
    const body = s.calls[0].options.body;
    assert.deepEqual(Object.keys(body).sort(), ["description", "due_at", "priority", "title"]);
    assert.equal(body.priority, "high");
    assert.equal(body.due_at, null);
    assert.match(body.description, /证据：e1/);
    assert.equal(s.validationTasks.value.c1, "t1");
    checks.push(
      "task:create independent from competitor:manage; task intent binds evidence/change, no competitor mutation",
    );
    s = setup();
    s.selected.value = item;
    s.items.value = [item];
    s.replies.push(response({ task_id: "new", status: "queued" }));
    await s.collect();
    assert.deepEqual(s.calls[0].options.body, {});
    assert.equal(s.collectionPending.value, true);
    assert.equal([...s.timers.values()][0].ms, 2000);
    s.replies.push(
      response({ ...item, latest_collection: { task_id: "old", status: "succeeded" } }),
    );
    await s.detail(s.selected.value, false);
    assert.equal(s.selected.value.latest_collection.task_id, "new");
    for (const fn of s.unmounts) fn();
    assert.equal(s.timers.size, 0);
    checks.push(
      "collect acceptance is queued not snapshot success; current-row polling keeps new task over stale response; unmount clears inert timer",
    );
    s = setup("list", [], { q: "no-match", competitor: "i1" });
    s.items.value = [item];
    s.selected.value = item;
    assert.equal(s.filteredItems.value[0].id, "i1");
    s.query.value = "absent";
    await nextTick();
    assert.equal(s.filteredItems.value.length, 0);
    assert.equal(s.routes.at(-1).query.competitor, undefined);
    checks.push(
      "deep-linked selected item remains visible despite search; new search clears competitor/create query",
    );
    return {
      checks,
      limits:
        "Real setup functions only; readiness helper inert, no template mount, HTTP, authorization, SQL, worker, notification, history lifecycle or race closure.",
    };
  } finally {
    for (const scope of scopes) scope.stop();
  }
}
if (process.argv[1]?.endsWith("verify-ui-phase2-competitor-source.mjs"))
  console.log(JSON.stringify(await verifyCompetitorSource()));
