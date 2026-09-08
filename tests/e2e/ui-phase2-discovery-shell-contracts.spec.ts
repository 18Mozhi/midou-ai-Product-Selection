import { expect, test, type Page, type Route } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === "desktop-chromium")
    await page.setViewportSize({ width: 1440, height: 1000 });
});

const org = "00000000-0000-4000-8000-000000000501";
const workspace = "00000000-0000-4000-8000-000000000502";
const taskId = "00000000-0000-4000-8000-000000000510";
const envelope = (data: unknown, id = "ui2-shared") => ({ data, request_id: id, trace_id: id });
const member = {
  shell: "member",
  organization_id: org,
  workspace_id: workspace,
  organization_name: "隔离组织",
  workspace_name: "隔离工作区",
  roles: ["member"],
  capabilities: ["task:read", "task:create", "notification:read"],
  platform_roles: ["platform_operations_admin"],
  platform_capabilities: [],
  guard_reason: "navigation_member_allowed",
};
const platform = {
  ...member,
  shell: "platform_admin",
  organization_id: null,
  workspace_id: null,
  roles: [],
  capabilities: [],
  platform_capabilities: ["platform:operate"],
  guard_reason: "navigation_platform_allowed",
};
const result = (title: string) => ({
  id: taskId,
  resource_id: taskId,
  resource_type: "task",
  title,
  subtitle: null,
  status: "todo",
  assignee_id: null,
  assignee_name: null,
  route: `/tasks/${taskId}`,
  updated_at: "2026-08-07T15:00:00.000Z",
});
const searchResult = (title: string) =>
  envelope({
    items: [result(title)],
    next_cursor: null,
    scope: { organization_id: org, workspace_id: workspace },
  });
const quickActions = [
  {
    id: "task",
    label: "创建任务",
    description: "进入任务创建页",
    route: "/tasks?create=1",
    required_capability: "task:create",
  },
];

async function setup(page: Page, navigation?: (route: Route, shell: string) => Promise<void>) {
  const navRequests: string[] = [];
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/") && !["GET", "HEAD"].includes(request.method()))
      writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  await page.route("**/api/v1/me/navigation?**", async (route) => {
    const shell = new URL(route.request().url()).searchParams.get("shell") ?? "";
    navRequests.push(shell);
    if (navigation) return navigation(route, shell);
    await route.fulfill({ json: envelope(shell === "platform_admin" ? platform : member) });
  });
  await page.route("**/api/v1/me/ui-preferences", (route) =>
    route.fulfill({ json: envelope({ theme: "deep-ocean", version: 1 }) }),
  );
  await page.route("**/api/v1/me/home-dashboard", (route) =>
    route.fulfill({
      json: envelope({
        actions: [],
        changes: [],
        follows: [],
        health: [],
        scope: { organization_id: org, workspace_id: workspace },
        generated_at: "2026-08-08T00:00:00.000Z",
      }),
    }),
  );
  await page.route("**/api/v1/me/quick-actions?**", (route) =>
    route.fulfill({ json: envelope(quickActions) }),
  );
  await page.goto("/home");
  await expect(page.locator('.role-shell[data-shell="member"]')).toHaveAttribute(
    "data-state",
    "ready",
  );
  return { navRequests, writes };
}

async function openSearch(page: Page) {
  await page.keyboard.press("Control+K");
  const dialog = page.getByRole("dialog", { name: "全局搜索" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function enterPlatform(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) <= 840)
    await page.getByRole("button", { name: "更多", exact: true }).click();
  await page.getByRole("link", { name: "进入管理后台", exact: true }).click();
  await expect(page).toHaveURL(/\/platform-admin$/);
}

async function paint(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function ignoreTransportAbort(page: Page, pathname: string) {
  // Deliver the real intercepted response despite cancellation, testing ownership too.
  await page.addInitScript((path) => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      return original(input, url.includes(path) ? { ...init, signal: undefined } : init);
    };
  }, pathname);
}

