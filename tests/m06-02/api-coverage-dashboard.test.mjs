import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  apiCoverageFingerprint,
  buildApiCoverageDashboard,
  parseOpenApiCoverage,
  readApiCoverageDashboard,
} from "../../apps/api/dist/api-coverage-dashboard.js";

const read = (path) => readFile(path, "utf8");

test("API coverage joins the complete current catalog only to a matching schema-2 report", async () => {
  const [openapiSource, routeCatalogSource, metadataSource] = await Promise.all([
    read("docs/openapi.yaml"),
    read("config/route-catalog.json"),
    read("config/api-coverage-metadata.json"),
  ]);
  const parsed = parseOpenApiCoverage(openapiSource);
  assert.equal(parsed.paths.length, 222);
  assert.equal(parsed.operations.length, 255);
  const sample = parsed.operations.slice(0, 4).map((operation, index) => ({
    method: operation.method,
    path_template: operation.path,
    role: index === 3 ? "member" : "platform_operations_admin",
    status: [200, 200, 403, 422][index],
    outcome: ["success", "empty", "unauthorized", "blocked"][index],
    request_id: `request-${index}`,
    trace_id: `trace-${index}`,
  }));
  const report = {
    schema_version: 2,
    path_count: 222,
    operation_count: 255,
    catalog_fingerprint: apiCoverageFingerprint(openapiSource),
    captured_at: "2026-08-23T12:00:00.000Z",
    operations: sample,
  };
  const result = buildApiCoverageDashboard({
    openapiSource,
    routeCatalog: JSON.parse(routeCatalogSource),
    metadata: JSON.parse(metadataSource),
    report,
    now: new Date("2026-08-23T12:01:00.000Z"),
  });
  assert.equal(result.report_status, "current");
  assert.equal(result.summary.verified, 4);
  assert.equal(result.by_role.length, 6);
  assert.equal(result.by_outcome.find((item) => item.key === "unauthorized").count, 1);
  assert.ok(result.by_data_source.some((item) => item.key === "runtime_health"));
  assert.ok(result.by_ui_consumer.some((item) => item.key === "/platform-admin/status"));
  assert.ok(result.by_crawler_side_effect.some((item) => item.key === "crawler_dispatch"));
  assert.equal(result.age_seconds, 60);
  const outdated = buildApiCoverageDashboard({
    openapiSource,
    routeCatalog: JSON.parse(routeCatalogSource),
    metadata: JSON.parse(metadataSource),
    report: { ...report, catalog_fingerprint: "0".repeat(64) },
  });
  assert.equal(outdated.report_status, "outdated");
  assert.equal(outdated.summary.verified, 0);
  assert.ok(outdated.operations.every((operation) => operation.outcome === "not_run"));
});

test("API coverage fails closed when the production report is invalid JSON", async () => {
  const directory = await mkdtemp(join(tmpdir(), "scoutops-api-coverage-"));
  const reportFile = join(directory, "invalid-report.json");
  try {
    await writeFile(reportFile, '{"schema_version":2,"operations":', "utf8");
    const result = await readApiCoverageDashboard({
      openapiFile: "docs/openapi.yaml",
      routeCatalogFile: "config/route-catalog.json",
      metadataFile: "config/api-coverage-metadata.json",
      reportFile,
    });
    assert.equal(result.report_status, "invalid");
    assert.equal(result.summary.verified, 0);
    assert.ok(result.operations.every((operation) => operation.outcome === "not_run"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("API coverage UI, route, runtime packaging and production report fingerprint stay synchronized", async () => {
  const [component, center, routeCatalog, verifier, deployer, config, schema, openapi, feature] =
    await Promise.all(
      [
        "apps/web/src/components/ApiCoverageDashboard.vue",
        "apps/web/src/components/PlatformManagementCenter.vue",
        "config/route-catalog.json",
        "scripts/verify-production-api-coverage.mjs",
        "scripts/deploy-baota.py",
        "packages/config/src/index.ts",
        "config/schema.json",
        "docs/openapi.yaml",
        "docs/feature-map.json",
      ].map(read),
    );
  for (const copy of ["六角色覆盖", "结果覆盖", "数据来源", "UI 消费方", "爬虫副作用"])
    assert.match(component, new RegExp(copy));
  assert.match(center, /domain === ["']api-coverage["']/);
  const route = JSON.parse(routeCatalog).routes.find(
    (item) => item.path === "/platform-admin/api-coverage",
  );
  assert.equal(route.acceptance, "protected");
  assert.deepEqual(route.capabilities, ["platform:operate", "platform:superadmin"]);
  assert.match(verifier, /schema_version:\s*2[\s\S]*catalog_fingerprint/);
  assert.match(deployer, /config\/api-coverage-metadata\.json/);
  assert.match(config, /SCOUTOPS_ACCEPTANCE_API_REPORT_FILE/);
  assert.ok(
    JSON.parse(schema).backendGroups.platformDashboard.includes(
      "SCOUTOPS_ACCEPTANCE_API_REPORT_FILE",
    ),
  );
  assert.match(openapi, /api_coverage[\s\S]*ApiCoverageDashboardEnvelope/);
  assert.match(feature, /platform-api-coverage/);
});
