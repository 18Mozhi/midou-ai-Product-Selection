import { test, expect, type Page } from "@playwright/test";

for (const outcome of ["success", "failure"] as const) {
  test(`P26 old ${outcome} read cannot replace the latest filter result`, async ({ page }) => {
    await setup(page);
    let releaseOld!: () => void;
    const delayed = new Promise<void>((resolve) => {
      releaseOld = resolve;
    });
    await page.route("**/api/v1/notifications?*", async (route) => {
      const query = new URL(route.request().url()).searchParams;
      if (query.get("category") === "task") {
        await route.fulfill({
          json: {
            ...env([{ ...item, category: "task", title: "最新筛选消息" }]),
            meta: { total: 1 },
          },
        });
        return;
      }
      await delayed;
      await route.fulfill(
        outcome === "failure"
          ? {
              status: 500,
              json: {
                request_id: "p26-old-failure",
                error: { code: "review_old_read", action_hint: "过期读取失败" },
              },
            }
          : {
              json: {
                ...env([{ ...item, title: "过期列表" }]),
                request_id: "p26-old-success",
                meta: { total: 99 },
              },
            },
      );
    });
    try {
      await page.goto("/notifications");
      const center = page.locator(".notification-center");
      await center.getByRole("button", { name: "任务", exact: true }).click();
      await expect(center.getByRole("button", { name: /最新筛选消息/ })).toBeVisible();
      const oldResponse = page.waitForResponse(
        (response) =>
          response.url().includes("/api/v1/notifications?") &&
          !new URL(response.url()).searchParams.has("category"),
      );
      releaseOld();
      await (await oldResponse).finished();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await expect(center.getByRole("button", { name: /最新筛选消息/ })).toBeVisible();
      await expect(center.locator(".notification-pagination")).toHaveCount(0);
      await expect(center.getByText("过期读取失败", { exact: true })).toHaveCount(0);
      await expect(page).toHaveURL(/category=task/);
    } finally {
      releaseOld();
    }
  });
}

for (const action of ["read", "start"] as const) {
  for (const outcome of ["success", "failure"] as const) {
    test(`P26 ${action} ${outcome} for A cannot overwrite deep-linked B`, async ({ page }) => {
      await setup(page);
      const bId = "00000000-0000-4000-8000-000000000902";
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      const bodies: unknown[] = [];
      await page.route(`**/api/v1/notifications/${id}`, (route) =>
        route.fulfill({ json: env({ ...item, read_at: action === "read" ? null : item.read_at }) }),
      );
      await page.route(`**/api/v1/notifications/${bId}`, (route) =>
        route.fulfill({ json: env({ ...item, id: bId, title: "后打开的消息B" }) }),
      );
      await page.route(`**/api/v1/notifications/${id}/actions`, async (route) => {
        bodies.push(route.request().postDataJSON());
        await pending;
        await route.fulfill(
          outcome === "success"
            ? {
                json: env({
                  id,
                  read_at: item.read_at,
                  workflow_status: action === "start" ? "in_progress" : "open",
                  version: 2,
                }),
              }
            : {
                status: 409,
                json: {
                  request_id: "old-A-receipt",
                  error: { code: "notification_version_conflict", action_hint: "旧消息A的错误" },
                },
              },
        );
      });
      try {
        await page.goto(`/notifications?notification=${id}`);
        const detail = page.getByRole("dialog", { name: "消息详情", exact: true });
        await expect(detail.getByRole("heading", { name: item.title })).toBeVisible();
        if (action === "start")
          await detail.getByRole("button", { name: "开始处理", exact: true }).click();
        await expect.poll(() => bodies.length).toBe(1);
        // Same-instance query navigation through the real router's history listener.
        await page.evaluate((next) => {
          history.pushState({ ...history.state }, "", next);
          dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
        }, `/notifications?notification=${bId}`);
        await expect(detail.getByRole("heading", { name: "后打开的消息B" })).toBeVisible();
        const response = page.waitForResponse((r) =>
          r.url().endsWith(`/notifications/${id}/actions`),
        );
        release();
        await (await response).finished();
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
            ),
        );
        await expect(detail.getByRole("heading", { name: "后打开的消息B" })).toBeVisible();
        await expect(detail.getByRole("button", { name: "开始处理", exact: true })).toBeEnabled();
        await expect(page.getByText("旧消息A的错误", { exact: true })).toHaveCount(0);
        await expect(page.getByText("通知已进入处理中。", { exact: true })).toHaveCount(0);
        await expect(page).toHaveURL(new RegExp(`notification=${bId}`));
        expect(bodies).toEqual([{ action, expected_version: 1 }]);
      } finally {
        release();
      }
    });
  }
}

