import { test, expect } from "@playwright/test";
import { readQuickCreateLinks } from "../../scripts/production-route-catalog.mjs";

const navigation = {
  shell: "member",
  organization_id: "00000000-0000-4000-8000-000000000501",
  workspace_id: "00000000-0000-4000-8000-000000000502",
  organization_name: "测试组织",
  workspace_name: "测试工作区",
  roles: ["member"],
  capabilities: ["task:read", "task:create", "sourcing:read", "notification:read"],
  platform_roles: [],
  platform_capabilities: [],
  guard_reason: "navigation_member_allowed",
};
async function base(page: any) {
  await page.route("**/api/v1/me/navigation?**", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: navigation, request_id: "m02-05-nav", trace_id: "m02-05-nav" }),
    }),
  );
  await page.route("**/api/v1/me/home-dashboard", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          actions: [],
          changes: [],
          follows: [],
          health: [],
          scope: {
            organization_id: navigation.organization_id,
            workspace_id: navigation.workspace_id,
          },
          generated_at: "2026-08-08T00:00:00.000Z",
        },
        request_id: "m02-05-home",
        trace_id: "m02-05-home",
      }),
    }),
  );
}

test("M02-05.A07/A08/A15 keyboard search is responsive and visual", async ({ page }) => {
  await base(page);
  let searchUrl = "";
  await page.route("**/api/v1/me/global-search?**", (route) => {
    searchUrl = route.request().url();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          items: [
            {
              id: "00000000-0000-4000-8000-000000000510",
              resource_type: "opportunity",
              resource_id: "00000000-0000-4000-8000-000000000511",
              title: "户外照明机会",
              subtitle: "当前工作区已索引记录",
              status: "ready",
              assignee_id: "00000000-0000-4000-8000-000000000512",
              assignee_name: "选品经理",
              route: "/opportunities/00000000-0000-4000-8000-000000000511",
              updated_at: "2026-08-07T15:00:00.000Z",
            },
          ],
          next_cursor: null,
          scope: {
            organization_id: navigation.organization_id,
            workspace_id: navigation.workspace_id,
          },
        },
        request_id: "m02-05-search",
        trace_id: "m02-05-search",
      }),
    });
  });
  await page.goto("/home");
  await expect(page.locator(".role-shell")).toHaveAttribute("data-state", "ready");
  await page.keyboard.press("Control+K");
  const dialog = page.getByRole("dialog", { name: "全局搜索" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("测试组织")).toBeVisible();
  await expect(dialog.getByText("测试工作区")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "搜索" })).toBeVisible();
  const scopeBox = await dialog.locator(".discovery-c-scope").boundingBox();
  const resultsBox = await dialog.locator(".discovery-c-results-pane").boundingBox();
  expect(scopeBox).not.toBeNull();
  expect(resultsBox).not.toBeNull();
  expect(resultsBox!.y).toBeGreaterThanOrEqual(scopeBox!.y + scopeBox!.height - 1);
  expect(Math.abs(resultsBox!.width - scopeBox!.width)).toBeLessThan(2);
  await expect(dialog.getByText("GLOBAL SEARCH", { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("负责人")).toHaveAttribute("placeholder", "仅选品可用");
  const keywordBox = await dialog.getByLabel("搜索关键词").boundingBox();
  const submitBox = await dialog.getByRole("button", { name: "搜索", exact: true }).boundingBox();
  expect(Math.abs(keywordBox!.y - submitBox!.y)).toBeLessThan(2);
  const idle = await dialog.locator(".discovery-c-idle").evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.color, background: style.backgroundColor };
  });
  expect(idle.color).not.toBe(idle.background);
  expect((await dialog.locator(".discovery-c-dialog").boundingBox())!.height).toBeLessThan(
    page.viewportSize()!.height,
  );
  await dialog.getByLabel("对象类型").selectOption("opportunity");
  await dialog.getByLabel("状态").selectOption("ready");
  await dialog.getByLabel("负责人").fill("选品经理");
  await dialog.getByPlaceholder("输入至少 2 个字符").fill("户外照明");
  await dialog.getByPlaceholder("输入至少 2 个字符").press("Enter");
  await expect(dialog.getByRole("link", { name: /户外照明机会/ })).toBeVisible();
  await expect(dialog.locator(".discovery-c-result").getByText("待决策")).toBeVisible();
  await expect(dialog.getByText("负责人 选品经理")).toBeVisible();
  expect(searchUrl).toContain("resource_type=opportunity");
  expect(searchUrl).toContain("status=ready");
  expect(searchUrl).toContain("assignee=%E9%80%89%E5%93%81%E7%BB%8F%E7%90%86");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("retired quick-create entry is absent from member navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await base(page);
  const calls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/me/quick-actions")) calls.push(request.url());
  });
  await page.goto("/home");
  await expect(page.getByRole("button", { name: "创建选品", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "打开导航菜单" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "工作台导航" })
      .getByRole("button", { name: "创建选品", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.route("**/api/v1/me/global-search?**", (route) =>
    route.fulfill({
      json: { data: { items: [] }, request_id: "search-only", trace_id: "search-only" },
    }),
  );
  await page.keyboard.press("Control+K");
  const search = page.getByRole("dialog", { name: "全局搜索", exact: true });
  await expect(search).toBeVisible();
  await search.getByRole("textbox", { name: "搜索关键词" }).fill("搜索商品");
  await search.getByRole("textbox", { name: "搜索关键词" }).press("Enter");
  await expect(search.locator(".ui-state-panel")).toHaveAttribute("data-kind", "empty");
  await expect(page.getByRole("dialog", { name: "快捷创建", exact: true })).toHaveCount(0);
  expect(calls).toEqual([]);
});

test("M02-05.A08/A16 expired and empty states are not reported as success", async ({ page }) => {
  await base(page);
  let status = 401;
  await page.route("**/api/v1/me/global-search?**", (route) =>
    route.fulfill(
      status === 401
        ? {
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                code: "session_invalid",
                message: "登录已失效。",
                action_hint: "重新登录。",
              },
              request_id: "m02-05-expired",
              trace_id: "m02-05-expired",
            }),
          }
        : {
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                items: [],
                next_cursor: null,
                scope: {
                  organization_id: navigation.organization_id,
                  workspace_id: navigation.workspace_id,
                },
              },
              request_id: "m02-05-empty",
              trace_id: "m02-05-empty",
            }),
          },
    ),
  );
  await page.goto("/home");
  await expect(page.locator(".role-shell")).toHaveAttribute("data-state", "ready");
  await page.keyboard.press("Control+K");
  const dialog = page.getByRole("dialog", { name: "全局搜索" });
  const input = dialog.getByPlaceholder("输入至少 2 个字符");
  await input.fill("无结果");
  await input.press("Enter");
  await expect(dialog.getByRole("heading", { name: "登录已失效" })).toBeVisible();
  status = 200;
  await dialog.getByRole("button", { name: "重新加载" }).click();
  await expect(dialog.getByRole("heading", { name: "这里还没有内容" })).toBeVisible();
});
