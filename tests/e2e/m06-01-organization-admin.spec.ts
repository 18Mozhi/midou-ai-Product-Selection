import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

const org = "00000000-0000-4000-8000-000000000601";
const ws = "00000000-0000-4000-8000-000000000602";
const memberAdmin = "00000000-0000-4000-8000-000000000611";
const memberBuyer = "00000000-0000-4000-8000-000000000612";
const approvalResource = "00000000-0000-4000-8000-000000000614";
const grantResource = "00000000-0000-4000-8000-000000000624";
const activeGrant = {
  id: "00000000-0000-4000-8000-000000000625",
  organization_id: org,
  workspace_id: ws,
  resource_type: "opportunity",
  resource_id: grantResource,
  grantee_membership_id: memberBuyer,
  grantor_id: "00000000-0000-4000-8000-000000000626",
  reason: "采购团队核对供应报价",
  status: "active",
  effective_status: "active",
  expires_at: "2026-09-01T10:00:00.000Z",
  revoked_at: null,
  revoked_by: null,
  revocation_reason: null,
  version: 1,
  created_at: "2026-08-20T10:00:00.000Z",
  updated_at: "2026-08-20T10:00:00.000Z",
  actions: ["opportunity:read", "opportunity:decide"],
};
const env = (data: unknown, meta?: unknown) => ({
  data,
  ...(meta ? { meta } : {}),
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
const organizationTokens = Array.from({ length: 8 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(900 + index).padStart(12, "0")}`,
  name: index === 0 ? "月度经营报表" : `只读系统 ${index + 1}`,
  token_prefix: `sco_org_e2e_${index + 1}`,
  scopes: index % 2 ? ["task:read"] : ["trend:read", "report:read"],
  status: index === 6 ? "rotated" : index === 7 ? "revoked" : "active",
  expires_at: index === 0 ? "2026-08-30T12:00:00.000Z" : "2027-08-08T12:00:00.000Z",
  last_used_at: index === 1 ? null : "2026-08-08T11:00:00.000Z",
  version: 1,
  created_at: `2026-08-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`,
  updated_at: "2026-08-08T12:00:00.000Z",
}));
const organizationAuditEvents = Array.from({ length: 55 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(620 + index).padStart(12, "0")}`,
  organization_id: org,
  workspace_id: ws,
  actor_id: memberAdmin,
  action:
    index % 3 === 0
      ? "organization.member.invited"
      : index % 3 === 1
        ? "organization.collection.run.failed"
        : "organization.collection.run.blocked",
  resource_type: index % 3 === 0 ? "membership" : "collection_run",
  resource_id: `00000000-0000-4000-8000-${String(760 + index).padStart(12, "0")}`,
  outcome: index % 3 === 0 ? "succeeded" : index % 3 === 1 ? "failed" : "blocked",
  request_id: `m06-01-audit-request-${String(index + 1).padStart(3, "0")}`,
  trace_id: `m06-01-audit-trace-${String(Math.floor(index / 4) + 1).padStart(3, "0")}`,
  metadata:
    index === 0
      ? { reason: "新增采购成员", api_token: "synthetic-redaction-probe" }
      : { source: "e2e", sequence: index + 1 },
  occurred_at: new Date(Date.parse("2026-08-27T10:00:00.000Z") - index * 60_000).toISOString(),
  schema_version: 1,
}));
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
      display_name: "林管理员",
      email: "admin@example.test",
      account_status: "active",
      status: "active",
      roles: ["organization_admin"],
      scopes: ["organization"],
      teams: ["治理组"],
      version: 2,
      joined_at: "2026-08-01T00:00:00.000Z",
    },
    {
      id: memberBuyer,
      display_name: "陈采购",
      email: "buyer@example.test",
      account_status: "active",
      status: "active",
      roles: ["procurement_member"],
      scopes: ["workspace"],
      teams: ["采购协作组"],
      version: 1,
      joined_at: "2026-08-02T00:00:00.000Z",
    },
    {
      id: "00000000-0000-4000-8000-000000000621",
      display_name: "钱锁定",
      email: "locked@example.test",
      account_status: "locked",
      status: "active",
      roles: ["member"],
      scopes: ["organization"],
      teams: [],
      version: 1,
      joined_at: "2026-08-03T00:00:00.000Z",
    },
  ],
  invitations: [
    {
      id: "00000000-0000-4000-8000-000000000613",
      email: "new@example.test",
      role_code: "member",
      status: "pending_delivery",
      expires_at: "2026-09-11T00:00:00.000Z",
      version: 1,
    },
    {
      id: "00000000-0000-4000-8000-000000000617",
      email: "expired@example.test",
      role_code: "member",
      status: "expired",
      expires_at: "2026-08-11T00:00:00.000Z",
      version: 2,
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
  await page.route("**/api/v1/me/authorization", (r) =>
    r.fulfill({
      json: env({
        organization_id: org,
        workspace_id: ws,
        roles: ["organization_admin"],
        capabilities: ["role:read", "role:manage", "membership:read"],
        data_scopes: [{ scope: "organization" }],
      }),
    }),
  );
  await page.route(`**/api/v1/org/${org}/resource-grant-targets`, (r) =>
    r.fulfill({
      json: env([
        {
          id: memberBuyer,
          user_id: "00000000-0000-4000-8000-000000000627",
          email: "buyer@example.test",
          status: "active",
        },
      ]),
    }),
  );
  await page.route(`**/api/v1/org/${org}/resource-grants*`, (r) => {
    if (r.request().method() !== "GET")
      return r.fulfill({ status: 201, json: env({ ...activeGrant, version: 2 }) });
    const query = new URL(r.request().url()).searchParams,
      status = query.get("status"),
      items = !status || status === "active" ? [activeGrant] : [],
      pageNumber = Number(query.get("page") ?? 1),
      limit = Number(query.get("limit") ?? 20);
    return r.fulfill({
      json: env(items, { page: pageNumber, limit, total: items.length }),
    });
  });
  await page.route("**/api/v1/org/admin/teams", (r) =>
    r.fulfill({
      json: env([
        {
          id: "00000000-0000-4000-8000-000000000615",
          name: "采购协作组",
          status: "active",
          member_count: 2,
          lead_membership_id: memberAdmin,
          lead_email: "admin@example.test",
          default_workflow_key: "opportunity-review",
          version: 1,
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-08-20T00:00:00.000Z",
        },
      ]),
    }),
  );
  await page.route("**/api/v1/org/admin/approvals", (r) =>
    r.fulfill({
      json: env({
        summary: { pending: 3, approved: 3, rejected: 2, cancelled: 2 },
        templates: [
          {
            id: "00000000-0000-4000-8000-000000000618",
            name: "选品复核模板",
            workspace_name: "新品决策工作区",
            resource_type: "opportunity_decision",
            status: "published",
            node_count: 2,
            current_version: 3,
            revision: 4,
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
          {
            id: "00000000-0000-4000-8000-000000000619",
            name: "采购首次审批模板",
            workspace_name: "采购协作工作区",
            resource_type: "task",
            status: "draft",
            node_count: 1,
            current_version: 1,
            revision: 1,
            version_diff: {
              from_version: null,
              to_version: 1,
              change_count: 0,
              changes: [],
            },
          },
        ],
        items: Array.from({ length: 10 }, (_, index) => ({
          id:
            index === 0
              ? "00000000-0000-4000-8000-000000000616"
              : `00000000-0000-4000-8000-${String(700 + index).padStart(12, "0")}`,
          template_id:
            index % 2
              ? "00000000-0000-4000-8000-000000000619"
              : "00000000-0000-4000-8000-000000000618",
          resource_id:
            index === 0
              ? approvalResource
              : `00000000-0000-4000-8000-${String(800 + index).padStart(12, "0")}`,
          resource_type: index % 2 ? "task" : "opportunity_decision",
          title: index === 0 ? "厨房收纳机会复核" : `审批记录 ${index + 1}`,
          current_node_ordinal: (index % 3) + 1,
          status: ["pending", "approved", "rejected", "cancelled"][index % 4],
          created_at: `2026-08-${String(18 - index).padStart(2, "0")}T10:00:00.000Z`,
          completed_at: index % 4 === 0 ? null : "2026-08-20T10:00:00.000Z",
        })),
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
        comparisons: Array.from({ length: 12 }, (_, index) => ({
          id: index === 0 ? ws : `00000000-0000-4000-8000-${String(630 + index).padStart(12, "0")}`,
          name:
            index === 0
              ? "新品决策工作区"
              : index === 11
                ? "历史归档工作区"
                : `业务工作区 ${String(index + 1).padStart(2, "0")}`,
          status: index === 11 ? "archived" : "active",
          trends: 38 - index,
          opportunities: 12 + index,
          tasks: 7 + index,
          exports: 3 + (index % 4),
        })),
        exports: Array.from({ length: 23 }, (_, index) => ({
          id:
            index === 0
              ? "00000000-0000-4000-8000-000000000619"
              : `00000000-0000-4000-8000-${String(700 + index).padStart(12, "0")}`,
          workspace_name: index % 2 ? "业务工作区 02" : "新品决策工作区",
          report_type: ["opportunity", "trend", "team"][index % 3],
          status: ["succeeded", "queued", "leased", "retry_scheduled", "dead_letter", "expired"][
            index % 6
          ],
          row_count: index % 6 === 0 ? 12 + index : null,
          created_at: `2026-08-${String(23 - index).padStart(2, "0")}T10:00:00.000Z`,
          updated_at: `2026-08-${String(23 - index).padStart(2, "0")}T11:00:00.000Z`,
        })),
        observed_at: "2026-08-08T12:00:00.000Z",
      }),
    }),
  );
  await page.route("**/api/v1/org/admin/tokens", (r) =>
    r.fulfill({ json: env(organizationTokens) }),
  );
  await page.route("**/api/v1/organizations/*/audit-events**", (route) => {
    const query = new URL(route.request().url()).searchParams,
      filtered = organizationAuditEvents.filter(
        (event) =>
          (!query.get("action") || event.action === query.get("action")) &&
          (!query.get("outcome") || event.outcome === query.get("outcome")) &&
          (!query.get("resource_type") || event.resource_type === query.get("resource_type")) &&
          (!query.get("request_id") || event.request_id === query.get("request_id")) &&
          (!query.get("trace_id") || event.trace_id === query.get("trace_id")),
      ),
      cursorIndex = query.get("cursor")
        ? filtered.findIndex((event) => event.id === query.get("cursor")) + 1
        : 0,
      limit = Number(query.get("limit") ?? 50),
      items = filtered.slice(cursorIndex, cursorIndex + limit),
      nextCursor = filtered.length > cursorIndex + limit ? (items.at(-1)?.id ?? null) : null;
    return route.fulfill({ json: env({ items, nextCursor }) });
  });
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

test("organization overview keeps facts visible during refresh and retains audited success", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/org-admin");
  await expect(page.locator(".org-admin-center")).toHaveAttribute("data-state", "ready");

  let releaseRefresh: () => void = () => {};
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  await page.route("**/api/v1/org/admin/summary", async (route) => {
    await refreshGate;
    await route.fallback();
  });
  await page.getByRole("button", { name: "刷新数据" }).click();
  await expect(page.locator(".org-admin-center")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".org-admin-metrics article")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "正在刷新…" })).toBeDisabled();
  releaseRefresh();
  await expect(page.locator(".org-admin-center")).toHaveAttribute("aria-busy", "false");

  await page.getByLabel("变更原因").fill("验证成功反馈");
  await page.getByRole("button", { name: "保存并审计" }).click();
  await expect(page.getByRole("status")).toContainText("操作已完成并写入审计");
  await expect(page.getByRole("status")).toContainText("m06-01-e2e");
});

