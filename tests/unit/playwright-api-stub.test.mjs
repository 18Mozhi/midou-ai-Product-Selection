import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("Playwright uses the real Fastify app with in-memory readiness dependencies", async () => {
  const [config, server, e2e] = await Promise.all([
    read("playwright.config.ts"),
    read("scripts/run-playwright-api-test-server.mjs"),
    read("tests/e2e/m00-09-real-api-acceptance.spec.ts"),
  ]);

  assert.match(config, /npm run start:e2e-api/);
  assert.doesNotMatch(config, /apps\/api\/dist\/server\.js/);
  assert.match(server, /buildApp/);
  assert.match(server, /available\("mysql"\)/);
  assert.match(server, /available\("redis"\)/);
  assert.doesNotMatch(server, /createServer|playwright_route_not_mocked/);
  assert.match(e2e, /\[real-api\] readiness renders from Fastify without interception/);
  assert.match(e2e, /page\.screenshot/);
  assert.doesNotMatch(e2e, /page\.route/);
});
