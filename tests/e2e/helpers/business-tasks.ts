import type { Page } from "@playwright/test";
const taskId = "00000000-0000-4000-8000-000000000801",
  actor = "00000000-0000-4000-8000-000000000802",
  env = (data: unknown) => ({
    data,
    request_id: "m05-01-e2e",
    trace_id: "m05-01-trace",
  });
const task = {
  id: taskId,
  title: "核验便携净水杯供应商报价",
  description: "对照原始证据确认 MOQ 与交期",
  status: "in_progress",
  priority: "high",
  assignee_id: actor,
  source_type: "sourcing_purchase",
  source_ref_id: "00000000-0000-4000-8000-000000000803",
  progress_percent: 35,
  progress_note: "已完成亚马逊竞品初筛",
  due_at: "2026-08-09T10:00:00.000Z",
  completed_at: null,
  sla_status: "due_soon",
  version: 2,
  created_by: actor,
  created_at: "2026-08-08T09:00:00.000Z",
  updated_at: "2026-08-08T10:00:00.000Z",
};
async function setup(
  page: Page,
  pausedDetail = false,
  capabilities = [
    "task:read",
    "task:create",
    "task:update",
    "task:assign",
    "notification:read",
    "opportunity:decide",
    "report:read",
  ],
) {
  const observed = {
    createRequests: 0,
    detailRequests: 0,
    listRequests: 0,
    summaryRequests: 0,
    actionRequests: 0,
    commentRequests: 0,
  };
  let themePreference = {
    theme: "deep-ocean",
    source: "saved",
    organization_id: "00000000-0000-4000-8000-000000000804",
    workspace_id: "00000000-0000-4000-8000-000000000805",
    version: 1,
    updated_at: "2026-08-19T00:00:00.000Z",
  };
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({ json: env({ authenticated: true }) }),
  );
  await page.route("**/api/v1/me/navigation?shell=member", (r) =>
    r.fulfill({
      json: env({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000804",
        workspace_id: "00000000-0000-4000-8000-000000000805",
        organization_name: "米豆智能选品",
        workspace_name: "跨境新品工作区",
        roles: ["selection_manager"],
        capabilities,
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/me/ui-preferences", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as { theme: string };
      themePreference = {
        ...themePreference,
        theme: body.theme,
        version: themePreference.version + 1,
        updated_at: "2026-08-19T01:00:00.000Z",
      };
    }
    await route.fulfill({ json: env(themePreference) });
  });
  await page.route("**/api/v1/me/profile", (r) =>
    r.fulfill({
      json: env({
        id: actor,
        email: "member@scoutops.cn",
        display_name: "测试成员",
        avatar_url: null,
        phone: "13800000000",
        locale: "zh-CN",
        timezone: "Asia/Shanghai",
        status: "active",
        last_login_at: "2026-08-19T00:00:00.000Z",
        created_at: "2026-08-08T00:00:00.000Z",
        updated_at: "2026-08-19T00:00:00.000Z",
        version: 1,
      }),
    }),
  );
  await page.route("**/api/v1/me/authorization", (r) =>
    r.fulfill({
      json: env({ roles: ["选品经理"], capabilities: ["task:read"], data_scopes: ["workspace"] }),
    }),
  );
  await page.route("**/api/v1/me/sessions", (r) => r.fulfill({ json: env([]) }));
  await page.route("**/api/v1/me/notification-preferences", (r) =>
    r.fulfill({
      json: env({
        version: 1,
        in_app_enabled: true,
        email_enabled: false,
        task_enabled: true,
        approval_enabled: true,
        competitor_enabled: true,
      }),
    }),
  );
  await page.route("**/api/v1/me/assets", (r) =>
    r.fulfill({ json: env({ followed_trends: [], decisions: [], tasks: [] }) }),
  );
  await page.route("**/api/v1/tasks/approvals?*", (r) => r.fulfill({ json: env([]) }));
  await page.route("**/api/v1/tasks/approval-templates", (r) => r.fulfill({ json: env([]) }));
  await page.route("**/api/v1/notifications?*", (r) => r.fulfill({ json: env([]) }));
  await page.route("**/api/v1/notifications/summary", (r) =>
    r.fulfill({
      json: env({ total: 0, unread: 0, task: 0, approval: 0, competitor: 0, system: 0 }),
    }),
  );
  await page.route("**/api/v1/tasks/summary", (r) => {
    observed.summaryRequests += 1;
    return r.fulfill({
      json: env({
        todo: 2,
        in_progress: 1,
        paused: 0,
        completed: 4,
        cancelled: 0,
        overdue: 1,
      }),
    });
  });
  await page.route("**/api/v1/tasks/member-options", (r) =>
    r.fulfill({ json: env([{ id: actor, label: "测试成员" }]) }),
  );
  await page.route(`**/api/v1/tasks/${taskId}`, (r) => {
    observed.detailRequests += 1;
    return r.fulfill({
      json: env({
        ...task,
        status: pausedDetail ? "paused" : task.status,
        comments: [
          {
            id: "00000000-0000-4000-8000-000000000806",
            body: "报价证据已核验，等待确认交期。",
            created_by: actor,
            created_at: "2026-08-08T10:05:00.000Z",
          },
        ],
        events: [
          ...(pausedDetail
            ? [
                {
                  id: "00000000-0000-4000-8000-000000000808",
                  event_type: "task.pause",
                  actor_id: actor,
                  payload: { reason: "等待供应商补充交期证明" },
                  created_at: "2026-08-08T10:08:00.000Z",
                },
              ]
            : []),
          {
            id: "00000000-0000-4000-8000-000000000809",
            event_type: "task.comment.created",
            actor_id: actor,
            payload: { comment_id: "00000000-0000-4000-8000-000000000806" },
            created_at: "2026-08-08T10:05:00.000Z",
          },
        ],
      }),
    });
  });
  await page.route(`**/api/v1/tasks/${taskId}/actions`, async (route) => {
    observed.actionRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({ json: env({ ...task, version: task.version + 1 }) });
  });
  await page.route(`**/api/v1/tasks/${taskId}/comments`, async (route) => {
    observed.commentRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({ status: 201, json: env({ id: crypto.randomUUID() }) });
  });
  await page.route("**/api/v1/tasks?*", (r) => {
    observed.listRequests += 1;
    return r.fulfill({
      json: {
        ...env([
          task,
          {
            ...task,
            id: "00000000-0000-4000-8000-000000000807",
            title: "补齐竞品价格证据",
            status: "todo",
            priority: "normal",
            due_at: null,
            sla_status: "not_set",
            version: 1,
          },
        ]),
        meta: {
          page: Number(new URL(r.request().url()).searchParams.get("page") ?? 1),
          page_size: 10,
          total: new URL(r.request().url()).searchParams.get("page") === "2" ? 20 : 2,
        },
      },
    });
  });
  await page.route("**/api/v1/tasks", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    observed.createRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 120));
    await route.fulfill({ status: 201, json: env({ ...task, id: crypto.randomUUID() }) });
  });
  return observed;
}

export { setup as setupBusinessTasks, taskId, actor, env, task };
