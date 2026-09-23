import { expect, test, type Locator, type Page } from "@playwright/test";
import { capturePhase2Evidence, finalizePhase2Evidence } from "./helpers/ui-phase2-evidence";
test.afterEach(async ({}, testInfo) => finalizePhase2Evidence(testInfo));

const messageId = "00000000-0000-4000-8000-000000000801";
const envelope = (data: unknown) => ({
  data,
  request_id: "platform-message-e2e",
  trace_id: "platform-message-e2e",
});
const allowPlatformNotifications = (page: Page) =>
  page.route("**/api/v1/me/navigation?**", (route) =>
    route.fulfill({
      json: envelope({
        shell: "platform_admin",
        organization_id: null,
        workspace_id: null,
        roles: [],
        capabilities: [],
        platform_roles: ["platform_super_admin"],
        platform_capabilities: ["platform:operate"],
        guard_reason: "navigation_platform_admin_allowed",
      }),
    }),
  );
const notificationMessage = (overrides: Record<string, unknown> = {}) => ({
  id: messageId,
  kind: "notification",
  title: "供应商风险处置提醒",
  body: "供应商风险信号已进入人工核查阶段。\n请核对证据后完成处置。",
  status: "draft",
  version: 3,
  category: "system",
  severity: "warning",
  audience_type: "all_users",
  organization_id: null,
  organization_name: null,
  user_id: null,
  user_email: null,
  in_app_enabled: true,
  email_enabled: false,
  updated_at: "2026-09-12T02:30:00.000Z",
  ...overrides,
});
const notificationSnapshot = (overrides: Record<string, unknown> = {}) => ({
  domain: "notifications",
  summary: { total: 42, unread: 11, critical: 2 },
  messages: [
    notificationMessage(),
    notificationMessage({
      id: "00000000-0000-4000-8000-000000000802",
      title: "竞品价格变动日报",
      status: "published",
      category: "competitor",
      severity: "info",
      version: 2,
    }),
    notificationMessage({
      id: "00000000-0000-4000-8000-000000000803",
      title: "已结束的维护草稿",
      status: "cancelled",
      version: 2,
    }),
  ],
  items: [
    {
      id: "00000000-0000-4000-8000-000000000851",
      title: "采集任务完成",
      recipient_email: "member@example.test",
      organization_name: "米豆选品",
      category: "task",
      severity: "info",
      read_at: null,
      delivery_status: "in_app:delivered",
      created_at: "2026-09-12T02:20:00.000Z",
    },
  ],
  templates: [
    { category: "task", title: "任务状态通知", status: "system_fixed" },
    { category: "approval", title: "审批状态通知", status: "system_fixed" },
  ],
  channels: [
    {
      code: "in_app",
      name: "站内通知",
      status: "enabled",
      deliveries: [{ status: "delivered", total: 42 }],
    },
    { code: "email", name: "邮件", status: "disabled", deliveries: [] },
  ],
  subscriptions: { total: 18, in_app_enabled: 16, email_enabled: 0, disabled: 2 },
  alert_routes: [
    { id: "route-1", name: "竞品价格异常", action_type: "notify", status: "enabled" },
    { id: "route-2", name: "审批等待超时", action_type: "notify_owner", status: "enabled" },
  ],
  pagination: { page: 1, page_size: 20, total: 42, total_pages: 3 },
  message_pagination: { page: 1, page_size: 10, total: 13, total_pages: 2 },
  audience_options: {
    organizations: [{ id: "org-1", name: "米豆选品" }],
    users: [{ id: "user-1", email: "operator@example.test" }],
  },
  observed_at: "2026-09-12T02:31:00.000Z",
  ...overrides,
});

