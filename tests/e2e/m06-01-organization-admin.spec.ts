import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";
import { capturePhase2Evidence, finalizePhase2Evidence } from "./helpers/ui-phase2-evidence";
test.afterEach(async ({}, testInfo) => finalizePhase2Evidence(testInfo));

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

for (const variant of ["invitation", "grant"] as const) {
  const title = variant === "grant" ? "撤销指定资源授权原因" : "撤销邀请原因";
  const initial = variant === "grant" ? "撤销指定资源授权" : "撤销邀请";
  const endpoint =
    variant === "grant"
      ? `**/api/v1/org/${org}/resource-grants/${activeGrant.id}/revoke`
      : "**/api/v1/org/admin/invitations/*/actions";
  const openReason = async (page: Page) => {
    await page.clock.setFixedTime(new Date("2026-08-26T10:00:00.000Z"));
    await setup(page);
    await page.goto(variant === "grant" ? "/org-admin/roles" : "/org-admin/members");
    if (variant === "grant") await page.getByRole("button", { name: /指定资源授权 1/ }).click();
    const trigger =
      variant === "grant"
        ? page.getByRole("button", { name: "撤销授权", exact: true })
        : page
            .locator(".org-admin-line")
            .filter({ hasText: "new@example.test" })
            .getByRole("button", { name: "撤销邀请", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog.getByRole("textbox")).toBeFocused();
    await expect(dialog.getByRole("textbox")).toHaveValue(initial);
    return { dialog, trigger };
  };

  for (const close of ["escape", "header", "cancel"] as const) {
    test(`UI2-SM01 ${variant} reason ${close} cancels without a write and restores focus`, async ({
      page,
    }) => {
      const writes: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/api/v1/") && !["GET", "HEAD"].includes(request.method()))
          writes.push(request.method());
      });
      const { dialog, trigger } = await openReason(page);
      await dialog.getByRole("textbox").fill("取消后不提交此草稿");
      if (close === "escape") await page.keyboard.press("Escape");
      else
        await dialog
          .getByRole("button", { name: close === "header" ? "关闭原因填写" : "取消", exact: true })
          .click();
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      expect(writes).toEqual([]);
      await trigger.click();
      await expect(dialog.getByRole("textbox")).toHaveValue(initial);
      await page.keyboard.press("Escape");
    });
  }

  test(`UI2-SM01 ${variant} reason contains both Tab boundaries with disabled and enabled submit`, async ({
    page,
  }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/") && !["GET", "HEAD"].includes(request.method()))
        writes.push(request.method());
    });
    const { dialog } = await openReason(page);
    const first = dialog.getByRole("button", { name: "关闭原因填写" });
    const input = dialog.getByRole("textbox");
    const submit = dialog.getByRole("button", { name: "确认提交" });
    for (const { value, valid } of [
      { value: "x", valid: false },
      { value: "有效原因", valid: true },
    ]) {
      await input.fill(value);
      const last = valid ? submit : dialog.getByRole("button", { name: "取消", exact: true });
      if (valid) {
        await expect(submit).toBeEnabled();
        await expect(dialog.getByRole("alert")).toHaveCount(0);
        await expect(input).not.toHaveAttribute("aria-invalid", "true");
      } else {
        await expect(submit).toBeDisabled();
        await expect(input).toHaveAttribute("aria-invalid", "true");
        await expect(input).toHaveAttribute("aria-describedby", /audited-reason-validation-error/);
        await expect(dialog.getByRole("alert")).toHaveText("请至少填写 2 个字的原因。");
        expect(writes).toEqual([]);
      }
      await first.focus();
      await page.keyboard.press("Shift+Tab");
      await expect(last).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(first).toBeFocused();
    }
  });

  test(`UI2-SM01 ${variant} reason emits one trimmed versioned write before waiting for completion`, async ({
    page,
  }) => {
    const { dialog, trigger } = await openReason(page);
    const writes: unknown[] = [];
    let pending: Route | undefined;
    await page.route(endpoint, (route) => {
      writes.push(route.request().postDataJSON());
      pending = route;
    });
    const input = dialog.getByRole("textbox");
    const submit = dialog.getByRole("button", { name: "确认提交" });
    await input.fill(" ");
    await expect(submit).toBeDisabled();
    await input.press("Control+Enter");
    expect(writes).toEqual([]);
    await input.fill("  隔离撤销原因  ");
    await submit.click();
    await expect.poll(() => writes.length).toBe(1);
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeDisabled();
    await page.keyboard.press("Enter");
    expect(writes).toEqual([
      {
        ...(variant === "invitation" ? { action: "revoke" } : {}),
        expected_version: 1,
        reason: "隔离撤销原因",
      },
    ]);
    await pending!.fulfill({
      json: env(
        variant === "grant"
          ? { ...activeGrant, version: 2, status: "revoked", effective_status: "revoked" }
          : { id: "00000000-0000-4000-8000-000000000613", status: "revoked", version: 2 },
      ),
    });
    await expect(page.getByRole("status")).toContainText(
      variant === "grant" ? "指定资源授权已撤销" : "操作已完成",
    );
    expect(writes).toHaveLength(1);
  });
}
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
  await expect(page.getByRole("heading", { name: "治理概览", level: 1 }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "邀请成员", exact: true })).toHaveCount(1);
  await expect(
    page.locator(".org-overview-actions").getByRole("link", { name: "邀请成员", exact: true }),
  ).toHaveAttribute("href", "/org-admin/members");
  await expect(
    page.locator(".role-topbar").getByRole("link", { name: "邀请成员", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".org-identity-mark")).toHaveText("G");
  await expect(page.getByLabel("组织标识")).toHaveText("global-goods");
  await expect(page.locator(".organization-profile-metrics article > span > svg")).toHaveCount(6);
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
  await expect(page.locator(".organization-profile-metrics article")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "正在刷新…" })).toBeDisabled();
  releaseRefresh();
  await expect(page.locator(".org-admin-center")).toHaveAttribute("aria-busy", "false");

  await page.getByLabel("变更原因").fill("验证成功反馈");
  await page.getByRole("button", { name: "保存" }).click();
  const receipt = page.locator(".org-profile-receipt");
  await expect(receipt).toHaveAttribute("data-phase", "ready");
  await expect(receipt).toContainText("资料已保存，页面已更新");
  await expect(receipt.locator("code").first()).toHaveText("m06-01-e2e");
  await expect(page.locator('.org-admin-notice[data-kind="success"]')).toHaveCount(0);
});

test("organization profile reports accepted save and completed reread separately", async ({
  page,
}) => {
  await setup(page);
  let patchRequests = 0,
    releaseRead: () => void = () => {};
  const readGate = new Promise<void>((resolve) => {
    releaseRead = resolve;
  });
  await page.route("**/api/v1/org/admin/profile", async (route) => {
    if (route.request().method() === "PATCH") {
      patchRequests += 1;
      await route.fulfill({
        json: {
          data: { ...profile, name: "保存后的组织", version: 4 },
          request_id: "m06-01-profile-write-receipt",
          trace_id: "m06-01-profile-write-receipt",
        },
      });
      return;
    }
    if (patchRequests > 0) {
      await readGate;
      await route.fulfill({
        json: {
          data: { ...profile, name: "保存后的组织", version: 4 },
          request_id: "m06-01-profile-read-receipt",
          trace_id: "m06-01-profile-read-receipt",
        },
      });
      return;
    }
    await route.fallback();
  });
  await page.goto("/org-admin");
  await expect(page.locator(".org-admin-center")).toHaveAttribute("data-state", "ready");
  await page.getByLabel("名称").fill("保存后的组织");
  await page.getByLabel("变更原因").fill("验证写入与重读反馈分离");
  await page.getByRole("button", { name: "保存" }).click();

  const receipt = page.locator(".org-profile-receipt");
  await expect(receipt).toHaveAttribute("data-phase", "pending");
  await expect(receipt).toContainText("资料已保存，正在更新页面");
  await expect(receipt).toContainText("m06-01-profile-write-receipt");
  await expect(receipt).not.toContainText("m06-01-profile-read-receipt");
  await expect(page.locator(".organization-profile-facts h3")).toHaveText(profile.name);
  await expect(page.getByRole("button", { name: "正在保存…" })).toBeDisabled();

  releaseRead();
  await expect(receipt).toHaveAttribute("data-phase", "ready");
  await expect(receipt).toContainText("资料已保存，页面已更新");
  await expect(receipt).toContainText("m06-01-profile-write-receipt");
  await expect(receipt).toContainText("m06-01-profile-read-receipt");
  await expect(page.locator(".organization-profile-facts h3")).toHaveText("保存后的组织");
  await receipt.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(receipt.locator("details")).toHaveAttribute("open", "");
  expect(patchRequests).toBe(1);
});

test("organization profile keeps an accepted save distinct from a failed refresh until GET retry", async ({
  page,
}) => {
  await setup(page);
  let profileReads = 0,
    patchRequests = 0,
    failedPostWriteRead = false,
    postWriteReads = 0,
    releaseManualRead: () => void = () => {};
  const manualReadGate = new Promise<void>((resolve) => {
    releaseManualRead = resolve;
  });
  const submittedBodies: Array<Record<string, unknown>> = [];
  await page.route("**/api/v1/org/admin/profile", async (route) => {
    const request = route.request();
    if (request.method() === "PATCH") {
      patchRequests += 1;
      submittedBodies.push(JSON.parse(request.postData() ?? "{}"));
      await route.fulfill({
        json: {
          data: { ...profile, name: "更新后的组织", version: 4 },
          request_id: "m06-01-profile-write-accepted",
          trace_id: "m06-01-profile-write-accepted",
        },
      });
      return;
    }
    profileReads += 1;
    if (patchRequests > 0) {
      postWriteReads += 1;
    }
    if (patchRequests > 0 && postWriteReads <= 3) {
      failedPostWriteRead = true;
      await route.fulfill({
        status: 503,
        json: {
          error: {
            code: "organization_service_unavailable",
            message: "组织资料暂不可读取。",
            action_hint: "检查服务状态后重试。",
          },
          request_id: "m06-01-profile-read-failed",
          trace_id: "m06-01-profile-read-failed",
        },
      });
      return;
    }
    if (patchRequests > 0) {
      await manualReadGate;
      await route.fulfill({
        json: {
          data: { ...profile, name: "更新后的组织", version: 4 },
          request_id: "m06-01-profile-read-recovered",
          trace_id: "m06-01-profile-read-recovered",
        },
      });
      return;
    }
    await route.fallback();
  });
  await page.goto("/org-admin");
  await expect(page.locator(".org-admin-center")).toHaveAttribute("data-state", "ready");

  await page.getByLabel("名称").fill("更新后的组织");
  await page.getByLabel("变更原因").fill("验证写后重读失败");
  await page.getByRole("button", { name: "保存" }).click();
  await expect.poll(() => patchRequests).toBe(1);
  await expect.poll(() => failedPostWriteRead).toBe(true);

  const feedback = page.getByRole("alert");
  const receipt = page.locator(".org-profile-receipt");
  await expect(receipt).toHaveAttribute("data-phase", "failed");
  await expect(receipt).toContainText("资料已保存，页面暂未更新");
  await expect(feedback).toContainText("组织资料已保存");
  await expect(feedback).toContainText("当前资料显示可能是保存前快照");
  await expect(feedback).toContainText("m06-01-profile-write-accepted");
  await expect(feedback).toContainText("m06-01-profile-read-failed");
  await expect(page.getByLabel("名称")).toBeDisabled();
  await expect(page.getByRole("button", { name: "保存" })).toBeDisabled();
  expect(patchRequests).toBe(1);
  expect(submittedBodies).toEqual([
    expect.objectContaining({
      name: "更新后的组织",
      reason: "验证写后重读失败",
      expected_version: 3,
    }),
  ]);

  await page.getByRole("button", { name: "刷新数据" }).click();
  await expect(receipt).toHaveAttribute("data-phase", "pending");
  releaseManualRead();
  await expect(page.locator(".organization-profile-facts h3")).toHaveText("更新后的组织");
  await expect(receipt).toHaveAttribute("data-phase", "ready");
  await expect(receipt).toContainText("m06-01-profile-read-recovered");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "保存" })).toBeEnabled();
  expect(postWriteReads).toBe(4);
  expect(patchRequests).toBe(1);
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
  await page.getByRole("button", { name: "保存" }).click();
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
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.locator(".org-admin-center")).toHaveAttribute("data-state", "ready");
  await expect(page.getByRole("button", { name: "保存" })).toBeVisible();
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
  await expect(page.locator(".organization-profile-metrics article")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "保存" })).toHaveCount(0);
  await expect(page.getByText("m06-01-blocked")).toBeVisible();

  await page.unroute("**/api/v1/org/admin/**", blockedHandler);
  await page.getByRole("button", { name: "重新加载" }).click();
  await expect(page.locator(".org-admin-center")).toHaveAttribute("data-state", "ready");
  await expect(page.locator(".organization-profile-metrics article")).toHaveCount(6);
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
  const workspaceList = page.getByRole("list", { name: "工作区列表" });
  const workspaceItems = workspaceList.getByRole("listitem");
  await expect(page.getByRole("region", { name: "工作区治理台" })).toBeVisible();
  await expect(page.getByLabel("工作区统计")).toContainText("10");
  await expect(workspaceItems).toHaveCount(8);
  await expect(workspaceList.getByRole("button")).toHaveCount(8);
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

  await page.getByRole("button", { name: "选择工作区 区域工作区 1" }).click();
  await page.getByRole("button", { name: "归档工作区" }).click();
  const archiveDialog = page.getByRole("dialog", { name: "归档工作区原因" });
  await archiveDialog.getByRole("textbox").fill("区域业务已经结束");
  await archiveDialog.getByRole("button", { name: "确认提交" }).click();
  await expect(page.getByRole("status")).toContainText("工作区已归档");

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
  await page.getByRole("button", { name: "创建", exact: true }).click();
  expect(
    await page
      .getByLabel("英文标识")
      .evaluate((element: HTMLInputElement) => element.validity.patternMismatch),
  ).toBe(true);
  expect(createRequests).toBe(0);
  await page.getByLabel("英文标识").fill("apac-growth");
  await page.getByRole("button", { name: "创建", exact: true }).dblclick();
  await expect(page.getByRole("status")).toContainText("工作区已创建");

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
  await expect(page.locator(".org-workspace-list")).toHaveCount(0);
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
  const teamItems = page.locator(".org-team-list > li");
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

  await page.getByRole("button", { name: "选择团队 团队治理样本 02" }).click();
  await expect(page.getByRole("heading", { name: "团队治理样本 02" })).toBeVisible();
  await page.getByLabel("当前组织成员").selectOption(memberBuyer);
  await page.getByRole("button", { name: "分配成员" }).click();
  const assignDialog = page.getByRole("dialog", { name: "分配团队成员原因" });
  await assignDialog.getByRole("textbox").fill("加入采购协作范围");
  await assignDialog.getByRole("button", { name: "确认提交" }).click();
  await expect(page.locator(".org-admin-notice")).toContainText("成员已分配");

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
  await page.getByRole("button", { name: "创建", exact: true }).dblclick();
  await expect(page.locator(".org-admin-notice")).toContainText("团队已创建");

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
  await expect(page.locator(".org-team-list > li")).toHaveCount(0);
  await expect(page.getByText("创建首个团队后即可设置负责人并分配活动成员。")).toBeVisible();
});

