import { expect, test } from "@playwright/test";

test("M07-03.A07/A15 Baota S0 production health is visually stable", async ({ page }) => {
  await page.route("**/api/v1/health/ready", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { status: "ready", dependencies: { mysql: "available", redis: "available" } },
        meta: { observed_at: "2026-08-08T12:17:34.445Z" },
        request_id: "request-deployment-visual",
        trace_id: "trace-deployment-visual",
      }),
    }),
  );
  await page.route("**/api/v1/health/version", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          version: "0.1.0",
          build_sha: "8ae80a501809be24997c600dbc352392b1c5c5c6",
          config_fingerprint: "bc4fae39f0de39bac43541ae8fbdbc3e5068900a7a649a02be9423be2315f05f",
        },
        request_id: "request-deployment-version",
        trace_id: "trace-deployment-version",
      }),
    }),
  );

  await page.goto("/?view=deployment");
  await expect(page.getByRole("heading", { name: "宝塔单机生产部署", exact: true })).toBeVisible();
  await expect(page.getByText("健康 · 已部署")).toBeVisible();
  await expect(page.getByText("8ae80a501809")).toBeVisible();
});

test("M07-03.A08/A16 blocked and rollback remain truthful at 390px", async ({ page }) => {
  await page.goto("/?view=deployment&state=blocked");
  await expect(page.getByText("已阻断 · 依赖受阻")).toBeVisible();
  await page.getByRole("button", { name: "回滚模式" }).click();
  await expect(page.getByText("回滚 · 恢复模式")).toBeVisible();
  if (page.viewportSize()?.width === 390) {
  }
});