for (const status of ["draft", "published", "cancelled"]) {
  test(`UI2-PN57 ${status} message exposes its complete body without a write`, async ({
    page,
  }, testInfo) => {
    const body = Array.from(
      { length: 18 },
      (_, index) => `第 ${index + 1} 行：通知正文应当完整可读。`,
    ).join("\n");
    let reads = 0;
    const writes: string[] = [];
    await page.route("**/api/v1/me/navigation?**", (route) =>
      route.fulfill({
        json: envelope({
          shell: "platform_admin",
          organization_id: null,
          workspace_id: null,
          roles: [],
          capabilities: [],
          platform_roles: ["platform_super_admin"],
          platform_capabilities: ["platform:operate"],
          guard_reason: "navigation_platform_admin_allowed",
        }),
      }),
    );
    await page.route("**/api/v1/platform/management**", async (route) => {
      if (route.request().method() !== "GET") {
        writes.push(route.request().method());
        return route.fulfill({ status: 500, json: {} });
      }
      reads += 1;
      return route.fulfill({
        json: envelope({
          domain: "notifications",
          summary: { total: 0, unread: 0, critical: 0 },
          items: [],
          templates: [],
          channels: [],
          subscriptions: {},
          alert_routes: [],
          pagination: { page: 1, page_size: 20, total: 0, total_pages: 1 },
          message_pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
          messages: [
            {
              id: messageId,
              kind: "notification",
              title: "长正文审核通知",
              body,
              status,
              version: 2,
              category: "system",
              severity: "info",
              audience_type: "all_users",
              in_app_enabled: true,
              email_enabled: false,
              updated_at: "2026-09-08T00:00:00.000Z",
            },
          ],
          audience_options: { organizations: [], users: [] },
          observed_at: "2026-09-08T00:00:00.000Z",
        }),
      });
    });
    await page.goto("/platform-admin/notifications");
    const mobile = (page.viewportSize()?.width ?? 1000) <= 760;
    let content: Locator;
    if (mobile) {
      await page.getByRole("button", { name: /长正文审核通知.*查看正文与操作/ }).click();
      const reader = page.getByRole("dialog", { name: "长正文审核通知" });
      content = reader.locator(".message-reader__full-body");
      await expect(content).toHaveText(body);
      await expect(reader.getByRole("button", { name: "编辑草稿" })).toHaveCount(
        status === "draft" ? 1 : 0,
      );
      await capturePhase2Evidence(page, testInfo, "P57", `message-${status}`, [
        "手机消息目录进入完整只读正文窗口",
        "草稿、已发布和已取消三状态均保留完整纯文本",
        "只有草稿提供编辑、发布和取消操作",
      ]);
      await reader.getByRole("button", { name: "关闭完整消息" }).click();
    } else {
      const card = page
        .getByRole("article")
        .filter({ has: page.getByRole("heading", { name: "长正文审核通知" }) });
      const disclosure = card.locator("details"),
        trigger = disclosure.locator("summary");
      content = disclosure.locator("p");
      await expect(trigger).toHaveText("完整正文");
      await expect(content).not.toBeVisible();
      await trigger.focus();
      await trigger.press("Enter");
      await expect(disclosure).toHaveAttribute("open", "");
      await expect(content).toHaveText(body);
      await expect(card.getByRole("button", { name: "编辑草稿" })).toHaveCount(
        status === "draft" ? 1 : 0,
      );
      await capturePhase2Evidence(page, testInfo, "P57", `message-${status}`, [
        "桌面消息目录与阅读面并列且保持单一选中项",
        "完整正文展开不裁切纯文本和换行",
        "只有草稿提供编辑、发布和取消操作",
      ]);
      await trigger.press("Space");
      await expect(content).not.toBeVisible();
      await expect(trigger).toBeFocused();
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
      .toBeLessThanOrEqual(1);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(reads).toBe(1);
    expect(writes).toEqual([]);
  });
}

test("platform administrator can create and publish a Chinese notification", async ({
  page,
}, testInfo) => {
  let messages: any[] = [];
  let createBody: any = null;
  let actionBody: any = null;
  await page.route("**/api/v1/me/navigation?**", (route) =>
    route.fulfill({
      json: envelope({
        shell: "platform_admin",
        organization_id: null,
        workspace_id: null,
        roles: [],
        capabilities: [],
        platform_roles: ["platform_super_admin"],
        platform_capabilities: ["platform:operate"],
        guard_reason: "navigation_platform_admin_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({
      json: envelope({
        domain: "notifications",
        summary: { total: 0, unread: 0, critical: 0 },
        items: [],
        templates: [],
        channels: [],
        subscriptions: {},
        alert_routes: [],
        messages,
        pagination: { page: 1, page_size: 20, total: 0, total_pages: 1 },
        message_pagination: { page: 1, page_size: 10, total: messages.length, total_pages: 1 },
        audience_options: { organizations: [], users: [] },
        observed_at: "2026-08-19T04:00:00.000Z",
      }),
    }),
  );
  await page.route("**/api/v1/platform/management/messages", async (route) => {
    createBody = route.request().postDataJSON();
    messages = [
      {
        id: messageId,
        ...createBody,
        status: "draft",
        version: 1,
        updated_at: "2026-08-19T04:00:00.000Z",
      },
    ];
    await route.fulfill({
      status: 201,
      json: envelope({ id: messageId, status: "draft", version: 1 }),
    });
  });
  await page.route(`**/api/v1/platform/management/messages/${messageId}/actions`, async (route) => {
    actionBody = route.request().postDataJSON();
    messages = messages.map((item) => ({
      ...item,
      status: "published",
      version: 2,
    }));
    await route.fulfill({
      json: envelope({
        id: messageId,
        status: "published",
        version: 2,
        recipient_count: 3,
        in_app_count: 3,
        email_count: 0,
      }),
    });
  });

  await page.goto("/platform-admin/notifications");
  await page.getByRole("button", { name: "新建草稿" }).click();
  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "平台通知" }) });
  await expect(dialog.getByRole("checkbox", { name: "邮件（服务未接入）" })).toBeDisabled();
  await expect(dialog.getByLabel("标题")).toBeFocused();
  await dialog.getByLabel("标题").fill("系统维护提醒");
  await dialog.getByLabel("正文").fill("今晚十点进行系统维护，请提前保存工作。");
  await capturePhase2Evidence(page, testInfo, "P57", "editor-new-all", [
    "新建入口明确只保存草稿",
    "标题正文、级别受众和渠道按三阶段排列",
    "邮件渠道保持禁用且说明在手机仍可见",
  ]);
  await dialog.getByRole("button", { name: "保存草稿" }).click();
  await expect.poll(() => createBody?.title).toBe("系统维护提醒");
  const messageDirectoryItem = page
    .locator(".message-directory button")
    .filter({ hasText: "系统维护提醒" });
  await expect(messageDirectoryItem).toBeVisible();

  if ((page.viewportSize()?.width ?? 1000) <= 760) await messageDirectoryItem.click();
  await page.getByRole("button", { name: "发布草稿", exact: true }).click();
  const reasonDialog = page.getByRole("dialog", { name: "填写发布原因" });
  const reasonInput = reasonDialog.getByRole("textbox", { name: "操作原因" });
  await expect(reasonInput).toBeFocused();
  await reasonInput.fill("发布维护通知");
  await capturePhase2Evidence(page, testInfo, "P57", "publish-confirm", [
    "发布确认固定提交消息版本和人工原因",
    "原因限制为去除首尾空白后的 2 至 300 字",
    "实际接收人数只采用接口返回，不由前端估算",
  ]);
  await reasonDialog.getByRole("button", { name: "确认发布" }).click();
  await expect
    .poll(() => actionBody)
    .toMatchObject({
      action: "publish",
      expected_version: 1,
      reason: "发布维护通知",
    });
  await expect(page.getByText("发布完成：覆盖 3 人，站内 3 条，邮件队列 0 条。")).toBeVisible();
  await expect(messageDirectoryItem).toContainText("已发布");
  await capturePhase2Evidence(page, testInfo, "P57", "publish-success", [
    "发布成功反馈使用接口返回的覆盖人数和渠道数量",
    "发布后消息变为只读，不再提供草稿操作",
    "人工消息分页仍与投递分页独立",
  ]);
});

