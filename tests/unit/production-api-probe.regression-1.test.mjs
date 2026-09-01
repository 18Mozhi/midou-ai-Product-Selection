import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

// Regression: API-002 — API coverage probes mixed negative authorization with the six-role route matrix
// Found by /qa on 2026-09-02
// Report: docs/enterprise-audit/05-api-test-report.md
test("production API probes isolate negative authorization without changing the six-role baseline", async () => {
  const [manifest, runner, coverage] = await Promise.all([
    read("infra/baota/production-acceptance-manifest.json").then(JSON.parse),
    read("scripts/run-baota-production-acceptance.mjs"),
    read("scripts/verify-production-api-coverage.mjs"),
  ]);

  assert.deepEqual(manifest.apiProbe.authorizationProbe, {
    count: 1,
    key: "authorization_probe",
    role: "auditor",
    shell: "member",
    credentialPrefix: "SCOUTOPS_QA_AUTHORIZATION_PROBE",
  });
  assert.equal(manifest.baseline.roleCount, 6);
  assert.match(runner, /const seededProfiles = \[\.\.\.roleProfiles, authorizationProbeProfile\]/);
  assert.match(runner, /role_count: roleProfiles\.length/);
  assert.match(runner, /verified_users: seededProfiles\.length/);
  assert.match(runner, /single_role_accounts: seededProfiles\.length/);
  assert.match(coverage, /const allProfiles = \[\.\.\.profiles, authorizationProbe\]/);
  assert.match(coverage, /!authorizationProbe\.capabilities\.includes\(capability\)/);
  assert.match(coverage, /for \(const profile of allProfiles\)/);
});

// Regression: API-003 — missing capability metadata and invalid safe fixtures produced false GET failures
// Found by /qa on 2026-09-02
// Report: docs/enterprise-audit/05-api-test-report.md
test("production API probes use bounded role fallback and valid safe GET fixtures", async () => {
  const coverage = await read("scripts/verify-production-api-coverage.mjs");

  assert.match(coverage, /const authorizedProfiles = \(capability, path\)/);
  assert.match(coverage, /path\.startsWith\("\/platform\/"\) \? "platform_admin" : "member"/);
  assert.match(
    coverage,
    /for \(const candidate of authorizedProfiles\(operation\.required_capability, operation\.path\)\)/,
  );
  assert.match(coverage, /attempts\.find\(\(attempt\) => attempt\.outcome === "blocked"\)/);
  assert.match(coverage, /get_me_navigation: "\?shell=member"/);
  assert.match(coverage, /get_me_global_search: "\?q=acceptance"/);
  assert.match(coverage, /get_me_quick_actions: "\?shell=member"/);
  assert.match(coverage, /reportType: "opportunity"/);
  assert.match(coverage, /topicId: resourceIds\.trendTopicId/);
  assert.match(coverage, /searchId: resourceIds\.sourcingSearchId/);
  assert.match(coverage, /openapi_operation_route_not_found/);
});
