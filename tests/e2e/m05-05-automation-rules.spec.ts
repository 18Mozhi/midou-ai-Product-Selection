import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const org = "00000000-0000-4000-8000-000000000551",
  ws = "00000000-0000-4000-8000-000000000552",
  ruleId = "00000000-0000-4000-8000-000000000553",
  user = "00000000-0000-4000-8000-000000000554",
  envelope = (data: any) => ({
    data,
    request_id: "m05-05-e2e",
    trace_id: "m05-05-e2e",
  }),
  rule = {
    id: ruleId,
    name: "审批超时人工跟进",
    trigger_event_type: "approval.overdue",
    condition_severity: "warning",
    action_type: "notify_owner",
    owner_id: user,
    action_assignee_id: null,
    action_title: "审批超时，请人工处理",
    rate_limit_count: 5,
    rate_limit_window_minutes: 60,
    status: "active",
    version: 1,
    latest_execution_status: "dead_letter",
    latest_execution_at: "2026-08-08T12:01:01.000Z",
    latest_error_code: "action_failed",
    created_at: "2026-08-08T12:00:00.000Z",
    updated_at: "2026-08-08T12:00:00.000Z",
  };
async function setup(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=member", (r) =>
    r.fulfill({
      json: envelope({
        shell: "member",
        organization_id: org,
        workspace_id: ws,
        roles: ["selection_manager"],
        capabilities: ["task:read", "notification:read", "team:manage"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/automations", (r) => r.fulfill({ json: envelope([rule]) }));
  await page.route("**/api/v1/tasks/member-options", (r) =>
    r.fulfill({ json: envelope([{ id: user, label: "验收负责人" }]) }),
  );
  await page.route(`**/api/v1/automations/${ruleId}`, (r) =>
    r.fulfill({
      json: envelope({
        ...rule,
        executions: [
          {
            id: "00000000-0000-4000-8000-000000000555",
            rule_version: 1,
            notification_id: "00000000-0000-4000-8000-000000000556",
            status: "succeeded",
            attempt_count: 1,
            action_resource_type: "notification",
            action_resource_id: "00000000-0000-4000-8000-000000000557",
            last_error_code: null,
            created_at: "2026-08-08T12:01:00.000Z",
            updated_at: "2026-08-08T12:01:01.000Z",
          },
        ],
      }),
    }),
  );
}
test("M05-05.A07/A08/A15 desktop rules and execution drawer", async ({ page }) => {
  await setup(page);
  await page.goto("/automations");
  await expect(page.getByRole("heading", { name: "自动化规则", level: 2 })).toBeVisible();
  await expect(page.getByText("审批超时人工跟进")).toBeVisible();
  await expect(page.getByText(/成员访问已授权|navigation_member_allowed/)).toHaveCount(0);
  await expect(page.getByRole("article").getByText("重要", { exact: true })).toBeVisible();
  await expect(page.getByRole("article").getByText("最终失败", { exact: true })).toBeVisible();
  await expect(page.getByText("动作执行失败，系统将按策略重试")).toBeVisible();

  await page.getByRole("button", { name: "查看详情" }).click();
  await expect(page).toHaveURL(new RegExp(`rule=${ruleId}`));
  await expect(page.getByText("规则详情与执行记录")).toBeVisible();
  await expect(page.getByText("规则 v1 · 尝试 1 次")).toBeVisible();
  await expect(page.getByRole("link", { name: "查看触发通知与来源" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/rule=/);
  await expect(page.getByRole("button", { name: "查看详情" })).toBeFocused();
});
test("automation rule can enter edit mode with existing values", async ({ page }) => {
  await setup(page);
  await page.goto("/automations");
  await page.getByRole("button", { name: "编辑", exact: true }).click();
  await expect(page.getByRole("heading", { name: "编辑自动化规则" })).toBeVisible();
  await expect(page.getByLabel("规则名称")).toHaveValue("审批超时人工跟进");
  await expect(page.getByLabel("规则负责人")).toHaveValue(user);
  await expect(page.getByLabel("修改原因")).toBeVisible();
  await expect(page.getByRole("button", { name: "保存修改" })).toBeVisible();
});
test("M05-05.A07/A08/A15 mobile create rule layout", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/automations");
  await page.getByRole("button", { name: "创建规则" }).click();
  await expect(page.getByRole("heading", { name: "创建自动化规则" })).toBeVisible();
  await expect(page.getByText("规则只消费真实通知投影")).toBeVisible();
  await page.getByRole("button", { name: /竞品告警复核/ }).click();
  await expect(page.getByLabel("规则名称")).toHaveValue("竞品告警复核");
});

const previewResult = {
  mode: "read_only",
  matched_30d: 17,
  matched_in_rate_window: 3,
  projected_action_count: 3,
  projected_task_count: 0,
  projected_notification_count: 3,
  rate_limit_count: 20,
  rate_limit_window_minutes: 60,
  samples: [],
};
async function readyCreator(page: Page) {
  await page.getByRole("button", { name: "创建规则", exact: true }).click();
  await page.getByRole("button", { name: /审批超时提醒/ }).click();
  await page.getByLabel("规则负责人").selectOption(user);
}
test("UI2-AR01 preview is invalidated when the rule input changes", async ({ page }) => {
  await setup(page);
  const previews: any[] = [];
  await page.route("**/api/v1/automations/preview", (route) => {
    const body = route.request().postDataJSON();
    previews.push(body);
    return route.fulfill({
      json: envelope({
        ...previewResult,
        rate_limit_count: body.rate_limit_count,
        projected_action_count: Math.min(3, body.rate_limit_count),
        projected_notification_count: Math.min(3, body.rate_limit_count),
      }),
    });
  });
  await page.goto("/automations");
  await readyCreator(page);
  await page.getByRole("button", { name: "试运行并预览影响" }).click();
  await expect(page.getByText("最近 30 天匹配 17 条")).toBeVisible();
  await page.getByLabel("最多执行次数").fill("1");
  await expect(page.locator(".automation-impact-preview")).toHaveCount(0);
  expect(previews).toHaveLength(1);
  expect(previews[0]).toMatchObject({ rate_limit_count: 20, action_assignee_id: null });
  await page.getByRole("button", { name: "试运行并预览影响" }).click();
  await expect.poll(() => previews.length).toBe(2);
  expect(previews[1].rate_limit_count).toBe(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "创建规则", exact: true })).toBeFocused();
});
test("UI2-AR02 a closed preview request cannot populate a new editor", async ({ page }) => {
  await setup(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/automations/preview", async (route) => {
    await held;
    await route.fulfill({ json: envelope(previewResult) });
  });
  await page.goto("/automations");
  await readyCreator(page);
  const sent = page.waitForRequest("**/api/v1/automations/preview");
  await page.getByRole("button", { name: "试运行并预览影响" }).click();
  await sent;
  await page.keyboard.press("Escape");
  await readyCreator(page);
  const response = page.waitForResponse("**/api/v1/automations/preview");
  release();
  await (await response).finished();
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await expect(page.locator(".automation-impact-preview")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "试运行并预览影响" })).toBeEnabled();
});

test("UI2-AR03 template cycle guard and creation preserve the exact rule contract", async ({
  page,
}) => {
  await setup(page);
  const writes: any[] = [];
  await page.route("**/api/v1/automations", async (route) => {
    if (route.request().method() === "POST") {
      writes.push(route.request().postDataJSON());
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      await route.fulfill({ status: 201, json: envelope(rule) });
    } else await route.fulfill({ json: envelope([rule]) });
  });
  await page.goto("/automations");
  await page.getByRole("button", { name: "创建规则", exact: true }).click();
  await page.getByRole("button", { name: "创建并启用" }).click();
  expect(writes).toEqual([]);
  await expect(page.getByLabel("规则名称")).toBeFocused();
  await page.getByRole("button", { name: /竞品告警复核/ }).click();
  await page.getByLabel("规则负责人").selectOption(user);
  await page.getByLabel("任务负责人").selectOption(user);
  await page.getByRole("combobox", { name: /触发器/ }).selectOption("task.created");
  await expect(page.getByRole("combobox", { name: /动作/ })).toHaveValue("notify_owner");
  await expect(page.getByLabel("任务负责人")).toHaveCount(0);
  await page.getByRole("button", { name: "创建并启用" }).click();
  await expect(page.getByRole("dialog", { name: "创建自动化规则" })).not.toBeVisible();
  expect(writes).toEqual([
    {
      name: "竞品告警复核",
      description: "重要竞品告警进入队列后创建人工复核任务。",
      trigger_event_type: "task.created",
      condition_severity: "warning",
      action_type: "notify_owner",
      owner_id: user,
      action_assignee_id: null,
      action_title: "复核竞品变化与来源证据",
      rate_limit_count: 20,
      rate_limit_window_minutes: 60,
    },
  ]);
});

test("UI2-AR04 pause and resume use the returned version and existing audit reasons", async ({
  page,
}) => {
  await setup(page);
  let current = { ...rule };
  const writes: any[] = [];
  await page.route("**/api/v1/automations", (route) =>
    route.fulfill({ json: envelope([current]) }),
  );
  await page.route(`**/api/v1/automations/${ruleId}/actions`, async (route) => {
    const body = route.request().postDataJSON();
    writes.push(body);
    current = {
      ...current,
      status: body.action === "pause" ? "paused" : "active",
      version: current.version + 1,
    };
    await route.fulfill({ json: envelope(current) });
  });
  await page.goto("/automations");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(page.getByRole("button", { name: "恢复", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "恢复", exact: true }).click();
  await expect(page.getByRole("button", { name: "暂停", exact: true })).toBeEnabled();
  expect(writes).toEqual([
    { action: "pause", expected_version: 1, reason: "由规则管理页人工暂停" },
    { action: "resume", expected_version: 2, reason: "由规则管理页人工恢复" },
  ]);
});
