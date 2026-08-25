import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
export async function projectBusinessTaskOnce(pool: Pool, workerId: string, leaseSeconds: number) {
  const competitor = await projectCompetitorOutboxOnce(pool);
  if (competitor.status !== "idle") return competitor;
  return projectSourcingPurchaseOnce(pool, workerId, leaseSeconds);
}

async function projectCompetitorOutboxOnce(pool: Pool) {
  const c = await pool.getConnection(),
    now = new Date();
  try {
    await c.beginTransaction();
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT o.*,c.title,c.created_by,COALESCE(e.request_id,j.request_id) source_request_id," +
        "COALESCE(e.trace_id,j.trace_id) source_trace_id FROM competitor_outbox o " +
        "JOIN competitors c ON c.id=o.aggregate_id AND c.organization_id=o.organization_id " +
        "AND c.workspace_id=o.workspace_id LEFT JOIN competitor_events e ON e.id=o.id " +
        "LEFT JOIN competitor_changes ch ON ch.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.change_id')) USING ascii) " +
        "LEFT JOIN competitor_snapshot_jobs j ON j.snapshot_id=ch.snapshot_id " +
        "WHERE o.status='pending' AND o.available_at<=? ORDER BY o.available_at,o.id LIMIT 1 FOR UPDATE",
      [now],
    );
    const event = rows[0];
    if (!event) {
      await c.commit();
      return { status: "idle" as const };
    }
    const payload =
        typeof event.payload_json === "string"
          ? JSON.parse(event.payload_json)
          : event.payload_json,
      threshold = event.event_type === "competitor.threshold.triggered",
      changeId = threshold ? String(payload.change_id ?? "") : "",
      recipientId = String(event.created_by),
      requestId = String(event.source_request_id ?? "competitor-outbox").slice(0, 64),
      traceId = String(event.source_trace_id ?? requestId).slice(0, 64);
    let taskId: string | null = null;
    if (threshold) {
      if (!/^[0-9a-f-]{36}$/i.test(changeId)) throw new Error("competitor_change_id_invalid");
      const candidateTaskId = randomUUID(),
        field = String(payload.field ?? "竞品字段").slice(0, 80),
        previous = String(payload.previous ?? "未提供").slice(0, 120),
        current = String(payload.current ?? "未提供").slice(0, 120),
        evidenceId = String(payload.evidence_id ?? "未提供").slice(0, 120),
        changedAt = String(payload.changed_at ?? "未提供").slice(0, 80);
      await c.query(
        "INSERT IGNORE INTO tasks (id,organization_id,workspace_id,title,description,status," +
          "priority,assignee_id,source_type,source_ref_id,due_at,completed_at,created_by,version," +
          "created_at,updated_at) VALUES (?,?,?,? ,?,'todo','high',?,'selection_verification',? ," +
          "NULL,NULL,?,1,?,?)",
        [
          candidateTaskId,
          event.organization_id,
          event.workspace_id,
          `复核竞品变化 · ${field} · ${String(event.title)}`.slice(0, 200),
          `竞品 ${event.aggregate_id} 的监控阈值已触发。\n字段：${field}\n变化：${previous} → ${current}\n证据：${evidenceId}\n采集时间：${changedAt}\n请核对原始证据后记录结论，不覆盖竞品快照历史。`,
          recipientId,
          changeId,
          recipientId,
          now,
          now,
        ],
      );
      const [tasks] = await c.query<RowDataPacket[]>(
        "SELECT id FROM tasks WHERE organization_id=? AND workspace_id=? AND " +
          "source_type='selection_verification' AND source_ref_id=? LIMIT 1",
        [event.organization_id, event.workspace_id, changeId],
      );
      if (!tasks[0]) throw new Error("competitor_validation_task_missing");
      taskId = String(tasks[0].id);
      await c.query(
        "UPDATE competitor_alerts SET task_status='created',updated_at=? WHERE id=? AND " +
          "organization_id=? AND workspace_id=?",
        [now, event.id, event.organization_id, event.workspace_id],
      );
    }
    const notificationPayload = {
      ...payload,
      resource_type: "competitor",
      resource_id: String(event.aggregate_id),
      ...(threshold ? { recipient_id: recipientId, task_id: taskId } : {}),
    };
    await c.query(
      "INSERT IGNORE INTO outbox_events (id,organization_id,workspace_id,event_type," +
        "schema_version,payload_json,status,attempt_count,available_at,leased_at," +
        "lease_expires_at,published_at,request_id,trace_id,created_at,updated_at,version) " +
        "VALUES (?,?,?, ?,1,?,'pending',0,?,NULL,NULL,NULL,?,?,?, ?,1)",
      [
        event.id,
        event.organization_id,
        event.workspace_id,
        event.event_type,
        JSON.stringify(notificationPayload),
        now,
        requestId,
        traceId,
        now,
        now,
      ],
    );
    await c.query("UPDATE competitor_outbox SET status='delivered' WHERE id=?", [event.id]);
    await c.commit();
    return {
      status: "projected" as const,
      event_id: String(event.id),
      ...(taskId ? { taskId } : {}),
    };
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    c.release();
  }
}

