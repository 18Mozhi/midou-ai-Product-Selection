import { test, expect, type Page, type Locator, type Route } from "@playwright/test";
import { setupBusinessTasks as setup, taskId, actor, env, task } from "./helpers/business-tasks";

// Real Vue, existing isolated fixture; these cases do not verify MySQL or production writes.
const detail = `/tasks/${taskId}`;
const more = (page: Page) => page.locator(".task-detail-more > summary");
const actionDialog = (page: Page) => page.getByRole("dialog", { name: "任务操作表单" });
const reason = "补齐交期证据后继续";
const deadline = "2026-10-09T16:30";

async function fillAction(page: Page, dialog: Locator, action: string) {
  const fields: Record<string, unknown> = {};
  if (action === "progress") {
    await dialog.getByLabel("完成进度（0–100）").fill("45");
    await dialog.getByLabel("本次进展说明").fill(`  ${reason}  `);
    return { progress_percent: 45, progress_note: reason };
  }
  if (action !== "resume") {
    await dialog.getByLabel("操作原因").fill(`  ${reason}  `);
    fields.reason = reason;
  }
  if (action === "delay") {
    await dialog.getByLabel("新截止时间").fill(deadline);
    fields.due_at = await page.evaluate((value) => new Date(value).toISOString(), deadline);
  }
  if (action === "transfer") {
    await dialog.getByRole("combobox").selectOption(actor);
    fields.assignee_id = actor;
  }
  return fields;
}

