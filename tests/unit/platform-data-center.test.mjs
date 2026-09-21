import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import {
  PlatformDashboardError,
  PlatformDashboardService,
} from "../../apps/api/dist/platform-dashboard-service.js";

test("platform data service validates entity filters and audited export reasons", async () => {
  const reads = [];
  const exports = [];
  const service = new PlatformDashboardService({
    readManagement: async (input) => (reads.push(input), { items: [] }),
    exportData: async (input) => (exports.push(input), { entity: input.entity, items: [] }),
  });
  await service.management({
    actorId: "actor",
    domain: "data",
    entity: "competitors",
    query: "lamp",
    status: "active",
    requestId: "request",
    traceId: "trace",
  });
  assert.equal(reads[0].entity, "competitors");
  assert.throws(
    () =>
      service.management({
        actorId: "actor",
        domain: "data",
        entity: "competitors",
        status: "watching",
        requestId: "request",
        traceId: "trace",
      }),
    (error) =>
      error instanceof PlatformDashboardError && error.code === "platform_data_status_invalid",
  );
  await service.exportData(
    { entity: "suppliers", reason: "运营核对" },
    { actorId: "actor", requestId: "request", traceId: "trace" },
  );
  assert.equal(exports[0].entity, "suppliers");
  assert.throws(
    () =>
      service.exportData(
        { entity: "unknown", reason: "运营核对" },
        { actorId: "actor", requestId: "request", traceId: "trace" },
      ),
    (error) =>
      error instanceof PlatformDashboardError && error.code === "platform_data_entity_invalid",
  );
});

test("platform data center exposes factual statuses bounded pagination deep links and audited CSV export", async () => {
  const [web, quality, route, repository, openapi, feature] = await Promise.all(
    [
      "apps/web/src/components/PlatformDataCenter.vue",
      "apps/web/src/components/DataQualityCenter.vue",
      "apps/api/src/platform-dashboard-routes.ts",
      "apps/api/src/mysql-platform-dashboard-repository.ts",
      "docs/openapi.yaml",
      "docs/feature-map.json",
    ].map((path) => readFile(path, "utf8")),
  );
  for (const label of ["热点", "机会", "竞品", "供应商", "证据与质量", "导出表格文件"])
    assert.match(web, new RegExp(label));
  for (const status of [
    "archived",
    "pending",
    "adopted",
    "observing",
    "paused",
    "incomplete",
    "ready",
    "quarantined",
  ])
    assert.match(web, new RegExp(status));
  assert.match(web, /pageSize\s*=\s*20/);
  assert.match(web, /上一页[\s\S]*下一页/);
  assert.match(web, /读取超过 15 秒[\s\S]*上一份结果仍保留/);
  assert.match(web, /queryValue\("evidence_id"\)[\s\S]*queryValue\("issue_id"\)/);
  assert.match(quality, /queryValue\("evidence_id"\)/);
  assert.match(quality, /queryValue\("issue_id"\)/);
  assert.match(
    quality,
    /onMounted\(async \(\) => \{[\s\S]*?await load\(\{ updateUrl: false \}\);\s*await openInitialDeepLink\(\)/,
  );
  assert.match(route, /management\/data\/exports/);
  assert.match(repository, /platform\.data\.export/);
  assert.match(openapi, /platform\/management\/data\/exports/);
  assert.ok(
    JSON.parse(feature).implementation.platformDashboard.routes.includes("/platform-admin/data"),
  );
});

async function qualityDeepLinkHarness(routeQuery, existingIssues = []) {
  const source = await readFile("apps/web/src/components/DataQualityCenter.vue", "utf8");
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "actual data quality script must exist");
  const ast = ts.createSourceFile("quality.ts", script, ts.ScriptTarget.Latest, true);
  const nodes = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "queryValue")
      nodes.set("queryValue", node.initializer);
    if (ts.isFunctionDeclaration(node) && node.name?.text === "openInitialDeepLink")
      nodes.set("openInitialDeepLink", node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(nodes.size, 2, "test must execute both actual production functions");
  const code = ts.transpileModule(
    `const queryValue = ${nodes.get("queryValue").getText(ast)};\n${nodes.get("openInitialDeepLink").getText(ast)}`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const state = {
    opened: [],
    tab: { value: "evidence" },
    query: { value: "" },
    readNotice: { value: "" },
  };
  const open = new Function(
    "route",
    "openEvidence",
    "tab",
    "query",
    "readNotice",
    "filteredIssues",
    `${code}\nreturn openInitialDeepLink;`,
  )(
    { query: routeQuery },
    async (id) => state.opened.push(id),
    state.tab,
    state.query,
    state.readNotice,
    { value: existingIssues },
  );
  await open();
  return state;
}

test("data quality initial evidence links retain both existing keys and their precedence", async () => {
  const evidence = "10000000-0000-4000-8000-000000000001";
  const alternate = "10000000-0000-4000-8000-000000000002";
  for (const [query, expected] of [
    [{ evidence }, evidence],
    [{ evidence_id: alternate }, alternate],
    [{ evidence, evidence_id: alternate }, evidence],
    [{ evidence: "", evidence_id: alternate }, alternate],
  ]) {
    const state = await qualityDeepLinkHarness(query);
    assert.deepEqual(state.opened, [expected]);
    assert.equal(state.tab.value, "evidence");
  }
});

test("data quality issue links distinguish a loaded issue from a later page without inventing a write", async () => {
  const issue = "20000000-0000-4000-8000-000000000001";
  for (const present of [true, false]) {
    const state = await qualityDeepLinkHarness({ issue_id: issue }, present ? [{ id: issue }] : []);
    assert.equal(state.tab.value, "issues");
    assert.equal(state.query.value, issue);
    assert.equal(
      state.readNotice.value,
      present
        ? "已定位从业务页面进入的数据质量问题。"
        : "当前加载页未包含该质量问题，请继续分页定位。",
    );
    assert.deepEqual(state.opened, []);
  }
});

test("data quality initial links ignore absent malformed and non-string route values", async () => {
  const id = "10000000-0000-4000-8000-000000000001";
  for (const value of [undefined, null, "", "bad-id", [id], 123]) {
    const state = await qualityDeepLinkHarness({
      evidence: value,
      evidence_id: value,
      issue_id: value,
    });
    assert.deepEqual(state.opened, []);
    assert.equal(state.tab.value, "evidence");
    assert.equal(state.query.value, "");
    assert.equal(state.readNotice.value, "");
  }
});
