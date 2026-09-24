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
  await expect(page.getByRole("heading", { name: "任务活动与评论" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "查看事实，再决定下一项操作" })).toBeVisible();
  await expect(page.locator(".task-dossier")).toBeVisible();
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
    page.locator(".task-dossier-facts").getByText("测试成员", { exact: true }),
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

test("P24 action dialogs keep target, fields and footer readable on desktop and mobile", async ({
  page,
}) => {
  const observed = await setup(page);
  await page.goto(`/tasks/${taskId}`);

  const more = page.locator(".task-detail-more");
  const variants = [
    {
      trigger: "更新进度",
      title: "更新任务进度",
      fields: ["完成进度（0–100）", "本次进展说明"],
    },
    { trigger: "暂停", title: "暂停任务", fields: ["操作原因"] },
    { trigger: "调整期限", title: "调整任务期限", fields: ["新截止时间", "操作原因"] },
    { trigger: "转交负责人", title: "转交任务", fields: ["接收成员", "操作原因"] },
    { trigger: "取消任务", title: "取消任务", fields: ["操作原因"], danger: true },
  ];

  for (const variant of variants) {
    let trigger;
    if (variant.trigger === "更新进度") {
      trigger = page.getByRole("button", { name: variant.trigger, exact: true });
    } else {
      if (!(await more.evaluate((element) => (element as HTMLDetailsElement).open)))
        await more.locator("summary").click();
      trigger = more.getByRole("button", { name: variant.trigger, exact: true });
    }
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: variant.title });
    await expect(dialog.getByText(task.title, { exact: true })).toBeVisible();
    await expect(dialog.getByText("第 2 版", { exact: false })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "关闭任务操作窗口" })).toBeVisible();
    for (const field of variant.fields) await expect(dialog.getByLabel(field)).toBeVisible();
    if (variant.danger)
      await expect(dialog.getByRole("button", { name: "确认提交" })).toHaveAttribute(
        "data-danger",
        "true",
      );

    const layout = await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const footer = element.querySelector(".task-action-footer")!.getBoundingClientRect();
      const controls = [...element.querySelectorAll("input, select, textarea, button")]
        .filter((control) => (control as HTMLElement).getClientRects().length > 0)
        .map((control) => Math.round(control.getBoundingClientRect().height));
      return {
        dialogBottom: bounds.bottom,
        footerBottom: footer.bottom,
        viewportHeight: window.innerHeight,
        controls,
      };
    });
    expect(layout.dialogBottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.footerBottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.controls.every((height) => height >= 44)).toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  }

  expect(observed.actionRequests).toBe(0);
});

test("task center previews batch transfer and delay with scoped inputs", async ({ page }) => {
  await setup(page);
  await page.goto("/tasks");
  await page.getByRole("checkbox", { name: /核验便携净水杯供应商报价/ }).check();
  await page.getByRole("checkbox", { name: /补齐竞品价格证据/ }).check();
  await page.getByRole("button", { name: "批量调整负责人" }).click();
  const transfer = page.getByRole("dialog", { name: "确认批量调整负责人" });
  await expect(transfer.getByText("确认批量调整负责人")).toBeVisible();
  await expect(transfer.getByLabel("新负责人")).toHaveValue("");
  await transfer.getByRole("button", { name: "返回" }).click();
  await page.getByRole("button", { name: "批量延期" }).click();
  const delay = page.getByRole("dialog", { name: "确认批量延期" });
  await expect(delay.getByText("确认批量延期")).toBeVisible();
  await expect(delay.getByLabel("新截止时间")).toBeVisible();
});

