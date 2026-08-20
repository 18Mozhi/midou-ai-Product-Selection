import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { BusinessTaskError, type BusinessTaskRepository } from "./business-task-service.js";
const parse = <T>(v: unknown): T => (typeof v === "string" ? JSON.parse(v) : (v as T)),
  iso = (v: unknown) =>
    v == null ? null : (v instanceof Date ? v : new Date(String(v))).toISOString();
export class MySqlBusinessTaskRepository implements BusinessTaskRepository {
  constructor(
    private readonly pool: Pool,
    private readonly now = () => new Date(),
  ) {}
  async list(i: any) {
    const where = ["organization_id=?", "workspace_id=?", "deleted_at IS NULL"],
      args: any[] = [i.organizationId, i.workspaceId];
    if (i.status) {
      where.push("status=?");
      args.push(i.status);
    }
    if (i.mine) {
      where.push("assignee_id=?");
      args.push(i.actorId);
    }
    const [count] = await this.pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) total FROM tasks WHERE ${where.join(" AND ")}`,
        args,
      ),
      [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT * FROM tasks
         WHERE ${where.join(" AND ")}
         ORDER BY CASE priority
          WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4
         END,due_at IS NULL,due_at,created_at DESC LIMIT ? OFFSET ?`,
        [...args, i.pageSize, (i.page - 1) * i.pageSize],
      );
    return {
      items: rows.map((r) => this.task(r)),
      page: i.page,
      page_size: i.pageSize,
      total: Number(count[0]?.total ?? 0),
    };
  }
  async summary(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT status,COUNT(*) count,SUM(due_at IS NOT NULL AND due_at<NOW(3) AND status NOT " +
        "IN ('completed','cancelled')) overdue FROM tasks WHERE organization_id=? AND workspace_id=? " +
        "AND assignee_id=? AND deleted_at IS NULL GROUP BY status",
      [i.organizationId, i.workspaceId, i.actorId],
    );
    const summary = {
      todo: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      overdue: 0,
    };
    for (const r of rows) {
      summary[r.status as keyof typeof summary] = Number(r.count);
      summary.overdue += Number(r.overdue ?? 0);
    }
    return summary;
  }
  async detail(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM tasks WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL",
      [i.taskId, i.organizationId, i.workspaceId],
    );
    if (!rows[0]) throw new BusinessTaskError("task_not_found", 404, "刷新任务列表。");
    const [comments] = await this.pool.query<RowDataPacket[]>(
        "SELECT id,body,created_by,created_at FROM task_comments WHERE task_id=? AND organization_id=? " +
          "AND workspace_id=? ORDER BY created_at,id",
        [i.taskId, i.organizationId, i.workspaceId],
      ),
      [events] = await this.pool.query<RowDataPacket[]>(
        "SELECT id,event_type,actor_id,payload_json,created_at FROM task_events WHERE task_id=? " +
          "AND organization_id=? AND workspace_id=? ORDER BY created_at,id",
        [i.taskId, i.organizationId, i.workspaceId],
      );
    return {
      ...this.task(rows[0]),
      comments: comments.map((r) => ({
        id: String(r.id),
        body: String(r.body),
        created_by: String(r.created_by),
        created_at: iso(r.created_at),
      })),
      events: events.map((r) => ({
        id: String(r.id),
        event_type: String(r.event_type),
        actor_id: String(r.actor_id),
        payload: parse(r.payload_json),
        created_at: iso(r.created_at),
      })),
    };
  }
  async create(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    await this.ensureAssignee(i.organizationId, i.workspaceId, i.value.assignee_id);
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      await c.query(
        "INSERT INTO tasks (id,organization_id,workspace_id,title,description,status," +
          "priority,assignee_id,source_type,source_ref_id,due_at,completed_at,created_by," +
          "version,created_at,updated_at) VALUES (?,?,?,?,?,'todo',?,?,'manual',NULL," +
          "?,NULL,?,1,?,?)",
        [
          i.id,
          i.organizationId,
          i.workspaceId,
          i.value.title,
          i.value.description,
          i.value.priority,
          i.value.assignee_id,
          i.value.due_at,
          i.actorId,
          now,
          now,
        ],
      );
      const result = { id: i.id, status: "todo", version: 1 };
      await this.record(
        c,
        i,
        "task.created",
        i.id,
        { ...result, assignee_id: i.value.assignee_id },
        now,
      );
      await this.save(c, i, i.id, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async action(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    if (i.value.action === "transfer")
      await this.ensureAssignee(i.organizationId, i.workspaceId, i.value.assignee_id);
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM tasks WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL FOR UPDATE",
        [i.taskId, i.organizationId, i.workspaceId],
      );
      const r = rows[0];
      if (!r) throw new BusinessTaskError("task_not_found", 404, "刷新任务列表。");
      if (Number(r.version) !== i.value.expected_version)
        throw new BusinessTaskError("task_version_conflict", 409, "刷新任务后重试。");
      let status = String(r.status),
        assignee = String(r.assignee_id),
        due = r.due_at,
        completed = r.completed_at;
      if (i.value.action === "start") {
        if (status !== "todo")
          throw new BusinessTaskError("task_transition_invalid", 409, "仅待处理任务可开始。");
        status = "in_progress";
      }
      if (i.value.action === "pause") {
        if (status !== "in_progress")
          throw new BusinessTaskError("task_transition_invalid", 409, "仅进行中的任务可暂停。");
        status = "paused";
      }
      if (i.value.action === "resume") {
        if (status !== "paused")
          throw new BusinessTaskError("task_transition_invalid", 409, "仅已暂停任务可继续。");
        status = "in_progress";
      }
      if (i.value.action === "complete") {
        if (!["todo", "in_progress", "paused"].includes(status))
          throw new BusinessTaskError("task_transition_invalid", 409, "仅未结束任务可完成。");
        status = "completed";
        completed = now;
      }
      if (i.value.action === "cancel") {
        if (["completed", "cancelled"].includes(status))
          throw new BusinessTaskError("task_transition_invalid", 409, "任务已结束。");
        status = "cancelled";
      }
      if (i.value.action === "delay") {
        if (["completed", "cancelled"].includes(status) || !i.value.due_at)
          throw new BusinessTaskError("task_transition_invalid", 409, "仅未结束任务可延期。");
        due = i.value.due_at;
      }
      if (i.value.action === "transfer") assignee = i.value.assignee_id;
      const progress =
        i.value.action === "complete"
          ? 100
          : i.value.action === "progress"
            ? i.value.progress_percent
            : Number(r.progress_percent ?? 0);
      if (
        i.value.action === "progress" &&
        (!Number.isInteger(progress) || progress < 0 || progress > 100)
      )
        throw new BusinessTaskError("task_progress_invalid", 400, "进度必须是 0–100 的整数。");
      const version = Number(r.version) + 1;
      await c.query(
        "UPDATE tasks SET status=?,assignee_id=?,due_at=?,completed_at=?,progress_percent=?," +
          "progress_note=IF(? IS NULL,progress_note,?),version=?,updated_at=? WHERE id=?",
        [
          status,
          assignee,
          due,
          completed,
          progress,
          i.value.progress_note,
          i.value.progress_note,
          version,
          now,
          i.taskId,
        ],
      );
      const result = {
        id: i.taskId,
        status,
        assignee_id: assignee,
        due_at: iso(due),
        progress_percent: progress,
        version,
      };
      await this.record(
        c,
        i,
        `task.${i.value.action}`,
        i.taskId,
        { ...result, reason: i.value.reason },
        now,
      );
      await this.save(c, i, i.taskId, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async comment(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT id FROM tasks WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL FOR UPDATE",
        [i.taskId, i.organizationId, i.workspaceId],
      );
      if (!rows[0]) throw new BusinessTaskError("task_not_found", 404, "刷新任务列表。");
      await c.query(
        "INSERT INTO task_comments (id,organization_id,workspace_id,task_id,body,created_by,created_at) VALUES (?,?,?,?,?,?,?)",
        [i.id, i.organizationId, i.workspaceId, i.taskId, i.body, i.actorId, now],
      );
      const result = {
        id: i.id,
        task_id: i.taskId,
        body: i.body,
        created_by: i.actorId,
        created_at: now.toISOString(),
      };
      await this.record(c, i, "task.comment.created", i.taskId, { comment_id: i.id }, now);
      await this.save(c, i, i.taskId, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async update(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    await this.ensureAssignee(i.organizationId, i.workspaceId, i.value.assignee_id);
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT version FROM tasks WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL FOR UPDATE",
        [i.taskId, i.organizationId, i.workspaceId],
      );
      const r = rows[0];
      if (!r) throw new BusinessTaskError("task_not_found", 404, "刷新任务列表。");
      if (Number(r.version) !== i.value.expected_version)
        throw new BusinessTaskError("task_version_conflict", 409, "刷新任务后重试。");
      const version = Number(r.version) + 1;
      await c.query(
        "UPDATE tasks SET title=?,description=?,priority=?,assignee_id=?,due_at=?,version=?,updated_at=? WHERE id=?",
        [
          i.value.title,
          i.value.description,
          i.value.priority,
          i.value.assignee_id,
          i.value.due_at,
          version,
          now,
          i.taskId,
        ],
      );
      const result = { id: i.taskId, version };
      await this.record(c, i, "task.updated", i.taskId, { ...result, reason: i.value.reason }, now);
      await this.save(c, i, i.taskId, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async remove(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT version FROM tasks WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL FOR UPDATE",
        [i.taskId, i.organizationId, i.workspaceId],
      );
      const r = rows[0];
      if (!r) throw new BusinessTaskError("task_not_found", 404, "刷新任务列表。");
      if (Number(r.version) !== i.value.expected_version)
        throw new BusinessTaskError("task_version_conflict", 409, "刷新任务后重试。");
      const version = Number(r.version) + 1;
      await c.query(
        "UPDATE tasks SET deleted_at=?,deleted_by=?,version=?,updated_at=? WHERE id=?",
        [now, i.actorId, version, now, i.taskId],
      );
      const result = { id: i.taskId, deleted: true, version };
      await this.record(c, i, "task.deleted", i.taskId, { ...result, reason: i.value.reason }, now);
      await this.save(c, i, i.taskId, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  private task(r: RowDataPacket) {
    const due = iso(r.due_at),
      status = String(r.status),
      now = this.now().valueOf(),
      ms = due ? new Date(due).valueOf() - now : null,
      sla =
        status === "completed"
          ? "completed"
          : status === "cancelled"
            ? "cancelled"
            : ms == null
              ? "not_set"
              : ms < 0
                ? "overdue"
                : ms <= 86400000
                  ? "due_soon"
                  : "on_track";
    return {
      id: String(r.id),
      title: String(r.title),
      description: String(r.description),
      status,
      priority: String(r.priority),
      assignee_id: String(r.assignee_id),
      source_type: String(r.source_type),
      source_ref_id: r.source_ref_id ? String(r.source_ref_id) : null,
      collection_task_id: r.collection_task_id ? String(r.collection_task_id) : null,
      due_at: due,
      completed_at: iso(r.completed_at),
      progress_percent: Number(r.progress_percent ?? (status === "completed" ? 100 : 0)),
      progress_note: r.progress_note ? String(r.progress_note) : null,
      sla_status: sla,
      version: Number(r.version),
      created_by: String(r.created_by),
      created_at: iso(r.created_at),
      updated_at: iso(r.updated_at),
    };
  }
  private async ensureAssignee(org: string, workspace: string, user: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT m.id FROM memberships m LEFT JOIN membership_data_scopes s ON s.membership_id=m.id " +
        "WHERE m.organization_id=? AND m.user_id=? AND m.status='active' AND (s.scope_type='organization' " +
        "OR (s.scope_type='workspace' AND s.workspace_id=?)) LIMIT 1",
      [org, user, workspace],
    );
    if (!rows[0])
      throw new BusinessTaskError(
        "task_assignee_scope_invalid",
        409,
        "选择可访问当前工作区的活动成员。",
      );
  }
  private async operation(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT result_json FROM task_operations WHERE actor_id=? AND route_key=? AND idempotency_key=?",
      [i.actorId, i.route, i.idempotencyKey],
    );
    return rows[0] ? parse(rows[0].result_json) : null;
  }
  private save(c: PoolConnection, i: any, task: string, result: unknown, now: Date) {
    return c.query(
      "INSERT INTO task_operations (id,actor_id,route_key,idempotency_key,task_id," +
        "result_json,created_at) VALUES (?,?,?,?,?,?,?)",
      [randomUUID(), i.actorId, i.route, i.idempotencyKey, task, JSON.stringify(result), now],
    );
  }
  private async record(
    c: PoolConnection,
    i: any,
    type: string,
    task: string,
    payload: unknown,
    now: Date,
  ) {
    const id = randomUUID();
    await c.query(
      "INSERT INTO task_events (id,organization_id,workspace_id,task_id,event_type," +
        "actor_id,payload_json,request_id,trace_id,created_at) VALUES (?,?,?,?,?," +
        "?,?,?,?,?)",
      [
        id,
        i.organizationId,
        i.workspaceId,
        task,
        type,
        i.actorId,
        JSON.stringify(payload),
        i.requestId,
        i.traceId,
        now,
      ],
    );
    await c.query(
      "INSERT INTO audit_logs (id,organization_id,workspace_id,actor_id,action," +
        "resource_type,resource_id,request_id,trace_id,metadata_json,occurred_at," +
        "schema_version) VALUES (?,?,?,?,?,'task',?,?,?,?,?,1)",
      [
        randomUUID(),
        i.organizationId,
        i.workspaceId,
        i.actorId,
        type,
        task,
        i.requestId,
        i.traceId,
        JSON.stringify(payload),
        now,
      ],
    );
    await c.query(
      "INSERT INTO outbox_events (id,organization_id,workspace_id,event_type,schema_version," +
        "payload_json,status,attempt_count,available_at,request_id,trace_id,created_at," +
        "updated_at,version) VALUES (?,?,?,?,1,?,'pending',0,?,?,?,?,?,1)",
      [
        id,
        i.organizationId,
        i.workspaceId,
        type,
        JSON.stringify({ task_id: task, ...(payload as object) }),
        now,
        i.requestId,
        i.traceId,
        now,
        now,
      ],
    );
  }
}
