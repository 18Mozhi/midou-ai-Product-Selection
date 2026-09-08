import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const plain = (v) => JSON.parse(JSON.stringify(v));
export async function buildOpportunityDesignData(repo) {
  async function source(file) {
    const text = await readFile(path.join(repo, file), "utf8");
    return text.includes('<script setup lang="ts">')
      ? text.split('<script setup lang="ts">')[1].split("</script>")[0]
      : text;
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
  function run(code, bindings = {}) {
    const context = { exports: {}, reactive: (v) => v, URLSearchParams, ...bindings };
    vm.runInNewContext(
      ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      context,
    );
    return context.exports;
  }
  const main = await source("apps/web/src/components/OpportunityWorkspace.vue"),
    list = await source("apps/web/src/components/OpportunityListPanel.vue"),
    ui2 = await source("tests/e2e/ui-phase2-opportunity-contracts.spec.ts"),
    m04 = await source("tests/e2e/m04-02-opportunities.spec.ts");
  const vars = (text, names) => names.map((n) => `const ${n}=${extract(text, n)};`).join("\n");
  const manual = plain(
    run(
      `${vars(ui2, ["id", "opportunityId", "memberId", "topicId", "at"])}\n${extract(ui2, "detailFixture", true)}\nexport const value=detailFixture();`,
    ).value,
  );
  const recommended = plain(
    run(
      `${vars(m04, ["opportunityId", "topicId", "base", "recommendedBase"])}\nexport const value=recommendedBase;`,
    ).value,
  );
  const formsCode = await source("apps/web/src/components/opportunity-workspace-forms.ts");
  const forms = plain(
    run(
      `${extract(formsCode, "createOpportunityWorkspaceForms", true)}\nexport const value=createOpportunityWorkspaceForms();`,
    ).value,
  );
  const readinessCode = await source("apps/web/src/automatic-selection-readiness.ts");
  const readiness = run(
    `const scoreRuleRoute="/opportunities/scoring-rules";\n${extract(readinessCode, "resolveAutomaticSelectionReadiness", true)}`,
  );
  const emptySetup = plain(readiness.resolveAutomaticSelectionReadiness([], [], []));
  const views = plain(run(`export const value=${extract(list, "viewOptions")};`).value);
  const factNames = [
    "opportunityStatus",
    "sourceLabel",
    "scoreLabel",
    "selectionStage",
    "recommendationLabel",
    "qualityGateKeys",
    "qualityGateLabels",
    "passedGateCount",
    "nextMissingGate",
    "rowFacts",
  ];
  const rowFacts = (item, selectionView) =>
    plain(
      run(`${vars(list, factNames)}\nexport const value=rowFacts(item);`, {
        props: { selectionView },
        item,
      }).value,
    );
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const candidate = {
    ...manual,
    id: id(427),
    name: "隔离规则命中候选",
    source_type: "trend_topic",
    source_ref_id: id(425),
    evidence_count: 2,
    source_count: 2,
    matched_rule_count: 1,
    selection_stage: "rule_candidate",
    coverage_status: "partial",
  };
  const pending = {
    ...candidate,
    id: id(428),
    name: "隔离采集中候选",
    source_count: 1,
    evidence_count: 1,
    selection_stage: "not_eligible",
  };
  const rows = {
    recommended: [{ ...recommended, image_url: null }],
    rule_candidates: [candidate],
    evidence_pending: [pending],
    all: [manual, { ...manual, id: id(426), name: "第二个隔离候选", version: 7 }],
  };
  const facts = Object.fromEntries(
    views.map((v) => [v.value, rows[v.value].map((item) => rowFacts(item, v.value))]),
  );
  const edited = { name: "新候选草稿", market: "CA", category: "", source_topic_id: id(425) };
  let createIntent;
  await run(`${extract(main, "create", true)}\nexport const result=create();`, {
    form: edited,
    showCreate: { value: true },
    router: { push: async () => {} },
    write: async (p, b) => {
      createIntent = { method: "POST", path: p, body: plain(b) };
      return { id: manual.id };
    },
  }).result;
  const batchIntents = {};
  for (const action of ["assign", "review", "archive"]) {
    await run(`${extract(main, "confirmBatch", true)}\nexport const result=confirmBatch();`, {
      items: { value: rows.all },
      selectedOpportunityIds: { value: rows.all.map((v) => v.id) },
      batchAction: { value: action },
      batchReason: { value: "  已核对当前页范围  " },
      batchAssigneeId: { value: manual.owner_id },
      write: async (p, b) => {
        batchIntents[action] = { method: "POST", path: p, body: plain(b) };
        return null;
      },
    }).result;
  }
  let scoped;
  await run(`${extract(main, "confirmBatch", true)}\nexport const result=confirmBatch();`, {
    items: { value: [rows.all[1]] },
    selectedOpportunityIds: { value: rows.all.map((v) => v.id) },
    batchAction: { value: "review" },
    batchReason: { value: "跨页复现" },
    batchAssigneeId: { value: "" },
    write: async (p, b) => {
      scoped = plain(b);
      return null;
    },
  }).result;
  assert.equal(scoped.items.length, 1);
  const knownGaps = {
    batchScope: {
      selectedCount: 2,
      submittedCount: scoped.items.length,
      submittedId: scoped.items[0].id,
      sourceFixed: false,
    },
    filterCount:
      "Actual activeFilterCount uses mutable draft fields rather than URL; proposal labels drafts separately.",
    imageFailure:
      "Actual list has no image error handler; proposal shows unavailable state without inventing product art.",
  };
  const route = {
      query: { scope: "all", page: "2", q: "候选" },
      fullPath: "/opportunities?scope=all&page=2&q=候选",
    },
    filters = plain(forms.filters),
    selectionView = { value: "recommended" },
    page = { value: 1 };
  run(`${extract(main, "syncListRoute", true)}\nsyncListRoute();`, {
    route,
    filters,
    selectionView,
    page,
  });
  assert.equal(selectionView.value, "all");
  assert.equal(page.value, 2);
  const queries = {};
  for (const name of ["applyListFilters", "resetListFilters", "setSelectionView", "goListPage"]) {
    const copiedFilters = plain(filters);
    await run(
      `${extract(main, name, true)}\nexport const result=${name}(${name === "setSelectionView" ? '"rule_candidates"' : name === "goListPage" ? "1" : ""});`,
      {
        route,
        filters: copiedFilters,
        selectionView,
        pageCount: { value: 2 },
        selectedOpportunityIds: { value: [manual.id] },
        load: async () => {},
        router: {
          push: async (v) => {
            queries[name] = plain(v);
          },
        },
      },
    ).result;
  }
  assert.deepEqual(queries.applyListFilters, { query: { q: "候选", view: "all" } });
  const erpItems = [
    {
      spu: "UI2-LOCAL-ERP",
      product: { title: "隔离导入商品" },
      last_sync_time: "2026-08-08T00:00:00.000Z",
    },
  ];
  let erpFile;
  await run(`${extract(main, "importErpFile", true)}\nexport const result=importErpFile(event);`, {
    event: { target: { files: [{ text: async () => JSON.stringify({ list: erpItems }) }] } },
    persistErpProducts: async (v) => {
      erpFile = plain(v);
    },
    message: { value: "" },
  }).result;
  assert.equal(erpFile.source_url, "https://medou.medouai.com/#/ProductList");
  assert.deepEqual(erpFile.items, erpItems);
  delete erpFile.captured_at;
  return {
    version: "OPPORTUNITY-C-r1",
    provenance:
      "Historical UI2-OP and M04-02 fixtures; rule/pending variants, long names, page two and all UI outcomes are explicitly synthetic, not production facts. Recommended fixture is not evidence that the current evaluator supports skincare.",
    manual,
    rows,
    facts,
    views,
    form: forms.form,
    filters: forms.filters,
    edited,
    createIntent,
    batchIntents,
    queries,
    erpFile,
    emptySetup,
    members: [{ id: manual.owner_id, label: "隔离复核成员" }],
    knownGaps,
  };
}