test("organization overview keeps the form available for validation and version conflicts", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/org-admin");
  await expect(page.locator(".org-admin-center")).toHaveAttribute("data-state", "ready");

  let patchRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      new URL(request.url()).pathname === "/api/v1/org/admin/profile"
    )
      patchRequests += 1;
  });
  await page.getByLabel("Logo HTTPS 地址").fill("http://example.test/logo.png");
  await page.getByLabel("变更原因").fill("验证 HTTPS 校验");
  await page.getByRole("button", { name: "保存并审计" }).click();
  await expect(page.getByLabel("Logo HTTPS 地址")).toHaveJSProperty(
    "validationMessage",
    "Logo 地址必须以 https:// 开头，或保持为空。",
  );
  expect(patchRequests).toBe(0);

  await page.getByLabel("Logo HTTPS 地址").fill("https://example.test/logo.png");
  await page.route("**/api/v1/org/admin/profile", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    await route.fulfill({
      status: 409,
      json: {
        error: {
          code: "organization_version_conflict",
          message: "organization_version_conflict",
          action_hint: "刷新页面后重试。",
        },
        request_id: "m06-01-conflict",
        trace_id: "m06-01-conflict",
      },
    });
  });
  await page.getByRole("button", { name: "保存并审计" }).click();
  await expect(page.locator(".org-admin-center")).toHaveAttribute("data-state", "ready");
  await expect(page.getByRole("button", { name: "保存并审计" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("数据已被其他操作更新");
  await expect(page.getByRole("alert")).toContainText("m06-01-conflict");
});

test("organization overview shows an explicit blocked state and recovers with real facts", async ({
  page,
}) => {
  await setup(page);
  const blockedHandler = async (route: Route) => {
    await route.fulfill({
      status: 503,
      json: {
        error: {
          code: "organization_service_unavailable",
          message: "组织数据暂时不可读取。",
          action_hint: "检查服务状态后重试。",
        },
        request_id: "m06-01-blocked",
        trace_id: "m06-01-blocked",
      },
    });
  };
  await page.route("**/api/v1/org/admin/**", blockedHandler);
  await page.goto("/org-admin");
  await expect(page.locator(".org-admin-center")).toHaveAttribute("data-state", "blocked");
  await expect(page.getByRole("heading", { name: "组织数据暂不可用" })).toBeVisible();
  await expect(page.locator(".org-admin-metrics article")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "保存并审计" })).toHaveCount(0);
  await expect(page.getByText("m06-01-blocked")).toBeVisible();

  await page.unroute("**/api/v1/org/admin/**", blockedHandler);
  await page.getByRole("button", { name: "重新加载" }).click();
  await expect(page.locator(".org-admin-center")).toHaveAttribute("data-state", "ready");
  await expect(page.locator(".org-admin-metrics article")).toHaveCount(6);
});

