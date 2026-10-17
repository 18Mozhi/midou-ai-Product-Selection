import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  selectionHttpAccounts as accounts,
  selectionHttpIds as ids,
} from "../fixtures/selection-http-stack.mjs";

// Actual HTTP routes, auth and domain services; repositories contain synthetic
// process-local records. This is not MySQL, crawler or production acceptance.
test.describe.configure({ mode: "serial" });

async function login(page: Page, role: "member" | "viewer" | "foreign" = "member") {
  const origin = test.info().project.use.baseURL ?? process.env.PLAYWRIGHT_WEB_PORT;
  const webOrigin =
    typeof origin === "string" && origin.startsWith("http")
      ? origin
      : `http://127.0.0.1:${process.env.PLAYWRIGHT_WEB_PORT ?? 5173}`;
  const response = await page.request.post("/api/v1/auth/login", {
    headers: { origin: webOrigin, "idempotency-key": randomUUID() },
    data: { identifier: accounts[role], password: accounts.password },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["set-cookie"]).toMatch(/HttpOnly/i);
}

function png(value: Buffer, page: Page) {
  expect(value.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(value.readUInt32BE(16)).toBe(page.viewportSize()?.width);
  expect(value.byteLength).toBeGreaterThan(10_000);
}

async function catalogue(page: Page) {
  const read = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/opportunities",
  );
  await page.goto("/opportunities?view=all");
  expect((await read).status()).toBe(200);
  await expect(page.locator(".opportunity-workspace")).toBeVisible();
}

async function filter(page: Page, query: string) {
  const mobile = (page.viewportSize()?.width ?? 0) <= 760;
  if (mobile) await page.getByRole("button", { name: "高级筛选" }).click();
  const form = mobile
    ? page.getByRole("dialog", { name: "高级筛选" })
    : page.locator(".opportunity-filters");
  await form.getByLabel("机会名称").fill(query);
  const read = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/v1/opportunities" && url.searchParams.get("q") === query;
  });
  await form.getByRole("button", { name: "筛选", exact: true }).click();
  const response = await read;
  expect(response.status()).toBe(200);
  return response.json();
}

test("[real-api] workspace shows distinct discovered count without inventing qualified output", async ({
  page,
}) => {
  await login(page);
  const read = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/me/home-dashboard"),
  );
  await page.goto("/home");
  const response = await read;
  expect(response.status()).toBe(200);
  expect((await response.json()).data.automatic_selection.daily_production).toMatchObject({
    completed_count: 0,
    discovered_count: 2,
    qualified_count: 0,
    target_minimum: 100,
  });
  const daily = page.getByRole("region", { name: "每日选品产出" });
  await expect(daily).toContainText("新增主品 ASIN");
  await expect(daily.getByRole("progressbar")).toHaveAttribute("value", "0");
  png(await page.screenshot({ fullPage: true }), page);
});

test("[real-api] catalogue renders returned primary identity and public facts", async ({
  page,
}) => {
  await login(page);
  await catalogue(page);
  await expect(page.getByText("HTTP 验证耳机收纳盒", { exact: true })).toBeVisible();
  await expect(page.getByText("B0HTTP0000", { exact: true })).toBeVisible();
  await expect(page.getByText("USD 19.95", { exact: true })).toBeVisible();
  await expect(page.getByText("HTTP 验证旅行收纳袋", { exact: true })).toBeVisible();
  png(await page.screenshot({ fullPage: true }), page);
});

test("[real-api] submitted catalogue search filters records on the server", async ({ page }) => {
  await login(page);
  await catalogue(page);
  const body = await filter(page, "耳机");
  expect(body.meta.total).toBe(1);
  expect(body.data[0].id).toBe(ids.product);
  await expect(page.getByText("HTTP 验证耳机收纳盒", { exact: true })).toBeVisible();
  await expect(page.getByText("HTTP 验证旅行收纳袋", { exact: true })).toHaveCount(0);
  png(await page.screenshot({ fullPage: true }), page);
});

test("[real-api] unmatched server search renders an honest empty result", async ({ page }) => {
  await login(page);
  await catalogue(page);
  const body = await filter(page, "没有此商品");
  expect(body.data).toEqual([]);
  expect(body.meta.total).toBe(0);
  await expect(page.getByText("HTTP 验证耳机收纳盒", { exact: true })).toHaveCount(0);
  await expect(page.locator(".ui-state-panel")).toBeVisible();
  png(await page.screenshot({ fullPage: true }), page);
});

test("[real-api] list presentation keeps the same actual server product facts", async ({
  page,
}) => {
  await login(page);
  await catalogue(page);
  await page.getByRole("button", { name: "列表", exact: true }).click();
  await expect(page.getByRole("button", { name: "列表", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("USD 19.95", { exact: true })).toBeVisible();
  await expect(page.getByText("B0HTTP0010", { exact: true })).toBeVisible();
  png(await page.screenshot({ fullPage: true }), page);
});

test("[real-api] detail comparison reads five independent competitors from its scoped route", async ({
  page,
}) => {
  await login(page);
  const read = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/competitors",
  );
  await page.goto(`/opportunities/${ids.product}?tab=competition`);
  const response = await read;
  expect(response.status()).toBe(200);
  expect(
    new Set((await response.json()).data.map((item: { external_id: string }) => item.external_id))
      .size,
  ).toBe(5);
  await expect(
    page.getByRole("heading", { name: "HTTP 验证耳机收纳盒", exact: true }),
  ).toBeVisible();
  const comparison = page.getByRole("region", { name: "Amazon 主品与竞品" });
  await expect(comparison.locator("tbody tr")).toHaveCount(5);
  await expect(comparison).toContainText("HTTP 验证独立竞品 5");
  png(await page.screenshot({ fullPage: true }), page);
});

test("[real-api] observed decision saves through HTTP and survives reopening", async ({ page }) => {
  await login(page);
  await page.goto(`/opportunities/${ids.product}`);
  await page.getByText("提前人工处理", { exact: true }).click();
  await page.getByRole("button", { name: "继续观察", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "记录继续观察决定" });
  const reason = "HTTP 集成验证：继续采集，不虚构利润";
  await dialog.getByLabel("原因（必填）").fill(reason);
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/opportunities/${ids.product}/decisions`) &&
      response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "确认记录" }).click();
  expect((await saved).status()).toBe(200);
  const reopened = page.waitForResponse(
    (response) => new URL(response.url()).pathname === `/api/v1/opportunities/${ids.product}`,
  );
  await page.goto(`/opportunities/${ids.product}?tab=decisions`);
  const detail = (await (await reopened).json()).data;
  expect(detail.decision_status).toBe("observing");
  expect(detail.version).toBe(2);
  expect(detail.decisions).toHaveLength(1);
  await expect(page.locator(".opportunity-decisions")).toContainText(reason);
  png(await page.screenshot({ fullPage: true }), page);
});

test("[real-api] insufficient member capability denies the page and actual business endpoint", async ({
  page,
}) => {
  await login(page, "viewer");
  await page.goto("/opportunities?view=all");
  await expect(page.getByRole("heading", { name: "无权打开此页面" })).toBeVisible();
  const denied = await page.request.get("/api/v1/opportunities?selection_view=all");
  expect(denied.status()).toBe(403);
  await expect(page.getByText("HTTP 验证耳机收纳盒", { exact: true })).toHaveCount(0);
  png(await page.screenshot({ fullPage: true }), page);
});
