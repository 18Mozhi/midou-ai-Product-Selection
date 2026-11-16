import assert from "node:assert/strict";
import test from "node:test";
import { NotificationOutboxWorker } from "../../apps/worker/dist/notification-outbox-worker.js";

test("0196 publishes to the original named recipient using their account preferences and no scope columns", async () => {
  const now = new Date("2026-11-14T01:00:00Z");
  const recipient = "named-original-owner",
    writes = [];
  const payload = {
    resource_type: "automation_rule",
    resource_id: "rule",
    automation_execution_id: "job",
    recipient_id: recipient,
    title: "Original title",
    automation_account_contract: 25,
  };
  const event = {
    id: "event",
    version: 1,
    schema_version: 1,
    event_type: "automation.notification.queued",
    created_at: now,
    request_id: "request",
    trace_id: "trace",
    payload_json: payload,
  };
  const c = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {
      assert.fail("unexpected rollback");
    },
    release() {},
    async query(sql, args = []) {
      assert.equal((sql.match(/\?/g) ?? []).length, args.length);
      if (sql.startsWith("SELECT * FROM outbox_events")) return [[event]];
      if (sql.startsWith("SELECT u.id recipient_id")) return [[{ recipient_id: recipient }]];
      if (sql.startsWith("SHOW COLUMNS FROM notification_preferences"))
        return [[{ Field: "user_id" }, { Field: "historical_context" }]];
      if (sql.startsWith("SELECT * FROM notification_preferences")) {
        assert.equal(sql, "SELECT * FROM notification_preferences WHERE user_id=?");
        assert.deepEqual(args, [recipient]);
        return [[{ system_enabled: 1, in_app_enabled: 1, email_enabled: 0 }]];
      }
      if (sql.startsWith("SHOW COLUMNS FROM notifications"))
        return [[{ Field: "recipient_id" }, { Field: "source_event_id" }]];
      if (/^SHOW COLUMNS FROM (notification_deliveries|realtime_events)/.test(sql)) return [[]];
      if (sql.startsWith("SELECT e.id FROM outbox_events")) return [[{ id: event.id }]];
      if (sql.startsWith("SELECT id FROM notifications")) {
        assert.deepEqual(args, ["event", recipient]);
        return [[{ id: "owned-notification" }]];
      }
      if (sql.startsWith("INSERT IGNORE INTO notifications") && sql.includes("organization_id"))
        throw Object.assign(new Error("old insert"), {
          code: "ER_BAD_FIELD_ERROR",
          sqlMessage: "Unknown column 'organization_id' in 'field list'",
        });
      if (sql.startsWith("INSERT ")) writes.push([sql, args]);
      else assert.match(sql, /^UPDATE outbox_events SET status='(?:leased|published)'/);
      return [{ affectedRows: 1 }];
    },
  };
  const result = await new NotificationOutboxWorker(
    {
      async getConnection() {
        return c;
      },
    },
    30,
    4,
    () => now,
  ).processOnce();
  assert.deepEqual(result, { status: "published", event_id: "event", notifications: 1 });
  assert.equal(writes.length, 4);
  for (const [sql, args] of writes) {
    assert.doesNotMatch(sql, /organization_id|workspace_id/);
    assert.ok(args.includes(recipient));
  }
  assert.deepEqual(writes[0][1].slice(1, 6), [
    recipient,
    "event",
    "system",
    "info",
    "Original title",
  ]);
  assert.equal(writes[2][1][3], "delivered");
  assert.equal(writes[3][1][3], "suppressed");
});

for (const mode of ["owned", "foreign", "historical-unmarked", "bad-contract", "lost-lease"]) {
  test(`native automation notification guards the exact successful action: ${mode}`, async () => {
    const now = new Date("2026-11-14T01:00:00Z"),
      log = [];
    const payload = {
      resource_type: "automation_rule",
      resource_id: "rule",
      automation_execution_id: "execution",
      recipient_id: mode === "foreign" ? "other" : "original-operator",
      title: "Preserved title",
      ...(mode === "historical-unmarked"
        ? {}
        : { automation_account_contract: mode === "bad-contract" ? 24 : 25 }),
    };
    const event = {
      id: "event",
      version: 1,
      schema_version: 1,
      event_type: "automation.notification.queued",
      created_at: now,
      request_id: "request",
      trace_id: "trace",
      payload_json: payload,
    };
    const c = {
      async beginTransaction() {},
      async commit() {
        log.push("commit");
      },
      async rollback() {
        log.push("rollback");
      },
      release() {},
      async query(sql, args) {
        if (sql.startsWith("SELECT * FROM outbox_events WHERE id=")) {
          assert.deepEqual(args, ["event", 2, now]);
          return [mode === "lost-lease" ? [] : [event]];
        }
        if (sql.startsWith("SELECT * FROM outbox_events")) return [[event]];
        if (sql.startsWith("UPDATE outbox_events SET status='leased'")) return [{}];
        if (sql.startsWith("SELECT u.id recipient_id")) {
          assert.ok(["owned", "foreign"].includes(mode));
          assert.match(sql, /r\.owner_id=\?/);
          assert.match(sql, /delivery_owner\.account_id=r\.account_id/);
          assert.match(sql, /x\.status='succeeded'[\s\S]+x\.action_resource_id=\?/);
          assert.match(sql, /BINARY x\.request_id=BINARY \? AND BINARY x\.trace_id=BINARY \?/);
          assert.deepEqual(args, [
            payload.recipient_id,
            now,
            "event",
            "execution",
            "rule",
            "event",
            "request",
            "trace",
          ]);
          log.push("proof");
          return [mode === "owned" ? [{ recipient_id: "original-operator" }] : []];
        }
        if (sql.startsWith("UPDATE outbox_events SET status='published'")) {
          log.push("published");
          return [{}];
        }
        assert.fail(sql);
      },
    };
    const worker = new NotificationOutboxWorker(
      {
        async getConnection() {
          return c;
        },
      },
      30,
      4,
      () => now,
    );
    worker.create = async (_event, originalPayload, category, recipient, _now, db) => {
      assert.equal(db, c);
      assert.equal(originalPayload.title, "Preserved title");
      assert.equal(category, "system");
      assert.equal(recipient, "original-operator");
      log.push("notification");
      return true;
    };
    const result = await worker.processOnce();
    assert.equal(result.status, mode === "lost-lease" ? "lease_lost" : "published");
    assert.deepEqual(
      log,
      mode === "lost-lease"
        ? ["commit", "rollback"]
        : [
            "commit",
            ...(["owned", "foreign"].includes(mode) ? ["proof"] : []),
            ...(mode === "owned" ? ["notification"] : []),
            "published",
            "commit",
          ],
    );
  });
}
