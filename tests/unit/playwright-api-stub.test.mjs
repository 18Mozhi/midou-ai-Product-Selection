import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("Playwright uses a fail-closed API stub instead of requiring local MySQL", async () => {
  const [config, stub] = await Promise.all([
    read("playwright.config.ts"),
    read("scripts/run-playwright-api-stub.mjs"),
  ]);

  assert.match(config, /node scripts\/run-playwright-api-stub\.mjs/);
  assert.doesNotMatch(config, /apps\/api\/dist\/server\.js/);
  assert.match(stub, /request\.method === "GET"/);
  assert.match(stub, /request\.url === "\/api\/v1\/health\/live"/);
  assert.match(stub, /response\.statusCode = 503/);
  assert.match(stub, /playwright_route_not_mocked/);
  assert.doesNotMatch(stub, /mysql|database|redis/i);
});
