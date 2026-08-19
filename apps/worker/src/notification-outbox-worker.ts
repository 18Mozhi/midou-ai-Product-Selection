import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
const parse = (v: unknown) =>
  typeof v === "string" ? JSON.parse(v) : (v as any);
export const notificationBody = (category: string) =>
  ({
    approval: "审批状态已变化，请查看关联记录。",
    competitor: "竞品监控状态已变化，请查看关联记录。",
    system: "系统状态已变化，请查看关联记录。",
    task: "任务状态已变化，请查看关联记录。",
  })[category] ?? "业务状态已变化，请查看关联记录。";
export class NotificationOutboxWorker {
  constructor(
    private readonly pool: Pool,
    private readonly leaseSeconds: number,
    private readonly retryLimit: number,
    private readonly now = () => new Date(),
  ) {}
  async processOnce() {
    const c = await this.pool.getConnection(),
      now = this.now();
    let event: any;
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM outbox_events WHERE ((status='pending' AND available_at<=?) OR (status='leased' AND lease_expires_at<=?)) AND (event_type LIKE 'task.%' OR event_type LIKE 'approval.%' OR event_type LIKE 'competitor.%' OR event_type='automation.notification.queued') ORDER BY available_at,id LIMIT 1 FOR UPDATE",
        [now, now],
      );
      event = rows[0];
      if (!event) {
        await c.commit();
        return { status: "idle" as const };
      }
      await c.query(
        "UPDATE outbox_events SET status='leased',leased_at=?,lease_expires_at=DATE_ADD(?,INTERVAL ? SECOND),attempt_count=attempt_count+1,version=version+1,updated_at=? WHERE id=?",
        [now, now, this.leaseSeconds, now, event.id],
      );
      await c.commit();
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
    try {
      const payload = parse(event.payload_json),
        category = String(event.event_type).startsWith("approval.")
          ? "approval"
          : String(event.event_type).startsWith("competitor.")
            ? "competitor"
            : String(event.event_type).startsWith("automation.")
              ? "system"
              : "task",
        recipients = await this.recipients(event, payload);
      for (const recipient of recipients)
        await this.create(event, payload, category, recipient, now);
      await this.pool.query(
        "UPDATE outbox_events SET status='published',published_at=?,lease_expires_at=NULL,version=version+1,updated_at=? WHERE id=?",
        [now, now, event.id],
      );
      return {
        status: "published" as const,
        event_id: String(event.id),
        notifications: recipients.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      await this.pool.query(
        "UPDATE outbox_events SET status=IF(attempt_count>=?,'dead_letter','pending'),available_at=DATE_ADD(?,INTERVAL 60 SECOND),lease_expires_at=NULL,updated_at=? WHERE id=?",
        [this.retryLimit, now, now, event.id],
      );
      return {
        status: "failed" as const,
        event_id: String(event.id),
        error: message,
      };
    }
  }
  private async recipients(event: any, p: any) {
    const direct = p.recipient_id ?? p.active_approver_id ?? p.assignee_id;
    if (direct) return [String(direct)];
    if (String(event.event_type).startsWith("approval.")) {
      const requestId = p.approval_request_id ?? p.resource_id;
      if (requestId) {
        const [rows] = await this.pool.query<RowDataPacket[]>(
          "SELECT requested_by FROM approval_requests WHERE id=? AND organization_id=? AND workspace_id=? UNION SELECT active_approver_id FROM approval_node_runs WHERE approval_request_id=? AND organization_id=? AND workspace_id=? AND status='pending'",
          [
            requestId,
            event.organization_id,
            event.workspace_id,
            requestId,
            event.organization_id,
            event.workspace_id,
          ],
        );
        return [
          ...new Set(
            rows
              .map((r) => String(r.requested_by ?? r.active_approver_id))
              .filter(Boolean),
          ),
        ];
      }
    }
    return [];
  }
  private async create(
    event: any,
    p: any,
    category: string,
    recipient: string,
    now: Date,
  ) {
    const [prefs] = await this.pool.query<RowDataPacket[]>(
        "SELECT * FROM notification_preferences WHERE organization_id=? AND workspace_id=? AND user_id=?",
        [event.organization_id, event.workspace_id, recipient],
      ),
      pref = prefs[0],
      categoryEnabled = !pref || Boolean(pref[`${category}_enabled`]),
      inApp = !pref || Boolean(pref.in_app_enabled),
      email = Boolean(pref?.email_enabled);
    if (!categoryEnabled) return;
    const title =
        category === "system" && p.title
          ? String(p.title)
          : category === "approval"
          ? "审批状态更新"
          : category === "competitor"
            ? "竞品监控更新"
            : "任务状态更新",
      body = notificationBody(category),
      resourceType = p.resource_type ?? category,
      resourceId = p.resource_id ?? p.task_id ?? p.approval_request_id ?? null,
      notificationId = randomUUID();
    await this.pool.query(
      "INSERT IGNORE INTO notifications (id,organization_id,workspace_id,recipient_id,source_event_id,category,severity,title,body,resource_type,resource_id,root_cause_key,read_at,workflow_status,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL,'open',1,?,?)",
      [
        notificationId,
        event.organization_id,
        event.workspace_id,
        recipient,
        event.id,
        category,
        event.event_type === "approval.overdue" ? "warning" : "info",
        title,
        body,
        resourceType,
        resourceId,
        `${String(event.event_type).slice(0,100)}:${String(resourceType).slice(0,80)}:${String(resourceId ?? "none").slice(0,36)}`,
        now,
        now,
      ],
    );
    const [found] = await this.pool.query<RowDataPacket[]>(
        "SELECT id FROM notifications WHERE source_event_id=? AND recipient_id=?",
        [event.id, recipient],
      ),
      id = String(found[0]!.id);
    try {
      await this.pool.query(
        "INSERT IGNORE INTO realtime_events (organization_id,workspace_id,recipient_id,notification_id,event_type,payload_json,created_at) VALUES (?,?,?,?, 'notification.changed',?,?)",
        [
          event.organization_id,
          event.workspace_id,
          recipient,
          id,
          JSON.stringify({
            notification_id: id,
            category,
            severity:
              event.event_type === "approval.overdue" ? "warning" : "info",
          }),
          now,
        ],
      );
    } catch (error) {
      if ((error as { code?: string }).code !== "ER_NO_SUCH_TABLE") throw error;
    }
    await this.pool.query(
      "INSERT IGNORE INTO notification_deliveries (id,organization_id,workspace_id,notification_id,recipient_id,channel,status,attempt_count,created_at,updated_at) VALUES (?,?,?,?,?,'in_app',?,0,?,?)",
      [
        randomUUID(),
        event.organization_id,
        event.workspace_id,
        id,
        recipient,
        inApp ? "delivered" : "suppressed",
        now,
        now,
      ],
    );
    await this.pool.query(
      "INSERT IGNORE INTO notification_deliveries (id,organization_id,workspace_id,notification_id,recipient_id,channel,status,attempt_count,provider_ref,created_at,updated_at) VALUES (?,?,?,?,?,'email',?,0,'placeholder:no-provider',?,?)",
      [
        randomUUID(),
        event.organization_id,
        event.workspace_id,
        id,
        recipient,
        email ? "pending_placeholder" : "suppressed",
        now,
        now,
      ],
    );
  }
}
