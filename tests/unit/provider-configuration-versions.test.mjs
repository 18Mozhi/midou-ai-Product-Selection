import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ProviderSourceService } from "../../apps/api/dist/provider-source-service.js";
import { MySqlProviderSourceRepository } from "../../apps/api/dist/mysql-provider-source-repository.js";

const providerId = "00000000-0000-4000-8000-000000000531";
const actorId = "00000000-0000-4000-8000-000000000532";

test("provider configuration history exposes only safe field differences", async () => {
  let historySql = "";
  const repository = new MySqlProviderSourceRepository({
    query: async (sql) => {
      if (sql.includes("SELECT id,version FROM providers"))
        return [[{ id: providerId, version: 3 }], []];
      historySql = sql;
      return [
        [
          {
            version: 1,
            action: "created",
            snapshot_json: JSON.stringify({
              schedule_minutes: 15,
              timeout_ms: 20000,
              retry_limit: 3,
              status: "disabled",
              secret_value: "must-not-leak",
            }),
            created_at: "2026-08-20T00:00:00.000Z",
          },
          {
            version: 2,
            action: "configuration_updated",
            snapshot_json: JSON.stringify({
              schedule_minutes: 30,
              timeout_ms: 20000,
              retry_limit: 2,
              status: "enabled",
              secret_value: "must-not-leak",
            }),
            created_at: "2026-08-20T01:00:00.000Z",
          },
          {
            version: 3,
            action: "configuration_rolled_back",
            snapshot_json: JSON.stringify({
              schedule_minutes: 15,
              timeout_ms: 20000,
              retry_limit: 3,
              status: "disabled",
              secret_value: "must-not-leak",
            }),
            created_at: "2026-08-20T02:00:00.000Z",
          },
        ].reverse(),
        [],
      ];
    },
  });
  const result = await repository.configurationVersions(providerId);
  assert.match(historySql, /ORDER BY version DESC LIMIT 101/);
  assert.equal(result.current_version, 3);
  assert.equal(result.versions[0].current, true);
  assert.equal(result.versions[1].rollback_available, true);
  assert.deepEqual(
    result.versions[1].changes.map((change) => change.field),
    ["schedule_minutes", "retry_limit", "status"],
  );
  assert.doesNotMatch(JSON.stringify(result), /must-not-leak|secret_value/);
});

test("provider configuration rollback appends a new version and preserves history", async () => {
  const calls = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("FROM provider_source_operations")) return [[], []];
      if (sql === "SELECT * FROM providers WHERE id=? FOR UPDATE")
        return [
          [
            {
              id: providerId,
              code: "manual_product_supply_csv",
              access_mode: "import",
              version: 3,
              schedule_minutes: 30,
              timeout_ms: 30000,
              retry_limit: 4,
              status: "enabled",
              parser_version: "csv-v1",
            },
          ],
          [],
        ];
      if (sql.includes("SELECT snapshot_json FROM provider_versions"))
        return [
          [
            {
              snapshot_json: JSON.stringify({
                schedule_minutes: 15,
                timeout_ms: 20000,
                retry_limit: 2,
                status: "disabled",
              }),
            },
          ],
          [],
        ];
      return [[], []];
    },
  };
  const repository = new MySqlProviderSourceRepository({ getConnection: async () => connection });
  const result = await repository.rollbackConfiguration({
    providerId,
    targetVersion: 1,
    expectedVersion: 3,
    reason: "恢复上一套稳定设置",
    actorId,
    route: `/platform/provider-sources/${providerId}/configuration/rollbacks`,
    idempotencyKey: "rollback-1",
    requestId: "request-rollback",
    traceId: "trace-rollback",
    now: new Date("2026-08-20T03:00:00.000Z"),
  });
  assert.equal(result.version, 4);
  assert.equal(result.schedule_minutes, 15);
  assert.ok(
    calls.some(
      ({ sql, params }) =>
        sql.includes("INSERT INTO provider_versions") &&
        params.includes("configuration_rolled_back"),
    ),
  );
  assert.ok(calls.some(({ sql }) => sql.includes("provider.configuration.rolled_back")));
  assert.equal(
    calls.some(({ sql }) => /DELETE FROM provider_versions|UPDATE provider_versions/.test(sql)),
    false,
  );
});

test("provider configuration rollback validates target and current versions before repository writes", async () => {
  let input;
  const service = new ProviderSourceService(
    { rollbackConfiguration: async (value) => ((input = value), { version: 4 }) },
    () => new Date("2026-08-20T03:00:00.000Z"),
  );
  assert.throws(
    () =>
      service.rollbackConfiguration(
        providerId,
        { target_version: 3, expected_version: 3, reason: "无效目标" },
        { actorId, idempotencyKey: "same", requestId: "request", traceId: "trace" },
      ),
    { code: "provider_rollback_target_invalid" },
  );
  await service.rollbackConfiguration(
    providerId,
    { target_version: 1, expected_version: 3, reason: "恢复稳定设置" },
    { actorId, idempotencyKey: "valid", requestId: "request", traceId: "trace" },
  );
  assert.equal(input.targetVersion, 1);
  assert.equal(input.expectedVersion, 3);
  assert.equal(input.reason, "恢复稳定设置");
});

test("provider configuration migration and contracts keep MySQL57 append-only rollback semantics", async () => {
  const [up, down, routes, openapi, featureMap] = await Promise.all(
    [
      "database/migrations/0053_provider_configuration_versions.up.sql",
      "database/migrations/0053_provider_configuration_versions.down.sql",
      "apps/api/src/provider-source-routes.ts",
      "docs/openapi.yaml",
      "docs/feature-map.json",
    ].map((path) => readFile(path, "utf8")),
  );
  assert.match(up, /configuration_updated/);
  assert.match(up, /configuration_rolled_back/);
  assert.doesNotMatch(up, /CHECK\s*\(|utf8mb4_0900|INVISIBLE\s+INDEX/i);
  assert.match(down, /SET `action` = 'updated'/);
  for (const source of [routes, openapi, featureMap]) {
    assert.match(source, /configuration\/versions/);
    assert.match(source, /configuration\/rollbacks/);
  }
});
