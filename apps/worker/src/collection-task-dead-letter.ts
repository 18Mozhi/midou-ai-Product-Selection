import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  assertTaskTransition,
  classifyCollectionFailure,
  retryAvailableAt,
} from "@scoutops/collection-tasks";
import {
  CollectionExecutionError,
  type ClaimedCollectionTask,
} from "./collection-task-contracts.js";

const statement = (...parts: string[]) => parts.join("");

export interface CollectionTaskDeadLetterContext {
  pool: Pool;
  random: () => number;
  taskId: string | undefined;
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

export async function recoverExpiredCollectionTasks(
  context: CollectionTaskDeadLetterContext,
  now: Date,
  actorId = "collection-scheduler",
) {
  const c = await context.pool.getConnection();
  let recovered = 0;
  try {
    await c.beginTransaction();
    const sql =
        "SELECT * FROM collection_tasks WHERE status IN ('leased','running') AND lease_expires_at<=?" +
        (context.taskId ? " AND id=?" : "") +
        " FOR UPDATE",
      [rows] = await c.query<RowDataPacket[]>(sql, context.taskId ? [now, context.taskId] : [now]);
    for (const row of rows) {
      const classification = classifyCollectionFailure("timeout", Number(row.attempt_count)),
        next =
          classification.status === "retry_scheduled"
            ? retryAvailableAt(Number(row.attempt_count), now, context.random())
            : now;
      await c.query(
        statement(
          "UPDATE collection_tasks SET status=?,available_at=?,lease_owner=NULL,",
          "lease_token_hash=NULL,lease_expires_at=NULL,last_error_code=?,",
          "finished_at=?,version=version+1,updated_at=? WHERE id=?",
        ),
        [
          classification.status,
          next,
          "timeout",
          classification.status === "retry_scheduled" ? null : now,
          now,
          row.id,
        ],
      );
      await c.query(
        "UPDATE collection_task_attempts SET status=?,error_code=?,finished_at=? WHERE task_id=? AND attempt_number=?",
        [classification.status, "timeout", now, row.id, row.attempt_count],
      );
      if (classification.status === "dead_letter")
        await writeCollectionDeadLetter(c, row, "timeout", now);
      await context.event(
        c,
        row,
        row.status,
        classification.status,
        actorId,
        "system",
        { error_code: "timeout", lease_recovered: true },
        now,
      );
      await context.outbox(
        c,
        row,
        `collection.task.${classification.status}`,
        { task_id: row.id, error_code: "timeout" },
        now,
      );
      await c.query("DELETE FROM crawler_scheduler_leases WHERE task_id=?", [row.id]);
      recovered += 1;
    }
    const overflowSql =
        "SELECT * FROM collection_tasks WHERE status='queued' AND attempt_count>=4" +
        (context.taskId ? " AND id=?" : "") +
        " ORDER BY FIELD(priority,'critical','high','normal','low'),available_at,id LIMIT 100 FOR UPDATE",
      [overflowRows] = await c.query<RowDataPacket[]>(
        overflowSql,
        context.taskId ? [context.taskId] : [],
      );
    for (const row of overflowRows) {
      await c.query(
        statement(
          "UPDATE collection_tasks SET status='dead_letter',lease_owner=NULL,",
          "lease_token_hash=NULL,lease_expires_at=NULL,",
          "last_error_code='collection_attempt_overflow',finished_at=?,",
          "version=version+1,updated_at=? WHERE id=?",
        ),
        [now, now, row.id],
      );
      await writeCollectionDeadLetter(c, row, "collection_attempt_overflow", now);
      await context.event(
        c,
        row,
        "queued",
        "dead_letter",
        actorId,
        "system",
        { error_code: "collection_attempt_overflow", retry_exhausted: true },
        now,
      );
      await context.outbox(
        c,
        row,
        "collection.task.dead_letter",
        { task_id: row.id, error_code: "collection_attempt_overflow", retry_exhausted: true },
        now,
      );
      await c.query("DELETE FROM crawler_scheduler_leases WHERE task_id=?", [row.id]);
      recovered += 1;
    }
    await c.commit();
    return recovered;
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    c.release();
  }
}

export async function failCollectionTask(
  context: CollectionTaskDeadLetterContext,
  task: ClaimedCollectionTask,
  error: CollectionExecutionError,
  now: Date,
) {
  const classification = classifyCollectionFailure(error.code, task.attemptCount),
    c = await context.pool.getConnection();
  try {
    await c.beginTransaction();
    const row = await context.lock(c, task);
    let available = now;
    if (classification.status === "retry_scheduled")
      available = retryAvailableAt(task.attemptCount, now, context.random());
    else if (classification.status === "rate_limited") {
      if (!error.rateLimitResetAt || error.rateLimitResetAt <= now)
        throw new Error("collection_rate_limit_reset_required");
      available = error.rateLimitResetAt;
    }
    assertTaskTransition(row.status, classification.status);
    await c.query(
      statement(
        "UPDATE collection_tasks SET status=?,available_at=?,rate_limit_reset_at=?,",
        "last_error_code=?,lease_owner=NULL,lease_token_hash=NULL,",
        "lease_expires_at=NULL,finished_at=?,version=version+1,updated_at=? ",
        "WHERE id=?",
      ),
      [
        classification.status,
        available,
        classification.status === "rate_limited" ? available : null,
        error.code,
        classification.status === "retry_scheduled" || classification.status === "rate_limited"
          ? null
          : now,
        now,
        task.id,
      ],
    );
    await c.query(
      "UPDATE collection_task_attempts SET status=?,error_code=?,finished_at=? WHERE task_id=? AND attempt_number=?",
      [classification.status, error.code, now, task.id, task.attemptCount],
    );
    if (classification.status === "dead_letter")
      await writeCollectionDeadLetter(c, row, error.code, now);
    await context.event(
      c,
      row,
      row.status,
      classification.status,
      row.lease_owner,
      "worker",
      { error_code: error.code, retryable: classification.retryable },
      now,
    );
    await context.outbox(
      c,
      row,
      `collection.task.${classification.status}`,
      { task_id: task.id, error_code: error.code },
      now,
    );
    await c.query("DELETE FROM crawler_scheduler_leases WHERE task_id=?", [task.id]);
    await c.commit();
    return classification;
  } catch (caught) {
    await c.rollback();
    throw caught;
  } finally {
    c.release();
  }
}

export async function writeCollectionDeadLetter(
  c: PoolConnection,
  row: RowDataPacket,
  errorCode: string,
  now: Date,
) {
  const [attempts] = await c.query<RowDataPacket[]>(
    "SELECT id FROM collection_task_attempts WHERE task_id=? AND attempt_number=?",
    [row.id, row.attempt_count],
  );
  await c.query(
    statement(
      "INSERT INTO collection_dead_letters ",
      "(id,task_id,attempt_id,organization_id,workspace_id,error_code,",
      "failure_summary_json,status,replayed_by,replay_reason,replayed_at,",
      "request_id,trace_id,created_at) ",
      "VALUES (?,?,?,?,?,?,?,'open',NULL,NULL,NULL,?,?,?) ",
      "ON DUPLICATE KEY UPDATE error_code=VALUES(error_code),",
      "failure_summary_json=VALUES(failure_summary_json),",
      "request_id=VALUES(request_id),trace_id=VALUES(trace_id)",
    ),
    [
      randomUUID(),
      row.id,
      attempts[0]!.id,
      row.organization_id,
      row.workspace_id,
      errorCode,
      JSON.stringify({ attempt_count: Number(row.attempt_count), error_code: errorCode }),
      row.request_id,
      row.trace_id,
      now,
    ],
  );
}