test("organization workspaces expose truthful governance controls and audited writes", async ({
  page,
}) => {
  const workspaceRows = Array.from({ length: 10 }, (_, index) => ({
      id: index === 0 ? ws : `00000000-0000-4000-8000-${String(index + 800).padStart(12, "0")}`,
      name: index === 0 ? "新品决策工作区" : `区域工作区 ${index}`,
      slug: index === 0 ? "new-products" : `region-${index}`,
      status: index === 9 ? "archived" : "active",
      member_count: 10 - index,
      version: 1,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    })),
    writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  await setup(page);
  await page.unroute("**/api/v1/org/admin/workspaces");
  await page.route("**/api/v1/org/admin/workspaces**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (request.method() === "GET") return route.fulfill({ json: env(workspaceRows) });
    const body = request.postDataJSON();
    writes.push({ path, body });
    if (path.endsWith("/actions")) {
      const target = workspaceRows.find((item) => path.includes(item.id));
      if (target) {
        target.status = body.action === "archive" ? "archived" : "active";
        target.version += 1;
      }
      return route.fulfill({ json: env(target) });
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    workspaceRows.push({
      id: "00000000-0000-4000-8000-000000000899",
      name: body.name,
      slug: body.slug,
      status: "active",
      member_count: 0,
      version: 1,
      created_at: "2026-08-27T00:00:00.000Z",
      updated_at: "2026-08-27T00:00:00.000Z",
    });
    return route.fulfill({ status: 201, json: env(workspaceRows.at(-1)) });
  });

  await page.goto("/org-admin/workspaces");
  const workspaceItems = page.locator('.org-workspace-list > [role="listitem"]');
  await expect(page.getByRole("region", { name: "工作区治理台" })).toBeVisible();
  await expect(page.getByLabel("工作区统计")).toContainText("10");
  await expect(workspaceItems).toHaveCount(8);
  await expect(page.getByRole("navigation", { name: "工作区分页" })).toContainText(
    "第 1 / 2 页 · 共 10 条",
  );
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(workspaceItems).toHaveCount(2);

  await page.getByRole("searchbox", { name: "搜索工作区" }).fill("区域工作区 9");
  await expect(workspaceItems).toHaveCount(1);
  await page.getByRole("button", { name: /已归档 1/ }).click();
  await expect(workspaceItems).toHaveCount(1);
  await page.getByRole("button", { name: "重置筛选" }).click();
  await expect(page.getByRole("button", { name: "默认工作区不可归档" })).toBeDisabled();

  await page.getByRole("listitem", { name: "选择工作区 区域工作区 1" }).click();
  await page.getByRole("button", { name: "归档工作区" }).click();
  const archiveDialog = page.getByRole("dialog", { name: "归档工作区原因" });
  await archiveDialog.getByRole("textbox").fill("区域业务已经结束");
  await archiveDialog.getByRole("button", { name: "确认提交" }).click();
  await expect(page.getByRole("status")).toContainText("工作区已归档并写入审计");

  let createRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/v1/org/admin/workspaces"
    )
      createRequests += 1;
  });
  await page.getByRole("button", { name: "新建工作区" }).click();
  await page.getByLabel("工作区名称").fill("亚太增长验证");
  await page.getByLabel("英文标识").fill("Invalid Slug");
  await page.getByLabel("创建原因").fill("建立亚太市场数据边界");
  await page.getByRole("button", { name: "创建并写入审计" }).click();
  expect(
    await page
      .getByLabel("英文标识")
      .evaluate((element: HTMLInputElement) => element.validity.patternMismatch),
  ).toBe(true);
  expect(createRequests).toBe(0);
  await page.getByLabel("英文标识").fill("apac-growth");
  await page.getByRole("button", { name: "创建并写入审计" }).dblclick();
  await expect(page.getByRole("status")).toContainText("工作区已创建并写入审计");

  expect(writes).toHaveLength(2);
  expect(writes[0]).toMatchObject({
    body: { action: "archive", expected_version: 1, reason: "区域业务已经结束" },
  });
  expect(writes[1]).toMatchObject({
    path: "/api/v1/org/admin/workspaces",
    body: {
      name: "亚太增长验证",
      slug: "apac-growth",
      reason: "建立亚太市场数据边界",
    },
  });
});

