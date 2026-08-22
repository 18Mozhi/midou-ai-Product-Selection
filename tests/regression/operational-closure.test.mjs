import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("Feature Map routes are unique and Vue Router owns reactive lazy navigation", async () => {
  const [featureSource, router, app, shell, routeState] = await Promise.all([
    read("docs/feature-map.json"),
    read("apps/web/src/router.ts"),
    read("apps/web/src/App.vue"),
    read("apps/web/src/components/NavigationShell.vue"),
    read("apps/web/src/navigation-shell-route-state.ts"),
  ]);
  const routes = JSON.parse(featureSource).routes;
  assert.equal(new Set(routes.map((route) => route.path)).size, routes.length);
  assert.match(router, /createRouter[\s\S]*createWebHistory/);
  assert.match(app, /defineAsyncComponent[\s\S]*useRoute/);
  assert.match(router, /appRoutes[\s\S]*document\.title/);
  assert.match(shell, /import\.meta\.glob[\s\S]*KeepAlive/);
  assert.match(shell, /navigation-shell-route-state/);
  assert.match(routeState, /采集调度/);
});

test("Python crawler consumes profile leases and writes Playwright results instead of idle-only heartbeat", async () => {
  const [main, mainLoop, executionRunner, client, bridge, routes, env, openapi] = await Promise.all(
    [
      read("apps/crawler/scoutops_crawler/__main__.py"),
      read("apps/crawler/scoutops_crawler/main_loop.py"),
      read("apps/crawler/scoutops_crawler/execution_runner.py"),
      read("apps/crawler/scoutops_crawler/runtime_client.py"),
      read("apps/crawler/scoutops_crawler/playwright_bridge.py"),
      read("apps/api/src/crawler-runtime-routes.ts"),
      read("config/env.example"),
      read("docs/openapi.yaml"),
    ],
  );
  assert.doesNotMatch(`${main}\n${mainLoop}`, /status=["']idle["']/);
  assert.match(mainLoop, /client\.acquire[\s\S]*execute_lease[\s\S]*client\.complete/);
  assert.match(executionRunner, /PlaywrightBridge[\s\S]*\.run\(request, heartbeat_failed\)/);
  for (const action of ["acquire", "heartbeat", "complete"])
    assert.match(client + routes + openapi, new RegExp(action));
  for (const key of ["CRAWLER_SERVICE_TOKEN", "CRAWLER_API_BASE_URL", "CRAWLER_LEASE_SECONDS"])
    assert.match(env, new RegExp(key));
  assert.doesNotMatch(env, /CRAWLER_EXECUTION_REQUEST_FILE|CRAWLER_PROFILE_ID/);
  assert.match(bridge, /shell=False/);
  assert.doesNotMatch(
    client + main + mainLoop + executionRunner,
    /service_token.*print|authorization.*print/i,
  );
});

test("business operations expose blocking context, safe batch preview and verification follow-up", async () => {
  const [
    journey,
    task,
    taskDetail,
    taskBatch,
    taskTypes,
    opportunity,
    opportunityDecision,
    opportunityRepository,
    approval,
    notification,
    migrations,
  ] = await Promise.all([
    read("apps/web/src/components/SelectionJourney.vue"),
    read("apps/web/src/components/TaskWorkspace.vue"),
    read("apps/web/src/components/TaskDetailPanel.vue"),
    read("apps/web/src/components/TaskBatchActions.vue"),
    read("apps/web/src/components/task-workspace-types.ts"),
    read("apps/web/src/components/OpportunityWorkspace.vue"),
    read("apps/web/src/components/OpportunityDecisionPanel.vue"),
    read("apps/api/src/mysql-opportunity-repository.ts"),
    read("apps/web/src/components/ApprovalWorkspace.vue"),
    read("apps/web/src/components/NotificationCenter.vue"),
    Promise.all(
      ["0045_operational_task_links.up.sql", "0046_notification_workflow_root_cause.up.sql"].map(
        (name) => read(`database/migrations/${name}`),
      ),
    ).then((items) => items.join("\n")),
  ]);
  assert.match(journey, /blocked_owner[\s\S]*blocked_next_step[\s\S]*timeline/);
  for (const token of ["previewBatch", "collection_task_id", "pause", "resume"])
    assert.match(`${task}\n${taskDetail}\n${taskBatch}\n${taskTypes}`, new RegExp(token));
  assert.match(
    `${opportunity}\n${opportunityDecision}`,
    /证据不足，先补齐缺失项[\s\S]*生成补数任务/,
  );
  assert.match(opportunityRepository, /selection_verification[\s\S]*verification_task_id/);
  for (const token of ["evidence_complete", "evidence_total", "rule_version", "basis"])
    assert.match(approval, new RegExp(token));
  assert.match(notification, /group_count[\s\S]*workflow_status/);
  assert.match(notification, /sourceRoute[\s\S]*返回来源/);
  assert.match(migrations, /paused[\s\S]*collection_task_id[\s\S]*root_cause_key/);
});

test("canonical deployment docs and runtime supervisor use the fixed BaoTa topology", async () => {
  const [readme, blueprint, deployment, supervisor] = await Promise.all([
    read("README.md"),
    read("new-product-enterprise-blueprint.md"),
    read("infra/baota/README.md"),
    read("apps/backend/src/supervisor.ts"),
  ]);
  const docs = readme + blueprint + deployment;
  for (const path of [
    "/www/wwwroot/ai选品/frontend",
    "/www/wwwroot/ai选品/backend",
    "/www/wwwroot/ai选品/python",
  ])
    assert.match(docs, new RegExp(path));
  assert.doesNotMatch(docs, /ai选品\/current|`current` 原子/);
  assert.match(supervisor, /restartCount[\s\S]*circuitOpenUntil[\s\S]*stateFile/);
});
