import { test, expect, type Page } from "@playwright/test";
import { setupBusinessTasks as setup, taskId, actor, env, task } from "./helpers/business-tasks";

const secondId = "00000000-0000-4000-8000-000000000807";
test("UI2-C05 action refresh finishes its member directory after superseding the initial read", async ({
  page,
}) => {
  const observed = await setup(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let members = 0;
  await page.route("**/api/v1/tasks/member-options", async (route) => {
    members += 1;
    if (members === 1) await pending;
    await route.fulfill({ json: env([{ id: actor, label: "当前负责人目录" }]) });
  });
  try {
    await page.goto(`/tasks/${taskId}`);
    await expect.poll(() => members).toBe(1);
    await page.getByRole("button", { name: "完成", exact: true }).click();
    await expect(page.locator(".task-detail-facts")).toContainText("当前负责人目录");
    expect(members).toBe(2);
    expect(observed.actionRequests).toBe(1);
    expect(observed.detailRequests).toBe(2);
  } finally {
    release();
  }
});
const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

for (const path of ["/work", "/tasks"]) {
  test(`UI2-C01 ${path}: cached list stops reading in detail and refreshes once on return`, async ({
    page,
  }) => {
    const observed = await setup(page);
    const lists: URL[] = [];
    page.on("request", (r) => {
      const url = new URL(r.url());
      if (url.pathname === "/api/v1/tasks") lists.push(url);
    });
    await page.goto(`${path}?status=in_progress&query=报价&sort=updated_desc`);
    await page.locator(".task-row-main").filter({ hasText: task.title }).click();
    await expect(page.locator(".task-detail h3")).toHaveText(task.title);
    await settle(page);
    expect(observed.listRequests).toBe(1);
    expect(observed.summaryRequests).toBe(1);
    expect(observed.detailRequests).toBe(1);
    await page.getByRole("link", { name: "关闭任务详情" }).click();
    await expect(page.locator(".task-row-main").first()).toBeVisible();
    await settle(page);
    expect(observed.listRequests).toBe(2);
    expect(observed.summaryRequests).toBe(2);
    expect(observed.detailRequests).toBe(1);
    for (const url of lists) {
      expect(url.searchParams.get("mine")).toBe(path === "/work" ? "true" : null);
      expect(url.searchParams.get("status")).toBe("in_progress");
      expect(url.searchParams.get("query")).toBe("报价");
      expect(url.searchParams.get("sort")).toBe("updated_desc");
    }
  });
}

for (const lateStatus of [200, 404]) {
  test(`UI2-C02 late ${lateStatus}: inactive detail cannot overwrite the reactivated snapshot`, async ({
    page,
  }) => {
    await setup(page);
    // Deliberately make this read non-cancellable to verify response ownership, not just abort().
    await page.addInitScript(
      ({ suffix }) => {
        const original = window.fetch.bind(window);
        window.fetch = (input, init) => {
          const url = input instanceof Request ? input.url : String(input);
          return original(
            input,
            url.endsWith(suffix) && (!init?.method || init.method === "GET")
              ? { ...init, signal: undefined }
              : init,
          );
        };
      },
      { suffix: `/api/v1/tasks/${taskId}` },
    );
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reads = 0;
    await page.route(`**/api/v1/tasks/${taskId}`, async (route) => {
      reads += 1;
      if (reads > 1)
        return route.fulfill({ json: env({ ...task, title: "最新任务事实", version: 3 }) });
      await pending;
      await route.fulfill({
        status: lateStatus,
        headers: { "x-ui2-response": "late" },
        json:
          lateStatus === 200
            ? env({ ...task, title: "旧任务事实" })
            : {
                error: { code: "task_not_found", message: "旧请求错误", action_hint: "旧请求错误" },
                request_id: "old-read",
                trace_id: "old-read",
              },
      });
    });
    try {
      await page.goto("/tasks");
      await page.locator(".task-row-main").filter({ hasText: task.title }).click();
      await expect(page.getByText("正在读取任务详情…", { exact: true })).toBeVisible();
      await expect.poll(() => reads).toBe(1);
      await page.goBack();
      await expect(page.locator(".task-row-main").first()).toBeVisible();
      await page.goForward();
      await expect(page.locator(".task-detail h3")).toHaveText("最新任务事实");
      expect(reads).toBe(2);
      const late = page.waitForResponse(
        (response) => response.headers()["x-ui2-response"] === "late",
      );
      release();
      await (await late).finished();
      await settle(page);
      await expect(page.locator(".task-detail h3")).toHaveText("最新任务事实");
      await expect(page.getByText("旧请求错误", { exact: true })).toHaveCount(0);
      await expect(page.locator(".task-detail-header")).toContainText("第 3 版");
    } finally {
      release();
    }
  });
}

test("UI2-C03 cached detail changes task IDs once and keeps exports out of business reads", async ({
  page,
}) => {
  const observed = await setup(page);
  let secondReads = 0;
  let exportReads = 0;
  await page.route(`**/api/v1/tasks/${secondId}`, (route) => {
    secondReads += 1;
    return route.fulfill({ json: env({ ...task, id: secondId, title: "第二项任务" }) });
  });
  await page.route("**/api/v1/report-exports", (route) => {
    exportReads += 1;
    return route.fulfill({ json: env([]) });
  });
  await page.goto("/tasks");
  await page.locator(".task-row-main").filter({ hasText: task.title }).click();
  await expect(page.locator(".task-detail h3")).toHaveText(task.title);
  await page.getByRole("link", { name: "关闭任务详情" }).click();
  await page.locator(".task-row-main").filter({ hasText: "补齐竞品价格证据" }).click();
  await expect(page.locator(".task-detail h3")).toHaveText("第二项任务");
  await settle(page);
  expect(secondReads).toBe(1);
  expect(observed.detailRequests).toBe(1);
  await page.getByRole("link", { name: "关闭任务详情" }).click();
  await expect(page.locator(".task-row-main").first()).toBeVisible();
  const before = observed.listRequests;
  await page.getByRole("button", { name: "导出任务", exact: true }).click();
  await expect(page.getByRole("heading", { name: "尚无导出任务" })).toBeVisible();
  await settle(page);
  expect(exportReads).toBe(1);
  expect(observed.listRequests).toBe(before);
  expect(secondReads).toBe(1);
  await page.getByRole("button", { name: "业务任务", exact: true }).click();
  await expect(page.locator(".task-row-main").first()).toBeVisible();
  await settle(page);
  expect(observed.listRequests).toBe(before + 1);
  expect(exportReads).toBe(1);
});

for (const lateStatus of [200, 403]) {
  test(`UI2-C04 late list ${lateStatus}: old results and errors cannot finish a newer loading state`, async ({
    page,
  }) => {
    await setup(page);
    await page.addInitScript(() => {
      const original = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        return original(
          input,
          url.includes("/api/v1/tasks?") ? { ...init, signal: undefined } : init,
        );
      };
    });
    let releaseOld!: () => void;
    let releaseNew!: () => void;
    const oldGate = new Promise<void>((resolve) => {
      releaseOld = resolve;
    });
    const newGate = new Promise<void>((resolve) => {
      releaseNew = resolve;
    });
    let reads = 0;
    await page.route("**/api/v1/tasks?*", async (route) => {
      reads += 1;
      const old = reads === 1;
      await (old ? oldGate : newGate);
      await route.fulfill({
        status: old ? lateStatus : 200,
        headers: { "x-ui2-list": old ? "old" : "new" },
        json:
          old && lateStatus === 403
            ? {
                error: { code: "forbidden", message: "旧列表拒绝", action_hint: "旧列表拒绝" },
                request_id: "old-list",
                trace_id: "old-list",
              }
            : {
                ...env([{ ...task, title: old ? "旧列表任务" : "当前列表任务" }]),
                meta: { page: 1, page_size: 10, total: old ? 99 : 1 },
              },
      });
    });
    await page.route("**/api/v1/report-exports", (route) => route.fulfill({ json: env([]) }));
    try {
      await page.goto("/tasks");
      await expect.poll(() => reads).toBe(1);
      await page.getByRole("button", { name: "导出任务", exact: true }).click();
      await expect(page.getByRole("heading", { name: "尚无导出任务" })).toBeVisible();
      await page.getByRole("button", { name: "业务任务", exact: true }).click();
      await expect.poll(() => reads).toBe(2);
      const stale = page.waitForResponse((response) => response.headers()["x-ui2-list"] === "old");
      releaseOld();
      await (await stale).finished();
      await settle(page);
      await expect(page.getByText("正在读取任务…", { exact: true })).toBeVisible();
      await expect(page.getByText(/旧列表任务|旧列表拒绝/)).toHaveCount(0);
      releaseNew();
      await expect(page.locator(".task-row-main")).toHaveCount(1);
      await expect(page.locator(".task-row-main")).toContainText("当前列表任务");
      await expect(page.getByLabel("任务分页")).toHaveCount(0);
      expect(reads).toBe(2);
    } finally {
      releaseOld();
      releaseNew();
    }
  });
}
