import { randomUUID } from "node:crypto";
import type { PoolConnection } from "mysql2/promise";
import { appendPlatformAudit } from "./platform-audit-storage.js";

export async function recordAccountReportExport(
  db: Pick<PoolConnection, "query">,
  i: {
    accountId: string;
    exportId: string;
    event: string;
    requestId: string;
    traceId: string;
    payload: unknown;
    now: Date;
  },
) {
  await appendPlatformAudit(
    db,
    "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) VALUES(?,NULL,NULL,?,?,'report_export',?,'succeeded',?,?,?,?,1)",
    [
      randomUUID(),
      i.accountId,
      i.event,
      i.exportId,
      i.requestId,
      i.traceId,
      JSON.stringify(i.payload),
      i.now,
    ],
  );
  await db.query(
    "INSERT INTO report_export_events(id,export_id,event_type,payload_json,request_id,trace_id,occurred_at) VALUES(?,?,?,?,?,?,?)",
    [randomUUID(), i.exportId, i.event, JSON.stringify(i.payload), i.requestId, i.traceId, i.now],
  );
}
