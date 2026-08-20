import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  DataQualityRepository,
  EvidenceMetadata,
  QualityIssueSummary,
} from "./data-quality-service.js";
import { DataQualityServiceError } from "./data-quality-service.js";
const json = (value: unknown) => (typeof value === "string" ? JSON.parse(value) : value),
  iso = (value: unknown) => new Date(value as string | Date).toISOString();
const evidence = (row: RowDataPacket): EvidenceMetadata => ({
  id: String(row.id),
  organization_id: String(row.organization_id),
  workspace_id: String(row.workspace_id),
  collection_task_id: String(row.collection_task_id),
  provider_id: String(row.provider_id),
  provider_name: String(row.provider_name),
  source_url: String(row.source_url),
  canonical_url: String(row.canonical_url),
  content_sha256: String(row.content_sha256),
  content_type: String(row.content_type),
  size_bytes: Number(row.size_bytes),
  captured_at: iso(row.captured_at),
  parser_version: String(row.parser_version),
  adapter_version: String(row.adapter_version),
  retention_until: iso(row.retention_until),
  status: String(row.status),
  request_id: String(row.request_id),
  trace_id: String(row.trace_id),
});
const issue = (row: RowDataPacket): QualityIssueSummary => ({
  id: String(row.id),
  organization_id: String(row.organization_id),
  workspace_id: String(row.workspace_id),
  provider_id: String(row.provider_id),
  provider_name: String(row.provider_name),
  metric_code: String(row.metric_code),
  field_path: row.field_path == null ? null : String(row.field_path),
  severity: row.severity,
  status: row.status,
  actual_value: row.actual_value == null ? null : Number(row.actual_value),
  threshold_value: row.threshold_value == null ? null : Number(row.threshold_value),
  resolution_reason: row.resolution_reason == null ? null : String(row.resolution_reason),
  version: Number(row.version),
  created_at: iso(row.created_at),
  updated_at: iso(row.updated_at),
});
export class MySqlDataQualityRepository implements DataQualityRepository {
  constructor(private readonly pool: Pool) {}
  async dashboard(input: Parameters<DataQualityRepository["dashboard"]>[0]) {
    const where: string[] = [],
      values: unknown[] = [];
    if (input.organizationId) {
      where.push("e.organization_id=?");
      values.push(input.organizationId);
    }
    if (input.workspaceId) {
      where.push("e.workspace_id=?");
      values.push(input.workspaceId);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const issueWhere = where.map((value) => value.replaceAll("e.", "i."));
    if (input.status) {
      issueWhere.push("i.status=?");
    }
    const issueValues = input.status ? [...values, input.status] : values;
    const issueClause = issueWhere.length ? `WHERE ${issueWhere.join(" AND ")}` : "";
    const offset = (input.page - 1) * input.pageSize;
    const [[evRows], [issueRows], [runRows], [evCount], [issueCount]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        `SELECT e.*,p.name provider_name
         FROM raw_evidence e JOIN providers p ON p.id=e.provider_id
         ${clause}
         ORDER BY e.captured_at DESC,e.id DESC LIMIT ? OFFSET ?`,
        [...values, input.pageSize, offset],
      ),
      this.pool.query<RowDataPacket[]>(
        `SELECT i.*,p.name provider_name
         FROM data_quality_issues i JOIN providers p ON p.id=i.provider_id
         ${issueClause}
         ORDER BY FIELD(i.severity,'critical','warning'),i.updated_at DESC,i.id DESC
         LIMIT ? OFFSET ?`,
        [...issueValues, input.pageSize, offset],
      ),
      this.pool.query<RowDataPacket[]>(
        `SELECT r.id,r.organization_id,r.workspace_id,r.provider_id,p.name provider_name,
          r.parser_version,r.market,r.window_started_at,r.window_ended_at,r.sample_count,
          r.metrics_json,r.status,r.request_id,r.trace_id,r.created_at
         FROM reconciliation_runs r JOIN providers p ON p.id=r.provider_id
         ${clause.replaceAll("e.", "r.")}
         ORDER BY r.created_at DESC,r.id DESC LIMIT 20`,
        values,
      ),
      this.pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) total FROM raw_evidence e ${clause}`,
        values,
      ),
      this.pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) total FROM data_quality_issues i ${issueClause}`,
        issueValues,
      ),
    ]);
    return {
      evidence: evRows.map(evidence),
      issues: issueRows.map(issue),
      reconciliationRuns: runRows.map((row) => ({
        ...row,
        metrics: json(row.metrics_json),
        metrics_json: undefined,
        window_started_at: iso(row.window_started_at),
        window_ended_at: iso(row.window_ended_at),
        created_at: iso(row.created_at),
      })),
      totalEvidence: Number(evCount[0]?.total ?? 0),
      totalIssues: Number(issueCount[0]?.total ?? 0),
    };
  }
  async evidenceDetail(id: string) {
    const [[ev], [records], [provenance], [issues]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        "SELECT e.*,p.name provider_name FROM raw_evidence e JOIN providers p ON p.id=e.provider_id WHERE e.id=?",
        [id],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT id,record_key,schema_version,record_version,supersedes_record_id," +
          "correction_reason,status,request_id,trace_id,created_at FROM normalized_records WHERE " +
          "raw_evidence_id=? ORDER BY record_version DESC",
        [id],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT id,normalized_record_id,field_path,source_path,transform_version," +
          "source_value_sha256,created_at FROM field_provenance WHERE raw_evidence_id=? ORDER BY " +
          "field_path",
        [id],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT i.*,p.name provider_name FROM data_quality_issues i JOIN providers p ON p.id=i.provider_id " +
          "WHERE i.raw_evidence_id=? ORDER BY i.created_at DESC",
        [id],
      ),
    ]);
    if (!ev[0]) return null;
    return {
      evidence: evidence(ev[0]),
      normalized_records: records.map((row) => ({
        ...row,
        record_version: Number(row.record_version),
        created_at: iso(row.created_at),
      })),
      field_provenance: provenance.map((row) => ({ ...row, created_at: iso(row.created_at) })),
      quality_issues: issues.map(issue),
    };
  }
  async resolveIssue(input: Parameters<DataQualityRepository["resolveIssue"]>[0]) {
    const c = await this.pool.getConnection(),
      route = `/platform/data-quality/issues/${input.id}/resolve`;
    try {
      await c.beginTransaction();
      const [ops] = await c.query<RowDataPacket[]>(
        "SELECT result_json FROM evidence_data_operations WHERE actor_id=? AND route=? AND idempotency_key=?",
        [input.actorId, route, input.idempotencyKey],
      );
      if (ops[0]) {
        await c.commit();
        return json(ops[0].result_json) as QualityIssueSummary;
      }
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT i.*,p.name provider_name FROM data_quality_issues i JOIN providers p ON p.id=i.provider_id " +
          "WHERE i.id=? FOR UPDATE",
        [input.id],
      );
      const row = rows[0];
      if (!row)
        throw new DataQualityServiceError("quality_issue_not_found", 404, "刷新质量问题列表。");
      if (row.status !== "open" || Number(row.version) !== input.expectedVersion)
        throw new DataQualityServiceError(
          "quality_issue_version_conflict",
          409,
          "刷新问题状态与版本后重试。",
        );
      await c.query(
        "UPDATE data_quality_issues SET status='resolved',resolved_by=?,resolution_reason=?," +
          "resolved_at=?,request_id=?,trace_id=?,version=version+1,updated_at=? WHERE id=?",
        [
          input.actorId,
          input.reason,
          input.now,
          input.requestId,
          input.traceId,
          input.now,
          input.id,
        ],
      );
      row.status = "resolved";
      row.resolution_reason = input.reason;
      row.version = Number(row.version) + 1;
      row.updated_at = input.now;
      const result = issue(row);
      await this.event(
        c,
        row,
        "data_quality.issue.resolved",
        "data_quality_issue",
        input.id,
        input.actorId,
        input.requestId,
        input.traceId,
        { reason: input.reason },
        input.now,
      );
      await this.outbox(
        c,
        row,
        "data_quality.issue.resolved",
        "data_quality_issue",
        input.id,
        { issue_id: input.id },
        input.requestId,
        input.traceId,
        input.now,
      );
      await c.query(
        "INSERT INTO evidence_data_operations (id,actor_id,route,idempotency_key," +
          "resource_id,result_json,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomUUID(),
          input.actorId,
          route,
          input.idempotencyKey,
          input.id,
          JSON.stringify(result),
          input.now,
        ],
      );
      await c.commit();
      return result;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async fileInfo(id: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT e.id,e.organization_id,e.workspace_id,f.relative_path,f.content_sha256," +
        "e.content_type,e.size_bytes,f.status FROM raw_evidence e JOIN file_assets f ON f.id=e.file_asset_id " +
        "WHERE e.id=?",
      [id],
    );
    return rows[0]
      ? {
          ...rows[0],
          id: String(rows[0].id),
          organization_id: String(rows[0].organization_id),
          workspace_id: String(rows[0].workspace_id),
          relative_path: String(rows[0].relative_path),
          content_sha256: String(rows[0].content_sha256),
          content_type: String(rows[0].content_type),
          size_bytes: Number(rows[0].size_bytes),
          status: String(rows[0].status),
        }
      : null;
  }
  async saveDownloadGrant(input: Parameters<DataQualityRepository["saveDownloadGrant"]>[0]) {
    const c = await this.pool.getConnection(),
      route = `/platform/data/evidence/${input.evidenceId}/download-grant`;
    try {
      await c.beginTransaction();
      const [ops] = await c.query<RowDataPacket[]>(
        "SELECT result_json FROM evidence_data_operations WHERE actor_id=? AND route=? AND idempotency_key=? FOR UPDATE",
        [input.actorId, route, input.idempotencyKey],
      );
      if (ops[0]) {
        await c.commit();
        return json(ops[0].result_json) as { grant: string; expires_at: string };
      }
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT organization_id,workspace_id FROM raw_evidence WHERE id=? FOR UPDATE",
        [input.evidenceId],
      );
      if (!rows[0]) throw new DataQualityServiceError("evidence_not_found", 404, "刷新证据列表。");
      await this.event(
        c,
        rows[0],
        "evidence.download.granted",
        "raw_evidence",
        input.evidenceId,
        input.actorId,
        input.requestId,
        input.traceId,
        {},
        input.now,
      );
      await c.query(
        "INSERT INTO evidence_data_operations (id,actor_id,route,idempotency_key," +
          "resource_id,result_json,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomUUID(),
          input.actorId,
          route,
          input.idempotencyKey,
          input.evidenceId,
          JSON.stringify(input.result),
          input.now,
        ],
      );
      await c.commit();
      return input.result;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  async recordDownload(input: Parameters<DataQualityRepository["recordDownload"]>[0]) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT organization_id,workspace_id FROM raw_evidence WHERE id=?",
      [input.evidenceId],
    );
    if (!rows[0]) throw new DataQualityServiceError("evidence_not_found", 404, "刷新证据列表。");
    await this.pool.query(
      "INSERT INTO evidence_data_events (id,organization_id,workspace_id,event_type," +
        "resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json," +
        "occurred_at) VALUES (?,?,?,?,?,?,'user',?,?,?,?,?)",
      [
        randomUUID(),
        rows[0].organization_id,
        rows[0].workspace_id,
        "evidence.download.accessed",
        "raw_evidence",
        input.evidenceId,
        input.actorId,
        input.requestId,
        input.traceId,
        "{}",
        input.now,
      ],
    );
  }
  private event(
    c: PoolConnection,
    row: RowDataPacket,
    eventType: string,
    resourceType: string,
    resourceId: string,
    actorId: string,
    requestId: string,
    traceId: string,
    payload: unknown,
    now: Date,
  ) {
    return c.query(
      "INSERT INTO evidence_data_events (id,organization_id,workspace_id,event_type," +
        "resource_type,resource_id,actor_type,actor_id,request_id,trace_id,payload_json," +
        "occurred_at) VALUES (?,?,?,?,?,?,'user',?,?,?,?,?)",
      [
        randomUUID(),
        row.organization_id,
        row.workspace_id,
        eventType,
        resourceType,
        resourceId,
        actorId,
        requestId,
        traceId,
        JSON.stringify(payload),
        now,
      ],
    );
  }
  private outbox(
    c: PoolConnection,
    row: RowDataPacket,
    eventType: string,
    resourceType: string,
    resourceId: string,
    payload: unknown,
    requestId: string,
    traceId: string,
    now: Date,
  ) {
    return c.query(
      "INSERT INTO evidence_data_outbox (id,organization_id,workspace_id,event_type," +
        "resource_type,resource_id,payload_json,status,attempt_count,available_at," +
        "request_id,trace_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'queued'," +
        "0,?,?,?,?,?)",
      [
        randomUUID(),
        row.organization_id,
        row.workspace_id,
        eventType,
        resourceType,
        resourceId,
        JSON.stringify(payload),
        now,
        requestId,
        traceId,
        now,
        now,
      ],
    );
  }
}