async function projectSourcingPurchaseOnce(pool: Pool, workerId: string, leaseSeconds: number) {
  const c = await pool.getConnection(),
    now = new Date(),
    lease = new Date(now.valueOf() + leaseSeconds * 1000);
  let event: any = null;
  try {
    await c.beginTransaction();
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT * FROM sourcing_outbox WHERE event_type='sourcing.purchase_task.queued' AND ((status='queued' AND available_at<=?) OR (status='leased' AND lease_expires_at<?)) ORDER BY available_at,id LIMIT 1 FOR UPDATE",
      [now, now],
    );
    event = rows[0];
    if (!event) {
      await c.commit();
      return { status: "idle" as const };
    }
    await c.query(
      "UPDATE sourcing_outbox SET status='leased',leased_by=?,leased_at=?,lease_expires_at=? WHERE id=?",
      [workerId, now, lease, event.id],
    );
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
  const payload =
      typeof event.payload_json === "string" ? JSON.parse(event.payload_json) : event.payload_json,
    taskId = randomUUID();
  try {
    await pool.query(
      "INSERT IGNORE INTO tasks (id,organization_id,workspace_id,title,description,status,priority,assignee_id,source_type,source_ref_id,due_at,completed_at,created_by,version,created_at,updated_at) SELECT ?,p.organization_id,p.workspace_id,CONCAT('处理采购任务 · ',LEFT(CONVERT(p.id USING utf8mb4),8)),CONCAT('来源于已排队采购任务 ',CONVERT(p.id USING utf8mb4)),'todo','normal',p.created_by,'sourcing_purchase',p.id,NULL,NULL,p.created_by,1,?,? FROM sourcing_purchase_tasks p WHERE p.id=? AND p.organization_id=? AND p.workspace_id=?",
      [taskId, now, now, payload.id, event.organization_id, event.workspace_id],
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id,created_by FROM tasks WHERE organization_id=? AND workspace_id=? AND source_type='sourcing_purchase' AND source_ref_id=?",
      [event.organization_id, event.workspace_id, payload.id],
    );
    if (!rows[0]) throw new Error("purchase_task_scope_invalid");
    await pool.query(
      "UPDATE sourcing_outbox SET status='published',leased_by=NULL,leased_at=NULL,lease_expires_at=NULL WHERE id=?",
      [event.id],
    );
    return { status: "projected" as const, taskId: String(rows[0].id) };
  } catch (e) {
    await pool.query(
      "UPDATE sourcing_outbox SET status='queued',available_at=DATE_ADD(NOW(3),INTERVAL 60 SECOND),lease_expires_at=NULL WHERE id=?",
      [event.id],
    );
    throw e;
  }
}
