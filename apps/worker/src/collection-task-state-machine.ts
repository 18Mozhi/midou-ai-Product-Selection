import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  assertTaskTransition,
  classifyCollectionFailure,
  retryAvailableAt,
  type SubqueryOutcome,
} from "@scoutops/collection-tasks";
import {
  CollectionExecutionError,
  type ClaimedCollectionTask,
} from "./collection-task-contracts.js";
import { completeCollectionTask } from "./collection-task-evidence.js";
import {
  failCollectionTask,
  recoverExpiredCollectionTasks,
  writeCollectionDeadLetter,
} from "./collection-task-dead-letter.js";

const hash = (token: string) =>
  createHash("sha256").update("scoutops:collection-task-lease:v1\0").update(token).digest("hex");
const token = () => randomUUID() + randomUUID();
const statement = (...parts: string[]) => parts.join("");

export class MySqlCollectionTaskWorkerRepository {
  constructor(
    readonly pool: Pool,
    readonly random: () => number = Math.random,
    readonly taskId: string | undefined = undefined,
  ) {}
  async recordSchedulerResource(input: {
    workerId: string;
    allowed: boolean;
    snapshot: {
      loadBasisPoints: number;
      availableMemoryMb: number;
      freeDiskMb: number;
      observedAt: Date;
    };
  }) {
    await this.pool.query(
      statement(
        "INSERT INTO crawler_scheduler_observations",
        "(id,state,worker_instances,crawler_instances,active_worker_leases,",
        "active_crawler_leases,duplicate_lease_count,load_basis_points,",
        "available_memory_mb,free_disk_mb,provider_count,profile_count,",
        "finding_codes_json,request_id,trace_id,observed_at) ",
        "VALUES(?,? ,1,1,0,0,0,?,?,?,0,0,?,?,?,?)",
      ),
      [
        randomUUID(),
        input.allowed ? "ready" : "blocked",
        input.snapshot.loadBasisPoints,
        input.snapshot.availableMemoryMb,
        input.snapshot.freeDiskMb,
        JSON.stringify(input.allowed ? [] : ["crawler_resource_stop"]),
        `worker-resource-${input.workerId}`,
        `worker-resource-${input.workerId}`,
        input.snapshot.observedAt,
      ],
    );
  }
  async recoverExpired(now: Date, actorId = "collection-scheduler") {
    return recoverExpiredCollectionTasks(this, now, actorId);
  }
  async queueReady(now: Date, actorId = "collection-scheduler") {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const sql =
          "SELECT * FROM collection_tasks WHERE status IN ('scheduled','retry_scheduled','rate_limited') AND available_at<=?" +
          (this.taskId ? " AND id=?" : "") +
          " ORDER BY FIELD(priority,'critical','high','normal','low'),available_at,id LIMIT 1 FOR UPDATE",
        [rows] = await c.query<RowDataPacket[]>(sql, this.taskId ? [now, this.taskId] : [now]);
      const row = rows[0];
      if (!row) {
        await c.commit();
        return null;
      }
      assertTaskTransition(row.status, "queued");
      await c.query(
        "UPDATE collection_tasks SET status='queued',version=version+1,updated_at=? WHERE id=?",
        [now, row.id],
      );
      await this.event(c, row, row.status, "queued", actorId, "system", {}, now);
      await this.outbox(c, row, "collection.task.queued", { task_id: row.id }, now);
      await c.commit();
      return {
        id: String(row.id),
        organizationId: String(row.organization_id),
        workspaceId: String(row.workspace_id),
        requestId: String(row.request_id),
        traceId: String(row.trace_id),
      };
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async claim(
    workerId: string,
    now: Date,
    leaseSeconds: number,
  ): Promise<ClaimedCollectionTask | null> {
    const c = await this.pool.getConnection(),
      leaseToken = token();
    try {
      await c.beginTransaction();
      await c.query("DELETE FROM crawler_scheduler_leases WHERE expires_at<=?", [now]);
      const [active] = await c.query<RowDataPacket[]>(
        "SELECT slot_key FROM crawler_scheduler_leases WHERE slot_type='worker' AND slot_key='single-host' FOR UPDATE",
      );
      if (active[0]) {
        await c.commit();
        return null;
      }
      const sql =
          "SELECT * FROM collection_tasks WHERE status='queued' AND attempt_count<4" +
          (this.taskId ? " AND id=?" : "") +
          " ORDER BY FIELD(priority,'critical','high','normal','low'),available_at,id LIMIT 1 FOR UPDATE",
        [rows] = await c.query<RowDataPacket[]>(sql, this.taskId ? [this.taskId] : []);
      const row = rows[0];
      if (!row) {
        await c.commit();
        return null;
      }
      assertTaskTransition("queued", "leased");
      const attempt = Number(row.attempt_count) + 1,
        expires = new Date(now.getTime() + leaseSeconds * 1000);
      await c.query(
        statement(
          "UPDATE collection_tasks SET status='leased',leased_at=?,lease_owner=?,",
          "lease_token_hash=UNHEX(?),lease_expires_at=?,attempt_count=?,",
          "version=version+1,updated_at=? WHERE id=?",
        ),
        [now, workerId, hash(leaseToken), expires, attempt, now, row.id],
      );
      const attemptId = randomUUID();
      await c.query(
        statement(
          "INSERT INTO collection_task_attempts ",
          "(id,task_id,attempt_number,worker_id,status,error_code,leased_at,",
          "lease_expires_at,started_at,finished_at,request_id,trace_id,created_at) ",
          "VALUES (?,?,?,?, 'leased',NULL,?,?,NULL,NULL,?,?,?)",
        ),
        [attemptId, row.id, attempt, workerId, now, expires, row.request_id, row.trace_id, now],
      );
      await this.event(
        c,
        row,
        "queued",
        "leased",
        workerId,
        "worker",
        { attempt_number: attempt },
        now,
      );
      await this.outbox(
        c,
        row,
        "collection.task.leased",
        { task_id: row.id, attempt_number: attempt },
        now,
      );
      const [subqueries] = await c.query<RowDataPacket[]>(
        "SELECT id,provider_id,ordinal,is_required,target_json FROM collection_subqueries WHERE task_id=? ORDER BY ordinal",
        [row.id],
      );
      await c.query(
        statement(
          "INSERT INTO crawler_scheduler_leases",
          "(slot_type,slot_key,slot_no,organization_id,workspace_id,task_id,run_id,",
          "lease_owner,lease_token_hash,leased_at,heartbeat_at,expires_at,",
          "request_id,trace_id) ",
          "VALUES('worker','single-host',1,?,?,?,NULL,?,UNHEX(?),?,?,?,?,?)",
        ),
        [
          row.organization_id,
          row.workspace_id,
          row.id,
          workerId,
          hash(leaseToken),
          now,
          now,
          expires,
          row.request_id,
          row.trace_id,
        ],
      );
      for (const providerId of new Set(subqueries.map((item) => String(item.provider_id))))
        await c.query(
          statement(
            "INSERT INTO crawler_scheduler_leases",
            "(slot_type,slot_key,slot_no,organization_id,workspace_id,task_id,run_id,",
            "lease_owner,lease_token_hash,leased_at,heartbeat_at,expires_at,",
            "request_id,trace_id) ",
            "VALUES('provider',?,1,?,?,?,NULL,?,UNHEX(?),?,?,?,?,?)",
          ),
          [
            providerId,
            row.organization_id,
            row.workspace_id,
            row.id,
            workerId,
            hash(leaseToken),
            now,
            now,
            expires,
            row.request_id,
            row.trace_id,
          ],
        );
      await c.commit();
      return {
        id: String(row.id),
        organizationId: String(row.organization_id),
        workspaceId: String(row.workspace_id),
        attemptCount: attempt,
        requestId: String(row.request_id),
        traceId: String(row.trace_id),
        leaseToken,
        subqueries: subqueries.map((item) => ({
          id: String(item.id),
          providerId: String(item.provider_id),
          ordinal: Number(item.ordinal),
          required: Boolean(item.is_required),
          target:
            typeof item.target_json === "string" ? JSON.parse(item.target_json) : item.target_json,
        })),
      };
    } catch (error) {
      await c.rollback();
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") return null;
      throw error;
    } finally {
      c.release();
    }
  }
  async start(task: ClaimedCollectionTask, now: Date) {
    const [result] = await this.pool.query<any>(
      statement(
        "UPDATE collection_tasks SET status='running',started_at=COALESCE(started_at,?),",
        "version=version+1,updated_at=? WHERE id=? AND status='leased' ",
        "AND lease_token_hash=UNHEX(?)",
      ),
      [now, now, task.id, hash(task.leaseToken)],
    );
    if (result.affectedRows !== 1) throw new Error("collection_task_lease_invalid");
    await this.pool.query(
      "UPDATE collection_task_attempts SET status='running',started_at=? WHERE task_id=? AND attempt_number=?",
      [now, task.id, task.attemptCount],
    );
  }
  async releaseCoordinationConflict(task: ClaimedCollectionTask, now: Date) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM collection_tasks WHERE id=? AND status='leased' AND lease_token_hash=UNHEX(?) FOR UPDATE",
        [task.id, hash(task.leaseToken)],
      );
      const row = rows[0];
      if (!row) throw new Error("collection_task_lease_invalid");
      const classification = classifyCollectionFailure("timeout", task.attemptCount),
        available =
          classification.status === "retry_scheduled"
            ? retryAvailableAt(task.attemptCount, now, this.random())
            : now;
      assertTaskTransition("leased", classification.status);
      await c.query(
        statement(
          "UPDATE collection_tasks SET status=?,available_at=?,last_error_code=?,",
          "lease_owner=NULL,lease_token_hash=NULL,lease_expires_at=NULL,finished_at=?,",
          "version=version+1,updated_at=? WHERE id=?",
        ),
        [
          classification.status,
          available,
          "timeout",
          classification.status === "dead_letter" ? now : null,
          now,
          task.id,
        ],
      );
      await c.query(
        "UPDATE collection_task_attempts SET status=?,error_code=?,finished_at=? WHERE task_id=? AND attempt_number=?",
        [classification.status, "timeout", now, task.id, task.attemptCount],
      );
      if (classification.status === "dead_letter")
        await writeCollectionDeadLetter(c, row, "timeout", now);
      await this.event(
        c,
        row,
        "leased",
        classification.status,
        row.lease_owner,
        "worker",
        { error_code: "timeout", coordination_conflict: true },
        now,
      );
      await this.outbox(
        c,
        row,
        `collection.task.${classification.status}`,
        { task_id: task.id, error_code: "timeout", coordination_conflict: true },
        now,
      );
      await c.query("DELETE FROM crawler_scheduler_leases WHERE task_id=?", [task.id]);
      await c.commit();
      return classification;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async heartbeat(task: ClaimedCollectionTask, now: Date, leaseSeconds: number) {
    const expires = new Date(now.getTime() + leaseSeconds * 1000),
      [result] = await this.pool.query<any>(
        statement(
          "UPDATE collection_tasks SET lease_expires_at=?,updated_at=? WHERE id=? ",
          "AND status IN ('leased','running','parsing','validating') ",
          "AND lease_token_hash=UNHEX(?)",
        ),
        [expires, now, task.id, hash(task.leaseToken)],
      );
    if (result.affectedRows !== 1) throw new Error("collection_task_lease_invalid");
    await this.pool.query(
      "UPDATE crawler_scheduler_leases SET heartbeat_at=?,expires_at=? WHERE task_id=? AND lease_token_hash=UNHEX(?)",
      [now, expires, task.id, hash(task.leaseToken)],
    );
  }
  async complete(
    task: ClaimedCollectionTask,
    outcomes: Array<SubqueryOutcome & { id: string }>,
    now: Date,
  ) {
    return completeCollectionTask(this, task, outcomes, now);
  }
  async fail(task: ClaimedCollectionTask, error: CollectionExecutionError, now: Date) {
    return failCollectionTask(this, task, error, now);
  }
  async lock(c: PoolConnection, task: ClaimedCollectionTask) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT * FROM collection_tasks WHERE id=? AND status='running' AND lease_token_hash=UNHEX(?) FOR UPDATE",
      [task.id, hash(task.leaseToken)],
    );
    if (!rows[0]) throw new Error("collection_task_lease_invalid");
    return rows[0];
  }
  event(
    c: PoolConnection,
    row: RowDataPacket,
    from: string | null,
    to: string,
    actorId: string,
    actorType: string,
    metadata: unknown,
    now: Date,
  ) {
    return c.query(
      statement(
        "INSERT INTO collection_task_events ",
        "(id,task_id,organization_id,workspace_id,event_type,from_status,to_status,",
        "actor_type,actor_id,request_id,trace_id,metadata_json,occurred_at) ",
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ),
      [
        randomUUID(),
        row.id,
        row.organization_id,
        row.workspace_id,
        `collection.task.${to}`,
        from,
        to,
        actorType,
        actorId,
        row.request_id,
        row.trace_id,
        JSON.stringify(metadata),
        now,
      ],
    );
  }
  outbox(c: PoolConnection, row: RowDataPacket, eventType: string, payload: unknown, now: Date) {
    return c.query(
      statement(
        "INSERT INTO collection_task_outbox ",
        "(id,task_id,organization_id,workspace_id,event_type,payload_json,status,",
        "attempt_count,available_at,lease_owner,lease_expires_at,request_id,",
        "trace_id,created_at,updated_at) ",
        "VALUES (?,?,?,?,?,?,'queued',0,?,NULL,NULL,?,?,?,?)",
      ),
      [
        randomUUID(),
        row.id,
        row.organization_id,
        row.workspace_id,
        eventType,
        JSON.stringify(payload),
        now,
        row.request_id,
        row.trace_id,
        now,
        now,
      ],
    );
  }
}