test("team creation keeps its receipt when list refresh fails and retry only rereads", async ({
  page,
}) => {
  let created = false,
    allowRead = false,
    holdRetryRead = false,
    createRequests = 0,
    teamReads = 0,
    summaryReads = 0,
    memberReads = 0;
  let resolveRetryReadStarted!: () => void, releaseRetryRead!: () => void;
  const retryReadStarted = new Promise<void>((resolve) => {
      resolveRetryReadStarted = resolve;
    }),
    retryReadGate = new Promise<void>((resolve) => {
      releaseRetryRead = resolve;
    });
  const createdTeam = {
    id: "00000000-0000-4000-8000-000000000699",
    name: "只创建一次的协作组",
    status: "active",
    member_count: 0,
    lead_membership_id: null,
    default_workflow_key: null,
    version: 1,
    created_at: "2026-08-27T00:00:00.000Z",
    updated_at: "2026-08-27T00:00:00.000Z",
  };
  await setup(page);
  page.on("request", (request) => {
    if (request.method() !== "GET") return;
    if (request.url().includes("/api/v1/org/admin/summary")) summaryReads += 1;
    if (request.url().includes("/api/v1/org/admin/members")) memberReads += 1;
  });
  await page.unroute("**/api/v1/org/admin/teams");
  await page.route("**/api/v1/org/admin/teams", async (route) => {
    if (route.request().method() === "POST") {
      createRequests += 1;
      created = true;
      return route.fulfill({
        status: 201,
        json: { ...env(createdTeam), request_id: "team-create-write-201" },
      });
    }
    teamReads += 1;
    if (created && !allowRead) {
      if (holdRetryRead) {
        holdRetryRead = false;
        resolveRetryReadStarted();
        await retryReadGate;
      }
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: "TEMPORARY_UNAVAILABLE",
            message: "团队列表暂不可用",
            request_id: `team-list-read-failed-${teamReads}`,
          },
        },
      });
    }
    return route.fulfill({
      json: env(created ? [createdTeam] : []),
    });
  });

  await page.goto("/org-admin/teams");
  await page.getByRole("button", { name: "新建团队" }).click();
  await page.getByLabel("团队名称").fill("只创建一次的协作组");
  await page.getByLabel("创建原因").fill("建立协作边界并验证列表读取恢复");
  await page.getByRole("button", { name: "创建", exact: true }).click();

  const recovery = page.locator(".org-team-refresh-warning");
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText("团队已创建，列表暂未更新");
  await expect(recovery).toContainText("team-create-write-201");
  await expect(recovery.locator("dd").nth(1)).toHaveText(/^[0-9a-f-]{36}$/i);
  const initialReadRequestId = await recovery.locator("dd").nth(1).innerText();
  const requestDetails = recovery.locator("details"),
    retryButton = recovery.getByRole("button");
  await expect(requestDetails).toBeVisible();
  await expect(requestDetails.locator("summary")).toHaveText("查看本次请求编号");
  await expect(retryButton).toHaveText("重新读取团队列表");
  await requestDetails.locator("summary").click();
  await expect(recovery.getByText("创建请求")).toBeVisible();
  await expect(recovery.getByText("读取失败请求")).toBeVisible();
  await expect(requestDetails.locator("dd").first()).toHaveText("team-create-write-201");
  await expect(page.locator(".org-admin-notice")).toContainText("团队已创建");
  expect(createRequests).toBe(1);
  expect(teamReads).toBeGreaterThan(1);

  const summaryReadsBeforeRetry = summaryReads,
    memberReadsBeforeRetry = memberReads;
  holdRetryRead = true;
  const retryFailureResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/org/admin/teams") &&
      response.request().method() === "GET" &&
      response.status() === 503,
  );
  await retryButton.click();
  await retryReadStarted;
  await expect(retryButton).toHaveText("正在重新读取…");
  await expect(retryButton).toBeDisabled();
  await expect(page.locator(".org-admin-refresh button")).toBeDisabled();
  releaseRetryRead();
  await retryFailureResponse;
  await expect(recovery).toBeVisible();
  await expect(requestDetails.locator("dd").nth(1)).toHaveText(/^[0-9a-f-]{36}$/i);
  expect(await requestDetails.locator("dd").nth(1).innerText()).not.toBe(initialReadRequestId);
  await expect(retryButton).toBeEnabled();
  await expect(retryButton).toHaveText("重新读取团队列表");
  expect(createRequests).toBe(1);

  allowRead = true;
  const retrySuccessResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/org/admin/teams") &&
      response.request().method() === "GET" &&
      response.status() === 200,
  );
  await retryButton.click();
  await retrySuccessResponse;
  await expect(recovery).toBeHidden();
  await expect(page.getByRole("button", { name: "选择团队 只创建一次的协作组" })).toBeVisible();
  await expect(page.locator(".org-admin-notice")).toContainText("创建操作未重复提交");
  expect(summaryReads).toBe(summaryReadsBeforeRetry);
  expect(memberReads).toBe(memberReadsBeforeRetry);
  expect(createRequests).toBe(1);
  expect(teamReads).toBeGreaterThan(3);
});

test("M06-01.A07/A08/A15 mobile member and invitation state", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-08-26T10:00:00.000Z"));
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/org-admin/members");
  await expect(
    page.locator(".org-admin-center").getByRole("heading", { name: "成员与邀请", level: 1 }),
  ).toBeVisible();
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
  await page.clock.setFixedTime(new Date("2026-08-26T10:00:00.000Z"));
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
  await expect(page.getByRole("status")).toContainText("操作已完成");
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

test("organization approvals use a compact first-load panel and retain the busy contract", async ({
  page,
}) => {
  let release!: () => void;
  const readGate = new Promise<void>((resolve) => (release = resolve));
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/") && !["GET", "HEAD"].includes(request.method()))
      writes.push(request.method());
  });
  await setup(page);
  await page.unroute("**/api/v1/org/admin/approvals");
  await page.route("**/api/v1/org/admin/approvals", async (route) => {
    await readGate;
    await route.fulfill({
      json: env({
        summary: { pending: 0, approved: 0, rejected: 0, cancelled: 0 },
        templates: [],
        items: [],
      }),
    });
  });
  try {
    await page.goto("/org-admin/approvals");
    const center = page.locator(".org-admin-center"),
      loading = page.locator(".org-approval-loading-c");
    await expect(loading).toBeVisible();
    await expect(center).toHaveAttribute("data-state", "loading");
    await expect(center).toHaveAttribute("aria-busy", "true");
    await expect(center).toHaveClass(/org-admin-center--approval-review/);
    await expect(loading).toHaveAttribute("role", "status");
    await expect(loading.getByRole("heading", { name: "正在读取当前组织数据…" })).toBeVisible();
    await expect(loading).toContainText("读取完成后显示审批记录和模板版本。");
    await expect(loading.locator(".org-approval-loading-placeholder")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    await expect(loading.locator("i")).toHaveCount(3);
    await expect(
      loading.locator("button, a, input, [role='progressbar'], [aria-valuenow]"),
    ).toHaveCount(0);
    const layout = await loading.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        background: style.backgroundColor,
        minHeight: style.minHeight,
        columns: style.gridTemplateColumns.split(" ").length,
      };
    });
    expect(layout).toMatchObject({
      background: "rgb(255, 255, 255)",
      minHeight: "0px",
      columns: 1,
    });
    expect(writes).toEqual([]);

    release();
    await expect(center).toHaveAttribute("data-state", "ready");
    await expect(center).toHaveAttribute("aria-busy", "false");
    await expect(loading).toHaveCount(0);
    await expect(page.locator(".org-approval-governance")).toBeVisible();
    expect(writes).toEqual([]);
  } finally {
    release();
  }
});

test("organization approval first-read failures expose recovery details and reuse the existing GET", async ({
  page,
}) => {
  const cases = [
      { status: 503, title: "组织数据暂不可用", state: "blocked", retries: 3 },
      { status: 408, title: "组织数据暂不可用", state: "blocked", retries: 3 },
      { status: 409, title: "数据版本已变化", state: "conflict", retries: 1 },
      { status: 0, title: "组织数据暂不可用", state: "blocked", retries: 3 },
      { status: 401, title: "登录已失效", state: "expired", retries: 1 },
      { status: 403, title: "当前无法查看审批内容", state: "forbidden", retries: 1 },
    ] as const,
    writes: string[] = [];
  let activeCase = cases[0],
    failing = true,
    attempts = 0;
  await setup(page);
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/") && !["GET", "HEAD"].includes(request.method()))
      writes.push(request.method());
  });
  await page.route("**/api/v1/org/admin/approvals", async (route) => {
    if (!failing) return route.fallback();
    attempts += 1;
    if (activeCase.status === 0) return route.abort("internetdisconnected");
    return route.fulfill({
      status: activeCase.status,
      json: {
        error: {
          code: `p34_read_${activeCase.status}`,
          message: `隔离读取失败 ${activeCase.status}`,
          action_hint: "检查服务后重试。",
        },
        request_id: `p34-first-${activeCase.status}`,
        trace_id: `p34-first-${activeCase.status}`,
      },
    });
  });

  for (const scenario of cases) {
    activeCase = scenario;
    failing = true;
    attempts = 0;
    await page.goto("/org-admin/approvals");
    const center = page.locator(".org-admin-center"),
      feedback = page.locator(".org-approval-read-feedback-c");
    await expect(center).toHaveAttribute("data-state", scenario.state);
    await expect(center).toHaveAttribute("data-approval-read-feedback", "true");
    await expect(feedback).toHaveAttribute(
      "data-mode",
      scenario.state === "expired" || scenario.state === "forbidden" ? scenario.state : "initial",
    );
    await expect(feedback.getByRole("heading", { name: scenario.title })).toBeVisible();
    await expect(feedback).toContainText("审批内容目前未显示，不代表记录或模板为空。");
    const details = feedback.locator(".org-approval-read-feedback-c__details");
    await expect(details).toBeVisible();
    await expect(details).not.toHaveAttribute("open", "");
    const expectedDetail =
      scenario.status === 0
        ? "网络连接暂不可用。 请检查网络后重试；系统已完成安全的读取重试。"
        : scenario.status === 409
          ? "数据已被其他操作更新，请先刷新并确认最新内容。 检查服务后重试。"
          : `隔离读取失败 ${scenario.status} 检查服务后重试。`;
    await expect(details.locator("p")).toContainText(expectedDetail);
    if (scenario.status !== 0)
      await expect(details.locator("code")).toHaveText(`p34-first-${scenario.status}`);
    else await expect(details.locator("code")).toHaveText(/.+/);
    await expect.poll(() => attempts).toBe(scenario.retries);

    const readCount = attempts;
    await details.locator("summary").click();
    expect(attempts).toBe(readCount);
    failing = false;
    await feedback.getByRole("button", { name: "重新加载" }).click();
    await expect(center).toHaveAttribute("data-state", "ready");
    await expect(center).toHaveAttribute("data-approval-read-feedback", "false");
    await expect(page.locator(".org-approval-governance")).toBeVisible();
    expect(writes).toEqual([]);
  }
});

