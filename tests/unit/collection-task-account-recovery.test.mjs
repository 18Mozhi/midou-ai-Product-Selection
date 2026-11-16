import test from "node:test";
import assert from "node:assert/strict";
import { recoverExpiredCollectionTasks } from "../../apps/worker/dist/collection-task-dead-letter.js";

const now = new Date("2026-11-15T00:00:00Z");

for (const kind of ["legacy", "account"]) {
  test(`recovery uses locked ${kind} ownership without changing retry and overflow behavior`, async () => {
    const expired = { id: "expired", status: "running", attempt_count: 1, request_id: "req-1", trace_id: "trace-1" };
    const overflow = { id: "overflow", status: "queued", attempt_count: 4, request_id: "req-2", trace_id: "trace-2" };
    const drifted = { ...expired, id: "drifted" };
    for (const row of [expired, overflow, drifted]) {
      Object.assign(row, kind === "account" ? { account_id: "account-1" } : { organization_id: "org-1", workspace_id: "ws-1" });
    }
    const seen = [];
    const connection = {
      beginTransaction: async () => seen.push("begin"),
      commit: async () => seen.push("commit"),
      rollback: async () => seen.push("rollback"),
      release: () => seen.push("release"),
      query: async (sql, args) => {
        if (sql.startsWith("SHOW COLUMNS")) return [(kind === "account" ? ["account_id"] : ["organization_id", "workspace_id"]).map(Field => ({ Field }))];
        if (sql.startsWith("SELECT * FROM collection_tasks WHERE status IN")) return [[expired, drifted]];
        if (sql.startsWith("SELECT * FROM collection_tasks WHERE status='queued'")) return [[overflow]];
        if (sql.endsWith("FOR UPDATE")) {
          const row = [expired, overflow, drifted].find(item => item.id === args[0]);
          if (kind === "account") {
            assert.doesNotMatch(sql, /organization_id|workspace_id/);
            assert.match(sql, /account_id=\?/);
            assert.match(sql, /LOCK IN SHARE MODE/);
            assert.deepEqual(args.slice(0, 2), [row.id, "account-1"]);
          } else {
            assert.match(sql, /organization_id=\? AND workspace_id=\?/);
            assert.deepEqual(args.slice(0, 3), [row.id, "org-1", "ws-1"]);
          }
          if (row !== overflow) assert.equal(args.at(-1), now);
          return [row === drifted ? [] : [row]];
        }
        if (sql.startsWith("SELECT id FROM collection_task_attempts")) return [[{ id: "attempt-4" }]];
        if (sql.startsWith("UPDATE collection_tasks SET status=?,"))
          seen.push(["retry", args[0], args[1].toISOString(), args.at(-1)]);
        else if (sql.startsWith("UPDATE collection_tasks SET status='dead_letter'"))
          seen.push(["overflow", args.at(-1)]);
        else if (sql.startsWith("INSERT INTO collection_dead_letters"))
          seen.push(["dead-letter", args[1], args[2], args[3], args[5], args[6]]);
        else if (sql.startsWith("DELETE FROM crawler_scheduler_leases")) seen.push(["release-lease", args[0]]);
        else assert.match(sql, /^UPDATE collection_task_attempts/);
        return [[]];
      },
    };
    const recovered = await recoverExpiredCollectionTasks({
      pool: { getConnection: async () => connection },
      random: () => 0,
      event: async (_c, row, from, to) => seen.push(["event", row.id, from, to, row.trace_id]),
      outbox: async (_c, row, type) => seen.push(["outbox", row.id, type, row.request_id]),
    }, now);
    assert.equal(recovered, 2);
    assert.deepEqual(seen, [
      "begin",
      ["retry", "retry_scheduled", "2026-11-15T00:01:00.000Z", "expired"],
      ["event", "expired", "running", "retry_scheduled", "trace-1"],
      ["outbox", "expired", "collection.task.retry_scheduled", "req-1"],
      ["release-lease", "expired"],
      ["overflow", "overflow"],
      ["dead-letter", "overflow", "attempt-4", "collection_attempt_overflow", "req-2", "trace-2"],
      ["event", "overflow", "queued", "dead_letter", "trace-2"],
      ["outbox", "overflow", "collection.task.dead_letter", "req-2"],
      ["release-lease", "overflow"],
      "commit", "release",
    ]);
  });
}
