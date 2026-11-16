import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  selectionHttpAccounts as accounts,
  selectionHttpIds as ids,
} from "../fixtures/selection-http-stack.mjs";

test.skip(
  process.env.SCOUTOPS_E2E_ACCOUNT_HTTP !== "1",
  "Requires the loopback account HTTP fixture.",
);

async function login(page: Page, email: string) {
  const response = await page.request.post("/api/v1/auth/login", {
    headers: { origin: String(test.info().project.use.baseURL), "idempotency-key": randomUUID() },
    data: { identifier: email, password: accounts.password },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["set-cookie"]).toMatch(/httponly/i);
}

test("[real-api] verified account reaches selection without a legacy workspace session", async ({
  page,
}) => {
  await login(page, accounts.member);
  const landing = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/me/landing",
  );
  const list = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/opportunities",
  );
  await page.goto("/");
  expect((await (await landing).json()).data.reason).toBe("landing_account_rehearsal");
  const accountList = await list;
  expect(accountList.status()).toBe(200);
  expect(accountList.headers()["cache-control"]).toBe("private, no-store");
  await expect(page).toHaveURL(/\/opportunities(?:\?.*)?$/);
  const catalogue = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/opportunities",
  );
  await page.goto("/opportunities?view=all");
  expect((await (await catalogue).json()).data.map((item: { id: string }) => item.id)).toContain(
    ids.product,
  );
  await expect(page.getByText("HTTP 验证耳机收纳盒", { exact: true })).toBeVisible();
  await page.goto("/select-context");
  await expect(page.getByRole("heading", { name: "没有找到这个页面" })).toBeVisible();
  const admin = await page.request.get("/api/v1/me/navigation?shell=organization_admin");
  expect(admin.status()).toBe(403);
});

test("[real-api] account ownership preserves original quotes and prevents a foreign read", async ({
  page,
  browser,
}, testInfo) => {
  await login(page, accounts.quoteReader);
  const history = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/sourcing/comparisons",
  );
  await page.goto("/sourcing");
  const owned = await history;
  expect(owned.status()).toBe(200);
  expect(owned.headers()["cache-control"]).toBe("private, no-store");
  const { data } = await owned.json();
  expect(data).toHaveLength(1);
  expect(data[0].quotes).toHaveLength(2);
  await page.getByRole("tab", { name: "报价历史", exact: true }).click();
  const rows = page.locator(".sourcing-comparisons tbody tr");
  await expect(rows).toHaveCount(2);
  for (const [index, quote] of data[0].quotes.entries()) {
    await expect(rows.nth(index)).toContainText(quote.supplier_name);
    await expect(rows.nth(index)).toContainText(`${quote.currency} ${quote.quoted_price}`);
  }
  const foreign = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    const foreignPage = await foreign.newPage();
    await login(foreignPage, accounts.foreign);
    const response = await foreignPage.request.get("/api/v1/sourcing/comparisons");
    expect(response.status()).toBe(200);
    expect((await response.json()).data).toEqual([]);
    expect((await foreignPage.request.get(`/api/v1/opportunities/${ids.product}`)).status()).toBe(
      404,
    );
  } finally {
    await foreign.close();
  }
});
