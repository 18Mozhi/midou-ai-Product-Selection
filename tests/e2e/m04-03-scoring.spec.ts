import { test, expect, type Page } from "@playwright/test";
const opportunityId = "00000000-0000-4000-8000-000000000434",
  ruleId = "00000000-0000-4000-8000-000000000435",
  draftId = "00000000-0000-4000-8000-000000000436",
  actor = "00000000-0000-4000-8000-000000000437",
  envelope = (data: unknown) => ({
    data,
    request_id: "m04-03-e2e-request",
    trace_id: "m04-03-e2e-trace",
  }),
  dimensions = [
    {
      code: "market_demand",
      label: "市场需求",
      weight: 40,
      required: true,
      evidence_group: "market",
    },
    {
      code: "competition",
      label: "竞争",
      weight: 30,
      required: true,
      evidence_group: "competition",
    },
    { code: "profit", label: "利润", weight: 30, required: true, evidence_group: "cost" },
  ];
async function navigation(
  page: Page,
  capabilities = [
    "task:read",
    "trend:read",
    "opportunity:read",
    "opportunity:decide",
    "opportunity:approve",
  ],
) {
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
}
test("M04-03.A07/A08/A09/A15 score rule versions support audited responsive workflow", async ({
  page,
}) => {
  await navigation(page);
  let draftStatus = "draft",
    draftRevision = 1;
  const rules = () => [
    {
      id: ruleId,
      version_code: "org-v1",
      name: "当前生产评分规则",
      status: "active",
      dimensions,
      thresholds: { recommend_min: 75, observe_min: 55 },
      revision: 4,
      submitted_at: "2026-08-07T10:00:00.000Z",
      approved_at: "2026-08-07T10:10:00.000Z",
      activated_at: "2026-08-07T10:20:00.000Z",
      updated_at: "2026-08-07T10:20:00.000Z",
    },
    {
      id: draftId,
      version_code: "org-v2",
      name: "候选评分规则",
      status: draftStatus,
      dimensions,
      thresholds: { recommend_min: 78, observe_min: 58 },
      revision: draftRevision,
      submitted_at: null,
      approved_at: null,
      activated_at: null,
      updated_at: "2026-08-07T11:00:00.000Z",
    },
  ];
  await page.route("**/api/v1/opportunity-score-rules", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 201, json: envelope(rules()[1]) })
      : route.fulfill({ json: envelope(rules()) }),
  );
  await page.route(`**/api/v1/opportunity-score-rules/${draftId}/actions`, (route) => {
    draftStatus = "pending_approval";
    draftRevision = 2;
    return route.fulfill({ json: envelope(rules()[1]) });
  });
  await page.route(`**/api/v1/opportunity-score-rules/${draftId}/preview**`, (route) =>
    route.fulfill({
      json: envelope({
        rule_id: draftId,
        rule_version_code: "org-v2",
        rule_status: draftStatus,
        page: 1,
        page_size: 20,
        total: 1,
        items: [
          {
            opportunity_id: opportunityId,
            opportunity_name: "便携式智能净水杯机会",
            lifecycle_status: "ready",
            current_score: 80.2,
            current_recommendation_status: "recommend",
            current_rule_version: "org-v1",
            projected_score: 78.4,
            projected_recommendation_status: "recommend",
            projected_coverage_percent: 100,
            score_delta: -1.8,
            recommendation_changed: false,
            missing_fields: [],
          },
        ],
        page_summary: {
          increased: 0,
          decreased: 1,
          unchanged: 0,
          newly_calculable: 0,
          insufficient_data: 0,
          recommendation_changed: 0,
        },
        read_only: true,
      }),
    }),
  );
  await page.goto("/opportunities/scoring-rules");
  await expect(page.getByRole("heading", { name: "评分规则引擎" })).toBeVisible();
  await expect(page.getByText("当前生产评分规则")).toBeVisible();
  await page.getByRole("button", { name: "预览影响" }).click();
  const previewDialog = page.getByRole("dialog", { name: /发布影响预览/ });
  await expect(previewDialog).toBeVisible();
  await expect(previewDialog).toHaveJSProperty("open", true);
  await expect(previewDialog.getByText("便携式智能净水杯机会")).toBeVisible();
  await expect(previewDialog.getByText("-1.80")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(previewDialog).toBeHidden();
  await expect(page.getByRole("button", { name: "预览影响" })).toBeFocused();
  await page.getByRole("button", { name: "提交" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("原因（必填）").fill("提交候选权重等待审批");
  await dialog.getByRole("button", { name: "确认提交审批" }).click();
  await expect(page.getByText("提交审批已完成并写入审计记录。")).toBeVisible();
  await expect(page.getByText("待审批", { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
});
test("M04-03 score rule approval controls follow real navigation capabilities", async ({
  page,
}) => {
  await navigation(page, ["opportunity:read", "opportunity:decide"]);
  await page.route("**/api/v1/opportunity-score-rules", (route) =>
    route.fulfill({
      json: envelope([
        {
          id: draftId,
          version_code: "org-v2",
          name: "等待审批的评分规则",
          status: "pending_approval",
          dimensions,
          thresholds: { recommend_min: 78, observe_min: 58 },
          revision: 2,
          submitted_at: "2026-08-07T11:10:00.000Z",
          approved_at: null,
          activated_at: null,
          updated_at: "2026-08-07T11:10:00.000Z",
        },
      ]),
    }),
  );

  await page.goto("/opportunities/scoring-rules");
  await expect(page.getByText("等待有审批权限的成员处理")).toBeVisible();
  await expect(page.getByRole("button", { name: "预览影响" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "批准" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "拒绝" })).toHaveCount(0);
});
test("M04-03.A07/A08/A15 opportunity score explanation exposes inputs evidence missing and confidence", async ({
  page,
}) => {
  await navigation(page);
  const detail = {
    id: opportunityId,
    name: "便携式智能净水杯机会",
    market: "US",
    category: "outdoor",
    source_type: "trend_topic",
    source_ref_id: null,
    owner_id: actor,
    lifecycle_status: "ready",
    lifecycle_entered_at: "2026-08-07T08:30:00.000Z",
    lifecycle_dwell_seconds: 14400,
    recommendation_status: "recommend",
    overall_score: 80.2,
    trend_score: 82,
    competition_score: 70,
    profit_status: "insufficient_data",
    risk_level: "unknown",
    confidence: { status: "measured", score: 100 },
    evidence_count: 8,
    source_count: 3,
    coverage_status: "complete",
    decision_status: "pending",
    version: 7,
    updated_at: "2026-08-07T12:30:00.000Z",
    score_rule_version: "org-v1",
    scored_at: "2026-08-07T12:30:00.000Z",
    latest_score_run: {
      id: ruleId,
      status: "calculated",
      coverage_percent: 100,
      confidence_score: 100,
      recommendation_status: "recommend",
      missing_fields: [],
      scored_at: "2026-08-07T12:30:00.000Z",
    },
    score_components: [
      {
        dimension_code: "market_demand",
        weight_percent: 40,
        input_score: 82,
        weighted_score: 32.8,
        evidence_ids: [ruleId],
        missing_fields: [],
      },
      {
        dimension_code: "competition",
        weight_percent: 30,
        input_score: 70,
        weighted_score: 21,
        evidence_ids: [draftId],
        missing_fields: [],
      },
      {
        dimension_code: "profit",
        weight_percent: 30,
        input_score: 88,
        weighted_score: 26.4,
        evidence_ids: [opportunityId],
        missing_fields: [],
      },
    ],
    adoption_blockers: [
      {
        code: "evidence_insufficient",
        status: "cleared",
        progress_percent: 100,
        next_action: "证据覆盖阻断已解除。",
        task_id: null,
        task_status: null,
        score_job_status: "succeeded",
      },
      {
        code: "recommendation_insufficient",
        status: "cleared",
        progress_percent: null,
        next_action: "推荐结论阻断已解除。",
        task_id: null,
        task_status: null,
        score_job_status: "succeeded",
      },
    ],
    redecision_ready: false,
    evidence: [],
    decisions: [],
    section_status: {
      market: "covered",
      competition: "covered",
      profit: "insufficient_data",
      risk: "insufficient_data",
      execution: "not_available",
    },
  };
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (route) =>
    route.fulfill({ json: envelope(detail) }),
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) =>
    route.fulfill({ json: envelope({ latest_run: null, current_inputs: [] }) }),
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}/score-runs`, (route) =>
    route.fulfill({
      status: 202,
      json: envelope({ job_id: draftId, opportunity_id: opportunityId, version: 8 }),
    }),
  );
  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: "便携式智能净水杯机会" })).toBeVisible();
  await expect(page.getByText("规则 org-v1 · 覆盖 100%")).toBeVisible();
  await expect(page.getByText("market_demand · 40%")).toBeVisible();
  await expect(page.getByRole("link", { name: "管理规则版本" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
});