test("organization approval background read failures disclose details and retain the prior snapshot", async ({
  page,
}) => {
  const cases = [503, 409, 429, 500, 0] as const;
  let activeStatus = cases[0],
    failing = false,
    attempts = 0;
  const writes: string[] = [];
  await setup(page);
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/") && !["GET", "HEAD"].includes(request.method()))
      writes.push(request.method());
  });
  await page.route("**/api/v1/org/admin/approvals", async (route) => {
    if (!failing) return route.fallback();
    attempts += 1;
    if (activeStatus === 0) return route.abort("internetdisconnected");
    return route.fulfill({
      status: activeStatus,
      json: {
        error: {
          code: `p34_refresh_${activeStatus}`,
          message: `隔离刷新失败 ${activeStatus}`,
          action_hint: "检查服务后重新刷新。",
        },
        request_id: `p34-background-${activeStatus}`,
        trace_id: `p34-background-${activeStatus}`,
      },
    });
  });
  await page.goto("/org-admin/approvals");
  const center = page.locator(".org-admin-center"),
    approval = page.getByText("厨房收纳机会复核", { exact: true }),
    refresh = page.getByRole("button", { name: "刷新数据", exact: true });
  await expect(approval).toBeVisible();

  for (const status of cases) {
    activeStatus = status;
    failing = true;
    attempts = 0;
    await refresh.click();
    const feedback = page.locator(".org-approval-read-feedback-c");
    await expect(center).toHaveAttribute("data-state", "ready");
    await expect(feedback).toHaveAttribute("data-mode", "retained");
    await expect(feedback.getByRole("heading", { name: "审批内容未能更新" })).toBeVisible();
    await expect(feedback).toContainText("仍显示上次成功读取的内容，本次更新尚未完成。");
    await expect(approval).toBeVisible();
    await expect(refresh).toBeEnabled();
    const details = feedback.locator("details");
    await expect(details).not.toHaveAttribute("open", "");
    await details.locator("summary").click();
    const expectedDetail =
      status === 0
        ? "网络连接暂不可用。 请检查网络后重试；系统已完成安全的读取重试。"
        : status === 409
          ? "数据已被其他操作更新，请先刷新并确认最新内容。 检查服务后重新刷新。"
          : `隔离刷新失败 ${status} 检查服务后重新刷新。`;
    await expect(details.locator("p")).toContainText(expectedDetail);
    if (status !== 0) await expect(details.locator("code")).toHaveText(`p34-background-${status}`);
    await expect(page.getByRole("button", { name: "重新加载", exact: true })).toHaveCount(0);
    expect(writes).toEqual([]);

    failing = false;
    await refresh.click();
    await expect(feedback).toHaveCount(0);
    await expect(approval).toBeVisible();
    await expect(center).toHaveAttribute("data-state", "ready");
  }
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
}, testInfo) => {
  await setup(page);
  await page.goto("/org-admin/roles");
  await expect(page.getByRole("table", { name: "角色能力矩阵" })).toBeVisible();
  await expect(page.getByText("固定角色模板", { exact: true }).first()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  if ((page.viewportSize()?.width ?? 1440) < 760) {
    const matrix = page.locator(".org-role-matrix-scroll");
    await expect(matrix.evaluate((node) => node.scrollWidth > node.clientWidth)).resolves.toBe(
      true,
    );
    await expect(
      matrix.evaluate((node) => {
        node.scrollLeft = 100;
        const moved = node.scrollLeft > 0;
        node.scrollLeft = 0;
        return moved;
      }),
    ).resolves.toBe(true);
  }
  await capturePhase2Evidence(page, testInfo, "P31", "role-matrix", [
    "fixed-role-catalog",
    "capability-matrix-visible",
  ]);

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
  await capturePhase2Evidence(page, testInfo, "P31", "data-scopes", [
    "scope-section-switch",
    "current-session-scope-visible",
  ]);
  await page.getByLabel("搜索成员").fill("陈采购");
  await page.getByLabel("数据范围").selectOption("workspace");
  await expect(page.getByText("陈采购", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "重置", exact: true }).click();

  await page.getByRole("button", { name: /指定资源授权 1/ }).click();
  await expect(page.getByText("采购团队核对供应报价")).toBeVisible();
  await capturePhase2Evidence(page, testInfo, "P31", "resource-grants", [
    "existing-grant-reason",
    "grants-not-role-definitions",
  ]);
  await page.getByRole("button", { name: "已撤销 0" }).click();
  await expect(page.getByRole("heading", { name: "当前状态没有资源授权" })).toBeVisible();
  await capturePhase2Evidence(page, testInfo, "P31", "grants-filter-empty", [
    "revoked-filter-empty",
    "empty-is-filter-scoped",
  ]);
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
}, testInfo) => {
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
  await capturePhase2Evidence(page, testInfo, "P31", "grant-create-form", [
    "target-member-selected",
    "resource-and-reason-entered",
    "not-yet-submitted",
  ]);
  await createForm.getByRole("button", { name: "创建", exact: true }).click();
  await expect(page.getByText("指定资源授权已创建。")).toBeVisible();

  await page.getByLabel("变更原因").fill("延长核价窗口");
  await page.getByRole("button", { name: "延长授权" }).click();
  await expect(page.getByText("授权到期时间已更新。")).toBeVisible();

  await page.getByRole("button", { name: "撤销授权" }).click();
  const dialog = page.getByRole("dialog", { name: "撤销指定资源授权原因" });
  await dialog.getByRole("textbox").fill("协作已经结束");
  await capturePhase2Evidence(page, testInfo, "P31", "grant-revoke-reason", [
    "revoke-requires-reason",
    "not-yet-confirmed",
  ]);
  await dialog.getByRole("button", { name: "确认提交" }).click();
  await expect(page.getByText("指定资源授权已撤销。")).toBeVisible();

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

test("resource grant creation exposes inline field errors and keeps the existing UUID contract", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-08-26T10:00:00.000Z"));
  await setup(page);
  const writes: Array<{ method: string; body: Record<string, unknown> }> = [];
  await page.route(`**/api/v1/org/${org}/resource-grants*`, async (route) => {
    if (route.request().method() === "GET") return route.fallback();
    writes.push({
      method: route.request().method(),
      body: route.request().postDataJSON(),
    });
    return route.fulfill({ status: 201, json: env({ ...activeGrant, version: 2 }) });
  });

  await page.goto("/org-admin/roles");
  await page.getByRole("button", { name: /指定资源授权 1/ }).click();
  await page.getByRole("button", { name: "创建授权" }).click();
  const form = page.locator("form.org-grant-form"),
    submit = form.getByRole("button", { name: "创建", exact: true });

  await submit.click();
  for (const [field, error] of [
    ["org-grant-resource-id", "请输入资源编号。"],
    ["org-grant-member", "请选择同组织活动成员。"],
    ["org-grant-reason", "请填写业务原因。"],
  ] as const) {
    const input = form.locator(`#${field}`);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAttribute("aria-describedby", /-help .*?-error/);
    await expect(form.locator(`#${field}-error`)).toHaveText(error);
  }
  await expect(page.locator("#org-grant-resource-id")).toBeFocused();
  expect(writes).toHaveLength(0);

  await form.getByLabel("工作区").selectOption(ws);
  await form.getByLabel("资源编号").fill("not-a-uuid");
  await form.getByLabel("目标成员").selectOption(memberBuyer);
  await form.getByLabel("业务原因").fill("临时协作核价");
  await form.getByLabel("到期时间").fill("2020-01-01T00:00");
  await submit.click();
  await expect(page.locator("#org-grant-resource-id")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#org-grant-resource-id-error")).toHaveText(
    "请从对应资源详情页复制有效 UUID。",
  );
  await expect(page.locator("#org-grant-expiry")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#org-grant-expiry-error")).toHaveText("到期时间必须晚于当前时间。");
  expect(writes).toHaveLength(0);

  await form.getByLabel("资源编号").fill(grantResource);
  await form.getByLabel("到期时间").fill("2026-08-27T10:00");
  await expect(page.locator("#org-grant-resource-id")).not.toHaveAttribute("aria-invalid");
  await expect(page.locator("#org-grant-expiry")).not.toHaveAttribute("aria-invalid");
  await submit.click();
  await expect(page.getByRole("status")).toContainText("指定资源授权已创建。");
  expect(writes).toHaveLength(1);
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
});

test("role catalog empty state is independent of resource grant count", async ({
  page,
}, testInfo) => {
  await setup(page);
  await page.route(`**/api/v1/org/${org}/resource-grants*`, (route) =>
    route.fulfill({ json: env([], { page: 1, limit: 20, total: 0 }) }),
  );
  await page.goto("/org-admin/roles");
  await expect(page.getByRole("table", { name: "角色能力矩阵" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "暂无活动角色" })).toHaveCount(0);
  await capturePhase2Evidence(page, testInfo, "P31", "roles-without-grants", [
    "roles-visible-with-zero-grants",
    "no-false-empty-role-notice",
  ]);
  await page.route("**/api/v1/org/admin/roles", (route) => route.fulfill({ json: env([]) }));
  await page.reload();
  await expect(page.getByRole("heading", { name: "暂无活动角色" })).toBeVisible();
  await expect(page.getByRole("table", { name: "角色能力矩阵" })).toHaveCount(0);
  await capturePhase2Evidence(page, testInfo, "P31", "roles-empty", [
    "empty-role-catalog",
    "matrix-not-rendered",
  ]);
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
  await expect(page.locator(".org-admin-center")).toHaveAttribute("data-state", "ready");
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
  const rotateDialog = page.getByRole("dialog", { name: /轮换.*密钥/ });
  await expect(rotateDialog).toContainText("旧令牌立即失效");
  await rotateDialog.getByRole("button", { name: "取消" }).click();
  await page.getByRole("button", { name: "撤销访问" }).first().click();
  await expect(page.getByRole("dialog", { name: /撤销.*访问/ })).toContainText(
    "立即失效且不能恢复",
  );
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

async function navigateOrganization(page: Page, path: string) {
  const desktopLink = page
    .getByRole("complementary", { name: "工作区导航", exact: true })
    .locator(`a[href="${path}"]`);
  if (await desktopLink.isVisible()) {
    await desktopLink.click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    return;
  }
  const navigation = page.getByRole("navigation", { name: "组织管理后台导航", exact: true });
  const menuTrigger = page.getByRole("button", { name: "打开导航菜单" });
  if (
    (await menuTrigger.isVisible()) &&
    (await menuTrigger.getAttribute("aria-expanded")) !== "true"
  )
    await menuTrigger.click();
  const link = navigation.locator(`a[href="${path}"]`);
  if (!(await link.isVisible()))
    await navigation
      .locator("details")
      .filter({ has: page.locator(`a[href="${path}"]`) })
      .locator("summary")
      .click();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

async function fillOrganizationToken(page: Page) {
  await page.getByLabel("令牌名称").fill("隔离生命周期测试");
  await page.getByRole("checkbox", { name: /任务只读/ }).check();
  await page.getByLabel("创建原因").fill("验证一次性展示边界");
}

test("UI2-OG02 member role cancellation and conflict retain the selected role", async ({
  page,
}) => {
  await setup(page);
  const writes: unknown[] = [];
  await page.route(`**/api/v1/org/admin/members/${memberBuyer}/roles`, async (route) => {
    writes.push(route.request().postDataJSON());
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    await route.fulfill({
      status: 409,
      json: {
        error: {
          code: "member_version_conflict",
          message: "成员版本已变化",
          action_hint: "刷新成员后重试",
        },
        request_id: "ui2-og-role-conflict",
        trace_id: "ui2-og-role-conflict",
      },
    });
  });
  await page.goto("/org-admin/members");
  const row = page.locator(".org-admin-line").filter({ hasText: "陈采购" });
  const selector = row.getByRole("combobox", { name: "选择 陈采购 的角色" });
  await expect(selector).toHaveValue("procurement_member");
  await selector.selectOption("member");
  const trigger = row.getByRole("button", { name: "分配角色" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "分配普通成员原因" });
  await expect(dialog.getByRole("textbox")).toBeFocused();
  await dialog.getByRole("textbox").fill("这次取消不应写入");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(writes).toHaveLength(0);
  await trigger.click();
  await dialog.getByRole("textbox").fill("按成员新职责调整");
  await dialog.getByRole("button", { name: "确认提交" }).click();
  await expect(page.locator(".org-admin-notice")).toContainText("数据已被其他操作更新");
  await expect(selector).toHaveValue("member");
  expect(writes).toEqual([
    { role_code: "member", expected_version: 1, reason: "按成员新职责调整" },
  ]);
});

test("UI2-OG03 approval and data governance expose only their real read contracts", async ({
  page,
}) => {
  await setup(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/org/admin/") && !["GET", "HEAD"].includes(request.method()))
      writes.push(request.url());
  });
  await page.route("**/api/v1/org/admin/data", (route) =>
    route.fulfill({
      json: env({
        comparisons: [],
        exports: [
          {
            id: "ui2-waiting",
            workspace_name: "等待工作区",
            report_type: "trend",
            status: "queued",
            row_count: null,
            created_at: "2026-09-08T00:00:00.000Z",
            updated_at: "2026-09-08T00:00:00.000Z",
          },
          {
            id: "ui2-empty",
            workspace_name: "空文件工作区",
            report_type: "trend",
            status: "succeeded",
            row_count: 0,
            created_at: "2026-09-08T00:00:00.000Z",
            updated_at: "2026-09-08T00:00:00.000Z",
          },
        ],
        observed_at: "2026-09-08T00:00:00.000Z",
      }),
    }),
  );
  await page.goto("/org-admin/approvals");
  const approvals = page.locator(".org-approval-governance");
  await expect(approvals).toBeVisible();
  await approvals.getByRole("button", { name: /模板版本/ }).click();
  await approvals.getByRole("button", { name: /采购首次审批模板/ }).click();
  await expect(approvals.locator(".org-approval-diff-empty")).toContainText("没有上一持久化版本");
  await expect(
    approvals.getByRole("button", { name: /^(发布模板|回退模板|批准|驳回|保存|编辑模板)$/ }),
  ).toHaveCount(0);
  await expect(approvals.getByRole("link", { name: "前往审批工作台" })).toHaveAttribute(
    "href",
    "/tasks/approvals",
  );
  await navigateOrganization(page, "/org-admin/data");
  const data = page.locator(".org-data-panel");
  await expect(data).toContainText("数量不等于数据质量");
  await data.getByRole("button", { name: /导出履历/ }).click();
  await expect(data.locator("article").filter({ hasText: "等待工作区" })).toContainText("尚未生成");
  await expect(data.locator("article").filter({ hasText: "空文件工作区" })).toContainText("0 行");
  await expect(data.getByRole("button", { name: /下载|创建|删除|修复/ })).toHaveCount(0);
  await expect(data.getByRole("link", { name: "前往报表工作台" })).toHaveAttribute(
    "href",
    "/reports",
  );
  expect(writes).toHaveLength(0); // Browser write requests only; not a database read-only claim.
});

test("UI2-OG04 token rotation revocation and refused clipboard preserve exact contracts", async ({
  page,
}) => {
  await setup(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("Clipboard denied", "NotAllowedError");
        },
      },
    });
  });
  let token = { ...organizationTokens[0], name: "验收只读令牌", version: 5 };
  const writes: Array<{ path: string; body: unknown }> = [];
  await page.route("**/api/v1/org/admin/tokens", (route) => route.fulfill({ json: env([token]) }));
  await page.route("**/api/v1/org/admin/tokens/*/actions", async (route) => {
    const body = route.request().postDataJSON();
    writes.push({ path: new URL(route.request().url()).pathname, body });
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    token =
      body.action === "rotate"
        ? { ...token, id: "00000000-0000-4000-8000-000000000999", version: 1 }
        : { ...token, status: "revoked", version: 2 };
    await route.fulfill({
      json: env(
        body.action === "rotate"
          ? {
              ...token,
              secret: "synthetic-ui2-rotation-only",
              rotated_from_id: organizationTokens[0].id,
            }
          : { id: token.id, status: token.status, version: token.version },
      ),
    });
  });
  await page.goto("/org-admin/tokens");
  await page.getByRole("button", { name: "轮换密钥" }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "确认提交" })).toBeDisabled();
  await dialog.getByRole("button", { name: "取消" }).click();
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "轮换密钥" }).click();
  await dialog.getByRole("textbox").fill("定期轮换隔离令牌");
  await dialog.getByRole("button", { name: "确认提交" }).click();
  await expect(page.getByRole("button", { name: "撤销访问" })).toBeEnabled();
  await page.getByRole("button", { name: "复制明文" }).click();
  await expect(page.locator(".org-token-secret [role=status]")).toContainText("浏览器拒绝复制");
  await page.getByRole("button", { name: "我已安全保存" }).click();
  await expect(page.locator(".org-token-secret")).toHaveCount(0);
  await page.getByRole("button", { name: "撤销访问" }).click();
  dialog = page.getByRole("dialog", { name: /撤销.*访问/ });
  await expect(dialog).toContainText("不能恢复");
  await dialog.getByRole("textbox").fill("结束隔离验收用途");
  await dialog.getByRole("button", { name: "确认提交" }).click();
  await expect(page.locator(".org-token-list article")).toHaveAttribute("data-status", "revoked");
  await expect(page.getByRole("button", { name: "轮换密钥" })).toHaveCount(0);
  await expect(page.locator(".org-token-secret")).toHaveCount(0);
  expect(writes).toEqual([
    {
      path: `/api/v1/org/admin/tokens/${organizationTokens[0].id}/actions`,
      body: { action: "rotate", expected_version: 5, reason: "定期轮换隔离令牌" },
    },
    {
      path: "/api/v1/org/admin/tokens/00000000-0000-4000-8000-000000000999/actions",
      body: { action: "revoke", expected_version: 1, reason: "结束隔离验收用途" },
    },
  ]);
});

