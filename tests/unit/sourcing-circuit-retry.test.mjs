import test from "node:test";
import assert from "node:assert/strict";
import { TrendProjectionPersistence } from "../../apps/worker/dist/trend-projection-persistence.js";
import {
  recoverCircuitHeldSourcing,
  recoveredSourcingCandidateSql,
} from "../../apps/worker/dist/automatic-sourcing-retry-policy.js";

const row = {
  search_id: "search",
  organization_id: "org",
  workspace_id: "ws",
  previous_task_id: "old",
  opportunity_id: "product",
  created_by: "actor",
  provider_id: "lan",
  name: "Kitchen rack",
  recovered_at: new Date(),
};
function fixture(options = {}) {
  const calls = [],
    scheduled = [];
  const connection = {
    beginTransaction: async () => calls.push("begin"),
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback"),
    release: () => calls.push("release"),
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT collection_task_id"))
        return [[{ collection_task_id: options.changedTask ? "newer" : "old" }]];
      if (sql.startsWith("SELECT ss.id")) return [options.lostEligibility ? [] : [row]];
      if (sql.startsWith("SELECT COALESCE"))
        return [
          [
            {
              image_url: options.badImage
                ? "https://example.com/unrelated.jpg"
                : "https://m.media-amazon.com/images/I/primary.jpg",
            },
          ],
        ];
      if (sql.startsWith("UPDATE sourcing_searches"))
        return [{ affectedRows: options.failedLink ? 0 : 1 }];
      if (sql.startsWith("INSERT INTO sourcing_events")) {
        if (options.auditFailed) throw Error("audit failed");
        return [{ affectedRows: 1 }];
      }
      throw Error("unexpected SQL");
    },
  };
  const pool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return [options.idle ? [] : [row]];
    },
    getConnection: async () => connection,
  };
  const schedule = async (...args) => {
    scheduled.push(args);
    if (options.queueFailed) throw Error("queue failed");
  };
  return {
    pool,
    calls,
    scheduled,
    run: () => recoverCircuitHeldSourcing(pool, schedule, new Date("2026-10-18T08:00:00Z")),
  };
}
test("recovered circuit sourcing replaces only the search link, schedules existing contract and audits old task", async () => {
  const f = fixture();
  assert.equal(await f.run(), true);
  assert.equal(f.scheduled.length, 1);
  const [, scheduledRow, taskId, target, requestId, traceId] = f.scheduled[0];
  assert.equal(scheduledRow.previous_task_id, "old");
  assert.notEqual(taskId, "old");
  assert.deepEqual(target, {
    query: "Kitchen rack",
    image_url: "https://m.media-amazon.com/images/I/primary.jpg",
    query_contract: "supplier-keywords-v2",
    projection_type: "sourcing_search",
    search_id: "search",
  });
  const update = f.calls.find((x) => x.sql?.startsWith("UPDATE sourcing_searches"));
  assert.deepEqual(update.params.slice(2), ["search", "org", "ws", "old"]);
  const audit = f.calls.find((x) => x.sql?.startsWith("INSERT INTO sourcing_events"));
  assert.equal(JSON.parse(audit.params[4]).previous_task_id, "old");
  assert.deepEqual(audit.params.slice(5, 7), [requestId, traceId]);
  assert.deepEqual(f.calls.slice(-2), ["commit", "release"]);
  assert.equal(f.calls.filter((x) => x.sql?.includes("FOR UPDATE")).length, 1);
  assert.match(
    f.calls.find((x) => x.sql?.includes("FOR UPDATE")).sql,
    /WHERE id=\? AND organization_id=\? AND workspace_id=\?/,
  );
  assert.equal(
    f.calls.some((x) => x.sql?.startsWith("UPDATE collection_tasks")),
    false,
  );
});

test("trend persistence serves a recovered search through the required existing producer before the broad repair", async () => {
  const f = fixture();
  const worker = new TrendProjectionPersistence(f.pool, "worker", () => new Date());
  const tasks = [];
  worker.scheduleCoreCollection = async (...args) => tasks.push(args);
  await worker.enqueueMissingAutomaticDownstream();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0][3][0].required, true);
  assert.equal(tasks[0][3][0].providerId, "lan");
  assert.equal(tasks[0][4], "sourcing.collection.auto_scheduled");
  assert.equal(
    f.calls.some((x) => x.sql?.startsWith("SELECT o.id opportunity_id")),
    false,
  );
});
for (const option of ["idle", "changedTask", "lostEligibility", "badImage"])
  test(`sourcing retry does no work after ${option}`, async () => {
    const f = fixture({ [option]: true });
    assert.equal(await f.run(), false);
    assert.equal(f.scheduled.length, 0);
    assert.equal(
      f.calls.some((x) => x.sql?.startsWith("UPDATE")),
      false,
    );
  });
for (const option of ["queueFailed", "failedLink", "auditFailed"])
  test(`sourcing retry rolls back ${option}`, async () => {
    const f = fixture({ [option]: true });
    await assert.rejects(f.run());
    assert.deepEqual(f.calls.slice(-2), ["rollback", "release"]);
    assert.equal(f.calls.includes("commit"), false);
  });
test("candidate policy requires scoped automatic provenance, zero evidence and recovery after the old failure", () => {
  assert.match(recoveredSourcingCandidateSql, /rc\.state='closed'/);
  assert.match(recoveredSourcingCandidateSql, /rc\.recovered_at>q\.updated_at/);
  assert.match(recoveredSourcingCandidateSql, /q\.error_code='source_circuit_open'/);
  assert.match(recoveredSourcingCandidateSql, /t\.status='completed_with_warnings'/);
  assert.match(recoveredSourcingCandidateSql, /ss\.candidate_count=0/);
  assert.match(recoveredSourcingCandidateSql, /NOT EXISTS \(SELECT 1 FROM sourcing_candidates/);
  assert.match(recoveredSourcingCandidateSql, /auto_event\.actor_type='worker'/);
  assert.match(
    recoveredSourcingCandidateSql,
    /auto_event\.event_type='sourcing\.collection\.auto_scheduled'/,
  );
  assert.match(recoveredSourcingCandidateSql, /org\.status='active'/);
  assert.match(recoveredSourcingCandidateSql, /ws\.organization_id=ss\.organization_id/);
  assert.match(recoveredSourcingCandidateSql, /p\.terms_expires_at>\?/);
  assert.doesNotMatch(recoveredSourcingCandidateSql, /FOR UPDATE/);
});
