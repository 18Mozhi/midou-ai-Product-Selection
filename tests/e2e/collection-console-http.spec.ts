import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { selectionHttpAccounts as accounts } from "../fixtures/selection-http-stack.mjs";

test("[real-api] collection overview renders authorized HTTP facts with the rebuilt layout", async ({
  page,
}) => {
  const origin = `http://127.0.0.1:${process.env.PLAYWRIGHT_WEB_PORT ?? 5173}`;
  const login = await page.request.post("/api/v1/auth/login", {
    headers: { origin, "idempotency-key": randomUUID() },
    data: { identifier: accounts.operator, password: accounts.password },
  });
  expect(login.status()).toBe(200);
  const read = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/platform/collection/console",
  );
  await page.goto("/platform-admin/collection/overview");
  const response = await read;
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect((await response.json()).data.sources[0].name).toBe("HTTP 验证公开趋势 RSS");
  await expect(page.getByRole("heading", { name: "最近尝试", exact: true })).toBeVisible();
  await expect(page.locator(".collection-ops")).toContainText("HTTP 验证公开趋势 RSS");
  const layout = await page.locator(".collection-ops-grid").evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    wide: [...element.querySelectorAll(".collection-wide-section")].map(
      (panel) => panel.getBoundingClientRect().width,
    ),
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  expect(layout.overflow).toBe(false);
  expect(layout.wide).toHaveLength(3);
  for (const width of layout.wide) expect(Math.abs(width - layout.width)).toBeLessThan(2);
  await expect(page.locator(".collection-ops")).toContainText("已暂停（熔断）");
  await expect(page.locator(".collection-ops")).toContainText("健康结果来自最近一次检查");
  expect(
    await page
      .locator(".collection-health-note")
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(13);
  await expect(page).toHaveScreenshot("collection-overview-global-shell-20261023.png", {
    fullPage: true,
  });
});

test("[real-api] ordinary member cannot read platform collection facts", async ({ page }) => {
  const origin = `http://127.0.0.1:${process.env.PLAYWRIGHT_WEB_PORT ?? 5173}`;
  expect(
    (
      await page.request.post("/api/v1/auth/login", {
        headers: { origin, "idempotency-key": randomUUID() },
        data: { identifier: accounts.member, password: accounts.password },
      })
    ).status(),
  ).toBe(200);
  expect((await page.request.get("/api/v1/platform/collection/console")).status()).toBe(403);
});
