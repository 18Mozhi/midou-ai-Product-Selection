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
      teams: ["治理组"],
      version: 2,
      joined_at: "2026-08-01T00:00:00.000Z",
    },
    {
      id: memberBuyer,
      email: "buyer@example.test",
      status: "active",
      roles: ["procurement_member"],
      scopes: ["workspace"],
      teams: ["采购协作组"],
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
      expires_at: "2026-09-11T00:00:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000617",
      email: "expired@example.test",
      role_code: "member",
      status: "expired",
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
          "report:read",
        ],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_organization_admin_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/org/admin/summary", (r) => r.fulfill({ json: env(summary) }));
  await page.route("**/api/v1/org/admin/profile", (r) => r.fulfill({ json: env(profile) }));
  await page.route("**/api/v1/org/admin/workspaces", (r) => r.fulfill({ json: env(workspaces) }));
  await page.route("**/api/v1/org/admin/members", (r) => r.fulfill({ json: env(members) }));
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
        templates: [
          {
            id: "00000000-0000-4000-8000-000000000618",
            name: "选品复核模板",
            workspace_name: "新品决策工作区",
            status: "published",
            node_count: 2,
            current_version: 3,
            version_diff: {
              from_version: 2,
              to_version: 3,
              change_count: 2,
              changes: [
                {
                  kind: "changed",
                  ordinal: 1,
                  node_name: "选品经理复核",
                  fields: [
                    {
                      field: "sla_minutes",
                      label: "处理时限（分钟）",
                      before: 60,
                      after: 30,
                    },
                  ],
                },
                {
                  kind: "added",
                  ordinal: 2,
                  node_name: "采购负责人确认",
                  fields: [],
                },
              ],
            },
          },
        ],
        items: [
          {
            id: "00000000-0000-4000-8000-000000000616",
            template_id: "00000000-0000-4000-8000-000000000618",
            resource_id: approvalResource,
            title: "厨房收纳机会复核",
            current_node_ordinal: 1,
            status: "pending",
            created_at: "2026-08-08T10:00:00.000Z",
          },
        ],
      }),
    }),
  );
  await page.route("**/api/v1/org/admin/roles", (r) =>
    r.fulfill({
      json: env([
        {
          code: "organization_admin",
          name: "组织管理员",
          description: "管理组织治理设置。",
          capabilities: ["organization:manage", "membership:manage"],
        },
        {
          code: "auditor",
          name: "审计员",
          description: "查看组织审计记录。",
          capabilities: ["audit:read"],
        },
      ]),
    }),
  );
  await page.route("**/api/v1/org/admin/data", (r) =>
    r.fulfill({
      json: env({
        comparisons: [
          {
            id: ws,
            name: "新品决策工作区",
            status: "active",
            trends: 38,
            opportunities: 12,
            tasks: 7,
            exports: 3,
          },
        ],
        exports: [
          {
            id: "00000000-0000-4000-8000-000000000619",
            workspace_name: "新品决策工作区",
            report_type: "opportunity",
            status: "succeeded",
            row_count: 12,
            created_at: "2026-08-08T10:00:00.000Z",
          },
        ],
        observed_at: "2026-08-08T12:00:00.000Z",
      }),
    }),
  );
  await page.route("**/api/v1/organizations/*/audit-events**", (r) =>
    r.fulfill({
      json: env({
        items: [
          {
            id: "00000000-0000-4000-8000-000000000620",
            action: "organization.member.disabled",
            resource_type: "membership",
            outcome: "succeeded",
            occurred_at: "2026-08-08T11:00:00.000Z",
          },
        ],
      }),
    }),
  );
}

test("M06-01.A07/A08/A15 desktop organization dashboard", async ({ page }) => {
  await setup(page);
  await page.goto("/org-admin");
  await expect(page.getByRole("heading", { name: "治理概览", level: 2 })).toBeVisible();
  await expect(page.getByText("128")).toBeVisible();
  await expect(page.getByText("1238")).toBeVisible();
  await expect(page.getByText("新品决策工作区").first()).toBeVisible();
  await expect(page.getByLabel("默认工作区")).toHaveValue(ws);
  await expect(page.getByText(ws, { exact: true })).toHaveCount(0);
});

test("M06-01.A07/A08/A15 mobile member and invitation state", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/org-admin/members");
  await expect(page.getByRole("heading", { name: "成员与邀请", level: 2 })).toBeVisible();
  await expect(page.getByText("new@example.test")).toBeVisible();
  await expect(page.getByText("admin@example.test")).toBeVisible();
  await page.getByRole("button", { name: /已失效/ }).click();
  await expect(page.getByText("expired@example.test")).toBeVisible();
  await page.getByRole("button", { name: /待接受/ }).click();
  await page.getByLabel("团队").selectOption("采购协作组");
  await expect(page.getByText("buyer@example.test")).toBeVisible();
  await expect(page.getByText("admin@example.test")).toHaveCount(0);
  const memberId = page.locator("code").filter({ hasText: memberBuyer });
  await expect(memberId).not.toBeVisible();

  await page.getByText("技术详情", { exact: true }).first().click();
  await expect(memberId).toBeVisible();
});

test("organization member choices replace raw ids and approval ids stay technical", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/org-admin/teams");
  await expect(page.getByLabel("负责人（可选）")).toContainText("admin@example.test");
  await expect(page.getByLabel("选择团队成员")).toContainText("buyer@example.test");
  await expect(page.getByText(memberBuyer, { exact: true })).toHaveCount(0);

  await page.goto("/org-admin/approvals");
  await expect(page.getByText("选品复核模板", { exact: true })).toBeVisible();
  await expect(page.getByText("厨房收纳机会复核", { exact: true })).toBeVisible();
  await page.getByText(/预览 v2 → v3 差异/).click();
  await expect(page.getByText("处理时限（分钟）")).toBeVisible();
  await expect(page.getByText("60 → 30")).toBeVisible();
  await expect(page.getByText("当前版本新增")).toBeVisible();
  const resourceId = page.locator("code").filter({ hasText: approvalResource });
  await expect(resourceId).not.toBeVisible();
  await page.getByText("技术详情", { exact: true }).click();
  await expect(resourceId).toBeVisible();
});

test("organization governance matrix, data comparison and audit filters", async ({ page }) => {
  await setup(page);
  await page.goto("/org-admin/roles");
  await expect(page.getByRole("table", { name: "角色能力矩阵" })).toBeVisible();

  await page.goto("/org-admin/data");
  await expect(page.getByRole("table", { name: "跨工作区数据比较" })).toBeVisible();
  await expect(page.getByText("新品决策工作区").first()).toBeVisible();

  await page.goto("/org-admin/audit");
  await page.getByLabel("操作").fill("organization.member");
  await page.getByLabel("结果").selectOption("succeeded");
  await page.getByLabel("对象", { exact: true }).fill("membership");
  await page.getByRole("button", { name: "应用筛选" }).click();
  await expect(page.getByText("organization.member.disabled")).toBeVisible();
});