const id = "00000000-0000-4000-8000-000000000931",
  env = (data: unknown) => ({
    data,
    request_id: "m05-03-e2e",
    trace_id: "m05-03-trace",
  }),
  item = {
    id,
    category: "approval",
    severity: "warning",
    title: "审批状态更新",
    body: "approval.overdue 已产生新的可审计事件。",
    resource_type: "approval_request",
    resource_id: "00000000-0000-4000-8000-000000000932",
    root_cause_key: "approval.overdue:approval_request:00000000-0000-4000-8000-000000000932",
    workflow_status: "open",
    action_route: "/tasks/approvals?approval=00000000-0000-4000-8000-000000000932",
    group_count: 3,
    read_at: "2026-08-08T10:01:00.000Z",
    version: 1,
    created_at: "2026-08-08T10:00:00.000Z",
  };

test("P26 KeepAlive suspends notification reads and SSE, then refreshes on return", async ({
  page,
}) => {
  await setup(page);
  let releaseOld!: () => void,
    markOldStarted!: () => void,
    listReads = 0;
  const oldRead = new Promise<void>((resolve) => {
    releaseOld = resolve;
  });
  const oldStarted = new Promise<void>((resolve) => {
    markOldStarted = resolve;
  });
  await page.route("**/api/v1/notifications?*", async (route) => {
    listReads += 1;
    if (listReads === 1) {
      markOldStarted();
      await oldRead;
      await route.fulfill({
        json: { ...env([{ ...item, title: "离页前的旧通知" }]), meta: { total: 99 } },
      });
      return;
    }
    await route.fulfill({
      json: { ...env([{ ...item, title: "返回后的最新通知" }]), meta: { total: 1 } },
    });
  });
  await page.addInitScript(() => {
    class TrackedEventSource {
      static instances: TrackedEventSource[] = [];
      readonly url: string;
      closed = false;
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(url: string) {
        this.url = url;
        TrackedEventSource.instances.push(this);
      }

      addEventListener() {}

      close() {
        this.closed = true;
      }
    }
    Object.defineProperty(window, "EventSource", { configurable: true, value: TrackedEventSource });
    Object.defineProperty(window, "__notificationEventSources", {
      configurable: true,
      value: TrackedEventSource.instances,
    });
  });

  try {
    await page.goto("/notifications");
    await oldStarted;
    await expect(page.locator(".notification-center")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __notificationEventSources: Array<{ closed: boolean }> })
              .__notificationEventSources.length,
        ),
      )
      .toBe(1);

    await page.getByRole("link", { name: "米兜智能选品" }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __notificationEventSources: Array<{ closed: boolean }> })
              .__notificationEventSources[0]?.closed,
        ),
      )
      .toBe(true);

    const staleReadResponse = page.waitForResponse((response) =>
      response.url().includes("/api/v1/notifications?"),
    );
    releaseOld();
    await (await staleReadResponse).finished();

    await page.evaluate(() => {
      history.pushState({ ...history.state }, "", "/notifications");
      dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
    });
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByRole("button", { name: /返回后的最新通知/ })).toBeVisible();
    await expect(page.getByText("离页前的旧通知", { exact: true })).toHaveCount(0);
    expect(listReads).toBe(2);
    const connections = await page.evaluate(() =>
      (
        window as unknown as {
          __notificationEventSources: Array<{ url: string; closed: boolean }>;
        }
      ).__notificationEventSources.map(({ url, closed }) => ({ url, closed })),
    );
    expect(connections).toHaveLength(2);
    expect(connections[0]?.closed).toBe(true);
    expect(connections[1]?.closed).toBe(false);
    expect(
      connections.map(({ url }) =>
        new URL(url, "https://scoutops.test").searchParams.get("last_event_id"),
      ),
    ).toEqual(["0", "0"]);
  } finally {
    releaseOld();
  }
});

