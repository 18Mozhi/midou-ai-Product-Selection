import assert from "node:assert/strict";
import test from "node:test";
import { NotificationOutboxWorker } from "../../apps/worker/dist/notification-outbox-worker.js";

test("native task deliveries require the exact event and owned assignee inside the lease transaction", async () => {
  for (const mode of ["owned", "foreign", "wrong-contract", "lease-lost"]) {
    const calls = [], now = new Date("2026-10-15T12:00:00Z");
    const event = { id: "event", version: 7, event_type: "task.start", schema_version: 1,
      request_id: "request", trace_id: "trace", payload_json: {
        task_id: "task", assignee_id: mode === "foreign" ? "foreign" : "account",
        task_account_contract: mode === "wrong-contract" ? 24 : 25,
      } };
    const connection = {
      beginTransaction: async () => {}, commit: async () => calls.push("commit"),
      rollback: async () => calls.push("rollback"), release() {},
      async query(sql, args) {
        if (sql.startsWith("SELECT *") && !sql.includes("WHERE id=?")) return [[event]];
        if (sql.startsWith("UPDATE outbox_events SET status='leased'")) return [{}];
        if (sql.startsWith("SELECT *")) {
          assert.deepEqual(args, ["event", 8, now]);
          return [mode === "lease-lost" ? [] : [event]];
        }
        if (sql.startsWith("SELECT t.account_id")) {
          assert.ok(["owned", "foreign"].includes(mode));
          assert.match(sql, /e.id=\? AND e.task_id=t.id/);
          assert.match(sql, /t.account_id=t.assignee_id AND t.assignee_id=\?/);
          assert.match(sql, /BINARY e.event_type=BINARY \? AND BINARY e.request_id=BINARY \? AND BINARY e.trace_id=BINARY \?/);
          assert.deepEqual(args, ["event", "task", event.payload_json.assignee_id, "task.start", "request", "trace"]);
          return [mode === "owned" ? [{ account_id: "account" }] : []];
        }
        if (sql.startsWith("UPDATE outbox_events SET status='published'")) { calls.push("published"); return [{}]; }
        assert.fail(sql);
      },
    };
    const worker = new NotificationOutboxWorker({ getConnection: async () => connection }, 30, 3, () => now);
    worker.create = async (_event, _payload, category, recipient, _now, db) => {
      assert.equal(db, connection); assert.equal(category, "task");
      assert.equal(recipient, "account"); calls.push("notified"); return true;
    };
    const result = await worker.processOnce();
    assert.equal(result.status, mode === "lease-lost" ? "lease_lost" : "published");
    assert.deepEqual(calls, mode === "lease-lost" ? ["commit", "rollback"] :
      ["commit", ...(mode === "owned" ? ["notified"] : []), "published", "commit"]);
  }
});
