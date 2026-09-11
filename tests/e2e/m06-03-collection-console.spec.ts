import { expect, test, type Page } from "@playwright/test";

const envelope = (data: unknown) => ({
  data,
  request_id: "m06-03-e2e",
  trace_id: "m06-03-e2e",
});
const providerId = "00000000-0000-4000-8000-000000000630";
const data = {
  filters: {
    organization_id: null,
    workspace_id: null,
    provider_id: null,
    window: "24h",
    error_code: null,
  },
  source_options: [{ id: providerId, code: "news", name: "公开趋势 RSS" }],
  sources: [
    {
      id: providerId,
      code: "news",
      name: "公开趋势 RSS",
      status: "enabled",
      owner_label: "运营组",
      schedule_minutes: 60,
      concurrency_limit: 1,
      parser_version: "v1",
      health_status: "ready",
      last_checked_at: "2026-08-08T12:00:00Z",
      last_latency_ms: 80,
      last_error_code: null,
      consecutive_failures: 0,
    },
  ],
  task_states: [
    { status: "running", total: 2 },
    { status: "dead_letter", total: 1 },
  ],
  dead_letters: [
    {
      id: "d1",
      task_id: "00000000-0000-4000-8000-000000000631",
      organization_id: "00000000-0000-4000-8000-000000000632",
      workspace_id: "00000000-0000-4000-8000-000000000633",
      error_code: "parser_failed",
      status: "open",
      created_at: "2026-08-08T11:00:00Z",
    },
  ],
  quality: [{ severity: "warning", status: "open", total: 3 }],
  attempts: [
    {
      id: "a1",
      task_id: "00000000-0000-4000-8000-000000000631",
      organization_id: "00000000-0000-4000-8000-000000000632",
      workspace_id: "00000000-0000-4000-8000-000000000633",
      attempt_number: 2,
      worker_id: "worker-1",
      status: "failed_terminal",
      error_code: "parser_failed",
      started_at: "2026-08-08T10:00:00Z",
      finished_at: "2026-08-08T10:01:00Z",
      trace_id: "trace-m0603",
    },
  ],
  root_causes: [
    {
      error_code: "parser_failed",
      total: 1,
      latest_at: "2026-08-08T11:00:00Z",
    },
  ],
  pagination: {
    attempts: { page: 1, page_size: 50, total: 1, total_pages: 1 },
    dead_letters: { page: 1, page_size: 50, total: 1, total_pages: 1 },
  },
  links: {
    provider_registry: "/platform-admin/providers",
    adapter_health: "/platform-admin/providers/adapters",
    source_catalog: "/platform-admin/providers/sources",
    task_monitor: "/platform-admin/collection",
    browser_runtime: "/platform-admin/collection/browser-runtime",
    data_quality: "/platform-admin/data",
  },
  observed_at: "2026-08-08T12:00:00Z",
};

const secondBatchTaskId = "00000000-0000-4000-8000-000000000641";

function batchConsoleData() {
  return {
    ...data,
    dead_letters: [
      data.dead_letters[0],
      {
        ...data.dead_letters[0],
        id: "d2",
        task_id: secondBatchTaskId,
        organization_id: "00000000-0000-4000-8000-000000000642",
        workspace_id: "00000000-0000-4000-8000-000000000643",
        error_code: "timeout",
      },
    ],
  };
}

async function previewTwoItemBatch(page: Page, reason = "解析器已完成固定样本回放") {
  await page.getByText("批量安全重放", { exact: true }).click();
  const panel = page.locator("details").filter({
    has: page.getByRole("button", { name: "预览批量重放" }),
  });
  await panel.getByRole("checkbox").nth(0).check();
  await panel.getByRole("checkbox").nth(1).check();
  await panel.getByPlaceholder("说明恢复条件和重放原因（2–500 字）").fill(reason);
  await panel.getByRole("button", { name: "预览批量重放" }).click();
  return panel;
}

async function acknowledgeAndConfirmBatch(page: Page) {
  await page.getByLabel("我已阅读影响范围，并确认只处理上述对象").check();
  await page.getByPlaceholder("确认重放").fill("确认重放");
  await page.getByRole("button", { name: "确认批量重放", exact: true }).click();
}

async function navigation(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=platform_admin", (route) =>
    route.fulfill({
      json: envelope({
        shell: "platform_admin",
        organization_id: null,
        workspace_id: null,
        roles: [],
        capabilities: [],
        platform_roles: ["platform_operations_admin"],
        platform_capabilities: ["platform:operate"],
        guard_reason: "allowed",
      }),
    }),
  );
}

