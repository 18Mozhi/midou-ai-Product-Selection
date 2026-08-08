import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { buildScopedFilePath, writeScopedFile } from "@scoutops/storage";
export const csvCell = (value: unknown) => {
  let text =
    value == null
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
export const csvBuffer = (rows: Record<string, unknown>[]) => {
  const headers = rows.length ? Object.keys(rows[0]!) : ["empty"];
  return Buffer.from(
    `\ufeff${[headers, ...rows.map((row) => headers.map((h) => row[h]))].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`,
    "utf8",
  );
};
export class ReportExportWorker {
  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly root: string,
    private readonly leaseSeconds: number,
    private readonly retryLimit: number,
    private readonly maxRows: number,
    private readonly now = () => new Date(),
  ) {}
  async processOnce() {
    await this.expire();
    const job: any = await this.claim();
    if (!job) return { status: "idle" as const };
    const now = this.now();
    try {
      const rows = await this.rows(job);
      if (rows.length > this.maxRows)
        throw Object.assign(new Error("report row limit exceeded"), {
          code: "row_limit_exceeded",
        });
      const content = csvBuffer(rows);
      await writeScopedFile(
        this.root,
        {
          organization_id: String(job.organization_id) as any,
          workspace_id: String(job.workspace_id) as any,
          category: "export",
          resource_id: String(job.id),
          filename: String(job.filename),
        },
        content,
      );
      const connection = await this.pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          "UPDATE report_exports SET status='succeeded',row_count=?,byte_size=?,lease_expires_at=NULL,last_error_code=NULL,version=version+1,updated_at=? WHERE id=?",
          [rows.length, content.byteLength, now, job.id],
        );
        await this.record(
          job,
          "report.export.succeeded",
          {
            row_count: rows.length,
            byte_size: content.byteLength,
          },
          connection,
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return {
        status: "succeeded" as const,
        export_id: String(job.id),
        row_count: rows.length,
        byte_size: content.byteLength,
      };
    } catch (error) {
      const dead = Number(job.attempt_count) >= this.retryLimit,
        code = String((error as any)?.code ?? "export_failed").slice(0, 80);
      await this.pool.query(
        "UPDATE report_exports SET status=?,available_at=DATE_ADD(?,INTERVAL 60 SECOND),lease_expires_at=NULL,last_error_code=?,version=version+1,updated_at=? WHERE id=?",
        [dead ? "dead_letter" : "retry_scheduled", now, code, now, job.id],
      );
      return {
        status: dead ? ("dead_letter" as const) : ("retry_scheduled" as const),
        export_id: String(job.id),
        error_code: code,
      };
    }
  }
  private async rows(job: any) {
    if (job.report_type === "opportunity") {
      const [rows] = await this.pool.query<RowDataPacket[]>(
        "SELECT id,name,market,category,lifecycle_status,recommendation_status,overall_score,coverage_status,decision_status,evidence_count,source_count,updated_at FROM opportunities WHERE organization_id=? AND workspace_id=? ORDER BY updated_at DESC,id LIMIT ?",
        [job.organization_id, job.workspace_id, this.maxRows + 1],
      );
      return rows;
    }
    if (job.report_type === "trend") {
      const [rows] = await this.pool.query<RowDataPacket[]>(
        "SELECT id,title,market,category,status,signal_count,source_count,heat_value,momentum_percent,confidence_status,last_seen_at FROM trend_topics WHERE organization_id=? AND workspace_id=? ORDER BY last_seen_at DESC,id LIMIT ?",
        [job.organization_id, job.workspace_id, this.maxRows + 1],
      );
      return rows;
    }
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT m.user_id,u.email,COUNT(t.id) task_total,SUM(t.status='todo') todo,SUM(t.status='in_progress') in_progress,SUM(t.status='completed') completed,SUM(t.status IN ('todo','in_progress') AND t.due_at IS NOT NULL AND t.due_at<?) overdue FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN tasks t ON t.organization_id=m.organization_id AND t.workspace_id=? AND t.assignee_id=m.user_id WHERE m.organization_id=? AND m.status='active' GROUP BY m.user_id,u.email ORDER BY completed DESC,u.email LIMIT ?",
      [this.now(), job.workspace_id, job.organization_id, this.maxRows + 1],
    );
    return rows;
  }
  private async claim() {
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
          "SELECT * FROM report_exports WHERE ((status IN ('queued','retry_scheduled') AND available_at<=?) OR (status='leased' AND lease_expires_at<=?)) AND expires_at>? ORDER BY available_at,id LIMIT 1 FOR UPDATE",
          [now, now, now],
        ),
        row = rows[0];
      if (!row) {
        await c.commit();
        return null;
      }
      await c.query(
        "UPDATE report_exports SET status='leased',attempt_count=attempt_count+1,leased_by=?,lease_expires_at=DATE_ADD(?,INTERVAL ? SECOND),version=version+1,updated_at=? WHERE id=?",
        [this.workerId, now, this.leaseSeconds, now, row.id],
      );
      await c.commit();
      return { ...row, attempt_count: Number(row.attempt_count) + 1 };
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  private async expire() {
    const now = this.now(),
      [rows] = await this.pool.query<RowDataPacket[]>(
        "SELECT id,organization_id,workspace_id,filename FROM report_exports WHERE status='succeeded' AND expires_at<=? LIMIT 100",
        [now],
      );
    for (const row of rows) {
      const path = buildScopedFilePath(this.root, {
        organization_id: String(row.organization_id) as any,
        workspace_id: String(row.workspace_id) as any,
        category: "export",
        resource_id: String(row.id),
        filename: String(row.filename),
      });
      await rm(path, { force: true });
      await this.pool.query(
        "UPDATE report_exports SET status='expired',version=version+1,updated_at=? WHERE id=? AND status='succeeded'",
        [now, row.id],
      );
    }
  }
  private async record(
    job: any,
    event: string,
    payload: any,
    queryable: any = this.pool,
  ) {
    const now = this.now();
    await queryable.query(
      "INSERT INTO audit_logs (id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,request_id,trace_id,metadata_json,occurred_at,schema_version) VALUES (?,?,?,?,?,'report_export',?,?,?,?,?,1)",
      [
        randomUUID(),
        job.organization_id,
        job.workspace_id,
        job.created_by,
        event,
        job.id,
        job.request_id,
        job.trace_id,
        JSON.stringify(payload),
        now,
      ],
    );
    await queryable.query(
      "INSERT INTO outbox_events (id,organization_id,workspace_id,event_type,schema_version,payload_json,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at,version) VALUES (?,?,?,?,1,?,'pending',0,?,?,?,?,?,1)",
      [
        randomUUID(),
        job.organization_id,
        job.workspace_id,
        event,
        JSON.stringify({
          resource_type: "report_export",
          resource_id: String(job.id),
          ...payload,
        }),
        now,
        job.request_id,
        job.trace_id,
        now,
        now,
      ],
    );
  }
}
