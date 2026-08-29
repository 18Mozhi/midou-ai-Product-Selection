import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  assert.match(quality, /params\.get\("evidence_id"\)/);
  assert.match(quality, /params\.get\("issue_id"\)/);
  assert.match(route, /management\/data\/exports/);
  assert.match(repository, /platform\.data\.export/);
  assert.match(openapi, /platform\/management\/data\/exports/);
  assert.ok(
    JSON.parse(feature).implementation.platformDashboard.routes.includes("/platform-admin/data"),
  );
});