test("organization workspaces show an actionable empty state without invented rows", async ({
  page,
}) => {
  await setup(page);
  await page.unroute("**/api/v1/org/admin/workspaces");
  await page.route("**/api/v1/org/admin/workspaces", (route) => route.fulfill({ json: env([]) }));
  await page.goto("/org-admin/workspaces");
  await expect(page.getByRole("heading", { name: "当前组织还没有工作区" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "新建工作区" })).toBeVisible();
  await expect(page.locator('.org-workspace-list > [role="listitem"]')).toHaveCount(0);
  await expect(page.getByText("创建首个工作区后，业务数据才能获得明确边界。")).toBeVisible();
});

test("organization teams expose searchable governance, bounded creation and audited membership writes", async ({
  page,
}) => {
  const teamRows = Array.from({ length: 10 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 900).padStart(12, "0")}`,
      name: `团队治理样本 ${String(index + 1).padStart(2, "0")}`,
      status: index === 9 ? "archived" : "active",
      member_count: index % 4,
      lead_membership_id: index % 2 ? memberBuyer : null,
      lead_email: index % 2 ? "buyer@example.test" : null,
      default_workflow_key: index % 3 ? null : `workflow-${index + 1}`,
      version: 1,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
    })),
    writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  await setup(page);
  await page.unroute("**/api/v1/org/admin/teams");
  await page.route("**/api/v1/org/admin/teams**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (request.method() === "GET") return route.fulfill({ json: env(teamRows) });
    const body = request.postDataJSON();
    writes.push({ path, body });
    if (path.endsWith("/members")) {
      const target = teamRows.find((team) => path.includes(team.id));
      if (target)
        target.member_count += body.action === "assign" ? 1 : Math.max(-target.member_count, -1);
      return route.fulfill({ json: env({ id: target?.id, ...body }) });
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    teamRows.push({
      id: "00000000-0000-4000-8000-000000000999",
      name: body.name,
      status: "active",
      member_count: body.lead_membership_id ? 1 : 0,
      lead_membership_id: body.lead_membership_id || null,
      lead_email: body.lead_membership_id ? "buyer@example.test" : null,
      default_workflow_key: body.default_workflow_key || null,
      version: 1,
      created_at: "2026-08-27T00:00:00.000Z",
      updated_at: "2026-08-27T00:00:00.000Z",
    });
    return route.fulfill({ status: 201, json: env(teamRows.at(-1)) });
  });

  await page.goto("/org-admin/teams");
  const teamItems = page.locator('.org-team-list > [role="listitem"]');
  await expect(page.getByRole("region", { name: "团队治理台" })).toBeVisible();
  await expect(page.getByLabel("团队统计")).toContainText("10");
  await expect(teamItems).toHaveCount(8);
  await expect(page.getByRole("navigation", { name: "团队分页" })).toContainText(
    "第 1 / 2 页 · 共 10 条",
  );
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(teamItems).toHaveCount(2);
  await page.getByRole("searchbox", { name: "搜索团队" }).fill("团队治理样本 10");
  await expect(teamItems).toHaveCount(1);
  await page.getByRole("button", { name: /已归档 1/ }).click();
  await expect(teamItems).toHaveCount(1);
  await page.getByRole("button", { name: "重置筛选" }).click();

  await page.getByRole("listitem", { name: "选择团队 团队治理样本 02" }).click();
  await expect(page.getByRole("heading", { name: "团队治理样本 02" })).toBeVisible();
  await page.getByLabel("当前组织成员").selectOption(memberBuyer);
  await page.getByRole("button", { name: "分配成员" }).click();
  const assignDialog = page.getByRole("dialog", { name: "分配团队成员原因" });
  await assignDialog.getByRole("textbox").fill("加入采购协作范围");
  await assignDialog.getByRole("button", { name: "确认提交" }).click();
  await expect(page.locator(".org-admin-notice")).toContainText("成员已分配并写入审计");

  let createRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/v1/org/admin/teams"
    )
      createRequests += 1;
  });
  await page.getByRole("button", { name: "新建团队" }).click();
  await page.getByLabel("团队名称").fill("A".repeat(121));
  await expect(page.getByLabel("团队名称")).toHaveValue("A".repeat(120));
  await page.getByLabel("团队名称").fill("亚太新品采购组");
  await page.getByLabel("负责人（可选）").selectOption(memberBuyer);
  await page.getByLabel("默认工作流程（可选）").fill("opportunity-review");
  await page.getByLabel("创建原因").fill("建立亚太新品采购协作边界");
  await page.getByRole("button", { name: "创建并写入审计" }).dblclick();
  await expect(page.locator(".org-admin-notice")).toContainText("团队已创建并写入审计");

  expect(createRequests).toBe(1);
  expect(writes).toHaveLength(2);
  expect(writes[0]).toMatchObject({
    path: "/api/v1/org/admin/teams/00000000-0000-4000-8000-000000000901/members",
    body: { action: "assign", membership_id: memberBuyer, reason: "加入采购协作范围" },
  });
  expect(writes[1]).toMatchObject({
    path: "/api/v1/org/admin/teams",
    body: {
      name: "亚太新品采购组",
      lead_membership_id: memberBuyer,
      default_workflow_key: "opportunity-review",
      reason: "建立亚太新品采购协作边界",
    },
  });
});

test("organization teams show an actionable empty state without invented rows", async ({
  page,
}) => {
  await setup(page);
  await page.unroute("**/api/v1/org/admin/teams");
  await page.route("**/api/v1/org/admin/teams", (route) => route.fulfill({ json: env([]) }));
  await page.goto("/org-admin/teams");
  await expect(page.getByRole("heading", { name: "当前组织还没有团队" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "新建团队" })).toBeVisible();
  await expect(page.locator('.org-team-list > [role="listitem"]')).toHaveCount(0);
  await expect(page.getByText("创建首个团队后即可设置负责人并分配活动成员。")).toBeVisible();
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
  await expect(page.getByText("陈采购")).toBeVisible();
  await expect(page.getByText("admin@example.test")).toHaveCount(0);
  const memberId = page.locator("code").filter({ hasText: memberBuyer });
  await expect(memberId).not.toBeVisible();

  await page.getByText("技术详情", { exact: true }).first().click();
  await expect(memberId).toBeVisible();
});

test("organization members use persisted names and account states with truthful defaults", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/org-admin/members");
  const inviteCard = page.locator(".org-admin-card").filter({
    has: page.getByRole("heading", { name: "邀请成员" }),
  });
  await expect(inviteCard.getByRole("combobox", { name: "角色" })).toHaveValue("member");
  await expect(page.getByRole("combobox", { name: "选择 林管理员 的角色" })).toHaveValue(
    "organization_admin",
  );

  await page.getByRole("searchbox", { name: "搜索", exact: true }).fill("林管理员");
  await expect(page.getByText("admin@example.test")).toBeVisible();
  await page.getByRole("combobox", { name: "状态", exact: true }).selectOption("locked");
  await expect(page.getByText("钱锁定")).toHaveCount(0);
  await page.getByRole("button", { name: "重置筛选" }).click();
  await page.getByRole("combobox", { name: "状态", exact: true }).selectOption("locked");
  await expect(page.getByText("钱锁定")).toBeVisible();
  await expect(page.locator('i[data-status="locked"]')).toHaveText("已锁定");
});

test("organization member batch invitations keep per-email outcomes", async ({ page }) => {
  await setup(page);
  const payloads: Array<{ email: string; role_code: string; reason: string }> = [];
  await page.route("**/api/v1/org/admin/invitations", async (route) => {
    payloads.push(route.request().postDataJSON());
    await route.fulfill({
      status: 202,
      json: env({
        id: crypto.randomUUID(),
        email: payloads.at(-1)?.email,
        role_code: payloads.at(-1)?.role_code,
        status: "pending_delivery",
      }),
    });
  });
  await page.goto("/org-admin/members");
  const inviteCard = page.locator(".org-admin-card").filter({
    has: page.getByRole("heading", { name: "邀请成员" }),
  });
  await inviteCard
    .getByRole("textbox", { name: "邮箱（每行一个）" })
    .fill("one@example.test\ntwo@example.test");
  await inviteCard.getByRole("textbox", { name: "原因" }).fill("批量邀请回归");
  await inviteCard.getByRole("button", { name: "创建邀请" }).click();
  await expect(page.getByRole("status")).toContainText("成功 2，失败 0");
  await expect(page.getByLabel("邀请结果").getByRole("listitem")).toHaveCount(2);
  expect(payloads.map((item) => item.email)).toEqual(["one@example.test", "two@example.test"]);
  expect(payloads.every((item) => item.role_code === "member")).toBe(true);
});

test("organization pending invitation can be revoked with version and audited reason", async ({
  page,
}) => {
  await setup(page);
  let payload: { action?: string; expected_version?: number; reason?: string } = {};
  await page.route("**/api/v1/org/admin/invitations/*/actions", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      json: env({
        id: "00000000-0000-4000-8000-000000000613",
        status: "revoked",
        version: 2,
      }),
    });
  });
  await page.goto("/org-admin/members");
  const invitation = page.locator(".org-admin-line").filter({ hasText: "new@example.test" });
  await invitation.getByRole("button", { name: "撤销邀请" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("撤销误发邀请");
  await dialog.getByRole("button", { name: "确认提交" }).click();
  await expect(page.getByRole("status")).toContainText("操作已完成并写入审计");
  expect(payload).toEqual({ action: "revoke", expected_version: 1, reason: "撤销误发邀请" });
});

test("organization member choices replace raw ids and approval ids stay technical", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/org-admin/teams");
  await page.getByRole("button", { name: "新建团队" }).click();
  await expect(page.getByLabel("负责人（可选）")).toContainText("admin@example.test");
  await expect(page.getByLabel("当前组织成员")).toContainText("buyer@example.test");
  await expect(page.getByText(memberBuyer, { exact: true })).toHaveCount(0);

  await page.goto("/org-admin/approvals");
  await expect(page.getByText("选品复核模板", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("厨房收纳机会复核", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /模板版本/ }).click();
  await page.getByRole("button", { name: /选品复核模板/ }).click();
  await expect(page.getByText("处理时限（分钟）")).toBeVisible();
  await expect(page.locator("del").filter({ hasText: "60" })).toBeVisible();
  await expect(page.locator("ins").filter({ hasText: "30" })).toBeVisible();
  await expect(page.getByText("当前版本新增了这个审批节点。")).toBeVisible();
  await page.getByRole("button", { name: /审批记录/ }).click();
  const resourceId = page.locator("code").filter({ hasText: approvalResource });
  await expect(resourceId).not.toBeVisible();
  await page
    .locator(".org-approval-request-list article")
    .filter({ hasText: "厨房收纳机会复核" })
    .getByText("技术详情", { exact: true })
    .click();
  await expect(resourceId).toBeVisible();
});

test("organization approval governance filters, paginates and restores URL-backed state", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/org-admin/approvals");
  await expect(page.getByText("已取消", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("共 10 条，当前第 1 / 2 页")).toBeVisible();
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByText("共 10 条，当前第 2 / 2 页")).toBeVisible();

  await page.getByRole("button", { name: "重置", exact: true }).click();
  await page.getByLabel("搜索审批").fill("厨房收纳");
  await page.locator(".org-approval-toolbar select").first().selectOption("pending");
  await expect(page.getByText("厨房收纳机会复核", { exact: true })).toBeVisible();
  await expect(page.getByText("共 1 条，当前第 1 / 1 页")).toBeVisible();

  await page.getByRole("button", { name: /模板版本/ }).click();
  await page.locator(".org-approval-toolbar select").first().selectOption("draft");
  await expect(page).toHaveURL(/approval_view=templates/);
  await expect(page).toHaveURL(/approval_template_status=draft/);
  await page.reload();
  await expect(page.getByRole("button", { name: /模板版本/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".org-approval-toolbar select").first()).toHaveValue("draft");
  await expect(page.getByRole("button", { name: /采购首次审批模板/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /选品复核模板/ })).toHaveCount(0);
});

test("organization roles expose searchable role, capability, scope and grant facts", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/org-admin/roles");
  await expect(page.getByRole("table", { name: "角色能力矩阵" })).toBeVisible();
  await expect(page.getByText("固定角色模板", { exact: true }).first()).toBeVisible();

  await page.getByLabel("搜索角色或能力").fill("审计");
  await expect(page.getByRole("button", { name: /审计员/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /组织管理员/ })).toHaveCount(0);
  await page.getByLabel("搜索角色或能力").fill("");
  await page.getByLabel("搜索能力").fill("组织");
  await expect(
    page.getByRole("table", { name: "角色能力矩阵" }).getByText("管理组织", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("业务域").selectOption({ label: "组织治理" });
  await page.getByRole("button", { name: "重置", exact: true }).click();

  await page.getByRole("button", { name: "数据范围" }).click();
  await expect(page.getByRole("heading", { name: "我的有效数据范围" })).toBeVisible();
  await page.getByLabel("搜索成员").fill("陈采购");
  await page.getByLabel("数据范围").selectOption("workspace");
  await expect(page.getByText("陈采购", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "重置", exact: true }).click();

  await page.getByRole("button", { name: /指定资源授权 1/ }).click();
  await expect(page.getByText("采购团队核对供应报价")).toBeVisible();
  await page.getByRole("button", { name: "已撤销 0" }).click();
  await expect(page.getByRole("heading", { name: "当前状态没有资源授权" })).toBeVisible();
  await page.getByRole("button", { name: "全部 1" }).click();
  await page.getByLabel("搜索当前页授权").fill("陈采购");
  await expect(page.getByText("采购团队核对供应报价")).toBeVisible();
});

test("organization resource grants use truthful server pagination beyond one page", async ({
  page,
}) => {
  const grants = Array.from({ length: 21 }, (_, index) => ({
    ...activeGrant,
    id: `00000000-0000-4000-8000-${String(index + 700).padStart(12, "0")}`,
    reason: `分页授权 ${index + 1}`,
  }));
  await setup(page);
  await page.route(`**/api/v1/org/${org}/resource-grants*`, (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const query = new URL(route.request().url()).searchParams,
      status = query.get("status"),
      pageNumber = Number(query.get("page") ?? 1),
      limit = Number(query.get("limit") ?? 20),
      statusItems = status && status !== "active" ? [] : grants,
      items = status
        ? statusItems.slice(0, limit)
        : grants.slice((pageNumber - 1) * limit, pageNumber * limit);
    return route.fulfill({
      json: env(items, { page: pageNumber, limit, total: statusItems.length }),
    });
  });
  await page.goto("/org-admin/roles");
  await page.getByRole("button", { name: "指定资源授权 21" }).click();
  await expect(page.getByRole("navigation", { name: "资源授权分页" })).toContainText(
    "第 1 / 2 页 · 共 21 条",
  );
  await expect(page.locator(".org-grant-list > button")).toHaveCount(20);
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByRole("navigation", { name: "资源授权分页" })).toContainText(
    "第 2 / 2 页 · 共 21 条",
  );
  await expect(page.locator(".org-grant-list > button")).toHaveCount(1);
  await page.getByRole("button", { name: "上一页" }).click();
  await expect(page.locator(".org-grant-list > button")).toHaveCount(20);
});

test("organization resource grants validate and send audited create, extend and revoke writes", async ({
  page,
}) => {
  const writes: Array<{ method: string; url: string; body: Record<string, unknown> }> = [];
  await page.clock.setFixedTime(new Date("2026-08-26T10:00:00.000Z"));
  await setup(page);
  const captureWrite = async (route: Route) => {
    if (route.request().method() === "GET") return route.fallback();
    writes.push({
      method: route.request().method(),
      url: route.request().url(),
      body: route.request().postDataJSON(),
    });
    return route.fulfill({
      status: route.request().method() === "POST" ? 201 : 200,
      json: env({ ...activeGrant, version: 2 }),
    });
  };
  await page.route(`**/api/v1/org/${org}/resource-grants*`, captureWrite);
  await page.route(`**/api/v1/org/${org}/resource-grants/**`, captureWrite);
  await page.goto("/org-admin/roles");
  await page.getByRole("button", { name: /指定资源授权 1/ }).click();
  await expect(page.getByLabel("新到期时间")).not.toHaveValue("");
  await page.getByRole("button", { name: "创建授权" }).click();
  const createForm = page.locator("form.org-grant-form");
  await createForm.getByLabel("资源编号").fill(grantResource);
  await createForm.getByLabel("目标成员").selectOption(memberBuyer);
  await createForm.getByLabel("业务原因").fill("临时协作核价");
  await createForm.getByRole("button", { name: "创建并写入审计" }).click();
  await expect(page.getByText("指定资源授权已创建并写入审计。")).toBeVisible();

  await page.getByLabel("变更原因").fill("延长核价窗口");
  await page.getByRole("button", { name: "延长授权" }).click();
  await expect(page.getByText("授权到期时间已更新并写入审计。")).toBeVisible();

  await page.getByRole("button", { name: "撤销授权" }).click();
  const dialog = page.getByRole("dialog", { name: "撤销指定资源授权原因" });
  await dialog.getByRole("textbox").fill("协作已经结束");
  await dialog.getByRole("button", { name: "确认提交" }).click();
  await expect(page.getByText("指定资源授权已撤销并写入审计。")).toBeVisible();

  expect(writes).toHaveLength(3);
  expect(writes[0]).toMatchObject({
    method: "POST",
    body: {
      workspace_id: ws,
      resource_type: "opportunity",
      resource_id: grantResource,
      grantee_membership_id: memberBuyer,
      actions: ["opportunity:read"],
      reason: "临时协作核价",
    },
  });
  expect(writes[1]).toMatchObject({
    method: "PATCH",
    body: { expected_version: 1, reason: "延长核价窗口" },
  });
  expect(writes[2]).toMatchObject({
    method: "POST",
    body: { expected_version: 1, reason: "协作已经结束" },
  });
});

test("organization data filters, sorts, paginates and preserves URL state", async ({ page }) => {
  await setup(page);

  await page.goto("/org-admin/data");
  await expect(page.getByRole("table", { name: "跨工作区数据比较" })).toBeVisible();
  await expect(page.getByLabel("工作区分页")).toContainText("第 1 / 2 页 · 共 12 个工作区");
  await expect(page.locator(".org-data-table [role='row']")).toHaveCount(9);
  await page.getByLabel("搜索工作区").fill("新品决策");
  await expect(page.getByText("新品决策工作区").first()).toBeVisible();
  await page.getByRole("button", { name: "重置筛选" }).click();

  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByLabel("工作区分页")).toContainText("第 2 / 2 页");
  await page.getByLabel("搜索工作区").fill("历史归档");
  await expect(page).toHaveURL(/org_data_workspace_query=/);
  await expect(page.getByText("历史归档工作区")).toBeVisible();
  await expect(
    page.getByRole("table", { name: "跨工作区数据比较" }).getByText("已归档"),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("搜索工作区")).toHaveValue("历史归档");
  await page.getByRole("button", { name: "重置筛选" }).click();

  await page.getByRole("button", { name: /导出履历 23/ }).click();
  const exportList = page.getByLabel("最近导出记录");
  await expect(exportList.locator("article")).toHaveCount(10);
  await expect(exportList.getByText("等待重试").first()).toBeVisible();
  await expect(exportList.getByText("多次失败").first()).toBeVisible();
  await page.getByLabel("生成状态").selectOption("retry_scheduled");
  await expect(page).toHaveURL(/org_data_export_status=retry_scheduled/);
  await expect(exportList.locator("article")).toHaveCount(4);
  await expect(exportList.getByText("等待重试")).toHaveCount(4);
});

test("organization data has a responsive factual card layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("/org-admin/data");
  await expect(page.getByRole("heading", { name: "跨工作区数据账本" })).toBeVisible();
  await expect(page.getByText("数量不等于数据质量")).toBeVisible();
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  await expect(page.locator(".org-data-table [role='row']").nth(1)).toHaveCSS(
    "grid-template-columns",
    /.+ .+/,
  );
});

test("organization audit unifies readable details filters cursor and URL state", async ({
  page,
}) => {
  await setup(page);
  const auditRequests: URL[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/audit-events"))
      auditRequests.push(new URL(request.url()));
  });

  await page.goto("/org-admin/audit");
  await expect(page.getByRole("heading", { name: "组织审计账本" })).toBeVisible();
  await expect(page.getByLabel("组织审计列表").getByRole("listitem")).toHaveCount(50);
  await expect(page.getByLabel("当前已加载审计汇总")).toContainText("不是全库总数");
  await expect(page.getByLabel("审计记录详情").locator("pre")).toContainText("[已脱敏]");
  await expect(page.getByLabel("审计记录详情")).not.toContainText("synthetic-redaction-probe");
  await page.getByRole("button", { name: "加载更多记录" }).click();
  await expect(page.getByLabel("组织审计列表").getByRole("listitem")).toHaveCount(55);

  await page.getByLabel("页内搜索").fill("失败");
  await expect(page).toHaveURL(/org_audit_query=/);
  await expect(page.getByLabel("组织审计列表").getByRole("listitem")).toHaveCount(18);
  await page.getByLabel("页内搜索").fill("");
  await page.getByLabel("操作代码（精确）").fill("organization.member.invited");
  await page.getByLabel("执行结果").selectOption("succeeded");
  await page.getByLabel("对象类型（精确）").fill("membership");
  await page.getByRole("button", { name: "应用筛选" }).click();
  await expect(page).toHaveURL(/org_audit_action=organization.member.invited/);
  await expect(page.getByLabel("组织审计列表").getByRole("listitem")).toHaveCount(19);
  expect(auditRequests.at(-1)?.searchParams.get("resource_type")).toBe("membership");
  await page.reload();
  await expect(page.getByLabel("操作代码（精确）")).toHaveValue("organization.member.invited");
  await page.getByRole("button", { name: "重置筛选" }).click();
  await expect(page.getByLabel("操作代码（精确）")).toHaveValue("");
});

test("organization audit collapses high-frequency realtime connection records without hiding them", async ({
  page,
}) => {
  await setup(page);
  const businessEvents = organizationAuditEvents.slice(0, 10);
  const realtimeEvents = Array.from({ length: 40 }, (_, index) => ({
    ...organizationAuditEvents[0],
    id: `00000000-0000-4000-8000-${String(900 + index).padStart(12, "0")}`,
    action: "realtime.connected",
    resource_type: "organization",
    request_id: `realtime-request-${index + 1}`,
    trace_id: `realtime-trace-${index + 1}`,
    occurred_at: new Date(Date.parse("2026-08-27T11:00:00.000Z") - index * 60_000).toISOString(),
  }));
  await page.route("**/api/v1/organizations/*/audit-events**", (route) =>
    route.fulfill({
      json: env({ items: [...realtimeEvents, ...businessEvents], nextCursor: null }),
    }),
  );

  await page.goto("/org-admin/audit");
  await expect(page.getByLabel("组织审计列表").getByRole("listitem")).toHaveCount(10);
  const disclosure = page.getByRole("button", { name: /系统连接记录 40 条/ });
  await expect(disclosure).toContainText("不影响审计总数、筛选或追踪");
  await disclosure.click();
  await expect(page.getByLabel("组织审计列表").getByRole("listitem")).toHaveCount(50);
  await expect(page.getByText("实时连接已建立", { exact: true }).first()).toBeVisible();
  await disclosure.click();
  await expect(page.getByLabel("组织审计列表").getByRole("listitem")).toHaveCount(10);
  await page.getByLabel("页内搜索").fill("实时连接");
  await expect(page.getByLabel("组织审计列表").getByRole("listitem")).toHaveCount(40);
});

test("organization audit validates ranges and has no mobile overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("/org-admin/audit");
  await page.getByText("高级追踪与时间筛选").click();
  await page.getByLabel("开始时间").fill("2026-08-28T12:00");
  await page.getByLabel("结束时间").fill("2026-08-27T12:00");
  await page.getByRole("button", { name: "应用筛选" }).click();
  await expect(page.getByRole("alert")).toContainText("开始时间不能晚于结束时间");
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  const buttonHeights = await page
    .locator(".org-audit-panel button:visible")
    .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
  expect(Math.min(...buttonHeights)).toBeGreaterThanOrEqual(34);
});

test("organization audit auditor can open only the read-only capability route", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/me/navigation?shell=organization_admin", (route) =>
    route.fulfill({
      json: env({
        shell: "organization_admin",
        organization_id: org,
        workspace_id: ws,
        roles: ["auditor"],
        capabilities: ["audit:read"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_organization_admin_audit_allowed",
      }),
    }),
  );
  let memberReads = 0,
    summaryReads = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/org/admin/members") memberReads += 1;
    if (new URL(request.url()).pathname === "/api/v1/org/admin/summary") summaryReads += 1;
  });

  await page.goto("/org-admin/audit");
  await expect(page.getByRole("region", { name: "上下文" })).toContainText("审计员");
  await expect(page.getByRole("heading", { name: "组织审计账本" })).toBeVisible();
  await expect(page.locator(".role-nav-groups a")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "邀请成员" })).toHaveCount(0);
  expect(summaryReads).toBe(0);

  await page.goto("/org-admin/members");
  await expect(page.getByRole("heading", { name: "无权打开此页面" })).toBeVisible();
  expect(memberReads).toBe(0);
});

test("organization audit distinguishes empty, HTTP failure and offline states", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/v1/organizations/*/audit-events**", (route) =>
    route.fulfill({ json: env({ items: [], nextCursor: null }) }),
  );
  await page.goto("/org-admin/audit");
  await expect(page.getByText("当前组织暂无审计记录")).toBeVisible();
  await expect(page.getByText("受审计操作发生后将显示在这里。")).toBeVisible();

  await page.unroute("**/api/v1/organizations/*/audit-events**");
  await setup(page);
  let failureRequests = 0;
  await page.route("**/api/v1/organizations/*/audit-events**", (route) => {
    failureRequests += 1;
    return route.fulfill({
      status: 503,
      json: {
        error: {
          code: "audit_temporarily_unavailable",
          message: "审计查询暂不可用。",
          action_hint: "检查数据库连接后重试。",
        },
        request_id: "m06-01-audit-failure",
        trace_id: "m06-01-audit-failure",
      },
    });
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "组织数据暂不可用" })).toBeVisible();
  await expect(page.locator(".org-admin-state p")).toHaveText(
    "审计查询暂不可用。 检查数据库连接后重试。",
  );
  expect(failureRequests).toBe(3);

  await page.unroute("**/api/v1/organizations/*/audit-events**");
  await setup(page);
  let offlineRequests = 0;
  await page.route("**/api/v1/organizations/*/audit-events**", (route) => {
    offlineRequests += 1;
    return route.abort("internetdisconnected");
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "组织数据暂不可用" })).toBeVisible();
  await expect(page.locator(".org-admin-state p")).toContainText("网络连接暂不可用");
  await expect(page.locator(".org-admin-state p")).toContainText("请检查网络后重试");
  expect(offlineRequests).toBe(3);
});

