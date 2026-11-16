import { appendCollectionSubquery, collectionTaskScope } from "@scoutops/database";
import { isNativeOwnedCollectionTask, registerReplayOwnership, resolveCollectionReplayOwner, verifyOwnedReplayQueries } from "./collection-replay-ownership.js";
import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { ROBOTS_DECISION_VERSION, type RobotsPolicyDecision } from "@scoutops/provider-sources";
import type {
  CollectionTaskDetail,
  CollectionTaskRepository,
  CollectionTaskSummary,
} from "./collection-task-service.js";
import { CollectionTaskServiceError } from "./collection-task-service.js";
const json = (value: unknown): any => (typeof value === "string" ? JSON.parse(value) : value);
const iso = (value: unknown) =>
  value == null ? null : new Date(value as string | Date).toISOString();
const robotsDecision = (value: unknown): RobotsPolicyDecision | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>,
    rule = item.matched_rule as Record<string, unknown> | null;
  if (
    item.decision_version !== ROBOTS_DECISION_VERSION ||
    typeof item.allowed !== "boolean" ||
    !["matched_rule", "no_matching_rule", "missing_robots", "http_status"].includes(
      String(item.decision_basis),
    ) ||
    typeof item.robots_url !== "string" ||
    !/^https?:\/\/[^\s]+\/robots\.txt$/.test(item.robots_url) ||
    !Number.isInteger(item.robots_http_status) ||
    Number(item.robots_http_status) < 100 ||
    Number(item.robots_http_status) > 599 ||
    (item.matched_user_agent !== null && typeof item.matched_user_agent !== "string") ||
    (rule !== null &&
      (!rule ||
        !["allow", "disallow"].includes(String(rule.directive)) ||
        typeof rule.pattern_preview !== "string" ||
        rule.pattern_preview.length > 500 ||
        !/^[a-f0-9]{64}$/.test(String(rule.pattern_sha256)) ||
        typeof rule.truncated !== "boolean"))
  )
    return null;
  return value as RobotsPolicyDecision;
};
const task = (row: RowDataPacket): CollectionTaskSummary => ({
  id: String(row.id),
  ...(typeof row.account_id === "string" ? { account_id: row.account_id } : {
    organization_id: String(row.organization_id),
    workspace_id: String(row.workspace_id),
  }),
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
    const native = await collectionTaskScope(this.pool) === "account";
    if ((input.organizationId || input.workspaceId) && native)
      throw new CollectionTaskServiceError("collection_scope_invalid", 400, "移除历史组织和工作区筛选。");
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
      where.push(native ? "t.status=?" : "status=?");
      values.push(input.status);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const source = native ? `collection_tasks t
      JOIN account_owned_records own ON own.source_table='collection_tasks' AND own.source_id=t.id AND own.account_id=t.account_id
      JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
        AND (own.reason='exclusive_owner' OR (own.reason IN ('shared','unassigned') AND own.account_id=cut.primary_account_id))
      JOIN users owner_user ON owner_user.id=own.account_id` : "collection_tasks";
    const [[count], [rows]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) total FROM ${source} ${clause}`,
        values,
      ),
      this.pool.query<RowDataPacket[]>(
        `SELECT ${native ? "t.*" : "*"} FROM ${source} ${clause} ORDER BY FIELD(${native ? "t." : ""}priority,'critical','high','normal','low'),${native ? "t.updated_at DESC,t.id" : "updated_at DESC,id"} DESC LIMIT ? OFFSET ?`,
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
        "SELECT result_task_id FROM collection_task_operations WHERE actor_id=? AND route=? AND idempotency_key=? AND task_id=? LIMIT 1",
        [input.actorId, route, input.idempotencyKey, input.taskId],
      );
      if (ops[0]) {
        await this.verifyReplayReceipt(c, input.taskId, String(ops[0].result_task_id), input.reason);
        const result = await this.readDetail(c, String(ops[0].result_task_id));
        if (!result) throw this.replayOwnerMismatch();
        await c.commit();
        return result;
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
      if (source.status !== "dead_letter") {
        const [committedOperations] = await c.query<RowDataPacket[]>(
          "SELECT result_task_id FROM collection_task_operations WHERE actor_id=? AND route=? AND idempotency_key=? AND task_id=? LIMIT 1 FOR UPDATE",
          [input.actorId, route, input.idempotencyKey, input.taskId],
        );
        if (committedOperations[0]) {
          await this.verifyReplayReceipt(c, input.taskId, String(committedOperations[0].result_task_id), input.reason);
          const result = await this.readDetail(c, String(committedOperations[0].result_task_id));
          if (!result) throw this.replayOwnerMismatch();
          await c.commit();
          return result;
        }
        throw new CollectionTaskServiceError(
          "collection_replay_not_allowed",
          409,
          "只有 dead_letter 任务可以人工重放。",
        );
      }
      const owner = await resolveCollectionReplayOwner(c, input.taskId, () => this.replayOwnerMismatch());
      const accountOnly = isNativeOwnedCollectionTask(source, owner, () => this.replayOwnerMismatch());
      const ownershipRefs: [string, string][] = [["collection_tasks", input.newTaskId]];
      const [subqueries] = await c.query<RowDataPacket[]>(
        "SELECT * FROM collection_subqueries WHERE task_id=? ORDER BY ordinal" + (owner ? " LOCK IN SHARE MODE" : ""),
        [input.taskId],
      );
      if (!subqueries.length)
        throw new CollectionTaskServiceError(
          "collection_subqueries_missing",
          409,
          "修复原任务子查询后再重放。",
        );
      let deadLetterId: string | undefined;
      if (owner) {
        await verifyOwnedReplayQueries(c, owner, subqueries.map(row => String(row.id)), () => this.replayOwnerMismatch());
        const [[dead]] = await c.query<RowDataPacket[]>(
          "SELECT d.id FROM collection_dead_letters d JOIN collection_task_attempts a ON a.id=d.attempt_id " +
          "AND a.task_id=d.task_id WHERE d.task_id=? AND d.status='open' FOR UPDATE",
          [input.taskId],
        );
        if (!dead) throw this.replayOwnerMismatch();
        deadLetterId = String(dead.id);
      }
      const [inserted] = await c.query<ResultSetHeader>(
        "INSERT INTO collection_tasks (id," + (accountOnly ? "account_id," : "organization_id,workspace_id,") +
          "status,coverage_status," +
          "priority,scheduled_at,available_at,leased_at,lease_owner,lease_token_hash," +
          "lease_expires_at,started_at,finished_at,attempt_count,successful_subquery_count," +
          "failed_subquery_count,blocked_subquery_count,available_result_count,missing_fields_json," +
          "last_error_code,rate_limit_reset_at,replay_of_task_id,replay_reason,request_id," +
          "trace_id,version,created_by,created_at,updated_at) VALUES (" + (accountOnly ? "?,?" : "?,?,?") + ",'scheduled'," +
          "NULL,?,?,?,NULL,NULL,NULL,NULL,NULL,NULL,0,0,0,0,0,'[]',NULL,NULL,?,?,?," +
          " ?,1,?,?,?)",
        [
          input.newTaskId,
          ...(accountOnly ? [owner!.account_id] : [source.organization_id,source.workspace_id]),
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
      if (inserted.affectedRows !== 1) throw this.replayOwnerMismatch();
      for (const row of subqueries) {
        const id = randomUUID();
        ownershipRefs.push(["collection_subqueries", id]);
        await appendCollectionSubquery(c, {
          id, taskId: input.newTaskId, providerId: String(row.provider_id), ordinal: Number(row.ordinal),
          targetJson: JSON.stringify(json(row.target_json)), required: Number(row.is_required) === 1, status: "pending", now: input.now,
        }, accountOnly);
      }
      const [updatedSource] = await c.query<ResultSetHeader>(
        "UPDATE collection_tasks SET status='manually_replayed',version=version+1,updated_at=? WHERE id=? AND status='dead_letter'",
        [input.now, input.taskId],
      );
      const [updatedDeadLetter] = await c.query<ResultSetHeader>(
        "UPDATE collection_dead_letters SET status='replayed',replayed_by=?,replay_reason=?," +
          "replayed_at=? WHERE task_id=? AND status='open'" + (deadLetterId ? " AND id=?" : ""),
        [input.actorId, input.reason, input.now, input.taskId, ...(deadLetterId ? [deadLetterId] : [])],
      );
      if (owner && (updatedSource.affectedRows !== 1 || updatedDeadLetter.affectedRows !== 1))
        throw this.replayOwnerMismatch();
      ownershipRefs.push(["collection_task_events", await this.event(c, {
        id: input.taskId,
        from: "dead_letter",
        to: "manually_replayed",
        actorId: input.actorId,
        actorType: "user",
        requestId: input.requestId,
        traceId: input.traceId,
        metadata: { reason: input.reason },
        now: input.now,
      })]);
      ownershipRefs.push(["collection_task_events", await this.event(c, {
        id: input.newTaskId,
        from: null,
        to: "scheduled",
        actorId: input.actorId,
        actorType: "user",
        requestId: input.requestId,
        traceId: input.traceId,
        metadata: { replay_of_task_id: input.taskId },
        now: input.now,
      })]);
      const outboxId = randomUUID();
      ownershipRefs.push(["collection_task_outbox", outboxId]);
      await c.query(
        "INSERT INTO collection_task_outbox (id,task_id," +
          "event_type,payload_json,status,attempt_count,available_at,lease_owner,lease_expires_at," +
          "request_id,trace_id,created_at,updated_at) VALUES (?,?,? ,?,'queued'," +
          "0,?,NULL,NULL,?,?,?,?)",
        [
          outboxId,
          input.newTaskId,
          "collection.task.scheduled",
          JSON.stringify({ task_id: input.newTaskId, replay_of_task_id: input.taskId }),
          input.now,
          input.requestId,
          input.traceId,
          input.now,
          input.now,
        ],
      );
      await registerReplayOwnership(c, owner, ownershipRefs);
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
      const result = await this.readDetail(c, input.newTaskId);
      if (!result || (accountOnly && result.task.account_id !== owner!.account_id)) throw this.replayOwnerMismatch();
      await c.commit();
      return result;
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
  private replayOwnerMismatch() {
    return new CollectionTaskServiceError("collection_replay_conflict", 409, "原采集任务或重放记录的账号归属不一致。");
  }
  private async verifyReplayReceipt(c: PoolConnection, sourceId: string, resultId: string, reason: string) {
    if (sourceId === resultId) throw this.replayOwnerMismatch();
    const [children] = await c.query<RowDataPacket[]>(
      "SELECT * FROM collection_tasks WHERE id=? AND replay_of_task_id=? LOCK IN SHARE MODE", [resultId, sourceId],
    );
    if (!children[0]) throw this.replayOwnerMismatch();
    const source = await resolveCollectionReplayOwner(c, sourceId, () => this.replayOwnerMismatch());
    if (!source && !Object.hasOwn(children[0], "account_id")) return;
    const result = await resolveCollectionReplayOwner(c, resultId, () => this.replayOwnerMismatch());
    if (!source || !result || source.account_id !== result.account_id || source.reason !== result.reason ||
        (Object.hasOwn(children[0], "account_id") && children[0].account_id !== result.account_id))
      throw this.replayOwnerMismatch();
    if (Object.hasOwn(children[0], "account_id")) {
      if (children[0].replay_reason !== reason) throw this.replayOwnerMismatch();
      const [[parent]] = await c.query<RowDataPacket[]>(
        "SELECT account_id FROM collection_tasks WHERE id=? LOCK IN SHARE MODE", [sourceId],
      );
      if (parent?.account_id !== source.account_id) throw this.replayOwnerMismatch();
      const [queries] = await c.query<RowDataPacket[]>(
        "SELECT id FROM collection_subqueries WHERE task_id=? LOCK IN SHARE MODE", [resultId],
      );
      await verifyOwnedReplayQueries(c, result, queries.map(row => String(row.id)), () => this.replayOwnerMismatch());
    }
  }
  private async readDetail(
    db: Pool | PoolConnection,
    id: string,
  ): Promise<CollectionTaskDetail | null> {
    // A retry may have opened a snapshot before the first request committed.
    // The receipt and its returned graph must use the same current read.
    const lock = db !== this.pool ? " LOCK IN SHARE MODE" : "";
    const [[row]] = await db.query<RowDataPacket[]>("SELECT * FROM collection_tasks WHERE id=?" + lock, [id]);
    if (!row) return null;
    const native = Object.hasOwn(row,"account_id");
    if (native) {
      const mismatch = this.replayOwnerMismatch();
      try {
        const owner = await resolveCollectionReplayOwner(db, id, () => mismatch, "collection_tasks", db !== this.pool);
        isNativeOwnedCollectionTask(row, owner, () => mismatch);
      } catch (error) {
        if (error === mismatch) return null;
        throw error;
      }
    }
    const owned = (table: "collection_subqueries" | "collection_task_events", ref: "q.id" | "collection_task_events.id") => native
      ? ` AND EXISTS (SELECT 1 FROM account_owned_records child WHERE child.source_table='${table}' AND child.source_id=${ref} AND child.account_id=?)` : "";
    const childArgs = native ? [id,row.account_id] : [id];
    const [subqueries, attempts, events, dead] = await Promise.all([
      db.query<RowDataPacket[]>(
        "SELECT q.*,p.name provider_name FROM collection_subqueries q JOIN providers p ON p.id=q.provider_id " +
          "WHERE q.task_id=?" + owned("collection_subqueries","q.id") + " ORDER BY q.ordinal" + lock,
        childArgs,
      ),
      db.query<RowDataPacket[]>(
        "SELECT id,attempt_number,worker_id,status,error_code,leased_at,lease_expires_at," +
          "started_at,finished_at,request_id,trace_id FROM collection_task_attempts WHERE task_id=? " +
          "ORDER BY attempt_number" + lock,
        [id],
      ),
      db.query<RowDataPacket[]>(
        "SELECT id,event_type,from_status,to_status,actor_type,actor_id,request_id," +
          "trace_id,metadata_json,occurred_at FROM collection_task_events WHERE task_id=?" + owned("collection_task_events","collection_task_events.id") + " ORDER " +
          "BY occurred_at,id" + lock,
        childArgs,
      ),
      db.query<RowDataPacket[]>(
        (native ? "SELECT d.id,d.error_code,d.status,d.replay_reason,d.replayed_at,d.request_id,d.trace_id,d.created_at " +
          "FROM collection_dead_letters d JOIN collection_task_attempts a ON a.id=d.attempt_id AND a.task_id=d.task_id WHERE d.task_id=? LIMIT 1" :
          "SELECT id,error_code,status,replay_reason,replayed_at,request_id,trace_id,created_at FROM collection_dead_letters WHERE task_id=? LIMIT 1") + lock,
        [id],
      ),
    ]);
    const resultKinds = new Map<
        string,
        CollectionTaskDetail["subqueries"][number]["result_kind"]
      >(),
      robotsDecisions = new Map<string, RobotsPolicyDecision>();
    for (const event of events[0]) {
      if (String(event.event_type) !== "collection.subquery.completed") continue;
      const metadata = json(event.metadata_json) ?? {},
        subqueryId = String(metadata.subquery_id ?? ""),
        resultKind = metadata.result_kind;
      if (
        subqueryId &&
        ["empty_success", "no_new_content", "parse_failed"].includes(String(resultKind))
      )
        resultKinds.set(
          subqueryId,
          resultKind as CollectionTaskDetail["subqueries"][number]["result_kind"],
        );
      const policyDecision = robotsDecision(metadata.robots_policy_decision);
      if (subqueryId && policyDecision) robotsDecisions.set(subqueryId, policyDecision);
    }
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
        result_kind: resultKinds.get(String(item.id)) ?? null,
        robots_decision: robotsDecisions.get(String(item.id)) ?? null,
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
  private async event(
    c: PoolConnection,
    input: {
      id: string;
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
    const id = randomUUID();
    await c.query(
      "INSERT INTO collection_task_events (id,task_id," +
        "event_type,from_status,to_status,actor_type,actor_id,request_id,trace_id," +
        "metadata_json,occurred_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        input.id,
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
    return id;
  }
}