test("M06-03.A07/A08/A15 filters source and time, drills exact root cause, and renders responsive UI", async ({
  page,
}) => {
  await navigation(page);
  let consoleUrl = "";
  await page.route("**/api/v1/platform/collection/console?**", (route) => {
    consoleUrl = route.request().url();
    return route.fulfill({ json: envelope(data) });
  });
  const startsMobile = (page.viewportSize()?.width ?? 0) <= 760;
  await page.goto("/platform-admin/collection/overview");
  await expect(page.getByRole("heading", { name: "来源与采集控制台", level: 2 })).toBeVisible();
  await expect(
    startsMobile
      ? page.getByRole("button", { name: /公开趋势 RSS/ })
      : page.locator(".collection-ops table").first().getByText("公开趋势 RSS"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "来源配置" })).toBeVisible();
  await expect(page.getByText("provider_registry")).toHaveCount(0);

  if (startsMobile) await page.getByRole("button", { name: "采集范围与时间" }).click();
  await page.getByLabel("采集来源筛选").selectOption(providerId);
  await page.getByLabel("观测时间筛选").selectOption("7d");
  await page.getByRole("button", { name: "应用范围" }).click();
  await expect.poll(() => consoleUrl).toContain(`provider_id=${providerId}`);
  expect(consoleUrl).toContain("window=7d");
  await expect(page).toHaveURL(new RegExp(`provider_id=${providerId}`));
  await expect(page).toHaveURL(/window=7d/);

  await page
    .locator(".collection-root-causes")
    .getByRole("button", { name: /页面解析失败/ })
    .click();
  await expect.poll(() => consoleUrl).toContain("error_code=parser_failed");
  await expect(page).toHaveURL(/error_code=parser_failed/);
  await expect(
    startsMobile
      ? page.getByRole("button", { name: /第 2 次尝试 · 终止失败/ })
      : page.getByRole("cell", { name: "终止失败" }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText("最近尝试")).toBeVisible();
  await page.getByRole("button", { name: "采集范围与时间" }).click();
  await expect(page.getByRole("button", { name: "应用范围" })).toHaveCSS("white-space", "nowrap");
  await page
    .locator(".responsive-filter-drawer__sheet > header")
    .getByRole("button", { name: "关闭筛选条件" })
    .click();
  const attemptCard = page.getByRole("button", { name: /第 2 次尝试/ });
  await expect(attemptCard).toBeVisible();
  await attemptCard.click();
  const attemptDrawer = page.getByRole("dialog", { name: "第 2 次尝试详情" });
  await expect(attemptDrawer).toBeVisible();
  await attemptDrawer.getByText("技术详情", { exact: true }).click();
  await expect(attemptDrawer.getByText(data.attempts[0].task_id, { exact: false })).toBeVisible();
  await attemptDrawer.getByRole("button", { name: "关闭详情" }).click();
});

test("UI2-CL52 isolates the overview while batch confirmation owns focus", async ({ page }) => {
  await navigation(page);
  await page.route("**/api/v1/platform/collection/console?**", (route) =>
    route.fulfill({ json: envelope(batchConsoleData()) }),
  );
  await page.goto("/platform-admin/collection/overview");

  const panel = await previewTwoItemBatch(page);
  const overview = page.locator(".collection-ops");
  const dialog = page.getByRole("alertdialog", { name: "确认批量重放开放死信？" });
  const cancel = dialog.getByRole("button", { name: "取消" });
  await expect(dialog).toBeVisible();
  await expect(overview).toHaveAttribute("inert", "");
  await expect(cancel).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByPlaceholder("确认重放")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(overview).not.toHaveAttribute("inert", "");
  await expect(panel.getByRole("button", { name: "预览批量重放" })).toBeFocused();
});