async function setup(page: Page, additionalCapabilities: string[] = []) {
  const listRequests: string[] = [],
    actionBodies: Array<{ action: string }> = [];
  let workflowStatus = item.workflow_status,
    version = item.version;
  await page.route("**/api/v1/me/navigation?shell=member", (r) =>
    r.fulfill({
      json: env({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000933",
        workspace_id: "00000000-0000-4000-8000-000000000934",
        roles: ["selection_manager"],
        capabilities: ["notification:read", ...additionalCapabilities],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/notifications/summary", (r) =>
    r.fulfill({
      json: env({
        total: 3,
        unread: 0,
        task: 1,
        approval: 2,
        competitor: 0,
        system: 0,
        open: workflowStatus === "open" ? 3 : 0,
        in_progress: workflowStatus === "in_progress" ? 3 : 0,
        closed: workflowStatus === "closed" ? 3 : 0,
      }),
    }),
  );
  await page.route("**/api/v1/me/notification-preferences", (r) =>
    r.fulfill({
      json: env({
        in_app_enabled: true,
        email_enabled: false,
        task_enabled: true,
        approval_enabled: true,
        competitor_enabled: true,
        version: 1,
      }),
    }),
  );
  await page.route(`**/api/v1/notifications/${id}`, (r) =>
    r.fulfill({ json: env({ ...item, workflow_status: workflowStatus, version }) }),
  );
  await page.route("**/api/v1/notifications?*", (r) => {
    listRequests.push(r.request().url());
    return r.fulfill({
      json: { ...env([item]), meta: { page: 1, page_size: 100, total: 1 } },
    });
  });
  await page.route(`**/api/v1/notifications/${id}/actions`, async (r) => {
    expect(r.request().headers()["idempotency-key"]).toBeTruthy();
    expect(r.request().headers()["x-request-id"]).toBeTruthy();
    expect(r.request().headers()["x-trace-id"]).toBeTruthy();
    const body = r.request().postDataJSON();
    actionBodies.push(body);
    workflowStatus =
      body.action === "start"
        ? "in_progress"
        : body.action === "close"
          ? "closed"
          : body.action === "reopen"
            ? "open"
            : workflowStatus;
    version += 1;
    await r.fulfill({
      json: env({
        id,
        read_at: item.read_at,
        workflow_status: workflowStatus,
        version,
      }),
    });
  });
  return { actionBodies, listRequests };
}
test("P26 pending preference edits survive refresh and acknowledge only the submitted snapshot", async ({
  page,
}) => {
  const { listRequests } = await setup(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const bodies: Record<string, unknown>[] = [];
  let saved = {
    in_app_enabled: true,
    email_enabled: false,
    task_enabled: true,
    approval_enabled: true,
    competitor_enabled: true,
    version: 1,
  };
  await page.route("**/api/v1/me/notification-preferences", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      bodies.push(body);
      if (bodies.length === 1) await pending;
      saved = {
        ...saved,
        task_enabled: body.task_enabled,
        version: Number(body.expected_version) + 1,
      };
    }
    await route.fulfill({ json: env(saved) });
  });
  try {
    await page.goto("/notifications");
    await expect(page.getByText(item.title, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "通知偏好", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "通知偏好", exact: true });
    await dialog.getByRole("button", { name: "保存", exact: true }).click();
    await expect.poll(() => bodies.length).toBe(1);
    await dialog.getByRole("checkbox", { name: "任务事件", exact: true }).uncheck();
    const count = listRequests.length;
    // Exercise the real router's shared reload while the native modal is open.
    const refresh = page.waitForResponse(
      (r) =>
        r.url().includes("/notifications?category=") ||
        (r.url().includes("/notifications?") && r.url().includes("category=task")),
    );
    await page.evaluate(() => {
      history.pushState({ ...history.state }, "", "/notifications?category=task");
      dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
    });
    await (await refresh).finished();
    await expect.poll(() => listRequests.length).toBeGreaterThan(count);
    await expect(dialog.getByRole("checkbox", { name: "任务事件", exact: true })).not.toBeChecked();
    release();
    await expect(dialog.getByRole("button", { name: "保存", exact: true })).toBeEnabled();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: "任务事件", exact: true })).not.toBeChecked();
    await expect(page.locator(".notification-center")).toContainText("后续修改尚未保存");
    await dialog.getByRole("button", { name: "保存", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(
      bodies.map(({ task_enabled, expected_version, email_enabled }) => ({
        task_enabled,
        expected_version,
        email_enabled,
      })),
    ).toEqual([
      { task_enabled: true, expected_version: 1, email_enabled: false },
      { task_enabled: false, expected_version: 2, email_enabled: false },
    ]);
  } finally {
    release();
  }
});

for (const outcome of ["success", "failure"] as const) {
  test(`P26 cancelled preference ${outcome} receipt leaves the retained draft alone`, async ({
    page,
  }) => {
    const { listRequests } = await setup(page);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let submitted = false;
    await page.route("**/api/v1/me/notification-preferences", async (route) => {
      if (route.request().method() !== "PUT") return route.fallback();
      submitted = true;
      await pending;
      await route.fulfill(
        outcome === "success"
          ? { json: env({ ...route.request().postDataJSON(), version: 2 }) }
          : {
              status: 409,
              json: {
                request_id: "cancelled-preference",
                error: { code: "notification_version_conflict", action_hint: "旧偏好窗口错误" },
              },
            },
      );
    });
    try {
      await page.goto("/notifications");
      await expect(page.getByText(item.title, { exact: true })).toBeVisible();
      const opener = page.getByRole("button", { name: "通知偏好", exact: true });
      await opener.click();
      const dialog = page.getByRole("dialog", { name: "通知偏好", exact: true });
      await dialog.getByRole("checkbox", { name: "任务事件", exact: true }).uncheck();
      await dialog.getByRole("button", { name: "保存", exact: true }).click();
      await expect.poll(() => submitted).toBe(true);
      await dialog.getByRole("button", { name: "取消", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect(opener).toBeDisabled();
      const count = listRequests.length;
      release();
      await expect(opener).toBeEnabled();
      expect(listRequests.length).toBe(count);
      await expect(page.getByText("旧偏好窗口错误", { exact: true })).toHaveCount(0);
      await expect(
        page.getByText("通知偏好已保存；邮件服务接通前仅使用站内通知。", { exact: true }),
      ).toHaveCount(0);
      await opener.click();
      await expect(
        dialog.getByRole("checkbox", { name: "任务事件", exact: true }),
      ).not.toBeChecked();
    } finally {
      release();
    }
  });
}
test("notification shortcut shows confirmed in-app preference, not an unsaved draft", async ({
  page,
}) => {
  await setup(page);
  let enabled = true;
  await page.route("**/api/v1/me/notification-preferences", (route) => {
    if (route.request().method() === "PUT") enabled = route.request().postDataJSON().in_app_enabled;
    return route.fulfill({
      json: env({
        in_app_enabled: enabled,
        email_enabled: false,
        task_enabled: true,
        approval_enabled: true,
        competitor_enabled: true,
        version: enabled ? 1 : 2,
      }),
    });
  });
  await page.goto("/notifications");
  const badge = page.locator(".midou-notification-preference-status");
  await expect(badge).toHaveText("已开启");
  await page.getByRole("button", { name: "通知偏好", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "通知偏好", exact: true });
  await dialog.getByRole("checkbox", { name: "站内通知" }).uncheck();
  await expect(badge).toHaveText("已开启");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(badge).toHaveText("已关闭");
});

test("M05-03.A07/A08/A09/A15 renders recipient notification inbox and detail on desktop and 390", async ({
  page,
}) => {
  const { listRequests } = await setup(page);
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "通知中心", level: 1 }).first()).toBeVisible();
  await expect(page.getByText("审批状态更新")).toBeVisible();
  await expect(page.getByText(/已合并 3 条同根因通知/)).toBeVisible();
  const firstRecord = page.getByRole("button", { name: /审批状态更新/ });
  const recordBox = await firstRecord.boundingBox();
  const headerBox = await page.locator(".notification-center > header").boundingBox();
  const viewport = page.viewportSize()!;
  const unreadBox = await page.getByLabel("仅未读").boundingBox();
  expect(unreadBox).not.toBeNull();
  expect(unreadBox!.x).toBeGreaterThanOrEqual(0);
  expect(unreadBox!.x + unreadBox!.width).toBeLessThanOrEqual(viewport.width);
  expect(recordBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  expect(headerBox!.height).toBeLessThan(viewport.width < 760 ? 130 : 65);
  expect(recordBox!.y + recordBox!.height).toBeLessThan(
    viewport.height - (viewport.width < 760 ? 80 : 24),
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    viewport.width,
  );
  await page.getByRole("button", { name: /审批状态更新/ }).click();
  await expect(page.getByRole("dialog", { name: "消息详情" })).toBeVisible();
  await expect(page.getByText(/站内消息来自事务消息/)).toHaveCount(0);
  await expect(page.getByText("同一根因的 3 条通知已自动合并展示。")).toBeVisible();
  await expect(page.getByText("需关注", { exact: true })).toBeVisible();
  await expect(page.locator(".notification-detail article")).toHaveText(
    "审批状态已变化，请查看关联记录。",
  );
  await expect(page.getByText("approval.overdue", { exact: false })).not.toBeVisible();
  await expect(page.getByRole("link", { name: "返回来源：审批" })).toHaveAttribute(
    "href",
    new RegExp(`approval=.*&from=`),
  );
  await expect(page.getByText("已读", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("未处理", { exact: true }).last()).toBeVisible();
  await expect(page.getByText(item.resource_id, { exact: true })).not.toBeVisible();

  await page.getByRole("button", { name: "开始处理" }).click();
  await expect(page.getByText("通知已进入处理中。")).toBeVisible();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(page.getByText("通知已关闭。")).toBeVisible();
  await page.getByRole("button", { name: "关闭消息详情" }).click();
  await page.getByRole("combobox", { name: "处理状态筛选" }).selectOption("in_progress");
  await expect(page).toHaveURL(/status=in_progress/);
  await expect
    .poll(() => listRequests.some((url) => url.includes("workflow_status=in_progress")))
    .toBe(true);
});

test("mark one notification read from its row without opening detail", async ({ page }) => {
  await setup(page);
  let readAt: string | null = null;
  let detailReads = 0;
  const actions: unknown[] = [];
  await page.route(`**/api/v1/notifications/${id}`, (route) => {
    detailReads++;
    return route.fulfill({ json: env(item) });
  });
  await page.route("**/api/v1/notifications?*", (route) =>
    route.fulfill({ json: { ...env([{ ...item, read_at: readAt }]), meta: { total: 1 } } }),
  );
  await page.route(`**/api/v1/notifications/${id}/actions`, (route) => {
    actions.push(route.request().postDataJSON());
    readAt = "2026-08-08T10:01:00.000Z";
    return route.fulfill({ json: env({ ...item, read_at: readAt, version: item.version + 1 }) });
  });
  await page.goto("/notifications");
  const action = page.getByRole("button", { name: `标为已读：${item.title}` });
  await action.click();
  await expect(action).toHaveCount(0);
  await expect(page.locator(".notification-record")).toContainText("已读");
  await expect(page.getByRole("dialog", { name: "消息详情" })).toHaveCount(0);
  expect(detailReads).toBe(0);
  expect(actions).toEqual([{ action: "read", expected_version: item.version }]);
});

test("notification title or body search uses server pagination and clears independently", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/notifications?*", (route) => {
    const q = new URL(route.request().url()).searchParams;
    const rows =
      q.get("q") === "条款" && q.get("page") === "2" ? [{ ...item, title: "第二页通知" }] : [item];
    return route.fulfill({ json: { ...env(rows), meta: { total: 151 } } });
  });
  await page.goto("/notifications?category=approval&page=3");
  const search = page.getByRole("searchbox", { name: "搜索通知标题或正文" });
  await search.fill("条款");
  const first = page.waitForRequest((r) => {
    const url = new URL(r.url());
    return (
      url.pathname.endsWith("/notifications") &&
      url.searchParams.get("q") === "条款" &&
      url.searchParams.get("page") === "1"
    );
  });
  await search.press("Enter");
  expect(new URL((await first).url()).searchParams.get("category")).toBe("approval");
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByText("第二页通知", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "清除", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(page).not.toHaveURL(/[?&]q=/);
  await expect(page).toHaveURL(/category=approval/);
});

test("notification filters and detail restore from the URL", async ({ page }) => {
  await setup(page);
  await page.goto(`/notifications?category=approval&status=open&notification=${id}`);
  await expect(page.getByRole("button", { name: "审批", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("combobox", { name: "处理状态筛选" })).toHaveValue("open");
  await expect(page.getByRole("heading", { name: "审批状态更新" })).toBeVisible();
  await expect(page.getByRole("button", { name: "系统", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "消息详情" })).toHaveCount(0);
});

test("legacy notification_id links normalize to the canonical detail URL", async ({ page }) => {
  await setup(page);
  await page.goto(`/notifications?notification_id=${id}`);
  await expect(page.getByRole("dialog", { name: "消息详情" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`notification=${id}`));
  await expect(page).not.toHaveURL(/notification_id=/);
});

test("workflow actions ignore repeated clicks while the first request is in flight", async ({
  page,
}) => {
  const { actionBodies } = await setup(page);
  await page.goto(`/notifications?notification=${id}`);
  await page.getByRole("button", { name: "开始处理" }).dblclick();
  await expect(page.getByText("通知已进入处理中。")).toBeVisible();
  expect(actionBodies.filter(({ action }) => action === "start")).toHaveLength(1);
});

test("M05-03 mail preference stays disabled until the provider is connected", async ({ page }) => {
  await setup(page);
  await page.goto("/notifications");
  await page.getByRole("button", { name: "通知偏好" }).click();
  await expect(
    page.getByRole("checkbox", {
      name: "邮件通知（服务未接入，暂不可用）",
    }),
  ).toBeDisabled();
});

test("UI2-AN03 notification keeps the pending workflow modal and closes safely after acknowledgement", async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const bodies: unknown[] = [];
  await page.route(`**/api/v1/notifications/${id}/actions`, async (route) => {
    bodies.push(route.request().postDataJSON());
    await pending;
    await route.fulfill({ json: env({ ...item, workflow_status: "in_progress", version: 2 }) });
  });
  await page.goto(`/notifications?category=approval&status=open&notification=${id}`);
  const dialog = page.getByRole("dialog", { name: "消息详情" });
  await expect(dialog).toBeVisible();
  try {
    await dialog.getByRole("button", { name: "开始处理" }).click();
    await expect.poll(() => bodies.length).toBe(1);
    await expect(dialog.getByRole("button", { name: "关闭消息详情" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`notification=${id}`));
  } finally {
    release();
  }
  await expect(dialog.getByRole("button", { name: "关闭消息详情" })).toBeEnabled();
  await expect(dialog.locator("dl").first()).toContainText("处理中");
  expect(bodies).toEqual([{ action: "start", expected_version: 1 }]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/category=approval&status=open$/);
});

test("P26 workflow failure stays inside the detail dialog and receives focus", async ({ page }) => {
  await setup(page);
  await page.route(`**/api/v1/notifications/${id}/actions`, (route) =>
    route.fulfill({
      status: 409,
      json: {
        request_id: "p26-workflow-conflict",
        error: {
          code: "notification_version_conflict",
          action_hint: "这条通知已有更新，请重新读取后再操作。",
        },
      },
    }),
  );
  await page.goto(`/notifications?notification=${id}`);
  const dialog = page.getByRole("dialog", { name: "消息详情" });
  await dialog.getByRole("button", { name: "开始处理" }).click();
  const error = dialog.getByRole("alert");
  await expect(error).toContainText("这条通知已有更新，请重新读取后再操作。");
  await expect(error).toBeFocused();
  await expect(dialog).toHaveAttribute("aria-describedby", "notification-detail-error");
  await expect(error.getByText("查看本次操作编号")).toBeVisible();
  await expect(page.locator(".notification-notice")).toHaveCount(0);
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "关闭消息详情" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.locator("summary").filter({ hasText: "技术详情" })).toBeFocused();
  await error.getByText("查看本次操作编号").click();
  await expect(error.getByText("p26-workflow-conflict")).toBeVisible();
});

test("P26 preference failure announces and focuses its modal error without losing edits", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/me/notification-preferences", (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    return route.fulfill({
      status: 409,
      json: {
        request_id: "p26-preference-conflict",
        error: {
          code: "notification_preference_version_conflict",
          action_hint: "偏好设置已有更新，请保留当前选择并重试。",
        },
      },
    });
  });
  await page.goto("/notifications");
  await page.getByRole("button", { name: "通知偏好" }).click();
  const dialog = page.getByRole("dialog", { name: "通知偏好" });
  const taskPreference = dialog.getByRole("checkbox", { name: "任务事件" });
  await taskPreference.uncheck();
  await dialog.getByRole("button", { name: "保存" }).click();
  const error = dialog.getByRole("alert");
  await expect(error).toContainText("偏好设置已有更新，请保留当前选择并重试。");
  await expect(error).toBeFocused();
  await expect(dialog).toHaveAttribute("aria-describedby", "notification-preferences-error");
  await expect(error.getByText("查看本次操作编号")).toBeVisible();
  await expect(taskPreference).not.toBeChecked();
  await expect(page.locator(".notification-notice")).toHaveCount(0);
  await error.getByText("查看本次操作编号").click();
  await expect(error.getByText("p26-preference-conflict")).toBeVisible();
});

