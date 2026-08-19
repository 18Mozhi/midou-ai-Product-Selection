import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("the shared frontend API client owns correlation, credentials, idempotency and error mapping", async () => {
  const source = await read("apps/web/src/api-client.ts");

  for (const contract of [
    'headers.set("x-request-id", requestId)',
    'headers.set("x-trace-id", traceId)',
    'headers.set("content-type", "application/json")',
    'headers.set("idempotency-key"',
    'credentials: "include"',
    "throw new ApiClientError(",
    "payload?.error?.message",
    "payload?.error?.action_hint",
  ]) {
    assert.match(source, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("migrated frontend surfaces use the shared API client instead of direct fetch", async () => {
  const paths = [
    "apps/web/src/components/NavigationShell.vue",
    "apps/web/src/components/DiscoveryOverlay.vue",
    "apps/web/src/components/HomeDashboard.vue",
    "apps/web/src/components/LocalIdentity.vue",
    "apps/web/src/components/TenancyChooser.vue",
    "apps/web/src/components/LandingRedirect.vue",
    "apps/web/src/components/PersonalCenter.vue",
    "apps/web/src/components/ThemeStudio.vue",
    "apps/web/src/components/ApiFoundation.vue",
    "apps/web/src/components/TaskWorkspace.vue",
    "apps/web/src/components/TrendDashboard.vue",
    "apps/web/src/components/ScoreRuleConsole.vue",
    "apps/web/src/components/CostRuleConsole.vue",
    "apps/web/src/components/OpportunityWorkspace.vue",
    "apps/web/src/components/CompetitorMonitor.vue",
    "apps/web/src/components/SourcingWorkspace.vue",
    "apps/web/src/components/CollectionRuntimeCenter.vue",
    "apps/web/src/components/CrawlerSchedulerCenter.vue",
    "apps/web/src/components/RuntimeTopologyCenter.vue",
    "apps/web/src/components/CapacityBoundaryCenter.vue",
  ];

  for (const path of paths) {
    const source = await read(path);
    assert.match(source, /createApiClient/);
    assert.match(source, /ApiClientError/);
    assert.doesNotMatch(source, /\bfetch\s*\(/);
  }
});

test("core shell error surfaces preserve request and trace correlation", async () => {
  const [navigation, discovery, home] = await Promise.all([
    read("apps/web/src/components/NavigationShell.vue"),
    read("apps/web/src/components/DiscoveryOverlay.vue"),
    read("apps/web/src/components/HomeDashboard.vue"),
  ]);

  assert.match(navigation, /error\.requestId/);
  assert.match(navigation, /error\.traceId/);
  assert.match(navigation, /链路编号/);
  for (const source of [discovery, home]) {
    assert.match(source, /error\.actionHint/);
    assert.match(source, /:request-id="requestId"/);
    assert.match(source, /:trace-id="traceId"/);
    assert.match(source, /:action-hint="actionHint"/);
  }
});