test("UI2-PN57 C workspace separates messages, deliveries and system facts", async ({
  page,
}, testInfo) => {
  await allowPlatformNotifications(page);
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({ json: envelope(notificationSnapshot()) }),
  );
  await page.goto("/platform-admin/notifications");
  await expect(page.getByRole("heading", { name: "通知管理", level: 1 })).toBeVisible();
  await expect(page.locator(".message-directory button")).toHaveCount(3);
  await expect(page.getByText("投递统计范围：全部投递 · 全部类型", { exact: false })).toBeVisible();
  await capturePhase2Evidence(page, testInfo, "P57", "notifications-default", [
    "蓝色三分区目录和白色消息选择阅读面取代旧卡片墙",
    "人工消息目录明确不受投递筛选影响",
    "消息 10 条分页和投递 20 条分页分别命名",
  ]);

  await page.getByRole("button", { name: /投递观测/ }).click();
  await expect(page.getByRole("heading", { name: "通知与投递记录" })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 760)
    await expect(
      page.getByRole("button", { name: /采集任务完成.*member@example.test/ }),
    ).toBeVisible();
  else await expect(page.getByRole("cell", { name: "member@example.test" })).toBeVisible();
  await expect(page.getByText("每页最多 20 条")).toBeVisible();
  await capturePhase2Evidence(page, testInfo, "P57", "deliveries", [
    "投递观测独立展示六项接收与送达事实",
    "投递筛选只影响投递台账与三项投递统计",
    "桌面表格和手机详情保留相同投递事实",
  ]);

  await page.getByRole("button", { name: /系统事实/ }).click();
  await expect(page.getByRole("heading", { name: "系统配置事实" })).toBeVisible();
  await expect(page.getByText("邮件服务未接入，管理入口保持关闭。")).toBeVisible();
  await expect(page.getByText("任务状态通知")).toBeVisible();
  await capturePhase2Evidence(page, testInfo, "P57", "configuration", [
    "模板、渠道、订阅和前六条告警作为只读系统事实",
    "邮件渠道保持关闭且没有启用按钮",
    "个人偏好和规则总览仅提供关联入口",
  ]);
});

