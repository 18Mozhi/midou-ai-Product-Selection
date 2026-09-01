import { test, expect } from "@playwright/test";

test("M02-04 fallback renders a dedicated truthful 404 without internal tools", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) apiRequests.push(request.url());
  });

  await page.goto("/catalog/deleted-entry?filter=qa-only#details");
  await expect(page).toHaveTitle("页面不存在 · 智能选品");
  await expect(page.getByRole("heading", { name: "没有找到这个页面" })).toBeVisible();
  await expect(page.getByText("/catalog/deleted-entry", { exact: true })).toBeVisible();
  await expect(page.getByText("filter=qa-only")).toHaveCount(0);
  await expect(page.getByText("状态组件库")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "状态示例" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "查看高影响确认弹窗" })).toHaveCount(0);
  await expect(page.getByText("m02-04-request")).toHaveCount(0);
  expect(apiRequests).toEqual([]);
});

test("M02-04 fallback returns to a valid recent route without exposing its query", async ({
  page,
}) => {
  await page.goto("/ui-states?state=blocked");
  await page.goto("/unknown/recent-return");
  await expect(page.getByText("将返回：界面状态")).toBeVisible();
  await expect(page.getByText("state=blocked")).toHaveCount(0);
  await page.getByRole("link", { name: "返回最近页面" }).click();
  await expect(page).toHaveURL(/\/ui-states\?state=blocked$/);
  await expect(page.getByRole("heading", { name: "依赖暂时受阻" })).toBeVisible();
});

test("M02-04 fallback fails closed when the stored recent route is no longer registered", async ({
  page,
}) => {
  await page.goto("/unknown/first");
  await page.evaluate(() => {
    window.localStorage.setItem(
      "scoutops:navigation:last-valid-route",
      "/retired/module?filter=stale",
    );
  });
  await page.reload();
  await expect(page.getByRole("link", { name: "返回最近页面" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "返回今日行动" })).toBeVisible();
  await expect(page.getByText("retired/module")).toHaveCount(0);
  await page.getByRole("link", { name: "返回今日行动" }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test("M02-04 fallback remains truthful across refresh and browser history", async ({ page }) => {
  await page.goto("/ui-states");
  await page.goto("/unknown/history-check");
  await page.reload();
  await expect(page.getByRole("heading", { name: "没有找到这个页面" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/ui-states$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/unknown\/history-check$/);
  await expect(page.getByRole("heading", { name: "没有找到这个页面" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "状态示例" })).toHaveCount(0);
});

test("M02-04 fallback home and brand actions reach their declared destination", async ({
  page,
}) => {
  await page.goto("/unknown/home-action");
  await page.getByRole("link", { name: "返回今日行动" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.goto("/unknown/brand-action");
  await page.getByRole("link", { name: "返回智能选品今日行动" }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test("M02-04 fallback contains long paths and keeps mobile actions reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/missing/${"x".repeat(150)}`);
  await expect(page.getByRole("heading", { name: "没有找到这个页面" })).toBeFocused();
  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    pathText: document.querySelector<HTMLElement>(".not-found-path code")?.innerText ?? "",
    actionHeights: [...document.querySelectorAll<HTMLElement>(".not-found-content nav a")].map(
      (element) => element.getBoundingClientRect().height,
    ),
  }));
  expect(layout.documentWidth).toBe(layout.viewportWidth);
  expect(layout.pathText.length).toBeLessThanOrEqual(96);
  expect(layout.pathText.endsWith("…")).toBe(true);
  expect(layout.actionHeights.length).toBeGreaterThan(0);
  expect(layout.actionHeights.every((height) => height >= 44)).toBe(true);
});