for (const timing of ["completed", "late-response", "dismiss-during-refresh"] as const) {
  test(`UI2-OG01 token secret ownership ${timing}`, async ({ page }) => {
    await setup(page);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => (release = resolve));
    let posts = 0;
    let reads = 0;
    await page.route("**/api/v1/org/admin/tokens", async (route) => {
      if (route.request().method() === "POST") {
        posts += 1;
        expect(route.request().postDataJSON()).toEqual({
          name: "隔离生命周期测试",
          scopes: ["task:read"],
          ttl_days: 90,
          reason: "验证一次性展示边界",
        });
        expect(route.request().headers()["idempotency-key"]).toBeTruthy();
        if (timing === "late-response") await pending;
        await route.fulfill({
          status: 201,
          json: env({ ...organizationTokens[0], secret: "synthetic-ui2-one-time-only" }),
        });
      } else {
        reads += 1;
        if (reads === 2 && timing === "dismiss-during-refresh") await pending;
        await route.fulfill({ json: env(organizationTokens) });
      }
    });
    try {
      await page.goto("/org-admin/tokens");
      await expect(page.getByRole("heading", { name: "组织只读访问凭据" })).toBeVisible();
      await fillOrganizationToken(page);
      await page.getByRole("button", { name: "创建并显示一次明文" }).click();
      await expect.poll(() => posts).toBe(1);
      const secretPanel = page.locator(".org-token-secret");
      if (timing === "completed") {
        await expect(secretPanel).toBeVisible();
        await expect(page.getByRole("button", { name: "创建并显示一次明文" })).toBeEnabled();
        await navigateOrganization(page, "/org-admin/data");
        await expect(page.locator(".org-data-panel")).toBeVisible();
        await navigateOrganization(page, "/org-admin/tokens");
      } else if (timing === "late-response") {
        await navigateOrganization(page, "/org-admin/data");
        await expect(page.locator(".org-data-panel")).toBeVisible();
        await navigateOrganization(page, "/org-admin/tokens");
        const response = page.waitForResponse(
          (item) => item.request().method() === "POST" && item.url().endsWith("/org/admin/tokens"),
        );
        release();
        await (await response).finished();
      } else {
        await expect(secretPanel).toBeVisible();
        await expect.poll(() => reads).toBe(2);
        await page.getByRole("button", { name: "我已安全保存" }).click();
        await expect(secretPanel).toHaveCount(0);
        release();
      }
      await expect(page.getByRole("heading", { name: "组织只读访问凭据" })).toBeVisible();
      await expect(page.getByRole("button", { name: "创建并显示一次明文" })).toBeEnabled();
      await expect(secretPanel).toHaveCount(0);
      expect(posts).toBe(1);
      expect(reads).toBe(2); // Initial read and write refresh; navigation really reuses KeepAlive.
    } finally {
      release();
    }
  });
}

