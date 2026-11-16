import { notificationScopeRelation } from "@scoutops/database";
import { appendBusinessAudit, appendPlatformAudit, notificationsHaveLegacyScope } from "@scoutops/database";
import { randomUUID } from "node:crypto";
import { realtimeEventScopeColumns } from "@scoutops/database";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { RealtimeRepository } from "./realtime-service.js";
const parse = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);
export class MySqlRealtimeRepository implements RealtimeRepository {
  private scopeLayout: Promise<boolean> | undefined;
  constructor(private readonly pool: Pool) {}
  async replay(i: any) {
    const legacy = await (this.scopeLayout ??= realtimeEventScopeColumns(this.pool).catch((error) => {
      this.scopeLayout = undefined;
      throw error;
    }));
    if (i.accountOwned && (legacy || await notificationsHaveLegacyScope(this.pool)))
      throw new Error("realtime_account_schema_not_ready");
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT r.id,r.event_type,r.notification_id,r.payload_json,r.created_at FROM realtime_events r " +
        (i.accountOwned ? "JOIN notifications n ON n.id=r.notification_id AND n.recipient_id=r.recipient_id " +
          "WHERE EXISTS (SELECT 1 FROM notification_deliveries d WHERE d.notification_id=n.id " +
          "AND d.recipient_id=n.recipient_id AND d.channel='in_app' AND d.status='delivered') " : legacy
          ? "WHERE r.organization_id=? AND r.workspace_id=? "
          : `JOIN ${await notificationScopeRelation(this.pool)} n ON n.id=r.notification_id AND n.recipient_id=r.recipient_id ` +
            "WHERE n.organization_id=? AND n.workspace_id=? ") +
        "AND r.recipient_id=? AND r.id>? ORDER BY r.id LIMIT ?",
      [...(i.accountOwned ? [] : [i.organizationId, i.workspaceId]), i.actorId, i.afterId, i.limit],
    );
    return rows.map((r) => ({
      id: Number(r.id),
      event_type: String(r.event_type),
      notification_id: String(r.notification_id),
      payload: parse(r.payload_json),
      created_at: (r.created_at instanceof Date
        ? r.created_at
        : new Date(String(r.created_at))
      ).toISOString(),
    }));
  }
  async auditConnect(i: any) {
    if (i.accountOwned) {
      await appendPlatformAudit(this.pool,
      "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) " +
      "VALUES(?,NULL,NULL,?,'realtime.connected','realtime_stream',?,'succeeded',?,?,?,?,1)",
      [randomUUID(), i.actorId, i.actorId, i.requestId, i.traceId, JSON.stringify({ after_id: i.afterId }), new Date()],
      );
      return;
    }
    await appendBusinessAudit(this.pool,
        "INSERT INTO audit_logs (id,organization_id,workspace_id,actor_id,action," +
        "resource_type,resource_id,request_id,trace_id,metadata_json,occurred_at," +
        "schema_version) VALUES (?,?,?,?, 'realtime.connected','realtime_stream'," +
        "?,?,?,?,?,1)",
      [
        randomUUID(),
        i.organizationId,
        i.workspaceId,
        i.actorId,
        i.actorId,
        i.requestId,
        i.traceId,
        JSON.stringify({ after_id: i.afterId }),
        new Date(),
      ],
    );
  }
}
