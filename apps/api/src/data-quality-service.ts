import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { issueDownloadGrant, verifyDownloadGrant } from "@scoutops/storage";
import type { OrganizationId, WorkspaceId } from "@scoutops/contracts";

export class DataQualityServiceError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
  ) {
    super(code);
    this.name = "DataQualityServiceError";
  }
}
export interface EvidenceMetadata {
  id: string;
  organization_id: string;
  workspace_id: string;
  collection_task_id: string;
  provider_id: string;
  provider_name: string;
  source_url: string;
  canonical_url: string;
  content_sha256: string;
  content_type: string;
  size_bytes: number;
  captured_at: string;
  parser_version: string;
  adapter_version: string;
  retention_until: string;
  status: string;
  request_id: string;
  trace_id: string;
}
export interface QualityIssueSummary {
  id: string;
  organization_id: string;
  workspace_id: string;
  provider_id: string;
  provider_name: string;
  reconciliation_run_id: string | null;
  raw_evidence_id: string | null;
  parser_version: string | null;
  metric_code: string;
  field_path: string | null;
  severity: "warning" | "critical";
  status: "open" | "resolved";
  actual_value: number | null;
  threshold_value: number | null;
  assigned_membership_id: string | null;
  assigned_member_label: string | null;
  attribution_reason: string | null;
  resolution_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}
