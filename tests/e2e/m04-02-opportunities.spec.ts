import { test, expect, type Page } from "@playwright/test";

const opportunityId = "00000000-0000-4000-8000-000000000424",
  topicId = "00000000-0000-4000-8000-000000000425";
const base = {
  id: opportunityId,
  name: "AI 驱动的个性化护肤机会",
  market: "US",
  category: "beauty",
  source_type: "trend_topic",
  source_ref_id: topicId,
  owner_id: "00000000-0000-4000-8000-000000000423",
  lifecycle_status: "ready",
  lifecycle_entered_at: "2026-08-07T20:00:00.000Z",
  lifecycle_dwell_seconds: 14400,
  recommendation_status: "insufficient_data",
  overall_score: null,
  trend_score: null,
  competition_score: null,
  profit_status: "insufficient_data",
  risk_level: "unknown",
  confidence: { status: "insufficient_data", score: null },
  evidence_count: 2,
  source_count: 2,
  coverage_status: "partial",
  blocking_reasons: ["recommendation_insufficient"],
  decision_status: "pending",
  version: 1,
  updated_at: "2026-08-08T00:00:00.000Z",
};
const recommendedBase = {
  ...base,
  recommendation_status: "recommend",
  overall_score: 86,
  evidence_count: 8,
  source_count: 3,
  competitor_count: 5,
  supplier_candidate_count: 4,
  matched_rule_count: 1,
  coverage_status: "complete",
  blocking_reasons: [],
};
const evidence = [
  {
    id: "00000000-0000-4000-8000-000000000426",
    title: "AI Skin Care Demand Rises",
    publisher: "Example News",
    canonical_url: "https://example.test/ai-skincare",
    provider_id: "00000000-0000-4000-8000-000000000427",
    raw_evidence_id: "00000000-0000-4000-8000-000000000428",
    observed_at: "2026-08-07T14:05:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000429",
    title: "Personalized beauty products gain attention",
    publisher: "Retail Example",
    canonical_url: "https://example.test/personalized",
    provider_id: "00000000-0000-4000-8000-000000000430",
    raw_evidence_id: "00000000-0000-4000-8000-000000000431",
    observed_at: "2026-08-07T13:05:00.000Z",
  },
];
const envelope = (data: unknown, meta?: unknown) => ({
  data,
  ...(meta ? { meta } : {}),
  request_id: "m04-02-e2e-request",
  trace_id: "m04-02-e2e-trace",
});