test("UI2-CL52 associates source disclosure and batch reason validation", async ({ page }) => {
  await navigation(page);
  const expandedSources = Array.from({ length: 9 }, (_, index) => ({
    ...data.sources[0],
    id: `00000000-0000-4000-8000-${String(730 + index).padStart(12, "0")}`,
    name: `关联来源 ${index + 1}`,
  }));
  await page.route("**/api/v1/platform/collection/console?**", (route) =>
    route.fulfill({ json: envelope({ ...batchConsoleData(), sources: expandedSources }) }),
  );
  await page.goto("/platform-admin/collection/overview");

  const disclosure = page.getByRole("button", { name: /查看全部 9 个来源/ });
  await expect(disclosure).toHaveAttribute("aria-controls", "collection-source-results");
  await expect(page.locator("#collection-source-results")).toBeVisible();

  await page.getByText("批量安全重放", { exact: true }).click();
  const panel = page.locator("details").filter({
    has: page.getByRole("button", { name: "预览批量重放" }),
  });
  await panel.getByRole("checkbox").first().check();
  const reason = panel.getByLabel("批量重放原因");
  await panel.getByRole("button", { name: "预览批量重放" }).click();

  await expect(reason).toHaveAttribute("aria-invalid", "true");
  await expect(reason).toHaveAttribute(
    "aria-describedby",
    "collection-batch-reason-help collection-batch-reason-error",
  );
  await expect(panel.getByText("重放原因需要 2–500 字符。", { exact: true })).toBeVisible();
  await expect(reason).toBeFocused();

  await reason.fill("解析器已完成固定样本回放");
  await expect(reason).not.toHaveAttribute("aria-invalid", "true");
  await expect(reason).toHaveAttribute("aria-describedby", "collection-batch-reason-help");
  await expect(panel.getByText("重放原因需要 2–500 字符。", { exact: true })).toHaveCount(0);
});

test("UI2-CL52 preserves responsive record focus isolation and return", async ({ page }) => {
  await navigation(page);
  await page.route("**/api/v1/platform/collection/console?**", (route) =>
    route.fulfill({ json: envelope(data) }),
  );
  await page.goto("/platform-admin/collection/overview");

  if ((page.viewportSize()?.width ?? 0) > 760) {
    await expect(page.getByRole("cell", { name: "第 2 次" })).toBeVisible();
    return;
  }

  const trigger = page.getByRole("button", { name: /第 2 次尝试/ });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "第 2 次尝试详情" });
  const close = drawer.getByRole("button", { name: "关闭详情" });
  const technicalDetails = drawer.locator("summary", { hasText: "技术详情" });
  await expect(drawer).toBeVisible();
  await expect(page.locator("#app")).toHaveAttribute("inert", "");
  await expect(close).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(technicalDetails).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(page.locator("#app")).not.toHaveAttribute("inert", "");
  await expect(trigger).toBeFocused();
});

test("M06-03 distinguishes network login captcha and parser alert categories", async ({ page }) => {
  await navigation(page);
  await page.route("**/api/v1/platform/collection/console?**", (route) =>
    route.fulfill({
      json: envelope({
        ...data,
        root_causes: ["network_error", "login_required", "captcha", "parser_failed"].map(
          (error_code, index) => ({
            error_code,
            total: index + 1,
            latest_at: "2026-08-08T11:00:00Z",
          }),
        ),
      }),
    }),
  );

  await page.goto("/platform-admin/collection/overview");
  for (const category of ["网络", "登录", "验证码", "解析"])
    await expect(page.getByText(`告警类别：${category}`, { exact: true })).toBeVisible();
});

test("collection overview prioritizes unhealthy sources and keeps the complete catalog reachable", async ({
  page,
}) => {
  await navigation(page);
  const sources = Array.from({ length: 14 }, (_, index) => ({
    ...data.sources[0],
    id: `00000000-0000-4000-8000-${String(700 + index).padStart(12, "0")}`,
    code: `source_${index + 1}`,
    name: index === 13 ? "采集受阻来源 14" : `尚未检查来源 ${index + 1}`,
    health_status: index === 13 ? "blocked" : "unknown",
    consecutive_failures: index === 13 ? 5 : 0,
    last_checked_at: index === 13 ? "2026-08-08T12:00:00Z" : null,
  }));
  await page.route("**/api/v1/platform/collection/console?**", (route) =>
    route.fulfill({ json: envelope({ ...data, sources }) }),
  );

  await page.goto("/platform-admin/collection/overview");
  const sourceSection = page.getByRole("heading", { name: "来源与健康" }).locator("../..");
  const mobile = (page.viewportSize()?.width ?? 0) <= 760;
  const sourceName = (name: string) =>
    mobile
      ? sourceSection.locator(".responsive-data-view__mobile strong").filter({ hasText: name })
      : sourceSection.locator("tbody b").filter({ hasText: name });
  await expect(sourceName("采集受阻来源 14")).toBeVisible();
  await expect(sourceName("尚未检查来源 13")).toBeHidden();
  const visibleRows = mobile
    ? sourceSection.locator(".responsive-data-view__mobile article:visible")
    : sourceSection.locator("tbody tr");
  await expect(visibleRows).toHaveCount(8);
  await sourceSection.getByRole("button", { name: /查看全部 14 个来源/ }).click();
  await expect(visibleRows).toHaveCount(14);
  await expect(sourceName("尚未检查来源 13")).toBeVisible();
  await sourceSection.getByRole("button", { name: /收起来源/ }).click();
  await expect(visibleRows).toHaveCount(8);
});

