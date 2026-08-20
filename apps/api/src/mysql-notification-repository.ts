import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { NotificationServiceError, type NotificationRepository } from "./notification-service.js";
const parse = <T>(v: unknown): T => (typeof v === "string" ? JSON.parse(v) : (v as T)),
  iso = (v: unknown) =>
    v == null ? null : (v instanceof Date ? v : new Date(String(v))).toISOString(),
  notificationGroupKeySql = [
    "COALESCE(root_cause_key,",
    "CONCAT(category, ':', COALESCE(resource_type, 'none'), ':',",
    "COALESCE(resource_id, title)))",
  ].join(" "),
  notificationGroupKey = (row: any) =>
    row.root_cause_key ??
    `${row.category}:${row.resource_type ?? "none"}:${row.resource_id ?? row.title}`;
export class MySqlNotificationRepository implements NotificationRepository {
  constructor(
    private readonly pool: Pool,
    private readonly now = () => new Date(),
  ) {}
  async list(i: any) {
    const where = [
        "organization_id=?",
        "workspace_id=?",
        "recipient_id=?",
        "EXISTS(SELECT 1 FROM notification_deliveries d WHERE d.notification_id=notifications.id AND d.channel='in_app' AND d.status='delivered')",
      ],
      args: any[] = [i.organizationId, i.workspaceId, i.actorId];
    if (i.unread) where.push("read_at IS NULL");
    if (i.workflowStatus) {
      where.push("workflow_status=?");
      args.push(i.workflowStatus);
    }
    if (i.category) {
      where.push("category=?");
      args.push(i.category);
    }
    const baseWhere = where.join(" AND "),
      groupedSql = `
        SELECT ${notificationGroupKeySql} group_key,
               COUNT(*) group_count,
               MAX(created_at) latest_created_at
        FROM notifications
        WHERE ${baseWhere}
        GROUP BY group_key`,
      [count] = await this.pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) total FROM (${groupedSql}) notification_groups`,
        args,
      ),
      [groups] = await this.pool.query<RowDataPacket[]>(
        `${groupedSql}
         ORDER BY latest_created_at DESC,group_key DESC
         LIMIT ? OFFSET ?`,
        [...args, i.pageSize, (i.page - 1) * i.pageSize],
      );
    if (!groups.length)
      return {
        items: [],
        page: i.page,
        page_size: i.pageSize,
        total: Number(count[0]?.total ?? 0),
      };
    const keys = groups.map((row) => String(row.group_key)),
      placeholders = keys.map(() => "?").join(","),
      [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT *
         FROM notifications
         WHERE ${baseWhere}
           AND ${notificationGroupKeySql} IN (${placeholders})
         ORDER BY created_at DESC,id DESC`,
        [...args, ...keys],
      ),
      representatives = new Map<string, ReturnType<MySqlNotificationRepository["dto"]>>();
    for (const row of rows) {
      const key = notificationGroupKey(row);
      if (!representatives.has(key)) representatives.set(key, this.dto(row));
    }
    return {
      items: groups.flatMap((group) => {
        const item = representatives.get(String(group.group_key));
        return item ? [{ ...item, group_count: Number(group.group_count) }] : [];
      }),
      page: i.page,
      page_size: i.pageSize,
      total: Number(count[0]?.total ?? 0),
    };
  }
  async summary(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT category,\n              COUNT(*) total,\n              SUM(read_at IS NULL) unread," +
        "\n              SUM(workflow_status='open') open_count,\n              SUM(workflow_status='in_progress') " +
        "in_progress_count,\n              SUM(workflow_status='closed') closed_count\n       FROM " +
        "notifications\n       WHERE organization_id=?\n         AND workspace_id=?\n         AND " +
        "recipient_id=?\n         AND EXISTS(\n           SELECT 1 FROM notification_deliveries " +
        "d\n           WHERE d.notification_id=notifications.id\n             AND d.channel='in_app'\n" +
        "             AND d.status='delivered'\n         )\n       GROUP BY category",
      [i.organizationId, i.workspaceId, i.actorId],
    );
    const result = {
      total: 0,
      unread: 0,
      task: 0,
      approval: 0,
      competitor: 0,
      system: 0,
      open: 0,
      in_progress: 0,
      closed: 0,
    };
    for (const r of rows) {
      result.total += Number(r.total);
      result.unread += Number(r.unread);
      result.open += Number(r.open_count);
      result.in_progress += Number(r.in_progress_count);
      result.closed += Number(r.closed_count);
      result[r.category as "task"] = Number(r.total);
    }
    return result;
  }
  async detail(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM notifications WHERE id=? AND organization_id=? AND workspace_id=? AND " +
        "recipient_id=? AND EXISTS(SELECT 1 FROM notification_deliveries d WHERE d.notification_id=notifications.id " +
        "AND d.channel='in_app' AND d.status='delivered')",
      [i.notificationId, i.organizationId, i.workspaceId, i.actorId],
    );
    if (!rows[0])
      throw new NotificationServiceError("notification_not_found", 404, "刷新通知列表。");
    const item = this.dto(rows[0]),
      [counts] = await this.pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) group_count
         FROM notifications
         WHERE organization_id=?
           AND workspace_id=?
           AND recipient_id=?
           AND ${notificationGroupKeySql}=?
           AND EXISTS(
             SELECT 1 FROM notification_deliveries d
             WHERE d.notification_id=notifications.id
               AND d.channel='in_app'
               AND d.status='delivered'
           )`,
        [i.organizationId, i.workspaceId, i.actorId, notificationGroupKey(rows[0])],
      );
    return { ...item, group_count: Number(counts[0]?.group_count ?? 1) };
  }
  async action(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
          "SELECT * FROM notifications WHERE id=? AND organization_id=? AND workspace_id=? AND " +
            "recipient_id=? AND EXISTS(SELECT 1 FROM notification_deliveries d WHERE d.notification_id=notifications.id " +
            "AND d.channel='in_app' AND d.status='delivered') FOR UPDATE",
          [i.notificationId, i.organizationId, i.workspaceId, i.actorId],
        ),
        row = rows[0];
      if (!row) throw new NotificationServiceError("notification_not_found", 404, "刷新通知列表。");
      if (Number(row.version) !== i.value.expected_version)
        throw new NotificationServiceError(
          "notification_version_conflict",
          409,
          "刷新通知后重试。",
        );
      const next = Number(row.version) + 1,
        readAt = i.value.action === "read" ? now : i.value.action === "unread" ? null : row.read_at,
        workflowStatus =
          i.value.action === "start"
            ? "in_progress"
            : i.value.action === "close"
              ? "closed"
              : i.value.action === "reopen"
                ? "open"
                : row.workflow_status;
      await c.query(
        "UPDATE notifications SET read_at=?,workflow_status=?,version=?,updated_at=? WHERE id=?",
        [readAt, workflowStatus, next, now, i.notificationId],
      );
      const result = {
        id: i.notificationId,
        read_at: iso(readAt),
        workflow_status: workflowStatus,
        version: next,
      };
      await this.audit(c, i, `notification.${i.value.action}`, i.notificationId, result, now);
      await this.save(c, i, i.notificationId, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async markAll(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [result]: any = await c.query(
        "UPDATE notifications SET read_at=?,version=version+1,updated_at=? WHERE organization_id=? " +
          "AND workspace_id=? AND recipient_id=? AND read_at IS NULL AND EXISTS(SELECT 1 FROM notification_deliveries " +
          "d WHERE d.notification_id=notifications.id AND d.channel='in_app' AND d.status='delivered')",
        [now, now, i.organizationId, i.workspaceId, i.actorId],
      );
      const value = {
        updated: Number(result.affectedRows),
        read_at: now.toISOString(),
      };
      await this.audit(c, i, "notification.read_all", i.actorId, value, now);
      await this.save(c, i, i.actorId, value, now);
      await c.commit();
      return value;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async preferences(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM notification_preferences WHERE organization_id=? AND workspace_id=? AND user_id=?",
      [i.organizationId, i.workspaceId, i.actorId],
    );
    return rows[0]
      ? this.pref(rows[0])
      : {
          in_app_enabled: true,
          email_enabled: false,
          task_enabled: true,
          approval_enabled: true,
          competitor_enabled: true,
          version: 1,
        };
  }
  async updatePreferences(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
          "SELECT * FROM notification_preferences WHERE organization_id=? AND workspace_id=? AND user_id=? FOR UPDATE",
          [i.organizationId, i.workspaceId, i.actorId],
        ),
        row = rows[0];
      if (row && Number(row.version) !== i.value.expected_version)
        throw new NotificationServiceError(
          "notification_version_conflict",
          409,
          "刷新偏好后重试。",
        );
      if (!row && i.value.expected_version !== 1)
        throw new NotificationServiceError(
          "notification_version_conflict",
          409,
          "刷新偏好后重试。",
        );
      const next = row ? Number(row.version) + 1 : 2;
      if (row)
        await c.query(
          "UPDATE notification_preferences SET in_app_enabled=?,email_enabled=?,task_enabled=?," +
            "approval_enabled=?,competitor_enabled=?,version=?,updated_at=? WHERE id=?",
          [
            i.value.in_app_enabled,
            i.value.email_enabled,
            i.value.task_enabled,
            i.value.approval_enabled,
            i.value.competitor_enabled,
            next,
            now,
            row.id,
          ],
        );
      else
        await c.query(
          "INSERT INTO notification_preferences (id,organization_id,workspace_id,user_id," +
            "in_app_enabled,email_enabled,task_enabled,approval_enabled,competitor_enabled," +
            "version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
          [
            randomUUID(),
            i.organizationId,
            i.workspaceId,
            i.actorId,
            i.value.in_app_enabled,
            i.value.email_enabled,
            i.value.task_enabled,
            i.value.approval_enabled,
            i.value.competitor_enabled,
            next,
            now,
            now,
          ],
        );
      const result = { ...i.value, version: next };
      delete result.expected_version;
      await this.audit(c, i, "notification.preferences.updated", i.actorId, result, now);
      await this.save(c, i, i.actorId, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  private dto(r: RowDataPacket) {
    const actionRoute = r.resource_id
      ? r.resource_type === "task"
        ? `/tasks?task=${r.resource_id}`
        : r.resource_type === "approval"
          ? `/tasks/approvals?approval=${r.resource_id}`
          : r.resource_type === "competitor"
            ? `/competitors?competitor=${r.resource_id}`
            : r.resource_type === "opportunity"
              ? `/opportunities/${r.resource_id}`
              : r.resource_type === "collection_task"
                ? `/platform-admin/collection?task=${r.resource_id}`
                : "/platform-admin/status"
      : "/platform-admin/status";
    return {
      id: String(r.id),
      category: String(r.category),
      severity: String(r.severity),
      title: String(r.title),
      body: String(r.body),
      resource_type: r.resource_type ? String(r.resource_type) : null,
      resource_id: r.resource_id ? String(r.resource_id) : null,
      root_cause_key: r.root_cause_key ? String(r.root_cause_key) : null,
      workflow_status: String(r.workflow_status ?? "open"),
      action_route: actionRoute,
      read_at: iso(r.read_at),
      version: Number(r.version),
      created_at: iso(r.created_at),
    };
  }
  private pref(r: RowDataPacket) {
    return {
      in_app_enabled: Boolean(r.in_app_enabled),
      email_enabled: Boolean(r.email_enabled),
      task_enabled: Boolean(r.task_enabled),
      approval_enabled: Boolean(r.approval_enabled),
      competitor_enabled: Boolean(r.competitor_enabled),
      version: Number(r.version),
    };
  }
  private async operation(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT result_json FROM notification_operations WHERE actor_id=? AND route_key=? AND idempotency_key=?",
      [i.actorId, i.route, i.idempotencyKey],
    );
    return rows[0] ? parse(rows[0].result_json) : null;
  }
  private save(c: PoolConnection, i: any, id: string, result: unknown, now: Date) {
    return c.query(
      "INSERT INTO notification_operations (id,actor_id,route_key,idempotency_key," +
        "resource_id,result_json,created_at) VALUES (?,?,?,?,?,?,?)",
      [randomUUID(), i.actorId, i.route, i.idempotencyKey, id, JSON.stringify(result), now],
    );
  }
  private audit(
    c: PoolConnection,
    i: any,
    action: string,
    id: string,
    payload: unknown,
    now: Date,
  ) {
    return c.query(
      "INSERT INTO audit_logs (id,organization_id,workspace_id,actor_id,action," +
        "resource_type,resource_id,request_id,trace_id,metadata_json,occurred_at," +
        "schema_version) VALUES (?,?,?,?,?,'notification',?,?,?,?,?,1)",
      [
        randomUUID(),
        i.organizationId,
        i.workspaceId,
        i.actorId,
        action,
        id,
        i.requestId,
        i.traceId,
        JSON.stringify(payload),
        now,
      ],
    );
  }
}