test("UI2-PN57 editor exposes all audience combinations without writing", async ({
  page,
}, testInfo) => {
  await allowPlatformNotifications(page);
  const writes: string[] = [];
  await page.route("**/api/v1/platform/management**", (route) => {
    if (route.request().method() !== "GET") writes.push(route.request().method());
    return route.fulfill({ json: envelope(notificationSnapshot()) });
  });
  await page.goto("/platform-admin/notifications");
  await page.getByRole("button", { name: "新建草稿" }).click();
  let dialog = page.getByRole("dialog", { name: "新建平台消息草稿" });
  await dialog.getByRole("combobox", { name: "接收范围" }).selectOption("organization");
  await dialog.getByRole("combobox", { name: "选择组织" }).selectOption("org-1");
  await capturePhase2Evidence(page, testInfo, "P57", "editor-new-organization", [
    "新建草稿指定组织时显示当前快照中的组织候选",
    "候选列表上限说明不冒充实时受众预检",
    "保存仍只创建草稿",
  ]);
  await dialog.getByRole("combobox", { name: "接收范围" }).selectOption("user");
  await dialog.getByRole("combobox", { name: "选择用户" }).selectOption("user-1");
  await capturePhase2Evidence(page, testInfo, "P57", "editor-new-user", [
    "新建草稿指定用户时显示活动用户候选",
    "站内渠道可用而邮件渠道保持禁用",
    "标题与正文字符边界在字段附近可见",
  ]);
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();

  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.locator(".message-directory button").first().click();
    await page
      .getByRole("dialog", { name: "供应商风险处置提醒" })
      .getByRole("button", { name: "编辑草稿" })
      .click();
  } else await page.getByRole("button", { name: "编辑草稿" }).click();
  dialog = page.getByRole("dialog", { name: "编辑平台消息草稿" });
  await expect(dialog.getByRole("textbox", { name: "修改原因" })).toHaveValue("编辑平台消息");
  await capturePhase2Evidence(page, testInfo, "P57", "editor-edit-all", [
    "编辑草稿固定原消息版本并要求修改原因",
    "全部活动用户受众仍受活动成员与默认工作区条件约束",
    "保存提交完整草稿值而不是局部推断",
  ]);
  await dialog.getByRole("combobox", { name: "接收范围" }).selectOption("organization");
  await dialog.getByRole("combobox", { name: "选择组织" }).selectOption("org-1");
  await capturePhase2Evidence(page, testInfo, "P57", "editor-edit-organization", [
    "编辑指定组织保留版本、原因和完整字段",
    "组织候选来自当前读取快照",
    "表单忙碌时所有业务字段可统一冻结",
  ]);
  await dialog.getByRole("combobox", { name: "接收范围" }).selectOption("user");
  await dialog.getByRole("combobox", { name: "选择用户" }).selectOption("user-1");
  await capturePhase2Evidence(page, testInfo, "P57", "editor-edit-user", [
    "编辑指定用户保留版本、原因和完整字段",
    "用户候选不是发布人数估算",
    "邮件服务未接入说明在双端表单中可见",
  ]);
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  expect(writes).toEqual([]);
});

