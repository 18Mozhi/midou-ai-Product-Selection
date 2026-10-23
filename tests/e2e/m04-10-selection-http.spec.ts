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
  const form = page.getByRole("search", { name: "搜索商品" });
  await form.getByLabel("商品名称").fill(query);
  const read = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/v1/opportunities" && url.searchParams.get("q") === query;
  });
  await form.getByRole("button", { name: "搜索", exact: true }).click();
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
  const completedRead = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/v1/opportunities" &&
      url.searchParams.get("selection_view") === "completed"
    );
  });
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
  const completedResponse = await completedRead;
  expect(completedResponse.status()).toBe(200);
  expect((await completedResponse.json()).data).toEqual([]);
  await expect(page.getByText("暂无已完成分析的商品", { exact: true })).toBeVisible();
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
  await expect(page.getByText("CNY 3.25", { exact: true })).toBeVisible();
  const rows = page.getByRole("table", { name: "选品商品列表" }).locator("tbody tr");
  await expect(
    rows
      .first()
      .locator('td[data-label="竞品 / 货源"] dl > div')
      .filter({ hasText: "货源候选" })
      .locator("dd"),
  ).toHaveText("60");
  await expect(rows.nth(1).locator('td[data-label="1688 进货价"]')).toContainText("未取得");
  await expect(page.getByText("HTTP 验证旅行收纳袋", { exact: true })).toBeVisible();
  await expect(rows.first().locator('td[data-label="1688 进货价"]')).toContainText("利润未知");
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
  await expect(page.getByRole("table", { name: "选品商品列表" })).toBeVisible();
  await expect(page.getByRole("button", { name: "列表", exact: true })).toHaveCount(0);
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
  const profitRead = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/opportunities/${ids.product}/profit-analysis`,
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
  await expect(page.locator(".selection-product-header")).toContainText("利润未知");
  png(await page.screenshot({ fullPage: true }), page);
  await page.getByRole("button", { name: "货源与利润", exact: true }).click();
  expect((await profitRead).status()).toBe(200);
  await expect(
    page.locator(".opportunity-profit").getByText("利润未知", { exact: true }),
  ).toBeVisible();
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
  await expect(page.locator(".opportunity-message")).toContainText(
    "决策已记录；原始评分与证据未被改写。",
  );
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

test("[real-api] compact catalogue exposes identity and preserves market when searching by name", async ({
  page,
}) => {
  await login(page);
  await catalogue(page);
  const firstTitle = page
    .locator(":is(.catalog-product-identity,.selection-product-name) > strong")
    .first();
  await expect(firstTitle).toHaveText("HTTP 验证耳机收纳盒");
  const box = await firstTitle.boundingBox();
  const reserve = page.viewportSize()!.width <= 760 ? 80 : 24;
  expect(box!.y + box!.height).toBeLessThan(page.viewportSize()!.height - reserve);
  await page.getByRole("button", { name: "高级筛选", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "高级筛选" });
  await dialog.getByLabel("市场", { exact: true }).fill("DE");
  const filtered = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/v1/opportunities" && url.searchParams.get("market") === "DE";
  });
  await dialog.getByRole("button", { name: "筛选", exact: true }).click();
  const response = await filtered;
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.meta.total).toBe(1);
  expect(body.data.map((item: { market: string }) => item.market)).toEqual(["DE"]);
  await expect(dialog).toBeHidden();
  await expect(page.getByText("HTTP 验证旅行收纳袋", { exact: true })).toBeVisible();
  await expect(page.getByText("HTTP 验证耳机收纳盒", { exact: true })).toHaveCount(0);
  const named = await filter(page, "旅行");
  expect(named.meta.total).toBe(1);
  await expect(page).toHaveURL(/market=DE/);
  await expect(page).toHaveURL(/q=/);
  png(await page.screenshot({ fullPage: true }), page);
});

test("[real-api] member cannot read platform metrics or enter the rebuilt platform cockpit", async ({
  page,
}) => {
  await login(page);
  const denied = await page.request.get("/api/v1/platform/dashboard?window=24h");
  expect(denied.status()).toBe(403);
  expect(denied.headers()["x-request-id"]).toBeTruthy();
  expect((await denied.json()).data).toBeUndefined();
  const navigation = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/v1/me/navigation" && url.searchParams.get("shell") === "platform_admin"
    );
  });
  await page.goto("/platform-admin");
  expect((await navigation).status()).toBe(403);
  await expect(page.getByRole("heading", { name: "无权进入此工作台" })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回成员工作台", exact: true })).toBeVisible();
  await expect(page.locator(".platform-dashboard")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "新建组织", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  png(await page.screenshot({ fullPage: false }), page);
});