for (const route of [
  "/org-admin",
  "/org-admin/members",
  "/org-admin/roles",
  "/org-admin/workspaces",
  "/org-admin/teams",
  "/org-admin/approvals",
  "/org-admin/data",
  "/org-admin/tokens",
  "/org-admin/audit",
]) {
  test(`organization compact toolbar preserves readable actions: ${route}`, async ({ page }) => {
    await setup(page);
    await page.goto(route);
    await expect(page.locator(".org-admin-center")).toHaveAttribute("data-state", "ready");
    const hero = page.locator(".org-admin-hero");
    await expect(hero).toBeVisible();
    await expect(hero).toHaveCSS("background-image", "none");
    await expect(hero).toHaveCSS("flex-direction", "row");
    const overview = route === "/org-admin";
    const width = page.viewportSize()!.width;
    await expect(hero).toHaveCSS(
      "background-color",
      overview ? "rgba(0, 0, 0, 0)" : "rgb(255, 255, 255)",
    );
    await expect(hero.locator("h1,h2")).toHaveCSS(
      "font-size",
      overview ? (width >= 1200 ? "29px" : "24px") : "22px",
    );
    await expect(hero.locator("h1,h2")).not.toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(hero.getByRole("button", { name: "刷新数据", exact: true })).toBeVisible();
    expect(await hero.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    if ((page.viewportSize()?.width ?? 1440) <= 840) {
      for (const label of await page.locator(".role-mobile-nav span").all()) {
        await expect(label).toHaveCSS("font-size", "13px");
        expect(
          await label.evaluate((el) => {
            const own = el.getBoundingClientRect(),
              parent = el.parentElement!.getBoundingClientRect();
            return own.left >= parent.left && own.right <= parent.right;
          }),
        ).toBe(true);
      }
    }

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("organization sidebar groups context and utility links without altering mobile navigation", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/org-admin");
  await expect(page.locator(".org-admin-center")).toHaveAttribute("data-state", "ready");
  const footer = page.locator(".commerce-sidebar footer");
  if (page.viewportSize()!.width <= 840) {
    await expect(footer).toBeHidden();
    return;
  }
  const context = footer.getByRole("link", { name: "侧栏切换工作区" });
  const settings = footer.getByRole("link", { name: "设置" });
  const help = footer.locator("summary").filter({ hasText: "帮助" });
  const back = footer.getByRole("link", { name: "返回成员工作台" });
  await expect(context).toHaveAttribute("href", "/select-context");
  await expect(back).toHaveAttribute("href", "/home");
  await expect(back.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await expect(context.locator("svg").first()).toHaveAttribute("aria-hidden", "true");
  const [contextBox, settingsBox, helpBox, backBox] = await Promise.all(
    [context, settings, help, back].map((item) => item.boundingBox()),
  );
  expect(contextBox!.y + contextBox!.height).toBeLessThanOrEqual(settingsBox!.y);
  expect(settingsBox!.y).toBe(helpBox!.y);
  expect(settingsBox!.x + settingsBox!.width).toBeLessThan(helpBox!.x);
  expect(settingsBox!.y + settingsBox!.height).toBeLessThanOrEqual(backBox!.y);
});

test("wide governance metrics align labels, values and notes beside the icon", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await setup(page);
  await page.goto("/org-admin");
  const navigation = page.getByRole("complementary", { name: "工作区导航" });
  const first = navigation.getByRole("link", { name: "治理概览", exact: true });
  const last = navigation.getByRole("link", { name: "组织审计", exact: true });
  await expect(page.locator(".org-admin-center--profile-review")).toHaveCSS(
    "font-family",
    /^"Segoe UI",/,
  );
  await expect(page.locator(".org-admin-center--profile-review")).toHaveCSS(
    "font-family",
    /DengXian/,
  );
  expect((await navigation.boundingBox())!.width).toBeCloseTo(254, 0);
  expect((await first.boundingBox())!.y).toBeCloseTo(187, 0);
  expect((await last.boundingBox())!.y).toBeLessThan(700);
  await expect(first.locator("svg")).toHaveCSS("width", "20px");
  await expect(navigation.locator("section h2").first()).toHaveCSS("margin-inline-start", "0px");
  await expect(navigation.locator(".midou-area-tabs a").first()).toHaveCSS("min-height", "32px");
  await expect(navigation.locator(".midou-area-tabs")).toHaveCSS("margin-inline-end", "8px");
  await expect(first).toHaveCSS("column-gap", "19px");
  await expect(first.locator("svg")).toHaveCSS("translate", "1px 1px");
  await expect(navigation.locator("footer")).toHaveCSS("padding-inline-end", "5px");
  const workspaceSwitch = navigation.getByRole("link", { name: "侧栏切换工作区", exact: true });
  const workspaceChevron = workspaceSwitch.locator(".midou-workspace-chevron");
  await expect(workspaceChevron).toBeVisible();
  await expect(workspaceChevron).toHaveCSS("width", "14px");
  const [switchBox, chevronBox] = await Promise.all([
    workspaceSwitch.boundingBox(),
    workspaceChevron.boundingBox(),
  ]);
  expect(chevronBox!.x + chevronBox!.width).toBeLessThan(switchBox!.x + switchBox!.width);
  await expect(navigation.getByRole("link", { name: "返回成员工作台" })).toHaveCSS(
    "border-top-width",
    "1px",
  );
  await expect(navigation.getByRole("link", { name: "返回成员工作台" })).toBeInViewport({
    ratio: 1,
  });
  const actions = page.locator(".org-overview-actions");
  const refresh = actions.getByRole("button", { name: "刷新数据", exact: true });
  const invite = actions.getByRole("link", { name: "邀请成员", exact: true });
  await expect(invite).toHaveAttribute("href", "/org-admin/members");
  const [refreshBox, inviteBox] = await Promise.all([refresh.boundingBox(), invite.boundingBox()]);
  expect(refreshBox!.width).toBe(114);
  expect(refreshBox!.height).toBe(40);
  await expect(invite).toHaveCSS("font-size", "14px");
  expect(Math.abs(refreshBox!.y - 122)).toBeLessThanOrEqual(2);
  expect(inviteBox!.width).toBe(125);
  expect(Math.abs(inviteBox!.x + inviteBox!.width - 1645)).toBeLessThanOrEqual(2);
  expect(inviteBox!.x - refreshBox!.x - refreshBox!.width).toBe(20);
  expect(
    Math.abs(inviteBox!.y + inviteBox!.height / 2 - refreshBox!.y - refreshBox!.height / 2),
  ).toBeLessThanOrEqual(1);
  const editor = page.locator(".organization-profile-editor");
  const nameField = editor.getByLabel("名称", { exact: true });
  const timezoneField = editor.getByLabel("时区", { exact: true });
  const edge = await nameField.evaluate((input) => {
    const sample = document.createElement("span");
    sample.style.boxShadow =
      "0 0 0 0.5px color-mix(in srgb, var(--so-border-strong) 27%, transparent)";
    input.parentElement!.append(sample);
    const current = getComputedStyle(input).boxShadow;
    const expected = getComputedStyle(sample).boxShadow;
    sample.remove();
    return { current, expected };
  });
  console.log("GOVERNANCE_IDLE_FIELD_EDGE", JSON.stringify(edge));
  expect(edge.current).toBe(edge.expected);
  await expect(timezoneField).toHaveCSS("box-shadow", edge.expected);
  await expect(editor.getByRole("textbox", { name: "变更原因", exact: true })).toHaveCSS(
    "box-shadow",
    edge.expected,
  );
  await nameField.focus();
  await expect(nameField).not.toHaveCSS("box-shadow", edge.expected);
  await nameField.blur();
  await expect(nameField).toHaveCSS("box-shadow", edge.expected);
  const save = editor.getByRole("button", { name: "保存更改", exact: true });
  await expect(nameField).toHaveCSS("min-height", "34px");
  await expect(nameField.locator("..").locator(":scope > span")).toHaveCSS(
    "translate",
    "-1px -1px",
  );
  await expect(nameField).toHaveCSS("border-radius", "7px");
  await expect(timezoneField).toHaveCSS("border-radius", "7px");
  await expect(nameField).toHaveCSS("font-family", /^"Segoe UI",/);
  await expect(nameField.locator("..")).toHaveCSS("font-size", "14px");
  await expect(nameField.locator("..")).toHaveCSS("row-gap", "4px");
  await expect(nameField.locator("..").locator(":scope > span")).toHaveCSS("font-weight", "700");
  const facts = page.locator(".organization-profile-facts dl");
  await expect(facts.locator("dt").first()).toHaveCSS("font-weight", "600");
  await expect(facts.locator("dd").first()).toHaveCSS("font-size", "17px");
  await expect(save).toHaveCSS("font-size", "14px");
  await expect(save).toHaveCSS("font-weight", "600");
  await expect(editor.locator(".organization-profile-actions")).toHaveCSS("gap", "20px");
  await expect(editor.locator(".organization-profile-actions")).toHaveCSS("translate", "-1px -3px");
  const reason = editor.getByRole("textbox", { name: "变更原因", exact: true });
  const count = editor.locator("#organization-profile-reason-count");
  await expect(reason).toHaveCSS("min-height", "67px");
  await expect(reason).toHaveAttribute("aria-describedby", "organization-profile-reason-count");
  await expect(reason).toHaveAttribute("required", "");
  await expect(count).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const idleBorder = await nameField.evaluate((el) => getComputedStyle(el).borderTopColor);
  const expectedBorder = await nameField.evaluate((el) => {
    const sample = document.createElement("span");
    sample.style.color = "color-mix(in srgb, var(--so-border-strong) 42%, var(--so-border))";
    el.parentElement!.append(sample);
    const color = getComputedStyle(sample).color;
    sample.remove();
    return color;
  });
  expect(idleBorder).toBe(expectedBorder);
  await expect(timezoneField).toHaveCSS("border-top-color", expectedBorder);
  await nameField.focus();
  await expect(nameField).not.toHaveCSS("border-top-color", idleBorder);
  await nameField.blur();
  expect(Math.abs((await nameField.boundingBox())!.y - 554)).toBeLessThanOrEqual(3);
  expect(Math.abs((await timezoneField.boundingBox())!.x - 753)).toBeLessThanOrEqual(2);
  await expect(editor.locator(".organization-profile-fields")).toHaveCSS("row-gap", "13px");
  const logoControls = editor.locator(".organization-logo-controls");
  const logoPreview = logoControls.getByRole("button", { name: "预览", exact: true });
  await expect(logoControls).toHaveCSS("inset-block-start", "1px");
  await expect(logoPreview).toHaveCSS("min-height", "36px");
  const [logoRow, previewBox] = await Promise.all([
    logoControls.boundingBox(),
    logoPreview.boundingBox(),
  ]);
  expect(logoRow!.width).toBe(758);
  expect(previewBox!.width).toBe(76);
  expect(Math.abs(previewBox!.x - 995)).toBeLessThanOrEqual(3);
  const saveBox = (await save.boundingBox())!;
  expect(saveBox.width).toBe(97);
  expect(Math.abs(saveBox.y - 875)).toBeLessThanOrEqual(6);
  const identity = page.locator(".organization-profile-facts > header");
  const profileFields = page.locator(".organization-profile-fields");
  await expect(profileFields).toHaveCSS("column-gap", "32px");
  const logoInput = (await logoControls.getByRole("textbox").boundingBox())!;
  expect(Math.abs(logoInput.x + logoInput.width - 913)).toBeLessThanOrEqual(4);
  await expect(identity.locator(".org-identity-name small")).toHaveCSS("font-size", "15px");
  await expect(identity.locator("p")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 2, -5)");
  await expect(page.locator('header[data-profile-overview="true"] > div:first-child')).toHaveCSS(
    "inset-block-start",
    "-9px",
  );
  const editorHeading = editor.locator(":scope > h3");
  await expect(editorHeading).toHaveCSS("inset-inline-start", "3px");
  await expect(editorHeading).toHaveCSS("inset-block-start", "-4px");
  const status = identity.locator("i");
  await expect(status).toBeVisible();
  const [identityBox, statusBox, markBox] = await Promise.all(
    [identity, status, identity.locator(".org-identity-mark")].map((part) => part.boundingBox()),
  );
  expect(statusBox!.x + statusBox!.width).toBeLessThan(identityBox!.x + identityBox!.width - 30);
  expect([markBox!.width, markBox!.height]).toEqual([58, 58]);
  expect(
    Math.abs(statusBox!.y + statusBox!.height / 2 - markBox!.y - markBox!.height / 2),
  ).toBeLessThanOrEqual(6);
  const factIcons = await page
    .locator(".organization-profile-facts dt > svg")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().x));
  for (const [index, x] of [785, 1093, 1365].entries())
    expect(Math.abs(factIcons[index] - x)).toBeLessThanOrEqual(8);
  const metrics = page.getByRole("region", { name: "组织运行摘要" });
  await expect(metrics.locator("article")).toHaveCount(6);
  const metricsBounds = (await metrics.boundingBox())!;
  const metricCaptions = metrics.locator("article > span");
  await expect(metricCaptions.first()).toHaveCSS("margin-block-start", "-1px");

  expect(Math.abs(metricsBounds.y + metricsBounds.height - 449)).toBeLessThanOrEqual(3);
  const items = await metrics.locator("article").evaluateAll((articles) =>
    articles.map((article) => {
      const box = (selector: string) => article.querySelector(selector)!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(article.querySelector("span")!);
      const text = [...range.getClientRects()].at(-1)!;
      return {
        iconRight: box("svg").right,
        iconWidth: box("svg").width,
        titleX: text.x,
        valueX: box("b").x,
        noteX: box("small").x,
        separator: getComputedStyle(article, "::after").content,
      };
    }),
  );
  for (const [index, item] of items.entries()) {
    expect(item.iconWidth).toBe(22);
    expect(item.titleX - item.iconRight).toBeGreaterThanOrEqual(8);
    expect(Math.abs(item.titleX - item.valueX)).toBeLessThan(1);
    expect(item.noteX).toBe(item.valueX);
    expect(item.separator).toBe(index < 5 ? '""' : "none");
  }
  const sidebar = page.getByRole("complementary", { name: "治理快捷入口与组织状态" });
  const memberShortcut = sidebar.getByRole("link", { name: /成员与邀请/ });
  const readingLines = await sidebar.evaluate((card) => {
    const css = (selector: string) => getComputedStyle(card.querySelector(selector)!);
    const sample = document.createElement("span");
    sample.style.color = "color-mix(in srgb, var(--so-text) 12%, var(--so-text-muted))";
    card.append(sample);
    const expectedTone = getComputedStyle(sample).color;
    sample.remove();
    return {
      heading: css("section:first-child > a b").insetBlockStart,
      status: css(".midou-governance-status > div:has(.midou-governance-status-badge) dt")
        .translate,
      lastIcon: css(".midou-governance-status > div:last-child dt > svg").translate,
      badgeEnd: css(".midou-governance-status-badge").marginInlineEnd,
      toneMatches: css(".midou-governance-status > div > dt").color === expectedTone,
    };
  });
  console.log("GOVERNANCE_SIDE_READING_LINES", JSON.stringify(readingLines));
  expect(readingLines).toEqual({
    heading: "4px",
    status: "-1px 4px",
    lastIcon: "-1px 2px",
    badgeEnd: "3px",
    toneMatches: true,
  });
  await expect(memberShortcut.locator("svg circle")).toHaveCount(1);
  await expect(memberShortcut.locator("svg").first().locator("path")).toHaveCount(3);
  await expect(sidebar.locator(":scope > section").first()).toHaveCSS(
    "padding-inline-start",
    "26px",
  );
  await expect(sidebar.locator(":scope > section").last()).toHaveCSS("padding-block-start", "10px");
  await expect(memberShortcut).toHaveCSS("column-gap", "22px");
  await expect(memberShortcut).toHaveCSS("grid-template-columns", /^34px .+ 18px$/);
  await expect(memberShortcut.locator("b")).toHaveCSS("font-size", "14px");
  const shortcutTracks = await sidebar.locator("section:first-child > a").evaluateAll((rows) =>
    rows.map((row) => {
      const tile = row.querySelector("svg:first-child")!.getBoundingClientRect();
      const copy = row.querySelector("span")!.getBoundingClientRect();
      const arrow = row.querySelector("svg:last-child")!.getBoundingClientRect();
      return {
        tile: tile.x,
        tileWidth: tile.width,
        copy: copy.x,
        arrow: arrow.x,
        arrowWidth: arrow.width,
      };
    }),
  );
  for (const track of shortcutTracks) {
    expect(track).toEqual(shortcutTracks[0]);
    expect([track.tileWidth, track.arrowWidth]).toEqual([34, 18]);
  }
  await expect(memberShortcut.locator("b")).toHaveCSS("inset-block-start", "4px");
  await expect(memberShortcut.locator("small")).toBeVisible();
  await expect(memberShortcut).toHaveAttribute("href", "/org-admin/members");
  await expect(memberShortcut.locator(":scope > span")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, -1, -1)",
  );
  await expect(sidebar.getByRole("term").first()).toHaveCSS("font-size", "14px");
  await expect(sidebar.getByRole("term").nth(1)).toHaveCSS("translate", "0px 2px");
  await expect(sidebar.getByRole("definition").nth(1)).toHaveCSS(
    "font-variant-numeric",
    "tabular-nums",
  );
  expect(Math.abs((await memberShortcut.locator("b").boundingBox())!.x - 1285)).toBeLessThanOrEqual(
    4,
  );
  const statusIcon = sidebar.getByRole("term").filter({ hasText: "组织使用状态" }).locator("svg");
  await expect(statusIcon.locator("circle")).toHaveCount(1);
  await expect(statusIcon).toHaveAttribute("aria-hidden", "true");
  await expect(statusIcon).toHaveCSS("width", "36px");
  await expect(statusIcon).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const statusRows = sidebar.locator(".midou-governance-status > div");
  for (const row of await statusRows.all()) {
    await expect(row).toHaveCSS("min-block-size", "40px");
    await expect(row).toHaveCSS("align-items", "start");
  }
  await expect(sidebar.locator(":scope > section").last()).toHaveCSS(
    "padding-inline-start",
    "26px",
  );
  const [shortcuts, statusCard] = await sidebar.locator(":scope > section").evaluateAll((cards) =>
    cards.map((card) => {
      const { top, bottom } = card.getBoundingClientRect();
      return { top, bottom };
    }),
  );
  expect(Math.abs(shortcuts.top - 472)).toBeLessThanOrEqual(3);
  expect(Math.abs(shortcuts.bottom - 729)).toBeLessThanOrEqual(3);
  expect(Math.abs(statusCard.top - 746)).toBeLessThanOrEqual(3);
  expect(Math.abs(statusCard.bottom - 926)).toBeLessThanOrEqual(5);
  const editorBottom = (await editor.boundingBox())!;
  const bottomGap = Math.abs(editorBottom.y + editorBottom.height - statusCard.bottom);
  console.log("governance bottom alignment", bottomGap);
  expect(bottomGap).toBeLessThanOrEqual(1);
  const tones = await page.locator(".organization-profile-workspace").evaluate((workspace) => {
    const probe = document.createElement("div");
    probe.style.background = "color-mix(in srgb, var(--so-panel-soft) 28%, var(--so-panel))";
    workspace.append(probe);
    const panelTone = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return {
      panelTone,
      surfaces: [
        ...workspace.querySelectorAll(
          ".organization-profile-facts, .organization-profile-metrics, .organization-profile-editor, .midou-governance-side > section",
        ),
      ].map((el) => getComputedStyle(el).backgroundColor),
      inputTone: getComputedStyle(workspace.querySelector("input")!).backgroundColor,
    };
  });
  expect(tones.surfaces).toHaveLength(5);
  expect(tones.surfaces.every((tone) => tone === tones.panelTone)).toBe(true);
  expect(tones.inputTone).not.toBe(tones.panelTone);
  const readingTracks = await page
    .locator(".organization-profile-facts dl > div")
    .evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().width));
  expect(readingTracks).toHaveLength(3);
  expect(readingTracks[2]! - readingTracks[1]!).toBeGreaterThan(60);
  await expect(page.locator(".organization-profile-metrics article > small").first()).toHaveCSS(
    "translate",
    "0px -1px",
  );
  const readingStatusRows = sidebar.locator(".midou-governance-status > div");
  const semanticState = sidebar.locator(
    ".midou-governance-status > div:has(.midou-governance-status-badge)",
  );
  await expect(semanticState.locator("dt")).toHaveCSS("translate", "-1px 4px");
  await expect(semanticState.locator(".midou-governance-status-badge")).toHaveText("正常使用");
  await expect(readingStatusRows.nth(1).locator("dd")).toHaveCSS(
    "font-variant-numeric",
    "tabular-nums",
  );
  for (const row of await readingStatusRows.all()) {
    await expect(row).toHaveCSS("padding-block-start", "6.5px");
    const layout = await row.evaluate((item) => {
      const bounds = item.getBoundingClientRect();
      return [...item.querySelectorAll("dt, dd")].every((child) => {
        const part = child.getBoundingClientRect();
        return part.top >= bounds.top && part.bottom <= bounds.bottom && part.right <= bounds.right;
      });
    });
    expect(layout).toBe(true);
  }
  await expect(
    page.locator(".organization-profile-editor label > span:first-child").first(),
  ).toHaveCSS("inset-block-start", "-1px");
  const approvals = sidebar.getByRole("link", { name: /审批模板/ });
  await expect(approvals.locator('svg path[d="m14 20 2 2 4-4"]')).toHaveCount(1);
  await expect(approvals.locator("svg").first()).toHaveAttribute("aria-hidden", "true");
  await expect(approvals).toHaveAttribute("href", "/org-admin/approvals");
  const approvalMetric = page
    .getByRole("region", { name: "组织运行摘要" })
    .locator("article")
    .nth(3);
  const roleShortcut = sidebar.getByRole("link", { name: /角色与权限/ });
  const workspaceShortcut = sidebar.getByRole("link", { name: /工作区管理/ });
  const shieldCheck = roleShortcut.locator('svg path[d="m9 12 2 2 4-4"]');
  const workspaceDoors = workspaceShortcut.locator('svg path[d="M14 21v-3a2 2 0 0 0-4 0v3"]');
  console.log(
    "GOVERNANCE_REFERENCE_GLYPHS",
    JSON.stringify({
      approvalsLabel: await approvalMetric.locator("span").textContent(),
      shieldCheck: await shieldCheck.count(),
      workspaceDoors: await workspaceDoors.count(),
    }),
  );
  await expect(approvalMetric.locator("span")).toHaveText("待审批");
  await expect(shieldCheck).toHaveCount(1);
  await expect(workspaceDoors).toHaveCount(1);
  await expect(roleShortcut).toHaveAttribute("href", "/org-admin/roles");
  await expect(workspaceShortcut).toHaveAttribute("href", "/org-admin/workspaces");
  await expect(roleShortcut.locator("svg").first()).toHaveAttribute("aria-hidden", "true");
  await expect(workspaceShortcut.locator("svg").first()).toHaveAttribute("aria-hidden", "true");
  const groupTitleStyles = () =>
    navigation
      .locator(".commerce-sidebar-menu > section > h2")
      .evaluateAll((labels) => labels.map((label) => getComputedStyle(label).translate));
  const groupTitles = await groupTitleStyles();
  console.log("ORGANIZATION_RAIL_GROUPS", JSON.stringify(groupTitles));
  expect(groupTitles.length).toBeGreaterThan(1);
  expect(groupTitles).toEqual(["1px -2px", ...groupTitles.slice(1).map(() => "1px 2px")]);

  const geometry = async () =>
    navigation.evaluate((element) => {
      const style = getComputedStyle(element);
      const tabs = element.querySelector(".midou-area-tabs")!;
      const footer = element.querySelector("footer")!;
      return {
        width: element.getBoundingClientRect().width,
        font: style.fontFamily,
        tabsWidth: tabs.getBoundingClientRect().width,
        tabsColor: getComputedStyle(tabs).backgroundColor,
        footerEnd: getComputedStyle(footer).paddingInlineEnd,
      };
    });
  const before = await geometry();
  await navigation.getByRole("link", { name: "成员与邀请", exact: true }).click();
  await expect(page).toHaveURL(/\/org-admin\/members$/);
  await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
  expect(await geometry()).toEqual(before);
  expect(await groupTitleStyles()).toEqual(groupTitles);
  await first.click();
  await expect(page).toHaveURL(/\/org-admin$/);
  expect(await geometry()).toEqual(before);
  expect(await groupTitleStyles()).toEqual(groupTitles);
});