for (const entry of ["search", "quick", "notifications"] as const) {
  test(`UI2-DI02 ${entry} navigation closes discovery without creating a business object`, async ({
    page,
  }) => {
    const { writes } = await setup(page);
    await page.route("**/api/v1/me/global-search?**", (route) =>
      route.fulfill({ json: searchResult("隔离目标任务") }),
    );
    if (entry === "quick") {
      await page.getByRole("button", { name: "创建选品", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "快捷创建" });
      await dialog.getByRole("link", { name: /创建任务/ }).click();
      await expect(page).toHaveURL(/\/tasks\?create=1$/);
    } else {
      const dialog = await openSearch(page);
      if (entry === "search") {
        const input = dialog.getByPlaceholder("输入至少 2 个字符");
        await input.fill("隔离目标");
        await input.press("Enter");
        await dialog.getByRole("link", { name: /隔离目标任务/ }).click();
        await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}$`));
      } else {
        await dialog.getByRole("link", { name: "打开通知中心", exact: true }).click();
        await expect(page).toHaveURL(/\/notifications$/);
      }
    }
    await expect(page.locator("dialog.discovery-backdrop")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "创建选品", exact: true })).toBeEnabled();
    expect(writes).toEqual([]);
  });
}

for (const outcome of ["success", "forbidden"] as const) {
  for (const transition of ["new-search", "reopen", "create"] as const) {
    test(`UI2-DI04 ${transition} ignores a late ${outcome} from an older search`, async ({
      page,
    }) => {
      if (transition === "new-search") await ignoreTransportAbort(page, "/me/global-search?");
      const { writes } = await setup(page);
      let oldRoute: Route | undefined;
      let oldTerminal = false;
      const isOld = (url: string) =>
        url.includes("/me/global-search?") && new URL(url).searchParams.get("q") === "旧查询";
      page.on("requestfinished", (request) => {
        if (isOld(request.url())) oldTerminal = true;
      });
      page.on("requestfailed", (request) => {
        if (isOld(request.url())) oldTerminal = true;
      });
      await page.route("**/api/v1/me/global-search?**", async (route) => {
        if (isOld(route.request().url())) {
          oldRoute = route;
          return;
        }
        await route.fulfill({ json: searchResult("当前查询结果") });
      });
      let dialog = await openSearch(page);
      await dialog.getByPlaceholder("输入至少 2 个字符").fill("旧查询");
      await dialog.getByPlaceholder("输入至少 2 个字符").press("Enter");
      await expect.poll(() => Boolean(oldRoute)).toBe(true);
      if (transition !== "new-search") {
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        if (transition === "create") {
          await page.getByRole("button", { name: "创建选品", exact: true }).click();
          dialog = page.getByRole("dialog", { name: "快捷创建" });
          await expect(dialog.getByRole("link", { name: /创建任务/ })).toBeVisible();
        } else dialog = await openSearch(page);
      }
      if (transition !== "create") {
        await dialog.getByPlaceholder("输入至少 2 个字符").fill("当前查询");
        await dialog.getByPlaceholder("输入至少 2 个字符").press("Enter");
        await expect(dialog.getByRole("link", { name: /当前查询结果/ })).toBeVisible();
      }
      await oldRoute!.fulfill(
        outcome === "success"
          ? { json: searchResult("旧响应不得覆盖") }
          : {
              status: 403,
              json: {
                error: { code: "forbidden", message: "旧请求已被拒绝", action_hint: "旧范围拒绝" },
                request_id: "ui2-old-forbidden",
                trace_id: "ui2-old-forbidden",
              },
            },
      );
      await expect.poll(() => oldTerminal).toBe(true);
      await paint(page);
      await expect(
        dialog.getByRole("link", { name: transition === "create" ? /创建任务/ : /当前查询结果/ }),
      ).toBeVisible();
      await expect(dialog.getByText("旧响应不得覆盖", { exact: true })).toHaveCount(0);
      await expect(dialog.getByText("旧范围拒绝", { exact: true })).toHaveCount(0);
      expect(writes).toEqual([]);
    });
  }
}

test("UI2-DI02 Enter on a same-route result closes discovery without adding a route entry", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.goto(`/tasks/${taskId}`);
  await expect(page.locator(".role-shell")).toHaveAttribute("data-state", "ready");
  await page.route("**/api/v1/me/global-search?**", (route) =>
    route.fulfill({ json: searchResult("当前任务") }),
  );
  const dialog = await openSearch(page);
  const historyLength = await page.evaluate(() => history.length);
  await dialog.getByPlaceholder("输入至少 2 个字符").fill("当前任务");
  await dialog.getByPlaceholder("输入至少 2 个字符").press("Enter");
  const link = dialog.getByRole("link", { name: /当前任务/ });
  await link.focus();
  await link.press("Enter");
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  expect(writes).toEqual([]);
});

for (const outcome of ["success", "forbidden"] as const) {
  test(`UI2-SH04 browser return ignores late platform ${outcome}`, async ({ page }) => {
    await ignoreTransportAbort(page, "/me/navigation?");
    let delayed: Route | undefined;
    let oldTerminal = false;
    const isPlatform = (url: string) =>
      url.includes("/me/navigation?") &&
      new URL(url).searchParams.get("shell") === "platform_admin";
    page.on("requestfinished", (request) => {
      if (isPlatform(request.url())) oldTerminal = true;
    });
    const { navRequests } = await setup(page, async (route, shell) => {
      if (shell === "platform_admin") {
        delayed = route;
        return;
      }
      await route.fulfill({ json: envelope(member) });
    });
    await enterPlatform(page);
    await expect.poll(() => Boolean(delayed)).toBe(true);
    await expect(page.locator(".role-shell")).toHaveAttribute("data-state", "loading");
    await page.goBack();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.locator('.role-shell[data-shell="member"]')).toHaveAttribute(
      "data-state",
      "ready",
    );
    expect(navRequests).toEqual(["member", "platform_admin", "member"]);
    await delayed!.fulfill(
      outcome === "success"
        ? { json: envelope(platform, "ui2-old-platform") }
        : {
            status: 403,
            json: {
              error: { code: "forbidden", message: "旧平台请求拒绝", action_hint: "旧请求" },
              request_id: "ui2-old-platform",
              trace_id: "ui2-old-platform",
            },
          },
    );
    await expect.poll(() => oldTerminal).toBe(true);
    await paint(page);
    await expect(page.locator('.role-shell[data-shell="member"]')).toHaveAttribute(
      "data-state",
      "ready",
    );
    await expect(page.getByRole("button", { name: "创建选品", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /无权/ })).toHaveCount(0);
  });
}

for (const allowed of [true, false]) {
  test(`UI2-SH04 same-instance shell switch reloads its ${allowed ? "allowed" : "denied"} server guard`, async ({
    page,
  }) => {
    const { navRequests } = await setup(page, (route, shell) =>
      route.fulfill(
        shell !== "platform_admin" || allowed
          ? { json: envelope(shell === "platform_admin" ? platform : member) }
          : {
              status: 403,
              json: {
                error: {
                  code: "forbidden",
                  message: "平台壳层已拒绝",
                  action_hint: "请联系管理员",
                },
                request_id: "ui2-platform-denied",
                trace_id: "ui2-platform-denied",
              },
            },
      ),
    );
    await enterPlatform(page);
    await expect.poll(() => navRequests).toEqual(["member", "platform_admin"]);
    await expect(page.locator('.role-shell[data-shell="platform_admin"]')).toHaveAttribute(
      "data-state",
      allowed ? "ready" : "forbidden",
    );
    if (allowed) {
      await expect(page.getByRole("heading", { name: "无权打开此页面" })).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "选择组织与工作区后进入用户工作台" }),
      ).toBeAttached();
    } else {
      await expect(page.getByRole("heading", { name: "无权进入此工作台" })).toBeVisible();
      await expect(page.locator(".role-nav-groups")).toHaveCount(0);
    }
  });
}
