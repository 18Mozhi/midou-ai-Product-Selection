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
  trend_score: 88,
  competition_score: 82,
  profit_status: "calculated",
  risk_level: "low",
  evidence_count: 8,
  source_count: 3,
  competitor_count: 5,
  supplier_candidate_count: 4,
  matched_rule_count: 1,
  selection_stage: "recommended",
  quality_gates: {
    score: true,
    market: true,
    competition: true,
    cost: true,
    risk: true,
    all_passed: true,
  },
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

async function ready(
  page: Page,
  detailEvidence = evidence,
  detailOverrides: Record<string, unknown> = {},
) {
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
  await page.route("**/api/v1/opportunity-score-rules", (route) =>
    route.fulfill({
      json: envelope([
        {
          id: "score-rule",
          status: "active",
          dimensions: [
            { code: "market", weight: 25, evidence_group: "market" },
            { code: "competition", weight: 25, evidence_group: "competition" },
            { code: "cost", weight: 25, evidence_group: "cost" },
            { code: "risk", weight: 25, evidence_group: "risk" },
          ],
        },
      ]),
    }),
  );
  await page.route("**/api/v1/cost-rules", (route) =>
    route.fulfill({
      json: envelope([
        {
          id: "cost-rule",
          status: "active",
          platform: "amazon",
          fee_lines: [{ type: "logistics", currency: "USD" }],
          conversion_rates: [{ base_currency: "CNY", quote_currency: "USD" }],
          automatic_scope: { product_family: "phone_case" },
        },
      ]),
    }),
  );
  await page.route("**/api/v1/competitor-monitor-rules", (route) =>
    route.fulfill({ json: envelope([{ id: "competitor-rule", status: "enabled" }]) }),
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          ...base,
          selection_stage: "rule_candidate",
          quality_gates: {
            score: false,
            market: false,
            competition: false,
            cost: false,
            risk: false,
            all_passed: false,
          },
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
              next_action:
                "运行规则的独立来源门槛已满足，当前为规则命中候选；系统正在完成五项质量门校验。",
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
          ...detailOverrides,
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

const nextOpportunityId = "00000000-0000-4000-8000-000000000432";
const nextOpportunity = {
  ...recommendedBase,
  id: nextOpportunityId,
  name: "当前机会：防晒产品趋势",
  source_ref_id: "00000000-0000-4000-8000-000000000433",
  lineage: {
    freshness: { observed_at: "2026-08-08T00:00:00.000Z", age_seconds: 60 },
    failure_impact: { level: "healthy", codes: [], affected_stages: [] },
    request_ids: ["current-opportunity-request"],
    trace_ids: ["current-opportunity-trace"],
    nodes: [],
  },
  operating_feedback: { facts: [], calibration: null },
  adoption_blockers: [],
  redecision_ready: false,
  evidence: [],
  decisions: [],
  section_status: {
    market: "covered",
    competition: "covered",
    profit: "covered",
    risk: "covered",
    execution: "not_available",
  },
};

async function readyForNextOpportunity(page: Page, analyses: any[] = []) {
  await page.route(`**/api/v1/opportunities/${nextOpportunityId}`, (route) =>
    route.fulfill({ json: envelope(nextOpportunity) }),
  );
  await page.route(`**/api/v1/opportunities/${nextOpportunityId}/profit-analysis`, (route) =>
    route.fulfill({ json: envelope({ latest_run: null, current_inputs: [] }) }),
  );
  await page.route(`**/api/v1/opportunities/${nextOpportunityId}/ai-analyses`, (route) =>
    route.fulfill({ json: envelope(analyses) }),
  );
}

async function switchOpportunityInPlace(page: Page, id: string, query = "") {
  await page.evaluate(
    (opportunityId) => {
      const [id, query = ""] = opportunityId.split("?");
      window.history.pushState({}, "", `/opportunities/${id}${query ? `?${query}` : ""}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    `${id}${query ? `?${query.replace(/^\?/, "")}` : ""}`,
  );
}

async function openDetailTab(page: Page, label: string) {
  const mobileDirectory = page.locator(".opportunity-detail-directory-mobile");
  if ((page.viewportSize()?.width ?? 0) <= 900) {
    const isOpen = await mobileDirectory.evaluate(
      (element) => (element as HTMLDetailsElement).open,
    );
    if (!isOpen) await mobileDirectory.locator("summary").click();
  }
  await page.getByRole("button", { name: label }).click();
}

test("M04-02.A07/A08/A15 opportunity list and creation are responsive and truthful", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/opportunities?create=1");
  await expect(page.getByRole("heading", { name: "待我采纳", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "1 个商品建议采纳" })).toBeVisible();
  await expect(page.locator(".opportunity-row-select")).toHaveCount(0);
  const dialog = page.getByRole("dialog", { name: "创建机会候选" });
  await expect(dialog).toBeVisible();
  const createClose = dialog.getByRole("button", { name: "关闭" });
  const createSubmit = dialog.getByRole("button", { name: "创建机会", exact: true });
  await expect(createClose).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(createSubmit).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(createClose).toBeFocused();
  await dialog.getByRole("button", { name: "关闭" }).click();
  await expect(page.getByRole("heading", { name: "自动推荐配置已就绪" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "自动推荐规则配置进度" })).toHaveAttribute(
    "aria-valuenow",
    "5",
  );
  await page.getByText("查看五项配置状态", { exact: true }).click();
  await expect(page.locator(".automatic-selection-readiness__details li")).toHaveCount(5);
  const createSelection = page.getByRole("link", { name: "创建选品 →" });
  const manageSelectionRules = page.getByRole("link", { name: "管理选品规则" });
  await expect(createSelection).toHaveAttribute("href", "/opportunities/start");
  const [primaryBackground, secondaryBackground] = await Promise.all([
    createSelection.evaluate((element) => getComputedStyle(element).backgroundColor),
    manageSelectionRules.evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  expect(primaryBackground).not.toBe(secondaryBackground);
  expect(secondaryBackground).toBe("rgba(0, 0, 0, 0)");
  if ((page.viewportSize()?.width ?? 0) <= 760)
    await page.getByRole("button", { name: "高级筛选" }).click();
  await page.getByLabel("证据完整度").selectOption("partial");
  const filterButton = page.getByRole("button", { name: "筛选", exact: true });
  if ((page.viewportSize()?.width ?? 0) > 760)
    await expect(filterButton).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const filtered = page.waitForRequest(
    (request) =>
      request.url().includes("/api/v1/opportunities?") &&
      request.url().includes("coverage_status=partial"),
  );
  await filterButton.click();
  await filtered;
  await expect(manageSelectionRules).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(manageSelectionRules).toHaveCSS("background-image", "none");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
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

test("a late create success does not close or navigate away from a reopened create dialog", async ({
  page,
}) => {
  await ready(page);
  let releaseCreate!: () => void;
  let markCreateStarted!: () => void;
  const createStarted = new Promise<void>((resolve) => {
    markCreateStarted = resolve;
  });
  const createGate = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });
  const createdId = "00000000-0000-4000-8000-000000000432";
  await page.route("**/api/v1/opportunities", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    markCreateStarted();
    await createGate;
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(envelope({ ...base, id: createdId, name: "第一个草稿" })),
    });
  });

  await page.goto("/opportunities?view=all&create=1");
  const dialog = page.getByRole("dialog", { name: "创建机会候选" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("机会名称").fill("第一个草稿");
  await dialog.getByRole("button", { name: "创建机会", exact: true }).click();
  await createStarted;

  await dialog.getByRole("button", { name: "关闭" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "手工添加", exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("机会名称").fill("第二个草稿");

  releaseCreate();

  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/opportunities\?view=all&create=1$/u);
  await expect(dialog.getByLabel("机会名称")).toHaveValue("第二个草稿");
  await expect(dialog.getByRole("link", { name: "查看已创建机会" })).toHaveAttribute(
    "href",
    `/opportunities/${createdId}`,
  );
  await dialog.getByLabel("机会名称").fill("第一个草稿");
  await expect(
    dialog.getByRole("button", { name: "内容已创建，请修改后再提交", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("机会名称").fill("第二个草稿");
  await expect(dialog.getByRole("button", { name: "创建机会", exact: true })).toBeEnabled();
});

test("opportunity list distinguishes a failed product image from one not yet collected", async ({
  page,
}) => {
  await ready(page);
  await page.route("**/api/v1/opportunities?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        envelope(
          [
            { ...recommendedBase, image_url: "/fixtures/opportunity-image-error.png" },
            {
              ...recommendedBase,
              id: "00000000-0000-4000-8000-000000000432",
              name: "尚未采集主图的机会",
              image_url: null,
            },
          ],
          { page: 1, page_size: 20, total: 2 },
        ),
      ),
    }),
  );
  await page.route("**/fixtures/opportunity-image-error.png", (route) =>
    route.fulfill({ status: 404, contentType: "image/png", body: "" }),
  );

  await page.goto("/opportunities");

  await expect(page.getByRole("img", { name: "商品主图加载失败" })).toBeVisible();
  await expect(page.getByRole("img", { name: "商品主图待采集" })).toBeVisible();
  await expect(page.getByRole("img", { name: `${recommendedBase.name} 商品图` })).toHaveCount(0);
});

test("M04-02.A07/A08/A15 opportunity detail directory and reason-required decision preserve missing states", async ({
  page,
}) => {
  await ready(page);
  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: "AI 驱动的个性化护肤机会" })).toBeVisible();
  await expect(page.getByText("机会详情", { exact: true })).toHaveCount(1);
  await expect(page.getByText("来源 热点自动发现")).toBeVisible();
  const decisionSurface = page.locator(".opportunity-decision-summary");
  await expect(decisionSurface).toHaveCSS("border-radius", "0px");
  await expect(decisionSurface).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const mobileDirectory = page.locator(".opportunity-detail-directory-mobile");
  if ((page.viewportSize()?.width ?? 0) <= 900) {
    await expect(mobileDirectory).toBeVisible();
    await expect(mobileDirectory).not.toHaveAttribute("open", "");
    await mobileDirectory.locator("summary").click();
  } else {
    await expect(page.locator(".opportunity-detail-directory")).toBeVisible();
    await expect(page.locator(".opportunity-detail-directory-mobile")).toBeHidden();
  }
  await expect(page.locator("body")).not.toContainText(
    /trend_topic|insufficient_data|\bpartial\b|\bunknown\b/,
  );
  await expect(page.locator(".opportunity-detail-directory nav button")).toHaveText([
    "01 结论",
    "02 证据",
    "03 利润与成本",
    "04 风险",
    "05 市场",
    "06 竞争",
    "07 AI 辅助",
    "08 业务血缘",
    "09 经营复盘",
    "10 决策历史",
  ]);
  await expect(page.locator(".opportunity-detail-directory-mobile nav button")).toHaveCount(10);
  await expect(page.getByText("尚无评分运行；缺失输入不会用默认值补齐。")).toBeVisible();
  await expect(page.getByText("0/5 已通过", { exact: true })).toBeVisible();
  await expect(page.getByText("当前无需你处理", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "采纳建议" })).toHaveCount(0);
  await page.getByText("查看每项判断", { exact: true }).click();
  await expect(page.getByRole("list", { name: "五项质量门" })).toContainText(
    "评分待完成市场待完成竞争待完成成本待完成风险待完成",
  );
  await expect(
    page.getByText(
      "运行规则的独立来源门槛已满足，当前为规则命中候选；系统正在完成五项质量门校验。",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "业务血缘" }).click();
  await expect(page.getByRole("heading", { name: "业务血缘追踪" })).toBeVisible();
  await expect(page.getByText("部分环节降级", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "经营复盘" }).click();
  await expect(page.getByRole("heading", { name: "决策后反馈" })).toBeVisible();
  await expect(page.getByText("尚无已返回的经营复盘记录。", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "利润与成本" }).click();
  await expect(page.getByText("数据不足，不能生成可靠 ROI")).toBeVisible();
  await page.getByRole("button", { name: "证据", exact: true }).click();
  await expect(page.getByText("Example News")).toBeVisible();
  await page.getByText("提前人工处理", { exact: true }).click();
  await page.getByRole("button", { name: "继续观察", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "记录继续观察决定" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("原因（必填）").fill("补齐成本与竞品后再判断");
  await dialog.getByRole("button", { name: "确认记录" }).click();
  await expect(page.getByText("决策已记录；原始评分与证据未被改写。")).toBeVisible();
  if (
    (await mobileDirectory.isVisible()) &&
    !(await mobileDirectory.evaluate((element) => (element as HTMLDetailsElement).open))
  ) {
    await mobileDirectory.locator("summary").click();
  }
  await page.getByRole("button", { name: "决策历史" }).click();
  await expect(page.getByText("补齐成本与竞品后再判断")).toBeVisible();
  await expect(
    page.locator(".opportunity-decisions").getByText("继续观察", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /\bobserve\b|trend_topic|insufficient_data|\bpartial\b|\bunknown\b/,
  );
  if (await mobileDirectory.isVisible()) await mobileDirectory.locator("summary").click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("m04-02-opportunity-detail.png", { fullPage: true });
  if ((page.viewportSize()?.width ?? 0) <= 640) {
    await expect(page.locator(".opportunity-decision-waiting")).toHaveCSS("position", "static");
  }
});

test("P18 lineage preserves raw status and unknown age while feedback uses the same idempotency key after an unknown write", async ({
  page,
}) => {
  const fact = {
    id: "00000000-0000-4000-8000-000000000433",
    period_start: "2026-08-01",
    period_end: "2026-08-07",
    sales_units: 8,
    revenue_amount: 120,
    ad_spend_amount: 30,
    returned_units: 0,
    purchase_lead_time_days: 12,
    actual_profit_amount: -8,
    currency: "USD",
    source_ref: "ERP-REPORT-28",
    notes: "扣除额外履约成本后为负值。",
    score_rule_version_snapshot: "score-v6",
    profit_rule_version_snapshot: "profit-v4",
    decision_status_snapshot: "observing",
    predicted_profit_amount: null,
    predicted_currency: null,
    quoted_lead_time_days: null,
    observed_at: "2026-08-08T02:00:00.000Z",
    request_id: "feedback-request-old",
    trace_id: "feedback-trace-old",
    created_at: "2026-08-08T02:01:00.000Z",
  };
  const initialFeedback = {
    facts: [fact],
    calibration: {
      fact_id: fact.id,
      return_rate_percent: 0,
      ad_spend_ratio_percent: 25.5,
      profit_variance_amount: -8,
      profit_variance_currency: "USD",
      lead_time_variance_days: 0,
      score_rule_version: "score-v6",
      profit_rule_version: "profit-v4",
      decision_status_snapshot: "observing",
      human_review_required: true,
      automatic_rule_update: false,
      automatic_decision: false,
    },
  };
  await ready(page, evidence, {
    lineage: {
      freshness: { observed_at: evidence[0].observed_at, age_seconds: null },
      failure_impact: {
        level: "blocked",
        codes: ["failed_terminal:parser_failed"],
        affected_stages: ["collection_task"],
      },
      request_ids: [],
      trace_ids: [],
      nodes: [
        {
          kind: "collection_task",
          id: "00000000-0000-4000-8000-000000000432",
          label: "供应来源采集",
          status: "failed_terminal:parser_failed",
          occurred_at: "2026-08-08T02:00:00.000Z",
          request_id: null,
          trace_id: null,
          route: "/collection-tasks?task_id=00000000-0000-4000-8000-000000000432",
        },
      ],
    },
    operating_feedback: initialFeedback,
  });

  const idempotencyKeys: string[] = [];
  const submittedBodies: Array<Record<string, unknown>> = [];
  await page.route(`**/api/v1/opportunities/${opportunityId}/operating-feedback`, async (route) => {
    idempotencyKeys.push(route.request().headers()["idempotency-key"] ?? "");
    submittedBodies.push(route.request().postDataJSON());
    if (idempotencyKeys.length === 1)
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: "service_unavailable",
            message: "暂不可用",
            action_hint: "服务端提交结果尚未确认。",
          },
          request_id: "feedback-write-unknown",
          trace_id: "feedback-write-unknown",
        },
      });
    return route.fulfill({
      status: 201,
      json: envelope({
        facts: [
          fact,
          { ...fact, id: "00000000-0000-4000-8000-000000000434", source_ref: "ERP-NEW-29" },
        ],
        calibration: null,
      }),
    });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await openDetailTab(page, "业务血缘");
  await expect(page.getByText("距今时间未提供")).toBeVisible();
  await expect(page.getByText("failed_terminal:parser_failed", { exact: true })).toHaveCount(2);
  await openDetailTab(page, "经营复盘");
  await expect(page.getByText("0%", { exact: true })).toBeVisible();
  await expect(page.getByText("25.5%", { exact: true })).toBeVisible();
  await expect(page.getByText("-8 USD", { exact: true })).toHaveCount(2);
  await expect(page.getByText("0 天", { exact: true })).toBeVisible();
  await page.getByText("不可变快照与审计链路", { exact: true }).click();
  await expect(page.getByText("score-v6", { exact: true })).toBeVisible();
  await expect(page.getByText("feedback-trace-old", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "录入经营复盘" }).click();
  await page.getByLabel("周期开始").fill("2026-08-08");
  await page.getByLabel("周期结束").fill("2026-08-14");
  await page.getByRole("spinbutton", { name: "实际销量 按本周期实际销售件数填写。" }).fill("5");
  await page.getByLabel("实际销售额").fill("95");
  await page.getByLabel("实际广告花费").fill("12");
  await page.getByRole("spinbutton", { name: "实际退货量 不能高于实际销量。" }).fill("1");
  await page.getByLabel("实际采购交期（天）").fill("14");
  await page.getByLabel("实际利润").fill("-3");
  await page.getByRole("textbox", { name: "币种 提交时按接口合同转为大写。" }).fill("USD");
  await page.getByLabel("事实来源").fill("ERP-NEW-29");
  await page.getByRole("button", { name: "提交新的经营事实" }).click();
  await expect(page.getByRole("alert")).toContainText("提交结果暂未确认");
  await expect(page.getByLabel("事实来源")).toBeDisabled();
  await page.getByRole("button", { name: "使用同一请求标识恢复提交" }).click();
  await expect(page.locator(".opportunity-message")).toContainText("经营复盘事实已写入");
  await expect(page.locator(".opportunity-feedback-facts")).toContainText("ERP-NEW-29");
  expect(idempotencyKeys).toHaveLength(2);
  expect(idempotencyKeys[0]).toBeTruthy();
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
  expect(submittedBodies[1]).toEqual(submittedBodies[0]);
});

test("P18 expired detail state routes to login with the current opportunity as a safe return target", async ({
  page,
}) => {
  await ready(page);
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (route) =>
    route.fulfill({
      status: 401,
      json: { error: { code: "authentication_required", message: "登录已失效" } },
    }),
  );

  await page.goto(`/opportunities/${opportunityId}?tab=overview`);
  await expect(page.getByRole("heading", { name: "登录已失效" })).toBeVisible();
  await page.getByRole("button", { name: "重新登录" }).click();
  await expect(page).toHaveURL(/\/login\?/);
  const loginUrl = new URL(page.url());
  expect(loginUrl.searchParams.get("reason")).toBe("authentication_required");
  expect(loginUrl.searchParams.get("redirect")).toBe(
    `/opportunities/${opportunityId}?tab=overview`,
  );
});

test("P18 forbidden detail state returns to the opportunity list without retrying the denied request", async ({
  page,
}) => {
  await ready(page);
  let detailReads = 0;
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (route) => {
    detailReads += 1;
    return route.fulfill({
      status: 403,
      json: { error: { code: "forbidden", message: "当前账号不能查看这条机会" } },
    });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: "你没有此项权限" })).toBeVisible();
  await expect(page.getByRole("button", { name: "申请权限" })).toHaveCount(0);
  await page.getByRole("button", { name: "返回机会列表" }).click();
  await expect(page).toHaveURL(/\/opportunities$/);
  await expect(page.getByRole("link", { name: new RegExp(base.name) })).toBeVisible();
  expect(detailReads).toBe(1);
});

test("P18 blocked detail state offers a real retry and a separate list return", async ({
  page,
}) => {
  await ready(page);
  let detailReads = 0;
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (route) => {
    detailReads += 1;
    if (detailReads <= 3)
      return route.fulfill({
        status: 503,
        json: { error: { code: "temporarily_unavailable", message: "依赖暂时不可用" } },
      });
    return route.fallback();
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: "依赖暂时受阻" })).toBeVisible();
  expect(detailReads).toBe(3);
  await expect(page.getByRole("button", { name: "返回机会列表" })).toBeVisible();
  await page.getByRole("button", { name: "稍后重试" }).click();
  await expect(page.getByRole("heading", { name: base.name })).toBeVisible();
  expect(detailReads).toBe(4);
});

test("P18 insight reads fail and recover independently without hiding competitor facts", async ({
  page,
}) => {
  await ready(page);
  await page.route("**/api/v1/me/navigation?shell=member", (route) =>
    route.fulfill({
      json: envelope({
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
          "competitor:read",
          "sourcing:read",
        ],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );

  const competitor = {
    id: "00000000-0000-4000-8000-000000000440",
    opportunity_id: opportunityId,
    market: "US",
    source_site: "amazon",
    external_id: "B000000440",
    title: "当前机会关联竞品",
    snapshot_count: 1,
    latest_snapshot: {
      current_price: 0,
      currency: "USD",
      review_count: 0,
      rating_value: 0,
      captured_at: "2026-08-08T00:00:00.000Z",
      freshness: "fresh",
    },
  };
  let competitorReads = 0;
  let sourcingReads = 0;
  let allowSourcingRecovery = false;
  await page.route("**/api/v1/competitors", (route) => {
    competitorReads += 1;
    return route.fulfill({ json: envelope([competitor]) });
  });
  await page.route("**/api/v1/sourcing/searches*", (route) => {
    sourcingReads += 1;
    return route.fulfill(
      !allowSourcingRecovery
        ? { status: 503, json: { error: { code: "temporarily_unavailable" } } }
        : { json: envelope([]) },
    );
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByText("1 个关联竞品", { exact: false })).toBeVisible();
  await expect(
    page.getByText("供应链读取未完成；已成功读取的竞品事实会继续单独显示。", { exact: true }),
  ).toBeVisible();
  const competitorReadsBeforeRetry = competitorReads;
  allowSourcingRecovery = true;
  await page.getByRole("button", { name: "重试读取供应候选" }).click();
  await expect(page.getByText(/0 个关联搜索 · 0 个候选/)).toBeVisible();
  expect(sourcingReads).toBeGreaterThanOrEqual(2);
  expect(competitorReads).toBe(competitorReadsBeforeRetry);
  await page.goto(`/opportunities/${opportunityId}?tab=competition`);
  await expect(page.getByText("当前机会关联竞品", { exact: true })).toBeVisible();
  await expect(page.getByText("USD 0", { exact: true })).toBeVisible();
});

test("P18 insight sections distinguish unavailable permissions from empty facts", async ({
  page,
}) => {
  await ready(page);
  let competitorReads = 0;
  let sourcingReads = 0;
  await page.route("**/api/v1/competitors", (route) => {
    competitorReads += 1;
    return route.fulfill({ json: envelope([]) });
  });
  await page.route("**/api/v1/sourcing/searches*", (route) => {
    sourcingReads += 1;
    return route.fulfill({ json: envelope([]) });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await expect(
    page.getByText("当前角色没有竞品读取权限；页面不请求或展示竞品明细。", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("当前角色没有供应链读取权限；页面不请求或展示供应搜索数据。", { exact: true }),
  ).toBeVisible();
  expect(competitorReads).toBe(0);
  expect(sourcingReads).toBe(0);

  await page.goto(`/opportunities/${opportunityId}?tab=market`);
  await expect(page.getByRole("heading", { name: "先看证据，再判断市场" })).toBeVisible();
  await expect(
    page.getByText("不能据此断定全部证据都是趋势信号，或需求已验证、市场规模/增长率已知。", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto(`/opportunities/${opportunityId}?tab=risk`);
  await expect(page.getByRole("heading", { name: "风险等级，不等于完整评估" })).toBeVisible();
  await expect(page.getByText("当前响应没有提供逐项风险评估事实", { exact: true })).toBeVisible();
});

test("P18 observe and reject dialogs contain keyboard focus and return it on Escape", async ({
  page,
}) => {
  await ready(page);
  await page.goto(`/opportunities/${opportunityId}`);
  await page.getByText("提前人工处理", { exact: true }).click();

  const decisionWrites: string[] = [];
  const onRequest = (request: import("@playwright/test").Request) => {
    if (
      request.url().includes(`/api/v1/opportunities/${opportunityId}/decisions`) &&
      request.method() === "POST"
    ) {
      decisionWrites.push(request.method());
    }
  };
  page.on("request", onRequest);

  try {
    for (const action of [
      { trigger: "继续观察", dialog: "记录继续观察决定" },
      { trigger: "驳回", dialog: "记录驳回决定" },
    ]) {
      const trigger = page.getByRole("button", { name: action.trigger, exact: true });
      await trigger.focus();
      await page.keyboard.press("Enter");

      const dialog = page.getByRole("dialog", { name: action.dialog });
      await expect(dialog).toBeVisible();
      const close = dialog.getByRole("button", { name: "关闭" });
      const submit = dialog.getByRole("button", { name: "确认记录" });
      await expect(close).toBeFocused();

      await page.keyboard.press("Shift+Tab");
      await expect(submit).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(close).toBeFocused();
      await page.keyboard.press("Escape");

      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    }
    expect(decisionWrites).toEqual([]);
  } finally {
    page.off("request", onRequest);
  }
});

test("opportunity list ignores an older successful read after a newer filter read", async ({
  page,
}) => {
  await ready(page);
  let releaseOlder!: () => void;
  let markOlderStarted!: () => void;
  const olderGate = new Promise<void>((resolve) => (releaseOlder = resolve));
  const olderStarted = new Promise<void>((resolve) => (markOlderStarted = resolve));
  await page.route("**/api/v1/opportunities?*", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query === "older-read") {
      markOlderStarted();
      await olderGate;
      await route.fulfill({
        json: envelope([{ ...recommendedBase, id: "older-opportunity", name: "过期筛选结果" }], {
          page: 1,
          page_size: 20,
          total: 1,
        }),
      });
      return;
    }
    if (query === "newer-read") {
      await route.fulfill({
        json: envelope([{ ...recommendedBase, id: "newer-opportunity", name: "当前筛选结果" }], {
          page: 1,
          page_size: 20,
          total: 1,
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto("/opportunities");
  await expect(page.getByRole("link", { name: new RegExp(base.name) })).toBeVisible();
  const mobile = (page.viewportSize()?.width ?? 0) <= 760;
  const openFilters = async () => {
    if (mobile) await page.getByRole("button", { name: "高级筛选" }).click();
    return mobile
      ? page.getByRole("dialog", { name: "高级筛选" })
      : page.locator(".opportunity-filters");
  };
  const applyQuery = async (value: string) => {
    const filters = await openFilters();
    await filters.getByLabel("机会名称").fill(value);
    await filters.getByRole("button", { name: "筛选", exact: true }).click();
  };

  const olderResponse = page.waitForResponse((response) => response.url().includes("q=older-read"));
  await applyQuery("older-read");
  await olderStarted;
  await expect(page).toHaveURL(/q=older-read/);
  await applyQuery("newer-read");
  await expect(page.getByRole("link", { name: "当前筛选结果" })).toBeVisible();
  releaseOlder();
  await olderResponse;
  await expect(page.getByRole("link", { name: "当前筛选结果" })).toBeVisible();
  await expect(page.getByRole("link", { name: "过期筛选结果" })).toHaveCount(0);
});

test("opportunity detail failure cannot replace the list after navigating away", async ({
  page,
}) => {
  await ready(page);
  let releaseDetail!: () => void;
  let markDetailStarted!: () => void;
  const detailGate = new Promise<void>((resolve) => (releaseDetail = resolve));
  const detailStarted = new Promise<void>((resolve) => (markDetailStarted = resolve));
  await page.route(`**/api/v1/opportunities/${opportunityId}`, async (route) => {
    markDetailStarted();
    await detailGate;
    await route.fulfill({
      status: 503,
      json: { error: { code: "temporarily_unavailable", message: "暂时不可用" } },
    });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await detailStarted;
  await page.getByRole("link", { name: "← 返回来源列表" }).click();
  await expect(page.getByRole("link", { name: new RegExp(base.name) })).toBeVisible();
  const delayedFailure = page.waitForResponse(
    (response) =>
      response.url().includes(`/opportunities/${opportunityId}`) && response.status() === 503,
  );
  releaseDetail();
  await delayedFailure;
  await expect(page.getByRole("link", { name: new RegExp(base.name) })).toBeVisible();
  await expect(page.getByRole("heading", { name: "暂时不可用" })).toHaveCount(0);
});

test("a late opportunity detail success cannot replace the current opportunity after the ID changes", async ({
  page,
}) => {
  await ready(page);
  await readyForNextOpportunity(page);
  let releaseOldDetail!: () => void;
  let markOldDetailStarted!: () => void;
  const oldDetailGate = new Promise<void>((resolve) => (releaseOldDetail = resolve));
  const oldDetailStarted = new Promise<void>((resolve) => (markOldDetailStarted = resolve));
  await page.route(`**/api/v1/opportunities/${opportunityId}`, async (route) => {
    markOldDetailStarted();
    await oldDetailGate;
    await route.fallback();
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await oldDetailStarted;
  const currentDetailRequest = page.waitForRequest((request) =>
    request.url().includes(`/api/v1/opportunities/${nextOpportunityId}`),
  );
  await switchOpportunityInPlace(page, nextOpportunityId);
  await currentDetailRequest;
  await expect(page.getByRole("heading", { name: nextOpportunity.name })).toBeVisible();

  const oldDetailResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/opportunities/${opportunityId}`) &&
      response.request().method() === "GET",
  );
  releaseOldDetail();
  await oldDetailResponse;
  await expect(page.getByRole("heading", { name: nextOpportunity.name })).toBeVisible();
  await expect(page.getByRole("heading", { name: base.name, exact: true })).toHaveCount(0);
});

test("a late opportunity detail failure cannot replace the current opportunity after the ID changes", async ({
  page,
}) => {
  await ready(page);
  await readyForNextOpportunity(page);
  let releaseOldDetail!: () => void;
  let markOldDetailStarted!: () => void;
  const oldDetailGate = new Promise<void>((resolve) => (releaseOldDetail = resolve));
  const oldDetailStarted = new Promise<void>((resolve) => (markOldDetailStarted = resolve));
  await page.route(`**/api/v1/opportunities/${opportunityId}`, async (route) => {
    markOldDetailStarted();
    await oldDetailGate;
    await route.fulfill({
      status: 503,
      json: { error: { code: "temporarily_unavailable", message: "旧机会读取失败" } },
    });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await oldDetailStarted;
  const currentDetailRequest = page.waitForRequest((request) =>
    request.url().includes(`/api/v1/opportunities/${nextOpportunityId}`),
  );
  await switchOpportunityInPlace(page, nextOpportunityId);
  await currentDetailRequest;
  await expect(page.getByRole("heading", { name: nextOpportunity.name })).toBeVisible();

  const oldDetailResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/opportunities/${opportunityId}`) &&
      response.status() === 503,
  );
  releaseOldDetail();
  await oldDetailResponse;
  await expect(page.getByRole("heading", { name: nextOpportunity.name })).toBeVisible();
  await expect(page.getByText("旧机会读取失败", { exact: true })).toHaveCount(0);
});

test("a late profit analysis failure cannot replace the current opportunity after the ID changes", async ({
  page,
}) => {
  await ready(page);
  await readyForNextOpportunity(page);
  let releaseOldProfit!: () => void;
  let markOldProfitStarted!: () => void;
  const oldProfitGate = new Promise<void>((resolve) => (releaseOldProfit = resolve));
  const oldProfitStarted = new Promise<void>((resolve) => (markOldProfitStarted = resolve));
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, async (route) => {
    markOldProfitStarted();
    await oldProfitGate;
    await route.fulfill({
      status: 503,
      json: { error: { code: "temporarily_unavailable", message: "旧机会利润读取失败" } },
    });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await oldProfitStarted;
  const currentDetailRequest = page.waitForRequest((request) =>
    request.url().includes(`/api/v1/opportunities/${nextOpportunityId}`),
  );
  await switchOpportunityInPlace(page, nextOpportunityId);
  await currentDetailRequest;
  await expect(page.getByRole("heading", { name: nextOpportunity.name })).toBeVisible();

  const oldProfitResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/opportunities/${opportunityId}/profit-analysis`) &&
      response.status() === 503,
  );
  releaseOldProfit();
  await oldProfitResponse;
  await expect(page.getByRole("heading", { name: nextOpportunity.name })).toBeVisible();
  await expect(page.getByText("旧机会利润读取失败", { exact: true })).toHaveCount(0);
});

test("profit analysis failure stays local and retries only the profit read", async ({ page }) => {
  await ready(page);
  let profitUnavailable = true;
  let profitReads = 0;
  let detailReads = 0;
  await page.on("request", (request) => {
    if (
      request.method() === "GET" &&
      request.url().includes(`/api/v1/opportunities/${opportunityId}/profit-analysis`)
    )
      profitReads += 1;
    if (
      request.method() === "GET" &&
      new URL(request.url()).pathname === `/api/v1/opportunities/${opportunityId}`
    )
      detailReads += 1;
  });
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) =>
    profitUnavailable
      ? route.fulfill({
          status: 503,
          json: {
            error: {
              code: "temporarily_unavailable",
              message: "利润数据暂不可用",
              action_hint: "请稍后重新读取利润与成本。",
            },
            request_id: "profit-read-failed-request",
            trace_id: "profit-read-failed-trace",
          },
        })
      : route.fulfill({ json: envelope({ latest_run: null, current_inputs: [] }) }),
  );

  await page.goto(`/opportunities/${opportunityId}?tab=profit`);
  await expect(page.getByRole("heading", { name: base.name, level: 1 })).toBeVisible();
  const panel = page.locator(".opportunity-profit");
  await expect(panel.getByRole("alert")).toContainText("利润与成本暂不可用");
  await expect(panel.getByRole("alert")).toContainText("请稍后重新读取利润与成本。");
  await expect(panel.getByRole("alert")).toContainText("profit-read-failed-request");
  const detailReadsBeforeRetry = detailReads;
  const profitReadsBeforeRetry = profitReads;

  profitUnavailable = false;
  await panel.getByRole("button", { name: "重新读取利润数据", exact: true }).click();
  await expect(panel).toContainText("数据不足，不能生成可靠 ROI");
  expect(profitReads).toBe(profitReadsBeforeRetry + 1);
  expect(detailReads).toBe(detailReadsBeforeRetry);
});