test("long organization and workspace names keep the governance status badge on one line", async ({
  page,
}) => {
  const name = "GlobalProcurementAndProductResearch".repeat(3);
  const workspace = "GlobalSourcingWorkspace".repeat(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.route("**/api/v1/org/admin/profile", (r) =>
    r.fulfill({ json: env({ ...profile, name }) }),
  );
  await page.route("**/api/v1/org/admin/workspaces", (r) =>
    r.fulfill({ json: env([{ ...workspaces[0], name: workspace }]) }),
  );
  await page.goto("/org-admin");
  const card = page.locator(".organization-profile-facts");
  const badge = card.locator("header > i");
  const nameHeading = card.getByRole("heading", { name, exact: true });
  for (const width of [390, 1024, 1672]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(nameHeading).toBeVisible();
    await expect(card.getByText(workspace, { exact: true })).toBeVisible();
    await expect(badge).toContainText("正常使用");
    const [nameBox, badgeBox] = await Promise.all([nameHeading.boundingBox(), badge.boundingBox()]);
    expect(badgeBox!.height).toBeLessThanOrEqual(32);
    expect(nameBox!.x + nameBox!.width).toBeLessThanOrEqual(badgeBox!.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    if (width === 1672) {
      const value = page.locator(".midou-governance-status").getByText(workspace, { exact: true });
      await expect(value).toBeVisible();
      await expect(value).toHaveCSS("overflow-wrap", "anywhere");
      const term = value.locator("..").getByRole("term");
      const [termBox, valueBox] = await Promise.all([term.boundingBox(), value.boundingBox()]);
      expect(termBox!.x + termBox!.width).toBeLessThan(valueBox!.x);
      expect(Math.abs(termBox!.y - valueBox!.y)).toBeLessThanOrEqual(2);
    }
  }
});

test("organization reference metrics and default workspace stay factual", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Reference overview layout");
  await page.setViewportSize({ width: 1672, height: 941 });
  await setup(page);
  const matchedName = "米兜";
  const matchedWorkspace = "默认工作区";
  await page.route("**/api/v1/org/admin/profile", (r) =>
    r.fulfill({
      json: env({ ...profile, name: matchedName, slug: "midou", logo_url: null }),
    }),
  );
  await page.route("**/api/v1/org/admin/workspaces", (r) =>
    r.fulfill({
      json: env([{ ...workspaces[0], name: matchedWorkspace, member_count: 2 }]),
    }),
  );
  await page.route("**/api/v1/org/admin/summary", (r) =>
    r.fulfill({
      json: env({
        ...summary,
        organization: { ...summary.organization, name: matchedName },
        members: { total: 2, active: 2 },
        workspaces: { total: 2, active: 1 },
        teams: { total: 0, active: 0 },
        pending_approvals: 0,
        active_tokens: 0,
        recent_audit_events: 2,
        observed_at: "2026-11-02T17:14:52.000Z",
      }),
    }),
  );
  await page.goto("/org-admin");
  const identity = page.locator(".organization-profile-facts > header");
  const name = identity.getByRole("heading", { name: matchedName, exact: true });
  const badge = identity.locator('i[data-status="active"]');
  await expect(name).toBeVisible();
  await expect(badge).toContainText("正常使用");
  const [label, mark, status] = await Promise.all([
    name.boundingBox(),
    identity.locator(".org-identity-mark").boundingBox(),
    badge.boundingBox(),
  ]);
  expect(status!.x - mark!.x).toBeCloseTo(155, 0);
  expect(status!.x - label!.x - label!.width).toBeGreaterThanOrEqual(24);
  await expect(
    page.getByRole("region", { name: "组织运行摘要" }).locator("article > b"),
  ).toHaveText(["2", "1", "0", "0", "0", "2"]);
  await expect(page.locator(".midou-governance-status dd").last()).toHaveText(matchedWorkspace);
  await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
});

test("organization profile aligns facts, editor and governance sidebar", async ({ page }) => {
  await setup(page);
  await page.goto("/org-admin");
  await expect(page.locator(".org-admin-center")).toHaveAttribute("data-state", "ready");
  const facts = page.locator(".organization-profile-facts");
  const metrics = page.locator(".organization-profile-metrics");
  const editor = page.locator(".organization-profile-editor");
  const reason = editor.getByLabel("变更原因", { exact: true });
  await expect(editor.locator("label .organization-required-mark[aria-hidden='true']")).toHaveCount(
    5,
  );
  await expect(reason).toHaveAttribute("required", "");
  await expect(reason).toHaveAttribute("maxlength", "500");
  await expect(reason).toHaveAccessibleDescription("0 / 500");
  await reason.fill("调整组织资料");
  await expect(reason).toHaveAccessibleDescription("6 / 500");
  await reason.clear();
  const logo = editor.getByLabel("Logo HTTPS 地址");
  const preview = editor.getByRole("button", { name: "预览", exact: true });
  const logoUrl = "https://preview.example.test/organization.svg";
  let logoReads = 0;
  await page.route(logoUrl, (route) => {
    logoReads++;
    return route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/>',
    });
  });
  await logo.fill(logoUrl);
  const inputBounds = (await logo.boundingBox())!;
  const previewBounds = (await preview.boundingBox())!;
  expect(previewBounds.x).toBeGreaterThan(inputBounds.x + inputBounds.width);
  expect(
    Math.abs(previewBounds.y + previewBounds.height / 2 - inputBounds.y - inputBounds.height / 2),
  ).toBeLessThan(1);
  await expect(editor.getByRole("img", { name: "组织 Logo 预览" })).toHaveCount(0);
  expect(logoReads).toBe(0);
  await preview.click();
  await expect.poll(() => logoReads).toBe(1);
  await expect(editor.getByRole("img", { name: "组织 Logo 预览" })).toHaveAttribute("src", logoUrl);
  await logo.fill("http://preview.example.test/unsafe.svg");
  await preview.click();
  await expect(editor.getByRole("img", { name: "组织 Logo 预览" })).toHaveCount(0);
  const profileRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/org/admin/profile"))
      profileRequests.push(request.method());
  });
  const name = editor.getByLabel("名称", { exact: true });
  await name.fill("未保存的组织名称");
  await reason.fill("未保存的原因");
  await editor.getByRole("button", { name: "取消", exact: true }).click();
  await expect(name).toHaveValue(profile.name);
  await expect(logo).toHaveValue(profile.logo_url ?? "");
  await expect(reason).toHaveValue("");
  expect(profileRequests).toEqual([]);
  await expect(facts.locator("h3")).toHaveText(profile.name);
  await expect(facts.locator("dl > div")).toHaveCount(3);
  await expect(facts.locator("dt > svg[aria-hidden='true']")).toHaveCount(3);
  await expect(facts.getByLabel("组织标识")).toHaveText(profile.slug);
  await expect(metrics.locator("article")).toHaveCount(6);
  for (const region of [facts, metrics, editor]) {
    await expect(region).toHaveCSS("background-image", "none");
    await expect(region).toHaveCSS("background-color", "rgb(255, 255, 255)");
  }
  const boxes = await Promise.all([facts, metrics, editor].map((region) => region.boundingBox()));
  expect(boxes.every(Boolean)).toBe(true);
  expect(boxes[0]!.y + boxes[0]!.height).toBeLessThanOrEqual(boxes[1]!.y);
  expect(boxes[1]!.y + boxes[1]!.height).toBeLessThanOrEqual(boxes[2]!.y);
  const side = (await page
    .getByRole("complementary", { name: "治理快捷入口与组织状态" })
    .boundingBox())!;
  const status = page.locator(".midou-governance-status");
  await expect(status.locator("dt > svg[aria-hidden='true']")).toHaveCount(3);
  await expect(status.locator(".midou-governance-status-badge[data-status='active']")).toHaveText(
    "正常使用",
  );
  const width = page.viewportSize()!.width;
  if (width > 1000) {
    expect(side.x).toBeGreaterThanOrEqual(boxes[2]!.x + boxes[2]!.width);
    expect(Math.abs(side.y - boxes[2]!.y)).toBeLessThanOrEqual(1);
  } else {
    expect(side.y).toBeGreaterThanOrEqual(boxes[2]!.y + boxes[2]!.height);
    expect(Math.abs(boxes[0]!.width - boxes[2]!.width)).toBeLessThanOrEqual(1);
  }
  for (const control of await editor.locator("input, select, textarea, button").all()) {
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(width >= 1200 ? 36 : 44);
  }
  await expect(editor.getByRole("button", { name: "保存更改", exact: true })).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const route of ["members", "workspaces", "teams"] as const) {
  test(`organization directory workspace has a full-width list and usable local navigation: ${route}`, async ({
    page,
  }) => {
    await setup(page);
    await page.goto(`/org-admin/${route}`);
    await expect(page.locator(".org-admin-center")).toHaveAttribute("data-state", "ready");
    const root = page.locator(
      route === "members"
        ? ".org-member-workspace"
        : route === "teams"
          ? ".org-team-panel"
          : ".org-workspace-panel",
    );
    const identity = await root.elementHandle();
    let writes = 0;
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname.startsWith("/api/v1/org/admin/") &&
        !["GET", "HEAD"].includes(request.method())
      )
        writes += 1;
    });
    if (route === "members") {
      const directory = await page.locator(".org-member-directory").boundingBox();
      const invites = await page.locator(".org-member-invitations").boundingBox();
      expect(directory!.y + directory!.height).toBeLessThanOrEqual(invites!.y);
      const form = page.locator(".org-admin-invite-form");
      await form.getByLabel("邮箱（每行一个）").fill("draft@example.test");
      await form.getByLabel("原因", { exact: true }).fill("尚未提交的邀请草稿");
      await page
        .locator(".org-member-directory")
        .getByRole("link", { name: "邀请成员", exact: true })
        .click();
      await expect(page).toHaveURL(/#organization-member-invite$/);
      await expect(page.getByRole("button", { name: "创建邀请", exact: true })).toBeVisible();
      await expect(form.getByLabel("邮箱（每行一个）")).toHaveValue("draft@example.test");
      await expect(form.getByLabel("原因", { exact: true })).toHaveValue("尚未提交的邀请草稿");
    } else {
      const prefix = route === "teams" ? "org-team" : "org-workspace";
      const directory = await page.locator(`.${prefix}-directory`).boundingBox();
      const detail = await page.locator(`.${prefix}-detail`).boundingBox();
      expect(Math.abs(directory!.width - detail!.width)).toBeLessThanOrEqual(1);
      expect(directory!.y + directory!.height).toBeLessThanOrEqual(detail!.y);
      const items = page.locator(`.${prefix}-list button`);
      if ((await items.count()) > 1) await items.nth(1).click();
      const heading = page.locator(`.${prefix}-detail header h3`).first();
      const selectedName = await heading.innerText();
      await root
        .getByRole("button", { name: route === "teams" ? "新建团队" : "新建工作区", exact: true })
        .click();
      const nameField = root.locator(route === "teams" ? "#team-name" : "#workspace-name");
      await nameField.fill("尚未提交的创建草稿");
      await page.getByRole("link", { name: "定位所选详情", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#${prefix}-selected$`));
      await expect(heading).toBeVisible();
      await expect(heading).toHaveText(selectedName);
      await expect(nameField).toHaveValue("尚未提交的创建草稿");
      await expect
        .poll(async () => {
          const box = await heading.boundingBox();
          return Boolean(box && box.y >= 60 && box.y < (page.viewportSize()?.height ?? 900) - 44);
        })
        .toBe(true);
      if (route === "teams") {
        await expect(page.locator(".org-team-list")).toHaveJSProperty("tagName", "UL");
        await expect(page.locator(".org-team-list li").first().getByRole("button")).toBeVisible();
      }
    }
    expect(await identity!.evaluate((element) => element.isConnected)).toBe(true);
    await identity!.dispose();
    expect(writes).toBe(0);
    expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(1);
    for (const card of await root.locator(".org-admin-card").all()) {
      await expect(card).toHaveCSS("background-image", "none");
      await expect(card).toHaveCSS("background-color", "rgb(255, 255, 255)");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

for (const section of ["roles", "scopes", "grants"] as const) {
  test(`organization role workspace keeps full-width sections and local drafts: ${section}`, async ({
    page,
  }) => {
    await setup(page);
    await page.goto("/org-admin/roles");
    await expect(page.getByRole("table", { name: "角色能力矩阵" })).toBeVisible();
    const root = page.locator(".org-role-page");
    const identity = await root.elementHandle();
    let writes = 0;
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname.startsWith("/api/v1/org/") &&
        !["GET", "HEAD"].includes(request.method())
      )
        writes += 1;
    });
    if (section === "roles") {
      const matrixHeader = page
        .getByRole("table", { name: "角色能力矩阵" })
        .getByRole("row")
        .first();
      expect(
        await matrixHeader.evaluate(
          (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length,
        ),
      ).toBe(await matrixHeader.getByRole("columnheader").count());
      const list = page.locator(".org-role-list");
      await list.getByRole("button").nth(1).click();
      const selected = await page.locator("#org-role-selected h3").innerText();
      await page.getByLabel("搜索能力", { exact: true }).fill("组织");
      await page.getByRole("link", { name: "定位角色详情", exact: true }).click();
      await expect(page).toHaveURL(/#org-role-selected$/);
      await expect(page.locator("#org-role-selected h3")).toHaveText(selected);
      await expect(page.getByLabel("搜索能力", { exact: true })).toHaveValue("组织");
      const a = await list.boundingBox(),
        b = await page.locator("#org-role-selected").boundingBox();
      expect(Math.abs(a!.width - b!.width)).toBeLessThanOrEqual(1);
      expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y);
      await expect(list.locator("button > span:first-child")).toHaveCount(0);
    } else if (section === "scopes") {
      await page.getByRole("button", { name: "数据范围", exact: true }).click();
      const memberBounds = await page.locator(".org-scope-members").boundingBox(),
        definitions = await page.locator(".org-scope-definitions").boundingBox();
      expect(memberBounds!.y + memberBounds!.height).toBeLessThanOrEqual(definitions!.y);
      await page.getByLabel("搜索成员", { exact: true }).fill("陈采购");
      await expect(page.getByText("陈采购", { exact: true })).toBeVisible();
    } else {
      await page.getByRole("button", { name: /指定资源授权 1/ }).click();
      await page.getByRole("button", { name: "创建授权", exact: true }).click();
      await page.getByLabel("业务原因", { exact: true }).fill("未提交的资源授权草稿");
      await page.getByRole("link", { name: "定位授权详情", exact: true }).click();
      await expect(page).toHaveURL(/#org-grant-selected$/);
      await expect(page.getByLabel("业务原因", { exact: true })).toHaveValue(
        "未提交的资源授权草稿",
      );
      const a = await page.locator(".org-grant-list").boundingBox(),
        b = await page.locator("#org-grant-selected").boundingBox();
      expect(Math.abs(a!.width - b!.width)).toBeLessThanOrEqual(1);
      expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y);
    }
    expect(await identity!.evaluate((element) => element.isConnected)).toBe(true);
    await identity!.dispose();
    expect(writes).toBe(0);
    for (const card of await root.locator(".org-admin-card").all()) {
      await expect(card).toHaveCSS("background-image", "none");
      await expect(card).toHaveCSS("background-color", "rgb(255, 255, 255)");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

for (const approvalSection of ["requests", "templates"] as const) {
  test(`organization approval workspace preserves readonly full-width navigation: ${approvalSection}`, async ({
    page,
  }) => {
    await setup(page);
    await page.goto("/org-admin/approvals");
    const root = page.locator(".org-approval-governance");
    await expect(root).toBeVisible();
    let writes = 0;
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname.startsWith("/api/v1/org/admin/") &&
        !["GET", "HEAD"].includes(request.method())
      )
        writes += 1;
    });
    const identity = await root.elementHandle();
    if (approvalSection === "templates") {
      await page.getByRole("button", { name: /模板版本/ }).click();
      await page.getByLabel("搜索模板", { exact: true }).fill("模板");
      await expect(page).toHaveURL(/approval_template_query=/);
      const directory = root.locator(".org-approval-template-directory");
      const choices = directory.locator(":scope > button");
      if ((await choices.count()) > 1) await choices.nth(1).click();
      const chosenName = await root.locator(".org-approval-template-detail h5").innerText();
      await root.getByRole("link", { name: "定位模板详情", exact: true }).click();
      await expect(page).toHaveURL(/#org-approval-template-selected$/);
      await expect(root.locator(".org-approval-template-detail h5")).toHaveText(chosenName);
      await expect(page.getByLabel("搜索模板", { exact: true })).toHaveValue("模板");
      const a = await directory.boundingBox(),
        b = await root.locator(".org-approval-template-detail").boundingBox();
      expect(Math.abs(a!.width - b!.width)).toBeLessThanOrEqual(1);
      expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y);
      await expect
        .poll(async () => {
          const box = await root.locator(".org-approval-template-detail h5").boundingBox();
          return Boolean(box && box.y >= 60 && box.y < (page.viewportSize()?.height ?? 900) - 44);
        })
        .toBe(true);
    } else {
      const nextPageButton = root.getByRole("button", { name: "下一页", exact: true });
      await nextPageButton.focus();
      await nextPageButton.press("Enter");
      const pagerStatus = root.locator(".org-approval-pagination > span");
      await expect(pagerStatus).toContainText("当前第 2 / 2 页");
      await expect(pagerStatus).toBeFocused();
      await expect(pagerStatus).toHaveCSS("outline-style", "solid");
      await expect(pagerStatus).toHaveCSS("outline-width", "3px");
      await page.getByLabel("搜索审批", { exact: true }).fill("厨房收纳");
      await expect(root.locator(".org-approval-request-list > article")).toHaveCount(1);
      await expect(root.locator(".org-approval-request-list")).toContainText("厨房收纳机会复核");
      await root.getByText("技术详情", { exact: true }).click();
      await expect(root.getByText(/审批记录 ID：/)).toBeVisible();
      const a = await root.boundingBox(),
        b = await root.locator(".org-approval-request-list").boundingBox();
      expect(Math.abs(a!.width - b!.width)).toBeLessThanOrEqual(1);
      await expect(root.locator(".org-approval-overview")).toHaveCSS("background-image", "none");
    }
    expect(await identity!.evaluate((element) => element.isConnected)).toBe(true);
    await identity!.dispose();
    expect(writes).toBe(0);
    expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

for (const dataView of ["workspaces", "exports"] as const) {
  test(`organization data workspace keeps full-width readonly records: ${dataView}`, async ({
    page,
  }) => {
    await setup(page);
    await page.goto("/org-admin/data");
    const dataRoot = page.locator(".org-data-panel");
    await expect(dataRoot).toBeVisible();
    let writes = 0;
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname.startsWith("/api/v1/org/admin/") &&
        !["GET", "HEAD"].includes(request.method())
      )
        writes += 1;
    });
    await expect(dataRoot.locator(".org-data-metrics")).toHaveCSS("background-image", "none");
    if (dataView === "workspaces") {
      const tableScroll = dataRoot.locator(".org-data-table-scroll");
      const a = await dataRoot.boundingBox(),
        b = await tableScroll.boundingBox();
      expect(Math.abs(a!.width - b!.width)).toBeLessThanOrEqual(1);
      if ((page.viewportSize()?.width ?? 1440) < 760) {
        expect(
          await tableScroll.evaluate((element) => {
            element.scrollLeft = 150;
            return element.scrollWidth > element.clientWidth && element.scrollLeft > 0;
          }),
        ).toBe(true);
      }
    } else {
      await page.getByRole("button", { name: /导出履历/ }).click();
      const exportRows = dataRoot.locator(".org-data-export-list");
      const a = await dataRoot.boundingBox(),
        b = await exportRows.boundingBox();
      expect(Math.abs(a!.width - b!.width)).toBeLessThanOrEqual(1);
      const firstEntry = exportRows.locator("article").first();
      await firstEntry.locator("summary").click();
      await expect(firstEntry.locator("code")).toBeVisible();
      expect((await firstEntry.boundingBox())!.width).toBeCloseTo(b!.width - 2, 0);
      await expect(firstEntry).toHaveCSS("background-image", "none");
    }
    expect(writes).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("organization token workspace keeps full-width ledger and unsubmitted creation draft", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/org-admin/tokens");
  const tokenRoot = page.locator(".org-token-panel");
  await expect(tokenRoot).toBeVisible();
  const tokenIdentity = await tokenRoot.elementHandle();
  let writes = 0;
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.startsWith("/api/v1/org/admin/") &&
      !["GET", "HEAD"].includes(request.method())
    )
      writes += 1;
  });
  await page.getByLabel("令牌名称").fill("未提交的只读接入草稿");
  await page.getByLabel("创建原因").fill("尚未提交的接入原因");
  const scopeChoice = tokenRoot.locator(".org-token-scope-field input[type=checkbox]").first();
  await scopeChoice.check();
  await page.getByLabel("搜索令牌", { exact: true }).fill("月度经营");
  await expect(page).toHaveURL(/org_token_query=/);
  await tokenRoot.getByRole("link", { name: "定位创建表单", exact: true }).click();
  await expect(page).toHaveURL(/#org-token-create$/);
  await expect(page.getByLabel("令牌名称")).toHaveValue("未提交的只读接入草稿");
  await expect(page.getByLabel("创建原因")).toHaveValue("尚未提交的接入原因");
  await expect(scopeChoice).toBeChecked();
  await expect(page.getByLabel("搜索令牌", { exact: true })).toHaveValue("月度经营");
  const a = await tokenRoot.locator(".org-token-ledger").boundingBox(),
    b = await tokenRoot.locator(".org-token-create").boundingBox();
  expect(Math.abs(a!.width - b!.width)).toBeLessThanOrEqual(1);
  expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y);
  await expect
    .poll(async () => {
      const box = await tokenRoot.locator(".org-token-create h4").boundingBox();
      return Boolean(box && box.y >= 60 && box.y < (page.viewportSize()?.height ?? 900) - 44);
    })
    .toBe(true);
  await expect(tokenRoot.locator(".org-token-create")).toHaveCSS("background-image", "none");
  expect(await tokenIdentity!.evaluate((element) => element.isConnected)).toBe(true);
  await tokenIdentity!.dispose();
  expect(writes).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("organization audit workspace keeps full-width native records and readonly detail navigation", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/org-admin/audit");
  const auditRoot = page.locator(".org-audit-panel");
  await expect(auditRoot).toBeVisible();
  const list = page.getByLabel("组织审计列表", { exact: true });
  await expect(list).toHaveJSProperty("tagName", "UL");
  const choice = list.locator("li").nth(1).getByRole("button");
  await choice.click();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  const chosenHeading = await auditRoot.locator(".org-audit-detail h3").innerText();
  await page.getByLabel("操作代码（精确）").fill("尚未提交的筛选草稿");
  const auditIdentity = await auditRoot.elementHandle();
  let writes = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/audit-events") && request.method() !== "GET")
      writes += 1;
  });
  await auditRoot.getByRole("link", { name: "定位记录详情", exact: true }).click();
  await expect(page).toHaveURL(/#org-audit-selected$/);
  await expect(auditRoot.locator(".org-audit-detail h3")).toHaveText(chosenHeading);
  await expect(page.getByLabel("操作代码（精确）")).toHaveValue("尚未提交的筛选草稿");
  const a = await auditRoot.locator(".org-audit-list").boundingBox(),
    b = await auditRoot.locator(".org-audit-detail").boundingBox();
  expect(Math.abs(a!.width - b!.width)).toBeLessThanOrEqual(1);
  expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y);
  const countBounds = await auditRoot.locator(".org-audit-metrics").boundingBox(),
    filterBounds = await auditRoot.locator(".org-audit-filters").boundingBox();
  expect(countBounds!.y + countBounds!.height).toBeLessThanOrEqual(filterBounds!.y);
  await expect
    .poll(async () => {
      const box = await auditRoot.locator(".org-audit-detail h3").boundingBox();
      return Boolean(box && box.y >= 60 && box.y < (page.viewportSize()?.height ?? 900) - 44);
    })
    .toBe(true);
  await expect(auditRoot.locator(".org-audit-detail")).toHaveCSS("background-image", "none");
  expect(await auditIdentity!.evaluate((element) => element.isConnected)).toBe(true);
  await auditIdentity!.dispose();
  expect(writes).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const firstFailureStatus of [500, 429]) {
  test(`organization first-read state is compact and recoverable at every width: ${firstFailureStatus}`, async ({
    page,
  }) => {
    await setup(page);
    let failing = true,
      reads = 0;
    await page.route("**/api/v1/org/admin/approvals", (route) => {
      reads += 1;
      if (!failing) return route.fallback();
      return route.fulfill({
        status: firstFailureStatus,
        json: {
          error: {
            code: "isolated_read_failure",
            message: "隔离读取失败",
            action_hint: "检查后重试",
          },
          request_id: `state-read-${firstFailureStatus}`,
          trace_id: `state-trace-${firstFailureStatus}`,
        },
      });
    });
    await page.goto("/org-admin/approvals");
    const center = page.locator(".org-admin-center"),
      failureCard = page.locator(".org-approval-first-failure-c");
    await expect(center).toHaveAttribute("data-approval-first-failure", "true");
    await expect(failureCard).toBeVisible();
    await expect(
      failureCard.getByRole("heading", {
        name: firstFailureStatus === 429 ? "请求过于频繁" : "组织后台暂不可用",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".org-approval-first-failure-legacy")).toHaveCount(0);
    await expect(center.locator(":scope > .org-admin-state")).toBeHidden();
    await expect(failureCard).toHaveCSS("background-image", "none");
    await expect(failureCard).toHaveCSS("min-height", "0px");
    await expect(failureCard.getByRole("button", { name: "重新加载", exact: true })).toHaveCSS(
      "min-height",
      "44px",
    );
    const beforeDetails = reads;
    await failureCard.locator("summary").click();
    await expect(failureCard.locator("code")).toHaveText(`state-read-${firstFailureStatus}`);
    expect(reads).toBe(beforeDetails);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    failing = false;
    await failureCard.getByRole("button", { name: "重新加载", exact: true }).click();
    await expect(center).toHaveAttribute("data-state", "ready");
    await expect(failureCard).toHaveCount(0);
    expect(reads).toBe(beforeDetails + 1);
  });
}

test("governance metric separators follow the actual number of columns", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Runs both compact viewport widths in one session",
  );
  await page.setViewportSize({ width: 390, height: 941 });
  await setup(page);
  await page.goto("/org-admin");
  const metrics = page.getByRole("region", { name: "组织运行摘要" });
  const cards = metrics.locator("article");
  await expect(cards).toHaveCount(6);
  for (const [width, columns] of [
    [390, 2],
    [900, 3],
  ] as const) {
    await page.setViewportSize({ width, height: 941 });
    const geometry = await cards.evaluateAll((nodes) =>
      nodes.map((card) => {
        const style = getComputedStyle(card);
        return {
          y: card.getBoundingClientRect().top,
          right: parseFloat(style.borderInlineEndWidth),
          bottom: parseFloat(style.borderBlockEndWidth),
        };
      }),
    );
    const firstY = geometry[0]!.y;
    expect(geometry.filter(({ y }) => Math.abs(y - firstY) < 1)).toHaveLength(columns);
    const actual = geometry.map(({ right, bottom }) => `${right}/${bottom}`);
    console.log(`governance separators at ${width}px (right/bottom): ${actual.join(",")}`);
    expect(actual).toEqual(
      Array.from(
        { length: 6 },
        (_, index) => `${(index + 1) % columns === 0 ? 0 : 1}/${index < 6 - columns ? 1 : 0}`,
      ),
    );
  }
});

test("governance metric values stay inside their tracks at wide and compact widths", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Explicit wide and compact viewport probes",
  );
  const count = 123456789012345;
  await page.setViewportSize({ width: 1672, height: 941 });
  await setup(page);
  await page.route("**/api/v1/org/admin/summary", (r) =>
    r.fulfill({
      json: env({
        ...summary,
        members: { ...summary.members, active: count, total: count },
        recent_audit_events: count,
      }),
    }),
  );
  await page.goto("/org-admin");
  const metrics = page.getByRole("region", { name: "组织运行摘要" });
  const value = metrics.locator("article > b").first();
  await expect(value).toHaveText(String(count));
  for (const width of [1672, 1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 941 });
    if (width >= 761) {
      const positions = await metrics.locator("article").evaluateAll((cells) =>
        cells.map((cell) => {
          const y = (selector: string) => cell.querySelector(selector)!.getBoundingClientRect().top;
          return {
            row: cell.getBoundingClientRect().top,
            label: y("span"),
            value: y("b"),
            note: y("small"),
          };
        }),
      );
      console.log("organization metric tracks", width, JSON.stringify(positions));
      for (const card of positions) {
        const row = positions.find((item) => Math.abs(item.row - card.row) < 1)!;
        expect(card.label).toBeCloseTo(row.label, 0);
        expect(card.value).toBeCloseTo(row.value, 0);
        expect(card.note).toBeCloseTo(row.note, 0);
      }
    }
    const layout = await metrics.locator("article > :is(b, small)").evaluateAll((values) =>
      values.map((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const lines = [...range.getClientRects()];
        const card = node.closest("article")!.getBoundingClientRect();
        return {
          lines: lines.length,
          fits: lines.every(
            (line) => line.right <= card.right + 0.5 && line.left >= card.left - 0.5,
          ),
        };
      }),
    );
    expect(layout[0]?.lines, `width ${width}: long count wraps`).toBeGreaterThan(1);
    expect(
      layout.every(({ fits }) => fits),
      `width ${width}: metric text stays in its own cell`,
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test("governance identity leaves the operating metrics in the first fold on intermediate screens", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Explicit intermediate viewport probes");
  await page.setViewportSize({ width: 1024, height: 941 });
  await setup(page);
  await page.goto("/org-admin");
  const facts = page.locator(".organization-profile-facts");
  const metrics = page.getByRole("region", { name: "组织运行摘要" });
  await expect(facts.getByRole("heading", { name: profile.name, exact: true })).toBeVisible();
  await expect(facts.getByText(profile.slug, { exact: true })).toBeVisible();
  await expect(facts.getByText("正常使用", { exact: true })).toBeVisible();
  for (const width of [1000, 1001, 1024, 1100, 1164, 1165, 1200]) {
    await page.setViewportSize({ width, height: 941 });
    const { factsHeight, metricsTop, sameRow, titleFits, viewportFits } = await facts.evaluate(
      (el) => {
        const bounds = (selector: string) => el.querySelector(selector)!.getBoundingClientRect();
        const name = el.querySelector("h3")!;
        const range = document.createRange();
        range.selectNodeContents(name);
        const label = bounds("header p");
        const chip = bounds("header > i");
        const titleFits = [...range.getClientRects()].every(
          (r) => r.right <= chip.left && r.left >= label.left,
        );
        return {
          factsHeight: Math.round(el.getBoundingClientRect().height),
          metricsTop: Math.round(el.nextElementSibling!.getBoundingClientRect().top),
          sameRow: bounds("dl").left > bounds("header").left,
          titleFits,
          viewportFits: document.documentElement.scrollWidth <= innerWidth,
        };
      },
    );
    console.log("governance identity first fold", width, factsHeight, metricsTop, sameRow);
    expect(factsHeight, `organization facts at width ${width}`).toBeLessThan(250);
    expect(metricsTop, `operating metrics at width ${width}`).toBeLessThan(480);
    expect(sameRow, `identity columns at width ${width}`).toBe(width >= 1165);
    expect(titleFits).toBe(true);
    expect(viewportFits).toBe(true);
    await expect(metrics).toBeInViewport({ ratio: 1 });
  }
});

test("organization timezone suggests recognized zones without rewriting saved aliases", async ({
  page,
}) => {
  await setup(page);
  const originalTimezone = "US/Eastern";
  const selectedTimezone = "Etc/UTC";
  let savedTimezone = originalTimezone;
  const writes: Record<string, unknown>[] = [];
  await page.route("**/api/v1/org/admin/profile", (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      writes.push(body);
      savedTimezone = String(body.timezone);
    }
    return route.fulfill({ json: env({ ...profile, timezone: savedTimezone }) });
  });
  await page.goto("/org-admin");
  const editor = page.locator(".organization-profile-editor");
  const field = editor.getByLabel("时区", { exact: true });
  await expect(field).toHaveValue(originalTimezone);
  const options = editor.locator("datalist");
  const listId = await options.getAttribute("id", { timeout: 2500 });
  expect(listId).toBeTruthy();
  await expect(field).toHaveAttribute("list", listId!);
  await expect(options.locator('option[value="Asia/Shanghai"]')).toHaveCount(1);
  await expect(options.locator('option[value="US/Eastern"]')).toHaveCount(1);
  await expect(options.locator('option[value="UTC"]')).toHaveCount(1);
  expect(writes).toHaveLength(0);

  await field.fill(selectedTimezone);
  await expect(field).toHaveValue(selectedTimezone);
  await editor.getByRole("button", { name: "取消", exact: true }).click();
  await expect(field).toHaveValue(originalTimezone);
  expect(writes).toHaveLength(0);
  await field.fill(selectedTimezone);
  await editor.getByLabel("变更原因", { exact: true }).fill("确认时区仍按原值提交");
  await editor.getByRole("button", { name: "保存更改", exact: true }).click();
  await expect(page.locator(".org-profile-receipt")).toHaveAttribute("data-phase", "ready");
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    timezone: selectedTimezone,
    reason: "确认时区仍按原值提交",
    expected_version: profile.version,
  });
  await expect(field).toHaveValue(selectedTimezone);
});

