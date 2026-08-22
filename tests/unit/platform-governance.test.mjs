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
    query: "v2",
    status: "active",
    requestId: "request",
    traceId: "trace",
  });
  assert.equal(calls[0].domain, "governance");
});

test("platform governance covers rules workflows automation versions approvals rollout and rollback", async () => {
  const [web, shell, repository] = await Promise.all(
    [
      "apps/web/src/components/PlatformGovernanceCenter.vue",
      "apps/web/src/route-catalog.ts",
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
  assert.match(shell, /\/platform-admin\/governance/);
  for (const table of [
    "score_rules",
    "cost_rules",
    "approval_templates",
    "automation_rules",
    "deployment_releases",
    "provider_versions",
  ])
    assert.match(repository, new RegExp(table));
});
