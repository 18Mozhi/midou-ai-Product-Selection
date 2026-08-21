import { randomUUID } from "node:crypto";
export type TaskContext = {
  organizationId: string;
  workspaceId: string;
  actorId: string;
  requestId: string;
  traceId: string;
  idempotencyKey: string;
};
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
export function validateTask(v: any) {
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
    assignee_id: uuid(v?.assignee_id, "assignee_id"),
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
export function validateUpdate(v: any) {
  const expected = Number(v?.expected_version);
  if (!Number.isSafeInteger(expected) || expected < 1)
    throw new BusinessTaskError("task_version_invalid", 400, "提交当前任务版本。");
  return { ...validateTask(v), expected_version: expected, reason: text(v?.reason, "reason", 500) };
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
      pageSize = Math.min(200, Math.max(1, Number(i.pageSize) || 50));
    return this.repo.list({
      ...i,
      page,
      pageSize,
      status: ["todo", "in_progress", "completed", "cancelled"].includes(i.status)
        ? i.status
        : null,
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
  update(i: TaskContext & { taskId: string; value: any }) {
    return this.repo.update({
      ...i,
      taskId: uuid(i.taskId, "task_id"),
      value: validateUpdate({ ...i.value, assignee_id: i.value?.assignee_id ?? i.actorId }),
      route: "PATCH:/api/v1/tasks/:id",
    });
  }
  remove(i: TaskContext & { taskId: string; value: any }) {
    return this.repo.remove({
      ...i,
      taskId: uuid(i.taskId, "task_id"),
      value: validateDelete(i.value),
      route: "DELETE:/api/v1/tasks/:id",
    });
  }
  action(i: TaskContext & { taskId: string; value: any }) {
    return this.repo.action({
      ...i,
      taskId: uuid(i.taskId, "task_id"),
      value: validateAction(i.value),
      route: "POST:/api/v1/tasks/:id/actions",
    });
  }
  comment(i: TaskContext & { taskId: string; value: any }) {
    return this.repo.comment({
      ...i,
      taskId: uuid(i.taskId, "task_id"),
      id: randomUUID(),
      body: text(i.value?.body, "body", 2000),
      route: "POST:/api/v1/tasks/:id/comments",
    });
  }
}
