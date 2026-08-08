import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { RealtimeRepository } from "./realtime-service.js";
const parse = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);
export class MySqlRealtimeRepository implements RealtimeRepository {
  constructor(private readonly pool: Pool) {}
  async replay(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT id,event_type,notification_id,payload_json,created_at FROM realtime_events WHERE organization_id=? AND workspace_id=? AND recipient_id=? AND id>? ORDER BY id LIMIT ?",
      [i.organizationId, i.workspaceId, i.actorId, i.afterId, i.limit],
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
    await this.pool.query(
      "INSERT INTO audit_logs (id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,request_id,trace_id,metadata_json,occurred_at,schema_version) VALUES (?,?,?,?, 'realtime.connected','realtime_stream',?,?,?,?,?,1)",
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
