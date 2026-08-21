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
async function setup(page: Page) {
  let themePreference = {
    theme: "deep-ocean",
    source: "saved",
    organization_id: "00000000-0000-4000-8000-000000000804",
    workspace_id: "00000000-0000-4000-8000-000000000805",
    version: 1,
    updated_at: "2026-08-19T00:00:00.000Z",
  };
  await page.route("**/api/v1/me/navigation?shell=member", (r) =>
    r.fulfill({
      json: env({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000804",
        workspace_id: "00000000-0000-4000-8000-000000000805",
        organization_name: "米豆智能选品",
        workspace_name: "跨境新品工作区",
        roles: ["selection_manager"],
        capabilities: [
          "task:read",
          "task:create",
          "task:update",
          "task:assign",
          "notification:read",
          "opportunity:decide",
        ],
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
  await page.route("**/api/v1/tasks/summary", (r) =>
    r.fulfill({
      json: env({
        todo: 2,
        in_progress: 1,
        completed: 4,
        cancelled: 0,
        overdue: 1,
      }),
    }),
  );
  await page.route(`**/api/v1/tasks/${taskId}`, (r) =>
    r.fulfill({
      json: env({
        ...task,
        comments: [
          {
            id: "00000000-0000-4000-8000-000000000806",
            body: "报价证据已核验，等待确认交期。",
            created_by: actor,
            created_at: "2026-08-08T10:05:00.000Z",
          },
        ],
        events: [],
      }),
    }),
  );
  await page.route("**/api/v1/tasks?*", (r) =>
    r.fulfill({
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
        meta: { page: 1, page_size: 50, total: 2 },
      },
    }),
  );
}
test("M05-01.A07/A08/A09/A15 renders truthful task SLA detail and comments on desktop and 390", async ({
  page,
}) => {
  await setup(page);
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
  await expect(page.getByRole("button", { name: "转交" })).toBeVisible();
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
  const beforeTheme = await page
    .locator(".task-title")
    .evaluate((element) => getComputedStyle(element).backgroundImage);
  await page.getByRole("button", { name: "切换界面主题" }).click();
  await page.getByRole("button", { name: /极光紫/ }).click();
  await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("aurora-purple");
  await expect(page.getByText("主题已应用到全部模块。")).toBeVisible();
  const afterTheme = await page
    .locator(".task-title")
    .evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(afterTheme).not.toBe(beforeTheme);
  await page.locator(".task-row-main").filter({ hasText: "核验便携净水杯供应商报价" }).click();
  await expect(page.getByText("执行中 · 已完成亚马逊竞品初筛")).toBeVisible();
  await expect(page.getByRole("button", { name: "更新进度" })).toBeVisible();
  await expect(page.getByRole("button", { name: "编辑" })).toBeVisible();
  await page.getByText("更多任务操作", { exact: true }).click();
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
      selector: ".approval-state",
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
