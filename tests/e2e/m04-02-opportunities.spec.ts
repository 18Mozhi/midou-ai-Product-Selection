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

async function readyForNextOpportunity(page: Page) {
  await page.route(`**/api/v1/opportunities/${nextOpportunityId}`, (route) =>
    route.fulfill({ json: envelope(nextOpportunity) }),
  );
  await page.route(`**/api/v1/opportunities/${nextOpportunityId}/profit-analysis`, (route) =>
    route.fulfill({ json: envelope({ latest_run: null, current_inputs: [] }) }),
  );
  await page.route(`**/api/v1/opportunities/${nextOpportunityId}/ai-analyses`, (route) =>
    route.fulfill({ json: envelope([]) }),
  );
}

async function switchOpportunityInPlace(page: Page, id: string) {
  await page.evaluate((opportunityId) => {
    window.history.pushState({}, "", `/opportunities/${opportunityId}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, id);
}

test("M04-02.A07/A08/A15 opportunity list and creation are responsive and truthful", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/opportunities?create=1");
  await expect(page.getByRole("heading", { name: "待我采纳", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "1 个商品建议采纳" })).toBeVisible();
  await expect(page.locator(".opportunity-row-select")).toHaveCount(0);
  const dialog = page.getByRole("dialog");
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
  const dialog = page.getByRole("dialog");
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
  await page.getByText("提前人工处理", { exact: true }).click();
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
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("m04-02-opportunity-detail.png", { fullPage: true });
  if ((page.viewportSize()?.width ?? 0) <= 640) {
    await expect(page.locator(".opportunity-decision-waiting")).toHaveCSS("position", "static");
  }
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
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("原因（必填）").fill("离页前已提交的决定");
  await dialog.getByRole("button", { name: "确认记录" }).click();
  await decisionStarted;

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "驳回", exact: true }).last().click();
  await expect(dialog).toBeVisible();
  const decisionResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/v1/opportunities/${opportunityId}/decisions`),
  );
  releaseDecision();
  await decisionResponse;
  await page.waitForLoadState("networkidle");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("原因（必填）")).toHaveValue("");
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
