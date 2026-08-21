import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { HomeDashboardService } from "../../apps/api/dist/home-dashboard-service.js";
import { buildApp } from "../../apps/api/dist/app.js";
const org = "00000000-0000-4000-8000-000000000601",
  workspace = "00000000-0000-4000-8000-000000000602",
  actor = "00000000-0000-4000-8000-000000000603",
  session = "00000000-0000-4000-8000-000000000604",
  now = "2026-08-07T16:30:00.000Z",
  read = (path) => readFile(path, "utf8"),
  item = (kind, id) => ({
    id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    kind,
    title: `${kind}-${id}`,
    reason: "verified",
    route: "/tasks/example",
    priority: kind === "action" ? "normal" : null,
    owner_label: null,
    due_at: null,
    source_count: kind === "change" ? 2 : null,
    observed_at: now,
    severity: "info",
    source_version: 1,
  });
test("M02-06.A01/A02/A04/A12 service groups and caps the truthful projection", async () => {
  const rows = [
    ...Array.from({ length: 7 }, (_, i) => item("action", i + 1)),
    item("change", 20),
    item("follow", 21),
    item("health", 22),
  ];
  let scope;
  const result = await new HomeDashboardService(
    { list: async (input) => ((scope = input), rows) },
    () => new Date(now),
  ).get({
    organizationId: org,
    workspaceId: workspace,
    actorId: actor,
    capabilities: ["task:read"],
  });
  assert.equal(result.actions.length, 5);
  assert.equal(result.changes.length, 1);
  assert.equal(result.follows.length, 1);
  assert.equal(result.health.length, 1);
  assert.equal(result.generated_at, now);
  assert.deepEqual(scope, {
    organizationId: org,
    workspaceId: workspace,
    actorId: actor,
    capabilities: ["task:read"],
  });
});
test("M02-06.A04/A12 empty projection remains empty and does not invent metrics", async () => {
  const result = await new HomeDashboardService({ list: async () => [] }).get({
    organizationId: org,
    workspaceId: workspace,
    actorId: actor,
    capabilities: [],
  });
  assert.deepEqual(result.actions, []);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.follows, []);
  assert.deepEqual(result.health, []);
});
test("M02-06.A06/A09/A11/A13 API derives actor tenant capability and correlation", async () => {
  const calls = [];
  const service = {
      get: async (input) => {
        calls.push(input);
        return {
          actions: [],
          changes: [],
          follows: [],
          health: [],
          scope: { organization_id: org, workspace_id: workspace },
          generated_at: now,
        };
      },
    },
    authorization = {
      resolveSession: async () => ({
        context: { organization_id: org, workspace_id: workspace },
        subject: { capabilities: ["task:read"] },
      }),
      authorize: async (input) => calls.push(input),
    },
    auth = { authenticate: async () => ({ user: { id: actor }, session: { id: session } }) };
  const app = buildApp({ homeDashboard: { service, authorization, auth, secureCookie: false } }),
    response = await app.inject({
      method: "GET",
      url: "/api/v1/me/home-dashboard",
      headers: {
        cookie: "scoutops_session=test",
        "x-request-id": "m02-06-request",
        "x-trace-id": "m02-06-trace",
      },
    });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().request_id, "m02-06-request");
  assert.equal(calls[0].capability, "task:read");
  assert.equal(calls[1].actorId, actor);
  assert.equal(calls[1].organizationId, org);
  await app.close();
});
test("M02-06.A03/A05/A06/A07/A08/A10/A13/A15/A16/A17 delivery contracts are explicit", async () => {
  const [
    up,
    down,
    repo,
    home,
    apiClient,
    opportunity,
    shell,
    openapi,
    env,
    architecture,
    runbook,
    feature,
    e2e,
  ] = await Promise.all(
    [
      "database/migrations/0015b_home_dashboard_m02_06.up.sql",
      "database/migrations/0015b_home_dashboard_m02_06.down.sql",
      "apps/api/src/mysql-home-dashboard-repository.ts",
      "apps/web/src/components/HomeDashboard.vue",
      "apps/web/src/api-client.ts",
      "apps/web/src/components/OpportunityMobileShell.vue",
      "apps/web/src/components/NavigationShell.vue",
      "docs/openapi.yaml",
      "config/env.example",
      "docs/architecture/m02-06-home-mobile.md",
      "docs/runbooks/m02-06-home-mobile.md",
      "docs/feature-map.json",
      "tests/e2e/m02-06-home-mobile.spec.ts",
    ].map(read),
  );
  assert.match(up, /CHAR\(36\) CHARACTER SET ascii/);
  assert.match(up, /audience_user_id/);
  assert.match(down, /DROP TABLE/);
  for (const rule of [
    "organization_id=\?",
    "workspace_id=\?",
    "required_capability IN",
    "kind='health' AND audience_user_id=\?",
  ])
    assert.match(repo, new RegExp(rule));
  assert.match(openapi, /\/me\/home-dashboard:/);
  assert.match(home, /createApiClient/);
  assert.match(apiClient, /credentials\s*:\s*["']include["']/);
  assert.match(home, /真实任务、趋势、机会和来源状态/);
  assert.match(home, /home-priority-grid[\s\S]*今日行动[\s\S]*异常与数据健康/);
  assert.match(home, /home-secondary[\s\S]*变化与关注/);
  assert.match(home, /source_count[\s\S]*去处理/);
  assert.doesNotMatch(home, /全链路教学/);
  assert.match(opportunity, /机会暂无详情[\s\S]*等待真实数据/);
  assert.doesNotMatch(opportunity, /SKELETON|P04/);
  assert.match(shell, /HomeDashboard/);
  assert.doesNotMatch(env, /HOME_DASHBOARD_|DASHBOARD_PROJECTION_/);
  assert.match(architecture, /不.*模拟|不.*示例/);
  assert.match(runbook, /宝塔.*Node API/s);
  assert.match(feature, /homeAndMobileShell/);
  assert.match(e2e, /toBeVisible|toHaveAttribute|keyboard\\.press/);
  const migrations = await readdir("database/migrations");
  assert.ok(migrations.includes("0015b_home_dashboard_m02_06.up.sql"));
});