test("notification cards distinguish task and competitor categories with decorative glyphs", async ({
  page,
}) => {
  const wide = page.viewportSize()!.width >= 1101;
  if (wide) await page.setViewportSize({ width: 1717, height: 916 });
  await setup(page, ["task:read", "trend:read", "opportunity:read", "sourcing:read"]);
  const rows = [
    {
      ...item,
      id: "00000000-0000-4000-8000-000000000984",
      category: "competitor",
      title: "竞品监控更新",
      body: "竞品监控状态已变化，请查看关联记录。",
      group_count: 1,
      read_at: null,
    },
    {
      ...item,
      category: "task",
      title: "任务状态更新",
      body: "任务状态已变化，请查看关联记录。",
      created_at: "2026-08-07T10:00:00Z",
      group_count: 1,
      read_at: null,
    },
  ];
  await page.route("**/api/v1/notifications/summary", (r) =>
    r.fulfill({
      json: env({
        total: 2,
        unread: 2,
        task: 1,
        approval: 0,
        competitor: 1,
        system: 0,
        open: 2,
        in_progress: 0,
        closed: 0,
      }),
    }),
  );
  await page.route("**/api/v1/notifications?*", (route) =>
    route.fulfill({ json: { ...env(rows), meta: { total: rows.length } } }),
  );
  await page.goto("/notifications");
  const task = page.locator(".notification-record > i[data-category='task'] svg");
  const competitor = page.locator(".notification-record > i[data-category='competitor'] svg");
  await expect(task).toHaveAttribute("aria-hidden", "true");
  await expect(competitor).toHaveAttribute("aria-hidden", "true");
  await expect(task.locator("rect")).toHaveCount(1);
  await expect(competitor.locator("path")).toHaveCount(2);
  await expect(competitor.locator("circle")).toHaveCount(0);
  const timestamps = page.locator(".notification-record > em > time");
  await expect(timestamps).toHaveCount(2);
  await expect(timestamps.nth(1)).toHaveAttribute("datetime", rows[1].created_at);
  await expect(timestamps.nth(1)).toHaveAttribute("title", /\d{2}:\d{2}:\d{2}$/);
  await expect(timestamps.nth(1)).toHaveText(/^\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}$/);
  if (wide) {
    const sidebar = page.getByRole("complementary", { name: "工作区导航" });
    for (const name of ["选品工作台", "市场情报", "选品库", "1688 找货"]) {
      await expect(sidebar.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(task).toHaveCSS("width", "30px");
    await expect(competitor).toHaveCSS("height", "30px");
    const records = page.locator(".notification-record");
    await expect(records).toHaveCount(2);
    const [first, second] = await records.evaluateAll((nodes) =>
      nodes.map((row) => {
        const rect = row.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          time: row.querySelector("em")!.getBoundingClientRect().x,
          status: row.querySelector("b")!.getBoundingClientRect().x,
          action: row.querySelector(".midou-notification-open")!.getBoundingClientRect().x,
        };
      }),
    );
    expect([first.time, first.status, first.action]).toEqual([
      second.time,
      second.status,
      second.action,
    ]);
    expect(Math.abs(first.time - 875)).toBeLessThanOrEqual(8);
    expect(Math.abs(first.status - 1050)).toBeLessThanOrEqual(8);
    expect(Math.abs(second.top - first.bottom - 11)).toBeLessThanOrEqual(3);
  }
});

