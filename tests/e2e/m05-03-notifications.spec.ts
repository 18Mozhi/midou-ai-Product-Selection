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
async function setup(page: Page) {
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
        capabilities: ["notification:read"],
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
test("M05-03.A07/A08/A09/A15 renders recipient notification inbox and detail on desktop and 390", async ({
  page,
}) => {
  const { listRequests } = await setup(page);
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "通知中心", level: 2 })).toBeVisible();
  await expect(page.getByText("审批状态更新")).toBeVisible();
  await expect(page.getByText(/已合并 3 条同根因通知/)).toBeVisible();
  await page.getByRole("button", { name: /审批状态更新/ }).click();
  await expect(page.getByRole("dialog", { name: "消息详情" })).toBeVisible();
  await expect(page.getByText(/站内消息来自事务消息/)).toBeVisible();
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
  await page.getByRole("button", { name: "处理中", exact: true }).click();
  await expect(page).toHaveURL(/status=in_progress/);
  await expect
    .poll(() => listRequests.some((url) => url.includes("workflow_status=in_progress")))
    .toBe(true);
});

test("notification filters and detail restore from the URL", async ({ page }) => {
  await setup(page);
  await page.goto(`/notifications?category=approval&status=open&notification=${id}`);
  await expect(page.getByRole("button", { name: "审批", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "未处理", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
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
