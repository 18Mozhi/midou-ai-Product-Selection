import { PRIMARY_SOURCE_SUPPORT_REVISION } from "../../apps/worker/dist/primary-source-support.js";
import { SUPPLY_DEVICE_FIT_REVISION } from "../../apps/worker/dist/automatic-selection-device-fit-recovery.js";
import assert from "node:assert/strict";
import test from "node:test";
import {
  automaticEvaluationEnqueueUpdateSql,
  automaticEvaluationPendingSql,
  automaticEvaluationCompleteSql,
  automaticEvaluationFailureSql,
} from "../../packages/database/dist/index.js";
import {
  queueAutomaticSelectionEvaluation,
  MySqlAutomaticSelectionEvaluationWorker,
} from "../../apps/worker/dist/automatic-selection-evaluation-worker.js";
import { MySqlProfitRepository } from "../../apps/api/dist/mysql-profit-repository.js";
import { MySqlScoringRepository } from "../../apps/api/dist/mysql-scoring-repository.js";
const now = new Date("2026-10-17T00:00:00.000Z");
const job = {
  opportunityId: "opportunity",
  organizationId: "org",
  workspaceId: "workspace",
  attemptCount: 2,
};
function fixture(row = null) {
  const calls = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
    query: async (sql, params) => {
      calls.push({ sql, params });
      return [row && sql.startsWith("SELECT * FROM automatic_selection_evaluations") ? [row] : []];
    },
  };
  const worker = new MySqlAutomaticSelectionEvaluationWorker(
    { getConnection: async () => connection, query: connection.query },
    "worker",
    "actor",
    120,
    () => now,
  );
  return { calls, connection, worker };
}
test("evidence and both rule producers coalesce a leased wakeup with one shared SQL policy", async () => {
  const f = fixture();
  await queueAutomaticSelectionEvaluation(f.connection, { ...job, now });
  await new MySqlProfitRepository({}).queueAll(f.connection, job, "cost-rule", "US", "amazon", now);
  await new MySqlScoringRepository({}).queueAll(f.connection, job, "score-rule", now);
  const enqueues = f.calls.filter((call) =>
    call.sql.startsWith("INSERT INTO automatic_selection_evaluations"),
  );
  assert.equal(enqueues.length, 3);
  for (const call of enqueues) {
    assert.equal(call.sql.endsWith(automaticEvaluationEnqueueUpdateSql), true);
    assert.match(call.sql, /result_json=IF\(status='leased',JSON_SET/);
    assert.match(call.sql, /status=IF\(status='leased',status,'queued'\)/);
    assert.match(call.sql, /attempt_count=IF\(status='leased',attempt_count,0\)/);
    assert.doesNotMatch(call.sql, /lease_owner=|lease_expires_at=/);
  }
  assert.deepEqual(enqueues[0].params.slice(0, 3), [
    job.opportunityId,
    job.organizationId,
    job.workspaceId,
  ]);
  for (const call of enqueues.slice(1))
    assert.deepEqual(call.params.slice(3, 5), [job.organizationId, job.workspaceId]);
});
for (const status of ["waiting_evidence", "waiting_profit", "succeeded"]) {
  test(`completion ${status} preserves a newer wakeup while clearing lease`, async () => {
    const f = fixture();
    await f.worker.complete(
      f.connection,
      job,
      status,
      "fingerprint",
      { error_code: "pending_fact" },
      now,
    );
    const { sql, params } = f.calls[0];
    assert.equal(sql.includes(`status=IF(${automaticEvaluationPendingSql},'queued',?)`), true);
    assert.equal(
      sql.includes(`available_at=IF(${automaticEvaluationPendingSql},?,available_at)`),
      true,
    );
    assert.match(sql, /lease_owner=NULL/);
    assert.match(sql, /WHERE opportunity_id=\? AND lease_owner=\?/);
    assert.deepEqual(params.slice(0, 3), [status, now, "pending_fact"]);
    assert.deepEqual(params.slice(-2), [job.opportunityId, "worker"]);
    assert.deepEqual(JSON.parse(params[4]), {
      error_code: "pending_fact",
      primary_source_support_revision: PRIMARY_SOURCE_SUPPORT_REVISION,
      supply_device_fit_revision: SUPPLY_DEVICE_FIT_REVISION,
    });
  });
}
for (const status of ["scheduled", "failed_terminal", "dead_letter"]) {
  test(`failed execution ${status} does not discard a newer request or bypass the no-request policy`, async () => {
    const f = fixture();
    await f.worker.finishFailure(job, status, "dependency_failed");
    const { sql, params } = f.calls[0];
    assert.equal(sql.includes(`status=IF(${automaticEvaluationPendingSql},'queued',?)`), true);
    assert.match(sql, /result_json=JSON_REMOVE\(result_json,'\$\.requeue_requested'\)/);
    assert.equal(params[0], status === "scheduled" ? "retry_scheduled" : status);
    assert.equal(params[2].getTime() - now.getTime(), status === "scheduled" ? 300000 : 0);
    assert.deepEqual(params.slice(-2), [job.opportunityId, "worker"]);
  });
}
test("claim consumes an older wakeup only when it actually leases the row", async () => {
  const f = fixture({
    opportunity_id: job.opportunityId,
    organization_id: job.organizationId,
    workspace_id: job.workspaceId,
    attempt_count: 0,
  });
  assert.equal((await f.worker.claim()).opportunityId, job.opportunityId);
  const claim = f.calls.find((call) =>
    call.sql.startsWith("UPDATE automatic_selection_evaluations"),
  );
  assert.match(claim.sql, /result_json=JSON_REMOVE\(result_json,'\$\.requeue_requested'\)/);
  assert.match(claim.sql, /status='leased'/);
  const empty = fixture();
  assert.equal(await empty.worker.claim(), null);
  assert.equal(empty.calls.length, 1);
});

test("terminal statements keep hostile-looking job values in bound parameters", async () => {
  const f = fixture();
  const value = "x'); DROP TABLE automatic_selection_evaluations; --";
  const hostileJob = { ...job, opportunityId: value };
  await f.worker.complete(
    f.connection,
    hostileJob,
    "waiting_evidence",
    value,
    { error_code: value },
    now,
  );
  await f.worker.finishFailure(hostileJob, "scheduled", value);
  for (const [index, expected] of [
    automaticEvaluationCompleteSql,
    automaticEvaluationFailureSql,
  ].entries()) {
    const { sql, params } = f.calls[index];
    assert.equal(sql, expected);
    assert.equal(sql.includes(value), false);
    assert.equal((sql.match(/\?/g) ?? []).length, params.length);
    assert.equal(params.length, index === 0 ? 9 : 7);
    assert.equal(params.at(-2), value);
    assert.equal(params.at(-1), "worker");
    assert.equal(params[index === 0 ? 2 : 3], value);
  }
});
