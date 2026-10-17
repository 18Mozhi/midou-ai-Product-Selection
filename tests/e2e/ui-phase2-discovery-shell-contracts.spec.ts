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
for (const entry of ["search", "notifications"] as const) {
  test(`UI2-DI02 ${entry} navigation closes discovery without creating a business object`, async ({
    page,
  }) => {
    const { writes } = await setup(page);
    await page.route("**/api/v1/me/global-search?**", (route) =>
      route.fulfill({ json: searchResult("隔离目标任务") }),
    );
    {
      const dialog = await openSearch(page);
      if (entry === "search") {
        const input = dialog.getByPlaceholder("输入至少 2 个字符");
        await input.fill("隔离目标");
        await input.press("Enter");
        await dialog.getByRole("link", { name: /隔离目标任务/ }).click();
        await expect(page).toHaveURL(new RegExp(`/tasks/${taskId}$`));
      } else {
        await dialog.getByRole("link", { name: "查看通知", exact: true }).click();
        await expect(page).toHaveURL(/\/notifications$/);
      }
    }
    await expect(page.locator("dialog.discovery-c-backdrop")).not.toBeVisible();
    await expect(
      page.locator(".role-top-actions").getByRole("button", { name: "全局搜索", exact: true }),
    ).toBeEnabled();
    expect(writes).toEqual([]);
  });
}
for (const outcome of ["success", "forbidden"] as const) {
  for (const transition of ["new-search", "reopen"] as const) {
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
        dialog = await openSearch(page);
      }
      {
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
      await expect(dialog.getByRole("link", { name: /当前查询结果/ })).toBeVisible();
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
    await expect(
      page.locator(".role-top-actions").getByRole("button", { name: "全局搜索", exact: true }),
    ).toBeVisible();
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
      if ((page.viewportSize()?.width ?? 1440) <= 840)
        await page.getByRole("button", { name: "打开导航菜单" }).click();
      await expect(
        page.getByRole("link", { name: "选择组织与工作区后进入用户工作台" }),
      ).toBeAttached();
    } else {
      await expect(page.getByRole("heading", { name: "无权进入此工作台" })).toBeVisible();
      await expect(page.locator(".role-nav-groups")).toHaveCount(0);
    }
  });
}
{
  for (const dismissal of ["escape", "close", "backdrop"] as const) {
    test(`UI2-DI03 search ${dismissal} restores its opening focus without navigation`, async ({
      page,
    }) => {
      const { writes } = await setup(page);
      const trigger = page
        .locator(".role-top-actions")
        .getByRole("button", { name: "全局搜索", exact: true });
      await trigger.focus();
      await openSearch(page);
      const dialog = page.getByRole("dialog", {
        name: "全局搜索",
      });
      await expect(dialog).toBeVisible();
      if (dismissal === "escape") await page.keyboard.press("Escape");
      else if (dismissal === "close")
        await dialog.getByRole("button", { name: "关闭", exact: true }).click();
      else await dialog.click({ position: { x: 2, y: 2 } });
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      await expect(page).toHaveURL(/\/home$/);
      expect(writes).toEqual([]);
    });
  }
  test(`UI2-DI03 search initial focus and forward/reverse Tab remain inside the modal`, async ({
    page,
  }) => {
    const { writes } = await setup(page);
    const trigger = page
      .locator(".role-top-actions")
      .getByRole("button", { name: "全局搜索", exact: true });
    await trigger.focus();
    await openSearch(page);
    const dialog = page.getByRole("dialog", {
      name: "全局搜索",
    });
    const first = dialog.getByRole("button", { name: "关闭", exact: true });
    const last = dialog.getByRole("link", { name: "查看通知", exact: true });
    await expect(dialog.getByPlaceholder("输入至少 2 个字符")).toBeFocused();
    await first.focus();
    await first.press("Shift+Tab");
    await expect(last).toBeFocused();
    await last.press("Tab");
    await expect(first).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    expect(writes).toEqual([]);
  });
  test(`UI2-DI03 search inner pointer interaction keeps the modal and normal focus`, async ({
    page,
  }) => {
    const { writes } = await setup(page);
    await openSearch(page);
    const dialog = page.getByRole("dialog", {
      name: "全局搜索",
    });
    await dialog.getByRole("heading").first().click();
    await expect(dialog).toBeVisible();
    {
      const input = dialog.getByPlaceholder("输入至少 2 个字符");
      await input.click();
      await expect(input).toBeFocused();
      await input.fill("未提交的查询");
      await expect(input).toHaveValue("未提交的查询");
    }
    await expect(page).toHaveURL(/\/home$/);
    expect(writes).toEqual([]);
  });
}
test("UI2-DI01 search textbox has a meaningful accessible name", async ({ page }) => {
  await setup(page);
  const dialog = await openSearch(page);
  await expect(dialog.getByPlaceholder("输入至少 2 个字符")).toHaveAccessibleName("搜索关键词");
});
for (const value of ["", "字", "   "]) {
  test(`UI2-DI01 short query ${JSON.stringify(value)} has a linked local error and sends no request`, async ({
    page,
  }) => {
    const { writes } = await setup(page);
    let requests = 0;
    await page.route("**/api/v1/me/global-search?**", (route) => {
      requests += 1;
      return route.fulfill({ json: searchResult("不应请求") });
    });
    const dialog = await openSearch(page);
    const input = dialog.getByRole("textbox", { name: "搜索关键词" });
    await input.fill(value);
    await input.press("Enter");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    const description = await input.getAttribute("aria-describedby");
    expect(description).toBeTruthy();
    await expect(dialog.locator(`[id="${description}"]`)).toHaveText("请输入至少 2 个字符后搜索。");
    await expect(dialog.locator(".ui-state-panel")).toHaveCount(0);
    await expect(input).toBeFocused();
    expect(requests).toBe(0);
    expect(writes).toEqual([]);
  });
}
test("UI2-DI01 valid resubmission clears the linked error and earlier request identifiers", async ({
  page,
}) => {
  const { writes } = await setup(page);
  let requests = 0;
  await page.route("**/api/v1/me/global-search?**", (route) => {
    requests += 1;
    if (requests === 1)
      return route.fulfill({
        status: 403,
        json: {
          error: { code: "forbidden", message: "拒绝", action_hint: "旧请求提示" },
          request_id: "ui2-old-invalid",
          trace_id: "ui2-old-trace",
        },
      });
    return route.fulfill({ json: searchResult("修正后的结果") });
  });
  const dialog = await openSearch(page);
  const input = dialog.getByRole("textbox", { name: "搜索关键词" });
  await input.fill("旧请求");
  await input.press("Enter");
  await expect(dialog.getByText("ui2-old-invalid", { exact: true })).toBeVisible();
  await input.fill("字");
  await input.press("Enter");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByText("ui2-old-invalid", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("旧请求提示", { exact: true })).toHaveCount(0);
  expect(requests).toBe(1);
  await input.fill("修正查询");
  await input.press("Enter");
  await expect(dialog.getByRole("link", { name: /修正后的结果/ })).toBeVisible();
  await expect(input).not.toHaveAttribute("aria-invalid", "true");
  await expect(input).not.toHaveAttribute("aria-describedby", "discovery-query-error");
  await expect(dialog.locator("#discovery-query-error")).toHaveCount(0);
  expect(requests).toBe(2);
  expect(writes).toEqual([]);
});
for (const shortcut of ["Control+K", "Meta+K"]) {
  test(`UI2-DI06 ${shortcut} reuses member search and is inactive in the platform shell`, async ({
    page,
  }) => {
    await setup(page);
    const trigger = page
      .locator(".role-top-actions")
      .getByRole("button", { name: "全局搜索", exact: true });
    await trigger.focus();
    await page.keyboard.press(shortcut);
    const dialog = page.getByRole("dialog", { name: "全局搜索" });
    const input = dialog.getByRole("textbox", { name: "搜索关键词" });
    await expect(input).toBeFocused();
    await input.fill("保留输入");
    await page.keyboard.press(shortcut);
    await expect(input).toHaveValue("保留输入");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await enterPlatform(page);
    await expect(page.locator('.role-shell[data-shell="platform_admin"]')).toHaveAttribute(
      "data-state",
      "ready",
    );
    await page.keyboard.press(shortcut);
    await paint(page);
    await expect(dialog).toBeHidden();
  });
}
test("UI2-DI01 invalid replacement cannot inherit an older search response or failure identifiers", async ({
  page,
}) => {
  await ignoreTransportAbort(page, "/me/global-search?");
  await setup(page);
  let delayed: Route | undefined;
  let finished = false;
  page.on("requestfinished", (request) => {
    if (request === delayed?.request()) finished = true;
  });
  await page.route("**/api/v1/me/global-search?**", (route) => {
    delayed = route;
  });
  const dialog = await openSearch(page);
  const input = dialog.getByRole("textbox", { name: "搜索关键词" });
  await input.fill("旧搜索");
  await input.press("Enter");
  await expect.poll(() => Boolean(delayed)).toBe(true);
  await input.fill("字");
  await input.press("Enter");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await delayed!.fulfill({ json: searchResult("不应回填的结果") });
  await expect.poll(() => finished).toBe(true);
  await paint(page);
  await expect(dialog.getByText("不应回填的结果", { exact: true })).toHaveCount(0);
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await page.keyboard.press("Escape");
  await openSearch(page);
  await expect(input).not.toHaveAttribute("aria-invalid", "true");
});
test("UI2-DI01 exact search parameters follow type and trim rules without sending scope IDs", async ({
  page,
}) => {
  const { writes } = await setup(page);
  const queries: Record<string, string>[] = [];
  await page.route("**/api/v1/me/global-search?**", (route) => {
    queries.push(Object.fromEntries(new URL(route.request().url()).searchParams));
    return route.fulfill({ json: searchResult("参数验证结果") });
  });
  const dialog = await openSearch(page);
  const input = dialog.getByRole("textbox", { name: "搜索关键词" });
  await input.fill("  合同查询  ");
  const types = ["task", "opportunity", "evidence", "collection_task", ""];
  const states = ["todo", "ready", "active", "queued", ""];
  for (let index = 0; index < types.length; index += 1) {
    const type = types[index];
    await dialog.getByLabel("对象类型").selectOption(type);
    await expect(dialog.getByLabel("状态")).toHaveValue("");
    if (type) await dialog.getByLabel("状态").selectOption(states[index]);
    if (["task", "opportunity"].includes(type))
      await dialog.getByLabel("负责人").fill("  负责人甲  ");
    else {
      await expect(dialog.getByLabel("负责人")).toBeDisabled();
      await expect(dialog.getByLabel("负责人")).toHaveValue("");
    }
    await input.press("Enter");
    await expect.poll(() => queries.length).toBe(index + 1);
    expect(queries[index]).toEqual({
      q: "合同查询",
      limit: "10",
      ...(type ? { resource_type: type, status: states[index] } : {}),
      ...(["task", "opportunity"].includes(type) ? { assignee: "负责人甲" } : {}),
    });
    await expect(dialog.getByRole("link", { name: /参数验证结果/ })).toBeVisible();
  }
  await expect(input).toHaveAttribute("maxlength", "100");
  expect(writes).toEqual([]);
});
{
  for (const [statusCode, kind] of [
    [401, "expired"],
    [403, "forbidden"],
    [409, "error"],
    [429, "blocked"],
    [500, "error"],
    [503, "blocked"],
  ] as const) {
    test(`UI2-DI05 search ${statusCode} retry owns loading identifiers and stays in its mode`, async ({
      page,
    }) => {
      const { writes } = await setup(page);
      const pattern = "**/api/v1/me/global-search?**";
      const requests: string[] = [];
      let retrying = false;
      let pending: Route | undefined;
      await page.route(pattern, (route) => {
        requests.push(route.request().url());
        if (retrying) {
          pending = route;
          return;
        }
        return route.fulfill({
          status: statusCode,
          json: {
            error: {
              code: "isolated_failure",
              message: "隔离读取失败",
              action_hint: "当前请求受阻",
            },
            request_id: "ui2-previous-read",
            trace_id: "ui2-previous-trace",
          },
        });
      });
      {
        const dialog = await openSearch(page);
        await dialog.getByRole("textbox", { name: "搜索关键词" }).fill("隔离查询");
        await dialog.getByRole("textbox", { name: "搜索关键词" }).press("Enter");
      }
      const dialog = page.locator("dialog.discovery-c-backdrop");
      const panel = dialog.locator(".ui-state-panel");
      await expect(panel).toHaveAttribute("data-kind", kind);
      await expect(panel.getByText("ui2-previous-read", { exact: true })).toBeVisible();
      const before = requests.length;
      retrying = true;
      await panel.getByRole("button", { name: "重新加载", exact: true }).click();
      await expect.poll(() => Boolean(pending)).toBe(true);
      await expect(panel).toHaveAttribute("data-kind", "loading");
      await expect(panel.getByText("ui2-previous-read", { exact: true })).toHaveCount(0);
      await expect(panel.getByText("ui2-previous-trace", { exact: true })).toHaveCount(0);
      await expect(panel.getByRole("button")).toHaveCount(0);
      expect(requests).toHaveLength(before + 1);
      expect(new Set(requests).size).toBe(1);
      await pending!.fulfill({
        json: searchResult("本次重试结果"),
      });
      await expect(dialog.getByRole("link", { name: /本次重试结果/ })).toBeVisible();
      await expect(panel).toHaveCount(0);
      expect(writes).toEqual([]);
    });
  }
}
test("UI2-DI05 forbidden secondary action closes the overlay instead of a dead permission claim", async ({
  page,
}) => {
  const { writes } = await setup(page);
  await page.route("**/api/v1/me/global-search?**", (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: { code: "forbidden", message: "拒绝", action_hint: "无权读取" },
        request_id: "ui2-denied",
        trace_id: "ui2-denied",
      },
    }),
  );
  const trigger = page
    .locator(".role-top-actions")
    .getByRole("button", { name: "全局搜索", exact: true });
  await trigger.focus();
  const dialog = await openSearch(page);
  const input = dialog.getByRole("textbox", { name: "搜索关键词" });
  await input.fill("权限检查");
  await input.press("Enter");
  const secondary = dialog.locator(".ui-state-panel").getByRole("button").nth(1);
  const label = await secondary.textContent();
  await secondary.click();
  await expect(dialog).toBeHidden();
  expect(label?.trim()).toBe("关闭");
  await expect(trigger).toBeFocused();
  expect(writes).toEqual([]);
});
{
  test(`UI2-DI05 search empty state offers a real retry and explicit dismissal`, async ({
    page,
  }) => {
    const { writes } = await setup(page);
    await page.route("**/api/v1/me/global-search?**", (route) =>
      route.fulfill({
        json: envelope({
          items: [],
          next_cursor: null,
          scope: { organization_id: org, workspace_id: workspace },
        }),
      }),
    );
    {
      const dialog = await openSearch(page);
      await dialog.getByRole("textbox", { name: "搜索关键词" }).fill("没有结果");
      await dialog.getByRole("textbox", { name: "搜索关键词" }).press("Enter");
    }
    const dialog = page.locator("dialog.discovery-c-backdrop");
    const panel = dialog.locator(".ui-state-panel");
    await expect(panel).toHaveAttribute("data-kind", "empty");
    await expect(panel.getByRole("button", { name: "重新加载", exact: true })).toBeEnabled();
    await panel.getByRole("button", { name: "关闭", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(writes).toEqual([]);
  });
}
