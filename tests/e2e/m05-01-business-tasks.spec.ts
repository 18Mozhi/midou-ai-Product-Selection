import { test, expect, type Page } from "@playwright/test";
const taskId = "00000000-0000-4000-8000-000000000801",
  actor = "00000000-0000-4000-8000-000000000802",
  env = (data: unknown) => ({
    data,
    request_id: "m05-01-e2e",
    trace_id: "m05-01-trace",
  });
const task = {
  id: taskId,
  title: "核验便携净水杯供应商报价",
  description: "对照原始证据确认 MOQ 与交期",
  status: "in_progress",
  priority: "high",
  assignee_id: actor,
  source_type: "sourcing_purchase",
  source_ref_id: "00000000-0000-4000-8000-000000000803",
  due_at: "2026-08-09T10:00:00.000Z",
  completed_at: null,
  sla_status: "due_soon",
  version: 2,
  created_by: actor,
  created_at: "2026-08-08T09:00:00.000Z",
  updated_at: "2026-08-08T10:00:00.000Z",
};
async function setup(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=member", (r) =>
    r.fulfill({
      json: env({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000804",
        workspace_id: "00000000-0000-4000-8000-000000000805",
        roles: ["selection_manager"],
        capabilities: [
          "task:read",
          "task:create",
          "task:update",
          "task:assign",
        ],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/tasks/summary", (r) =>
    r.fulfill({
      json: env({
        todo: 2,
        in_progress: 1,
        completed: 4,
        cancelled: 0,
        overdue: 1,
      }),
    }),
  );
  await page.route(`**/api/v1/tasks/${taskId}`, (r) =>
    r.fulfill({
      json: env({
        ...task,
        comments: [
          {
            id: "00000000-0000-4000-8000-000000000806",
            body: "报价证据已核验，等待确认交期。",
            created_by: actor,
            created_at: "2026-08-08T10:05:00.000Z",
          },
        ],
        events: [],
      }),
    }),
  );
  await page.route("**/api/v1/tasks?*", (r) =>
    r.fulfill({
      json: {
        ...env([
          task,
          {
            ...task,
            id: "00000000-0000-4000-8000-000000000807",
            title: "补齐竞品价格证据",
            status: "todo",
            priority: "normal",
            due_at: null,
            sla_status: "not_set",
            version: 1,
          },
        ]),
        meta: { page: 1, page_size: 50, total: 2 },
      },
    }),
  );
}
test("M05-01.A07/A08/A09/A15 renders truthful task SLA detail and comments on desktop and 390", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/work");
  await expect(
    page.getByRole("heading", { name: "今日工作", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("24 小时内到期")).toBeVisible();
  await expect(page.getByText("未设置期限")).toBeVisible();
  await page.getByRole("button", { name: /核验便携净水杯供应商报价/ }).click();
  await expect(page.getByText("报价证据已核验，等待确认交期。")).toBeVisible();
  await expect(page.getByRole("button", { name: "转交" })).toBeVisible();
  await expect(page).toHaveScreenshot("m05-01-business-tasks.png", {
    fullPage: true,
  });
});
