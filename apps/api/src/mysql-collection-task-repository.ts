import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  CollectionTaskDetail,
  CollectionTaskRepository,
  CollectionTaskSummary,
} from "./collection-task-service.js";
import { CollectionTaskServiceError } from "./collection-task-service.js";
const json = (value: unknown): any => (typeof value === "string" ? JSON.parse(value) : value);
const iso = (value: unknown) =>
  value == null ? null : new Date(value as string | Date).toISOString();
const task = (row: RowDataPacket): CollectionTaskSummary => ({
  id: String(row.id),
  organization_id: String(row.organization_id),
  workspace_id: String(row.workspace_id),
  status: row.status,
  coverage_status: row.coverage_status,
  priority: row.priority,
  scheduled_at: iso(row.scheduled_at)!,
  available_at: iso(row.available_at)!,
  attempt_count: Number(row.attempt_count),
  successful_subquery_count: Number(row.successful_subquery_count),
  failed_subquery_count: Number(row.failed_subquery_count),
  blocked_subquery_count: Number(row.blocked_subquery_count),
  available_result_count: Number(row.available_result_count),
  missing_fields: json(row.missing_fields_json) ?? [],
  last_error_code: row.last_error_code == null ? null : String(row.last_error_code),
  replay_of_task_id: row.replay_of_task_id == null ? null : String(row.replay_of_task_id),
  replay_reason: row.replay_reason == null ? null : String(row.replay_reason),
  request_id: String(row.request_id),
  trace_id: String(row.trace_id),
  version: Number(row.version),
  created_at: iso(row.created_at)!,
  updated_at: iso(row.updated_at)!,
});
export class MySqlCollectionTaskRepository implements CollectionTaskRepository {
  constructor(private readonly pool: Pool) {}
  async list(input: Parameters<CollectionTaskRepository["list"]>[0]) {
    const where: string[] = [];
    const values: unknown[] = [];
    if (input.organizationId) {
      where.push("organization_id=?");
      values.push(input.organizationId);
    }
    if (input.workspaceId) {
      where.push("workspace_id=?");
      values.push(input.workspaceId);
    }
    if (input.status) {
      where.push("status=?");
      values.push(input.status);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [[count], [rows]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) total FROM collection_tasks ${clause}`,
        values,
      ),
      this.pool.query<RowDataPacket[]>(
        `SELECT * FROM collection_tasks ${clause} ORDER BY FIELD(priority,'critical','high','normal','low'),updated_at DESC,id DESC LIMIT ? OFFSET ?`,
        [...values, input.pageSize, (input.page - 1) * input.pageSize],
      ),
    ]);
    return { items: rows.map(task), total: Number(count[0]?.total ?? 0) };
  }
  async detail(id: string) {
    return this.readDetail(this.pool, id);
  }
  async replay(input: Parameters<CollectionTaskRepository["replay"]>[0]) {
    const c = await this.pool.getConnection(),
      route = `/platform/collection/tasks/${input.taskId}/replay`;
    try {
      await c.beginTransaction();
      const [ops] = await c.query<RowDataPacket[]>(
        "SELECT result_task_id FROM collection_task_operations WHERE actor_id=? AND route=? AND idempotency_key=? LIMIT 1",
        [input.actorId, route, input.idempotencyKey],
      );
      if (ops[0]) {
        await c.commit();
        return (await this.readDetail(this.pool, String(ops[0].result_task_id)))!;
      }
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM collection_tasks WHERE id=? FOR UPDATE",
        [input.taskId],
      );
      const source = rows[0];
      if (!source)
        throw new CollectionTaskServiceError(
          "collection_task_not_found",
          404,
          "刷新采集任务列表。",
        );
      if (source.status !== "dead_letter")
        throw new CollectionTaskServiceError(
          "collection_replay_not_allowed",
          409,
          "只有 dead_letter 任务可以人工重放。",
        );
      const [subqueries] = await c.query<RowDataPacket[]>(
        "SELECT * FROM collection_subqueries WHERE task_id=? ORDER BY ordinal",
        [input.taskId],
      );
      if (!subqueries.length)
        throw new CollectionTaskServiceError(
          "collection_subqueries_missing",
          409,
          "修复原任务子查询后再重放。",
        );
      await c.query(
        "INSERT INTO collection_tasks (id,organization_id,workspace_id,status,coverage_status," +
          "priority,scheduled_at,available_at,leased_at,lease_owner,lease_token_hash," +
          "lease_expires_at,started_at,finished_at,attempt_count,successful_subquery_count," +
          "failed_subquery_count,blocked_subquery_count,available_result_count,missing_fields_json," +
          "last_error_code,rate_limit_reset_at,replay_of_task_id,replay_reason,request_id," +
          "trace_id,version,created_by,created_at,updated_at) VALUES (?,?,?,'scheduled'," +
          "NULL,?,?,?,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,0,'[]',NULL,NULL,?,?,?," +
          " ?,1,?,?,?)",
        [
          input.newTaskId,
          source.organization_id,
          source.workspace_id,
          source.priority,
          input.now,
          input.now,
          input.taskId,
          input.reason,
          input.requestId,
          input.traceId,
          input.actorId,
          input.now,
          input.now,
        ],
      );
      for (const row of subqueries)
        await c.query(
          "INSERT INTO collection_subqueries (id,task_id,organization_id,workspace_id," +
            "provider_id,ordinal,target_json,is_required,status,available_result_count," +
            "missing_fields_json,error_code,retryable,started_at,finished_at,version," +
            "created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'pending',0,'[]',NULL,0,NULL," +
            "NULL,1,?,?)",
          [
            randomUUID(),
            input.newTaskId,
            source.organization_id,
            source.workspace_id,
            row.provider_id,
            row.ordinal,
            JSON.stringify(json(row.target_json)),
            row.is_required,
            input.now,
            input.now,
          ],
        );
      await c.query(
        "UPDATE collection_tasks SET status='manually_replayed',version=version+1,updated_at=? WHERE id=?",
        [input.now, input.taskId],
      );
      await c.query(
        "UPDATE collection_dead_letters SET status='replayed',replayed_by=?,replay_reason=?," +
          "replayed_at=? WHERE task_id=? AND status='open'",
        [input.actorId, input.reason, input.now, input.taskId],
      );
      await this.event(c, {
        id: input.taskId,
        organizationId: String(source.organization_id),
        workspaceId: String(source.workspace_id),
        from: "dead_letter",
        to: "manually_replayed",
        actorId: input.actorId,
        actorType: "user",
        requestId: input.requestId,
        traceId: input.traceId,
        metadata: { reason: input.reason },
        now: input.now,
      });
      await this.event(c, {
        id: input.newTaskId,
        organizationId: String(source.organization_id),
        workspaceId: String(source.workspace_id),
        from: null,
        to: "scheduled",
        actorId: input.actorId,
        actorType: "user",
        requestId: input.requestId,
        traceId: input.traceId,
        metadata: { replay_of_task_id: input.taskId },
        now: input.now,
      });
      await c.query(
        "INSERT INTO collection_task_outbox (id,task_id,organization_id,workspace_id," +
          "event_type,payload_json,status,attempt_count,available_at,lease_owner,lease_expires_at," +
          "request_id,trace_id,created_at,updated_at) VALUES (?,?,?,?,? ,?,'queued'," +
          "0,?,NULL,NULL,?,?,?,?)",
        [
          randomUUID(),
          input.newTaskId,
          source.organization_id,
          source.workspace_id,
          "collection.task.scheduled",
          JSON.stringify({ task_id: input.newTaskId, replay_of_task_id: input.taskId }),
          input.now,
          input.requestId,
          input.traceId,
          input.now,
          input.now,
        ],
      );
      await c.query(
        "INSERT INTO collection_task_operations (id,actor_id,route,idempotency_key," +
          "task_id,result_task_id,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomUUID(),
          input.actorId,
          route,
          input.idempotencyKey,
          input.taskId,
          input.newTaskId,
          input.now,
        ],
      );
      await c.commit();
      return (await this.readDetail(this.pool, input.newTaskId))!;
    } catch (error) {
      await c.rollback();
      if (error instanceof CollectionTaskServiceError) throw error;
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new CollectionTaskServiceError(
          "collection_replay_conflict",
          409,
          "刷新任务状态后重试。",
        );
      throw error;
    } finally {
      c.release();
    }
  }
  private async readDetail(
    db: Pool | PoolConnection,
    id: string,
  ): Promise<CollectionTaskDetail | null> {
    const [tasks, subqueries, attempts, events, dead] = await Promise.all([
      db.query<RowDataPacket[]>("SELECT * FROM collection_tasks WHERE id=?", [id]),
      db.query<RowDataPacket[]>(
        "SELECT q.*,p.name provider_name FROM collection_subqueries q JOIN providers p ON p.id=q.provider_id " +
          "WHERE q.task_id=? ORDER BY q.ordinal",
        [id],
      ),
      db.query<RowDataPacket[]>(
        "SELECT id,attempt_number,worker_id,status,error_code,leased_at,lease_expires_at," +
          "started_at,finished_at,request_id,trace_id FROM collection_task_attempts WHERE task_id=? " +
          "ORDER BY attempt_number",
        [id],
      ),
      db.query<RowDataPacket[]>(
        "SELECT id,event_type,from_status,to_status,actor_type,actor_id,request_id," +
          "trace_id,metadata_json,occurred_at FROM collection_task_events WHERE task_id=? ORDER " +
          "BY occurred_at,id",
        [id],
      ),
      db.query<RowDataPacket[]>(
        "SELECT id,error_code,status,replay_reason,replayed_at,request_id,trace_id," +
          "created_at FROM collection_dead_letters WHERE task_id=? LIMIT 1",
        [id],
      ),
    ]);
    const row = tasks[0][0];
    if (!row) return null;
    return {
      task: task(row),
      subqueries: subqueries[0].map((item) => ({
        id: String(item.id),
        provider_id: String(item.provider_id),
        provider_name: String(item.provider_name),
        ordinal: Number(item.ordinal),
        is_required: Boolean(item.is_required),
        status: String(item.status),
        available_result_count: Number(item.available_result_count),
        missing_fields: json(item.missing_fields_json) ?? [],
        error_code: item.error_code == null ? null : String(item.error_code),
        retryable: Boolean(item.retryable),
        started_at: iso(item.started_at),
        finished_at: iso(item.finished_at),
      })),
      attempts: attempts[0].map((item) => ({
        ...item,
        attempt_number: Number(item.attempt_number),
        leased_at: iso(item.leased_at),
        lease_expires_at: iso(item.lease_expires_at),
        started_at: iso(item.started_at),
        finished_at: iso(item.finished_at),
      })),
      events: events[0].map((item) => ({
        ...item,
        metadata: json(item.metadata_json),
        metadata_json: undefined,
        occurred_at: iso(item.occurred_at),
      })),
      dead_letter: dead[0][0]
        ? {
            ...dead[0][0],
            replayed_at: iso(dead[0][0].replayed_at),
            created_at: iso(dead[0][0].created_at),
          }
        : null,
    };
  }
  private event(
    c: PoolConnection,
    input: {
      id: string;
      organizationId: string;
      workspaceId: string;
      from: string | null;
      to: string;
      actorId: string;
      actorType: string;
      requestId: string;
      traceId: string;
      metadata: unknown;
      now: Date;
    },
  ) {
    return c.query(
      "INSERT INTO collection_task_events (id,task_id,organization_id,workspace_id," +
        "event_type,from_status,to_status,actor_type,actor_id,request_id,trace_id," +
        "metadata_json,occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        randomUUID(),
        input.id,
        input.organizationId,
        input.workspaceId,
        `collection.task.${input.to}`,
        input.from,
        input.to,
        input.actorType,
        input.actorId,
        input.requestId,
        input.traceId,
        JSON.stringify(input.metadata),
        input.now,
      ],
    );
  }
}
