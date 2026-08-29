import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PlatformDashboardService } from "../../apps/api/dist/platform-dashboard-service.js";

test("platform governance is a validated platform management domain", async () => {
  const calls = [];
  const service = new PlatformDashboardService({
    readManagement: async (input) => (calls.push(input), { summary: {} }),
  });
  await service.management({
    actorId: "actor",
    domain: "governance",
    section: "score_rules",
    query: "v2",
    status: "active",
    page: "2",
    pageSize: "20",
    requestId: "request",
    traceId: "trace",
  });
  assert.equal(calls[0].domain, "governance");
  assert.equal(calls[0].section, "score_rules");
  assert.equal(calls[0].page, 2);
  assert.equal(calls[0].pageSize, 20);
});

test("platform governance rejects cross-section statuses and invalid pagination", async () => {
  const service = new PlatformDashboardService({ readManagement: async () => ({}) });
  assert.throws(
    () =>
      service.management({
        actorId: "actor",
        domain: "governance",
        section: "automation_rules",
        status: "approved",
        requestId: "request",
        traceId: "trace",
      }),
    (error) => error.code === "platform_governance_status_invalid" && error.statusCode === 400,
  );
  assert.throws(
    () =>
      service.management({
        actorId: "actor",
        domain: "governance",
        section: "releases",
        page: 0,
        requestId: "request",
        traceId: "trace",
      }),
    (error) => error.code === "platform_governance_pagination_invalid" && error.statusCode === 400,
  );
});

test("platform governance covers rules workflows automation versions approvals rollout and rollback", async () => {
  const [web, routeCatalog, repository] = await Promise.all(
    [
      "apps/web/src/components/PlatformGovernanceCenter.vue",
      "config/route-catalog.json",
      "apps/api/src/mysql-platform-dashboard-repository.ts",
    ].map((path) => readFile(path, "utf8")),
  );
  for (const label of [
    "评分规则",
    "费用与风险",
    "审批工作流",
    "自动化规则",
    "灰度与回滚",
    "配置版本",
  ])
    assert.match(web, new RegExp(label));
  assert.equal(
    JSON.parse(routeCatalog).routes.some((route) => route.path === "/platform-admin/governance"),
    true,
  );
  for (const table of [
    "score_rules",
    "cost_rules",
    "approval_templates",
    "automation_rules",
    "deployment_releases",
    "provider_versions",
  ])
    assert.match(repository, new RegExp(table));
  assert.match(web, /useRoute\(\)/);
  assert.match(web, /AbortController/);
  assert.match(web, /page_size/);
  assert.match(repository, /pagination:/);
  assert.match(repository, /LIMIT \? OFFSET \?/);
});