test("UI2-PN57 keeps configuration readable when both record lists are empty", async ({
  page,
}, testInfo) => {
  await allowPlatformNotifications(page);
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({
      json: envelope(
        notificationSnapshot({
          summary: { total: 0, unread: 0, critical: 0 },
          messages: [],
          items: [],
          pagination: { page: 1, page_size: 20, total: 0, total_pages: 1 },
          message_pagination: { page: 1, page_size: 10, total: 0, total_pages: 1 },
        }),
      ),
    }),
  );
  await page.goto("/platform-admin/notifications");
  await expect(page.getByRole("heading", { name: "还没有人工消息" })).toBeVisible();
  await page.getByRole("button", { name: /系统事实/ }).click();
  await expect(page.getByText("任务状态通知")).toBeVisible();
  await capturePhase2Evidence(page, testInfo, "P57", "all-empty", [
    "人工消息和投递同时为空时不隐藏系统配置事实",
    "空记录与没有配置保持不同含义",
    "零值统计如实显示且不补造业务记录",
  ]);
});

test("UI2-PN57 presents a gentle first-load permission state", async ({ page }, testInfo) => {
  await allowPlatformNotifications(page);
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: { code: "forbidden", message: "无权读取", action_hint: "权限调整后重新加载。" },
        request_id: "notification-forbidden-57",
        trace_id: "notification-forbidden-57",
      },
    }),
  );
  await page.goto("/platform-admin/notifications");
  await expect(page.getByRole("heading", { name: "当前无法读取通知工作台" })).toBeVisible();
  await expect(page.getByText(/当前权限还不能读取通知运营内容/)).toBeVisible();
  await capturePhase2Evidence(page, testInfo, "P57", "forbidden", [
    "权限拒绝使用温和说明并保留明确恢复动作",
    "首次失败不展示伪造消息、投递或配置事实",
    "错误区与正常工作区层级清晰分离",
  ]);
});

test("UI2-PN57 retains a successful snapshot when refresh fails", async ({ page }, testInfo) => {
  await allowPlatformNotifications(page);
  let reads = 0;
  await page.route("**/api/v1/platform/management?**", (route) => {
    reads += 1;
    if (reads === 1) return route.fulfill({ json: envelope(notificationSnapshot()) });
    return route.fulfill({
      status: 503,
      json: {
        error: { code: "service_unavailable", message: "读取失败", action_hint: "请稍后重试。" },
        request_id: "notification-refresh-failed-57",
        trace_id: "notification-refresh-failed-57",
      },
    });
  });
  await page.goto("/platform-admin/notifications");
  await page.getByRole("button", { name: "刷新快照" }).click();
  await expect(page.getByRole("status")).toContainText("当前仍显示上次成功快照");
  await expect(page.locator(".message-directory button")).toHaveCount(3);
  await capturePhase2Evidence(page, testInfo, "P57", "retained-error", [
    "刷新失败时保留最后一次完整成功快照",
    "错误反馈不把旧数据伪装成最新读取",
    "读取失败与后续写入结果分别表达",
  ]);
  expect(reads).toBe(4);
});

test("UI2-PN57 keeps cancel conflicts inside the owning confirmation", async ({
  page,
}, testInfo) => {
  await allowPlatformNotifications(page);
  let posts = 0;
  await page.route("**/api/v1/platform/management/messages/**/actions", (route) => {
    posts += 1;
    return route.fulfill({
      status: 409,
      json: {
        error: {
          code: "version_conflict",
          message: "消息版本已变化",
          action_hint: "请重新读取消息后再提交。",
        },
        request_id: "notification-conflict-57",
        trace_id: "notification-conflict-57",
      },
    });
  });
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({ json: envelope(notificationSnapshot()) }),
  );
  await page.goto("/platform-admin/notifications");
  if ((page.viewportSize()?.width ?? 1000) <= 760)
    await page.locator(".message-directory button").first().click();
  await page.getByRole("button", { name: "取消草稿", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "填写取消草稿原因" });
  const reason = dialog.getByRole("textbox", { name: "操作原因" });
  await expect(reason).toBeFocused();
  await reason.fill("停止本次草稿发布");
  await capturePhase2Evidence(page, testInfo, "P57", "cancel-confirm", [
    "取消草稿与发布使用不同确认语义",
    "取消不会撤回已经发布的消息",
    "关闭确认窗时不产生业务请求",
  ]);
  await dialog.getByRole("button", { name: "确认取消草稿" }).click();
  await expect(dialog.getByRole("alert")).toContainText("请重新读取消息后再提交");
  await expect(dialog.getByRole("alert")).toHaveCSS("color", "rgb(173, 57, 53)");
  await capturePhase2Evidence(page, testInfo, "P57", "cancel-conflict", [
    "版本冲突保留在发起请求的确认窗内",
    "原因内容保留便于核对而不自动重试",
    "单次确认只发送一次动作请求",
  ]);
  expect(posts).toBe(1);
});

