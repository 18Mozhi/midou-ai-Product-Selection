import test from "node:test";
import assert from "node:assert/strict";
import { MySqlNotificationRepository } from "../../apps/api/dist/mysql-notification-repository.js";
import { MySqlRealtimeRepository } from "../../apps/api/dist/mysql-realtime-repository.js";
import { appendScopedNotification } from "../../packages/database/dist/index.js";

const shape = [[{ Field: "recipient_id" }, { Field: "source_event_id" }]];
const actor = {
  accountOwned: true,
  actorId: "login",
  organizationId: "ignored",
  workspaceId: "ignored",
};

test("0176 inbox detail and groups use verified recipient and matching delivered in-app rows", async () => {
  const seen = [];
  const repo = new MySqlNotificationRepository({
    async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS")) return shape;
      assert.doesNotMatch(sql, /organization_id|workspace_id/);
      assert.match(sql, /recipient_id=\?/);
      assert.match(sql, /d\.recipient_id=notifications\.recipient_id/);
      assert.match(sql, /channel='in_app'[\s\S]*status='delivered'/);
      seen.push(args);
      if (sql.startsWith("SELECT COUNT(*) group_count")) return [[{ group_count: 2 }]];
      return args[0] === "mine"
        ? [
            [
              {
                id: "mine",
                category: "task",
                root_cause_key: "topic",
                version: 1,
                resource_type: "task",
                resource_id: "00000000-0000-4000-8000-000000000125",
              },
            ],
          ]
        : [[]];
    },
  });
  const mine = await repo.detail({ ...actor, notificationId: "mine" });
  assert.equal(mine.group_count, 2);
  assert.equal(
    mine.action_route,
    "/tasks/approvals?view=account-tasks&task=00000000-0000-4000-8000-000000000125",
  );
  await assert.rejects(
    repo.detail({ ...actor, notificationId: "other" }),
    /notification_not_found/,
  );
  assert.deepEqual(seen, [
    ["mine", "login"],
    ["login", "topic"],
    ["other", "login"],
  ]);
});

test("0176 checks account schema and replays only the recipient's matching notification cursor", async () => {
  const repo = new MySqlRealtimeRepository({
    async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS FROM realtime_events")) return [[]];
      if (sql.startsWith("SHOW COLUMNS FROM notifications")) return shape;
      assert.match(sql, /n\.recipient_id=r\.recipient_id[\s\S]*r\.recipient_id=\? AND r\.id>\?/);
      assert.match(sql, /d\.notification_id=n\.id.*d\.recipient_id=n\.recipient_id.*d\.channel='in_app' AND d\.status='delivered'/);
      assert.doesNotMatch(sql, /organization_id|workspace_id/);
      assert.deepEqual(args, ["login", 7, 8]);
      return [[]];
    },
  });
  assert.deepEqual(await repo.replay({ ...actor, afterId: 7, limit: 8 }), []);
});

test("account notification replay requires the same currently delivered item and mutation", async () => {
  let receipt, delivered = true, version = 1, updates = 0, audits = 0, rollbacks = 0;
  const c = {
    async beginTransaction() {}, async commit() {}, release() {},
    async rollback() { rollbacks++; },
    async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS")) return shape;
      if (sql.startsWith("SELECT id FROM users")) return [[{id:"login"}]];
      if (sql.startsWith("SELECT * FROM notifications")) {
        assert.deepEqual(args, [args[0], "login"]);
        assert.match(sql, /d\.recipient_id=notifications\.recipient_id.*d\.status='delivered'.*FOR UPDATE/);
        return [delivered ? [{id:args[0],version,workflow_status:"open"}] : []];
      }
      if (sql.startsWith("SELECT result_json")) return [receipt ? [{result_json:receipt}] : []];
      if (sql.startsWith("UPDATE notifications")) { updates++; version++; }
      else if (sql.startsWith("INSERT INTO platform_audit_events")) audits++;
      else if (sql.startsWith("INSERT INTO notification_operations")) receipt=args[5];
      else assert.fail(sql);
      return [{affectedRows:1}];
    },
  };
  const repo = new MySqlNotificationRepository({async getConnection(){return c;}}, () => new Date(0));
  const input = {...actor,route:"notification-action",idempotencyKey:"key",notificationId:"mine",
    value:{action:"read",expected_version:1}};
  const original=await repo.action(input);
  assert.equal(original.version,2);
  assert.deepEqual(await repo.action(input),original);
  await assert.rejects(repo.action({...input,notificationId:"another"}),{code:"notification_idempotency_conflict"});
  await assert.rejects(repo.action({...input,value:{action:"unread",expected_version:1}}),{code:"notification_idempotency_conflict"});
  await assert.rejects(repo.action({...input,value:{action:"read",expected_version:2}}),{code:"notification_idempotency_conflict"});
  delivered=false;
  await assert.rejects(repo.action(input),{code:"notification_not_found"});
  assert.deepEqual({updates,audits,rollbacks},{updates:1,audits:1,rollbacks:4});
});

