import { test, expect, type Page } from "@playwright/test";
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
test("M05-01.A07/A08/A09/A15 renders truthful task SLA detail and comments on desktop and 390", async ({
  page,
}) => {
  await setup(page, true);
  await page.goto("/work");
  await expect(page.getByRole("heading", { name: "今日工作", level: 2 })).toBeVisible();
  await expect(page.getByText("24 小时内到期")).toBeVisible();
  await expect(page.getByText("未设置期限")).toBeVisible();
  await page.locator(".task-row-main").filter({ hasText: "核验便携净水杯供应商报价" }).click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}\\?from=`));
  await expect(page.getByRole("link", { name: "关闭任务详情" })).toHaveAttribute("href", /\/work/);
  await expect(page.getByRole("heading", { name: "任务活动" })).toBeVisible();
  await expect(page.getByText("报价证据已核验，等待确认交期。")).toBeVisible();
  await expect(page.getByText("下一步：在期限前完成当前阶段")).toBeVisible();
  const blockingContext = page.getByLabel("阻塞与下一负责人");
  await expect(blockingContext.getByText("等待供应商补充交期证明")).toBeVisible();
  await expect(blockingContext.getByText("测试成员", { exact: true })).toBeVisible();
  await expect(page.getByText("已暂停 · 35%", { exact: true })).toBeVisible();
  await expect(page.getByText("已完成亚马逊竞品初筛", { exact: true })).toBeVisible();
  await expect(page.getByText("报价证据已核验，等待确认交期。", { exact: true })).toHaveCount(1);
  await expect(page.getByText("comment.created", { exact: true })).toHaveCount(0);
  await expect(
    page.locator(".task-detail-facts").getByText("测试成员", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("暂停任务", { exact: true })).toBeVisible();
  await page.getByText("更多任务操作", { exact: true }).click();
  const secondaryActions = page.locator(".task-detail-more > div");
  await expect(page.getByRole("button", { name: "转交负责人" })).toBeVisible();
  await expect
    .poll(() =>
      secondaryActions.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= window.innerWidth;
      }),
    )
    .toBe(true);
  await page.getByText("更多任务操作", { exact: true }).click();
  await expect(page.locator(".task-detail-more")).not.toHaveAttribute("open", "");
  await expect(secondaryActions).toBeHidden();
  await expect(page).toHaveScreenshot("m05-01-business-tasks.png", {
    animations: "disabled",
    fullPage: true,
  });
});

test("task detail hides every write entry for read-only roles", async ({ page }) => {
  await setup(page, false, ["task:read"]);
  await page.goto(`/tasks/${taskId}?from=%2Ftasks%3Fstatus%3Din_progress`);
  await expect(page.getByText("当前角色仅可查看任务事实与活动记录")).toBeVisible();
  await expect(page.getByRole("link", { name: "关闭任务详情" })).toHaveAttribute(
    "href",
    "/tasks?status=in_progress",
  );
  await expect(page.getByRole("group", { name: "任务操作" })).toHaveCount(0);
  await expect(page.getByPlaceholder("添加可审计评论")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "删除任务" })).toHaveCount(0);
});

test("task update role keeps detail editing but cannot transfer ownership", async ({ page }) => {
  await setup(page, false, ["task:read", "task:update"]);
  await page.goto(`/tasks/${taskId}`);
  await expect(page.getByRole("button", { name: "更新进度" })).toBeVisible();
  await expect(page.getByPlaceholder("添加可审计评论")).toBeVisible();
  await page.getByText("更多任务操作", { exact: true }).click();
  await expect(page.getByRole("button", { name: "暂停" })).toBeVisible();
  await expect(page.getByRole("button", { name: "编辑任务" })).toBeVisible();
  await expect(page.getByRole("button", { name: "转交负责人" })).toHaveCount(0);
});

test("task detail blocks duplicate lifecycle and comment submissions", async ({ page }) => {
  const observed = await setup(page);
  await page.goto(`/tasks/${taskId}`);
  await page.getByRole("button", { name: "完成" }).dblclick();
  await expect(page.getByText(/任务已完成|任务动作已记录/)).toBeVisible();
  expect(observed.actionRequests).toBe(1);
  await page.getByPlaceholder("添加可审计评论").fill("重复提交保护验证");
  await page.getByRole("button", { name: "添加评论" }).dblclick();
  await expect(page.getByPlaceholder("添加可审计评论")).toHaveValue("");
  expect(observed.commentRequests).toBe(1);
});

test("direct task detail loads only its required APIs and rejects nested return routes", async ({
  page,
}) => {
  const observed = await setup(page);
  await page.goto(`/tasks/${taskId}?from=${encodeURIComponent(`/tasks/${taskId}`)}`);
  await expect(page.getByRole("heading", { name: task.title, level: 3 })).toBeVisible();
  await expect(page.getByRole("link", { name: "关闭任务详情" })).toHaveAttribute("href", "/tasks");
  expect(observed.detailRequests).toBe(1);
  expect(observed.listRequests).toBe(0);
  expect(observed.summaryRequests).toBe(0);
});

test("direct task detail exposes a recoverable not-found state", async ({ page }) => {
  await setup(page);
  await page.route(`**/api/v1/tasks/${taskId}`, (route) =>
    route.fulfill({
      status: 404,
      json: {
        error: {
          code: "task_not_found",
          message: "任务不存在。",
          action_hint: "返回任务列表后刷新。",
        },
        request_id: "m05-01-not-found",
        trace_id: "m05-01-not-found",
      },
    }),
  );
  await page.goto(`/tasks/${taskId}`);
  await expect(page.getByRole("heading", { name: "任务不存在或已删除" })).toBeVisible();
  await expect(
    page.locator(".task-detail-state").getByText("返回任务列表后刷新。", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
});

test("task center previews batch transfer and delay with scoped inputs", async ({ page }) => {
  await setup(page);
  await page.goto("/tasks");
  await page.getByRole("checkbox", { name: /核验便携净水杯供应商报价/ }).check();
  await page.getByRole("checkbox", { name: /补齐竞品价格证据/ }).check();
  await page.getByRole("button", { name: "批量调整负责人" }).click();
  const transfer = page.getByRole("dialog", { name: "确认批量任务操作" });
  await expect(transfer.getByText("确认批量调整负责人")).toBeVisible();
  await expect(transfer.getByLabel("新负责人")).toHaveValue("");
  await transfer.getByRole("button", { name: "返回" }).click();
  await page.getByRole("button", { name: "批量延期" }).click();
  const delay = page.getByRole("dialog", { name: "确认批量任务操作" });
  await expect(delay.getByText("确认批量延期")).toBeVisible();
  await expect(delay.getByLabel("新截止时间")).toBeVisible();
});

test("M05-01 quick create route opens the task form", async ({ page }) => {
  await setup(page);
  await page.goto("/tasks?create=1");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "新建任务" })).toBeVisible();
});

test("member workspace shows Chinese context theme switch and task progress without internal guard copy", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/work");
  await expect(page.getByText("米豆智能选品")).toHaveCount(1);
  await expect(page.getByText("跨境新品工作区")).toHaveCount(1);
  await expect(
    page.getByText(/navigation_member_allowed|权限由服务端裁决|前端菜单不是安全边界/),
  ).toHaveCount(0);
  const beforeTheme = await page.locator(".task-focus-strip").evaluate((element) => {
    const style = getComputedStyle(element);
    return `${style.backgroundColor}|${style.borderColor}`;
  });
  await page.getByRole("button", { name: "切换界面主题" }).click();
  await page.getByRole("button", { name: /极光紫/ }).click();
  await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("aurora-purple");
  await expect(page.getByText("主题已应用到全部模块。")).toBeVisible();
  const afterTheme = await page.locator(".task-focus-strip").evaluate((element) => {
    const style = getComputedStyle(element);
    return `${style.backgroundColor}|${style.borderColor}`;
  });
  expect(afterTheme).not.toBe(beforeTheme);
  await page.locator(".task-row-main").filter({ hasText: "核验便携净水杯供应商报价" }).click();
  await expect(page.getByText("执行中 · 35%", { exact: true })).toBeVisible();
  await expect(page.getByText("已完成亚马逊竞品初筛", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "更新进度" })).toBeVisible();
  await page.getByText("更多任务操作", { exact: true }).click();
  await expect(page.getByRole("button", { name: "编辑任务" })).toBeVisible();
  await expect(
    page.locator(".task-detail").getByRole("button", { name: "删除任务" }),
  ).toBeVisible();
});

test("task status and pagination restore from the URL", async ({ page }) => {
  await setup(page);
  await page.goto("/tasks?status=in_progress&page=2");
  await expect(page.getByRole("button", { name: "进行中" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect.poll(() => new URL(page.url()).searchParams.get("page")).toBe("2");
});

test("task list sends paused, search and sort to the API and reset clears URL state", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/tasks");
  const pausedRequest = page.waitForRequest(
    (request) =>
      request.url().includes("/api/v1/tasks?") &&
      new URL(request.url()).searchParams.get("status") === "paused",
  );
  await page.getByRole("button", { name: "已暂停" }).click();
  await pausedRequest;
  await page.getByText("搜索与排序", { exact: true }).click();
  await page.getByPlaceholder("搜索标题或说明").fill("供应商报价");
  const searchRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname.endsWith("/api/v1/tasks") &&
      url.searchParams.get("query") === "供应商报价" &&
      url.searchParams.get("sort") === "updated_desc"
    );
  });
  await page.getByLabel("排序").selectOption("updated_desc");
  await searchRequest;
  await expect.poll(() => new URL(page.url()).searchParams.get("query")).toBe("供应商报价");
  await page.getByRole("button", { name: "重置" }).first().click();
  await expect.poll(() => new URL(page.url()).search).toBe("");
});

test("read-only task role does not receive write, batch, delete or export controls", async ({
  page,
}) => {
  await setup(page, false, ["task:read"]);
  await page.goto("/tasks");
  await expect(page.getByText("当前角色可查看工作区任务")).toBeVisible();
  await expect(page.getByRole("button", { name: "＋ 新建任务" })).toHaveCount(0);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "导出任务" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "删除任务" })).toHaveCount(0);
  await page.goto("/tasks?create=1");
  await expect(page.getByRole("dialog", { name: "新建任务" })).toHaveCount(0);
});

test("task update role keeps lifecycle batch controls but not assignment or export", async ({
  page,
}) => {
  await setup(page, false, ["task:read", "task:create", "task:update"]);
  await page.goto("/tasks");
  await page.getByRole("checkbox", { name: "选择本页 2 项" }).check();
  await expect(page.getByRole("button", { name: "批量暂停" })).toBeVisible();
  await expect(page.getByRole("button", { name: "批量调整负责人" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "导出任务" })).toHaveCount(0);
});

test("task create disables duplicate submission while the real request is pending", async ({
  page,
}) => {
  const observed = await setup(page);
  await page.goto("/tasks");
  await page.getByRole("button", { name: "＋ 新建任务" }).click();
  await page.getByLabel("标题").fill("重复提交保护");
  await page.getByRole("button", { name: "创建任务" }).dblclick();
  await expect(page.getByText("任务已创建，可以立即开始并持续更新进度。")).toBeVisible();
  expect(observed.createRequests).toBe(1);
});

test("personal center renders the core profile instead of staying on its loading state", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/me");
  await expect(
    page.locator(".personal-center").getByRole("heading", { name: "测试成员", level: 2 }),
  ).toBeVisible();
  await expect(page.getByLabel("显示名称")).toHaveValue("测试成员");
  await expect(page.getByText("正在读取个人中心")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "保存资料" })).toBeVisible();
});

test("approval notification and real-selection surfaces follow every member theme", async ({
  page,
}) => {
  await setup(page);
  const cases = [
    {
      path: "/tasks/approvals",
      selector: ".approval-focus-strip",
      theme: "极光紫",
      expected: "aurora-purple",
    },
    {
      path: "/notifications",
      selector: ".notification-state",
      theme: "云雾白",
      expected: "cloud-white",
    },
    {
      path: "/opportunities/start",
      selector: ".selection-start",
      theme: "深海蓝",
      expected: "deep-ocean",
    },
  ];
  for (const item of cases) {
    await page.goto(item.path);
    const surface = page.locator(item.selector);
    await expect(surface).toBeVisible();
    const before = await surface.evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.backgroundColor}|${style.backgroundImage}`;
    });
    await page.getByRole("button", { name: "切换界面主题" }).click();
    await page.getByRole("button", { name: new RegExp(item.theme) }).click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe(item.expected);
    const after = await surface.evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.backgroundColor}|${style.backgroundImage}`;
    });
    expect(after).not.toBe(before);
  }
});