test("P23 delete dialog keeps the task target, reason and actions usable on both layouts", async ({
  page,
}) => {
  await setup(page);
  let deleteRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "DELETE" &&
      new URL(request.url()).pathname.endsWith(`/tasks/${taskId}`)
    )
      deleteRequests += 1;
  });

  await page.goto("/tasks");
  const row = page.locator(".task-list article").filter({ hasText: "核验便携净水杯供应商报价" });
  const menu = row.locator("summary[aria-label='任务操作：核验便携净水杯供应商报价']");
  await menu.click();
  const deleteTrigger = row.getByRole("button", { name: "删除任务", exact: true });
  await deleteTrigger.click();

  const dialog = page.getByRole("dialog", { name: "删除任务" });
  await expect(dialog.getByText("核验便携净水杯供应商报价", { exact: true })).toBeVisible();
  await expect(dialog.getByText("必填 · 最多500字")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "关闭删除任务窗口" })).toBeVisible();
  const layout = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const footerBounds = element.querySelector(".task-delete-footer")!.getBoundingClientRect();
    const controls = [...element.querySelectorAll("textarea, button")]
      .filter((control) => (control as HTMLElement).getClientRects().length > 0)
      .map((control) => Math.round(control.getBoundingClientRect().height));
    return {
      dialogBottom: bounds.bottom,
      footerBottom: footerBounds.bottom,
      viewportHeight: window.innerHeight,
      controls,
    };
  });
  expect(layout.dialogBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.footerBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.controls.every((height) => height >= 44)).toBe(true);

  await dialog.getByRole("button", { name: "关闭删除任务窗口" }).click();
  await expect(dialog).toBeHidden();
  await expect(deleteTrigger).toBeFocused();
  expect(deleteRequests).toBe(0);
});

test("P23 batch dialog variants preserve scope, eligibility and a reachable footer", async ({
  page,
}) => {
  await setup(page);
  let actionRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname.match(new RegExp(`/tasks/${taskId}/actions$`))
    ) {
      actionRequests += 1;
    }
  });

  await page.goto("/tasks");
  await page.getByRole("checkbox", { name: "选择任务：核验便携净水杯供应商报价" }).check();
  await page.getByRole("checkbox", { name: "选择任务：补齐竞品价格证据" }).check();

  const variants = [
    { button: "批量暂停", title: "确认批量暂停", fields: ["操作原因"], eligible: "1 项" },
    { button: "批量继续", title: "确认批量继续", fields: [], eligible: "0 项" },
    {
      button: "批量延期",
      title: "确认批量延期",
      fields: ["操作原因", "新截止时间"],
      eligible: "2 项",
    },
    {
      button: "批量调整负责人",
      title: "确认批量调整负责人",
      fields: ["操作原因", "新负责人"],
      eligible: "2 项",
    },
    { button: "批量取消", title: "确认批量取消", fields: ["操作原因"], eligible: "2 项" },
  ];

  for (const variant of variants) {
    await page.getByRole("button", { name: variant.button, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: variant.title });
    await expect(dialog.getByRole("heading", { name: variant.title })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "关闭批量任务操作" })).toBeVisible();
    await expect(dialog.locator(".task-batch-summary > div")).toHaveCount(4);
    await expect(dialog.locator(".task-batch-summary")).toContainText(variant.eligible);
    for (const field of variant.fields) await expect(dialog.getByLabel(field)).toBeVisible();
    if (variant.button === "批量继续") {
      await expect(
        dialog.getByText("当前所选任务均不符合此操作条件，本次不会执行。"),
      ).toBeVisible();
      await expect(dialog.getByRole("button", { name: "确认执行" })).toBeDisabled();
    }
    if (variant.button === "批量取消") {
      await expect(dialog.getByRole("button", { name: "确认执行" })).toHaveClass(/danger/);
    }

    const layout = await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const footerBounds = element.querySelector(".task-batch-footer")!.getBoundingClientRect();
      const controls = [...element.querySelectorAll("textarea, input, select, button")]
        .filter((control) => (control as HTMLElement).getClientRects().length > 0)
        .map((control) => Math.round(control.getBoundingClientRect().height));
      return {
        dialogBottom: bounds.bottom,
        footerBottom: footerBounds.bottom,
        viewportHeight: window.innerHeight,
        controls,
      };
    });
    expect(layout.dialogBottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.footerBottom).toBeLessThanOrEqual(layout.viewportHeight);
    expect(layout.controls.every((height) => height >= 44)).toBe(true);

    await dialog.getByRole("button", { name: "返回" }).click();
    await expect(dialog).toBeHidden();
  }
  expect(actionRequests).toBe(0);
});

