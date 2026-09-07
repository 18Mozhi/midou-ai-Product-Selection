import { test, expect, type Page } from "@playwright/test";

// Same reviewed facts as m04-03-scoring, isolated here so its capture source stays unchanged.
const ruleId = "00000000-0000-4000-8000-000000000435";
const targetId = "00000000-0000-4000-8000-000000000436";
const envelope = (data: unknown) => ({ data, request_id: "ui2-score", trace_id: "ui2-score" });
const dimensions = [
  {
    code: "market_demand",
    label: "市场需求",
    weight: 40,
    required: true,
    evidence_group: "market",
  },
  { code: "competition", label: "竞争", weight: 30, required: true, evidence_group: "competition" },
  { code: "profit", label: "利润", weight: 30, required: true, evidence_group: "cost" },
];
const rule = (status: string, id = ruleId, revision = 4) => ({
  id,
  version_code: id === ruleId ? "org-v1" : "org-v2",
  name: id === ruleId ? "核验规则" : "恢复目标",
  status,
  dimensions,
  thresholds: { recommend_min: 75, observe_min: 55 },
  revision,
  submitted_at: null,
  approved_at: null,
  activated_at: null,
  updated_at: "2026-08-07T10:20:00.000Z",
});
const failure = (code: string, hint: string) => ({
  error: { code, message: hint, action_hint: hint },
  request_id: "ui2-score-failed",
  trace_id: "ui2-score-failed",
});
async function setup(
  page: Page,
  capabilities = ["opportunity:read", "opportunity:decide", "opportunity:approve"],
) {
  const writes: Array<{ path: string; body: unknown; key: string | undefined }> = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/v1/opportunity-score-rules") && request.method() === "POST")
      writes.push({
        path: url.pathname,
        body: request.postDataJSON(),
        key: request.headers()["idempotency-key"],
      });
  });
  await page.route("**/api/v1/me/navigation?shell=member", (route) =>
    route.fulfill({
      json: envelope({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000421",
        workspace_id: "00000000-0000-4000-8000-000000000422",
        roles: ["selection_manager"],
        capabilities,
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  return writes;
}

for (const [action, status, opener, label, result] of [
  ["submit", "draft", "提交", "提交审批", "pending_approval"],
  ["approve", "pending_approval", "批准", "批准", "approved"],
  ["reject", "pending_approval", "拒绝", "拒绝", "rejected"],
  ["activate", "approved", "启用", "启用", "active"],
  ["rollback", "active", "回滚", "回滚", "rolled_back"],
]) {
  test(`UI2-S01 ${action}: reason, cancel, exact revision and one write`, async ({ page }) => {
    const writes = await setup(page);
    let current = rule(status),
      target = rule("retired", targetId);
    await page.route("**/api/v1/opportunity-score-rules", (route) =>
      route.fulfill({ json: envelope([current, target]) }),
    );
    await page.route(`**/api/v1/opportunity-score-rules/${ruleId}/actions`, (route) => {
      current = rule(result, ruleId, 5);
      if (action === "rollback") target = rule("active", targetId, 5);
      return route.fulfill({ json: envelope(action === "rollback" ? target : current) });
    });
    await page.goto("/opportunities/scoring-rules");
    const trigger = page.getByRole("button", { name: opener, exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: `${label} · org-v1` });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    await dialog.getByRole("button", { name: `确认${label}`, exact: true }).click();
    expect(writes).toHaveLength(0);
    await expect(dialog.getByLabel("原因（必填）")).toBeFocused();
    await dialog.getByLabel("原因（必填）").fill("取消的旧原因");
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    expect(writes).toHaveLength(0);
    await trigger.click();
    await expect(dialog.getByLabel("原因（必填）")).toHaveValue("");
    await dialog.getByLabel("原因（必填）").fill("核验该版本操作");
    if (action === "rollback") {
      await expect(dialog.getByLabel("回滚目标版本").locator("option")).toHaveCount(2);
      await dialog.getByLabel("回滚目标版本").selectOption(targetId);
    } else await expect(dialog.getByLabel("回滚目标版本")).toHaveCount(0);
    await dialog.getByRole("button", { name: `确认${label}`, exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(".opportunity-message")).toContainText(`${label}已完成`);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      path: `/api/v1/opportunity-score-rules/${ruleId}/actions`,
      body: {
        action,
        reason: "核验该版本操作",
        expected_revision: 4,
        ...(action === "rollback" ? { target_rule_id: targetId } : {}),
      },
    });
    expect(Object.keys(writes[0].body as object).sort()).toEqual(
      (action === "rollback"
        ? ["action", "reason", "expected_revision", "target_rule_id"]
        : ["action", "reason", "expected_revision"]
      ).sort(),
    );
    expect(writes[0].key).toBeTruthy();
    await expect(page.locator(".score-rule-list")).toContainText("rev 5");
  });
}

test("UI2-S02 create validates weights, preserves cancelled draft, sends only enabled dimensions and resets", async ({
  page,
}) => {
  const writes = await setup(page);
  await page.route("**/api/v1/opportunity-score-rules", (route) =>
    route.fulfill({
      status: route.request().method() === "POST" ? 201 : 200,
      json: envelope(route.request().method() === "POST" ? rule("draft") : [rule("active")]),
    }),
  );
  await page.goto("/opportunities/scoring-rules");
  const trigger = page.getByRole("button", { name: "创建新版本补齐配置" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "新建评分规则草稿" });
  const save = dialog.getByRole("button", { name: "保存草稿", exact: true });
  await expect(save).toBeDisabled();
  await dialog.getByLabel("版本代码", { exact: true }).fill("org-v3");
  await dialog.getByLabel("规则名称", { exact: true }).fill("显式双维规则");
  await dialog.getByLabel("推荐阈值", { exact: true }).fill("70");
  await dialog.getByLabel("观察阈值", { exact: true }).fill("70");
  await expect(dialog.getByRole("status")).toContainText("推荐阈值必须大于观察阈值");
  await dialog.getByLabel("观察阈值", { exact: true }).fill("50");
  await dialog.getByLabel("市场需求权重", { exact: true }).fill("60");
  await expect(dialog.getByRole("status")).toContainText("至少配置 2 个");
  await dialog.getByLabel("竞争权重", { exact: true }).fill("30");
  await expect(dialog.getByRole("status")).toContainText("合计 90%");
  await dialog.getByLabel("竞争权重", { exact: true }).fill("40");
  await expect(dialog.getByRole("status")).toContainText("标记为必填");
  await dialog.getByLabel("市场需求必填", { exact: true }).check();
  await dialog.getByLabel("市场需求证据组", { exact: true }).selectOption("market");
  await dialog.getByLabel("竞争证据组", { exact: true }).selectOption("competition");
  await expect(save).toBeEnabled();
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(trigger).toBeFocused();
  expect(writes).toHaveLength(0);
  await trigger.click();
  await expect(dialog.getByLabel("版本代码", { exact: true })).toHaveValue("org-v3");
  await save.click();
  await expect(dialog).toBeHidden();
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toEqual({
    version_code: "org-v3",
    name: "显式双维规则",
    thresholds: { recommend_min: 70, observe_min: 50 },
    dimensions: [
      {
        code: "market_demand",
        label: "市场需求",
        weight: 60,
        required: true,
        evidence_group: "market",
      },
      {
        code: "competition",
        label: "竞争",
        weight: 40,
        required: false,
        evidence_group: "competition",
      },
    ],
  });
  await trigger.click();
  await expect(dialog.getByLabel("版本代码", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("推荐阈值", { exact: true })).toHaveValue("");
  await expect(dialog.getByLabel("市场需求权重", { exact: true })).toHaveValue("0");
});

test("UI2-S03 revision conflict stays in the dialog and a reloaded version is required", async ({
  page,
}) => {
  const writes = await setup(page);
  let revision = 4;
  await page.route("**/api/v1/opportunity-score-rules", (route) =>
    route.fulfill({ json: envelope([rule("draft", ruleId, revision)]) }),
  );
  await page.route(`**/api/v1/opportunity-score-rules/${ruleId}/actions`, (route) => {
    revision = 5;
    return route.fulfill({
      status: 409,
      json: failure("score_rule_revision_conflict", "刷新规则并使用最新 revision 重试。"),
    });
  });
  await page.goto("/opportunities/scoring-rules");
  await page.getByRole("button", { name: "提交", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("原因（必填）").fill("保留提交原因");
  await dialog.getByRole("button", { name: "确认提交审批" }).click();
  await expect(dialog.getByRole("alert")).toContainText("规则已被其他操作更新");
  await expect(dialog.getByRole("alert")).toContainText("ui2-score-failed");
  await expect(dialog.getByLabel("原因（必填）")).toHaveValue("保留提交原因");
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toMatchObject({ expected_revision: 4 });
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator(".score-rule-list")).toContainText("rev 5");
  await page.getByRole("button", { name: "提交", exact: true }).click();
  await dialog.getByLabel("原因（必填）").fill("重新核验后提交");
  await dialog.getByRole("button", { name: "确认提交审批" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  expect(writes[1].body).toMatchObject({ expected_revision: 5 });
});

test("UI2-S04 preview retries and paginates by server totals without any write", async ({
  page,
}) => {
  const writes = await setup(page);
  const reads: string[] = [];
  await page.route("**/api/v1/opportunity-score-rules", (route) =>
    route.fulfill({ json: envelope([rule("draft")]) }),
  );
  await page.route(`**/api/v1/opportunity-score-rules/${ruleId}/preview?*`, (route) => {
    const url = new URL(route.request().url());
    reads.push(url.search);
    // api-client retries safe GET failures three times before showing the workflow error.
    if (reads.length <= 3)
      return route.fulfill({
        status: 503,
        json: failure("dependency_unavailable", "稍后重试预览"),
      });
    const pageNumber = Number(url.searchParams.get("page"));
    return route.fulfill({
      json: envelope({
        rule_id: ruleId,
        rule_version_code: "org-v1",
        rule_status: "draft",
        page: pageNumber,
        page_size: 20,
        total: 21,
        read_only: true,
        page_summary: {
          increased: 0,
          decreased: 0,
          unchanged: 0,
          newly_calculable: 0,
          insufficient_data: pageNumber === 1 ? 20 : 1,
          recommendation_changed: 0,
        },
        items: Array.from({ length: pageNumber === 1 ? 20 : 1 }, (_, i) => ({
          opportunity_id: `00000000-0000-4000-8000-${String(500 + i + (pageNumber - 1) * 20).padStart(12, "0")}`,
          opportunity_name: `第${pageNumber}页机会${i + 1}`,
          lifecycle_status: "ready",
          current_score: null,
          current_recommendation_status: "insufficient_data",
          current_rule_version: null,
          projected_score: null,
          projected_recommendation_status: "insufficient_data",
          projected_coverage_percent: 0,
          score_delta: null,
          recommendation_changed: false,
          missing_fields: ["market_demand"],
        })),
      }),
    });
  });
  await page.goto("/opportunities/scoring-rules");
  const trigger = page.getByRole("button", { name: "预览影响", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "发布影响预览 · org-v1" });
  await expect(dialog.getByRole("alert")).toContainText("稍后重试预览");
  await dialog.getByRole("button", { name: "重试预览" }).click();
  await expect(dialog.locator(".score-preview-table article")).toHaveCount(20);
  await expect(dialog.getByRole("button", { name: "上一页" })).toBeDisabled();
  await dialog.getByRole("button", { name: "下一页" }).click();
  await expect(dialog.getByText("第2页机会1", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "下一页" })).toBeDisabled();
  await dialog.getByRole("button", { name: "上一页" }).click();
  await expect(dialog.locator(".score-preview-table article")).toHaveCount(20);
  expect(reads).toEqual([
    "?page=1&page_size=20",
    "?page=1&page_size=20",
    "?page=1&page_size=20",
    "?page=1&page_size=20",
    "?page=2&page_size=20",
    "?page=1&page_size=20",
  ]);
  expect(writes).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

for (const capability of ["read", "decide", "approve"]) {
  test(`UI2-S05 ${capability}: every lifecycle entry follows its capability and status`, async ({
    page,
  }) => {
    const writes = await setup(page, [
      "opportunity:read",
      ...(capability === "read" ? [] : [`opportunity:${capability}`]),
    ]);
    const statuses = [
      "draft",
      "pending_approval",
      "approved",
      "active",
      "retired",
      "rejected",
      "rolled_back",
    ];
    await page.route("**/api/v1/opportunity-score-rules", (route) =>
      route.fulfill({
        json: envelope(
          statuses.map((status, index) =>
            rule(status, `00000000-0000-4000-8000-${String(600 + index).padStart(12, "0")}`),
          ),
        ),
      }),
    );
    await page.goto("/opportunities/scoring-rules");
    const surface = page.locator(".score-rules");
    await expect(surface.locator(".score-rule-list > article")).toHaveCount(7);
    await expect(surface.getByRole("button", { name: "创建新版本补齐配置" })).toHaveCount(
      capability === "decide" ? 1 : 0,
    );
    await expect(surface.getByRole("button", { name: "提交", exact: true })).toHaveCount(
      capability === "decide" ? 1 : 0,
    );
    await expect(surface.getByRole("button", { name: "预览影响", exact: true })).toHaveCount(
      capability === "approve" ? 3 : 0,
    );
    for (const name of ["批准", "拒绝", "启用", "回滚"])
      await expect(surface.getByRole("button", { name, exact: true })).toHaveCount(
        capability === "approve" ? 1 : 0,
      );
    for (const index of [4, 5, 6])
      await expect(
        surface.locator(".score-rule-list > article").nth(index).getByRole("button"),
      ).toHaveCount(0);
    expect(writes).toHaveLength(0);
  });
}
