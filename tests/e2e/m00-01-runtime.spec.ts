import { expect, test, type Page } from "@playwright/test";

const navigation = {
  shell: "member",
  organization_id: "00000000-0000-4000-8000-000000000001",
  workspace_id: "00000000-0000-4000-8000-000000000002",
  roles: ["member"],
  capabilities: ["task:read", "trend:read", "opportunity:read"],
  platform_roles: [],
  platform_capabilities: [],
  guard_reason: "navigation_member_allowed",
};

async function allowMemberNavigation(page: Page) {
  await page.route("**/api/v1/me/landing", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { shell: "member", route: "/home", reason: "landing_member" },
        request_id: "m00-runtime-landing",
        trace_id: "m00-runtime-landing",
      }),
    }),
  );
  await page.route("**/api/v1/me/navigation?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: navigation,
        request_id: "m00-runtime-nav",
        trace_id: "m00-runtime-nav",
      }),
    }),
  );
}

test("P01 root shows the approved resolver while landing is pending", async ({ page }) => {
  await allowMemberNavigation(page);
  let finishLanding!: () => void;
  const landingResponse = new Promise<void>((resolve) => {
    finishLanding = resolve;
  });
  await page.route("**/api/v1/me/landing", async (route) => {
    await landingResponse;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { shell: "member", route: "/home", reason: "landing_member" },
        request_id: "p01-landing-success",
      }),
    });
  });
  await page.goto("/");
  const surface = page.locator(".landing-redirect");
  await expect(surface).toHaveAttribute("data-state", "loading");
  await expect(page.getByRole("heading", { name: "正在确定可进入的工作区" })).toBeVisible();
  await expect(surface.getByRole("button")).toHaveCount(0);
  await expect(page.getByText(/请求标识仅在失败时显示/)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  finishLanding();
  await expect(page).toHaveURL(/\/home$/);
});

test("P01 failure offers one safe retry and does not claim a destination", async ({ page }) => {
  await allowMemberNavigation(page);
  let attempts = 0;
  await page.route("**/api/v1/me/landing", (route) => {
    attempts += 1;
    if (attempts <= 3)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "landing_unavailable" },
          request_id: "p01-landing-retry",
        }),
      });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { shell: "member", route: "/home", reason: "landing_member" },
        request_id: "p01-landing-recovered",
      }),
    });
  });
  await page.goto("/");
  const surface = page.locator(".landing-redirect");
  await expect(surface).toHaveAttribute("data-state", "blocked");
  await expect(page.getByRole("heading", { name: "当前无法确定入口" })).toBeVisible();
  await expect(page.getByText("p01-landing-retry", { exact: true })).toBeVisible();
  const retry = page.getByRole("button", { name: "重新检查", exact: true });
  await expect(retry).toHaveCount(1);
  await expect
    .poll(() => retry.evaluate((node) => node.getBoundingClientRect().height >= 44))
    .toBe(true);
  await retry.hover();
  await expect
    .poll(() => retry.evaluate((node) => getComputedStyle(node).backgroundColor))
    .toBe("rgb(16, 59, 133)");
  await retry.focus();
  await expect
    .poll(() => retry.evaluate((node) => getComputedStyle(node).outlineWidth))
    .toBe("3px");
  await retry.click();
  await expect(page).toHaveURL(/\/home$/);
  expect(attempts).toBe(4);
});

test("P01 missing destination stays blocked instead of entering a guessed route", async ({
  page,
}) => {
  await page.route("**/api/v1/me/landing", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { shell: "member" },
        request_id: "p01-missing-route",
      }),
    }),
  );
  await page.goto("/");
  await expect(page.locator(".landing-redirect")).toHaveAttribute("data-state", "blocked");
  await expect(page.getByRole("heading", { name: "当前无法确定入口" })).toBeVisible();
  await expect(page.getByText("p01-missing-route", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("M00-01.A15 product entry is accessible and visually stable", async ({ page }) => {
  await allowMemberNavigation(page);
  await page.route("**/api/v1/me/home-dashboard", (route) =>
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
          generated_at: "2026-08-07T00:00:00.000Z",
        },
        request_id: "m00-runtime-home",
        trace_id: "m00-runtime-home",
      }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "今日行动" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "选品控制台" })).toBeVisible();
  await expect(page.getByText("自动选品未配置", { exact: true })).toBeVisible();
});

test("M00-01.A08/M00-01.A15 startup dependency error keeps recovery action at 390px", async ({
  page,
}) => {
  await allowMemberNavigation(page);
  await page.route("**/api/v1/me/home-dashboard", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "dependency_unavailable", action_hint: "稍后重试。" },
        request_id: "request-e2e-offline",
      }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "依赖暂时受阻" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重新读取" })).toBeVisible();
  if (page.viewportSize()?.width === 390) {
  }
});