test("0176 retains original event and recipient, rejecting mismatched or incomplete lineage", async () => {
  const sql =
    "INSERT IGNORE INTO notifications (id,organization_id,workspace_id,recipient_id,source_event_id) VALUES (?,?,?,?,?)";
  const input = ["notification", "org", "ws", "login", "event"];
  const missing = Object.assign(new Error("legacy field removed"), {
    code: "ER_BAD_FIELD_ERROR",
    sqlMessage: "Unknown column 'organization_id' in 'field list'",
  });
  const calls = [];
  let parent = [{ id: "event" }];
  const db = {
    async query(query, args) {
      if (query === sql) throw missing;
      if (query.startsWith("SHOW COLUMNS")) return shape;
      if (query.startsWith("SELECT id FROM outbox_events")) {
        assert.deepEqual(args, ["event", "org", "ws"]);
        return [parent];
      }
      calls.push([query, args]);
      return [[]];
    },
  };
  await appendScopedNotification(db, sql, input);
  parent = [];
  await assert.rejects(
    appendScopedNotification(db, sql, input),
    /notification_parent_scope_mismatch/,
  );
  assert.deepEqual(calls, [
    [
      "INSERT IGNORE INTO notifications (id,recipient_id,source_event_id) VALUES (?,?,?)",
      ["notification", "login", "event"],
    ],
  ]);
});

test("0176 mark-all binds to the logged-in recipient and replays its receipt without a second update", async () => {
  const steps = [];
  const now = new Date("2026-10-15T00:00:00Z");
  let receipt;
  const c = {
    async beginTransaction() {},
    async commit() {
      steps.push("commit");
    },
    async rollback() {
      assert.fail("unexpected rollback");
    },
    release() {},
    async query(sql, args) {
      if (sql.startsWith("SHOW COLUMNS")) return shape;
      if (sql.startsWith("SELECT id FROM users")) {
        assert.deepEqual(args, ["login"]);
        assert.match(sql, /FOR UPDATE$/);
        return [[{ id: "login" }]];
      }
      if (sql.startsWith("SELECT result_json")) {
        assert.deepEqual(args, ["login", "POST:/api/v1/notifications/actions#account-v1", "key"]);
        return [[...(receipt ? [{ result_json: receipt }] : [])]];
      }
      if (sql.startsWith("UPDATE notifications")) {
        assert.doesNotMatch(sql, /organization_id|workspace_id/);
        assert.match(sql, /recipient_id=\?[\s\S]*d\.recipient_id=notifications\.recipient_id/);
        assert.deepEqual(args, [now, now, "login"]);
        steps.push("update");
        return [{ affectedRows: 2 }];
      }
      if (sql.startsWith("INSERT INTO platform_audit_events")) steps.push("audit");
      else if (sql.startsWith("INSERT INTO notification_operations")) {
        assert.equal(args[1], "login");
        receipt = args[5];
        steps.push("receipt");
      } else assert.fail(sql);
      return [[]];
    },
  };
  const repo = new MySqlNotificationRepository(
    {
      async getConnection() {
        return c;
      },
    },
    () => now,
  );
  const input = { ...actor, route: "POST:/api/v1/notifications/actions", idempotencyKey: "key" };
  const first = await repo.markAll(input);
  assert.equal(first.updated, 2);
  assert.deepEqual(await repo.markAll(input), first);
  assert.deepEqual(steps, ["update", "audit", "receipt", "commit", "commit"]);
});

test("0196 account notifications require an owned live event without reading archived coordinates", async () => {
  const sql =
    "INSERT IGNORE INTO notifications (id,organization_id,workspace_id,recipient_id,source_event_id) VALUES (?,?,?,?,?)";
  let owned = false,
    inserted = 0;
  const db = {
    async query(query, args) {
      if (query === sql)
        throw Object.assign(new Error(), {
          code: "ER_BAD_FIELD_ERROR",
          sqlMessage: "Unknown column 'organization_id' in 'field list'",
        });
      if (query.startsWith("SHOW COLUMNS")) return shape;
      if (query.startsWith("SELECT e.id FROM outbox_events")) {
        assert.match(query, /owner.source_id=e.id.*cut.contract_version=25/s);
        assert.doesNotMatch(query, /legacy_org_id|organization_id|outbox_event_scope_history/);
        assert.deepEqual(args, ["event"]);
        return [owned ? [{ id: "event" }] : []];
      }
      assert.deepEqual(args, ["notification", "login", "event"]);
      inserted++;
      return [[]];
    },
  };
  const values = ["notification", null, null, "login", "event"];
  await assert.rejects(
    appendScopedNotification(db, sql, values),
    /notification_parent_scope_mismatch/,
  );
  owned = true;
  await appendScopedNotification(db, sql, values);
  assert.equal(inserted, 1);
});
