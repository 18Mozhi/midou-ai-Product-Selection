import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { ReportServiceError, type ReportRepository } from "./report-service.js";
const parse = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v),
  iso = (v: unknown) =>
    v == null ? null : (v instanceof Date ? v : new Date(String(v))).toISOString();
export class MySqlReportRepository implements ReportRepository {
  constructor(
    private readonly pool: Pool,
    private readonly now = () => new Date(),
  ) {}
  async report(i: any) {
    if (i.reportType === "opportunity") return this.opportunities(i);
    if (i.reportType === "trend") return this.trends(i);
    return this.team(i);
  }
  private async opportunities(i: any) {
    const [summary] = await this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) total,SUM(decision_status='adopted') adopted,SUM(decision_status='observing') " +
          "observing,SUM(decision_status='rejected') rejected,SUM(coverage_status='complete') complete_coverage," +
          "ROUND(AVG(overall_score),2) average_score,MAX(updated_at) observed_at FROM opportunities " +
          "WHERE organization_id=? AND workspace_id=?",
        [i.organizationId, i.workspaceId],
      ),
      [groups] = await this.pool.query<RowDataPacket[]>(
        "SELECT recommendation_status label,COUNT(*) value FROM opportunities WHERE organization_id=? " +
          "AND workspace_id=? GROUP BY recommendation_status ORDER BY label",
        [i.organizationId, i.workspaceId],
      );
    return {
      type: "opportunity",
      summary: {
        total: Number(summary[0]?.total ?? 0),
        adopted: Number(summary[0]?.adopted ?? 0),
        observing: Number(summary[0]?.observing ?? 0),
        rejected: Number(summary[0]?.rejected ?? 0),
        complete_coverage: Number(summary[0]?.complete_coverage ?? 0),
        average_score: summary[0]?.average_score == null ? null : Number(summary[0].average_score),
      },
      series: groups.map((r) => ({
        label: String(r.label),
        value: Number(r.value),
      })),
      observed_at: iso(summary[0]?.observed_at),
    };
  }
  private async trends(i: any) {
    const [summary] = await this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) total,COALESCE(SUM(signal_count),0) signals,COALESCE(SUM(source_count)," +
          "0) sources,ROUND(AVG(momentum_percent),2) average_momentum,ROUND(AVG(confidence_score)," +
          "2) average_confidence,MAX(last_seen_at) observed_at FROM trend_topics WHERE organization_id=? " +
          "AND workspace_id=?",
        [i.organizationId, i.workspaceId],
      ),
      [groups] = await this.pool.query<RowDataPacket[]>(
        "SELECT status label,COUNT(*) value FROM trend_topics WHERE organization_id=? AND workspace_id=? " +
          "GROUP BY status ORDER BY label",
        [i.organizationId, i.workspaceId],
      );
    return {
      type: "trend",
      summary: {
        total: Number(summary[0]?.total ?? 0),
        signals: Number(summary[0]?.signals ?? 0),
        sources: Number(summary[0]?.sources ?? 0),
        average_momentum:
          summary[0]?.average_momentum == null ? null : Number(summary[0].average_momentum),
        average_confidence:
          summary[0]?.average_confidence == null ? null : Number(summary[0].average_confidence),
      },
      series: groups.map((r) => ({
        label: String(r.label),
        value: Number(r.value),
      })),
      observed_at: iso(summary[0]?.observed_at),
    };
  }
  private async team(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT m.user_id,u.email,COUNT(t.id) total,SUM(t.status='todo') todo,SUM(t.status='in_progress') " +
        "in_progress,SUM(t.status='completed') completed,SUM(t.status IN ('todo'," +
        "'in_progress') AND t.due_at IS NOT NULL AND t.due_at<?) overdue,MAX(t.updated_at) observed_at " +
        "FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN tasks t ON t.organization_id=m.organization_id " +
        "AND t.workspace_id=? AND t.assignee_id=m.user_id AND t.deleted_at IS NULL WHERE m.organization_id=? " +
        "AND m.status='active' GROUP BY m.user_id,u.email ORDER BY completed DESC," +
        "u.email",
      [this.now(), i.workspaceId, i.organizationId],
    );
    const totals = rows.reduce(
      (a, r) => ({
        members: a.members + 1,
        total: a.total + Number(r.total),
        completed: a.completed + Number(r.completed),
        overdue: a.overdue + Number(r.overdue),
      }),
      { members: 0, total: 0, completed: 0, overdue: 0 },
    );
    return {
      type: "team",
      summary: totals,
      series: rows.map((r) => ({
        label: String(r.email),
        value: Number(r.completed),
        user_id: String(r.user_id),
        total: Number(r.total),
        todo: Number(r.todo),
        in_progress: Number(r.in_progress),
        overdue: Number(r.overdue),
      })),
      observed_at: iso(
        rows.reduce(
          (v, r) => (!v || new Date(r.observed_at) > new Date(v) ? r.observed_at : v),
          null,
        ),
      ),
    };
  }
  async listExports(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM report_exports WHERE organization_id=? AND workspace_id=? ORDER BY created_at DESC LIMIT 100",
      [i.organizationId, i.workspaceId],
    );
    return rows.map((r) => this.view(r));
  }
  async detail(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT * FROM report_exports WHERE id=? AND organization_id=? AND workspace_id=?",
      [i.exportId, i.organizationId, i.workspaceId],
    );
    if (!rows[0]) throw new ReportServiceError("report_export_not_found", 404, "刷新导出列表。");
    return this.view(rows[0]);
  }
  async createExport(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      await c.query(
        "INSERT INTO report_exports (id,organization_id,workspace_id,report_type," +
          "format,status,attempt_count,available_at,filename,expires_at,created_by," +
          "request_id,trace_id,version,created_at,updated_at) VALUES (?,?,?,?,?,'queued'," +
          "0,?,?,?,?,?,?,1,?,?)",
        [
          i.id,
          i.organizationId,
          i.workspaceId,
          i.value.report_type,
          i.value.format,
          now,
          i.value.filename,
          i.value.expires_at,
          i.actorId,
          i.requestId,
          i.traceId,
          now,
          now,
        ],
      );
      const result = {
        id: i.id,
        report_type: i.value.report_type,
        format: "csv",
        status: "queued",
        version: 1,
        expires_at: i.value.expires_at.toISOString(),
        ...(i.regeneratedFromExportId
          ? { regenerated_from_export_id: i.regeneratedFromExportId }
          : {}),
      };
      await this.record(
        c,
        i,
        i.regeneratedFromExportId ? "report.export.regenerated" : "report.export.queued",
        i.id,
        result,
        now,
      );
      await c.query(
        "INSERT INTO report_export_operations (id,actor_id,route_key,idempotency_key," +
          "export_id,result_json,created_at) VALUES (?,?,?,?,?,?,?)",
        [randomUUID(), i.actorId, i.route, i.idempotencyKey, i.id, JSON.stringify(result), now],
      );
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  private view(r: any) {
    return {
      id: String(r.id),
      report_type: String(r.report_type),
      format: String(r.format),
      status: String(r.status),
      attempt_count: Number(r.attempt_count),
      filename: String(r.filename),
      row_count: r.row_count == null ? null : Number(r.row_count),
      byte_size: r.byte_size == null ? null : Number(r.byte_size),
      expires_at: iso(r.expires_at),
      last_error_code: r.last_error_code ? String(r.last_error_code) : null,
      version: Number(r.version),
      created_at: iso(r.created_at),
      updated_at: iso(r.updated_at),
    };
  }
  private async operation(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT result_json FROM report_export_operations WHERE actor_id=? AND route_key=? AND idempotency_key=?",
      [i.actorId, i.route, i.idempotencyKey],
    );
    return rows[0] ? parse(rows[0].result_json) : null;
  }
  private async record(
    c: PoolConnection,
    i: any,
    event: string,
    id: string,
    payload: any,
    now: Date,
  ) {
    await c.query(
      "INSERT INTO audit_logs (id,organization_id,workspace_id,actor_id,action," +
        "resource_type,resource_id,request_id,trace_id,metadata_json,occurred_at," +
        "schema_version) VALUES (?,?,?,?,?,'report_export',?,?,?,?,?,1)",
      [
        randomUUID(),
        i.organizationId,
        i.workspaceId,
        i.actorId,
        event,
        id,
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
        randomUUID(),
        i.organizationId,
        i.workspaceId,
        event,
        JSON.stringify({
          resource_type: "report_export",
          resource_id: id,
          ...payload,
        }),
        now,
        i.requestId,
        i.traceId,
        now,
        now,
      ],
    );
  }
}
