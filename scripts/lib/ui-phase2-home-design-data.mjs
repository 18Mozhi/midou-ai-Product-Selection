import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const plain = (value) => JSON.parse(JSON.stringify(value));
export async function buildHomeDesignData(repo) {
  const source = await readFile(
    path.join(repo, "apps/web/src/components/HomeDashboard.vue"),
    "utf8",
  );
  const script = source.split('<script setup lang="ts">')[1].split("</script>")[0];
  const ast = ts.createSourceFile("home.ts", script, ts.ScriptTarget.Latest, true);
  function extract(name, declaration = false) {
    const found = [];
    function visit(node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && !declaration)
        found.push(node.initializer.getText(ast));
      if (ts.isFunctionDeclaration(node) && node.name?.text === name && declaration)
        found.push(node.getText(ast));
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.equal(found.length, 1, name);
    return found[0];
  }
  function run(code, bindings = {}) {
    const sandbox = { exports: {}, reactive: (v) => v, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      sandbox,
    );
    return sandbox.exports;
  }
  const form = plain(run(`export const value = ${extract("setupForm")};`).value);
  const options = {};
  for (const name of ["market", "collection_interval_minutes", "recommendation_min_source_count"]) {
    const select = source.match(
      new RegExp(`<select v-model(?:\\.number)?="setupForm\\.${name}">([\\s\\S]*?)</select>`),
    );
    assert.ok(select, name);
    options[name] = [...select[1].matchAll(/<option :?value="([^"]+)">([^<]+)<\/option>/g)].map(
      (m) => ({ value: name === "market" ? m[1] : Number(m[1]), label: m[2] }),
    );
  }
  assert.deepEqual(
    Object.values(options).map((v) => v.length),
    [10, 5, 3],
  );
  const sourceFunctions = `const keywordList = ${extract("keywordList")};\n${extract("createRule", true)}\n${extract("resumeRule", true)}\nexport { createRule, resumeRule };`;
  async function intentFor(values, item, canManage = true) {
    const calls = [],
      state = {
        setupOpen: { value: true },
        setupBusy: { value: false },
        setupMessage: { value: "" },
      };
    const fns = run(sourceFunctions, {
      ...state,
      setupForm: values,
      canManageRules: { value: canManage },
      ApiClientError: class extends Error {},
      request: async (route, options) => {
        calls.push({ path: route, ...plain(options) });
      },
      load: async () => {},
    });
    if (item) await fns.resumeRule(item);
    else await fns.createRule();
    return { calls, message: state.setupMessage.value, setupOpen: state.setupOpen.value };
  }
  const edited = {
    ...form,
    include_keywords: " coffee brush，portable washer,coffee brush ",
    negative_keywords: " used, replacement ",
    category: " Home & Kitchen ",
    collection_interval_minutes: 360,
    recommendation_min_source_count: 2,
  };
  const paused = [1, 2].map((n) => ({
    id: `00000000-0000-4000-8000-00000000094${n}`,
    name: `隔离暂停规则 ${n}`,
    include_keywords: ["coffee brush"],
    negative_keywords: [],
    market: "US",
    language: "en-US",
    category: null,
    collection_interval_minutes: n === 1 ? 720 : 60,
    recommendation_min_source_count: n === 1 ? 3 : 1,
    status: "paused",
    version: n === 1 ? 4 : 8,
  }));
  const createCases = [];
  for (const option of options.market) {
    const values = { ...edited, market: option.value };
    createCases.push({ form: values, result: await intentFor(values) });
  }
  assert.deepEqual(createCases[0].result.calls[0].body.include_keywords, [
    "coffee brush",
    "portable washer",
    "coffee brush",
  ]);
  const noManage = await intentFor(edited, null, false),
    noKeywords = await intentFor({ ...form, include_keywords: " ，, " });
  assert.equal(noManage.calls.length + noKeywords.calls.length, 0);
  const resume = await intentFor(form, paused[0]);
  assert.equal(resume.calls[0].body.expected_version, 4);
  // Execute the current load function, without network, to retain evidence of the two source gaps.
  const missing = {
    actions: [],
    changes: [],
    follows: [],
    health: [],
    scope: { organization_id: "sample-org", workspace_id: "sample-workspace" },
    generated_at: "2026-09-07T00:00:00.000Z",
  };
  const zero = {
    state: "not_configured",
    enabled_rule_count: 0,
    candidate_count: 0,
    rule_candidate_count: 0,
    recommended_count: 0,
    awaiting_evidence_count: 0,
    adopted_count: 0,
    recommended_items: [],
    last_collection_at: null,
    next_collection_at: null,
  };
  const gaps = [];
  for (const hasSelection of [true, false]) {
    const refs = Object.fromEntries(
      ["state", "requestId", "traceId", "actionHint", "data", "rules", "setupOpen"].map((k) => [
        k,
        { value: k === "setupOpen" ? false : null },
      ]),
    );
    const summary = { ...missing, ...(hasSelection ? { automatic_selection: zero } : {}) };
    const fns = run(
      `const failure = ${extract("failure")};\n${extract("load", true)}\nexport { load };`,
      {
        ...refs,
        canManageRules: { value: true },
        ApiClientError: class extends Error {},
        request: async (url) => {
          if (url.includes("monitoring-rules")) throw new Error("isolated rule read failure");
          return { data: summary, request_id: "home-c-source", trace_id: "home-c-source" };
        },
      },
    );
    await fns.load();
    const selection = run(`export const value = ${extract("selection")};`, {
      data: refs.data,
      computed: (fn) => ({ value: fn() }),
    }).value;
    gaps.push({
      hasSelection,
      state: refs.state.value,
      rules: plain(refs.rules.value),
      setupOpen: refs.setupOpen.value,
      displayedSelection: plain(selection.value),
      status: "known-gap-not-fixed",
    });
  }
  assert.equal(gaps[0].setupOpen, true);
  assert.equal(gaps[1].displayedSelection.enabled_rule_count, 0);
  // Deliberately synthetic contract-shaped rows; the actual service orders/groups them.
  const at = missing.generated_at;
  const row = (n, title, module, priority, route, extra = {}) => ({
    id: `00000000-0000-4000-8000-00000000095${n}`,
    kind: "action",
    title,
    reason: "隔离样例：按当前工作项事实进入详情复核。",
    route,
    source_module: module,
    source_label: "隔离工作项",
    context_label: "去处理",
    priority,
    risk_level: "normal",
    value_score: null,
    blocked: false,
    owner_label: null,
    due_at: null,
    source_count: null,
    observed_at: at,
    severity: "info",
    source_version: 1,
    ...extra,
  });
  const rows = [
    row(
      1,
      "隔离样例 · 便携清洁工具",
      "opportunity",
      "high_value",
      "/opportunities/00000000-0000-4000-8000-000000000951",
      { value_score: 86.5 },
    ),
    row(
      2,
      "隔离样例 · 补齐来源核验",
      "task",
      "overdue",
      "/tasks/00000000-0000-4000-8000-000000000952",
      { severity: "warning", due_at: at },
    ),
    row(
      3,
      "隔离样例 · 当前节点待审批",
      "approval",
      "blocking",
      "/tasks/approvals?approval=00000000-0000-4000-8000-000000000953",
      { blocked: true },
    ),
    row(
      4,
      "隔离样例 · 本人采集任务受阻",
      "projection",
      "blocking",
      "/tasks/00000000-0000-4000-8000-000000000954",
      { kind: "health", severity: "critical", blocked: true },
    ),
    row(
      5,
      "隔离样例 · 来源变化",
      "projection",
      null,
      "/trends?topic=00000000-0000-4000-8000-000000000955",
      { kind: "change" },
    ),
    row(
      6,
      "隔离样例 · 我的关注",
      "projection",
      null,
      "/trends?topic=00000000-0000-4000-8000-000000000956",
      { kind: "follow" },
    ),
  ];
  const serviceText = await readFile(
    path.join(repo, "apps/api/src/home-dashboard-service.ts"),
    "utf8",
  );
  const { HomeDashboardService } = run(serviceText);
  const summary = plain(
    await new HomeDashboardService(
      {
        list: async () => rows,
        automaticSelection: async () => ({
          ...zero,
          state: "running",
          enabled_rule_count: 3,
          candidate_count: 17,
          rule_candidate_count: 5,
          recommended_count: 4,
          awaiting_evidence_count: 8,
          adopted_count: 2,
          last_collection_at: at,
          next_collection_at: "2026-09-07T01:00:00.000Z",
        }),
      },
      () => new Date(at),
    ).get({
      organizationId: "sample-org",
      workspaceId: "sample-workspace",
      actorId: "sample-actor",
      capabilities: ["task:read", "trend:read", "trend:manage", "opportunity:read"],
    }),
  );
  return {
    form,
    options,
    edited,
    paused,
    createCases,
    resume,
    noKeywords,
    noManage,
    gaps,
    summary,
    zero,
    priorities: {
      overdue: "逾期",
      blocking: "阻断",
      high_risk: "高风险",
      high_value: "高价值",
      normal: "普通",
    },
  };
}