for (const [action, label] of [
  ["progress", "更新进度"],
  ["pause", "暂停"],
  ["cancel", "取消任务"],
  ["delay", "调整期限"],
  ["transfer", "转交负责人"],
]) {
  test(`UI2-T01 ${action}: cancel is read-only and submit uses the current version`, async ({
    page,
  }) => {
    await setup(page);
    const writes: unknown[] = [];
    await page.route(`**/api/v1/tasks/${taskId}/actions`, async (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      writes.push(route.request().postDataJSON());
      await route.fulfill({ json: env({ ...task, version: 3 }) });
    });
    await page.goto(detail);
    if (action !== "progress") await more(page).click();
    const trigger = page.locator(".task-detail").getByRole("button", { name: label, exact: true });
    await trigger.click();
    const dialog = actionDialog(page);
    await fillAction(page, dialog, action);
    await dialog.getByRole("button", { name: "返回", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(writes).toEqual([]);
    await trigger.click();
    const fields = await fillAction(page, dialog, action);
    await dialog.getByRole("button", { name: "确认提交", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(".task-detail h3")).toHaveText(task.title);
    expect(writes).toEqual([{ action, expected_version: 2, ...fields }]);
  });
}

for (const [action, label, status] of [
  ["start", "开始", "todo"],
  ["resume", "继续", "paused"],
  ["complete", "完成", "in_progress"],
]) {
  test(`UI2-T02 ${action}: direct lifecycle has no invented reason dialog`, async ({ page }) => {
    const observed = await setup(page, status === "paused");
    await page.route(`**/api/v1/tasks/${taskId}`, (route) =>
      route.fulfill({ json: env({ ...task, status }) }),
    );
    await page.goto(detail);
    const request = page.waitForRequest((r) => r.url().endsWith(`${detail}/actions`));
    await page.locator(".task-detail").getByRole("button", { name: label, exact: true }).click();
    expect((await request).postDataJSON()).toEqual({ action, expected_version: 2 });
    await expect(page.locator(".task-notice")).toContainText("任务动作已记录");
    await expect(actionDialog(page)).toBeHidden();
    expect(observed.actionRequests).toBe(1);
  });
}

test("UI2-T03 failed progress submission preserves input and can retry without navigation", async ({
  page,
}) => {
  await setup(page);
  const writes: unknown[] = [];
  await page.route(`**/api/v1/tasks/${taskId}/actions`, async (route) => {
    writes.push(route.request().postDataJSON());
    await route.fulfill(
      writes.length === 1
        ? {
            status: 503,
            json: {
              error: {
                code: "service_unavailable",
                message: "暂不可用",
                action_hint: "稍后重试。",
              },
              request_id: "ui2-task-retry",
              trace_id: "ui2-task-retry",
            },
          }
        : { json: env({ ...task, version: 3 }) },
    );
  });
  await page.goto(detail);
  await page.getByRole("button", { name: "更新进度", exact: true }).click();
  const dialog = actionDialog(page);
  const fields = await fillAction(page, dialog, "progress");
  await dialog.getByRole("button", { name: "确认提交", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "确认提交", exact: true })).toBeEnabled();
  await expect(dialog.getByLabel("完成进度（0–100）")).toHaveValue("45");
  await expect(dialog.getByLabel("本次进展说明")).toHaveValue(`  ${reason}  `);
  expect(writes).toHaveLength(1);
  await dialog.getByRole("button", { name: "确认提交", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(writes).toEqual(Array(2).fill({ action: "progress", expected_version: 2, ...fields }));
});

for (const [action, label, eligible] of [
  ["pause", "批量暂停", 1],
  ["resume", "批量继续", 0],
  ["delay", "批量延期", 2],
  ["transfer", "批量调整负责人", 2],
  ["cancel", "批量取消", 2],
] as const) {
  test(`UI2-T04 batch ${action}: fixed eligibility, exact inputs and cancel`, async ({ page }) => {
    await setup(page);
    const writes: { path: string; body: unknown }[] = [];
    await page.route("**/api/v1/tasks/*/actions", async (route) => {
      writes.push({
        path: new URL(route.request().url()).pathname,
        body: route.request().postDataJSON(),
      });
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      await route.fulfill({ json: env({ ...task, version: 3 }) });
    });
    await page.goto("/tasks");
    await page.getByRole("checkbox", { name: "选择本页 2 项" }).check();
    const trigger = page.getByRole("button", { name: label, exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "确认批量任务操作" });
    await expect(dialog.locator("dl > div").filter({ hasText: "可执行" }).locator("dd")).toHaveText(
      `${eligible} 项`,
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(writes).toEqual([]);
    await expect(page.getByRole("checkbox", { name: "选择本页 2 项" })).toBeChecked();
    await trigger.click();
    if (!eligible) {
      await expect(dialog.getByRole("button", { name: "确认执行" })).toBeDisabled();
      await dialog.getByRole("button", { name: "返回", exact: true }).click();
      expect(writes).toEqual([]);
      return;
    }
    const fields = await fillAction(page, dialog, action);
    await dialog.getByRole("button", { name: "确认执行" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(".task-notice")).toContainText(
      `批量操作完成 ${eligible} 项，失败 0 项，跳过 ${2 - eligible} 项`,
    );
    const ids = [taskId, "00000000-0000-4000-8000-000000000807"].slice(0, eligible);
    expect(writes).toEqual(
      ids.map((id, index) => ({
        path: `/api/v1/tasks/${id}/actions`,
        body: { action, expected_version: index === 0 ? 2 : 1, ...fields },
      })),
    );
    await expect(page.locator(".task-batch-bar")).toHaveCount(0);
  });
}

test("UI2-T05 work filters preserve mine and return restores the exact list URL", async ({
  page,
}) => {
  await setup(page);
  const requests: URL[] = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.pathname === "/api/v1/tasks") requests.push(url);
  });
  const from = "/work?status=in_progress&query=报价&sort=updated_desc";
  const expectedQuery = {
    page: "1",
    page_size: "10",
    mine: "true",
    status: "in_progress",
    query: "报价",
    sort: "updated_desc",
  };
  await page.goto(from);
  await expect(page.locator(".task-row-main").first()).toBeVisible();
  expect(Object.fromEntries(requests.at(-1)!.searchParams)).toEqual(expectedQuery);
  await page.locator(".task-row-main").filter({ hasText: task.title }).click();
  await expect(page.getByRole("link", { name: "关闭任务详情" })).toHaveAttribute(
    "href",
    encodeURI(from),
  );
  const restored = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/v1/tasks" && url.searchParams.get("query") === "报价";
  });
  await page.getByRole("link", { name: "关闭任务详情" }).click();
  expect(Object.fromEntries(new URL((await restored).url()).searchParams)).toEqual(expectedQuery);
  await expect(page.getByRole("heading", { name: "今日工作", level: 2 })).toBeVisible();
  await expect(page.getByRole("button", { name: "进行中" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Exact inactive-cache request counts and response ownership have separate UI2-C01/C02 cases.
  for (const url of requests) {
    expect(url.searchParams.get("mine")).toBe("true");
  }
});

test("UI2-T06 quick-create cancel clears only its query and never writes", async ({ page }) => {
  const observed = await setup(page);
  await page.goto("/tasks?status=paused&create=1&title=补充报价&description=说明");
  const dialog = page.getByRole("dialog", { name: "新建任务", exact: true });
  await expect(dialog.getByLabel("标题", { exact: true })).toHaveValue("补充报价");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => new URL(page.url()).search).toBe("?status=paused");
  expect(observed.createRequests).toBe(0);
});

test("UI2-T07 edit preserves assignee and version; delete returns to the original list", async ({
  page,
}) => {
  await setup(page);
  const writes: { method: string; body: unknown }[] = [];
  await page.route(`**/api/v1/tasks/${taskId}`, async (route) => {
    if (route.request().method() === "GET") return route.fallback();
    writes.push({ method: route.request().method(), body: route.request().postDataJSON() });
    await route.fulfill({ json: env({ ...task, version: 3 }) });
  });
  await page.goto(`${detail}?from=${encodeURIComponent("/tasks?status=in_progress")}`);
  await more(page).click();
  await page.getByRole("button", { name: "编辑任务", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "编辑任务", exact: true });
  await edit.getByLabel("标题", { exact: true }).fill("更新报价核验说明");
  await edit.getByLabel("截止时间（可选）").fill("");
  await edit.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(edit).toBeHidden();
  expect(writes).toEqual([
    {
      method: "PATCH",
      body: {
        title: "更新报价核验说明",
        description: task.description,
        priority: task.priority,
        due_at: null,
        assignee_id: actor,
        expected_version: 2,
        reason: "更新任务内容",
      },
    },
  ]);
  await more(page).click();
  await page.locator(".task-detail").getByRole("button", { name: "删除任务", exact: true }).click();
  const deletion = page.getByRole("dialog", { name: "删除任务", exact: true });
  await deletion.getByLabel("删除原因").fill("测试任务已合并");
  await deletion.getByRole("button", { name: "取消", exact: true }).click();
  expect(writes).toHaveLength(1);
  await page.locator(".task-detail").getByRole("button", { name: "删除任务", exact: true }).click();
  await expect(deletion.getByLabel("删除原因")).toHaveValue("");
  await deletion.getByLabel("删除原因").fill("  测试任务已合并  ");
  await deletion.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect
    .poll(() => new URL(page.url()).pathname + new URL(page.url()).search)
    .toBe("/tasks?status=in_progress");
  expect(writes[1]).toEqual({
    method: "DELETE",
    body: { expected_version: 2, reason: "测试任务已合并" },
  });
});

test("UI2-T07 closing a pending delete does not lose the submitted target", async ({ page }) => {
  const observed = await setup(page);
  const writes: { method: string; body: unknown }[] = [];
  const pageErrors: string[] = [];
  let pending: Route | undefined;
  let releaseRoute!: () => void;
  const routeGate = new Promise<void>((resolve) => {
    releaseRoute = resolve;
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route(`**/api/v1/tasks/${taskId}`, async (route) => {
    if (route.request().method() === "GET") return route.fallback();
    writes.push({ method: route.request().method(), body: route.request().postDataJSON() });
    pending = route;
    await routeGate;
  });

  await page.goto(`${detail}?from=${encodeURIComponent("/tasks?status=in_progress")}`);
  await more(page).click();
  await page.locator(".task-detail").getByRole("button", { name: "删除任务", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "删除任务", exact: true });
  await dialog.getByLabel("删除原因").fill("重复任务已合并");
  await dialog.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("button[type=submit]")).toBeDisabled();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await pending!.fulfill({ json: env({ id: taskId, deleted: true }) });
  releaseRoute();

  await expect(page).toHaveURL(/\/tasks\?status=in_progress$/);
  await expect.poll(() => observed.listRequests).toBeGreaterThan(0);
  expect(writes).toEqual([
    {
      method: "DELETE",
      body: { expected_version: 2, reason: "重复任务已合并" },
    },
  ]);
  expect(pageErrors).toEqual([]);
});

test("UI2-T08 detail not-found reload retries the read without list or summary requests", async ({
  page,
}) => {
  const observed = await setup(page);
  let attempts = 0;
  await page.route(`**/api/v1/tasks/${taskId}`, (route) => {
    attempts += 1;
    if (attempts > 1) return route.fallback();
    return route.fulfill({
      status: 404,
      json: {
        error: {
          code: "task_not_found",
          message: "任务不存在。",
          action_hint: "返回任务列表后刷新。",
        },
        request_id: "ui2-not-found",
        trace_id: "ui2-not-found",
      },
    });
  });
  await page.goto(detail);
  await expect(page.getByRole("heading", { name: "任务不存在或已删除" })).toBeVisible();
  await page.getByRole("button", { name: "重新加载", exact: true }).click();
  await expect(page.locator(".task-detail h3")).toHaveText(task.title);
  expect(attempts).toBe(2);
  expect(observed.listRequests + observed.summaryRequests + observed.actionRequests).toBe(0);
});