export interface QualityIssueMemberOption {
  id: string;
  organization_id: string;
  label: string;
}
export interface DataQualityRepository {
  dashboard(input: {
    organizationId?: string;
    workspaceId?: string;
    status?: string;
    page: number;
    pageSize: number;
  }): Promise<{
    evidence: EvidenceMetadata[];
    issues: QualityIssueSummary[];
    reconciliationRuns: Array<Record<string, unknown>>;
    memberOptions: QualityIssueMemberOption[];
    totalEvidence: number;
    totalIssues: number;
    openIssues: number;
    criticalIssues: number;
  }>;
  evidenceDetail(id: string): Promise<Record<string, unknown> | null>;
  createFromTrendEvidence(input: {
    organizationId: string;
    workspaceId: string;
    topicId: string;
    evidenceId: string;
    actorId: string;
    severity: "warning" | "critical";
    reason: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<{ issue: QualityIssueSummary; created: boolean }>;
  resolveIssue(input: {
    id: string;
    actorId: string;
    reason: string;
    expectedVersion: number;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<QualityIssueSummary>;
  batchIssues(input: {
    items: Array<{ id: string; expectedVersion: number }>;
    action: "attribute" | "assign" | "close";
    reason: string;
    assigneeMembershipId: string | null;
    actorId: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<QualityIssueSummary[]>;
  fileInfo(id: string): Promise<{
    id: string;
    organization_id: string;
    workspace_id: string;
    relative_path: string;
    content_sha256: string;
    content_type: string;
    size_bytes: number;
    status: string;
  } | null>;
  saveDownloadGrant(input: {
    evidenceId: string;
    actorId: string;
    idempotencyKey: string;
    requestId: string;
    traceId: string;
    result: { grant: string; expires_at: string };
    now: Date;
  }): Promise<{ grant: string; expires_at: string }>;
  recordDownload(input: {
    evidenceId: string;
    actorId: string;
    requestId: string;
    traceId: string;
    now: Date;
  }): Promise<void>;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  pageValue = (value: unknown, fallback: number) =>
    value === undefined
      ? fallback
      : typeof value === "string" && /^\d+$/.test(value)
        ? Number(value)
        : value;
export class DataQualityService {
  constructor(
    private readonly repository: DataQualityRepository,
    private readonly options: {
      evidenceRoot: string;
      downloadSigningKey: string;
      downloadGrantSeconds: number;
    },
    private readonly now: () => Date = () => new Date(),
  ) {}
  async dashboard(input: {
    organization_id?: string;
    workspace_id?: string;
    status?: string;
    page?: number | string;
    page_size?: number | string;
  }) {
    if (input.workspace_id && !input.organization_id)
      throw new DataQualityServiceError(
        "data_quality_scope_invalid",
        400,
        "选择组织后再筛选工作区。",
      );
    if (
      (input.organization_id && !uuid.test(input.organization_id)) ||
      (input.workspace_id && !uuid.test(input.workspace_id))
    )
      throw new DataQualityServiceError(
        "data_quality_scope_invalid",
        400,
        "刷新组织与工作区筛选。",
      );
    if (input.status && !["open", "resolved", "all"].includes(input.status))
      throw new DataQualityServiceError(
        "data_quality_status_invalid",
        400,
        "使用 open、resolved 或 all。",
      );
    const page = pageValue(input.page, 1),
      pageSize = pageValue(input.page_size, 20);
    if (
      typeof page !== "number" ||
      !Number.isInteger(page) ||
      page < 1 ||
      typeof pageSize !== "number" ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    )
      throw new DataQualityServiceError(
        "data_quality_pagination_invalid",
        400,
        "page 应为正整数，page_size 应为 1–100。",
      );
    const result = await this.repository.dashboard({
      ...(input.organization_id ? { organizationId: input.organization_id } : {}),
      ...(input.workspace_id ? { workspaceId: input.workspace_id } : {}),
      ...(input.status && input.status !== "all" ? { status: input.status } : {}),
      page,
      pageSize,
    });
    return { ...result, observedAt: this.now().toISOString() };
  }
  async detail(id: string) {
    if (!uuid.test(id))
      throw new DataQualityServiceError("evidence_id_invalid", 400, "证据 ID 无效。");
    const value = await this.repository.evidenceDetail(id);
    if (!value) throw new DataQualityServiceError("evidence_not_found", 404, "刷新证据列表。");
    return value;
  }
  async createFromTrendEvidence(
    topicId: string,
    evidenceId: string,
    body: { severity?: unknown; reason?: unknown },
    context: {
      organizationId: string;
      workspaceId: string;
      actorId: string;
      idempotencyKey: string;
      requestId: string;
      traceId: string;
    },
  ) {
    if (!uuid.test(topicId) || !uuid.test(evidenceId))
      throw new DataQualityServiceError(
        "trend_evidence_id_invalid",
        400,
        "刷新趋势详情后重新选择证据。",
      );
    const severity = String(body?.severity ?? ""),
      reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!["warning", "critical"].includes(severity) || reason.length < 2 || reason.length > 500)
      throw new DataQualityServiceError(
        "trend_evidence_issue_invalid",
        400,
        "选择风险等级并填写 2–500 字异常说明。",
      );
    return this.repository.createFromTrendEvidence({
      ...context,
      topicId,
      evidenceId,
      severity: severity as "warning" | "critical",
      reason,
      now: this.now(),
    });
  }
  async resolveIssue(
    id: string,
    body: { reason?: unknown; expected_version?: unknown },
    context: { actorId: string; idempotencyKey: string; requestId: string; traceId: string },
  ) {
    if (!uuid.test(id))
      throw new DataQualityServiceError("quality_issue_id_invalid", 400, "质量问题 ID 无效。");
    if (
      typeof body.reason !== "string" ||
      body.reason.trim().length < 2 ||
      body.reason.length > 500 ||
      !Number.isInteger(body.expected_version) ||
      Number(body.expected_version) < 1
    )
      throw new DataQualityServiceError(
        "quality_issue_resolution_invalid",
        400,
        "提供 2–500 字符原因和有效 expected_version。",
      );
    return this.repository.resolveIssue({
      id,
      actorId: context.actorId,
      reason: body.reason.trim(),
      expectedVersion: Number(body.expected_version),
      idempotencyKey: context.idempotencyKey,
      requestId: context.requestId,
      traceId: context.traceId,
      now: this.now(),
    });
  }
  async batchIssues(
    body: { items?: unknown; action?: unknown; reason?: unknown; assignee_membership_id?: unknown },
    context: { actorId: string; idempotencyKey: string; requestId: string; traceId: string },
  ) {
    const action = String(body?.action ?? ""),
      reason = String(body?.reason ?? "").trim(),
      items = Array.isArray(body?.items) ? body.items : [];
    if (
      !["attribute", "assign", "close"].includes(action) ||
      items.length < 1 ||
      items.length > 50 ||
      reason.length < 2 ||
      reason.length > 500
    )
      throw new DataQualityServiceError(
        "quality_issue_batch_invalid",
        400,
        "选择 1–50 个问题、操作类型并填写 2–500 字原因。",
      );
    const normalized = items.map((item: any) => ({
      id: String(item?.id ?? ""),
      expectedVersion: Number(item?.expected_version),
    }));
    if (
      normalized.some(
        (item) =>
          !uuid.test(item.id) ||
          !Number.isInteger(item.expectedVersion) ||
          item.expectedVersion < 1,
      ) ||
      new Set(normalized.map((item) => item.id)).size !== normalized.length
    )
      throw new DataQualityServiceError(
        "quality_issue_batch_invalid",
        400,
        "刷新问题版本并重新选择，不能重复选择同一问题。",
      );
    const assignee =
      body.assignee_membership_id == null || body.assignee_membership_id === ""
        ? null
        : String(body.assignee_membership_id);
    if (action === "assign" && (!assignee || !uuid.test(assignee)))
      throw new DataQualityServiceError(
        "quality_issue_assignee_invalid",
        400,
        "选择当前问题所属组织的活动成员。",
      );
    return this.repository.batchIssues({
      items: normalized,
      action: action as "attribute" | "assign" | "close",
      reason,
      assigneeMembershipId: assignee,
      actorId: context.actorId,
      idempotencyKey: context.idempotencyKey,
      requestId: context.requestId,
      traceId: context.traceId,
      now: this.now(),
    });
  }
  async issueDownload(
    id: string,
    context: { actorId: string; idempotencyKey: string; requestId: string; traceId: string },
  ) {
    if (!this.options.downloadSigningKey)
      throw new DataQualityServiceError(
        "evidence_download_disabled",
        503,
        "在宝塔受限环境配置证据下载签名密钥。",
      );
    const file = await this.file(id),
      now = this.now(),
      result = {
        grant: issueDownloadGrant(
          this.options.evidenceRoot,
          {
            organization_id: file.organization_id as OrganizationId,
            workspace_id: file.workspace_id as WorkspaceId,
            category: "evidence",
            resource_id: id,
            filename: `${id}.bin`,
          },
          Buffer.from(this.options.downloadSigningKey),
          this.options.downloadGrantSeconds,
          Math.floor(now.getTime() / 1000),
        ),
        expires_at: new Date(
          now.getTime() + this.options.downloadGrantSeconds * 1000,
        ).toISOString(),
      };
    return this.repository.saveDownloadGrant({
      evidenceId: id,
      actorId: context.actorId,
      idempotencyKey: context.idempotencyKey,
      requestId: context.requestId,
      traceId: context.traceId,
      result,
      now,
    });
  }
  async download(
    id: string,
    grant: string,
    context: { actorId: string; requestId: string; traceId: string },
  ) {
    const file = await this.file(id),
      now = this.now();
    let claims;
    try {
      claims = verifyDownloadGrant(
        grant,
        Buffer.from(this.options.downloadSigningKey),
        { organization_id: file.organization_id, workspace_id: file.workspace_id },
        Math.floor(now.getTime() / 1000),
      );
    } catch {
      throw new DataQualityServiceError(
        "evidence_download_grant_invalid",
        403,
        "重新申请短时下载授权。",
      );
    }
    if (claims.relative_path !== file.relative_path)
      throw new DataQualityServiceError(
        "evidence_download_grant_invalid",
        403,
        "重新申请短时下载授权。",
      );
    const content = await readFile(resolve(this.options.evidenceRoot, file.relative_path));
    if (
      content.byteLength !== file.size_bytes ||
      createHash("sha256").update(content).digest("hex") !== file.content_sha256
    )
      throw new DataQualityServiceError(
        "evidence_integrity_failed",
        409,
        "隔离该证据并联系平台管理员。",
      );
    await this.repository.recordDownload({
      evidenceId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      traceId: context.traceId,
      now,
    });
    return { content, contentType: file.content_type, sha256: file.content_sha256 };
  }
  private async file(id: string) {
    if (!uuid.test(id))
      throw new DataQualityServiceError("evidence_id_invalid", 400, "证据 ID 无效。");
    const file = await this.repository.fileInfo(id);
    if (!file || file.status !== "active")
      throw new DataQualityServiceError("evidence_not_found", 404, "刷新证据列表。");
    return file;
  }
}
