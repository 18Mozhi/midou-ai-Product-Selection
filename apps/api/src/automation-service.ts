import { randomUUID } from "node:crypto";
export class AutomationServiceError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "AutomationServiceError";
  }
}
const text = (v: unknown, n: string, max: number) => {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    throw new AutomationServiceError("automation_input_invalid", 400, `修正 ${n}。`);
  return v.trim();
};
const uuid = (v: unknown, n: string) => {
  const x = text(v, n, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x))
    throw new AutomationServiceError("automation_input_invalid", 400, `修正 ${n}。`);
  return x;
};
const integer = (v: unknown, n: string, min: number, max: number) => {
  const x = Number(v);
  if (!Number.isSafeInteger(x) || x < min || x > max)
    throw new AutomationServiceError(
      "automation_input_invalid",
      400,
      `${n} 必须为 ${min}–${max} 的整数。`,
    );
  return x;
};
export const AUTOMATION_TRIGGERS = [
  "approval.overdue",
  "approval.node.rejected",
  "competitor.alert.queued",
  "task.created",
] as const;
export function validateAutomationRule(v: any, defaultRateLimit = 20) {
  if (!AUTOMATION_TRIGGERS.includes(v?.trigger_event_type))
    throw new AutomationServiceError("automation_trigger_invalid", 400, "选择已支持的事务事件。");
  if (!["any", "info", "warning", "critical"].includes(v?.condition_severity))
    throw new AutomationServiceError("automation_condition_invalid", 400, "选择有效严重程度。");
  if (!["notify_owner", "create_task"].includes(v?.action_type))
    throw new AutomationServiceError("automation_action_invalid", 400, "选择安全动作。");
  if (v.action_type === "create_task" && String(v.trigger_event_type).startsWith("task."))
    throw new AutomationServiceError(
      "automation_cycle_forbidden",
      400,
      "任务事件不能再次创建任务。",
    );
  return {
    name: text(v.name, "name", 200),
    trigger_event_type: v.trigger_event_type,
    condition_severity: v.condition_severity,
    action_type: v.action_type,
    owner_id: uuid(v.owner_id, "owner_id"),
    action_assignee_id:
      v.action_type === "create_task" ? uuid(v.action_assignee_id, "action_assignee_id") : null,
    action_title: text(v.action_title, "action_title", 200),
    rate_limit_count: integer(v.rate_limit_count ?? defaultRateLimit, "rate_limit_count", 1, 1000),
    rate_limit_window_minutes: integer(
      v.rate_limit_window_minutes ?? 60,
      "rate_limit_window_minutes",
      1,
      1440,
    ),
  };
}
export interface AutomationRepository {
  list(i: any): Promise<any>;
  preview(i: any): Promise<any>;
  create(i: any): Promise<any>;
  update(i: any): Promise<any>;
  detail(i: any): Promise<any>;
  changeStatus(i: any): Promise<any>;
}
export class AutomationService {
  constructor(
    private readonly repo: AutomationRepository,
    private readonly defaultRateLimit = 20,
  ) {}
  list(i: any) {
    return this.repo.list(i);
  }
  preview(i: any) {
    return this.repo.preview({
      ...i,
      value: validateAutomationRule(i.value, this.defaultRateLimit),
    });
  }
  detail(i: any) {
    return this.repo.detail({ ...i, ruleId: uuid(i.ruleId, "rule_id") });
  }
  create(i: any) {
    return this.repo.create({
      ...i,
      id: randomUUID(),
      value: validateAutomationRule(i.value, this.defaultRateLimit),
      route: "POST:/api/v1/automations",
    });
  }
  update(i: any) {
    return this.repo.update({
      ...i,
      ruleId: uuid(i.ruleId, "rule_id"),
      value: {
        ...validateAutomationRule(i.value, this.defaultRateLimit),
        expected_version: integer(i.value?.expected_version, "expected_version", 1, 2147483647),
        reason: text(i.value?.reason, "reason", 1000),
      },
      route: "PATCH:/api/v1/automations/:id",
    });
  }
  changeStatus(i: any) {
    if (!["pause", "resume"].includes(i.value?.action))
      throw new AutomationServiceError("automation_action_invalid", 400, "选择暂停或恢复。");
    return this.repo.changeStatus({
      ...i,
      ruleId: uuid(i.ruleId, "rule_id"),
      value: {
        action: i.value.action,
        expected_version: integer(i.value.expected_version, "expected_version", 1, 2147483647),
        reason: text(i.value.reason, "reason", 1000),
      },
      route: "POST:/api/v1/automations/:id/actions",
    });
  }
}
