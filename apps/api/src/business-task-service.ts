import { randomUUID } from "node:crypto";
export type TaskContext = {
  organizationId: string;
  workspaceId: string;
  actorId: string;
  requestId: string;
  traceId: string;
  idempotencyKey: string;
};
export type TaskMutationContext =
  | TaskContext
  | (Omit<TaskContext, "organizationId" | "workspaceId"> & { accountOwnedMutation: true });
export class BusinessTaskError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
    message = code,
  ) {
    super(message);
    this.name = "BusinessTaskError";
  }
}
const text = (v: unknown, n: string, max: number) => {
    if (typeof v !== "string" || !v.trim() || v.trim().length > max)
      throw new BusinessTaskError("task_input_invalid", 400, `修正 ${n}。`);
    return v.trim();
  },
  uuid = (v: unknown, n: string) => {
    const x = text(v, n, 36);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x))
      throw new BusinessTaskError("task_input_invalid", 400, `修正 ${n}。`);
    return x;
  },
  date = (v: unknown) => {
    if (v == null || v === "") return null;
    const x = new Date(String(v));
    if (Number.isNaN(x.valueOf()))
      throw new BusinessTaskError("task_due_at_invalid", 400, "提交有效截止时间。");
    return x;
  };
export function validateTask(v: any, preserveOmittedAssignee = false) {
  if (!["low", "normal", "high", "critical"].includes(v?.priority))
    throw new BusinessTaskError("task_priority_invalid", 400, "选择有效优先级。");
  return {
    title: text(v?.title, "title", 200),
    description:
      typeof v?.description === "string" && v.description.length <= 5000
        ? v.description.trim()
        : (() => {
            throw new BusinessTaskError("task_input_invalid", 400, "修正 description。");
          })(),
    priority: v.priority,
    assignee_id:
      preserveOmittedAssignee && v?.assignee_id == null
        ? null
        : uuid(v?.assignee_id, "assignee_id"),
    due_at: date(v?.due_at),
  };
}
export function validateAction(v: any) {
  const action = v?.action;
  if (
    !["start", "pause", "resume", "complete", "cancel", "delay", "transfer", "progress"].includes(
      action,
    )
  )
    throw new BusinessTaskError("task_action_invalid", 400, "选择有效任务动作。");
  const expected = Number(v?.expected_version);
  if (!Number.isSafeInteger(expected) || expected < 1)
    throw new BusinessTaskError("task_version_invalid", 400, "提交当前任务版本。");
  const reason = ["pause", "cancel", "delay", "transfer"].includes(action)
    ? text(v?.reason, "reason", 500)
    : null;
  const dueAt = action === "delay" ? date(v?.due_at) : null;
  if (action === "delay" && !dueAt)
    throw new BusinessTaskError("task_due_at_invalid", 400, "延期必须提交新的截止时间。");
  const progress = action === "progress" ? Number(v?.progress_percent) : null;
  if (action === "progress" && (!Number.isInteger(progress) || progress! < 0 || progress! > 100))
    throw new BusinessTaskError("task_progress_invalid", 400, "进度必须是 0–100 的整数。");
  return {
    action,
    expected_version: expected,
    reason,
    due_at: dueAt,
    assignee_id: action === "transfer" ? uuid(v?.assignee_id, "assignee_id") : null,
    progress_percent: progress,
    progress_note: action === "progress" ? text(v?.progress_note, "progress_note", 500) : null,
  };
}
export function validateUpdate(v: any, preserveOmittedAssignee = false) {
  const expected = Number(v?.expected_version);
  if (!Number.isSafeInteger(expected) || expected < 1)
    throw new BusinessTaskError("task_version_invalid", 400, "提交当前任务版本。");
  return {
    ...validateTask(v, preserveOmittedAssignee),
    expected_version: expected,
    reason: text(v?.reason, "reason", 500),
  };
}
export function validateDelete(v: any) {
  const expected = Number(v?.expected_version);
  if (!Number.isSafeInteger(expected) || expected < 1)
    throw new BusinessTaskError("task_version_invalid", 400, "提交当前任务版本。");
  return { expected_version: expected, reason: text(v?.reason, "reason", 500) };
}
export interface BusinessTaskRepository {
  list(i: any): Promise<any>;
  memberOptions(i: any): Promise<any>;
  detail(i: any): Promise<any>;
  create(i: any): Promise<any>;
  update(i: any): Promise<any>;
  remove(i: any): Promise<any>;
  action(i: any): Promise<any>;
  comment(i: any): Promise<any>;
  summary(i: any): Promise<any>;
}
export class BusinessTaskService {
  constructor(private readonly repo: BusinessTaskRepository) {}
  list(i: any) {
    const page = Math.max(1, Number(i.page) || 1),
      pageSize = Math.min(200, Math.max(1, Number(i.pageSize) || 50)),
      status = String(i.status ?? "").trim(),
      query = String(i.query ?? "").trim(),
      sort = String(i.sort ?? "priority_due").trim();
    if (status && !["todo", "in_progress", "paused", "completed", "cancelled"].includes(status))
      throw new BusinessTaskError("task_status_invalid", 400, "选择有效任务状态。");
    if (query.length > 200)
      throw new BusinessTaskError("task_query_invalid", 400, "搜索内容不能超过 200 个字符。");
    if (!["priority_due", "due_asc", "updated_desc", "created_desc"].includes(sort))
      throw new BusinessTaskError("task_sort_invalid", 400, "选择有效排序方式。");
    return this.repo.list({
      ...i,
      page,
      pageSize,
      status: status || null,
      query: query || null,
      sort,
      mine: i.mine === "true",
    });
  }
  summary(i: any) {
    return this.repo.summary(i);
  }
  memberOptions(i: any) {
    return this.repo.memberOptions(i);
  }
  detail(i: any) {
    return this.repo.detail({ ...i, taskId: uuid(i.taskId, "task_id") });
  }
  create(i: TaskContext & { value: any }) {
    return this.repo.create({
      ...i,
      id: randomUUID(),
      value: validateTask({ ...i.value, assignee_id: i.value?.assignee_id ?? i.actorId }),
      route: "POST:/api/v1/tasks",
    });
  }
  update(i: TaskMutationContext & { taskId: string; value: any }) {
    const account = "accountOwnedMutation" in i;
    const parsed = uuid(i.taskId, "task_id"),
      taskId = account ? parsed.toLowerCase() : parsed;
    return this.repo.update({
      ...i,
      taskId,
      value: account
        ? validateUpdate(i.value, true)
        : validateUpdate({ ...i.value, assignee_id: i.value?.assignee_id ?? i.actorId }),
      route: account ? `PATCH:/api/v1/tasks/${taskId}:account` : "PATCH:/api/v1/tasks/:id",
    });
  }
  remove(i: TaskMutationContext & { taskId: string; value: any }) {
    const account = "accountOwnedMutation" in i;
    const parsed = uuid(i.taskId, "task_id"),
      taskId = account ? parsed.toLowerCase() : parsed;
    return this.repo.remove({
      ...i,
      taskId,
      value: validateDelete(i.value),
      route: account ? `DELETE:/api/v1/tasks/${taskId}:account` : "DELETE:/api/v1/tasks/:id",
    });
  }
  action(i: TaskMutationContext & { taskId: string; value: any }) {
    const accountMode = "accountOwnedMutation" in i;
    const parsedId = uuid(i.taskId, "task_id");
    const taskId = accountMode ? parsedId.toLowerCase() : parsedId;
    const value = validateAction(i.value);
    if (accountMode && value.action === "transfer")
      throw new BusinessTaskError("task_account_transfer_unavailable", 403, "账号演练不支持转交。");
    return this.repo.action({
      ...i,
      taskId,
      value,
      route: accountMode
        ? `POST:/api/v1/tasks/${taskId}/actions:account`
        : "POST:/api/v1/tasks/:id/actions",
    });
  }
  comment(i: TaskMutationContext & { taskId: string; value: any }) {
    const accountMode = "accountOwnedMutation" in i;
    const parsedId = uuid(i.taskId, "task_id");
    const taskId = accountMode ? parsedId.toLowerCase() : parsedId;
    return this.repo.comment({
      ...i,
      taskId,
      id: randomUUID(),
      body: text(i.value?.body, "body", 2000),
      route: accountMode
        ? `POST:/api/v1/tasks/${taskId}/comments:account`
        : "POST:/api/v1/tasks/:id/comments",
    });
  }
}
