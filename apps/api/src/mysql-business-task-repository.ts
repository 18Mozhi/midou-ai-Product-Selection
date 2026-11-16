import { appendBusinessAudit } from "@scoutops/database";
import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { BusinessTaskError, type BusinessTaskRepository } from "./business-task-service.js";
import { requireAccountReadRehearsal } from "./account-read-rehearsal.js";
import { nativeBusinessTaskScope } from "./business-task-storage.js";
const parse = <T>(v: unknown): T => (typeof v === "string" ? JSON.parse(v) : (v as T)),
  iso = (v: unknown) =>
    v == null ? null : (v instanceof Date ? v : new Date(String(v))).toISOString();
const sealedTaskOwner = (alias: "ow" | "ra") =>
  `(${alias}.reason='exclusive_owner' OR (${alias}.reason IN ('shared','unassigned') AND ${alias}.account_id=cut.primary_account_id))`;
const ownsTaskRecord = (table: "tasks" | "task_events" | "task_comments", native = false) =>
  `EXISTS (SELECT 1 FROM account_owned_records ra JOIN account_ownership_cutover cut ` +
  `ON cut.slot='current' AND cut.contract_version=25 WHERE ra.source_table='${table}' ` +
  `AND ra.source_id=${table}.id AND ${native ? "ra.account_id=tasks.account_id AND tasks.account_id" : "ra.account_id"}=? AND ${sealedTaskOwner("ra")})`;

async function nativeScoringParent(c: PoolConnection, table: "opportunities" | "score_rules") {
  const [columns] = await c.query<RowDataPacket[]>(
    `SHOW COLUMNS FROM ${table} WHERE Field IN ('account_id','organization_id','workspace_id')`,
  );
  const shape = columns
    .map(({ Field }) => Field)
    .sort()
    .join(",");
  if (shape === "account_id") return true;
  if (shape === "organization_id,workspace_id") return false;
  throw new BusinessTaskError(
    "task_scoring_scope_not_ready",
    503,
    "选品或评分规则账号迁移尚未就绪。",
  );
}