test("M06-03.A17 batch safely replays explicitly selected open dead letters", async ({ page }) => {
  const batchData = batchConsoleData();
  const replays: Array<{ url: string; key: string; body: { reason: string } }> = [];

  await navigation(page);
  await page.route("**/api/v1/platform/collection/console?**", (route) =>
    route.fulfill({ json: envelope(batchData) }),
  );
  await page.route("**/api/v1/platform/collection/tasks/*/replay", async (route) => {
    const request = route.request();
    replays.push({
      url: request.url(),
      key: request.headers()["idempotency-key"] ?? "",
      body: request.postDataJSON(),
    });
    await route.fulfill({
      json: envelope({ task: { id: "00000000-0000-4000-8000-000000000650" } }),
    });
  });

  await page.goto("/platform-admin/collection/overview");
  await page.getByText("批量安全重放").click();
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await page
    .getByPlaceholder("说明恢复条件和重放原因（2–500 字）")
    .fill("解析器已完成固定样本回放");
  await page.getByRole("button", { name: "预览批量重放" }).click();

  await expect(page.getByRole("heading", { name: "确认批量重放开放死信？" })).toBeVisible();
  await expect(page.getByText(/2 条开放死信；2 个组织；2 个工作区/)).toBeVisible();
  await expect(page.getByText(/页面解析失败 1 条/)).toBeVisible();
  await expect(page.getByText(/请求超时 1 条/)).toBeVisible();
  await page.getByLabel("我已阅读影响范围，并确认只处理上述对象").check();
  await page.getByPlaceholder("确认重放").fill("确认重放");
  await page.getByRole("button", { name: "确认批量重放", exact: true }).evaluate((button) => {
    button.click();
    button.click();
  });

  await expect.poll(() => replays.length).toBe(2);
  await expect(
    page.getByText(
      /本批请求已结束：创建新任务 2 条，明确失败 0 条，结果未知 0 条。不是采集执行成功。/,
    ),
  ).toBeVisible();
  expect(replays.map((replay) => replay.body.reason)).toEqual([
    "解析器已完成固定样本回放",
    "解析器已完成固定样本回放",
  ]);
  expect(new Set(replays.map((replay) => replay.key)).size).toBe(2);
  for (const replay of replays) {
    expect(replay.key).toMatch(/^dead-batch:[0-9a-f-]{36}:[0-9a-f-]{36}$/);
  }
  expect(replays[0].url).toContain(data.dead_letters[0].task_id);
  expect(replays[1].url).toContain(secondBatchTaskId);
});