test("P23 export view separates async status records and links to the report center", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/report-exports", (route) =>
    route.fulfill({
      json: env([
        {
          id: "00000000-0000-4000-8000-000000000851",
          report_type: "opportunity",
          status: "succeeded",
          attempt_count: 1,
          row_count: 6,
          last_error_code: null,
          queue_position: null,
          estimated_completion_at: null,
          estimate_sample_size: 0,
          created_at: "2026-08-08T09:00:00.000Z",
          updated_at: "2026-08-08T10:00:00.000Z",
          expires_at: "2026-08-15T10:00:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000852",
          report_type: "trend",
          status: "retry_scheduled",
          attempt_count: 2,
          row_count: null,
          last_error_code: "temporary_failure",
          queue_position: 3,
          estimated_completion_at: "2026-08-08T10:30:00.000Z",
          estimate_sample_size: 4,
          created_at: "2026-08-08T09:10:00.000Z",
          updated_at: "2026-08-08T09:40:00.000Z",
          expires_at: "2026-08-15T09:10:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000853",
          report_type: "team",
          status: "expired",
          attempt_count: 1,
          row_count: null,
          last_error_code: null,
          queue_position: null,
          estimated_completion_at: null,
          estimate_sample_size: 0,
          created_at: "2026-08-01T09:00:00.000Z",
          updated_at: "2026-08-08T09:50:00.000Z",
          expires_at: "2026-08-08T09:00:00.000Z",
        },
      ]),
    }),
  );

  await page.goto("/tasks?view=exports");

  await expect(page.getByRole("button", { name: "导出任务" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const panel = page.getByRole("region", { name: "导出任务" });
  await expect(panel.getByText("机会分析 · CSV")).toBeVisible();
  await expect(panel.getByText("等待重试", { exact: true })).toBeVisible();
  await expect(panel.getByText(/队列第 3 位/)).toBeVisible();
  await expect(panel.getByText("已过期", { exact: true })).toBeVisible();
  await expect(panel.getByRole("link", { name: "打开报表中心" })).toHaveAttribute(
    "href",
    "/reports",
  );
  await expect(panel.getByRole("link", { name: "查看任务" }).first()).toHaveAttribute(
    "href",
    "/reports?report=opportunity",
  );
  await expect(page.getByRole("navigation", { name: "任务分页" })).toHaveCount(0);

  const geometry = await panel.evaluate((element) => {
    const rows = [...element.querySelectorAll(".task-export-item")].map((row) => {
      const bounds = row.getBoundingClientRect();
      const link = row.querySelector("a")!.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        actionHeight: link.height,
        columns: getComputedStyle(row).gridTemplateColumns,
      };
    });
    return {
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      rows,
    };
  });
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.rows.every((row) => row.left >= 0 && row.right <= geometry.viewport)).toBe(true);
  expect(geometry.rows.every((row) => row.actionHeight >= 44)).toBe(true);
  if (geometry.viewport <= 760)
    expect(geometry.rows.every((row) => row.columns.split(" ").length === 1)).toBe(true);
});

