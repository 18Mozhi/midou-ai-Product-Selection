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

test("[real-api] verified primary takes the old approval slot without granting it to another account", async ({
  page,
  browser,
}, testInfo) => {
  const isMobile = testInfo.project.name === "mobile-390";
  const ruleId = isMobile ? ids.secondaryPrimaryRule : ids.primaryRule;
  const ruleName = `历史费用规则 HTTP ${isMobile ? 2 : 1}`;
  const action = isMobile ? "reject" : "approve";
  const label = isMobile ? "拒绝" : "批准";
  const endpoint = `/api/v1/cost-rules/${ruleId}/actions`;
  const send = (p: Page, role: string) =>
    p.request.post(endpoint, {
      headers: { origin: String(testInfo.project.use.baseURL), "idempotency-key": randomUUID() },
      data: { action, approval_role: role, reason: "账号审批 HTTP 验收", expected_revision: 7 },
    });
  const other = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    const otherPage = await other.newPage();
    await login(otherPage, accounts.member);
    const denied = await send(otherPage, "primary_account");
    expect(denied.status()).toBe(403);
    expect((await denied.json()).error.code).toBe("cost_rule_approval_role_forbidden");
  } finally {
    await other.close();
  }
  await login(page, accounts.primaryApprover);
  expect((await send(page, "organization_admin")).status()).toBe(403);
  const getRules = () => page.request.get("/api/v1/cost-rules").then((r) => r.json());
  const before = await getRules();
  expect(before.meta.is_primary_approver).toBe(true);
  expect(before.data.find((r: { id: string }) => r.id === ruleId)).toMatchObject({
    revision: 7,
    status: "pending_approval",
    approvals: ["selection_manager"],
  });
  await page.goto("/sourcing/cost-rules");
  if (isMobile) await page.getByLabel("当前费用规则版本").selectOption(ruleId);
  else await page.getByRole("button", { name: new RegExp(ruleName) }).click();
  await expect(page.getByRole("heading", { name: ruleName, exact: true })).toBeVisible();
  const rule = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: ruleName, exact: true }) });
  await rule.getByRole("button", { name: `主账号${label}`, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("操作原因（至少 2 个字）").fill("账号审批 HTTP 验收");
  const done = page.waitForResponse(
    (r) => new URL(r.url()).pathname === endpoint && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: `确认${label}` }).click();
  const response = await done;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON().approval_role).toBe("primary_account");
  const saved = (await getRules()).data.find((r: { id: string }) => r.id === ruleId);
  expect(saved).toMatchObject({
    revision: 8,
    status: isMobile ? "rejected" : "approved",
    approvals: isMobile ? ["selection_manager"] : ["selection_manager", "primary_account"],
  });
});

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
