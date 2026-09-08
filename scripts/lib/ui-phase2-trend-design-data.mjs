import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const plain = (v) => JSON.parse(JSON.stringify(v));
function run(code, bindings = {}) {
  const context = { exports: {}, reactive: (v) => v, ...bindings };
  vm.runInNewContext(
    ts.transpileModule(code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    context,
  );
  return context.exports;
}
export async function buildTrendDesignData(repo) {
  async function read(file) {
    const source = await readFile(path.join(repo, file), "utf8");
    return {
      source,
      script: file.endsWith(".vue")
        ? source.split('<script setup lang="ts">')[1].split("</script>")[0]
        : source,
    };
  }
  function extract(text, name, fn = false) {
    const ast = ts.createSourceFile("source.ts", text, ts.ScriptTarget.Latest, true),
      matches = [];
    function visit(n) {
      if (!fn && ts.isVariableDeclaration(n) && n.name.getText(ast) === name)
        matches.push(n.initializer.getText(ast));
      if (fn && ts.isFunctionDeclaration(n) && n.name?.text === name) matches.push(n.getText(ast));
      ts.forEachChild(n, visit);
    }
    visit(ast);
    assert.equal(matches.length, 1, name);
    return matches[0];
  }
  const main = await read("apps/web/src/components/TrendDashboard.vue"),
    rule = await read("apps/web/src/components/TrendRuleDialog.vue"),
    queue = await read("apps/web/src/components/TrendChangeQueue.vue"),
    fixture = await read("tests/e2e/ui-phase2-trend-contracts.spec.ts");
  const fixtureCode = ["id", "topicId", "ruleId", "signalId", "issueId", "at"]
    .map((name) => `const ${name} = ${extract(fixture.script, name)};`)
    .join("\n");
  const base = plain(
    run(
      `${fixtureCode}\n${extract(fixture.script, "fixture", true)}\n${extract(fixture.script, "change", true)}\nexport const sample=fixture(); export const request=change(sample);`,
    ),
  );
  delete base.sample.writes;
  const secondary = {
    ...plain(base.sample.detail),
    id: "00000000-0000-4000-8000-000000000417",
    title: "同范围主题 · 隔离合并候选",
    version: 2,
  };
  const ruleForm = plain(run(`export const value=${extract(rule.script, "form")};`).value);
  const ruleEdited = {
    ...ruleForm,
    name: "隔离关键词监控",
    include_keywords: " ai skincare，beauty ",
    negative_keywords: " used, replacement ",
    collection_interval_minutes: 180,
    recommendation_min_source_count: 3,
  };
  let rulePayload;
  run(
    `${extract(rule.script, "submit", true)}\nconst keywords=${extract(rule.script, "keywords")}; submit();`,
    {
      form: ruleEdited,
      emit: (event, payload) => {
        rulePayload = plain(payload);
      },
    },
  );
  const options = {};
  for (const name of ["collection_interval_minutes", "recommendation_min_source_count"]) {
    const select = rule.source.match(
      new RegExp(`<select v-model.number="form\\.${name}">([\\s\\S]*?)</select>`),
    );
    assert.ok(select);
    options[name] = [...select[1].matchAll(/<option :value="([^"]+)">([^<]+)<\/option>/g)].map(
      (m) => ({ value: Number(m[1]), label: m[2] }),
    );
  }
  const backend = await read("apps/api/src/trend-service.ts");
  const { validateMonitoringRuleInput } = run(
    backend.script.slice(
      backend.script.indexOf("export class TrendServiceError"),
      backend.script.indexOf("export interface TrendRepository"),
    ),
  );
  const validRule = plain(validateMonitoringRuleInput(rulePayload));
  let duplicate;
  try {
    validateMonitoringRuleInput({ ...rulePayload, include_keywords: ["BEAUTY", "beauty"] });
  } catch (e) {
    duplicate = { code: e.code, statusCode: e.statusCode, actionHint: e.actionHint };
  }
  assert.equal(duplicate.code, "trend_rule_keywords_duplicate");
  const props = {
    selected: base.sample.detail,
    topics: [base.sample.detail, secondary],
    requests: [base.request],
  };
  const proposals = {};
  for (const mode of ["merge", "split"]) {
    run(`${extract(queue.script, "submitProposal", true)}\nsubmitProposal();`, {
      props,
      operation: { value: mode },
      sourceIds: { value: mode === "merge" ? [secondary.id] : [] },
      signalIds: { value: [base.sample.detail.evidence[0].id] },
      newTitle: { value: " 单独观察 " },
      newCategory: { value: "" },
      reason: { value: " 证据需要单独核对 " },
      emit: (event, payload) => {
        proposals[mode] = plain(payload);
      },
    });
  }
  const relevanceDialog = { value: "irrelevant" },
    relevanceReason = { value: "保留这次失败原因" };
  const relevance = run(
    `${extract(main.script, "markIrrelevant", true)}\nexport {markIrrelevant};`,
    {
      selected: { value: base.sample.detail },
      relevanceDialog,
      relevanceReason,
      requireTrendManage: () => true,
      write: async () => null,
      message: { value: "" },
      load: async () => {},
    },
  );
  await relevance.markIrrelevant();
  assert.equal(relevanceDialog.value, null);
  assert.equal(relevanceReason.value, "");
  const filterRefs = {
    filters: { q: "", market: "", category: "", status: "" },
    sort: { value: "impact" },
    page: { value: 1 },
    tab: { value: "topics" },
    canManageTrends: { value: true },
    route: { query: {}, fullPath: "/trends" },
  };
  let pushed;
  const filterFns = run(
    `${extract(main.script, "applyFilters", true)}\n${extract(main.script, "syncFromRoute", true)}\nexport {applyFilters,syncFromRoute};`,
    {
      ...filterRefs,
      router: {
        push: async (value) => {
          pushed = value;
        },
        replace: async () => {},
      },
      load: async () => {},
    },
  );
  await filterFns.applyFilters();
  filterRefs.route.query = plain(pushed.query);
  filterFns.syncFromRoute();
  assert.equal(filterRefs.filters.status, "active");
  const opportunityRoute = run(`export const value=${extract(main.script, "opportunityRoute")};`, {
    selected: { value: base.sample.detail },
    computed: (fn) => fn(),
  }).value;
  const sorted = {};
  for (const name of ["impact", "latest", "momentum", "followed"])
    sorted[name] = plain(
      run(`export const value=${extract(main.script, "sortedTopics")};`, {
        topics: { value: [secondary, base.sample.detail] },
        sort: { value: name },
        computed: (fn) => fn(),
      }).value,
    ).map((v) => v.id);
  const readinessSource = await read("apps/web/src/components/shared/monitoring-readiness.ts");
  const { buildTrendMonitoringReadiness } = run(readinessSource.script);
  return {
    ...base.sample,
    request: base.request,
    secondary,
    ruleForm,
    ruleEdited,
    rulePayload,
    validRule,
    options,
    duplicate,
    proposals,
    opportunityRoute,
    sorted,
    readiness: plain(
      buildTrendMonitoringReadiness({
        loading: false,
        enabledRules: 1,
        evaluatedRules: 0,
        totalTopics: 2,
        failedSources: 0,
      }),
    ),
    knownGaps: {
      allStatusRoundTrip: filterRefs.filters.status,
      relevanceFailure: { dialog: relevanceDialog.value, reason: relevanceReason.value },
      status: "known-gap-not-fixed",
    },
  };
}
