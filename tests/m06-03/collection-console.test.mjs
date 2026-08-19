import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CollectionConsoleService,
  CollectionConsoleError,
} from "../../apps/api/dist/collection-console-service.js";
import { MySqlCollectionConsoleRepository } from "../../apps/api/dist/mysql-collection-console-repository.js";

test("M06-03.A01/A02/A04/A12 validates scope source time and exact error filters", async () => {
  const calls = [];
  const service = new CollectionConsoleService(
    { read: async (input) => (calls.push(input), input) },
    25,
  );
  const organizationId = "00000000-0000-4000-8000-000000000603";
  const workspaceId = "00000000-0000-4000-8000-000000000604";
  const providerId = "00000000-0000-4000-8000-000000000605";
  await service.read({
    actorId: "a",
    organizationId,
    workspaceId,
    providerId,
    window: "7d",
    errorCode: "parser_failed",
  });
  assert.equal(calls[0].organizationId, organizationId);
  assert.equal(calls[0].workspaceId, workspaceId);
  assert.equal(calls[0].providerId, providerId);
  assert.equal(calls[0].window, "7d");
  assert.equal(calls[0].errorCode, "parser_failed");
  assert.equal(calls[0].recentLimit, 25);
  assert.throws(
    () => service.read({ organizationId: "bad" }),
    (error) =>
      error instanceof CollectionConsoleError &&
      error.code === "collection_console_scope_invalid",
  );
  assert.throws(
    () => service.read({ window: "yesterday" }),
    (error) =>
      error instanceof CollectionConsoleError &&
      error.code === "collection_console_window_invalid",
  );
  assert.throws(
    () => service.read({ errorCode: "not allowed!" }),
    (error) =>
      error instanceof CollectionConsoleError &&
      error.code === "collection_console_error_code_invalid",
  );
});

