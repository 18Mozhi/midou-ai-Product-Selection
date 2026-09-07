import { test, expect, type Page } from "@playwright/test";

const org = "00000000-0000-4000-8000-000000000521";
const workspace = "00000000-0000-4000-8000-000000000522";
const membership = "00000000-0000-4000-8000-000000000523";
const resource = "00000000-0000-4000-8000-000000000524";
const envelope = (data: unknown, meta?: unknown) => ({
  data,
  ...(meta ? { meta } : {}),
  request_id: "grant-e2e-request",
  trace_id: "grant-e2e-trace",
});
const authorization = {
  organization_id: org,
  workspace_id: workspace,
  roles: ["organization_admin"],
  capabilities: ["role:read", "role:manage", "membership:read"],
  data_scopes: [{ scope: "organization" }],
};
const grant = {
  id: "00000000-0000-4000-8000-000000000525",
  organization_id: org,
  workspace_id: workspace,
  resource_type: "opportunity",
  resource_id: resource,
  grantee_membership_id: membership,
  grantor_id: "00000000-0000-4000-8000-000000000526",
  reason: "采购团队核对供应报价",
  status: "active",
  effective_status: "active",
  expires_at: "2026-08-20T10:00:00.000Z",
  revoked_at: null,
  revoked_by: null,
  revocation_reason: null,
  version: 1,
  created_at: "2026-08-07T10:00:00.000Z",
  updated_at: "2026-08-07T10:00:00.000Z",
  actions: ["opportunity:read", "opportunity:decide"],
};

async function ready(page: Page, items = [grant]) {
  await page.clock.setFixedTime(new Date("2026-08-08T10:00:00.000Z"));
  await page.route("**/api/v1/me/authorization", (route) =>
    route.fulfill({ json: envelope(authorization) }),
  );
  await page.route(`**/api/v1/org/${org}/resource-grant-targets`, (route) =>
    route.fulfill({
      json: envelope([
        {
          id: membership,
          user_id: "00000000-0000-4000-8000-000000000527",
          email: "buyer@example.test",
          status: "active",
        },
      ]),
    }),
  );
  await page.route(`**/api/v1/org/${org}/resource-grants*`, (route) =>
    route.fulfill({ json: envelope(items, { page: 1, limit: 100, total: items.length }) }),
  );
}

test("M01-05.A07/A08/A15 grant list is responsive, stateful and keyboard navigable", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/?view=resource-grants");
  await expect(page.getByRole("heading", { name: "资源临时授权" })).toBeVisible();
  await page.getByRole("button", { name: /机会 · 00000000/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("采购团队核对供应报价")).toBeVisible();
  await page.getByRole("button", { name: "生效中", exact: true }).click();
  await expect(page.getByText("1 条授权")).toBeVisible();
});

test("M01-05.A07/A08 creation form exposes same-org member and safe action choices", async ({
  page,
}) => {
  await ready(page, []);
  await page.goto("/?view=resource-grants");
  await page.getByRole("button", { name: "新建授权" }).click();
  await expect(page.getByRole("heading", { name: "授权指定资源" })).toBeVisible();
  await expect(page.getByRole("option", { name: "buyer@example.test" })).toBeAttached();
  await expect(page.getByText("opportunity:read")).toBeVisible();
  await expect(page.getByText("collection:replay")).toHaveCount(0);
  await expect(page.getByText("不得超过 30 天；到期自动失效。")).toBeVisible();
});

test("M01-05.A08/A16 blocked grant explains exact recovery conditions", async ({ page }) => {
  await page.route("**/api/v1/me/authorization", (route) =>
    route.fulfill({ json: envelope(authorization) }),
  );
  await page.route(`**/api/v1/org/${org}/resource-grants*`, (route) =>
    route.fulfill({
      status: 400,
      json: { error: { code: "grant_expiry_invalid" }, request_id: "grant-blocked", trace_id: "t" },
    }),
  );
  await page.goto("/?view=resource-grants");
  await expect(page.getByText("授权条件不满足")).toBeVisible();
  await expect(
    page.getByText("确认目标是同组织活动成员、动作与资源匹配，且到期不超过 30 天。"),
  ).toBeVisible();
  await expect(page.getByText("请求标识：grant-blocked")).toBeVisible();
});

