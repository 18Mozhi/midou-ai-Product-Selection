import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { selectionHttpAccounts as accounts } from "../fixtures/selection-http-stack.mjs";

// Real HTTP authentication, route authorization and SourcingService reads.
// Repositories use synthetic process-local records, not MySQL, 1688 or production data.
test("[real-api] saved quote matrix renders authenticated HTTP facts without supplier writes", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "desktop-chromium")
    await page.setViewportSize({ width: 1440, height: 900 });
  expect((await page.request.get("/api/v1/sourcing/comparisons")).status()).toBe(401);
  const webOrigin = String(testInfo.project.use.baseURL);
  expect(new URL(webOrigin).hostname).toBe("127.0.0.1");
  const auth = await page.request.post("/api/v1/auth/login", {
    headers: { origin: webOrigin, "idempotency-key": randomUUID() },
    data: { identifier: accounts.quoteReader, password: accounts.password },
  });
  expect(auth.status()).toBe(200);
  expect(auth.headers()["set-cookie"]).toMatch(/HttpOnly/i);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.startsWith("/api/v1/sourcing/") &&
      request.method() !== "GET"
    )
      writes.push(request.url());
  });
  const historyResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/sourcing/comparisons",
  );
  await page.goto("/sourcing");
  const response = await historyResponse;
  expect(response.status()).toBe(200);
  expect(response.headers()["x-request-id"]).toBeTruthy();
  const payload = await response.json();
  expect(payload.data).toHaveLength(1);
  expect(payload.data[0].quotes).toHaveLength(2);
  const table = page.locator(".sourcing-comparisons").getByRole("table");
  await expect(table.locator("tbody tr")).toHaveCount(payload.data[0].quotes.length);
  for (const quote of payload.data[0].quotes) {
    const row = table.locator("tbody tr").filter({ hasText: quote.supplier_name });
    await expect(row.getByRole("rowheader")).toContainText(quote.product_title);
    await expect(row.locator('td[data-label="规格"]')).toHaveText(quote.specification);
    await expect(row.locator('td[data-label="最小起订量"]')).toHaveText(String(quote.moq));
    await expect(row.locator('td[data-label="报价"]')).toHaveText(
      `${quote.currency} ${quote.quoted_price}`,
    );
    await expect(row.locator('td[data-label="交期"]')).toHaveText(`${quote.lead_time_days} 天`);
  }
  await expect(page.locator(".sourcing-comparisons")).toContainText(
    "不代表当前最新报价或已作为进货价",
  );
  await expect(page.getByRole("button", { name: "确认报价", exact: true })).toHaveCount(0);
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const screenshot = await page.screenshot({
    path: testInfo.outputPath("saved-quote-http.png"),
    fullPage: true,
  });
  expect(screenshot.subarray(1, 4).toString("ascii")).toBe("PNG");
  expect(screenshot.byteLength).toBeGreaterThan(10_000);
});