test("organization audit fails closed after the organization request timeout", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "timeout contract needs one browser run");
  await setup(page);
  await page.route("**/api/v1/organizations/*/audit-events**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 13_000));
    if (!route.request().isNavigationRequest())
      await route.fulfill({ json: env({ items: [], nextCursor: null }) }).catch(() => undefined);
  });
  await page.goto("/org-admin/audit");
  await expect(page.getByRole("heading", { name: "组织数据暂不可用" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator(".org-admin-state p")).toHaveText(
    "组织后台请求超时。 检查网络或服务状态后重试。",
  );
});

test("organization tokens require explicit scopes and preserve lifecycle filters", async ({
  page,
}) => {
  await setup(page);
  let tokenPosts = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/v1/org/admin/tokens"
    )
      tokenPosts += 1;
  });
  await page.goto("/org-admin/tokens");
  await expect(page.getByRole("heading", { name: "组织只读访问凭据" })).toBeVisible();
  await expect(page.getByLabel("组织令牌列表").locator("article")).toHaveCount(6);
  await expect(page.getByLabel("令牌分页")).toContainText("第 1 / 2 页");

  await page.getByLabel("令牌名称").fill("数据仓库只读连接");
  await page.getByLabel("创建原因").fill("验证显式最小权限");
  await page.getByRole("button", { name: "创建并显示一次明文" }).click();
  await expect(page.getByRole("alert")).toHaveText("至少选择一个只读权限范围。");
  expect(tokenPosts).toBe(0);

  await page.getByLabel("搜索令牌").fill("月度经营");
  await expect(page).toHaveURL(/org_token_query=/);
  await expect(page.getByLabel("组织令牌列表").locator("article")).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel("搜索令牌")).toHaveValue("月度经营");
  await page.getByRole("button", { name: "重置筛选" }).click();

  await page.getByRole("button", { name: "轮换密钥" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("旧令牌立即失效");
  await page.getByRole("button", { name: "取消" }).click();
  await page.getByRole("button", { name: "撤销访问" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("立即失效且不能恢复");
});

test("organization tokens stay readable without mobile overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto("/org-admin/tokens");
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  const buttonHeights = await page
    .locator(".org-token-panel button:visible")
    .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
  expect(Math.min(...buttonHeights)).toBeGreaterThanOrEqual(38);
});