async function ready(page: Page, detailEvidence = evidence) {
  let decided = false;
  await page.route("**/api/v1/me/navigation?shell=member", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          shell: "member",
          organization_id: "00000000-0000-4000-8000-000000000421",
          workspace_id: "00000000-0000-4000-8000-000000000422",
          roles: ["member"],
          capabilities: [
            "task:read",
            "trend:read",
            "trend:manage",
            "opportunity:read",
            "opportunity:decide",
          ],
          platform_roles: [],
          platform_capabilities: [],
          guard_reason: "navigation_member_allowed",
        }),
      ),
    }),
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}/decisions`, (route) => {
    decided = true;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          opportunity_id: opportunityId,
          decision_status: "observing",
          version: 2,
          decision_id: topicId,
        }),
      ),
    });
  });
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          ...base,
          decision_status: decided ? "observing" : "pending",
          lifecycle_status: decided ? "observing" : "ready",
          version: decided ? 2 : 1,
          score_rule_version: null,
          scored_at: null,
          latest_score_run: null,
          score_components: [],
          lineage: {
            freshness: { observed_at: detailEvidence[0].observed_at, age_seconds: 3600 },
            failure_impact: {
              level: "degraded",
              codes: ["insufficient_data"],
              affected_stages: ["score"],
            },
            request_ids: ["m04-02-e2e-request"],
            trace_ids: ["m04-02-e2e-trace"],
            nodes: [
              {
                kind: "opportunity",
                id: opportunityId,
                label: base.name,
                status: "pending",
                occurred_at: base.updated_at,
                request_id: "m04-02-e2e-request",
                trace_id: "m04-02-e2e-trace",
                route: `/opportunities/${opportunityId}?tab=lineage`,
              },
            ],
          },
          operating_feedback: { facts: [], calibration: null },
          adoption_blockers: [
            {
              code: "evidence_insufficient",
              status: "cleared",
              progress_percent: 100,
              next_action: "证据覆盖阻断已解除。",
              task_id: null,
              task_status: null,
              score_job_status: null,
            },
            {
              code: "recommendation_insufficient",
              status: "blocked",
              progress_percent: null,
              next_action: "启用评分规则并在补采后重新评分。",
              task_id: null,
              task_status: null,
              score_job_status: null,
            },
          ],
          redecision_ready: false,
          evidence: detailEvidence,
          decisions: decided
            ? [
                {
                  id: topicId,
                  action: "observe",
                  reason: "补齐成本与竞品后再判断",
                  actor_id: base.owner_id,
                  created_at: "2026-08-08T00:05:00.000Z",
                  opportunity_version: 2,
                },
              ]
            : [],
          section_status: {
            market: "covered",
            competition: "insufficient_data",
            profit: "insufficient_data",
            risk: "insufficient_data",
            execution: "not_available",
          },
        }),
      ),
    }),
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) =>
    route.fulfill({ json: envelope({ latest_run: null, current_inputs: [] }) }),
  );
  await page.route("**/api/v1/opportunities?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope([recommendedBase], { page: 1, page_size: 20, total: 1 })),
    }),
  );
  await page.route("**/api/v1/opportunities", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(envelope(base)),
    }),
  );
}

test("M04-02.A07/A08/A15 opportunity list and creation are responsive and truthful", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/opportunities?create=1");
  await expect(page.getByRole("heading", { name: "待我采纳", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "系统推荐 1 个商品" })).toBeVisible();
  await expect(page.locator(".opportunity-row-select")).toHaveCount(0);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "关闭" }).click();
  await page.getByRole("button", { name: "高级筛选" }).click();
  await page.getByLabel("证据完整度").selectOption("partial");
  const filtered = page.waitForRequest(
    (request) =>
      request.url().includes("/api/v1/opportunities?") &&
      request.url().includes("coverage_status=partial"),
  );
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  await filtered;
  await expect(page).toHaveScreenshot("m04-02-opportunity-list.png", { fullPage: true });
  await page.getByRole("button", { name: "全部机会" }).click();
  await expect(page.locator(".opportunity-row-select")).toHaveCount(1);
  const createButton = page.getByRole("button", { name: "手工添加", exact: true });
  await createButton.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(createButton).toBeFocused();
  await createButton.click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("机会名称").fill("手工验证机会");
  await dialog.getByRole("button", { name: "创建机会", exact: true }).click();
  await expect(page.getByRole("heading", { name: "AI 驱动的个性化护肤机会" })).toBeVisible();
});

test("M04-02.A07/A08/A15 opportunity detail tabs and reason-required decision preserve missing states", async ({
  page,
}) => {
  await ready(page);
  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: "AI 驱动的个性化护肤机会" })).toBeVisible();
  await expect(page.getByText("机会详情", { exact: true })).toHaveCount(1);
  await expect(page.getByText("来源 热点自动发现")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /trend_topic|insufficient_data|\bpartial\b|\bunknown\b/,
  );
  await expect(page.locator(".opportunity-tabs > button")).toHaveText([
    "结论",
    "证据",
    "利润与成本",
    "风险",
  ]);
  await expect(page.locator(".opportunity-tabs details > summary")).toHaveText("更多分析");
  await expect(page.getByText("尚无评分运行；缺失输入不会用默认值补齐。")).toBeVisible();
  await page.locator(".opportunity-tabs details > summary").click();
  await page.getByRole("button", { name: "业务血缘" }).click();
  await expect(page.getByRole("heading", { name: "业务血缘追踪" })).toBeVisible();
  await expect(page.getByText("部分环节降级", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "经营复盘" }).click();
  await expect(page.getByRole("heading", { name: "决策后反馈" })).toBeVisible();
  await expect(page.getByText("尚无经营复盘事实。")).toBeVisible();
  await page.getByRole("button", { name: "利润与成本" }).click();
  await expect(page.getByText("数据不足，不能生成可靠 ROI")).toBeVisible();
  await page.getByRole("button", { name: "证据", exact: true }).click();
  await expect(page.getByText("Example News")).toBeVisible();
  await page.getByRole("button", { name: "继续观察", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("原因（必填）").fill("补齐成本与竞品后再判断");
  await dialog.getByRole("button", { name: "确认记录" }).click();
  await expect(page.getByText("决策已记录；原始评分与证据未被改写。")).toBeVisible();
  await page.locator(".opportunity-tabs details > summary").click();
  await page.getByRole("button", { name: "决策历史" }).click();
  await expect(page.getByText("补齐成本与竞品后再判断")).toBeVisible();
  await expect(
    page.locator(".opportunity-decisions").getByText("继续观察", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /\bobserve\b|trend_topic|insufficient_data|\bpartial\b|\bunknown\b/,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("m04-02-opportunity-detail.png", { fullPage: true });
  if ((page.viewportSize()?.width ?? 0) <= 640) {
    await expect(page.locator(".opportunity-decision-actions")).toHaveCSS("position", "static");
  }
});

test("mobile opportunity filters preserve selected adoption blocker inside the drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.goto("/opportunities");
  await page.getByRole("button", { name: /高级筛选/ }).click();
  const drawer = page.getByRole("dialog", { name: "高级筛选" });
  await drawer.getByLabel("阻断原因").selectOption("recommendation_insufficient");
  await drawer.getByRole("button", { name: "关闭筛选条件" }).click();
  await page.getByRole("button", { name: /高级筛选/ }).click();
  await expect(drawer.getByLabel("阻断原因")).toHaveValue("recommendation_insufficient");
  const filtered = page.waitForRequest((request) =>
    request.url().includes("blocking_reason=recommendation_insufficient"),
  );
  await drawer.getByRole("button", { name: "筛选", exact: true }).click();
  await filtered;
  await expect(page).toHaveURL(/blocking_reason=recommendation_insufficient/);
  await expect(page.getByRole("link", { name: new RegExp(base.name) })).toBeVisible();
});

test("selection views send explicit truthful recommendation filters", async ({ page }) => {
  await ready(page);
  const recommended = page.waitForRequest((request) =>
    request.url().includes("selection_view=recommended"),
  );
  await page.goto("/opportunities");
  await recommended;
  await expect(page.getByRole("button", { name: "待我采纳" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const evidencePending = page.waitForRequest((request) =>
    request.url().includes("selection_view=evidence_pending"),
  );
  await page.getByRole("button", { name: "自动补证中" }).click();
  await evidencePending;
  await expect(page).toHaveURL(/view=evidence_pending/);
  await expect(page.getByRole("heading", { name: "自动补证中", level: 2 })).toBeVisible();

  const all = page.waitForRequest((request) => request.url().includes("selection_view=all"));
  await page.getByRole("button", { name: "全部机会" }).click();
  await all;
  await expect(page).toHaveURL(/view=all/);
  await expect(page.getByRole("button", { name: "手工添加", exact: true })).toBeVisible();
});

test("opportunity URL state and source return path survive list-detail navigation", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/opportunities?q=AI&coverage_status=partial");
  await expect(page.getByLabel("机会名称")).toHaveValue("AI");
  await expect(page.getByLabel("证据完整度")).toHaveValue("partial");
  const result = page.locator("a").filter({ hasText: base.name });
  await result.click();
  await expect(page).toHaveURL(new RegExp(`/opportunities/${opportunityId}\\?from=`));
  await page.getByRole("link", { name: "← 返回来源列表" }).click();
  await expect(page).toHaveURL(/\/opportunities\?q=AI&coverage_status=partial$/);
  await expect(page.getByLabel("机会名称")).toHaveValue("AI");
});

test("opportunity detail tab supports a direct URL", async ({ page }) => {
  await ready(page);
  await page.goto(`/opportunities/${opportunityId}?tab=evidence`);
  await expect(page.getByRole("button", { name: "证据", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByText("Example News")).toBeVisible();
});

test("opportunity evidence uses progressive batches instead of rendering every record", async ({
  page,
}) => {
  const manyEvidence = Array.from({ length: 45 }, (_, index) => ({
    ...evidence[index % evidence.length],
    id: `evidence-${index + 1}`,
    title: `证据记录 ${index + 1}`,
    canonical_url: `https://example.test/evidence-${index + 1}`,
    observed_at: new Date(Date.UTC(2026, 7, 8, 0, 0, 45 - index)).toISOString(),
  }));
  await ready(page, manyEvidence);
  await page.goto(`/opportunities/${opportunityId}?tab=evidence`);
  const evidencePanel = page.locator(".opportunity-evidence");
  await expect(evidencePanel.locator(":scope > a")).toHaveCount(20);
  await expect(evidencePanel.getByText("已显示 20 / 45 条")).toBeVisible();
  await evidencePanel.getByRole("button", { name: "继续显示 20 条（剩余 25 条）" }).click();
  await expect(evidencePanel.locator(":scope > a")).toHaveCount(40);
  await evidencePanel.getByRole("button", { name: "继续显示 5 条（剩余 5 条）" }).click();
  await expect(evidencePanel.locator(":scope > a")).toHaveCount(45);
  await evidencePanel.getByRole("button", { name: "收起到最新 20 条" }).click();
  await expect(evidencePanel.locator(":scope > a")).toHaveCount(20);
});
