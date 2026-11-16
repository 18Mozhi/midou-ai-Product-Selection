import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { MySqlNotificationRepository } from "../../apps/api/dist/mysql-notification-repository.js";
import { registerNotificationRoutes } from "../../apps/api/dist/notification-routes.js";
import { readDeliveryNotificationPreferences } from "../../packages/database/dist/index.js";

const cols = [[{ Field: "historical_context" }, { Field: "user_id" }]];
test("0174 preference routes bind to the verified login, not session scope or body identity", async () => {
  const app = Fastify();
  const seen = [];
  registerNotificationRoutes(app, {
    accountReadRehearsal: true, webOrigin: "https://fixture.invalid", secureCookie: false,
    authorization: { async resolveSession() { assert.fail("legacy session scope consulted"); } },
    auth: { async authenticate() { return { user: { id: "signed-in", email_verified_at: new Date() } }; } },
    service: { async preferences(i) { seen.push(i); return {}; }, async updatePreferences(i) { seen.push(i); return {}; } },
  });
  try {
    assert.equal((await app.inject({url: "/api/v1/me/notification-preferences", headers: {cookie: "scoutops_session=fixture"}})).statusCode, 200);
    assert.equal((await app.inject({ url: "/api/v1/me/notification-preferences", method: "PUT",
      headers: { cookie: "scoutops_session=fixture", origin: "https://fixture.invalid", "idempotency-key": "fixture-key" },
      payload: { actorId: "other", user_id: "other" } })).statusCode, 200);
    assert.deepEqual(seen.map(({actorId, accountOwned, organizationId}) => [actorId, accountOwned, organizationId]),
      [["signed-in", true, undefined], ["signed-in", true, undefined]]);
  } finally { await app.close(); }
});

test("0174 creates one account preference and audits it without a fabricated organization", async () => {
  const steps = [];
  const c = { async beginTransaction() {}, async commit() { steps.push("commit"); },
    async rollback() { assert.fail("unexpected rollback"); }, release() {},
    async query(sql, args = []) {
      if (sql.startsWith("SHOW COLUMNS")) return cols;
      if (sql.startsWith("SELECT id FROM users")) {
        assert.deepEqual(args, ["account"]);
        assert.match(sql, /FOR UPDATE$/);
        steps.push("locked");
        return [[{ id: "account" }]];
      }
      if (sql.startsWith("SELECT result_json")) {
        assert.equal(args[1], "PUT:/api/v1/me/notification-preferences#account-v1");
        return [[]];
      }
      if (sql.startsWith("SELECT *")) {
        assert.equal(sql, "SELECT * FROM notification_preferences WHERE user_id=? FOR UPDATE");
        assert.deepEqual(args, ["account"]);
        return [[]];
      }
      assert.equal((sql.match(/\?/g) ?? []).length, args.length);
      if (sql.startsWith("INSERT INTO notification_preferences")) {
        assert.match(sql, /\(id,user_id,/);
        assert.equal(args[1], "account");
        steps.push("preference");
      } else if (sql.startsWith("INSERT INTO platform_audit_events")) {
        assert.match(sql, /VALUES\(\?,NULL,NULL,\?/);
        steps.push("audit");
      } else if (sql.startsWith("INSERT INTO notification_operations")) steps.push("receipt");
      else assert.fail(sql);
      return [[]];
    } };
  const repo = new MySqlNotificationRepository({ query: c.query, getConnection: async () => c });
  const result = await repo.updatePreferences({ actorId: "account", accountOwned: true,
    route: "PUT:/api/v1/me/notification-preferences", idempotencyKey: "key", requestId: "r", traceId: "t",
    value: { expected_version: 1, in_app_enabled: false, email_enabled: false, task_enabled: true, approval_enabled: true, competitor_enabled: true } });
  assert.equal(result.version, 2);
  assert.deepEqual(steps, ["locked","preference","audit","receipt","commit"]);
});

test("0174 worker preferences fall back only for an exact missing legacy field and complete schema", async () => {
  const missing = Object.assign(new Error("missing column"), {code: "ER_BAD_FIELD_ERROR",
    sqlMessage: "Unknown column 'organization_id' in 'where clause'"});
  const db = { async query(sql, args) {
    if (sql.includes("WHERE organization_id")) throw missing;
    if (sql.startsWith("SHOW COLUMNS")) return cols;
    assert.equal(sql, "SELECT * FROM notification_preferences WHERE user_id=?");
    assert.deepEqual(args, ["account"]);
    return [[{ task_enabled: 0 }]];
  } };
  const [[pref]] = await readDeliveryNotificationPreferences(db, "legacy-org", "legacy-space", "account");
  assert.equal(pref.task_enabled, 0);
  await assert.rejects(readDeliveryNotificationPreferences({ async query(sql) {
    if (sql.startsWith("SHOW COLUMNS")) return [[{ Field: "user_id" }]];
    throw missing;
  } }, "legacy-org", "legacy-space", "account"), /schema_not_ready/);
});
