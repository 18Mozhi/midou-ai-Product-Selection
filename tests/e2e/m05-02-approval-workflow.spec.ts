import { test, expect, type Page } from "@playwright/test";
const approvalId = "00000000-0000-4000-8000-000000000921",
  actor = "00000000-0000-4000-8000-000000000922",
  env = (data: unknown) => ({
    data,
    request_id: "m05-02-e2e",
    trace_id: "m05-02-trace",
  }),
  item = {
    id: approvalId,
    title: "便携净水杯采购任务复核",
    template_id: "00000000-0000-4000-8000-000000000923",
    template_name: "采购任务审批",
    resource_type: "task",
    resource_id: "00000000-0000-4000-8000-000000000924",
    status: "pending",
    current_node_ordinal: 1,
    current_node_name: "选品经理复核",
    active_approver_id: actor,
    can_decide: true,
    due_at: "2026-08-09T10:00:00.000Z",
    escalated_at: null,
    requested_by: actor,
    completed_at: null,
    version: 1,
    created_at: "2026-08-08T09:00:00.000Z",
    updated_at: "2026-08-08T09:00:00.000Z",
  };
async function setup(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=member", (r) =>
    r.fulfill({
      json: env({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000925",
        workspace_id: "00000000-0000-4000-8000-000000000926",
        roles: ["selection_manager"],
        capabilities: ["task:read", "task:assign"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/tasks/approval-templates", (r) =>
    r.fulfill({
      json: env([
        {
          id: item.template_id,
          name: "采购任务审批",
          resource_type: "task",
          status: "published",
          current_version: 1,
          revision: 2,
          node_count: 2,
        },
      ]),
    }),
  );
  await page.route(`**/api/v1/tasks/approvals/${approvalId}`, (r) =>
    r.fulfill({
      json: env({
        ...item,
        nodes: [
          {
            id: "00000000-0000-4000-8000-000000000927",
            ordinal: 1,
            name: "选品经理复核",
            approver_id: actor,
            active_approver_id: actor,
            escalation_assignee_id: actor,
            status: "pending",
            due_at: item.due_at,
            escalated_at: null,
            decided_by: null,
            decision_reason: null,
            decided_at: null,
            version: 1,
          },
          {
            id: "00000000-0000-4000-8000-000000000928",
            ordinal: 2,
            name: "采购负责人确认",
            approver_id: actor,
            active_approver_id: actor,
            escalation_assignee_id: actor,
            status: "waiting",
            due_at: null,
            escalated_at: null,
            decided_by: null,
            decision_reason: null,
            decided_at: null,
            version: 1,
          },
        ],
        actions: [],
      }),
    }),
  );
  await page.route("**/api/v1/tasks/approvals?*", (r) =>
    r.fulfill({
      json: { ...env([item]), meta: { page: 1, page_size: 100, total: 1 } },
    }),
  );
}
test("M05-02.A07/A08/A09/A15 renders approval inbox timeline and mandatory reason on desktop and 390", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/tasks/approvals");
  await expect(
    page.getByRole("heading", { name: "审批中心", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("便携净水杯采购任务复核")).toBeVisible();
  await page.getByRole("button", { name: /便携净水杯采购任务复核/ }).click();
  await expect(page.getByText("选品经理复核").last()).toBeVisible();
  await expect(page.getByText("批准与驳回均必填")).toBeVisible();
  await expect(page.getByRole("button", { name: "批准并流转" })).toBeDisabled();
  await expect(page).toHaveScreenshot("m05-02-approval-workflow.png", {
    fullPage: true,
  });
});