test("P23 export view empty state clearly returns to reports", async ({ page }) => {
  await setup(page);
  await page.route("**/api/v1/report-exports", (route) => route.fulfill({ json: env([]) }));
  await page.goto("/tasks?view=exports");

  const panel = page.getByRole("region", { name: "导出任务" });
  await expect(panel.getByRole("heading", { name: "尚无导出任务" })).toBeVisible();
  await expect(
    panel.getByText("从报表页提交 CSV 导出后，会在这里统一显示处理状态。"),
  ).toBeVisible();
  await expect(panel.getByRole("link", { name: "前往报表中心" })).toHaveAttribute(
    "href",
    "/reports",
  );
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
    page.locator(".task-dossier").getByRole("button", { name: "删除任务" }),
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

test("P23 create and edit dialog keeps the primary action reachable and returns focus", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/tasks");
  const openButton = page.getByRole("button", { name: "＋ 新建任务" });
  await openButton.click();

  const dialog = page.getByRole("dialog", { name: "新建任务", exact: true });
  await expect(dialog.getByRole("heading", { name: "新建任务", level: 3 })).toBeVisible();
  await expect(dialog.getByText("必填", { exact: true })).toBeVisible();
  await expect(dialog.getByText("选填", { exact: true })).toHaveCount(3);
  await expect(dialog.getByRole("button", { name: "关闭任务编辑窗口" })).toBeVisible();

  const footer = dialog.locator(".task-editor-footer");
  await expect(footer.getByRole("button", { name: "创建任务", exact: true })).toBeVisible();
  const layout = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const footerBounds = element.querySelector(".task-editor-footer")!.getBoundingClientRect();
    const controls = [...element.querySelectorAll("input, textarea, select, button")]
      .filter((control) => (control as HTMLElement).getClientRects().length > 0)
      .map((control) => Math.round(control.getBoundingClientRect().height));
    return {
      dialogBottom: bounds.bottom,
      footerBottom: footerBounds.bottom,
      viewportHeight: window.innerHeight,
      controls,
    };
  });
  expect(layout.dialogBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.footerBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.controls.every((height) => height >= 44)).toBe(true);

  await dialog.getByRole("button", { name: "关闭任务编辑窗口" }).click();
  await expect(dialog).toBeHidden();
  await expect(openButton).toBeFocused();

  await page.locator(".task-row-main").filter({ hasText: "核验便携净水杯供应商报价" }).click();
  await page.getByText("更多任务操作", { exact: true }).click();
  const editTrigger = page.getByRole("button", { name: "编辑任务", exact: true });
  await editTrigger.click();
  const editDialog = page.getByRole("dialog", { name: "编辑任务", exact: true });
  await expect(editDialog.getByLabel("标题")).toHaveValue("核验便携净水杯供应商报价");
  await expect(editDialog.getByRole("button", { name: "保存修改", exact: true })).toBeVisible();
  await editDialog.getByRole("button", { name: "关闭任务编辑窗口" }).click();
  await expect(editDialog).toBeHidden();
  await expect(editTrigger).toBeFocused();
});

test("P23 create API failure remains inside the editor and retry preserves the form contract", async ({
  page,
}) => {
  await setup(page);
  let attempts = 0;
  let submittedBody: Record<string, unknown> | null = null;
  await page.route("**/api/v1/tasks", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    attempts += 1;
    submittedBody = route.request().postDataJSON() as Record<string, unknown>;
    if (attempts === 1) {
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: "service_unavailable",
            message: "任务暂时无法创建。",
            action_hint: "任务服务暂不可用，请稍后重试。",
          },
          request_id: "m05-01-create-retry",
          trace_id: "m05-01-create-retry",
        },
      });
    }
    return route.fulfill({ status: 201, json: { data: { id: "created-task" }, request_id: "ok" } });
  });

  await page.goto("/tasks");
  await page.getByRole("button", { name: "＋ 新建任务" }).click();
  const dialog = page.getByRole("dialog", { name: "新建任务", exact: true });
  await dialog.getByLabel("标题").fill("核验上新资料");
  await dialog.getByRole("button", { name: "创建任务", exact: true }).click();
  const error = dialog.getByRole("alert");
  await expect(error).toContainText("任务服务暂不可用，请稍后重试。");
  await expect(error).toContainText("m05-01-create-retry");
  await expect(dialog.getByLabel("标题")).toHaveValue("核验上新资料");
  await expect(dialog.getByRole("button", { name: "创建任务", exact: true })).toBeEnabled();

  await dialog.getByRole("button", { name: "创建任务", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(attempts).toBe(2);
  expect(submittedBody).toEqual({
    title: "核验上新资料",
    description: "",
    priority: "normal",
    due_at: null,
  });
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
    expect(after, `${item.path} should update its surface when the member theme changes`).not.toBe(
      before,
    );
  }
});
