import { collectionTaskScope, fileAssetAccountStorage } from "@scoutops/database";
import {
  appendEvidenceDataEvent,
  appendEvidenceDataOutbox,
  dataQualityIssueScope,
} from "@scoutops/database";
import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  DataQualityRepository,
  EvidenceDownloadBinding,
  EvidenceMetadata,
  QualityIssueSummary,
} from "./data-quality-service.js";
import { DataQualityServiceError } from "./data-quality-service.js";
const json = (value: unknown) => (typeof value === "string" ? JSON.parse(value) : value),
  iso = (value: unknown) => new Date(value as string | Date).toISOString();
const evidence = (row: RowDataPacket): EvidenceMetadata => ({
  id: String(row.id),
  organization_id: String(row.organization_id ?? ""),
  workspace_id: String(row.workspace_id ?? ""),
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
  reconciliation_run_id:
    row.reconciliation_run_id == null ? null : String(row.reconciliation_run_id),
  raw_evidence_id: row.raw_evidence_id == null ? null : String(row.raw_evidence_id),
  parser_version: row.parser_version == null ? null : String(row.parser_version),
  metric_code: String(row.metric_code),
  field_path: row.field_path == null ? null : String(row.field_path),
  severity: row.severity,
  status: row.status,
  actual_value: row.actual_value == null ? null : Number(row.actual_value),
  threshold_value: row.threshold_value == null ? null : Number(row.threshold_value),
  assigned_membership_id:
    row.assigned_membership_id == null ? null : String(row.assigned_membership_id),
  assigned_member_label:
    row.assigned_member_label == null ? null : String(row.assigned_member_label),
  attribution_reason: row.attribution_reason == null ? null : String(row.attribution_reason),
  resolution_reason: row.resolution_reason == null ? null : String(row.resolution_reason),
  version: Number(row.version),
  created_at: iso(row.created_at),
  updated_at: iso(row.updated_at),
});
export class MySqlDataQualityRepository implements DataQualityRepository {
  constructor(
    private readonly pool: Pool,
    private readonly accountMode = false,
  ) {}
  private async assigneeShape(db: Pick<Pool, "query">) {
    if (!this.accountMode) return false;
    const [fields] = await db.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM data_quality_issues WHERE Field IN ('assigned_membership_id','historical_assignee_membership_id','assigned_account_id')",
    );
    const shape = fields
      .map((row) => row.Field)
      .sort()
      .join(",");
    if (shape === "assigned_membership_id") return false;
    if (shape === "assigned_account_id,historical_assignee_membership_id") return true;
    throw new Error("data_quality_assignee_schema_incomplete");
  }
  private assigneeJoin(account: boolean) {
    return account
      ? "LEFT JOIN users u ON u.id=i.assigned_account_id"
      : "LEFT JOIN memberships am ON am.id=i.assigned_membership_id LEFT JOIN users u ON u.id=am.user_id";
  }
  private assigneeProjection(account: boolean) {
    return account ? "i.historical_assignee_membership_id assigned_membership_id," : "";
  }
  private async evidenceScope(db: Pick<Pool, "query">) {
    const native = this.accountMode && (await collectionTaskScope(db)) === "account";
    const alias = this.accountMode ? "et" : "e";
    const org = native ? "sealed_task.legacy_org_id" : `${alias}.organization_id`;
    const workspace = native ? "sealed_task.legacy_workspace_id" : `${alias}.workspace_id`;
    const join = native
      ? `JOIN collection_tasks et ON et.id=e.collection_task_id AND et.account_id=e.account_id
      JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
      JOIN account_owned_records evidence_owner ON evidence_owner.source_table='raw_evidence'
        AND evidence_owner.source_id=e.id AND evidence_owner.account_id=e.account_id
        AND (evidence_owner.reason='exclusive_owner' OR
          (evidence_owner.reason IN ('shared','unassigned') AND e.account_id=cut.primary_account_id))
      JOIN account_owned_records task_owner ON task_owner.source_table='collection_tasks'
        AND task_owner.source_id=et.id AND task_owner.account_id=e.account_id
        AND (task_owner.reason='exclusive_owner' OR (task_owner.reason IN ('shared','unassigned') AND e.account_id=cut.primary_account_id))
      LEFT JOIN account_retirement_records sealed_task ON sealed_task.run_id=cut.source_run_id
        AND sealed_task.source_table='collection_tasks' AND sealed_task.source_id=et.id`
      : this.accountMode
        ? "JOIN collection_tasks et ON et.id=e.collection_task_id"
        : "";
    const coordinates = native
      ? `${org} organization_id,${workspace} workspace_id`
      : `${org},${workspace}`;
    return { native, join, org, workspace, coordinates };
  }
  private evidenceProjection(coordinates: string) {
    return `e.id,${coordinates},e.collection_task_id,e.provider_id,p.name provider_name,
      e.source_url,e.canonical_url,e.content_sha256,e.content_type,e.size_bytes,e.captured_at,
      e.parser_version,e.adapter_version,e.retention_until,e.status,e.request_id,e.trace_id`;
  }
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
    const scope = await this.evidenceScope(this.pool);
    const evidenceClause = clause
      .replaceAll("e.organization_id", scope.org)
      .replaceAll("e.workspace_id", scope.workspace);
    const issueScope = await dataQualityIssueScope(this.pool, this.accountMode);
    const accountAssignee = await this.assigneeShape(this.pool);
    const issueWhere = where.map((value) =>
      issueScope.scopeFilter(value.replaceAll("e.", "i."), "i"),
    );
    if (input.status) {
      issueWhere.push("i.status=?");
    }
    const issueValues = input.status ? [...values, input.status] : values;
    const issueClause = issueWhere.length ? `WHERE ${issueWhere.join(" AND ")}` : "";
    const offset = (input.page - 1) * input.pageSize;
    const [runColumns] = this.accountMode
      ? await this.pool.query<RowDataPacket[]>(
          "SHOW COLUMNS FROM reconciliation_runs WHERE Field IN ('organization_id','workspace_id','historical_context')",
        )
      : [[]];
    const runShape = runColumns
      .map((row) => row.Field)
      .sort()
      .join(",");
    if (
      this.accountMode &&
      runShape !== "historical_context" &&
      runShape !== "organization_id,workspace_id"
    )
      throw new Error("reconciliation_scope_schema_incomplete");
    const coordinate = (name: "organization_id" | "workspace_id") =>
      runShape === "historical_context"
        ? `CONVERT(JSON_UNQUOTE(JSON_EXTRACT(r.historical_context,'$.${name}')) USING ascii)`
        : `r.${name}`;
    const runClause = clause
      .replaceAll("e.organization_id", coordinate("organization_id"))
      .replaceAll("e.workspace_id", coordinate("workspace_id"));
    const [[evRows], [issueRows], [runRows], [memberRows], [evCount], [issueCount]] =
      await Promise.all([
        this.pool.query<RowDataPacket[]>(
          `SELECT ${this.evidenceProjection(scope.coordinates)}
         FROM raw_evidence e JOIN providers p ON p.id=e.provider_id
         ${scope.join} ${evidenceClause}
         ORDER BY e.captured_at DESC,e.id DESC LIMIT ? OFFSET ?`,
          [...values, input.pageSize, offset],
        ),
        this.pool.query<RowDataPacket[]>(
          `SELECT ${issueScope.select},p.name provider_name,COALESCE(r.parser_version,e.parser_version) parser_version,
          ${this.assigneeProjection(accountAssignee)} u.email assigned_member_label
         FROM data_quality_issues i JOIN providers p ON p.id=i.provider_id
         LEFT JOIN reconciliation_runs r ON r.id=i.reconciliation_run_id
         LEFT JOIN raw_evidence e ON e.id=i.raw_evidence_id
         ${this.assigneeJoin(accountAssignee)}
         ${issueClause}
         ORDER BY FIELD(i.severity,'critical','warning'),i.updated_at DESC,i.id DESC
         LIMIT ? OFFSET ?`,
          [...issueValues, input.pageSize, offset],
        ),
        this.pool.query<RowDataPacket[]>(
          `SELECT r.id,${coordinate("organization_id")} organization_id,${coordinate("workspace_id")} workspace_id,r.provider_id,p.name provider_name,
          r.parser_version,r.market,r.window_started_at,r.window_ended_at,r.sample_count,
          r.metrics_json,r.status,r.request_id,r.trace_id,r.created_at
         FROM reconciliation_runs r JOIN providers p ON p.id=r.provider_id
         ${runClause}
         ORDER BY r.created_at DESC,r.id DESC LIMIT 20`,
          values,
        ),
        accountAssignee
          ? Promise.resolve([[] as RowDataPacket[]])
          : this.pool.query<RowDataPacket[]>(
              `SELECT m.id,m.organization_id,u.email label FROM memberships m
         JOIN users u ON u.id=m.user_id
         WHERE m.status='active' AND u.status='active'
         ${input.organizationId ? "AND m.organization_id=?" : ""}
         ORDER BY u.email,m.id LIMIT 1000`,
              input.organizationId ? [input.organizationId] : [],
            ),
        this.pool.query<RowDataPacket[]>(
          `SELECT COUNT(*) total FROM raw_evidence e ${scope.join} ${evidenceClause}`,
          values,
        ),
        this.pool.query<RowDataPacket[]>(
          `SELECT COUNT(*) total,SUM(i.status='open') open_count,
          SUM(i.status='open' AND i.severity='critical') critical_count
          FROM data_quality_issues i ${issueClause}`,
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
      memberOptions: memberRows.map((row) => ({
        id: String(row.id),
        organization_id: String(row.organization_id),
        label: String(row.label),
      })),
      membershipAssignmentAvailable: !accountAssignee,
      totalEvidence: Number(evCount[0]?.total ?? 0),
      totalIssues: Number(issueCount[0]?.total ?? 0),
      openIssues: Number(issueCount[0]?.open_count ?? 0),
      criticalIssues: Number(issueCount[0]?.critical_count ?? 0),
    };
  }
  async evidenceDetail(id: string) {
    const scope = await this.evidenceScope(this.pool);
    const [[parent]] = await this.pool.query<RowDataPacket[]>(
      `SELECT ${this.evidenceProjection(scope.coordinates)}${scope.native ? ",e.account_id" : ""}
       FROM raw_evidence e JOIN providers p ON p.id=e.provider_id ${scope.join} WHERE e.id=?`,
      [id],
    );
    if (!parent) return null;
    const issueScope = await dataQualityIssueScope(this.pool, this.accountMode);
    const accountAssignee = await this.assigneeShape(this.pool);
    const owned = (table: "normalized_records" | "field_provenance", sourceId: "n.id" | "f.id") =>
      `EXISTS (SELECT 1 FROM account_owned_records child JOIN account_ownership_cutover cut
        ON cut.slot='current' AND cut.contract_version=25 WHERE child.source_table='${table}'
        AND child.source_id=${sourceId} AND child.account_id=n.account_id
        AND (child.reason='exclusive_owner' OR (child.reason IN ('shared','unassigned') AND child.account_id=cut.primary_account_id)))`;
    const normalizedFence = scope.native
      ? ` AND n.account_id=? AND
      EXISTS (SELECT 1 FROM raw_evidence x WHERE x.id=n.raw_evidence_id AND x.account_id=n.account_id AND x.provider_id=n.provider_id)
      AND ${owned("normalized_records", "n.id")}`
      : "";
    const childArgs = scope.native ? [id, parent.account_id] : [id];
    const [[records], [provenance], [issues]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        "SELECT id,record_key,schema_version,record_version,supersedes_record_id," +
          "correction_reason,status,request_id,trace_id,created_at FROM normalized_records n WHERE n.raw_evidence_id=?" +
          normalizedFence +
          " ORDER BY record_version DESC",
        childArgs,
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT f.id,f.normalized_record_id,f.field_path,f.source_path,f.transform_version," +
          "f.source_value_sha256,f.created_at FROM field_provenance f " +
          "JOIN normalized_records n ON n.id=f.normalized_record_id AND n.raw_evidence_id=f.raw_evidence_id " +
          "WHERE f.raw_evidence_id=?" +
          normalizedFence +
          (scope.native ? ` AND ${owned("field_provenance", "f.id")}` : "") +
          " ORDER BY f.field_path",
        childArgs,
      ),
      this.pool.query<RowDataPacket[]>(
        `SELECT ${issueScope.select},p.name provider_name,COALESCE(r.parser_version,e.parser_version) parser_version,${this.assigneeProjection(accountAssignee)} u.email assigned_member_label ` +
          "FROM data_quality_issues i JOIN providers p ON p.id=i.provider_id " +
          "LEFT JOIN reconciliation_runs r ON r.id=i.reconciliation_run_id " +
          "LEFT JOIN raw_evidence e ON e.id=i.raw_evidence_id " +
          this.assigneeJoin(accountAssignee) +
          " " +
          "WHERE i.raw_evidence_id=? ORDER BY i.created_at DESC",
        [id],
      ),
    ]);
    return {
      evidence: evidence(parent),
      normalized_records: records.map((row) => ({
        ...row,
        record_version: Number(row.record_version),
        created_at: iso(row.created_at),
      })),
      field_provenance: provenance.map((row) => ({ ...row, created_at: iso(row.created_at) })),
      quality_issues: issues.map(issue),
    };
  }
  async createFromTrendEvidence(
    input: Parameters<DataQualityRepository["createFromTrendEvidence"]>[0],
  ) {
    const c = await this.pool.getConnection(),
      route = `/trends/${input.topicId}/evidence/${input.evidenceId}/quality-issues`;
    try {
      await c.beginTransaction();
      const [operations] = await c.query<RowDataPacket[]>(
        "SELECT result_json FROM evidence_data_operations WHERE actor_id=? AND route=? AND idempotency_key=? FOR UPDATE",
        [input.actorId, route, input.idempotencyKey],
      );
      if (operations[0]) {
        await c.commit();
        return json(operations[0].result_json) as {
          issue: QualityIssueSummary;
          created: boolean;
        };
      }
      const [signals] = await c.query<RowDataPacket[]>(
        `SELECT s.id signal_id,s.topic_id,t.organization_id,t.workspace_id,s.provider_id,
          s.raw_evidence_id,s.normalized_record_id,e.parser_version,p.name provider_name
         FROM trend_signals s JOIN trend_topics t ON t.id=s.topic_id
         JOIN raw_evidence e ON e.id=s.raw_evidence_id
         JOIN providers p ON p.id=s.provider_id
         WHERE s.id=? AND s.topic_id=? AND t.organization_id=? AND t.workspace_id=?
         LIMIT 1 FOR UPDATE`,
        [input.evidenceId, input.topicId, input.organizationId, input.workspaceId],
      );
      const signal = signals[0];
      if (!signal)
        throw new DataQualityServiceError(
          "trend_evidence_not_found",
          404,
          "刷新趋势详情后重新选择证据。",
        );
      const issueScope = await dataQualityIssueScope(c, this.accountMode);
      const accountAssignee = await this.assigneeShape(c);
      const [existing] = await c.query<RowDataPacket[]>(
        `SELECT ${issueScope.select},p.name provider_name,COALESCE(r.parser_version,e.parser_version) parser_version,
          ${this.assigneeProjection(accountAssignee)} u.email assigned_member_label
         FROM data_quality_issues i
         JOIN providers p ON p.id=i.provider_id
         LEFT JOIN reconciliation_runs r ON r.id=i.reconciliation_run_id
         LEFT JOIN raw_evidence e ON e.id=i.raw_evidence_id
         ${this.assigneeJoin(accountAssignee)}
         WHERE ${issueScope.coordinate("i", "organization_id")}=? AND ${issueScope.coordinate("i", "workspace_id")}=? AND i.raw_evidence_id=?
           AND i.metric_code='trend_evidence_anomaly' AND i.status='open'
         ORDER BY i.created_at DESC LIMIT 1 FOR UPDATE`,
        [input.organizationId, input.workspaceId, signal.raw_evidence_id],
      );
      let result: { issue: QualityIssueSummary; created: boolean };
      if (existing[0]) {
        result = { issue: issue(existing[0]), created: false };
      } else {
        const issueId = randomUUID(),
          row = {
            id: issueId,
            organization_id: signal.organization_id,
            workspace_id: signal.workspace_id,
            provider_id: signal.provider_id,
            provider_name: signal.provider_name,
            reconciliation_run_id: null,
            raw_evidence_id: signal.raw_evidence_id,
            normalized_record_id: signal.normalized_record_id,
            parser_version: signal.parser_version,
            metric_code: "trend_evidence_anomaly",
            field_path: null,
            severity: input.severity,
            status: "open",
            actual_value: null,
            threshold_value: null,
            assigned_membership_id: null,
            assigned_member_label: null,
            attribution_reason: input.reason,
            resolution_reason: null,
            version: 1,
            created_at: input.now,
            updated_at: input.now,
          } as RowDataPacket;
        await c.query(
          `INSERT INTO data_quality_issues
           (id,${issueScope.columns},provider_id,reconciliation_run_id,raw_evidence_id,
            normalized_record_id,metric_code,field_path,severity,status,actual_value,threshold_value,
            details_json,${accountAssignee ? "assigned_account_id" : "assigned_membership_id"},attribution_reason,attributed_by,attributed_at,
            resolved_by,resolution_reason,resolved_at,request_id,trace_id,version,created_at,updated_at)
           VALUES (?,${issueScope.placeholders},?,NULL,?,?,?,?,?,? ,NULL,NULL,?,NULL,?,?,?,NULL,NULL,NULL,?,?,1,?,?)`,
          [
            issueId,
            ...issueScope.values(signal.organization_id, signal.workspace_id),
            signal.provider_id,
            signal.raw_evidence_id,
            signal.normalized_record_id,
            "trend_evidence_anomaly",
            null,
            input.severity,
            "open",
            JSON.stringify({
              origin: "trend_detail",
              topic_id: input.topicId,
              signal_id: input.evidenceId,
              reason: input.reason,
            }),
            input.reason,
            input.actorId,
            input.now,
            input.requestId,
            input.traceId,
            input.now,
            input.now,
          ],
        );
        await this.event(
          c,
          row,
          "data_quality.issue.created",
          "data_quality_issue",
          issueId,
          input.actorId,
          input.requestId,
          input.traceId,
          {
            origin: "trend_detail",
            topic_id: input.topicId,
            signal_id: input.evidenceId,
            reason: input.reason,
          },
          input.now,
        );
        await this.outbox(
          c,
          row,
          "data_quality.issue.created",
          "data_quality_issue",
          issueId,
          { issue_id: issueId, topic_id: input.topicId, signal_id: input.evidenceId },
          input.requestId,
          input.traceId,
          input.now,
        );
        result = { issue: issue(row), created: true };
      }
      await c.query(
        "INSERT INTO evidence_data_operations (id,actor_id,route,idempotency_key,resource_id,result_json,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomUUID(),
          input.actorId,
          route,
          input.idempotencyKey,
          result.issue.id,
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
  async batchIssues(input: Parameters<DataQualityRepository["batchIssues"]>[0]) {
    const c = await this.pool.getConnection(),
      route = "/platform/data-quality/issues/batch",
      ids = [...input.items].sort((a, b) => a.id.localeCompare(b.id));
    try {
      await c.beginTransaction();
      const [ops] = await c.query<RowDataPacket[]>(
        "SELECT result_json FROM evidence_data_operations WHERE actor_id=? AND route=? AND idempotency_key=? FOR UPDATE",
        [input.actorId, route, input.idempotencyKey],
      );
      if (ops[0]) {
        await c.commit();
        return json(ops[0].result_json) as QualityIssueSummary[];
      }
      const issueScope = await dataQualityIssueScope(c, this.accountMode);
      const accountAssignee = await this.assigneeShape(c);
      if (accountAssignee && input.action === "assign")
        throw new DataQualityServiceError(
          "quality_issue_assignee_scope_retired",
          409,
          "账号模式不再接受组织成员指派。",
        );
      const placeholders = ids.map(() => "?").join(","),
        [rows] = await c.query<RowDataPacket[]>(
          `SELECT ${issueScope.select},p.name provider_name,COALESCE(r.parser_version,e.parser_version) parser_version,
           ${this.assigneeProjection(accountAssignee)} u.email assigned_member_label
           FROM data_quality_issues i JOIN providers p ON p.id=i.provider_id
           LEFT JOIN reconciliation_runs r ON r.id=i.reconciliation_run_id
           LEFT JOIN raw_evidence e ON e.id=i.raw_evidence_id
           ${this.assigneeJoin(accountAssignee)}
           WHERE i.id IN (${placeholders}) ORDER BY i.id FOR UPDATE`,
          ids.map((item) => item.id),
        );
      if (rows.length !== ids.length)
        throw new DataQualityServiceError("quality_issue_not_found", 404, "刷新质量问题列表。 ");
      const versions = new Map(ids.map((item) => [item.id, item.expectedVersion]));
      if (
        rows.some(
          (row) => row.status !== "open" || Number(row.version) !== versions.get(String(row.id)),
        )
      )
        throw new DataQualityServiceError(
          "quality_issue_version_conflict",
          409,
          "所选问题已变化，刷新后重新确认批量范围。",
        );
      let assigneeLabel: string | null = null;
      if (input.action === "assign") {
        const [members] = await c.query<RowDataPacket[]>(
          "SELECT m.id,m.organization_id,u.email FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.id=? AND m.status='active' AND u.status='active' LIMIT 1",
          [input.assigneeMembershipId],
        );
        const member = members[0];
        if (
          !member ||
          rows.some((row) => String(row.organization_id) !== String(member.organization_id))
        )
          throw new DataQualityServiceError(
            "quality_issue_assignee_invalid",
            409,
            "指派成员必须在全部所选问题所属组织中保持活动成员资格。",
          );
        assigneeLabel = String(member.email);
      }
      const results: QualityIssueSummary[] = [];
      for (const row of rows) {
        if (input.action === "attribute") {
          await c.query(
            "UPDATE data_quality_issues SET attribution_reason=?,attributed_by=?,attributed_at=?,request_id=?,trace_id=?,version=version+1,updated_at=? WHERE id=?",
            [
              input.reason,
              input.actorId,
              input.now,
              input.requestId,
              input.traceId,
              input.now,
              row.id,
            ],
          );
          row.attribution_reason = input.reason;
        } else if (input.action === "assign") {
          await c.query(
            "UPDATE data_quality_issues SET assigned_membership_id=?,request_id=?,trace_id=?,version=version+1,updated_at=? WHERE id=?",
            [input.assigneeMembershipId, input.requestId, input.traceId, input.now, row.id],
          );
          row.assigned_membership_id = input.assigneeMembershipId;
          row.assigned_member_label = assigneeLabel;
        } else {
          await c.query(
            "UPDATE data_quality_issues SET status='resolved',resolved_by=?,resolution_reason=?,resolved_at=?,request_id=?,trace_id=?,version=version+1,updated_at=? WHERE id=?",
            [
              input.actorId,
              input.reason,
              input.now,
              input.requestId,
              input.traceId,
              input.now,
              row.id,
            ],
          );
          row.status = "resolved";
          row.resolution_reason = input.reason;
        }
        row.version = Number(row.version) + 1;
        row.updated_at = input.now;
        const eventType = `data_quality.issue.${input.action === "close" ? "resolved" : input.action === "assign" ? "assigned" : "attributed"}`;
        await this.event(
          c,
          row,
          eventType,
          "data_quality_issue",
          String(row.id),
          input.actorId,
          input.requestId,
          input.traceId,
          { reason: input.reason, assignee_membership_id: input.assigneeMembershipId },
          input.now,
        );
        await this.outbox(
          c,
          row,
          eventType,
          "data_quality_issue",
          String(row.id),
          { issue_id: String(row.id) },
          input.requestId,
          input.traceId,
          input.now,
        );
        results.push(issue(row));
      }
      await c.query(
        "INSERT INTO evidence_data_operations (id,actor_id,route,idempotency_key,resource_id,result_json,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomUUID(),
          input.actorId,
          route,
          input.idempotencyKey,
          ids[0]!.id,
          JSON.stringify(results),
          input.now,
        ],
      );
      await c.commit();
      return results;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
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
      const issueScope = await dataQualityIssueScope(c, this.accountMode);
      const accountAssignee = await this.assigneeShape(c);
      const [rows] = await c.query<RowDataPacket[]>(
        `SELECT ${issueScope.select},p.name provider_name,COALESCE(r.parser_version,e.parser_version) parser_version,${this.assigneeProjection(accountAssignee)} u.email assigned_member_label ` +
          "FROM data_quality_issues i JOIN providers p ON p.id=i.provider_id " +
          "LEFT JOIN reconciliation_runs r ON r.id=i.reconciliation_run_id " +
          "LEFT JOIN raw_evidence e ON e.id=i.raw_evidence_id " +
          this.assigneeJoin(accountAssignee) +
          " " +
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
    const scope = await this.evidenceScope(this.pool);
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT e.id,${scope.coordinates},f.id asset_id,f.relative_path,f.content_sha256,` +
        `e.content_type,e.size_bytes,f.status FROM raw_evidence e ${scope.join}
        JOIN file_assets f ON f.id=e.file_asset_id ${this.nativeDownloadFileJoin(scope.native)} WHERE e.id=?`,
      [id],
    );
    return rows[0]
      ? {
          ...rows[0],
          id: String(rows[0].id),
          organization_id: String(rows[0].organization_id ?? ""),
          workspace_id: String(rows[0].workspace_id ?? ""),
          relative_path: String(rows[0].relative_path),
          content_sha256: String(rows[0].content_sha256),
          content_type: String(rows[0].content_type),
          size_bytes: Number(rows[0].size_bytes),
          status: String(rows[0].status),
        }
      : null;
  }
  async accountEvidenceOwner(evidenceId: string, assetId: string) {
    const evidence = await this.evidenceScope(this.pool);
    const accountFiles = await fileAssetAccountStorage(this.pool);
    const coord = this.accountMode ? "et" : "e";
    const scope = evidence.native
      ? ""
      : accountFiles
        ? `AND (f.historical_context IS NULL OR (BINARY JSON_UNQUOTE(JSON_EXTRACT(f.historical_context,'$.organization_id'))=BINARY ${coord}.organization_id AND BINARY JSON_UNQUOTE(JSON_EXTRACT(f.historical_context,'$.workspace_id'))=BINARY ${coord}.workspace_id))`
        : `AND f.organization_id=${coord}.organization_id AND f.workspace_id=${coord}.workspace_id`;
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT fo.account_id FROM raw_evidence e ${evidence.join}
      JOIN file_assets f ON f.id=e.file_asset_id ${scope}
        AND f.category='evidence' AND f.status='active'
        AND f.size_bytes=e.size_bytes AND f.content_sha256=e.content_sha256
      ${evidence.native ? "" : "JOIN account_ownership_cutover c ON c.slot='current' AND c.contract_version=25"}
      JOIN account_owned_records eo ON eo.source_table='raw_evidence' AND eo.source_id=e.id
        ${evidence.native ? "AND eo.account_id=e.account_id" : ""}
      JOIN account_owned_records fo ON fo.source_table='file_assets' AND fo.source_id=f.id AND fo.account_id=eo.account_id
        ${accountFiles ? "AND f.account_id=fo.account_id" : ""}
        ${evidence.native ? "AND (fo.reason='exclusive_owner' OR (fo.reason IN ('shared','unassigned') AND f.account_id=cut.primary_account_id))" : ""}
      WHERE e.id=? AND f.id=? AND e.status='active'`,
      [evidenceId, assetId],
    );
    return rows[0] ? String(rows[0].account_id) : null;
  }
  private nativeDownloadFileJoin(native: boolean) {
    return native
      ? `AND e.status='active' AND f.category='evidence' AND f.status='active'
      AND e.account_id=f.account_id AND f.size_bytes=e.size_bytes AND f.content_sha256=e.content_sha256
      JOIN account_owned_records file_owner ON file_owner.source_table='file_assets'
        AND file_owner.source_id=f.id AND file_owner.account_id=e.account_id
        AND (file_owner.reason='exclusive_owner' OR (file_owner.reason IN ('shared','unassigned') AND e.account_id=cut.primary_account_id))`
      : "";
  }
  private async downloadAuditParent(
    db: Pick<PoolConnection, "query">,
    id: string,
    lock = false,
    binding?: EvidenceDownloadBinding,
  ) {
    const scope = await this.evidenceScope(db);
    if (this.accountMode && !binding)
      throw new DataQualityServiceError("evidence_not_found", 404, "刷新证据列表。");
    const file = scope.native
      ? "JOIN file_assets f ON f.id=e.file_asset_id " + this.nativeDownloadFileJoin(true)
      : binding
        ? `JOIN file_assets f ON f.id=e.file_asset_id AND e.status='active' AND f.category='evidence' AND f.status='active'
         AND f.content_sha256=e.content_sha256 AND f.size_bytes=e.size_bytes
         JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
         JOIN account_owned_records evidence_owner ON evidence_owner.source_table='raw_evidence' AND evidence_owner.source_id=e.id
           AND (evidence_owner.reason='exclusive_owner' OR (evidence_owner.reason IN ('shared','unassigned') AND evidence_owner.account_id=cut.primary_account_id))
         JOIN account_owned_records file_owner ON file_owner.source_table='file_assets' AND file_owner.source_id=f.id
           AND file_owner.account_id=evidence_owner.account_id
           ${(await fileAssetAccountStorage(db)) ? "AND f.account_id=evidence_owner.account_id" : ""}`
        : "";
    const exact = binding
      ? ` AND f.id=? AND BINARY f.relative_path=BINARY ? AND f.size_bytes=? AND f.content_sha256=?
      AND ${scope.native ? "e.account_id" : "evidence_owner.account_id"}=?`
      : "";
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT ${scope.coordinates}${scope.native ? ",e.account_id,evidence_owner.reason" : ""}
       FROM raw_evidence e ${scope.join} ${file}
       WHERE e.id=?${exact}${lock ? " FOR UPDATE" : ""}`,
      [
        id,
        ...(binding
          ? [
              binding.assetId,
              binding.relativePath,
              binding.sizeBytes,
              binding.sha256,
              binding.accountId,
            ]
          : []),
      ],
    );
    if (!rows[0]) throw new DataQualityServiceError("evidence_not_found", 404, "刷新证据列表。");
    return { row: rows[0], native: scope.native };
  }
  private async recordNativeDownloadEvent(
    c: PoolConnection,
    row: RowDataPacket,
    input: Parameters<DataQualityRepository["recordDownload"]>[0],
    eventType: string,
  ) {
    const id = randomUUID();
    await appendEvidenceDataEvent(c, {
      id,
      organizationId: "",
      workspaceId: "",
      requireInheritedScope: true,
      actorType: "user",
      actorId: input.actorId,
      resourceId: input.evidenceId,
      resourceType: "raw_evidence",
      eventType,
      requestId: input.requestId,
      traceId: input.traceId,
      payloadJson: "{}",
      occurredAt: input.now,
    });
    await c.query(
      "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ('evidence_data_events',?,?,?)",
      [id, row.account_id, row.reason],
    );
  }
  async saveDownloadGrant(input: Parameters<DataQualityRepository["saveDownloadGrant"]>[0]) {
    const c = await this.pool.getConnection(),
      route = `/platform/data/evidence/${input.evidenceId}/download-grant`;
    try {
      await c.beginTransaction();
      const parent = this.accountMode
        ? await this.downloadAuditParent(c, input.evidenceId, true, input.binding)
        : null;
      const [ops] = await c.query<RowDataPacket[]>(
        "SELECT result_json FROM evidence_data_operations WHERE actor_id=? AND route=? AND idempotency_key=? FOR UPDATE",
        [input.actorId, route, input.idempotencyKey],
      );
      if (ops[0]) {
        await c.commit();
        return json(ops[0].result_json) as { grant: string; expires_at: string };
      }
      const current = parent ?? (await this.downloadAuditParent(c, input.evidenceId, true));
      if (current.native)
        await this.recordNativeDownloadEvent(c, current.row, input, "evidence.download.granted");
      else
        await this.event(
          c,
          current.row,
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
    if (!this.accountMode)
      return this.appendLegacyDownload(
        this.pool,
        (await this.downloadAuditParent(this.pool, input.evidenceId)).row,
        input,
      );
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const { native, row } = await this.downloadAuditParent(
        c,
        input.evidenceId,
        true,
        input.binding,
      );
      if (native) await this.recordNativeDownloadEvent(c, row, input, "evidence.download.accessed");
      else await this.appendLegacyDownload(c, row, input);
      await c.commit();
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  private async appendLegacyDownload(
    db: Pick<PoolConnection, "query">,
    row: RowDataPacket,
    input: Parameters<DataQualityRepository["recordDownload"]>[0],
  ) {
    await appendEvidenceDataEvent(db, {
      id: randomUUID(),
      organizationId: row.organization_id,
      workspaceId: row.workspace_id,
      actorType: "user",
      eventType: "evidence.download.accessed",
      resourceType: "raw_evidence",
      resourceId: input.evidenceId,
      actorId: input.actorId,
      requestId: input.requestId,
      traceId: input.traceId,
      payloadJson: "{}",
      occurredAt: input.now,
    });
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
    return appendEvidenceDataEvent(c, {
      id: randomUUID(),
      organizationId: row.organization_id,
      workspaceId: row.workspace_id,
      actorType: "user",
      eventType,
      resourceType,
      resourceId,
      actorId,
      requestId,
      traceId,
      payloadJson: JSON.stringify(payload),
      occurredAt: now,
    });
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
    return appendEvidenceDataOutbox(c, {
      id: randomUUID(),
      organizationId: row.organization_id,
      workspaceId: row.workspace_id,
      eventType,
      resourceType,
      resourceId,
      payloadJson: JSON.stringify(payload),
      requestId: requestId,
      traceId: traceId,
      createdAt: now,
    });
  }
}
