import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const org = "00000000-0000-4000-8000-000000000601";
const ws = "00000000-0000-4000-8000-000000000602";
const memberAdmin = "00000000-0000-4000-8000-000000000611";
const memberBuyer = "00000000-0000-4000-8000-000000000612";
const approvalResource = "00000000-0000-4000-8000-000000000614";
const env = (data: unknown) => ({
  data,
  request_id: "m06-01-e2e",
  trace_id: "m06-01-e2e",
});
const summary = {
  organization: {
    id: org,
    name: "Global Goods Co.",
    timezone: "Asia/Shanghai",
    data_retention_days: 365,
    default_workspace_id: ws,
    version: 3,
  },
  members: { total: 128, active: 96 },
  workspaces: { total: 8, active: 8 },
  teams: { total: 24, active: 24 },
  pending_approvals: 7,
  active_tokens: 18,
  recent_audit_events: 1238,
  observed_at: "2026-08-08T12:00:00.000Z",
};
const profile = {
  id: org,
  name: "Global Goods Co.",
  logo_url: "https://example.test/logo.png",
  slug: "global-goods",
  status: "active",
  timezone: "Asia/Shanghai",
  data_retention_days: 365,
  default_workspace_id: ws,
  version: 3,
  updated_at: "2026-08-08T12:00:00.000Z",
};
const workspaces = [
  {
    id: ws,
    name: "新品决策工作区",
    slug: "new-products",
    status: "active",
    member_count: 96,
    version: 3,
  },
];
const members = {
  items: [
    {
      id: memberAdmin,
      email: "admin@example.test",
      status: "active",
      roles: ["organization_admin"],
      scopes: ["organization"],
      version: 2,
      joined_at: "2026-08-01T00:00:00.000Z",
    },
    {
      id: memberBuyer,
      email: "buyer@example.test",
      status: "active",
      roles: ["procurement_member"],
      scopes: ["workspace"],
      version: 1,
      joined_at: "2026-08-02T00:00:00.000Z",
    },
  ],
  invitations: [
    {
      id: "00000000-0000-4000-8000-000000000613",
      email: "new@example.test",
      role_code: "member",
      status: "pending_delivery",
      expires_at: "2026-08-11T00:00:00.000Z",
    },
  ],
};

async function setup(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=organization_admin", (r) =>
    r.fulfill({
      json: env({
        shell: "organization_admin",
        organization_id: org,
        workspace_id: ws,
        roles: ["organization_admin"],
        capabilities: [
          "organization:manage",
          "membership:read",
          "membership:manage",
          "workspace:manage",
          "team:manage",
          "role:read",
          "role:manage",
          "organization_token:manage",
          "audit:read",
          "opportunity:approve",
        ],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_organization_admin_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/org/admin/summary", (r) =>
    r.fulfill({ json: env(summary) }),
  );
  await page.route("**/api/v1/org/admin/profile", (r) =>
    r.fulfill({ json: env(profile) }),
  );
  await page.route("**/api/v1/org/admin/workspaces", (r) =>
    r.fulfill({ json: env(workspaces) }),
  );
  await page.route("**/api/v1/org/admin/members", (r) =>
    r.fulfill({ json: env(members) }),
  );
  await page.route("**/api/v1/org/admin/teams", (r) =>
    r.fulfill({
      json: env([
        {
          id: "00000000-0000-4000-8000-000000000615",
          name: "采购协作组",
          status: "active",
          member_count: 2,
          lead_email: "admin@example.test",
        },
      ]),
    }),
  );
  await page.route("**/api/v1/org/admin/approvals", (r) =>
    r.fulfill({
      json: env({
        summary: { pending: 1 },
        items: [
          {
            id: "00000000-0000-4000-8000-000000000616",
            resource_id: approvalResource,
            current_node_key: "manager_review",
            status: "pending",
            requested_at: "2026-08-08T10:00:00.000Z",
          },
        ],
      }),
    }),
  );
}

test("M06-01.A07/A08/A15 desktop organization dashboard", async ({ page }) => {
  await setup(page);
  await page.goto("/org-admin");
  await expect(
    page.getByRole("heading", { name: "组织资料", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("128")).toBeVisible();
  await expect(page.getByText("1238")).toBeVisible();
  await expect(page.getByText("新品决策工作区").first()).toBeVisible();
  await expect(page.getByLabel("默认工作区")).toHaveValue(ws);
  await expect(page.getByText(ws, { exact: true })).toHaveCount(0);
  await expect(page).toHaveScreenshot("m06-01-organization-admin-desktop.png", {
    fullPage: true,
  });
});

test("M06-01.A07/A08/A15 mobile member and invitation state", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/org-admin/members");
  await expect(
    page.getByRole("heading", { name: "成员与邀请", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("new@example.test")).toBeVisible();
  await expect(page.getByText("admin@example.test")).toBeVisible();
  const memberId = page.locator("code").filter({ hasText: memberAdmin });
  await expect(memberId).not.toBeVisible();
  await expect(page).toHaveScreenshot("m06-01-organization-admin-mobile-390.png", {
    fullPage: true,
  });
  await page.getByText("技术详情", { exact: true }).first().click();
  await expect(memberId).toBeVisible();
});

test("organization member choices replace raw ids and approval ids stay technical", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/org-admin/workspaces");
  await expect(page.getByLabel("负责人（可选）")).toContainText(
    "admin@example.test",
  );
  await expect(page.getByLabel("选择团队成员")).toContainText(
    "buyer@example.test",
  );
  await expect(page.getByText(memberBuyer, { exact: true })).toHaveCount(0);

  await page.goto("/org-admin/approvals");
  await expect(page.getByText("业务申请", { exact: true })).toBeVisible();
  const resourceId = page.locator("code").filter({ hasText: approvalResource });
  await expect(resourceId).not.toBeVisible();
  await page.getByText("技术详情", { exact: true }).click();
  await expect(resourceId).toBeVisible();
});