test("midou reference notification layout keeps original workflow and preferences reachable", async ({
  page,
}) => {
  if (page.viewportSize()!.width >= 1101) await page.setViewportSize({ width: 1717, height: 916 });
  await setup(page);
  await page.route("**/api/v1/notifications?*", (route) =>
    route.fulfill({ json: { ...env([{ ...item, read_at: null }]), meta: { total: 1 } } }),
  );
  await page.goto("/notifications");
  await expect(page.locator(".notification-summary article")).toHaveCount(4);
  await expect(page.locator(".notification-list .notification-record > i svg")).toBeVisible();
  await expect(page.locator(".midou-notification-filters > nav")).toHaveCount(1);
  await expect(page.getByRole("combobox", { name: "处理状态筛选" })).toHaveValue("");
  await page.getByRole("checkbox", { name: "仅未读" }).focus();
  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/unread=1/);
  await page.getByRole("checkbox", { name: "仅未读" }).uncheck();
  await expect(page).not.toHaveURL(/unread=1/);
  await expect(page.locator(".midou-notification-open")).toContainText("查看记录");
  const viewAction = page.locator(".midou-notification-open");
  const readAction = page.locator(".notification-mark-read");
  const wide = (page.viewportSize()?.width ?? 0) >= 1450;
  await expect(viewAction).toHaveCSS("min-height", wide ? "40px" : "44px");
  await expect(readAction).toHaveCSS("min-height", wide ? "40px" : "44px");
  const readBorder = await readAction.evaluate((button) => getComputedStyle(button).borderTopColor);
  await expect(viewAction).not.toHaveCSS("border-top-color", readBorder);
  if (wide) {
    const [viewBox, readBox] = await Promise.all([
      viewAction.boundingBox(),
      readAction.boundingBox(),
    ]);
    expect([viewBox!.width, readBox!.width]).toEqual([104, 104]);
    expect([viewBox!.height, readBox!.height]).toEqual([40, 40]);
    expect(Math.abs(viewBox!.y - readBox!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(readBox!.x - viewBox!.x - viewBox!.width - 14)).toBeLessThanOrEqual(2);
    const header = page.locator(".notification-center > header");
    const preferenceAction = (await header
      .getByRole("button", { name: "通知偏好" })
      .boundingBox())!;
    const markAll = (await header.getByRole("button", { name: "全部已读" }).boundingBox())!;
    const badge = (await header.locator(".realtime-badge").boundingBox())!;
    expect(preferenceAction.width).toBe(116);
    expect(markAll.width).toBe(110);
    expect(markAll.x - preferenceAction.x - preferenceAction.width).toBe(14);
    expect(badge.width).toBe(118);
    expect(badge.height).toBe(32);
    const categories = page.locator(".midou-notification-filters > nav > button");
    await expect(categories.first()).toHaveCSS("font-weight", "650");
    const categoryBoxes = await categories.evaluateAll((nodes) =>
      nodes.map((node) => {
        const { x, y, width } = node.getBoundingClientRect();
        return { x, y, width };
      }),
    );
    expect(categoryBoxes).toHaveLength(5);
    expect(categoryBoxes.every(({ y, width }) => y === categoryBoxes[0].y && width === 78)).toBe(
      true,
    );
    expect(categoryBoxes[4].x - categoryBoxes[0].x).toBeCloseTo(332, 0);
    const searchBox = (await page.getByRole("searchbox").boundingBox())!;
    expect(
      Math.abs(searchBox.y + searchBox.height / 2 - categoryBoxes[0].y - 21),
    ).toBeLessThanOrEqual(3);
    const searchForm = page.getByRole("search");
    const initialSearch = (await searchForm.boundingBox())!;
    expect(initialSearch.width).toBe(268);
    const status = (await page.getByRole("combobox", { name: "处理状态筛选" }).boundingBox())!;
    const unread = (await page.getByRole("checkbox", { name: "仅未读" }).boundingBox())!;
    expect(status.width).toBe(130);
    expect(unread.width).toBe(44);
    const toggle = page.getByRole("checkbox", { name: "仅未读" });
    expect(
      await toggle.evaluate((node) => getComputedStyle(node, "::before").backgroundColor),
    ).toBe("rgb(255, 255, 255)");
    expect(Math.abs(status.x - 837)).toBeLessThanOrEqual(10);
    expect(Math.abs(unread.x - 991)).toBeLessThanOrEqual(6);
    expect(Math.abs(initialSearch.x - 1147)).toBeLessThanOrEqual(6);
    await page.getByRole("searchbox").fill("更新");
    await page.getByRole("searchbox").press("Enter");
    await expect(page.getByRole("button", { name: "清除", exact: true })).toBeVisible();
    expect(await searchForm.boundingBox()).toEqual(initialSearch);
    await page.getByRole("button", { name: "清除", exact: true }).click();
    const summary = page.locator(".notification-summary");
    const summaryBox = (await summary.boundingBox())!;
    expect(Math.abs(summaryBox.y - 234)).toBeLessThanOrEqual(2);
    expect(Math.abs(summaryBox.y + summaryBox.height - 312)).toBeLessThanOrEqual(2);
    const headingBox = (await header.getByRole("heading", { name: "通知中心" }).boundingBox())!;
    expect(Math.abs(headingBox.y - 143)).toBeLessThanOrEqual(4);
    await expect(header.getByRole("button", { name: "通知偏好" })).toHaveCSS(
      "border-top-color",
      readBorder,
    );
    await expect(summary.locator("svg[aria-hidden='true']")).toHaveCount(4);
    for (const icon of await summary.locator("svg").all())
      await expect(icon).toHaveCSS("width", "24px");
    await expect(summary.locator("b").first()).toHaveCSS("font-size", "27px");
    await expect(page.locator(".notification-record")).toHaveCSS("padding-left", "52px");
    await expect(page.locator(".notification-record > i")).toHaveCSS("width", "60px");
    await expect(readAction).toHaveCSS("font-weight", "500");
    const title = (await page.locator(".notification-record > span > strong").boundingBox())!;
    expect(Math.abs(title.x - 424)).toBeLessThanOrEqual(3);
    expect(
      await page
        .locator(".midou-notification-open")
        .evaluate((element) => getComputedStyle(element, "::before").borderInlineStartWidth),
    ).toBe("1px");
  }
  const preference = page.getByRole("complementary", { name: "通知偏好快捷入口" });
  await expect(preference.locator("p")).toHaveCSS("font-size", wide ? "15px" : "16px");
  const channel = preference.locator(":scope > div");
  await expect(channel).toHaveCSS("min-height", wide ? "73px" : "62px");
  if (wide) {
    const [card, row] = await Promise.all([preference.boundingBox(), channel.boundingBox()]);
    expect(Math.abs(card!.y - 154)).toBeLessThanOrEqual(3);
    expect(Math.abs(row!.y + row!.height - 342)).toBeLessThanOrEqual(3);
    expect(Math.abs(card!.y + card!.height - 415)).toBeLessThanOrEqual(3);
  }
  await expect(page.locator(".notification-record > span > strong")).toHaveCSS(
    "font-size",
    wide ? "20px" : "16px",
  );
  await expect(page.locator(".notification-record > em")).toHaveCSS(
    "font-size",
    wide ? "16px" : "13px",
  );
  await expect(
    page.locator('.notification-list .notification-record > b[data-workflow="open"]'),
  ).toHaveText("未处理");
  await expect(page.locator(".notification-record .notification-group-note")).toHaveText(
    "已合并 3 条同根因通知",
  );
  await expect(page.locator(".notification-record")).toHaveAccessibleName(/未读/);
  expect(
    await page
      .locator(".notification-list .notification-record.unread")
      .evaluate((el) => getComputedStyle(el, "::before").width),
  ).toBe(wide ? "14px" : (page.viewportSize()?.width ?? 0) >= 1151 ? "10px" : "6px");

  await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByRole("button", { name: "通知偏好", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "通知偏好", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.locator(".notification-list .notification-record").click();
  await expect(page.getByRole("dialog", { name: "消息详情", exact: true })).toBeVisible();
});
