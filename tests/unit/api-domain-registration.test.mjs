import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sources = {
  workflow: "apps/api/src/bootstrap/register-workflow-domain.ts",
  platform: "apps/api/src/bootstrap/register-platform-domain.ts",
  operations: "apps/api/src/bootstrap/register-operations-domain.ts",
};

test("API startup delegates route assembly to bounded business domains", async () => {
  const server = await readFile("apps/api/src/server.ts", "utf8");
  for (const registrar of [
    "registerWorkflowDomainRoutes",
    "registerPlatformDomainRoutes",
    "registerOperationsDomainRoutes",
  ]) {
    assert.match(server, new RegExp(`${registrar}\\(`));
  }
  assert.doesNotMatch(
    server,
    /register(?:BusinessTask|Approval|Notification|OrganizationAdmin|PlatformDashboard|OpenPlatform|BackupRecovery|DataQuality)Routes\(/,
  );
  assert.ok(server.split(/\r?\n/).length < 600, "server bootstrap regressed");
});

test("each API registration domain owns its complete route family", async () => {
  const expected = {
    workflow: [
      "BusinessTask",
      "Approval",
      "Notification",
      "PersonalCenter",
      "Realtime",
      "Automation",
      "Report",
      "OrganizationAdmin",
    ],
    platform: [
      "PlatformDashboard",
      "PlatformAccount",
      "CollectionConsole",
      "SecurityOperations",
      "OpenPlatform",
      "Commercial",
    ],
    operations: [
      "BackupRecovery",
      "ReleaseRollout",
      "RuntimeTopology",
      "RedisResilience",
      "MySqlResilience",
      "FileResilience",
      "CrawlerScheduler",
      "CapacityBoundary",
      "DataQuality",
    ],
  };
  for (const [domain, file] of Object.entries(sources)) {
    const source = await readFile(file, "utf8");
    for (const route of expected[domain]) {
      assert.match(source, new RegExp(`register${route}Routes\\(`));
    }
    assert.ok(source.split(/\r?\n/).length < 160, `${domain} registration became a new monolith`);
  }
});
