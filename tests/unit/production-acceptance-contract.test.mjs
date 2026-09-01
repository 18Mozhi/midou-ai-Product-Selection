import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("production acceptance locks the 223 path, 256 operation, 60 route and six role baseline", async () => {
  const [manifest, routeCatalog, openapi] = await Promise.all([
    read("infra/baota/production-acceptance-manifest.json").then(JSON.parse),
    read("config/route-catalog.json").then(JSON.parse),
    read("docs/openapi.yaml"),
  ]);
  const paths = openapi.split(/\r?\n/).filter((line) => /^  \/[^:]+:$/.test(line));
  const operations = openapi
    .split(/\r?\n/)
    .filter((line) => /^    (get|post|put|patch|delete):$/.test(line));
  assert.equal(paths.length, manifest.baseline.pathCount);
  assert.equal(operations.length, manifest.baseline.operationCount);
  assert.equal(
    routeCatalog.routes.filter((route) => route.acceptance === "protected").length,
    manifest.baseline.protectedRouteCount,
  );
  assert.equal(routeCatalog.productionAcceptance.roles.length, manifest.baseline.roleCount);
  assert.equal(manifest.baseline.realCoreScreenshotCount, 2);
  assert.equal(manifest.task.schedule, "manual");
  assert.equal(manifest.task.daemon, false);
  assert.equal(manifest.cleanup.verifyZeroReferences, true);
});

test("production acceptance only probes writes through safe blocking and always cleans exact markers", async () => {
  const [runner, apiCoverage, routeCoverage, coreE2e, deployer] = await Promise.all([
    read("scripts/run-baota-production-acceptance.mjs"),
    read("scripts/verify-production-api-coverage.mjs"),
    read("scripts/verify-production-product.mjs"),
    read("scripts/verify-production-core-e2e.mjs"),
    read("scripts/deploy-baota.py"),
  ]);
  assert.match(apiCoverage, /validation_or_authorization_block_only|isWrite/);
  assert.match(apiCoverage, /openapi_operation_route_not_found/);
  assert.doesNotMatch(apiCoverage, /route\.fulfill|page\.route/);
  assert.match(runner, /finally[\s\S]*cleanup\(\)/);
  assert.match(runner, /SET FOREIGN_KEY_CHECKS=0/);
  assert.match(runner, /SET FOREIGN_KEY_CHECKS=1/);
  assert.match(runner, /remaining_rows/);
  assert.match(runner, /cleanup_failure/);
  assert.match(runner, /directIds\[table\] \?\? \[\]/);
  assert.doesNotMatch(runner, /direct\[table\] \?\? rootIds/);
  assert.match(runner, /SCOUTOPS_ACCEPTANCE_PASSWORD/);
  assert.doesNotMatch(runner, /Qa-Platform|Qa-Member|password:\s*["'][^"']{12}/);
  assert.match(routeCoverage, /SCOUTOPS_QA_TRACE_ID/);
  assert.match(routeCoverage, /SCOUTOPS_PLAYWRIGHT_EXECUTABLE_PATH/);
  assert.match(routeCoverage, /executablePath: browserExecutablePath/);
  assert.match(runner, /verify-production-core-e2e\.mjs/);
  for (const table of [
    "trend_topics",
    "collection_tasks",
    "raw_evidence",
    "sourcing_candidates",
    "opportunity_cost_inputs",
    "opportunity_profit_runs",
  ])
    assert.match(runner, new RegExp(`INSERT INTO ${table}`));
  assert.match(
    runner,
    /opportunity_cost_inputs[\s\S]*is_current,submitted_by,confirmed_by[\s\S]*state\.users\.selection_manager[\s\S]*state\.users\.organization_admin/,
  );
  assert.match(coreE2e, /dependencies\?\.mysql === "available"/);
  assert.match(coreE2e, /dependencies\?\.redis === "available"/);
  assert.match(coreE2e, /extraHTTPHeaders: \{ "x-trace-id": traceId \}/);
  assert.match(coreE2e, /SCOUTOPS_PLAYWRIGHT_EXECUTABLE_PATH/);
  assert.match(coreE2e, /executablePath: browserExecutablePath/);
  assert.doesNotMatch(coreE2e, /page\.route\s*\(/);
  for (const file of [
    "production-route-catalog.mjs",
    "verify-production-product.mjs",
    "verify-production-api-coverage.mjs",
    "verify-production-core-e2e.mjs",
    "run-baota-production-acceptance.mjs",
  ])
    assert.match(deployer, new RegExp(file.replaceAll(".", "\\.")));
});

test("production acceptance preflight is read-only and reports the current machine baselines", () => {
  const result = spawnSync(process.execPath, ["scripts/run-baota-production-acceptance.mjs"], {
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(
    {
      status: report.status,
      production_verified: report.production_verified,
      paths: report.paths,
      operations: report.operations,
      protected_routes: report.protected_routes,
      roles: report.roles,
    },
    {
      status: "preflight_passed",
      production_verified: false,
      paths: 223,
      operations: 256,
      protected_routes: 60,
      roles: 6,
    },
  );
});