test("expired profit analysis response still restores the page-level login state", async ({
  page,
}) => {
  await ready(page);
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) =>
    route.fulfill({
      status: 401,
      json: {
        error: {
          code: "session_expired",
          message: "登录已过期",
          action_hint: "请重新登录后继续。",
        },
        request_id: "expired-profit-request",
        trace_id: "expired-profit-trace",
      },
    }),
  );

  await page.goto(`/opportunities/${opportunityId}?tab=profit`);
  await expect(page.locator(".opportunity-detail")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "重新登录", exact: true })).toBeVisible();
  await expect(page.locator(".ui-state-panel")).toContainText("expired-profit-request");
});

test("a late AI analysis success remains scoped to the opportunity that requested it", async ({
  page,
}) => {
  const analysis = (id: string, summary: string) => ({
    id,
    status: "succeeded",
    attempt_count: 1,
    last_error_code: null,
    created_at: "2026-08-08T00:00:00.000Z",
    input_sha256: "0123456789abcdef0123456789abcdef",
    prompt_contract_version: "v1",
    result: {
      id: `${id}-result`,
      review_status: "approved",
      content: { summary, classifications: [], missing_fields: [] },
      ai_generated: true,
      model_name: "isolated-e2e-model",
      provider_request_id: null,
      review: {
        outcome: "approved",
        notes: "本地测试抽检",
        reviewed_by: "00000000-0000-4000-8000-000000000421",
        reviewed_at: "2026-08-08T01:00:00.000Z",
      },
    },
  });
  await ready(page);
  await readyForNextOpportunity(page, [analysis("current-analysis", "当前机会的 AI 摘要")]);
  let releaseOldAnalysis!: () => void;
  let markOldAnalysisStarted!: () => void;
  const oldAnalysisGate = new Promise<void>((resolve) => (releaseOldAnalysis = resolve));
  const oldAnalysisStarted = new Promise<void>((resolve) => (markOldAnalysisStarted = resolve));
  await page.route(`**/api/v1/opportunities/${opportunityId}/ai-analyses`, async (route) => {
    markOldAnalysisStarted();
    await oldAnalysisGate;
    await route.fulfill({ json: envelope([analysis("old-analysis", "旧机会的迟到 AI 摘要")]) });
  });

  await page.goto(`/opportunities/${opportunityId}?tab=ai`);
  await oldAnalysisStarted;
  const currentDetailRequest = page.waitForRequest((request) =>
    request.url().includes(`/api/v1/opportunities/${nextOpportunityId}`),
  );
  const currentAnalysisResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/opportunities/${nextOpportunityId}/ai-analyses`) &&
      response.status() === 200,
  );
  await switchOpportunityInPlace(page, nextOpportunityId, "tab=ai");
  await currentDetailRequest;
  await currentAnalysisResponse;
  await expect(page.getByRole("heading", { name: nextOpportunity.name, level: 1 })).toBeVisible();
  await openDetailTab(page, "AI 辅助");
  await expect(page.locator(".opportunity-ai")).toBeVisible();
  await expect(page.getByText("当前机会的 AI 摘要", { exact: true })).toBeVisible();

  const oldAnalysisResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/opportunities/${opportunityId}/ai-analyses`) &&
      response.status() === 200,
  );
  releaseOldAnalysis();
  await oldAnalysisResponse;
  await expect(page.getByText("当前机会的 AI 摘要", { exact: true })).toBeVisible();
  await expect(page.getByText("旧机会的迟到 AI 摘要", { exact: true })).toHaveCount(0);
});

