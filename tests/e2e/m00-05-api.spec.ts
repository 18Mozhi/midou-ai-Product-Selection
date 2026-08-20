import { expect, test } from "@playwright/test";
test("M00-05.A07/A15 API readiness is visually stable", async ({ page }) => {
  await page.route("**/api/v1/health/ready", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { status: "ready", dependencies: { mysql: "available", redis: "available" } },
        request_id: "visual",
        trace_id: "visual",
      }),
    }),
  );
  await page.goto("/?view=api");
  await expect(page.getByRole("heading", { name: "后端接口基座", exact: true })).toBeVisible();
  await expect(page.getByTestId("api-ready")).toBeVisible();
  await expect(page).toHaveScreenshot("m00-05-api.png", { fullPage: true });
});
test("M00-05.A08/A16 dependency error and retry are explicit at 390px", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: () => "request-e2e-api-error",
    });
  });
  await page.route("**/api/v1/health/ready", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "dependency_unavailable" },
        request_id: "visual-error",
        trace_id: "visual-error",
      }),
    }),
  );
  await page.goto("/?view=api");
  await expect(page.getByTestId("api-error")).toBeVisible();
  await expect(page.getByRole("button", { name: "重新检查" })).toBeVisible();
  if (page.viewportSize()?.width === 390)
    await expect(page).toHaveScreenshot("m00-05-api-390.png", { fullPage: true });
});
