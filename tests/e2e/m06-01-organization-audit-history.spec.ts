import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const organizationId = "00000000-0000-4000-8000-000000000601";
const workspaceId = "00000000-0000-4000-8000-000000000602";
const events = Array.from({ length: 55 }, (_, index) => ({
  id: `00000000-0000-4000-8000-${String(620 + index).padStart(12, "0")}`,
  organization_id: organizationId,
  workspace_id: workspaceId,
  actor_id: "00000000-0000-4000-8000-000000000611",
  action:
    index % 3 === 0
      ? "organization.member.invited"
      : index % 3 === 1
        ? "organization.collection.run.failed"
        : "organization.collection.run.blocked",
  resource_type: index % 3 === 0 ? "membership" : "collection_run",
  resource_id: `00000000-0000-4000-8000-${String(760 + index).padStart(12, "0")}`,
  outcome: index % 3 === 0 ? "succeeded" : index % 3 === 1 ? "failed" : "blocked",
  request_id: `audit-request-${String(index + 1).padStart(3, "0")}`,
  trace_id: `audit-trace-${String(Math.floor(index / 4) + 1).padStart(3, "0")}`,
  metadata: { source: "e2e", sequence: index + 1 },
  occurred_at: new Date(Date.parse("2026-08-27T10:00:00.000Z") - index * 60_000).toISOString(),
  schema_version: 1,
}));
const envelope = (data: unknown) => ({
  data,
  request_id: "organization-audit-history-e2e",
  trace_id: "organization-audit-history-e2e",
});

async function setup(page: Page) {
  await page.route("**/api/v1/**", (route) =>
    route.fulfill({ status: 404, json: envelope({ error: { code: "unhandled_test_request" } }) }),
  );
  await page.route("**/api/v1/auth/session-status", (route) =>
    route.fulfill({ json: envelope({ authenticated: true }) }),
  );
  await page.route("**/api/v1/me/navigation?shell=organization_admin", (route) =>
    route.fulfill({
      json: envelope({
        shell: "organization_admin",
        organization_id: organizationId,
        workspace_id: workspaceId,
        roles: ["organization_admin"],
        capabilities: ["audit:read", "organization_token:manage"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_organization_admin_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/me/authorization", (route) =>
    route.fulfill({
      json: envelope({
        organization_id: organizationId,
        workspace_id: workspaceId,
        roles: ["organization_admin"],
        capabilities: ["audit:read", "organization_token:manage"],
        data_scopes: [{ scope: "organization" }],
      }),
    }),
  );
  await page.route("**/api/v1/org/admin/tokens", (route) =>
    route.fulfill({ json: envelope([]) }),
  );
  await page.route("**/api/v1/organizations/*/audit-events**", (route) => {
    const query = new URL(route.request().url()).searchParams;
    const filtered = events.filter(
      (event) =>
        (!query.get("action") || event.action === query.get("action")) &&
        (!query.get("outcome") || event.outcome === query.get("outcome")) &&
        (!query.get("resource_type") || event.resource_type === query.get("resource_type")) &&
        (!query.get("request_id") || event.request_id === query.get("request_id")) &&
        (!query.get("trace_id") || event.trace_id === query.get("trace_id")),
    );
    const cursorIndex = query.get("cursor")
      ? filtered.findIndex((event) => event.id === query.get("cursor")) + 1
      : 0;
    const limit = Number(query.get("limit") ?? 50);
    const items = filtered.slice(cursorIndex, cursorIndex + limit);
    const nextCursor = filtered.length > cursorIndex + limit ? (items.at(-1)?.id ?? null) : null;
    return route.fulfill({ json: envelope({ items, nextCursor }) });
  });
}

test("organization audit restores URL filters on history and cached return", async ({ page }) => {
  await setup(page);
  const auditRequests: URL[] = [];
  const expectedFilteredCount = events.filter(
    (event) => event.action === "organization.member.invited",
  ).length;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/audit-events")) auditRequests.push(url);
  });

  await page.goto("/org-admin/audit");
  await expect(page.getByLabel("组织审计列表").getByRole("listitem")).toHaveCount(50);

  const pushRoute = async (path: string, query?: Record<string, string>) =>
    page.evaluate(
      async ({ path, query }) => {
        const root = document.querySelector("#app") as (HTMLElement & { __vue_app__?: any }) | null;
        const router = root?.__vue_app__?.config.globalProperties.$router;
        if (!router) throw new Error("Vue Router is unavailable on the mounted app");
        await router.push({ path, query });
      },
      { path, query },
    );

  await pushRoute("/org-admin/audit", {
    org_audit_query: "成员",
    org_audit_action: "organization.member.invited",
    keep: "preserved",
  });
  await expect(page.getByLabel("页内搜索")).toHaveValue("成员");
  await expect(page.getByLabel("操作代码（精确）")).toHaveValue("organization.member.invited");
  await expect(page.getByLabel("组织审计列表").getByRole("listitem")).toHaveCount(
    expectedFilteredCount,
  );
  expect(auditRequests.at(-1)?.searchParams.get("action")).toBe("organization.member.invited");
  expect(new URL(page.url()).searchParams.get("keep")).toBe("preserved");

  await page.goBack();
  await expect(page.getByLabel("页内搜索")).toHaveValue("");
  await expect(page.getByLabel("操作代码（精确）")).toHaveValue("");
  await expect(page.getByLabel("组织审计列表").getByRole("listitem")).toHaveCount(50);

  await page.goForward();
  await expect(page.getByLabel("页内搜索")).toHaveValue("成员");
  await expect(page.getByLabel("操作代码（精确）")).toHaveValue("organization.member.invited");
  await expect(page.getByLabel("组织审计列表").getByRole("listitem")).toHaveCount(
    expectedFilteredCount,
  );

  await pushRoute("/org-admin/tokens");
  await expect(page.getByRole("heading", { name: "组织 Token" })).toBeVisible();
  await pushRoute("/org-admin/audit");
  await expect(page.getByLabel("页内搜索")).toHaveValue("");
  await expect(page.getByLabel("操作代码（精确）")).toHaveValue("");
  await expect(page.getByLabel("组织审计列表").getByRole("listitem")).toHaveCount(50);
  expect(auditRequests.at(-1)?.searchParams.has("action")).toBe(false);
});