test("M01-05.A08 expired session requires reauthentication", async ({ page }) => {
  await page.route("**/api/v1/me/authorization", (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: "session_invalid" }, request_id: "grant-expired", trace_id: "t" },
    }),
  );
  await page.goto("/?view=resource-grants");
  await expect(page.getByText("登录已过期")).toBeVisible();
  await expect(page.getByRole("link", { name: "重新登录" })).toHaveAttribute("href", "/login");
});

test("UI2.scope.grants create extend cancel and revoke preserve exact request contracts", async ({
  page,
}) => {
  const unexpectedWrites: string[] = [];
  await page.route("**/api/v1/**", (route) => {
    if (route.request().method() !== "GET") {
      unexpectedWrites.push(route.request().url());
      return route.abort();
    }
    return route.fallback();
  });
  await ready(page, []);
  const writes: { method: string; path: string; body: Record<string, unknown> }[] = [];
  await page.route(`**/api/v1/org/${org}/resource-grants**`, async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ json: envelope([], { page: 1, limit: 100, total: 0 }) });
      return;
    }
    const pathname = new URL(request.url()).pathname;
    const body = request.postDataJSON();
    writes.push({ method: request.method(), path: pathname, body });
    expect(request.headers()["idempotency-key"]).toBeTruthy();
    const revoked = pathname.endsWith("/revoke");
    await route.fulfill({
      json: envelope({
        ...grant,
        reason: "UI2创建授权",
        version: writes.length,
        effective_status: revoked ? "revoked" : "active",
        status: revoked ? "revoked" : "active",
      }),
    });
  });
  await page.goto("/?view=resource-grants");
  await page.getByRole("button", { name: "创建首条授权" }).click();
  await page.getByLabel("资源类型").selectOption("task");
  await expect(page.getByLabel("task:read", { exact: true })).toBeChecked();
  await page.getByLabel("资源类型").selectOption("opportunity");
  await page.getByLabel("资源 ID").fill(resource);
  await page.getByLabel("目标成员").selectOption(membership);
  await page.getByLabel("业务原因").fill("UI2创建授权");
  await page.getByLabel("到期时间", { exact: true }).fill("2026-08-15T18:00");
  const expiry = await page
    .getByLabel("到期时间", { exact: true })
    .evaluate((node) => new Date((node as HTMLInputElement).value).toISOString());
  await page.getByRole("button", { name: "创建并审计" }).click();
  await expect(page.getByRole("status")).toHaveText("授权已创建并写入审计。");
  expect(writes).toEqual([
    {
      method: "POST",
      path: `/api/v1/org/${org}/resource-grants`,
      body: {
        workspace_id: workspace,
        resource_type: "opportunity",
        resource_id: resource,
        grantee_membership_id: membership,
        actions: ["opportunity:read"],
        reason: "UI2创建授权",
        expires_at: expiry,
      },
    },
  ]);
  await page.getByLabel("变更原因").fill("UI2延长授权");
  await page.getByLabel("新到期时间").fill("2026-08-20T18:00");
  const extendedExpiry = await page
    .getByLabel("新到期时间")
    .evaluate((node) => new Date((node as HTMLInputElement).value).toISOString());
  await page.getByRole("button", { name: "延长授权" }).click();
  await expect(page.getByRole("status")).toHaveText("到期时间已延长并写入审计。");
  expect(writes[1]).toEqual({
    method: "PATCH",
    path: `/api/v1/org/${org}/resource-grants/${grant.id}/expiry`,
    body: { expected_version: 1, reason: "UI2延长授权", expires_at: extendedExpiry },
  });
  await page.getByLabel("变更原因").fill("UI2撤销授权");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "撤销授权" }).click();
  expect(writes).toHaveLength(2);
  await expect(page.getByLabel("变更原因")).toHaveValue("UI2撤销授权");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "撤销授权" }).click();
  await expect(page.getByRole("status")).toHaveText("授权已撤销并立即失效。");
  expect(writes[2]).toEqual({
    method: "POST",
    path: `/api/v1/org/${org}/resource-grants/${grant.id}/revoke`,
    body: { expected_version: 2, reason: "UI2撤销授权" },
  });
  await expect(page.getByRole("button", { name: "撤销授权", exact: true })).toHaveCount(0);
  expect(unexpectedWrites).toEqual([]);
});
