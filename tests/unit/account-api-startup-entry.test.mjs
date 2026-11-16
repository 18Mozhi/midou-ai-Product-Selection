import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("compiled API refuses a wrong retired target before Redis or HTTP startup", () => {
  const fixture = "scoutops-startup-fixture-not-a-secret";
  const child = spawnSync(process.execPath, [
    fileURLToPath(new URL("../../apps/api/dist/server.js", import.meta.url)),
  ], {
    env: {
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      NODE_ENV: "production",
      ACCOUNT_SCOPE_MODE: "retired",
      DB_HOST: "127.0.0.1",
      DB_NAME: "wrong_cutover_target",
      DB_PASSWORD: fixture,
      SESSION_SECRET: fixture,
      CREDENTIALS_MASTER_KEY: fixture,
      EVIDENCE_DOWNLOAD_SIGNING_KEY: fixture,
      RELEASE_PROBE_SIGNING_KEY: fixture,
      CRAWLER_SERVICE_TOKEN: fixture,
      CRAWLER_ACTOR_ID: "00000000-0000-4000-8000-000000000001",
      RUNTIME_NODE_ID: "api-fixture",
      RUNTIME_HOST_ID: "loopback-fixture",
    },
    encoding: "utf8",
    timeout: 10000,
  });
  assert.ifError(child.error);
  assert.equal(child.status, 1);
  assert.match(child.stderr, /Error: account_cutover_target_invalid/);
  assert.equal(child.stdout, "");
});

test("API entry binds verified mode to core reads and approval registrars", () => {
  const read = (path) => readFileSync(new URL(`../../apps/api/src/${path}`, import.meta.url), "utf8");
  const server = read("server.ts");
  const workflow = read("bootstrap/register-workflow-domain.ts");
  const gate = server.indexOf("await resolveAccountApiMode(config, pool)");
  assert.ok(gate > server.indexOf("const pool = createDatabasePool"));
  assert.ok(gate < server.indexOf("const redisClient = createRedisConnection"));
  for (const domain of ["localAuth", "trends", "opportunities", "scoring", "profit", "competitors", "sourcing"])
    assert.match(server, new RegExp(`  ${domain}: \\{[^}]+accountReadRehearsal,`), domain);
  for (const domain of ["BusinessTask", "Approval"])
    assert.match(workflow, new RegExp(`register${domain}Routes\\(context.app, \\{[^}]+accountReadRehearsal: context.accountReadRehearsal,`), domain);
  assert.match(workflow, /if \(!context.accountReadRehearsal\)\s+registerOrganizationAdminRoutes/);
  assert.match(server, /accountRehearsalReady: \(\) => requireAccountReadRehearsal\(pool\)/);
});