export class MySqlBusinessTaskRepository implements BusinessTaskRepository {
  constructor(
    private readonly pool: Pool,
    private readonly now = () => new Date(),
  ) {}
  async list(i: any) {
    const account = "accountId" in i;
    if (account) await requireAccountReadRehearsal(this.pool);
    const native = account && (await nativeBusinessTaskScope(this.pool));
    const where = account
        ? [ownsTaskRecord("tasks", native), "deleted_at IS NULL"]
        : ["organization_id=?", "workspace_id=?", "deleted_at IS NULL"],
      args: unknown[] = account ? [i.accountId] : [i.organizationId, i.workspaceId];
    if (i.status) {
      where.push("status=?");
      args.push(i.status);
    }
    if (i.mine) {
      where.push("assignee_id=?");
      args.push(account ? i.accountId : i.actorId);
    }
    if (i.query) {
      const escaped = String(i.query)
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");
      where.push("(title LIKE ? OR description LIKE ?)");
      args.push(`%${escaped}%`, `%${escaped}%`);
    }
    const orderBy =
      (
        {
          priority_due:
            "CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,due_at IS NULL,due_at,created_at DESC",
          due_asc: "due_at IS NULL,due_at,created_at DESC",
          updated_desc: "updated_at DESC,created_at DESC",
          created_desc: "created_at DESC,id DESC",
        } as Record<string, string>
      )[i.sort] ??
      "CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,due_at IS NULL,due_at,created_at DESC";
    const [count] = await this.pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) total FROM tasks WHERE ${where.join(" AND ")}`,
        args,
      ),
      [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT * FROM tasks
         WHERE ${where.join(" AND ")}
         ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
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
    const account = "accountId" in i;
    if (account) await requireAccountReadRehearsal(this.pool);
    const native = account && (await nativeBusinessTaskScope(this.pool));
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT status,COUNT(*) count,SUM(due_at IS NOT NULL AND due_at<NOW(3) AND status NOT " +
        "IN ('completed','cancelled')) overdue FROM tasks WHERE " +
        (account
          ? ownsTaskRecord("tasks", native) + " "
          : "organization_id=? AND workspace_id=? ") +
        "AND assignee_id=? AND deleted_at IS NULL GROUP BY status",
      account ? [i.accountId, i.accountId] : [i.organizationId, i.workspaceId, i.actorId],
    );
    const summary = {
      todo: 0,
      in_progress: 0,
      paused: 0,
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
  async memberOptions(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT DISTINCT m.user_id id,u.email label FROM memberships m " +
        "JOIN users u ON u.id=m.user_id " +
        "JOIN membership_data_scopes s ON s.membership_id=m.id " +
        "WHERE m.organization_id=? AND m.status='active' AND u.status='active' " +
        "AND (s.scope_type='organization' OR (s.scope_type='workspace' AND s.workspace_id=?)) " +
        "ORDER BY u.email,m.user_id",
      [i.organizationId, i.workspaceId],
    );
    return rows.map((row) => ({ id: String(row.id), label: String(row.label) }));
  }
  async detail(i: any) {
    const account = "accountId" in i;
    if (account) await requireAccountReadRehearsal(this.pool);
    const native = account && (await nativeBusinessTaskScope(this.pool));
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM tasks WHERE id=? AND " +
        (account ? ownsTaskRecord("tasks", native) : "organization_id=? AND workspace_id=?") +
        " AND deleted_at IS NULL",
      account ? [i.taskId, i.accountId] : [i.taskId, i.organizationId, i.workspaceId],
    );
    if (!rows[0]) throw new BusinessTaskError("task_not_found", 404, "刷新任务列表。");
    const context = account ? [i.taskId, i.accountId] : [i.taskId];
    const childOwner = (table: "task_comments" | "task_events") =>
      account ? ` AND ${ownsTaskRecord(table)}` : "";
    const [comments] = await this.pool.query<RowDataPacket[]>(
        "SELECT id,body,created_by,created_at FROM task_comments WHERE task_id=?" +
          `${childOwner("task_comments")} ORDER BY created_at,id`,
        context,
      ),
      [events] = await this.pool.query<RowDataPacket[]>(
        "SELECT id,event_type,actor_id,payload_json,created_at FROM task_events WHERE task_id=?" +
          `${childOwner("task_events")} ORDER BY created_at,id`,
        context,
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
  async action(command: any) {
    const c = await this.pool.getConnection(),
      now = this.now(),
      accountMode = command.accountOwnedMutation === true;
    try {
      await c.beginTransaction();
      const owned = accountMode
        ? await this.lockAccountTask(c, command.taskId, command.actorId)
        : null;
      const r =
        owned ??
        (
          await c.query<RowDataPacket[]>(
            "SELECT * FROM tasks WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
            [command.taskId, command.organizationId, command.workspaceId],
          )
        )[0][0];
      const i = owned ? this.legacyTaskCoordinates(command, owned) : command;
      const old = await this.operation(i, c);
      if (old) {
        await c.commit();
        return old;
      }
      if (!r || r.deleted_at) throw new BusinessTaskError("task_not_found", 404, "刷新任务列表。");
      if (i.value.action === "transfer")
        await this.ensureAssignee(i.organizationId, i.workspaceId, i.value.assignee_id);
      if (Number(r.version) !== i.value.expected_version)
        throw new BusinessTaskError("task_version_conflict", 409, "刷新任务后重试。");
      const scoreAfterCompletion =
        i.value.action === "complete" &&
        String(r.source_type) === "evidence_completion" &&
        r.source_ref_id;
      let scoreOwnerReason: string | undefined;
      let nativeOpportunity = false,
        nativeRule = false;
      if (accountMode && scoreAfterCompletion) {
        nativeOpportunity = await nativeScoringParent(c, "opportunities");
        nativeRule = await nativeScoringParent(c, "score_rules");
        const [opportunities] = await c.query<RowDataPacket[]>(
          "SELECT p.id,ow.reason AS ownership_reason FROM opportunities p JOIN account_owned_records ow " +
            "ON ow.source_table='opportunities' AND ow.source_id=p.id " +
            (nativeOpportunity ? "AND p.account_id=ow.account_id " : "") +
            "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
            "WHERE p.id=? AND ow.account_id=? AND (ow.reason='exclusive_owner' OR " +
            "(ow.reason IN ('shared','unassigned') AND ow.account_id=cut.primary_account_id)) FOR UPDATE",
          [r.source_ref_id, i.actorId],
        );
        if (!opportunities[0])
          throw new BusinessTaskError("task_source_not_owned", 409, "任务关联的选品归属不一致。");
        scoreOwnerReason = String(opportunities[0].ownership_reason);
      }
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
      let autoScoreJobId: string | null = null,
        autoScoreStatus: "queued" | "waiting_for_active_rule" | null = null;
      if (scoreAfterCompletion) {
        const [rules] = await c.query<RowDataPacket[]>(
          accountMode
            ? "SELECT s.id FROM score_rules s JOIN account_owned_records ow " +
                "ON ow.source_table='score_rules' AND ow.source_id=s.id " +
                (nativeRule ? "AND s.account_id=ow.account_id " : "") +
                "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
                "WHERE s.status='active' AND ow.account_id=? AND (ow.reason='exclusive_owner' OR " +
                "(ow.reason IN ('shared','unassigned') AND ow.account_id=cut.primary_account_id)) " +
                "ORDER BY s.activated_at DESC,s.id DESC LIMIT 1 FOR UPDATE"
            : "SELECT id FROM score_rules WHERE organization_id=? AND workspace_id=? AND status='active' LIMIT 1",
          accountMode ? [i.actorId] : [i.organizationId, i.workspaceId],
        );
        autoScoreStatus = rules[0] ? "queued" : "waiting_for_active_rule";
        if (rules[0]) {
          autoScoreJobId = randomUUID();
          await c.query(
            "INSERT INTO opportunity_score_jobs (id,opportunity_id," +
              "score_rule_id,trigger_task_id,status,attempt_count,available_at,request_id,trace_id," +
              "created_at,updated_at) VALUES (?,?,?,?,'queued',0,?,?,?,?,?)",
            [
              autoScoreJobId,
              String(r.source_ref_id),
              String(rules[0].id),
              i.taskId,
              now,
              i.requestId,
              i.traceId,
              now,
              now,
            ],
          );
          await c.query(
            "UPDATE opportunities SET lifecycle_entered_at=IF(lifecycle_status NOT IN " +
              "('archived','validating'),?,lifecycle_entered_at),lifecycle_status=IF(" +
              "lifecycle_status='archived',lifecycle_status,'validating'),version=version+1," +
              "updated_at=? WHERE id=?" +
              (nativeOpportunity
                ? " AND account_id=?"
                : accountMode
                  ? ""
                  : " AND organization_id=? AND workspace_id=?"),
            [
              now,
              now,
              String(r.source_ref_id),
              ...(nativeOpportunity
                ? [i.actorId]
                : accountMode
                  ? []
                  : [i.organizationId, i.workspaceId]),
            ],
          );
          if (accountMode)
            await this.mapTaskChild(
              c,
              "opportunity_score_jobs",
              autoScoreJobId,
              i.actorId,
              scoreOwnerReason!,
            );
        }
      }
      const result = {
        id: i.taskId,
        status,
        assignee_id: assignee,
        due_at: iso(due),
        progress_percent: progress,
        version,
        auto_score_status: autoScoreStatus,
        auto_score_job_id: autoScoreJobId,
      };
      const eventId = await this.record(
        c,
        i,
        `task.${i.value.action}`,
        i.taskId,
        {
          ...result,
          reason: i.value.reason,
          ...(i.value.action === "progress" ? { progress_note: i.value.progress_note } : {}),
        },
        now,
      );
      if (accountMode) {
        await this.mapTaskChild(c, "task_events", eventId, i.actorId, r.ownership_reason);
        await this.mapTaskChild(c, "outbox_events", eventId, i.actorId, r.ownership_reason);
      }
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
  async comment(command: any) {
    const c = await this.pool.getConnection(),
      now = this.now(),
      accountMode = command.accountOwnedMutation === true;
    try {
      await c.beginTransaction();
      const owned = accountMode
        ? await this.lockAccountTask(c, command.taskId, command.actorId)
        : null;
      const row =
        owned ??
        (
          await c.query<RowDataPacket[]>(
            "SELECT id,deleted_at FROM tasks WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
            [command.taskId, command.organizationId, command.workspaceId],
          )
        )[0][0];
      const i = owned ? this.legacyTaskCoordinates(command, owned) : command;
      const old = await this.operation(i, c);
      if (old) {
        await c.commit();
        return old;
      }
      if (!row || row.deleted_at)
        throw new BusinessTaskError("task_not_found", 404, "刷新任务列表。");
      await c.query(
        "INSERT INTO task_comments (id,task_id,body,created_by,created_at) VALUES (?,?,?,?,?)",
        [i.id, i.taskId, i.body, i.actorId, now],
      );
      const result = {
        id: i.id,
        task_id: i.taskId,
        body: i.body,
        created_by: i.actorId,
        created_at: now.toISOString(),
      };
      const eventId = await this.record(
        c,
        i,
        "task.comment.created",
        i.taskId,
        { comment_id: i.id },
        now,
      );
      if (accountMode) {
        await this.mapTaskChild(c, "task_comments", i.id, i.actorId, row.ownership_reason);
        await this.mapTaskChild(c, "task_events", eventId, i.actorId, row.ownership_reason);
        await this.mapTaskChild(c, "outbox_events", eventId, i.actorId, row.ownership_reason);
      }
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
  async update(command: any) {
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const owned =
        command.accountOwnedMutation === true
          ? await this.lockAccountTask(c, command.taskId, command.actorId)
          : null;
      const i = owned ? this.legacyTaskCoordinates(command, owned) : command;
      const r =
        owned ??
        (
          await c.query<RowDataPacket[]>(
            "SELECT version,deleted_at FROM tasks WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
            [i.taskId, i.organizationId, i.workspaceId],
          )
        )[0][0];
      const old = await this.operation(i, c);
      if (old) {
        await c.commit();
        return old;
      }
      if (!r || r.deleted_at) throw new BusinessTaskError("task_not_found", 404, "刷新任务列表。");
      if (owned) {
        if (
          i.value.assignee_id != null &&
          String(i.value.assignee_id).toLowerCase() !== String(r.assignee_id).toLowerCase()
        )
          throw new BusinessTaskError(
            "task_account_assignee_change_unavailable",
            409,
            "账号模式下编辑须保留原指派人。",
          );
      } else await this.ensureAssignee(i.organizationId, i.workspaceId, i.value.assignee_id);
      if (Number(r.version) !== i.value.expected_version)
        throw new BusinessTaskError("task_version_conflict", 409, "刷新任务后重试。");
      const version = Number(r.version) + 1;
      await c.query(
        "UPDATE tasks SET title=?,description=?,priority=?,assignee_id=?,due_at=?,version=?,updated_at=? WHERE id=?",
        [
          i.value.title,
          i.value.description,
          i.value.priority,
          owned ? r.assignee_id : i.value.assignee_id,
          i.value.due_at,
          version,
          now,
          i.taskId,
        ],
      );
      const result = { id: i.taskId, version };
      const event = await this.record(
        c,
        i,
        "task.updated",
        i.taskId,
        { ...result, reason: i.value.reason },
        now,
      );
      if (owned) await this.mapTaskEvent(c, event, i.actorId, String(owned.ownership_reason));
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
  async remove(command: any) {
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const owned =
        command.accountOwnedMutation === true
          ? await this.lockAccountTask(c, command.taskId, command.actorId, true)
          : null;
      const i = owned ? this.legacyTaskCoordinates(command, owned) : command;
      const r =
        owned ??
        (
          await c.query<RowDataPacket[]>(
            "SELECT version,deleted_at FROM tasks WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
            [i.taskId, i.organizationId, i.workspaceId],
          )
        )[0][0];
      const old = await this.operation(i, c);
      if (old) {
        await c.commit();
        return old;
      }
      if (!r || r.deleted_at) throw new BusinessTaskError("task_not_found", 404, "刷新任务列表。");
      if (Number(r.version) !== i.value.expected_version)
        throw new BusinessTaskError("task_version_conflict", 409, "刷新任务后重试。");
      const version = Number(r.version) + 1;
      await c.query(
        "UPDATE tasks SET deleted_at=?,deleted_by=?,version=?,updated_at=? WHERE id=?",
        [now, i.actorId, version, now, i.taskId],
      );
      const result = { id: i.taskId, deleted: true, version };
      const event = await this.record(
        c,
        i,
        "task.deleted",
        i.taskId,
        { ...result, reason: i.value.reason },
        now,
      );
      if (owned) await this.mapTaskEvent(c, event, i.actorId, String(owned.ownership_reason));
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
  private async lockAccountTask(
    c: PoolConnection,
    taskId: string,
    accountId: string,
    includeDeleted = false,
  ) {
    await requireAccountReadRehearsal(c, { lockForTransaction: true });
    const native = await nativeBusinessTaskScope(c);
    const [[row]] = await c.query<RowDataPacket[]>(
      "SELECT t.*,ow.reason AS ownership_reason FROM tasks t JOIN account_owned_records ow " +
        "ON ow.source_table='tasks' AND ow.source_id=t.id " +
        (native ? "AND ow.account_id=t.account_id " : "") +
        "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
        `WHERE t.id=? AND ow.account_id=?${includeDeleted ? "" : " AND t.deleted_at IS NULL"} AND ${sealedTaskOwner("ow")} FOR UPDATE`,
      [taskId, accountId],
    );
    if (!row) throw new BusinessTaskError("task_not_found", 404, "刷新任务列表。");
    return row;
  }
  private legacyTaskCoordinates<T extends object>(command: T, row: RowDataPacket) {
    if (row.account_id != null) return { ...command, nativeAccountTask: true };
    return {
      ...command,
      organizationId: String(row.organization_id),
      workspaceId: String(row.workspace_id),
    };
  }
  private async mapTaskEvent(c: PoolConnection, event: string, account: string, reason: string) {
    await this.mapTaskChild(c, "task_events", event, account, reason);
    await this.mapTaskChild(c, "outbox_events", event, account, reason);
  }
  private async mapTaskChild(
    c: PoolConnection,
    table: "task_events" | "task_comments" | "opportunity_score_jobs" | "outbox_events",
    id: string,
    accountId: string,
    reason: string,
  ) {
    await c.query(
      "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES (?,?,?,?)",
      [table, id, accountId, reason],
    );
  }
  private async operation(i: any, connection: Pick<PoolConnection, "query"> = this.pool) {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT result_json FROM task_operations WHERE actor_id=? AND route_key=? AND idempotency_key=?" +
        (i.accountOwnedMutation === true ? " FOR UPDATE" : ""),
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
      "INSERT INTO task_events (id,task_id,event_type," +
        "actor_id,payload_json,request_id,trace_id,created_at) VALUES (?,?,?," +
        "?,?,?,?,?)",
      [id, task, type, i.actorId, JSON.stringify(payload), i.requestId, i.traceId, now],
    );
    if (i.nativeAccountTask) {
      await c.query(
        "INSERT INTO audit_logs (id,historical_context,actor_id,action,resource_type,resource_id," +
          "request_id,trace_id,metadata_json,occurred_at,schema_version) VALUES (?,?,?,?,'task',?,?,?,?,?,1)",
        [
          randomUUID(),
          JSON.stringify({ account_id: i.actorId }),
          i.actorId,
          type,
          task,
          i.requestId,
          i.traceId,
          JSON.stringify(payload),
          now,
        ],
      );
    } else
      await appendBusinessAudit(
        c,
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
      "INSERT INTO outbox_events (id," +
        (i.nativeAccountTask ? "" : "organization_id,workspace_id,") +
        "event_type,schema_version," +
        "payload_json,status,attempt_count,available_at,request_id,trace_id,created_at," +
        "updated_at,version) VALUES (" +
        (i.nativeAccountTask ? "?,?,1" : "?,?,?,?,1") +
        ",?,'pending',0,?,?,?,?,?,1)",
      [
        id,
        ...(i.nativeAccountTask ? [] : [i.organizationId, i.workspaceId]),
        type,
        JSON.stringify({
          task_id: task,
          ...(payload as object),
          ...(i.nativeAccountTask ? { task_account_contract: 25 } : {}),
        }),
        now,
        i.requestId,
        i.traceId,
        now,
        now,
      ],
    );
    return id;
  }
}