test("M06-03.A03/A05/A09/A11/A16 reads audited real source and root-cause relations", async () => {
  const [up, down, repository, route] = await Promise.all(
    [
      "database/migrations/0021_collection_console_m06_03.up.sql",
      "database/migrations/0021_collection_console_m06_03.down.sql",
      "apps/api/src/mysql-collection-console-repository.ts",
      "apps/api/src/collection-console-routes.ts",
    ].map((path) => readFile(path, "utf8")),
  );
  assert.match(up, /collection_console_views/);
  assert.match(up, /DEFAULT CHARSET=utf8mb4/);
  assert.doesNotMatch(up, /CHECK\s*\(|utf8mb4_0900/i);
  assert.match(down, /DROP TABLE IF EXISTS/);
  assert.match(repository, /platform\.collection\.console\.read/);
  assert.match(repository, /organization_id = \?/);
  assert.match(repository, /workspace_id = \?/);
  assert.match(
    repository,
    /collection_subqueries source_scope[\s\S]*source_scope\.provider_id = \?/,
  );
  assert.match(repository, /a\.error_code IS NOT NULL/);
  assert.match(
    repository,
    /SELECT a\.error_code, COUNT\(\*\) total[\s\S]*GROUP BY a\.error_code/,
  );
  assert.match(repository, /provider_filter_id[\s\S]*window[\s\S]*error_code/);
  assert.match(route, /providerId: query\.provider_id/);
  assert.match(route, /window: query\.window/);
  assert.match(route, /errorCode: query\.error_code/);
  assert.match(route, /capability: "platform:operate"/);
  assert.doesNotMatch(repository, /credential|cookie|payload_json/i);
  for (const line of repository.split(/\r?\n/))
    assert.ok(
      !/SELECT|INSERT|UPDATE|DELETE/.test(line) || line.length < 160,
      `SQL line is too long: ${line.length}`,
    );
});

test("M06-03 repository applies one source and time scope to task facts without placeholder drift", async () => {
  const organizationId = "00000000-0000-4000-8000-000000000603";
  const workspaceId = "00000000-0000-4000-8000-000000000604";
  const providerId = "00000000-0000-4000-8000-000000000605";
  const calls = [];
  const pool = {
    async query(sql, values = []) {
      calls.push([sql, values]);
      if (sql.includes("SELECT id FROM organizations")) return [[{ id: organizationId }]];
      if (sql.includes("SELECT organization_id FROM workspaces"))
        return [[{ organization_id: organizationId }]];
      if (sql.includes("SELECT id FROM providers WHERE")) return [[{ id: providerId }]];
      if (sql.includes("FROM providers p"))
        return [[{
          id: providerId,
          code: "news",
          name: "公开趋势 RSS",
          status: "enabled",
          owner_label: "运营组",
          schedule_minutes: 60,
          concurrency_limit: 1,
          parser_version: "v1",
          health_status: "ready",
          consecutive_failures: 0,
        }]];
      if (sql.includes("SELECT t.status")) return [[{ status: "running", total: 2 }]];
      if (sql.includes("FROM collection_dead_letters"))
        return [[{ error_code: "parser_failed", created_at: new Date("2026-08-19T01:00:00Z") }]];
      if (sql.includes("FROM data_quality_issues"))
        return [[{ severity: "warning", status: "open", total: 1 }]];
      if (sql.includes("SELECT a.error_code"))
        return [[{ error_code: "parser_failed", total: 3, latest_at: new Date("2026-08-19T01:00:00Z") }]];
      if (sql.includes("FROM collection_task_attempts"))
        return [[{ attempt_number: 2, started_at: null, finished_at: null }]];
      throw new Error(`unexpected query: ${sql}`);
    },
    async getConnection() {
      return {
        beginTransaction: async () => {},
        query: async () => [{}],
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
      };
    },
  };
  const repository = new MySqlCollectionConsoleRepository(
    pool,
    () => new Date("2026-08-19T02:00:00Z"),
  );
  const result = await repository.read({
    actorId: "actor",
    organizationId,
    workspaceId,
    providerId,
    window: "24h",
    errorCode: "parser_failed",
    recentLimit: 25,
    requestId: "request",
    traceId: "trace",
  });
  assert.equal(result.sources.length, 1);
  assert.equal(result.root_causes[0].error_code, "parser_failed");
  assert.equal(result.filters.provider_id, providerId);
  for (const [sql, values] of calls)
    assert.equal((sql.match(/\?/g) ?? []).length, values.length, sql);
  const factQueries = calls.filter(([sql]) =>
    /collection_tasks|collection_dead_letters|data_quality_issues|collection_task_attempts/.test(sql),
  );
  assert.ok(factQueries.every(([sql]) => sql.includes("source_scope.provider_id = ?") || sql.includes("q.provider_id = ?")));
  assert.ok(factQueries.every(([sql]) => />= \?/.test(sql)));
});

test("M06-03.A06/A07/A08/A10/A13/A17 delivery contracts", async () => {
  const openapi = await readFile("docs/openapi.yaml", "utf8");
  const all = (
    await Promise.all(
      [
        "docs/openapi.yaml",
        "apps/web/src/components/CollectionOperationsConsole.vue",
        "apps/web/src/styles.css",
        "config/env.example",
        "docs/feature-map.json",
        "docs/architecture/m06-03-collection-console.md",
        "docs/runbooks/m06-03-collection-console.md",
      ].map((path) => readFile(path, "utf8")),
    )
  ).join("\n");
  for (const value of [
    "/platform/collection/console",
    "loading",
    "empty",
    "expired",
    "forbidden",
    "rate_limited",
    "blocked",
    "provider_id",
    "error_code",
    "root_causes",
    "COLLECTION_CONSOLE_RECENT_LIMIT",
    "M06-03",
    "宝塔",
    "回滚",
  ])
    assert.match(all, new RegExp(value.replaceAll("/", "\\/")));
  assert.match(all, /linkLabels[\s\S]*来源配置/);
  assert.match(all, /white-space:nowrap/);
  assert.match(all, /@media\(max-width:800px\)/);
  assert.match(
    openapi,
    /\n  \/platform\/collection\/console:[\s\S]*name: provider_id[\s\S]*name: window[\s\S]*name: error_code/,
  );
});