test("late competitor data stays scoped to the opportunity that requested it", async ({ page }) => {
  const oldCompetitor = {
      id: "old-competitor",
      opportunity_id: opportunityId,
      market: "US",
      source_site: "amazon",
      external_id: "OLD-ASIN",
      title: "旧机会关联竞品",
      snapshot_count: 0,
      latest_snapshot: null,
    },
    currentCompetitor = {
      ...oldCompetitor,
      id: "current-competitor",
      opportunity_id: nextOpportunityId,
      external_id: "CURRENT-ASIN",
      title: "当前机会关联竞品",
    };
  await ready(page);
  await readyForNextOpportunity(page);
  await page.route("**/api/v1/me/navigation?shell=member", (route) =>
    route.fulfill({
      json: envelope({
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
          "competitor:read",
        ],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  let releaseOldCompetitors!: () => void;
  let markOldCompetitorsStarted!: () => void;
  let competitorReadCount = 0;
  const oldCompetitorsGate = new Promise<void>((resolve) => (releaseOldCompetitors = resolve));
  const oldCompetitorsStarted = new Promise<void>(
    (resolve) => (markOldCompetitorsStarted = resolve),
  );
  await page.route("**/api/v1/competitors", async (route) => {
    competitorReadCount += 1;
    if (competitorReadCount === 1) {
      markOldCompetitorsStarted();
      await oldCompetitorsGate;
      await route.fulfill({ json: envelope([oldCompetitor]) });
      return;
    }
    await route.fulfill({ json: envelope([currentCompetitor]) });
  });

  await page.goto(`/opportunities/${opportunityId}?tab=competition`);
  await oldCompetitorsStarted;
  const currentDetailRequest = page.waitForRequest((request) =>
    request.url().includes(`/api/v1/opportunities/${nextOpportunityId}`),
  );
  await switchOpportunityInPlace(page, nextOpportunityId, "tab=competition");
  await currentDetailRequest;
  await expect(page.getByText("当前机会关联竞品", { exact: true })).toBeVisible();

  const oldCompetitorsResponse = page.waitForResponse(
    (response) => response.url().includes("/api/v1/competitors") && response.status() === 200,
  );
  releaseOldCompetitors();
  await oldCompetitorsResponse;
  await expect(page.getByText("当前机会关联竞品", { exact: true })).toBeVisible();
  await expect(page.getByText("旧机会关联竞品", { exact: true })).toHaveCount(0);
});

test("a delayed decision receipt cannot close a newer decision dialog", async ({ page }) => {
  await ready(page);
  let releaseDecision!: () => void;
  let markDecisionStarted!: () => void;
  const decisionGate = new Promise<void>((resolve) => (releaseDecision = resolve));
  const decisionStarted = new Promise<void>((resolve) => (markDecisionStarted = resolve));
  await page.route(`**/api/v1/opportunities/${opportunityId}/decisions`, async (route) => {
    markDecisionStarted();
    await decisionGate;
    await route.fulfill({
      status: 201,
      json: envelope({ opportunity_id: opportunityId, decision_status: "observing", version: 2 }),
    });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: base.name })).toBeVisible();
  await page.getByText("提前人工处理", { exact: true }).click();
  await page.getByRole("button", { name: "继续观察", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "记录继续观察决定" });
  await dialog.getByLabel("原因（必填）").fill("离页前已提交的决定");
  await dialog.getByRole("button", { name: "确认记录" }).click();
  await decisionStarted;

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "驳回", exact: true }).last().click();
  const rejectedDialog = page.getByRole("dialog", { name: "记录驳回决定" });
  await expect(rejectedDialog).toBeVisible();
  const decisionResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/v1/opportunities/${opportunityId}/decisions`),
  );
  releaseDecision();
  await decisionResponse;
  await page.waitForLoadState("networkidle");
  await expect(rejectedDialog).toBeVisible();
  await expect(rejectedDialog.getByLabel("原因（必填）")).toHaveValue("");
});

test("mobile opportunity filters preserve selected adoption blocker inside the drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.goto("/opportunities");
  const filterTrigger = page.getByRole("button", { name: /高级筛选/ });
  await filterTrigger.click();
  const drawer = page.getByRole("dialog", { name: "高级筛选" });
  await expect(drawer).toHaveCSS("width", "390px");
  await expect(drawer).toHaveCSS("height", "844px");
  await expect(drawer).toHaveCSS("border-radius", "0px");
  await expect(drawer).toHaveCSS("box-shadow", "none");
  const actionDock = drawer.locator(".opportunity-filter-actions");
  await expect(actionDock).toHaveCSS("position", "fixed");
  await expect(actionDock).toHaveCSS("display", "grid");
  await expect
    .poll(() => actionDock.evaluate((element) => element.getBoundingClientRect().bottom))
    .toBe(844);
  await drawer.getByLabel("阻断原因").selectOption("recommendation_insufficient");
  await expect(filterTrigger).not.toContainText("1 项已选");
  await drawer.getByRole("button", { name: "关闭筛选条件" }).click();
  await filterTrigger.click();
  await expect(drawer.getByLabel("阻断原因")).toHaveValue("recommendation_insufficient");
  await expect(filterTrigger).not.toContainText("1 项已选");
  const filtered = page.waitForRequest((request) =>
    request.url().includes("blocking_reason=recommendation_insufficient"),
  );
  await drawer.getByRole("button", { name: "筛选", exact: true }).click();
  await filtered;
  await expect(page).toHaveURL(/blocking_reason=recommendation_insufficient/);
  await expect(filterTrigger).toContainText("1 项已选");
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
  const queueButtons = page.locator(".opportunity-view-bar > nav button");
  await expect(queueButtons).toHaveCount(4);
  if ((page.viewportSize()?.width ?? 0) > 760) {
    await expect
      .poll(() =>
        queueButtons.evaluateAll((buttons) =>
          buttons.every((button) => {
            const bounds = button.getBoundingClientRect();
            const target = document.elementFromPoint(
              bounds.left + bounds.width / 2,
              bounds.top + bounds.height / 2,
            );
            return Boolean(target && (button === target || button.contains(target)));
          }),
        ),
      )
      .toBe(true);
  }

  const ruleCandidates = page.waitForRequest((request) =>
    request.url().includes("selection_view=rule_candidates"),
  );
  await page.getByRole("button", { name: "规则命中候选" }).click();
  await ruleCandidates;
  await expect(page).toHaveURL(/view=rule_candidates/);
  await expect(page.getByRole("heading", { name: "规则命中候选", level: 2 })).toBeVisible();

  const evidencePending = page.waitForRequest((request) =>
    request.url().includes("selection_view=evidence_pending"),
  );
  await page.getByRole("button", { name: "采集中" }).click();
  await evidencePending;
  await expect(page).toHaveURL(/view=evidence_pending/);
  await expect(page.getByRole("heading", { name: "采集中", level: 2 })).toBeVisible();

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
  const directory = page.locator(
    (page.viewportSize()?.width ?? 0) <= 900
      ? ".opportunity-detail-directory-mobile"
      : ".opportunity-detail-directory",
  );
  if ((page.viewportSize()?.width ?? 0) <= 900) await directory.locator("summary").click();
  await expect(directory.getByRole("button", { name: "证据", exact: true })).toHaveAttribute(
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