test("UI2-PN57 keeps message and delivery pagination independent", async ({ page }, testInfo) => {
  await allowPlatformNotifications(page);
  const reads: string[] = [];
  await page.route("**/api/v1/platform/management?**", (route) => {
    const url = new URL(route.request().url());
    reads.push(url.search);
    const pageNumber = Number(url.searchParams.get("page") ?? 1),
      messagePageNumber = Number(url.searchParams.get("message_page") ?? 1);
    return route.fulfill({
      json: envelope(
        notificationSnapshot({
          pagination: { page: pageNumber, page_size: 20, total: 42, total_pages: 3 },
          message_pagination: { page: messagePageNumber, page_size: 10, total: 13, total_pages: 2 },
        }),
      ),
    });
  });
  await page.goto("/platform-admin/notifications");
  await page
    .getByRole("navigation", { name: "人工消息分页" })
    .getByRole("button", { name: "下一页" })
    .click();
  await expect(page).toHaveURL(/message_page=2/);
  await expect(page).not.toHaveURL(/(?:\?|&)page=2/);
  await page.getByRole("button", { name: /投递观测/ }).click();
  await page
    .getByRole("navigation", { name: "通知与投递记录分页" })
    .getByRole("button", { name: "下一页" })
    .click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/message_page=2/);
  await capturePhase2Evidence(page, testInfo, "P57", "independent-pagination", [
    "人工消息每页 10 条与投递记录每页 20 条分别翻页",
    "消息翻页不会重置或伪造投递页",
    "成功读取后 URL 同时记录两个独立页码",
  ]);
  expect(reads).toHaveLength(3);
});

test("UI2-PN57 an older save result cannot close a newer editor", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "One desktop case proves editor ownership.",
  );
  await allowPlatformNotifications(page);
  let release!: () => void;
  let entered!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const started = new Promise<void>((resolve) => (entered = resolve));
  let posts = 0;
  await page.route("**/api/v1/platform/management/messages", async (route) => {
    posts += 1;
    entered();
    await held;
    await route.fulfill({
      status: 201,
      json: envelope({ id: messageId, status: "draft", version: 1 }),
    });
  });
  await page.route("**/api/v1/platform/management?**", (route) =>
    route.fulfill({ json: envelope(notificationSnapshot()) }),
  );
  await page.goto("/platform-admin/notifications");
  await page.getByRole("button", { name: "新建草稿" }).click();
  let dialog = page.getByRole("dialog", { name: "新建平台消息草稿" });
  await dialog.getByLabel("标题").fill("第一条待保存草稿");
  await dialog.getByLabel("正文").fill("第一条草稿正文");
  await dialog.getByRole("button", { name: "保存草稿" }).click();
  await started;
  await dialog.getByRole("button", { name: "关闭草稿编辑" }).click();
  await page.getByRole("button", { name: "新建草稿" }).click();
  dialog = page.getByRole("dialog", { name: "新建平台消息草稿" });
  await dialog.getByLabel("标题").fill("第二条仍在编辑的草稿");
  release();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("标题")).toHaveValue("第二条仍在编辑的草稿");
  await expect(page.getByRole("status")).toContainText("草稿已创建");
  expect(posts).toBe(1);
});

test("mail management entry stays closed while provider is pending", async ({ page }) => {
  await page.route("**/api/v1/me/navigation?**", (route) =>
    route.fulfill({
      json: envelope({
        shell: "platform_admin",
        organization_id: null,
        workspace_id: null,
        roles: [],
        capabilities: [],
        platform_roles: ["platform_super_admin"],
        platform_capabilities: ["platform:operate"],
        guard_reason: "navigation_platform_admin_allowed",
      }),
    }),
  );
  await page.goto("/platform-admin/email");
  await expect(page.getByRole("heading", { name: "没有找到这个页面" })).toBeVisible();
  await expect(page.getByRole("link", { name: "邮箱管理" })).toHaveCount(0);
});
