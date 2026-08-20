import { randomUUID } from "node:crypto";
export type ApprovalContext = {
  organizationId: string;
  workspaceId: string;
  actorId: string;
  requestId: string;
  traceId: string;
  idempotencyKey: string;
};
export class ApprovalServiceError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "ApprovalServiceError";
  }
}
const text = (v: unknown, n: string, max: number) => {
    if (typeof v !== "string" || !v.trim() || v.trim().length > max)
      throw new ApprovalServiceError("approval_input_invalid", 400, `修正 ${n}。`);
    return v.trim();
  },
  uuid = (v: unknown, n: string) => {
    const x = text(v, n, 36);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x))
      throw new ApprovalServiceError("approval_input_invalid", 400, `修正 ${n}。`);
    return x;
  },
  version = (v: unknown) => {
    const n = Number(v);
    if (!Number.isSafeInteger(n) || n < 1)
      throw new ApprovalServiceError("approval_version_invalid", 400, "提交当前版本。");
    return n;
  };
export function validateTemplate(v: any) {
  if (!["task", "opportunity_decision"].includes(v?.resource_type))
    throw new ApprovalServiceError("approval_resource_type_invalid", 400, "选择任务或机会决策。");
  if (!Array.isArray(v?.nodes) || v.nodes.length < 1 || v.nodes.length > 10)
    throw new ApprovalServiceError("approval_nodes_invalid", 400, "审批模板需要 1–10 个节点。");
  const nodes = v.nodes.map((x: any, i: number) => {
    const sla = Number(x?.sla_minutes);
    if (!Number.isSafeInteger(sla) || sla < 1 || sla > 43200)
      throw new ApprovalServiceError("approval_sla_invalid", 400, "节点 SLA 必须为 1–43200 分钟。");
    return {
      ordinal: i + 1,
      name: text(x?.name, "node.name", 120),
      approver_id: uuid(x?.approver_id, "approver_id"),
      escalation_assignee_id: uuid(x?.escalation_assignee_id, "escalation_assignee_id"),
      sla_minutes: sla,
    };
  });
  return {
    name: text(v?.name, "name", 200),
    resource_type: v.resource_type,
    nodes,
  };
}
export function validateRequest(v: any) {
  if (!["task", "opportunity_decision"].includes(v?.resource_type))
    throw new ApprovalServiceError("approval_resource_type_invalid", 400, "选择任务或机会决策。");
  return {
    template_id: uuid(v?.template_id, "template_id"),
    resource_type: v.resource_type,
    resource_id: uuid(v?.resource_id, "resource_id"),
    title: text(v?.title, "title", 200),
  };
}
export function validateDecision(v: any) {
  if (!["approve", "reject"].includes(v?.action))
    throw new ApprovalServiceError("approval_action_invalid", 400, "选择批准或驳回。");
  return {
    action: v.action,
    expected_version: version(v?.expected_version),
    reason: text(v?.reason, "reason", 1000),
  };
}
export interface ApprovalRepository {
  listTemplates(i: any): Promise<any>;
  createTemplate(i: any): Promise<any>;
  publishTemplate(i: any): Promise<any>;
  listRequests(i: any): Promise<any>;
  detail(i: any): Promise<any>;
  createRequest(i: any): Promise<any>;
  decide(i: any): Promise<any>;
}
export class ApprovalService {
  constructor(private readonly repo: ApprovalRepository) {}
  listTemplates(i: any) {
    return this.repo.listTemplates(i);
  }
  createTemplate(i: ApprovalContext & { value: any }) {
    return this.repo.createTemplate({
      ...i,
      id: randomUUID(),
      versionId: randomUUID(),
      value: validateTemplate(i.value),
      route: "POST:/api/v1/tasks/approval-templates",
    });
  }
  publishTemplate(i: ApprovalContext & { templateId: string; value: any }) {
    return this.repo.publishTemplate({
      ...i,
      templateId: uuid(i.templateId, "template_id"),
      expectedRevision: version(i.value?.expected_revision),
      reason: text(i.value?.reason, "reason", 1000),
      route: "POST:/api/v1/tasks/approval-templates/:id/actions",
    });
  }
  listRequests(i: any) {
    const page = Math.max(1, Number(i.page) || 1),
      pageSize = Math.min(200, Math.max(1, Number(i.pageSize) || 50));
    return this.repo.listRequests({
      ...i,
      page,
      pageSize,
      mine: i.mine === "true",
      involvement: ["decidable", "requested"].includes(i.involvement) ? i.involvement : null,
      status: ["pending", "approved", "rejected", "cancelled"].includes(i.status) ? i.status : null,
    });
  }
  detail(i: any) {
    return this.repo.detail({
      ...i,
      requestIdValue: uuid(i.requestIdValue, "approval_request_id"),
    });
  }
  createRequest(i: ApprovalContext & { value: any }) {
    return this.repo.createRequest({
      ...i,
      id: randomUUID(),
      value: validateRequest(i.value),
      route: "POST:/api/v1/tasks/approvals",
    });
  }
  decide(i: ApprovalContext & { requestIdValue: string; value: any }) {
    return this.repo.decide({
      ...i,
      requestIdValue: uuid(i.requestIdValue, "approval_request_id"),
      value: validateDecision(i.value),
      route: "POST:/api/v1/tasks/approvals/:id/actions",
    });
  }
}