test("UI2-CL52 freezes batch targets reason impact and identifiers when preview opens", async ({
  page,
}) => {
  const replays: Array<{ url: string; key: string; body: { reason: string } }> = [];
  await navigation(page);
  await page.route("**/api/v1/platform/collection/console?**", (route) =>
    route.fulfill({ json: envelope(batchConsoleData()) }),
  );
  await page.route("**/api/v1/platform/collection/tasks/*/replay", async (route) => {
    const request = route.request();
    replays.push({
      url: request.url(),
      key: request.headers()["idempotency-key"] ?? "",
      body: request.postDataJSON(),
    });
    await route.fulfill({
      json: envelope({ task: { id: "00000000-0000-4000-8000-000000000650" } }),
    });
  });
  await page.goto("/platform-admin/collection/overview");
  const panel = await previewTwoItemBatch(page, "  固定恢复原因  ");
  await expect(page.getByText(/2 条开放死信；2 个组织；2 个工作区/)).toBeVisible();

  await panel
    .getByRole("checkbox")
    .nth(1)
    .evaluate((element) => {
      const input = element as HTMLInputElement;
      input.checked = false;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  await panel.getByPlaceholder("说明恢复条件和重放原因（2–500 字）").evaluate((element) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.value = "确认之后被修改的原因";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.getByText(/2 条开放死信；2 个组织；2 个工作区/)).toBeVisible();
  await acknowledgeAndConfirmBatch(page);

  await expect.poll(() => replays.length).toBe(2);
  expect(replays.map((replay) => replay.body.reason)).toEqual(["固定恢复原因", "固定恢复原因"]);
  expect(replays[0].url).toContain(data.dead_letters[0].task_id);
  expect(replays[1].url).toContain(secondBatchTaskId);
  expect(new Set(replays.map((replay) => replay.key)).size).toBe(2);
});

test("UI2-CL52 continues a frozen batch after an unknown result and prevents automatic replay", async ({
  page,
}) => {
  let posts = 0;
  await navigation(page);
  await page.route("**/api/v1/platform/collection/console?**", (route) =>
    route.fulfill({ json: envelope(batchConsoleData()) }),
  );
  await page.route("**/api/v1/platform/collection/tasks/*/replay", async (route) => {
    posts += 1;
    if (posts === 1) return route.abort("connectionfailed");
    return route.fulfill({
      json: envelope({ task: { id: "00000000-0000-4000-8000-000000000650" } }),
    });
  });
  await page.goto("/platform-admin/collection/overview");
  const panel = await previewTwoItemBatch(page);
  await acknowledgeAndConfirmBatch(page);

  await expect.poll(() => posts).toBe(2);
  await expect(
    page.getByText(
      /本批请求已结束：创建新任务 1 条，明确失败 0 条，结果未知 1 条。不是采集执行成功。/,
    ),
  ).toBeVisible();
  await expect(page.getByText("查看失败或未知条目（1）")).toBeVisible();
  await expect(panel.getByRole("button", { name: "预览批量重放" })).toBeDisabled();
  await expect(panel.getByText(/已有结果未知，请先到对应任务核查/)).toBeVisible();
});

test("UI2-CL52 separates partial replay settlement from a failed verification read", async ({
  page,
}) => {
  let reads = 0;
  let posts = 0;
  await navigation(page);
  await page.route("**/api/v1/platform/collection/console?**", (route) => {
    reads += 1;
    if (reads === 1) return route.fulfill({ json: envelope(batchConsoleData()) });
    return route.fulfill({
      status: 500,
      json: {
        error: {
          code: "verification_read_failed",
          message: "当前事实读取失败。",
          action_hint: "请稍后重新读取当前事实。",
        },
        request_id: "cl52-read-failed",
      },
    });
  });
  await page.route("**/api/v1/platform/collection/tasks/*/replay", async (route) => {
    posts += 1;
    if (posts === 1)
      return route.fulfill({
        json: envelope({ task: { id: "00000000-0000-4000-8000-000000000650" } }),
      });
    return route.fulfill({
      status: 409,
      json: {
        error: {
          code: "dead_letter_changed",
          message: "死信状态已经变化。",
          action_hint: "请重新读取后核对该任务。",
        },
        request_id: "cl52-explicit-failure",
      },
    });
  });
  await page.goto("/platform-admin/collection/overview");
  const panel = await previewTwoItemBatch(page);
  await acknowledgeAndConfirmBatch(page);

  await expect.poll(() => posts).toBe(2);
  await expect(
    page.getByText(
      /本批请求已结束：创建新任务 1 条，明确失败 1 条，结果未知 0 条。不是采集执行成功。/,
    ),
  ).toBeVisible();
  await expect(page.getByText("查看失败或未知条目（1）")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("请稍后重新读取当前事实");
  await expect(panel.getByText("已选择 1 / 20 条")).toBeVisible();
});

test("UI2-CL52 defers detached batch reconciliation until KeepAlive return", async ({ page }) => {
  let overviewReads = 0;
  const overviewQueries: string[] = [];
  let posts = 0;
  let releaseFirst!: () => void;
  const heldFirst = new Promise<void>((resolve) => (releaseFirst = resolve));
  let firstStarted!: () => void;
  const enteredFirst = new Promise<void>((resolve) => (firstStarted = resolve));
  await navigation(page);
  await page.route("**/api/v1/platform/collection/console?**", (route) => {
    overviewReads += 1;
    overviewQueries.push(new URL(route.request().url()).search);
    return route.fulfill({ json: envelope(batchConsoleData()) });
  });
  await page.route("**/api/v1/platform/collection/tasks?**", (route) =>
    route.fulfill({
      json: { data: [], meta: { page: 1, page_size: 50, total: 0 }, request_id: "cl52-tasks" },
    }),
  );
  await page.route("**/api/v1/platform/collection/tasks/*/replay", async (route) => {
    posts += 1;
    if (posts === 1) {
      firstStarted();
      await heldFirst;
    }
    try {
      await route.fulfill({
        json: envelope({ task: { id: "00000000-0000-4000-8000-000000000650" } }),
      });
    } catch (error) {
      if (!route.request().failure()) throw error;
    }
  });
  await page.goto("/platform-admin/collection/overview");
  await previewTwoItemBatch(page);
  await acknowledgeAndConfirmBatch(page);
  await enteredFirst;
  await page.getByRole("link", { name: "任务详情", exact: true }).click();
  await expect(page).toHaveURL(/\/platform-admin\/collection$/);
  releaseFirst();
  await expect.poll(() => posts).toBe(2);
  await page.waitForTimeout(150);
  expect(overviewReads).toBe(1);

  await page.evaluate(() => {
    history.pushState({}, "", "/platform-admin/collection/overview?window=7d");
    window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
  });
  await expect(page).toHaveURL(/\/platform-admin\/collection\/overview\?window=7d$/);
  await expect.poll(() => overviewReads).toBe(2);
  expect(overviewQueries.at(-1)).toContain("window=7d");
  await expect(
    page.getByText(
      /本批请求已结束：创建新任务 2 条，明确失败 0 条，结果未知 0 条。不是采集执行成功。/,
    ),
  ).toBeVisible();
});

test("M06-03 pages complete attempt and dead-letter facts and preserves verified data on refresh failure", async ({
  page,
}) => {
  await navigation(page);
  let status = 200;
  let reads = 0;
  const paged = {
    ...data,
    sources: [{ ...data.sources[0], health_status: "blocked" }],
    pagination: {
      attempts: { page: 1, page_size: 50, total: 66, total_pages: 2 },
      dead_letters: { page: 1, page_size: 50, total: 58, total_pages: 2 },
    },
  };
  await page.route("**/api/v1/platform/collection/console?**", (route) => {
    reads += 1;
    if (status !== 200)
      return route.fulfill({
        status,
        json: envelope({ error: { action_hint: "请稍后重试" } }),
      });
    return route.fulfill({ json: envelope(paged) });
  });

  await page.goto("/platform-admin/collection/overview?window=all");
  if ((page.viewportSize()?.width ?? 0) <= 760)
    await expect(page.getByRole("button", { name: /公开趋势 RSS.*采集受阻/ })).toBeVisible();
  else await expect(page.getByText("采集受阻", { exact: true })).toBeVisible();
  await expect(page.getByText("1–50 / 66 条", { exact: true })).toBeVisible();
  await expect(page.getByText("1–50 / 58 条", { exact: true })).toBeVisible();
  await page
    .getByRole("navigation", { name: "最近尝试分页" })
    .getByRole("button", { name: "下一页" })
    .click();
  await expect(page).toHaveURL(/attempt_page=2/);

  const beforeDuplicate = reads;
  const mobile = (page.viewportSize()?.width ?? 0) <= 760;
  if (mobile) await page.getByRole("button", { name: "采集范围与时间" }).click();
  await page.getByRole("button", { name: "应用范围" }).evaluate((button) => {
    button.click();
    button.click();
  });
  await expect.poll(() => reads).toBe(beforeDuplicate + 1);
  if (mobile) {
    const closeFilter = page
      .locator(".responsive-filter-drawer__sheet > header")
      .getByRole("button", { name: "关闭筛选条件" });
    if (await closeFilter.isVisible().catch(() => false)) await closeFilter.click();
  }

  status = 503;
  await page.getByRole("button", { name: "刷新数据" }).click();
  await expect(page.getByRole("heading", { name: "来源与健康" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("当前已验证数据仍保留");
});

test("M06-03.A08/A16 empty forbidden blocked", async ({ page }) => {
  await navigation(page);
  let status = 200;
  await page.route("**/api/v1/platform/collection/console?**", (route) =>
    route.fulfill(
      status === 200
        ? {
            json: envelope({
              ...data,
              sources: [],
              task_states: [],
              dead_letters: [],
              quality: [],
              attempts: [],
              root_causes: [],
            }),
          }
        : {
            status,
            contentType: "application/json",
            body: JSON.stringify({
              error: { action_hint: "按状态恢复" },
              request_id: `m06-03-${status}`,
              trace_id: "x",
            }),
          },
    ),
  );
  await page.goto("/platform-admin/collection/overview");
  await expect(page.getByRole("heading", { name: "当前范围没有采集事实" })).toBeVisible();
  status = 403;
  await page.reload();
  await expect(page.getByRole("heading", { name: "你没有此项权限" })).toBeVisible();
  status = 503;
  await page.reload();
  await expect(page.getByRole("heading", { name: "采集控制台依赖受阻" })).toBeVisible();
});

test("UI2-CL52 restores every supported filter and page from same-route history", async ({
  page,
}) => {
  await navigation(page);
  const requests: string[] = [];
  await page.route("**/api/v1/platform/collection/console?**", (route) => {
    const url = new URL(route.request().url());
    requests.push(url.search);
    const attemptPage = Number(url.searchParams.get("attempt_page") ?? 1);
    const deadLetterPage = Number(url.searchParams.get("dead_letter_page") ?? 1);
    return route.fulfill({
      json: envelope({
        ...data,
        pagination: {
          attempts: { page: attemptPage, page_size: 50, total: 200, total_pages: 4 },
          dead_letters: { page: deadLetterPage, page_size: 50, total: 200, total_pages: 4 },
        },
      }),
    });
  });
  await page.goto("/platform-admin/collection/overview");
  await expect(page.getByRole("heading", { name: "来源与采集控制台", level: 2 })).toBeVisible();
  const historyQuery = new URLSearchParams({
    organization_id: "00000000-0000-4000-8000-000000000632",
    workspace_id: "00000000-0000-4000-8000-000000000633",
    provider_id: providerId,
    window: "7d",
    error_code: "timeout",
    attempt_page: "2",
    dead_letter_page: "3",
  });
  await page.evaluate((query) => {
    history.pushState({}, "", `/platform-admin/collection/overview?${query}`);
    window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
  }, historyQuery.toString());
  await expect(page.getByLabel("组织内部编号筛选")).toHaveValue(
    "00000000-0000-4000-8000-000000000632",
  );
  await expect(page.getByLabel("工作区内部编号筛选")).toHaveValue(
    "00000000-0000-4000-8000-000000000633",
  );
  await expect(page.getByLabel("采集来源筛选")).toHaveValue(providerId);
  await expect(page.getByLabel("观测时间筛选")).toHaveValue("7d");
  await expect
    .poll(() => requests.some((query) => query.includes("error_code=timeout")))
    .toBe(true);
  await expect(page.getByRole("navigation", { name: "最近尝试分页" })).toContainText("第 2 / 4 页");
  await expect(page.getByRole("navigation", { name: "死信记录分页" })).toContainText("第 3 / 4 页");
});

test("UI2-CL52 same-route history supersedes an older pending overview read", async ({ page }) => {
  await navigation(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  let started!: () => void;
  const entered = new Promise<void>((resolve) => (started = resolve));
  let reads = 0;
  await page.route("**/api/v1/platform/collection/console?**", async (route) => {
    const read = ++reads;
    const url = new URL(route.request().url());
    if (read === 2) {
      started();
      await held;
    }
    try {
      await route.fulfill({
        json: envelope({
          ...data,
          sources:
            url.searchParams.get("window") === "7d"
              ? [{ ...data.sources[0], name: "七日范围来源" }]
              : data.sources,
        }),
      });
    } catch (error) {
      if (!route.request().failure()) throw error;
    }
  });
  await page.goto("/platform-admin/collection/overview");
  await page.getByRole("button", { name: "刷新数据" }).click();
  await entered;
  await page.evaluate(() => {
    history.pushState({}, "", "/platform-admin/collection/overview?window=7d");
    window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
  });
  try {
    await expect.poll(() => reads).toBeGreaterThanOrEqual(3);
  } finally {
    release();
  }
  await expect(page.getByLabel("观测时间筛选")).toHaveValue("7d");
  const sourceSection = page.getByRole("heading", { name: "来源与健康" }).locator("../..");
  const sourceName =
    (page.viewportSize()?.width ?? 0) <= 760
      ? sourceSection
          .locator(".responsive-data-view__mobile strong")
          .filter({ hasText: "七日范围来源" })
      : sourceSection.locator("tbody b").filter({ hasText: "七日范围来源" });
  await expect(sourceName).toBeVisible();
});

test("UI2-CL52 resumes an overview read interrupted by KeepAlive deactivation", async ({
  page,
}) => {
  await navigation(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  let started!: () => void;
  const entered = new Promise<void>((resolve) => (started = resolve));
  let reads = 0;
  await page.route("**/api/v1/platform/collection/console?**", async (route) => {
    const read = ++reads;
    if (read === 2) {
      started();
      await held;
    }
    try {
      await route.fulfill({
        json: envelope({
          ...data,
          sources: read >= 3 ? [{ ...data.sources[0], name: "返回续读来源" }] : data.sources,
        }),
      });
    } catch (error) {
      if (!route.request().failure()) throw error;
    }
  });
  await page.route("**/api/v1/platform/collection/tasks?**", (route) =>
    route.fulfill({
      json: { data: [], meta: { page: 1, page_size: 50, total: 0 }, request_id: "cl52-task" },
    }),
  );
  await page.goto("/platform-admin/collection/overview");
  await page.getByRole("button", { name: "刷新数据" }).click();
  await entered;
  await page.getByRole("link", { name: "任务详情", exact: true }).click();
  await expect(page).toHaveURL(/\/platform-admin\/collection$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/platform-admin\/collection\/overview$/);
  try {
    await expect.poll(() => reads).toBeGreaterThanOrEqual(3);
  } finally {
    release();
  }
  const sourceSection = page.getByRole("heading", { name: "来源与健康" }).locator("../..");
  const sourceName =
    (page.viewportSize()?.width ?? 0) <= 760
      ? sourceSection
          .locator(".responsive-data-view__mobile strong")
          .filter({ hasText: "返回续读来源" })
      : sourceSection.locator("tbody b").filter({ hasText: "返回续读来源" });
  await expect(sourceName).toBeVisible();
});

test("UI2-CL52 renders an attempts-only response as factual ready content", async ({ page }) => {
  await navigation(page);
  await page.route("**/api/v1/platform/collection/console?**", (route) =>
    route.fulfill({
      json: envelope({
        ...data,
        sources: [],
        task_states: [],
        dead_letters: [],
        quality: [],
        root_causes: [],
      }),
    }),
  );
  await page.goto("/platform-admin/collection/overview");
  await expect(page.getByRole("heading", { name: "当前范围没有采集事实" })).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 0) <= 760) {
    await expect(page.getByRole("button", { name: /第 2 次尝试 · 终止失败/ })).toBeVisible();
  } else {
    await expect(page.getByRole("cell", { name: "第 2 次" })).toBeVisible();
  }
});

for (const sourceCount of [0, 1, 8, 9]) {
  test(`UI2-CL52 source health empty state matches ${sourceCount} records`, async ({ page }) => {
    await navigation(page);
    const sources = Array.from({ length: sourceCount }, (_, index) => ({
      ...data.sources[0],
      id: `00000000-0000-4000-8000-${String(630 + index).padStart(12, "0")}`,
      name: `隔离来源 ${index + 1}`,
    }));
    await page.route("**/api/v1/platform/collection/console?**", (route) =>
      route.fulfill({ json: envelope({ ...data, sources }) }),
    );
    await page.goto("/platform-admin/collection/overview");
    const section = page
      .locator(".collection-ops-grid > section")
      .filter({ has: page.getByRole("heading", { name: "来源与健康", exact: true }) });
    await expect(section).toContainText(`共 ${sourceCount} 个`);
    await expect(section.getByText("当前范围没有来源健康记录。", { exact: true })).toHaveCount(
      sourceCount === 0 ? 1 : 0,
    );
    const visibleRegion = section.locator(
      (page.viewportSize()?.width ?? 1000) <= 760
        ? ".responsive-data-view__mobile"
        : ".responsive-data-view__desktop",
    );
    if (sourceCount > 0)
      await expect(visibleRegion.getByText("隔离来源 1", { exact: true })).toBeVisible();
    if (sourceCount === 9) {
      await section.getByRole("button", { name: /查看全部 9 个来源/ }).click();
      await expect(visibleRegion.getByText("隔离来源 9", { exact: true })).toBeVisible();
      await section.getByRole("button", { name: /收起来源/ }).click();
      await expect(visibleRegion.getByText("隔离来源 9", { exact: true })).toHaveCount(0);
    } else await expect(section.getByRole("button", { name: /查看全部/ })).toHaveCount(0);
  });
}