test("wide governance aligns title actions and status reading edges", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await setup(page);
  await page.goto("/org-admin");

  const hero = page.locator('header[data-profile-overview="true"]');
  const title = hero.getByRole("heading", { name: "治理概览", exact: true });
  const actions = hero.locator(".org-overview-actions");
  const status = page.locator(".midou-governance-side > section").filter({
    has: page.locator(".midou-governance-status"),
  });

  await expect(title).toHaveCSS("translate", "-1px -1px");
  await expect(actions).toHaveCSS("translate", "0px -1px");
  await expect(status).toHaveCSS("padding-inline-end", "32px");
  await expect(actions.getByRole("link", { name: "邀请成员", exact: true })).toHaveAttribute(
    "href",
    "/org-admin/members",
  );
  await expect(status.getByText("默认工作区", { exact: true }).last()).toBeVisible();
  await expect(page.getByLabel("变更原因", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 1599, height: 941 });
  await expect(status).not.toHaveCSS("padding-inline-end", "32px");
});

test("wide governance form uses a consistent text inset without changing validation", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide governance form");
  await page.setViewportSize({ width: 1672, height: 941 });
  await setup(page);
  await page.goto("/org-admin");
  const editor = page.locator(".organization-profile-editor");
  const reason = editor.getByRole("textbox", { name: "变更原因", exact: true });
  await expect(editor).toHaveCSS("padding-inline-start", "27px");
  await expect(reason).toHaveAttribute("required", "");
  for (const input of await editor
    .locator(".organization-profile-fields :is(input, select, textarea)")
    .all())
    await expect(input).toHaveCSS("padding-inline-start", "13px");
  await reason.focus();
  await expect(reason).toBeFocused();
  await page.setViewportSize({ width: 1599, height: 941 });
  await expect(editor).not.toHaveCSS("padding-inline-start", "27px");
});
