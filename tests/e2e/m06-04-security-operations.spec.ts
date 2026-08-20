import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const env = (data: any) => ({ data, request_id: "m06-04-e2e", trace_id: "m06-04-e2e" }),
  data = {
    window: "24h",
    summary: {
      security_events: 14,
      risk_events: 2,
      active_sessions: 8,
      active_credentials: 3,
      credentials_expiring: 1,
      active_org_tokens: 5,
    },
    security_events: [
      {
        id: "e1",
        user_id: "00000000-0000-4000-8000-000000000641",
        event_type: "login.failed",
        outcome: "failed",
        request_id: "r",
        trace_id: "trace-0604",
        occurred_at: "2026-08-08T12:00:00Z",
      },
    ],
    sessions: [
      {
        id: "s1",
        user_id: "u1",
        email: "security@example.test",
        status: "active",
        device_label: "Windows Chrome",
        expires_at: "2026-08-09T12:00:00Z",
        last_seen_at: "2026-08-08T12:00:00Z",
        created_at: "2026-08-01T00:00:00Z",
      },
    ],
    credential_assets: [
      {
        id: "c1",
        provider_id: "p1",
        provider_name: "公开趋势 RSS",
        name: "生产读取凭证",
        kind: "api_key",
        key_version: "v3",
        fingerprint: "0123456789abcdef",
        status: "active",
        expires_at: "2026-08-15T00:00:00Z",
        rotated_at: "2026-08-01T00:00:00Z",
        version: 3,
        updated_at: "2026-08-08T00:00:00Z",
      },
    ],
    organization_tokens: [
      {
        id: "t1",
        organization_id: "o1",
        name: "报表客户端",
        token_prefix: "sco_org_public",
        status: "active",
        scopes: ["report:read"],
        expires_at: "2026-09-01T00:00:00Z",
        last_used_at: null,
        version: 1,
        updated_at: "2026-08-08T00:00:00Z",
      },
    ],
    audit_events: [],
    links: {
      credential_assets: "/platform-admin/credentials",
      audit_search: "/?view=audit-security",
    },
    observed_at: "2026-08-08T12:00:00Z",
  };
async function nav(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=platform_admin", (r) =>
    r.fulfill({
      json: env({
        shell: "platform_admin",
        organization_id: null,
        workspace_id: null,
        roles: [],
        capabilities: [],
        platform_roles: ["platform_security_admin"],
        platform_capabilities: ["platform:secure"],
        guard_reason: "allowed",
      }),
    }),
  );
}
test("M06-04.A07/A08/A15 security operations visual sanitized", async ({ page }) => {
  await nav(page);
  await page.route("**/api/v1/platform/security/operations?**", (r) =>
    r.fulfill({ json: env(data) }),
  );
  await page.goto("/platform-admin/security");
  await expect(page.getByRole("heading", { name: "安全与密钥运营", level: 2 })).toBeVisible();
  await expect(page.getByText("0123456789abcdef", { exact: true })).not.toBeVisible();
  if ((page.viewportSize()?.width ?? 0) <= 760) {
    await page.getByRole("button", { name: /生产读取凭证/ }).click();
    const credentialDialog = page.getByRole("dialog", { name: "生产读取凭证" });
    await credentialDialog.getByText("技术详情").click();
    await expect(credentialDialog.getByText("0123456789abcdef", { exact: true })).toBeVisible();
    await credentialDialog.getByRole("button", { name: "关闭详情" }).click();
    await page.getByRole("button", { name: /报表客户端/ }).click();
    const tokenDialog = page.getByRole("dialog", { name: "报表客户端" });
    await tokenDialog.getByText("技术详情").click();
    await expect(tokenDialog.getByText("sco_org_public", { exact: true })).toBeVisible();
    await tokenDialog.getByRole("button", { name: "关闭详情" }).click();
  } else {
    const credentialSection = page.getByRole("heading", { name: "凭证生命周期" }).locator("..");
    await credentialSection.locator("summary").click();
    await expect(credentialSection.getByText("0123456789abcdef", { exact: true })).toBeVisible();
    await credentialSection.locator("summary").click();
    const tokenSection = page.getByRole("heading", { name: "组织访问令牌" }).locator("..");
    await tokenSection.locator("summary").click();
    await expect(tokenSection.getByText("sco_org_public", { exact: true })).toBeVisible();
    await tokenSection.locator("summary").click();
  }
  await expect(page.getByText(/payload_ciphertext|token_hash|cookie-secret/)).toHaveCount(0);
  await expect(page).toHaveScreenshot("m06-04-security-operations-desktop.png", { fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByText("登录与风险事件")).toBeVisible();
  await page.getByRole("button", { name: /登录失败/ }).click();
  const eventDialog = page.getByRole("dialog", { name: "登录失败" });
  await expect(eventDialog).toBeVisible();
  await eventDialog.getByText("技术详情").click();
  await expect(
    eventDialog.getByText(data.security_events[0].user_id, { exact: true }),
  ).toBeVisible();
  await eventDialog.getByRole("button", { name: "关闭详情" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("m06-04-security-operations-mobile.png", { fullPage: true });
});
test("M06-04.A08/A16 empty forbidden blocked", async ({ page }) => {
  await nav(page);
  let status = 200;
  await page.route("**/api/v1/platform/security/operations?**", (r) =>
    r.fulfill(
      status === 200
        ? {
            json: env({
              ...data,
              summary: Object.fromEntries(Object.keys(data.summary).map((k) => [k, 0])),
            }),
          }
        : {
            status,
            contentType: "application/json",
            body: JSON.stringify({
              error: { action_hint: "按状态恢复" },
              request_id: `m06-04-${status}`,
              trace_id: "x",
            }),
          },
    ),
  );
  await page.goto("/platform-admin/security");
  await expect(page.getByRole("heading", { name: "当前时间窗没有安全事件" })).toBeVisible();
  status = 403;
  await page.reload();
  await expect(page.getByRole("heading", { name: "你没有安全运营权限" })).toBeVisible();
  status = 503;
  await page.reload();
  await expect(page.getByRole("heading", { name: "安全运营依赖受阻" })).toBeVisible();
});
