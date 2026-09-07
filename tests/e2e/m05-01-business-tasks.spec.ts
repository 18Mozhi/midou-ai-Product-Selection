import { test, expect, type Page } from "@playwright/test";
import { setupBusinessTasks as setup, taskId, actor, env, task } from "./helpers/business-tasks";

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
  await expect(page.getByText("米豆智能选品").filter({ visible: true })).toHaveCount(1);
  await expect(page.getByText("跨境新品工作区").filter({ visible: true })).toHaveCount(1);
  await expect(
    page.getByText(/navigation_member_allowed|权限由服务端裁决|前端菜单不是安全边界/),
  ).toHaveCount(0);
  const beforeTheme = await page.locator(".task-focus-strip").evaluate((element) => {
    const style = getComputedStyle(element);
    return `${style.backgroundColor}|${style.borderColor}`;
  });
  await page.getByRole("button", { name: "切换界面主题" }).click();
  await page.getByRole("button", { name: /档案纸/ }).click();
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
      theme: "档案纸",
      expected: "aurora-purple",
    },
    {
      path: "/notifications",
      selector: ".notification-state",
      theme: "净页白",
      expected: "cloud-white",
    },
    {
      path: "/opportunities/start",
      selector: ".selection-start",
      theme: "信号纸",
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
