import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  assertTaskTransition,
  summarizeCoverage,
  type SubqueryOutcome,
} from "@scoutops/collection-tasks";
import type { ClaimedCollectionTask } from "./collection-task-contracts.js";

const statement = (...parts: string[]) => parts.join("");

export interface CollectionTaskEvidenceContext {
  pool: Pool;
  lock(c: PoolConnection, task: ClaimedCollectionTask): Promise<RowDataPacket>;
  event(
    c: PoolConnection,
    row: RowDataPacket,
    from: string | null,
    to: string,
    actorId: string,
    actorType: string,
    metadata: unknown,
    now: Date,
  ): Promise<unknown>;
  outbox(
    c: PoolConnection,
    row: RowDataPacket,
    eventType: string,
    payload: unknown,
    now: Date,
  ): Promise<unknown>;
}

export async function completeCollectionTask(
  context: CollectionTaskEvidenceContext,

  task: ClaimedCollectionTask,
  outcomes: Array<SubqueryOutcome & { id: string }>,
  now: Date,
) {
  if (
    outcomes.length !== task.subqueries.length ||
    new Set(outcomes.map((item) => item.id)).size !== outcomes.length ||
    outcomes.some((item) => !task.subqueries.some((query) => query.id === item.id))
  )
    throw new Error("collection_subquery_result_mismatch");
  const summary = summarizeCoverage(outcomes),
    c = await context.pool.getConnection();
  try {
    await c.beginTransaction();
    const row = await context.lock(c, task);
    for (const stage of ["parsing", "validating", "persisted"] as const) {
      assertTaskTransition(row.status, stage);
      await c.query(
        "UPDATE collection_tasks SET status=?,version=version+1,updated_at=? WHERE id=?",
        [stage, now, task.id],
      );
      await context.event(c, row, row.status, stage, row.lease_owner, "worker", {}, now);
      row.status = stage;
    }
    for (const outcome of outcomes)
      await c.query(
        statement(
          "UPDATE collection_subqueries SET status=?,available_result_count=?,",
          "missing_fields_json=?,error_code=?,retryable=0,",
          "started_at=COALESCE(started_at,?),finished_at=?,",
          "version=version+1,updated_at=? WHERE id=? AND task_id=?",
        ),
        [
          outcome.status,
          outcome.availableResultCount,
          JSON.stringify(outcome.missingFields),
          outcome.errorCode,
          now,
          now,
          now,
          outcome.id,
          task.id,
        ],
      );
    assertTaskTransition("persisted", summary.terminalStatus);
    await c.query(
      statement(
        "UPDATE collection_tasks SET status=?,coverage_status=?,",
        "successful_subquery_count=?,failed_subquery_count=?,blocked_subquery_count=?,",
        "available_result_count=?,missing_fields_json=?,last_error_code=NULL,",
        "lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,finished_at=?,",
        "version=version+1,updated_at=? WHERE id=?",
      ),
      [
        summary.terminalStatus,
        summary.coverageStatus,
        summary.successfulSubqueryCount,
        summary.failedSubqueryCount,
        summary.blockedSubqueryCount,
        summary.availableResultCount,
        JSON.stringify(summary.missingFields),
        now,
        now,
        task.id,
      ],
    );
    await c.query(
      "UPDATE collection_task_attempts SET status='succeeded',finished_at=? WHERE task_id=? AND attempt_number=?",
      [now, task.id, task.attemptCount],
    );
    await context.event(
      c,
      row,
      "persisted",
      summary.terminalStatus,
      row.lease_owner,
      "worker",
      {
        coverage_status: summary.coverageStatus,
        available_result_count: summary.availableResultCount,
      },
      now,
    );
    await context.outbox(
      c,
      row,
      `collection.task.${summary.terminalStatus}`,
      { task_id: task.id, coverage_status: summary.coverageStatus },
      now,
    );
    await c.query("DELETE FROM crawler_scheduler_leases WHERE task_id=?", [task.id]);
    await c.commit();
    return summary;
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    c.release();
  }
}
