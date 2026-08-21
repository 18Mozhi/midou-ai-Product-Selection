import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
export async function projectBusinessTaskOnce(pool: Pool, workerId: string, leaseSeconds: number) {
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
      "INSERT IGNORE INTO tasks (id,organization_id,workspace_id,title,description,status,priority,assignee_id,source_type,source_ref_id,due_at,completed_at,created_by,version,created_at,updated_at) SELECT ?,p.organization_id,p.workspace_id,CONCAT('处理采购任务 · ',LEFT(p.id,8)),CONCAT('来源于已排队采购任务 ',p.id),'todo','normal',p.created_by,'sourcing_purchase',p.id,NULL,NULL,p.created_by,1,?,? FROM sourcing_purchase_tasks p WHERE p.id=? AND p.organization_id=? AND p.workspace_id=?",
      [taskId, now, now, payload.id, event.organization_id, event.workspace_id],
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id,created_by FROM tasks WHERE organization_id=? AND workspace_id=? AND source_type='sourcing_purchase' AND source_ref_id=?",
      [event.organization_id, event.workspace_id, payload.id],
    );
    if (!rows[0]) throw new Error("purchase_task_scope_invalid");
    await pool.query(
      "UPDATE sourcing_outbox SET status='published',published_at=?,lease_expires_at=NULL WHERE id=?",
      [new Date(), event.id],
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
