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
  capabilities = [
    "task:read",
    "trend:read",
    "trend:manage",
    "opportunity:read",
    "opportunity:decide",
  ],
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
          capabilities,
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
              next_action: "已识别 Amazon 主品，系统正在补齐评分、市场、竞品、成本与风险证据。",
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

const blockedEvidence = {
  code: "evidence_insufficient",
  status: "blocked",
  progress_percent: 0,
  next_action: "补充同一机会的证据后重新核对。",
  task_id: null,
  task_status: null,
  score_job_status: null,
};

test("completed analysis receipt leads with completion while unknown profit keeps adoption blocked", async ({
  page,
}) => {
  await ready(page, evidence, {
    analysis_completed_at: "2026-10-19T18:01:19.130Z",
    overall_score: 65.85,
    quality_gates: {
      score: false,
      market: true,
      competition: true,
      cost: false,
      risk: true,
      all_passed: false,
    },
    adoption_blockers: [
      {
        ...blockedEvidence,
        code: "recommendation_insufficient",
        next_action: "费用规则未覆盖当前商品类别。",
      },
    ],
  });
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes(`/opportunities/${opportunityId}/`))
      writes.push(r.url());
  });
  await page.goto(`/opportunities/${opportunityId}?from=%2Fopportunities%3Fview%3Dcompleted`);
  const completion = page.locator(".opportunity-analysis-completion");
  await expect(completion).toContainText("分析已完成");
  await expect(completion.locator("time")).toHaveAttribute("datetime", "2026-10-19T18:01:19.130Z");
  const summary = page.locator(".opportunity-decision-summary");
  await expect(summary).toHaveCount(1);
  await expect(summary).toContainText("采纳条件");
  await expect(summary).toContainText("待满足：评分");
  await expect(summary).not.toContainText("下一项：评分");
  await expect(page.getByText("利润未知", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "采纳建议", exact: true })).toHaveCount(0);
  await expect(page.locator(".opportunity-insights")).toBeVisible();
  const panel = (await summary.boundingBox())!,
    insights = (await page.locator(".opportunity-insights").boundingBox())!;
  expect(panel.y + panel.height).toBeLessThanOrEqual(insights.y + 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width + 1,
  );
  expect(writes).toEqual([]);
});

test("a completed return URL without an API receipt cannot claim analysis completion", async ({
  page,
}) => {
  await ready(page);
  await page.goto(`/opportunities/${opportunityId}?from=%2Fopportunities%3Fview%3Dcompleted`);
  await expect(page.getByRole("heading", { name: base.name })).toBeVisible();
  await expect(page.locator(".opportunity-analysis-completion")).toHaveCount(0);
  await expect(page.locator(".opportunity-decision-summary")).toContainText("系统会继续补齐");
  await expect(page.getByRole("button", { name: "采纳建议", exact: true })).toHaveCount(0);
});

test("completed catalogue opens analysis rather than claim ongoing collection", async ({
  page,
}) => {
  await ready(page);
  await page.route("**/api/v1/opportunities?*", (route) =>
    route.fulfill({
      json: envelope(
        [
          {
            ...recommendedBase,
            selection_stage: "rule_candidate",
            recommendation_status: "not_recommend",
            profit_status: "insufficient_data",
          },
        ],
        { page: 1, page_size: 20, total: 1 },
      ),
    }),
  );
  await page.goto("/opportunities?view=completed");
  await expect(
    page.getByRole("link", { name: `查看分析：${recommendedBase.name}`, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "图卡", exact: true })).toHaveCount(0);
  await expect(page.locator(".selection-product-action-cell")).not.toContainText("查看进度");
});

test("historical evidence task retains blocker facts without restoring the retired task surface", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1/tasks")) calls.push(request.url());
  });
  await ready(page, evidence, {
    adoption_blockers: [
      { ...blockedEvidence, task_id: "00000000-0000-4000-8000-000000000434", progress_percent: 35 },
    ],
  });
  await page.goto(`/opportunities/${opportunityId}?tab=overview`);
  await expect(page.getByText("仍有 1 个补证阻断项", { exact: true })).toBeVisible();
  await expect(page.locator('a[href^="/tasks"]')).toHaveCount(0);
  await page.getByText("查看判断条件与补证进度", { exact: true }).click();
  await expect(page.getByText("补采任务进度 35%", { exact: true })).toBeVisible();
  expect(calls).toEqual([]);
});

for (const status of ["blocked", "in_progress"]) {
  test(`automatic evidence ${status} is read-only and never creates a manual task`, async ({
    page,
  }) => {
    const nextAction =
      status === "in_progress"
        ? "已进入自动分析队列，可稍后刷新查看证据状态。"
        : "证据尚未齐备；请检查采集来源和自动分析状态。";
    await ready(page, evidence, {
      adoption_blockers: [{ ...blockedEvidence, status, next_action: nextAction }],
    });
    let taskWrites = 0;
    await page.route(
      `**/api/v1/opportunities/${opportunityId}/evidence-completion-tasks`,
      (route) => {
        taskWrites++;
        return route.abort();
      },
    );
    await page.goto(`/opportunities/${opportunityId}`);
    await expect(page.locator(".opportunity-decision-gap")).toContainText(nextAction);
    await expect(page.getByRole("button", { name: "创建补采任务", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "查看补采任务", exact: true })).toHaveCount(0);
    await page.getByText("查看判断条件与补证进度", { exact: true }).click();
    await expect(page.locator(".opportunity-blocker-details article")).toHaveAttribute(
      "data-status",
      status,
    );
    expect(taskWrites).toBe(0);
    expect(new URL(page.url()).pathname).toBe(`/opportunities/${opportunityId}`);
  });
}

const nextOpportunityId = "00000000-0000-4000-8000-000000000432";
const nextOpportunity = {
  ...recommendedBase,
  id: nextOpportunityId,
  name: "当前机会：防晒产品趋势",
  source_ref_id: "00000000-0000-4000-8000-000000000433",
  adoption_blockers: [],
  score_components: [],
  latest_score_run: null,
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

test("M04-02.A07/A08/A15 automatic opportunity list ignores retired creation and stays responsive", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/opportunities?create=1");
  await expect(page.getByRole("button", { name: "已完成分析", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("heading", { name: "1 个商品已完成分析" })).toBeVisible();
  await expect(page.locator(".opportunity-row-select")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "创建机会候选" })).toHaveCount(0);
  await expect(page.locator(".catalogue-readiness")).toHaveCount(0);
  await expect(page.getByRole("search", { name: "搜索商品" })).toBeVisible();
  await expect(page.getByRole("link", { name: "管理选品规则" })).toHaveCount(0);
  await expect(page.locator('a[href="/opportunities/start"]')).toHaveCount(0);
  await page.getByRole("button", { name: "高级筛选", exact: true }).click();
  await page.getByLabel("证据完整度").selectOption("partial");
  const filterButton = page.getByRole("button", { name: "筛选", exact: true });
  expect((await filterButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const filtered = page.waitForRequest(
    (request) =>
      request.url().includes("/api/v1/opportunities?") &&
      request.url().includes("coverage_status=partial"),
  );
  await filterButton.click();
  await filtered;
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot("catalogue-data-list-first-screen-20261019.png", {
    fullPage: true,
  });
  await page.getByRole("button", { name: "全部商品" }).click();
  await expect(page.locator(".opportunity-row-select")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "手工添加", exact: true })).toHaveCount(0);
});

for (const kind of ["empty", "error"] as const) {
  test(`catalogue ${kind} state stays compact and preserves a usable retry`, async ({ page }) => {
    await ready(page);
    let reads = 0;
    await page.route("**/api/v1/opportunities?*", (route) => {
      reads += 1;
      return route.fulfill(
        kind === "empty"
          ? { json: envelope([], { total: 0, page: 1, page_size: 20 }) }
          : {
              status: 500,
              json: {
                error: { code: "internal_error", action_hint: "稍后重新读取选品结果。" },
                request_id: "catalogue-state-read",
                trace_id: "catalogue-state-trace",
              },
            },
      );
    });
    await page.goto("/opportunities?view=all");
    const panel = page.locator(`.ui-state-panel[data-kind="${kind}"]`);
    await expect(panel).toBeVisible();
    const layout = await panel.evaluate((element) => {
      const style = getComputedStyle(element);
      const button = element.querySelector("footer .primary")!;
      return {
        radius: parseFloat(style.borderRadius),
        shadow: style.boxShadow,
        minHeight: parseFloat(style.minHeight),
        titleSize: parseFloat(getComputedStyle(element.querySelector("h2")!).fontSize),
        buttonBackground: getComputedStyle(button).backgroundImage,
        buttonHeight: button.getBoundingClientRect().height,
      };
    });
    expect(layout.radius).toBeLessThanOrEqual(4);
    expect(layout.shadow).toBe("none");
    expect(layout.minHeight).toBeLessThanOrEqual(220);
    expect(layout.titleSize).toBe(16);
    expect(layout.buttonBackground).toBe("none");
    expect(layout.buttonHeight).toBeGreaterThanOrEqual(44);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    const previousReads = reads;
    await panel.locator("footer .primary").click();
    await expect.poll(() => reads).toBeGreaterThan(previousReads);
    if (kind === "error") await expect(panel).toContainText("catalogue-state-read");
  });
}

test("empty all-products view refreshes without exposing manual creation", async ({ page }) => {
  await ready(page);
  let reads = 0;
  let writes = 0;
  await page.route("**/api/v1/opportunities**", (route) => {
    const request = route.request();
    if (new URL(request.url()).pathname !== "/api/v1/opportunities") return route.fallback();
    if (request.method() !== "GET") {
      writes += 1;
      return route.abort();
    }
    reads += 1;
    return route.fulfill({ json: envelope([], { total: 0, page: 1, page_size: 20 }) });
  });
  await page.goto("/opportunities?view=all&create=1");
  await expect(page.getByRole("button", { name: "手工添加机会", exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "创建机会候选" })).toHaveCount(0);
  const refresh = page.getByRole("button", { name: "刷新列表", exact: true }).first();
  await expect(refresh).toBeVisible();
  const previousReads = reads;
  await refresh.click();
  await expect.poll(() => reads).toBeGreaterThan(previousReads);
  expect(writes).toBe(0);
});

for (const [competitorCount, detailCollected, sourceEnabled] of [
  [4, true, true],
  [5, true, true],
  [5, false, true],
  [5, true, false],
] as const) {
  test(`selection comparison separates the primary from ${competitorCount} independent competitors (details ${detailCollected}, source ${sourceEnabled})`, async ({
    page,
  }) => {
    const mainAsin = "B000000000";
    await ready(page, evidence, { main_asin: mainAsin }, [
      "task:read",
      "trend:read",
      "opportunity:read",
      "opportunity:decide",
      "competitor:read",
    ]);
    const product = (index: number) => ({
      id: `product-${index}`,
      opportunity_id: opportunityId,
      market: "US",
      source_site: index % 2 ? "Amazon" : "amazon",
      external_id: `B0${String(index).padStart(8, "0")}`,
      title: index === 0 ? "主要商品示例" : `竞品示例 ${index}`,
      snapshot_count: 1,
      latest_snapshot: {
        current_price: 19.99 + index,
        currency: "USD",
        review_count: 100 + index,
        rating_value: 4.5,
        captured_at: "2026-10-17T00:00:00Z",
        freshness: "fresh",
        source_status: "healthy",
        detail_collected: detailCollected,
        source_enabled: sourceEnabled,
        public_signals:
          index === 0
            ? {
                sales_badge: {
                  text: "10K+ bought in past month",
                  quantity_lower_bound: 10000,
                  period: "past_month",
                },
                best_seller_rank: { rank: 222, text: "#222 in Home & Kitchen" },
                sponsored: null,
                review_samples: [
                  {
                    review_id: "RMAINEXAMPLE",
                    title: "续航评价节选",
                    text: "Fixture review excerpt about battery life.",
                    rating: 5,
                    date_text: "Reviewed in the United States on October 5, 2026",
                    variation_text: "Color: Pink",
                    verified_purchase: true,
                    helpful_votes: 11,
                  },
                ],
              }
            : index === 1
              ? {
                  sales_badge: {
                    text: "400+ bought in past month",
                    quantity_lower_bound: 400,
                    period: "past_month",
                  },
                  best_seller_rank: null,
                  sponsored: true,
                  review_samples: [
                    {
                      review_id: "RCOMPETITOREXAMPLE",
                      title: "竞品评价节选",
                      text: "Fixture review excerpt with undisclosed optional fields.",
                      rating: null,
                      date_text: null,
                      variation_text: null,
                      verified_purchase: null,
                      helpful_votes: null,
                    },
                  ],
                }
              : null,
      },
    });
    await page.route(/\/api\/v1\/competitors(?:\?.*)?$/, (route) =>
      route.fulfill({
        json: envelope([
          {
            ...product(0),
            id: "foreign-primary",
            source_site: "other",
            title: "非Amazon同编号商品",
          },
          product(0),
          ...Array.from({ length: competitorCount }, (_, index) => product(index + 1)),
          product(1),
        ]),
      }),
    );
    const reads: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/v1/competitors") reads.push(request.url());
    });
    await page.goto(`/opportunities/${opportunityId}?tab=competition`);
    const comparison = page.getByRole("region", { name: "Amazon 主品与竞品" });
    await expect(comparison).toContainText("不代表相关性证明通过或已参与评分");
    console.log(
      "COMPARISON_LAYOUT " +
        JSON.stringify({
          primaryRows: await comparison.locator('tr[data-product-role="primary"]').count(),
          competitorRows: await comparison.locator('tr[data-product-role="competitor"]').count(),
          duplicatedCard:
            (await comparison.locator(".selection-comparison-primary dl").count()) > 0,
        }),
    );
    const mainRow = comparison.locator('tr[data-product-role="primary"]');
    await expect(mainRow).toHaveCount(1);
    await expect(mainRow).toContainText("主要商品示例");
    await expect(mainRow.locator("th")).toHaveCount(1);
    await expect(mainRow.locator("td")).toHaveCount(7);
    await expect(mainRow).not.toContainText("当前评价门槛试算");
    await expect(comparison.locator(".selection-comparison-primary dl")).toHaveCount(0);
    await expect(comparison.getByText("非Amazon同编号商品")).toHaveCount(0);
    await expect(mainRow).toContainText("近月 ≥ 10,000");
    await expect(mainRow).toContainText("#222");
    await expect(
      comparison.locator('tbody tr[data-product-role="competitor"]').first(),
    ).toContainText("近月 ≥ 400");
    await expect(
      comparison.locator('tbody tr[data-product-role="competitor"]').first(),
    ).toContainText("已观察到广告位");
    await expect(
      comparison.locator('tbody tr[data-product-role="competitor"]').first(),
    ).toContainText("当前评价门槛试算：");
    if ((page.viewportSize()?.width ?? 0) <= 760) {
      const advertisingCell = comparison
        .locator('tbody tr[data-product-role="competitor"]')
        .first()
        .locator("td")
        .filter({ hasText: "已观察到广告位" });
      await advertisingCell.scrollIntoViewIfNeeded();
      const box = (await advertisingCell.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      await expect(advertisingCell).toHaveAttribute("data-label", "广告标记");
      await expect(advertisingCell).toBeVisible();
    }
    await expect(
      comparison.getByText("购买提示为页面展示的数量下限；精确销量、广告花费未知。", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(comparison.locator('tbody tr[data-product-role="competitor"]')).toHaveCount(
      competitorCount,
    );
    await expect(
      comparison.getByText(
        `详情齐备快照 ${detailCollected && sourceEnabled ? competitorCount : 0} / 至少 5 个`,
        {
          exact: true,
        },
      ),
    ).toBeVisible();
    await expect(
      comparison.locator('tbody tr[data-product-role="competitor"]').getByText("主要商品示例"),
    ).toHaveCount(0);
    if (competitorCount === 4 || !detailCollected || !sourceEnabled)
      await expect(
        comparison.getByText("竞品数据尚不完整，继续采集后再判断竞争情况。"),
      ).toBeVisible();
    else await expect(comparison.locator('[data-ready="true"]')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    const reviewRegion = comparison.getByRole("region", { name: "公开评价样本" });
    await expect(reviewRegion.locator("details")).toHaveCount(2);
    expect(reads.length).toBeGreaterThan(0);
    expect(
      reads.every((url) => new URL(url).searchParams.get("opportunity_id") === opportunityId),
    ).toBe(true);
    const beforeExpand = reads.length;
    await reviewRegion.locator("summary").first().click();
    await expect(
      reviewRegion.getByText("Fixture review excerpt about battery life."),
    ).toBeVisible();
    await expect(reviewRegion.getByText(/Color: Pink/)).toBeVisible();
    await expect(reviewRegion.getByText("页面标记已购", { exact: true })).toBeVisible();
    await expect(reviewRegion.getByText("11 人认为有用", { exact: true })).toBeVisible();
    await reviewRegion.locator("summary").nth(1).click();
    await expect(reviewRegion.getByText("未展示购买认证", { exact: true })).toBeVisible();
    await expect(reviewRegion.getByText("有用票数未展示", { exact: true })).toBeVisible();
    await expect(reviewRegion.getByText("星级未展示", { exact: true })).toBeVisible();
    expect(reads.length).toBe(beforeExpand);
    if (competitorCount === 5 && detailCollected && sourceEnabled)
      await expect(reviewRegion).toHaveScreenshot(
        "compact-recommendation-review-samples-20261017.png",
      );
    await page.getByRole("button", { name: "商品与评分", exact: true }).click();
    await expect(page.getByText(`${competitorCount} 个关联竞品`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${competitorCount}个快照`, { exact: true })).toBeVisible();
  });
}

test("selection detail presents product identity and factual score rows without the legacy directory", async ({
  page,
}, testInfo) => {
  await ready(page, evidence, {
    name: "便携式桌面风扇",
    main_asin: "B000000001",
    image_url: "https://images.example.test/header-product.jpg",
    score_rule_version: "verified-rule-v4",
    score_components: [
      {
        dimension_code: "market_demand",
        weight_percent: 25,
        input_score: 75,
        weighted_score: 18.75,
        evidence_ids: ["evidence-1"],
        missing_fields: [],
      },
      {
        dimension_code: "data_quality",
        weight_percent: 10,
        input_score: null,
        weighted_score: null,
        evidence_ids: [],
        missing_fields: ["评价明细"],
      },
    ],
  });
  await page.route("https://images.example.test/header-product.jpg", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto(`/opportunities/${opportunityId}`);
  const header = page.locator(".selection-product-header");
  await expect(header.getByRole("heading", { name: "便携式桌面风扇" })).toBeVisible();
  await expect(header.getByText("图片暂不可用", { exact: true })).toBeVisible();
  await expect(header.getByRole("link", { name: "B000000001" })).toHaveAttribute(
    "href",
    "https://www.amazon.com/dp/B000000001",
  );
  await expect(header.locator(".selection-product-header__score > div").first()).toContainText("—");
  const table = page.getByRole("table", { name: "评分维度明细" });
  await expect(table.getByRole("row", { name: /市场需求 25% 75 18.75 1 条证据/ })).toBeVisible();
  await table.getByText("证据编号", { exact: true }).click();
  await expect(table.getByText("evidence-1", { exact: true })).toBeVisible();
  await expect(table.getByRole("row", { name: /数据质量/ })).toContainText("缺失");
  await table.getByText("缺失项", { exact: true }).click();
  await expect(table.getByText("评价明细", { exact: true })).toBeVisible();
  await expect(page.locator(".selection-detail-more")).toHaveCount(0);
  await expect(
    page.locator(".opportunity-detail-directory, .opportunity-detail-directory-mobile"),
  ).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("selection-detail.png") });
});

test("commerce catalogue is a product-first eight-column research table", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "desktop-chromium")
    await page.setViewportSize({ width: 1920, height: 1080 });
  await ready(page);
  await page.goto("/opportunities");
  await expect(page.getByRole("table", { name: "选品商品列表" })).toBeVisible();
  await expect(page.getByRole("button", { name: "图卡", exact: true })).toHaveCount(0);
  const row = page.locator(".selection-product-row").first();
  await expect(row.getByRole("cell")).toHaveCount(8);
  await expect(page.locator(".catalogue-page-heading h2")).toHaveText("选品库");
  await expect(page.getByRole("textbox", { name: "商品名称" })).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) > 640)
    await expect(page.getByRole("columnheader")).toHaveCount(8);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  const title = page.locator(".selection-product-name a").first();
  await title.focus();
  await expect(title).toBeFocused();
  await expect(title).toHaveAttribute("href", new RegExp(`/opportunities/${opportunityId}`));
  const action = row.locator(".selection-product-action-cell a");
  expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({
    path: testInfo.outputPath("research-product-table.png"),
    fullPage: true,
  });
});

test("catalogue shows original primary facts without inventing sales or private ads", async ({
  page,
}, testInfo) => {
  await ready(page);
  await page.route("**/api/v1/opportunities?*", (route) =>
    route.fulfill({
      json: envelope(
        [
          {
            ...base,
            image_url: null,
            main_asin: "B000000001",
            primary_product: {
              price: 29,
              currency: "USD",
              rating_value: 4.7,
              review_count: 1200,
              captured_at: "2026-10-17T00:00:00Z",
              public_signals: {
                sales_badge: {
                  text: "100+ bought in past month",
                  quantity_lower_bound: 100,
                  period: "past_month",
                },
                best_seller_rank: { rank: 123, text: "#123 in Kitchen" },
                sponsored: true,
              },
            },
          },
          {
            ...base,
            id: "00000000-0000-4000-8000-000000000499",
            name: "资料缺失商品",
            image_url: null,
            primary_product: null,
          },
        ],
        { page: 1, page_size: 20, total: 2 },
      ),
    }),
  );
  await page.goto("/opportunities");
  const row = page.locator(".selection-product-row").first();
  await expect(row).toContainText("USD 29.00");
  await expect(row).toContainText("4.7 / 1200 条");
  await expect(row).toContainText("近月 ≥ 100");
  await expect(row).toContainText("#123");
  await expect(row).toContainText("观察到广告标记");
  await expect(page.locator(".catalog-data-note")).toContainText("不等于精确销量");
  const missing = page.locator(".selection-product-row").nth(1);
  await expect(missing).toContainText("未采集");
  await expect(missing).toContainText("未取得");
  await expect(missing).not.toContainText("USD 0");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("catalogue-primary-facts.png"),
    fullPage: true,
  });
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
            {
              ...recommendedBase,
              id: "00000000-0000-4000-8000-000000000433",
              name: "已采集主图的机会",
              image_url: "/fixtures/opportunity-image-valid.svg",
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

  await page.route("**/fixtures/opportunity-image-valid.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#2563eb"/></svg>',
    }),
  );
  await page.goto("/opportunities");

  await expect(page.getByRole("img", { name: "商品主图加载失败" })).toBeVisible();
  await expect(page.getByRole("img", { name: "商品主图待采集" })).toBeVisible();
  await expect(page.getByRole("img", { name: `${recommendedBase.name} 商品图` })).toHaveCount(0);
  const image = page.getByRole("img", { name: "已采集主图的机会 商品图", exact: true });
  await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(120);
  const boxes = await page
    .locator(":is(.opportunity-picture,.selection-product-picture)")
    .evaluateAll((elements) => elements.map((el) => el.getBoundingClientRect().height));
  expect(boxes).toHaveLength(3);
  expect(new Set(boxes).size).toBe(1);
});

test("M04-02.A07/A08/A15 opportunity detail directory and reason-required decision preserve missing states", async ({
  page,
}) => {
  await ready(page);
  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: "AI 驱动的个性化护肤机会" })).toBeVisible();
  await expect(page.getByText("商品详情", { exact: true })).toHaveCount(1);
  await expect(page.getByText("来源 热点自动发现")).toBeVisible();
  const decisionSurface = page.locator(".opportunity-decision-summary");
  await expect(decisionSurface).toHaveCSS("border-radius", "0px");
  await expect(decisionSurface).toHaveCSS("background-color", "rgb(255, 255, 255)");
  expect((await decisionSurface.boundingBox())!.height).toBeLessThan(
    page.viewportSize()!.width < 760 ? 520 : 240,
  );
  const scorePanel = page.locator(".opportunity-insight-card--score");
  const collectionPanel = page.locator(".opportunity-insight-card--collection");
  await expect(scorePanel).toBeVisible();
  const scoreBounds = (await scorePanel.boundingBox())!;
  const collectionBounds = (await collectionPanel.boundingBox())!;
  expect(collectionBounds.y).toBeGreaterThanOrEqual(scoreBounds.y + scoreBounds.height - 2);
  const insightsBounds = (await page.locator(".opportunity-insights").boundingBox())!;
  expect((await decisionSurface.boundingBox())!.y).toBeGreaterThanOrEqual(
    insightsBounds.y + insightsBounds.height - 2,
  );
  await expect(page.locator(".opportunity-collection-tools")).toHaveCount(0);
  await expect(collectionPanel).not.toContainText("正在读取");
  await expect(page).toHaveScreenshot("selection-detail-overview-20261019.png", {
    fullPage: false,
  });
  const gateFontSize = await decisionSurface
    .locator(".opportunity-quality-gates li")
    .first()
    .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(gateFontSize).toBeGreaterThanOrEqual(13);
  await expect(decisionSurface.locator(".opportunity-decision-summary__lead h3")).toHaveCSS(
    "font-size",
    "18px",
  );
  await expect(decisionSurface.locator(".opportunity-decision-gap")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(page.locator(".selection-detail-navigation > button")).toHaveText([
    "商品与评分",
    "竞品对比",
    "货源与利润",
    "情报证据",
    "风险",
    "决策记录",
  ]);
  await expect(page.locator(".selection-detail-more")).toHaveCount(0);
  await expect(
    page.locator(".opportunity-detail-directory, .opportunity-detail-directory-mobile"),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    /trend_topic|insufficient_data|\bpartial\b|\bunknown\b/,
  );
  await expect(page.getByText("暂无评分记录。")).toBeVisible();
  await expect(page.getByText("0/5 已通过", { exact: true })).toBeVisible();
  await expect(page.getByText("分析尚未完成", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "采纳建议" })).toHaveCount(0);
  await page.getByText("查看每项判断", { exact: true }).click();
  await expect(page.getByRole("list", { name: "五项质量门" })).toContainText(
    "评分待完成市场待完成竞争待完成成本待完成风险待完成",
  );
  await expect(
    page.getByText("已识别 Amazon 主品，系统正在补齐评分、市场、竞品、成本与风险证据。", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "货源与利润" }).click();
  await expect(
    page.locator(".opportunity-profit").getByText("利润未知", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "情报证据", exact: true }).click();
  await expect(page.getByText("Example News")).toBeVisible();
  const decisionWrites: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes(`/api/v1/opportunities/${opportunityId}/decisions`)
    )
      decisionWrites.push(request.url());
  });
  await page.getByRole("button", { name: "商品与评分", exact: true }).click();
  const earlyDecision = page.getByText("提前人工处理", { exact: true });
  const earlyDecisionDetails = page.locator(".opportunity-decision-waiting details");
  await earlyDecision.hover();
  const palette = await page.locator(".opportunity-workspace").evaluate((element) => {
    const probe = document.createElement("span");
    probe.style.transition = "none";
    element.append(probe);
    probe.style.color = "var(--so-opportunity-review-blue)";
    const blue = getComputedStyle(probe).color;
    probe.style.color = "var(--so-opportunity-review-ink)";
    const ink = getComputedStyle(probe).color;
    probe.remove();
    return { blue, ink };
  });
  await expect(earlyDecision).toHaveCSS("color", palette.blue);
  await page.mouse.down();
  await expect(earlyDecision).toHaveCSS("color", palette.ink);
  await page.mouse.up();
  await expect(earlyDecisionDetails).toHaveAttribute("open", "");
  await earlyDecision.focus();
  await expect(earlyDecision).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(earlyDecisionDetails).not.toHaveAttribute("open", "");
  await page.keyboard.press("Enter");
  await expect(earlyDecisionDetails).toHaveAttribute("open", "");
  const observeButton = page.getByRole("button", { name: "继续观察", exact: true });
  const rejectButton = page.getByRole("button", { name: "驳回", exact: true });
  await expect(observeButton).toBeVisible();
  await expect(rejectButton).toBeVisible();
  await expect(page.getByRole("button", { name: "采纳建议" })).toHaveCount(0);
  await expect.poll(() => decisionWrites.length).toBe(0);
  await page.keyboard.press("Tab");
  await expect(observeButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(rejectButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(observeButton).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "记录继续观察决定" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("原因（必填）").fill("补齐成本与竞品后再判断");
  await dialog.getByRole("button", { name: "确认记录" }).click();
  await expect(page.getByText("决策已记录；原始评分与证据未被改写。")).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) <= 640) {
    await expect(page.locator(".opportunity-decision-waiting")).toHaveCSS("position", "static");
  }
  await page.getByRole("button", { name: "决策记录" }).click();
  await expect(page.locator(".opportunity-decisions")).toHaveCSS("border-radius", "0px");
  await expect(page.locator(".opportunity-decisions")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
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
  await expect(page).toHaveScreenshot("selection-detail-decisions-20261019.png", {
    fullPage: true,
  });
});

test("P18 adoption entry requires each quality gate even when the aggregate claims success", async ({
  page,
}) => {
  const gates = {
    score: true,
    market: true,
    competition: true,
    cost: true,
    risk: true,
    all_passed: true,
  };
  const gateLabels = {
    score: "评分",
    market: "市场",
    competition: "竞争",
    cost: "成本",
    risk: "风险",
  };
  const detailOverrides: Record<string, unknown> = {
    recommendation_status: "recommend",
    overall_score: 86,
    trend_score: 88,
    competition_score: 82,
    profit_status: "calculated",
    risk_level: "low",
    matched_rule_count: 1,
    selection_stage: "recommended",
    quality_gates: gates,
    coverage_status: "complete",
    blocking_reasons: [],
  };
  await ready(page, evidence, detailOverrides);
  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("button", { name: "采纳建议" })).toBeVisible();

  for (const gate of ["score", "market", "competition", "cost", "risk"] as const) {
    detailOverrides.quality_gates = { ...gates, [gate]: false, all_passed: true };
    await page.reload();
    await expect(page.getByRole("heading", { name: base.name })).toBeVisible();
    await expect(page.getByRole("button", { name: "采纳建议" })).toHaveCount(0);
    await page.getByText("查看每项判断", { exact: true }).click();
    await expect(page.getByRole("list", { name: "五项质量门" })).toContainText(
      `${gateLabels[gate]}待完成`,
    );
  }

  detailOverrides.quality_gates = { ...gates, all_passed: false };
  await page.reload();
  await expect(page.getByRole("button", { name: "采纳建议" })).toHaveCount(0);

  detailOverrides.quality_gates = gates;
  detailOverrides.selection_stage = "rule_candidate";
  await page.reload();
  await expect(page.getByRole("button", { name: "采纳建议" })).toHaveCount(0);

  detailOverrides.selection_stage = "recommended";
  await page.reload();
  const adopt = page.getByRole("button", { name: "采纳建议" });
  await expect(adopt).toBeVisible();
  await adopt.click();
  await expect(page.getByRole("dialog", { name: "记录采纳决定" })).toBeVisible();
});

test("P18 redecision link always lands on the available decision state", async ({ page }) => {
  await ready(page, evidence, { redecision_ready: true });
  await page.goto(`/opportunities/${opportunityId}`);

  const redecisionLink = page.getByRole("link", { name: "前往决策" });
  await expect(redecisionLink).toBeVisible();
  await redecisionLink.click();
  await expect(page).toHaveURL(/#opportunity-decision-actions$/);
  await expect(page.locator("#opportunity-decision-actions")).toBeInViewport();
  await expect(page.locator("#opportunity-decision-actions")).toContainText("分析尚未完成");

  await ready(page, evidence, { redecision_ready: true }, ["opportunity:read"]);
  await page.goto(`/opportunities/${opportunityId}`);
  await expect(
    page.getByText("当前角色可查看判断依据；最终决定需要“选品决策”权限。", { exact: true }),
  ).toBeVisible();

  const readonlyRedecisionLink = page.getByRole("link", { name: "前往决策" });
  await readonlyRedecisionLink.click();
  await expect(page).toHaveURL(/#opportunity-decision-actions$/);
  await expect(page.locator("#opportunity-decision-actions")).toBeInViewport();
  await expect(page.locator("#opportunity-decision-actions")).toContainText(
    "最终决定需要“选品决策”权限",
  );
});

test("P18 transfers focus from early reject to reject when all quality gates pass", async ({
  page,
}) => {
  const gates = {
    score: false,
    market: false,
    competition: false,
    cost: false,
    risk: false,
    all_passed: false,
  };
  const detailOverrides: Record<string, unknown> = {
    ...recommendedBase,
    id: opportunityId,
    version: 7,
    selection_stage: "rule_candidate",
    quality_gates: gates,
    evidence,
  };
  let releaseScoreWrite!: () => void;
  let markScoreWriteStarted!: () => void;
  const scoreWriteGate = new Promise<void>((resolve) => (releaseScoreWrite = resolve));
  const scoreWriteStarted = new Promise<void>((resolve) => (markScoreWriteStarted = resolve));
  await ready(page, evidence, detailOverrides);
  await page.route(`**/api/v1/opportunities/${opportunityId}/score-runs`, async (route) => {
    markScoreWriteStarted();
    await scoreWriteGate;
    await route.fulfill({ status: 202, json: envelope({ id: "queued-score-run" }) });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.locator(".opportunity-decision-waiting")).toBeVisible();
  const earlyDecision = page.locator(".opportunity-decision-waiting details summary");
  await earlyDecision.focus();
  await page.keyboard.press("Enter");
  const earlyReject = page
    .locator(".opportunity-decision-waiting")
    .getByRole("button", { name: "驳回", exact: true });
  await expect(earlyReject).toBeVisible();

  await page.getByRole("button", { name: "重新评分", exact: true }).click();
  await scoreWriteStarted;
  await earlyReject.focus();
  detailOverrides.selection_stage = "recommended";
  detailOverrides.quality_gates = {
    score: true,
    market: true,
    competition: true,
    cost: true,
    risk: true,
    all_passed: true,
  };
  releaseScoreWrite();

  await expect(page.getByRole("button", { name: "采纳建议", exact: true })).toBeVisible();
  await expect(
    page
      .locator("#opportunity-decision-actions")
      .getByRole("button", { name: "驳回", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("dialog", { name: /记录.*决定/ })).toHaveCount(0);
});

test("P18 adoption dialog exposes the required-reason error without posting", async ({ page }) => {
  const detailOverrides: Record<string, unknown> = {
    ...recommendedBase,
    id: opportunityId,
    version: 7,
    evidence,
  };
  await ready(page, evidence, detailOverrides);
  const decisionRequests: unknown[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes(`/api/v1/opportunities/${opportunityId}/decisions`)
    )
      decisionRequests.push(request.postDataJSON());
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await page.getByRole("button", { name: "采纳建议" }).click();
  const dialog = page.getByRole("dialog", { name: "记录采纳决定" });
  const reason = dialog.getByLabel("原因（必填）");
  await dialog.getByRole("button", { name: "确认记录" }).click();

  await expect(reason).toHaveAttribute("aria-invalid", "true");
  await expect(reason).toHaveAttribute(
    "aria-describedby",
    "opportunity-decision-reason-help opportunity-decision-reason-error",
  );
  await expect(dialog.getByRole("alert")).toHaveText("请填写原因后再记录决定。");
  await expect(reason).toBeFocused();
  expect(decisionRequests).toEqual([]);

  await reason.fill("已核对五项质量门与当前证据");
  await expect(reason).not.toHaveAttribute("aria-invalid", "true");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  expect(decisionRequests).toEqual([]);
});

test("P18 eligible recommendation completes the audited adoption flow without changing score facts", async ({
  page,
}) => {
  const detailOverrides: Record<string, unknown> = {
    ...recommendedBase,
    id: opportunityId,
    version: 7,
    evidence,
  };
  await ready(page, evidence, detailOverrides);

  const submittedBodies: Record<string, unknown>[] = [];
  await page.route(`**/api/v1/opportunities/${opportunityId}/decisions`, async (route) => {
    submittedBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      json: envelope({
        opportunity_id: opportunityId,
        decision_status: "adopted",
        version: 8,
        decision_id: "00000000-0000-4000-8000-000000000434",
      }),
    });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: "建议采纳" })).toBeVisible();
  await expect(page.getByText("5/5 已通过", { exact: true })).toBeVisible();
  await expect(
    page.locator(".selection-product-header__score").getByText("86 / 100", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("8", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "采纳建议" }).click();
  const dialog = page.getByRole("dialog", { name: "记录采纳决定" });
  await dialog.getByLabel("原因（必填）").fill("已核对评分、证据与五项质量门，按建议采纳");
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes(`/api/v1/opportunities/${opportunityId}/decisions`) &&
      candidate.request().method() === "POST" &&
      candidate.status() === 200,
  );
  await dialog.getByRole("button", { name: "确认记录" }).click();
  await response;
  await expect(dialog).toBeHidden();

  expect(submittedBodies).toEqual([
    {
      action: "adopt",
      reason: "已核对评分、证据与五项质量门，按建议采纳",
      expected_version: 7,
    },
  ]);
  await expect(page.locator(".opportunity-message")).toContainText(
    "决策已记录；原始评分与证据未被改写。",
  );
  await expect(page.getByRole("heading", { name: base.name, level: 1 })).toBeVisible();
  await expect(
    page.locator(".selection-product-header__score").getByText("86 / 100", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("8", { exact: true })).toBeVisible();
  await expect(page.getByText("5/5 已通过", { exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "返回选品列表" }).click();
  await expect(page).toHaveURL(/\/opportunities$/);
  await expect(page.getByRole("link", { name: base.name, exact: true })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "返回选品列表" })).toBeVisible();
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
  await page.route(/\/api\/v1\/competitors(?:\?.*)?$/, (route) => {
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
  await expect(page.getByText("供应链数据暂不可用。", { exact: true })).toBeVisible();
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

test("P18 sourcing facts survive competitor read failure and competitor retry stays scoped", async ({
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

  let competitorReads = 0;
  let sourcingReads = 0;
  let allowCompetitorRecovery = false;
  await page.route(/\/api\/v1\/competitors(?:\?.*)?$/, (route) => {
    competitorReads += 1;
    return route.fulfill(
      !allowCompetitorRecovery
        ? { status: 503, json: { error: { code: "temporarily_unavailable" } } }
        : { json: envelope([]) },
    );
  });
  await page.route("**/api/v1/sourcing/searches*", (route) => {
    sourcingReads += 1;
    return route.fulfill({
      json: envelope([
        {
          input_type: "opportunity",
          input_ref: opportunityId,
          candidate_count: 2,
        },
      ]),
    });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByText("竞品数据暂不可用，请重试。", { exact: true })).toBeVisible();
  await expect(page.getByText("1 个关联搜索 · 2 个候选", { exact: true })).toBeVisible();
  const sourcingReadsBeforeRetry = sourcingReads;

  allowCompetitorRecovery = true;
  await page.getByRole("button", { name: "重试读取竞品" }).click();
  await expect(page.getByText(/0 个关联竞品/)).toBeVisible();
  await expect(page.getByText("1 个关联搜索 · 2 个候选", { exact: true })).toBeVisible();
  expect(competitorReads).toBeGreaterThanOrEqual(2);
  expect(sourcingReads).toBe(sourcingReadsBeforeRetry);
});

test("P18 insight sections distinguish unavailable permissions from empty facts", async ({
  page,
}) => {
  await ready(page);
  let competitorReads = 0;
  let sourcingReads = 0;
  await page.route(/\/api\/v1\/competitors(?:\?.*)?$/, (route) => {
    competitorReads += 1;
    return route.fulfill({ json: envelope([]) });
  });
  await page.route("**/api/v1/sourcing/searches*", (route) => {
    sourcingReads += 1;
    return route.fulfill({ json: envelope([]) });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByText("暂无竞品查看权限。", { exact: true })).toBeVisible();
  await expect(page.getByText("暂无供应链查看权限。", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "查看竞品对比", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "供应链工作台", exact: true })).toHaveCount(0);
  expect(competitorReads).toBe(0);
  expect(sourcingReads).toBe(0);

  await page.goto(`/opportunities/${opportunityId}?tab=competition`);
  await expect(page.getByRole("link", { name: "竞品工作台 ↗", exact: true })).toHaveCount(0);
  await expect(page.getByText("暂无竞品查看权限。", { exact: true })).toBeVisible();

  await page.goto(`/opportunities/${opportunityId}?tab=market`);
  await expect(page.locator(".opportunity-evidence")).toContainText("Example News");
  await expect(page.locator(".opportunity-evidence > header")).toContainText("2 条");
  await page.goto(`/opportunities/${opportunityId}?tab=risk`);
  await expect(page.getByRole("heading", { name: "风险等级，不等于完整评估" })).toBeVisible();
  await expect(page.getByText("风险评估资料不完整", { exact: true })).toBeVisible();
});

test("P18 discovery actions require their matching manage capabilities", async ({ page }) => {
  await ready(page);
  await page.route("**/api/v1/me/navigation?shell=member", (route) =>
    route.fulfill({
      json: envelope({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000421",
        workspace_id: "00000000-0000-4000-8000-000000000422",
        roles: ["member"],
        capabilities: [
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
  let discoveryWrites = 0;
  await page.route(/\/api\/v1\/competitors(?:\?.*)?$/, (route) =>
    route.fulfill({ json: envelope([]) }),
  );
  await page.route("**/api/v1/sourcing/searches*", (route) => {
    if (route.request().method() === "POST") discoveryWrites += 1;
    return route.fulfill({ json: envelope([]) });
  });
  await page.route(`**/api/v1/opportunities/${opportunityId}/competitor-discovery`, (route) => {
    discoveryWrites += 1;
    return route.fulfill({ status: 202, json: envelope({ task_id: "unexpected-task" }) });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: base.name })).toBeVisible();
  await expect(page.getByRole("button", { name: "查看竞品对比", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "供应链工作台", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "采集 Amazon 竞品" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "采集公开供应商" })).toHaveCount(0);
  expect(discoveryWrites).toBe(0);
});

test("P18 retired competitor and supplier collection controls produce no member writes", async ({
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
          "opportunity:read",
          "opportunity:decide",
          "competitor:manage",
          "supplier_quote:manage",
        ],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  const competitorBodies: Record<string, unknown>[] = [];
  const sourcingBodies: Record<string, unknown>[] = [];
  await page.route(/\/api\/v1\/competitors(?:\?.*)?$/, (route) =>
    route.fulfill({ json: envelope([]) }),
  );
  await page.route("**/api/v1/opportunities/*/competitor-discovery", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    competitorBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    return route.fulfill({ status: 202, json: envelope({ task_id: "competitor-task-1" }) });
  });
  await page.route("**/api/v1/sourcing/searches*", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: envelope([]) });
    sourcingBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    return route.fulfill({ status: 202, json: envelope({ task_id: "supplier-task-1" }) });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: base.name })).toBeVisible();
  await expect(page.getByRole("button", { name: "采集 Amazon 竞品" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "采集公开供应商" })).toHaveCount(0);
  expect(competitorBodies).toEqual([]);
  expect(sourcingBodies).toEqual([]);
});

test("P18 changing product preserves read navigation without retired collection writes", async ({
  page,
}) => {
  await ready(page, evidence, {}, [
    "opportunity:read",
    "opportunity:decide",
    "competitor:read",
    "competitor:manage",
    "sourcing:read",
    "supplier_quote:manage",
  ]);
  await readyForNextOpportunity(page);
  let writes = 0;
  await page.route("**/api/v1/opportunities/*/competitor-discovery", (route) => {
    writes++;
    return route.abort();
  });
  await page.route("**/api/v1/sourcing/searches*", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: envelope([]) });
    writes++;
    return route.abort();
  });
  await page.route(/\/api\/v1\/competitors(?:\?.*)?$/, (route) =>
    route.fulfill({ json: envelope([]) }),
  );
  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: base.name })).toBeVisible();
  for (const [target, name] of [
    [nextOpportunityId, nextOpportunity.name],
    [opportunityId, base.name],
  ]) {
    await switchOpportunityInPlace(page, target);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByRole("button", { name: "采集 Amazon 竞品" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "采集公开供应商" })).toHaveCount(0);
  }
  expect(writes).toBe(0);
});

test("P18 overview competition action stays in the detail and respects read permissions", async ({
  page,
}) => {
  await ready(page);
  let capabilities: string[] = [];
  await page.route("**/api/v1/me/navigation?shell=member", (route) =>
    route.fulfill({
      json: envelope({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000421",
        workspace_id: "00000000-0000-4000-8000-000000000422",
        roles: ["member"],
        capabilities: ["opportunity:read", ...capabilities],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  await page.route(/\/api\/v1\/competitors(?:\?.*)?$/, (route) =>
    route.fulfill({ json: envelope([]) }),
  );
  await page.route("**/api/v1/sourcing/searches*", (route) =>
    route.fulfill({ json: envelope([]) }),
  );

  for (const scenario of [
    { capabilities: ["competitor:read"], competitor: true, sourcing: false },
    { capabilities: ["sourcing:read"], competitor: false, sourcing: true },
    {
      capabilities: ["competitor:manage", "supplier_quote:manage"],
      competitor: false,
      sourcing: false,
    },
    { capabilities: ["competitor:read", "sourcing:read"], competitor: true, sourcing: true },
  ]) {
    capabilities = scenario.capabilities;
    await page.goto(`/opportunities/${opportunityId}`);
    await expect(page.getByRole("heading", { name: base.name })).toBeVisible();
    await expect(page.getByRole("button", { name: "查看竞品对比", exact: true })).toHaveCount(
      scenario.competitor ? 1 : 0,
    );
    await expect(page.getByRole("link", { name: "供应链工作台", exact: true })).toHaveCount(
      scenario.sourcing ? 1 : 0,
    );
    if (scenario.competitor) {
      await page.getByRole("button", { name: "查看竞品对比", exact: true }).click();
      await expect(page).toHaveURL(/tab=competition/);
      await expect(page.getByRole("heading", { name: "可追溯的竞品快照" })).toBeVisible();
    }

    await page.goto(`/opportunities/${opportunityId}?tab=competition`);
    await expect(page.getByRole("heading", { name: "可追溯的竞品快照" })).toBeVisible();
    await expect(page.getByRole("link", { name: /竞品工作台/ })).toHaveCount(0);
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

test("opportunity list aborts an older read after a newer filter read", async ({ page }) => {
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
      await route
        .fulfill({
          json: envelope(
            [{ ...recommendedBase, id: "older-opportunity", name: "过期筛选结果", exact: true }],
            {
              page: 1,
              page_size: 20,
              total: 1,
            },
          ),
        })
        .catch(() => {});
      return;
    }
    if (query === "newer-read") {
      await route.fulfill({
        json: envelope(
          [{ ...recommendedBase, id: "newer-opportunity", name: "当前筛选结果", exact: true }],
          {
            page: 1,
            page_size: 20,
            total: 1,
          },
        ),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto("/opportunities");
  await expect(page.getByRole("link", { name: base.name, exact: true })).toBeVisible();
  const applyQuery = async (value: string) => {
    const search = page.getByRole("search", { name: "搜索商品" });
    await search.getByLabel("商品名称").fill(value);
    await search.getByRole("button", { name: "搜索", exact: true }).click();
  };

  const olderAbort = page.waitForEvent("requestfailed", (request) =>
    request.url().includes("q=older-read"),
  );
  await applyQuery("older-read");
  await olderStarted;
  await expect(page).toHaveURL(/q=older-read/);
  await applyQuery("newer-read");
  await expect(page.getByRole("link", { name: "当前筛选结果", exact: true })).toBeVisible();
  const failedRequest = await olderAbort;
  expect(failedRequest.failure()?.errorText).toContain("ERR_ABORTED");
  releaseOlder();
  await expect(page.getByRole("link", { name: "当前筛选结果", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "过期筛选结果", exact: true })).toHaveCount(0);
});

test("P15 aborts its active list read when the cached workspace is deactivated", async ({
  page,
}) => {
  await ready(page);
  let releaseRead!: () => void;
  let markReadStarted!: () => void;
  const readGate = new Promise<void>((resolve) => (releaseRead = resolve));
  const readStarted = new Promise<void>((resolve) => (markReadStarted = resolve));
  await page.route("**/api/v1/opportunities?*", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q");
    if (query !== "deactivate-read") return route.fallback();
    markReadStarted();
    await readGate;
    await route
      .fulfill({ json: envelope([], { page: 1, page_size: 20, total: 0 }) })
      .catch(() => {});
  });

  await page.goto("/opportunities");
  await expect(page.getByRole("link", { name: base.name, exact: true })).toBeVisible();
  const search = page.getByRole("search", { name: "搜索商品" });
  await search.getByLabel("商品名称").fill("deactivate-read");
  await search.getByRole("button", { name: "搜索", exact: true }).click();
  await readStarted;

  const abortedRead = page.waitForEvent(
    "requestfailed",
    (request) =>
      request.url().includes("q=deactivate-read") &&
      request.failure()?.errorText.includes("ERR_ABORTED"),
  );
  await page.getByRole("link", { name: "市场情报", exact: true }).click();
  await expect(page).toHaveURL(/\/trends$/u);
  const failedRequest = await abortedRead;
  expect(failedRequest.failure()?.errorText).toContain("ERR_ABORTED");
  releaseRead();
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
    await route
      .fulfill({
        status: 503,
        json: { error: { code: "temporarily_unavailable", message: "暂时不可用" } },
      })
      .catch(() => {});
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await detailStarted;
  const delayedFailure = page.waitForEvent(
    "requestfailed",
    (request) =>
      request.url().includes(`/opportunities/${opportunityId}`) &&
      request.failure()?.errorText.includes("ERR_ABORTED"),
  );
  await page.getByRole("link", { name: "← 返回来源列表" }).click();
  await expect(page.getByRole("link", { name: base.name, exact: true })).toBeVisible();
  const failedRequest = await delayedFailure;
  expect(failedRequest.failure()?.errorText).toContain("ERR_ABORTED");
  releaseDetail();
  await expect(page.getByRole("link", { name: base.name, exact: true })).toBeVisible();
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
    await route.fallback().catch(() => {});
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await oldDetailStarted;
  const currentDetailRequest = page.waitForRequest((request) =>
    request.url().includes(`/api/v1/opportunities/${nextOpportunityId}`),
  );
  const oldDetailAbort = page.waitForEvent(
    "requestfailed",
    (request) =>
      request.url().includes(`/api/v1/opportunities/${opportunityId}`) &&
      request.failure()?.errorText.includes("ERR_ABORTED"),
  );
  await switchOpportunityInPlace(page, nextOpportunityId);
  await currentDetailRequest;
  await expect(page.getByRole("heading", { name: nextOpportunity.name })).toBeVisible();

  const failedRequest = await oldDetailAbort;
  expect(failedRequest.failure()?.errorText).toContain("ERR_ABORTED");
  releaseOldDetail();
  await expect(page.getByRole("heading", { name: nextOpportunity.name })).toBeVisible();
  await expect(page.getByRole("heading", { name: base.name, exact: true })).toHaveCount(0);
});

test("changing opportunities closes and clears an unsubmitted decision draft", async ({ page }) => {
  await ready(page);
  await readyForNextOpportunity(page);
  const submittedDecisions: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/decisions"))
      submittedDecisions.push(request.url());
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: base.name, level: 1 })).toBeVisible();
  await page.getByText("提前人工处理", { exact: true }).click();
  await page.getByRole("button", { name: "继续观察", exact: true }).click();
  const oldDialog = page.getByRole("dialog", { name: "记录继续观察决定" });
  await oldDialog.getByLabel("原因（必填）").fill("仅属于旧机会的未提交草稿");

  const currentDetailRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === `/api/v1/opportunities/${nextOpportunityId}`;
  });
  await switchOpportunityInPlace(page, nextOpportunityId);
  await currentDetailRequest;
  await expect(page.getByRole("heading", { name: nextOpportunity.name })).toBeVisible();
  await expect(oldDialog).toHaveCount(0);

  const originalDetailRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === `/api/v1/opportunities/${opportunityId}`;
  });
  await switchOpportunityInPlace(page, opportunityId);
  await originalDetailRequest;
  await expect(page.getByRole("heading", { name: base.name })).toBeVisible();
  await page.getByText("提前人工处理", { exact: true }).click();
  await page.getByRole("button", { name: "继续观察", exact: true }).click();
  const currentDialog = page.getByRole("dialog", { name: "记录继续观察决定" });
  await expect(currentDialog).toBeVisible();
  await expect(currentDialog.getByLabel("原因（必填）")).toHaveValue("");
  expect(submittedDecisions).toEqual([]);
});

test("retired member batch workflows expose no controls and issue no member or batch requests", async ({
  page,
}) => {
  await ready(page);
  const obsoleteRequests: string[] = [];
  const obsoleteOwnerFilters: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === "/api/v1/opportunities/member-options" || path === "/api/v1/opportunities/batch")
      obsoleteRequests.push(path);
    if (path === "/api/v1/opportunities" && url.searchParams.has("owner_id"))
      obsoleteOwnerFilters.push(url.searchParams.get("owner_id")!);
  });
  for (const view of ["recommended", "rule_candidates", "evidence_pending", "all"]) {
    await page.goto(`/opportunities?view=${view}&owner_id=retired-owner`);
    await expect(page.locator(".opportunity-workspace--review")).toBeVisible();
    await expect(page.locator(":is(.catalog-product,.selection-product-row)")).toHaveCount(1);
    await expect(page.locator(".catalog-product input[type=checkbox]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^批量/ })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "选品批量操作影响预览" })).toHaveCount(0);
  }
  await page.locator(".selection-product-name a").first().click();
  await expect(page.getByRole("heading", { name: recommendedBase.name })).toBeVisible();
  await page.getByRole("link", { name: "← 返回来源列表" }).click();
  await expect(page.locator(":is(.catalog-product,.selection-product-row)")).toHaveCount(1);
  expect(obsoleteRequests).toEqual([]);
  expect(obsoleteOwnerFilters).toEqual([]);
});

test("P18 keeps a shared write locked across cached route deactivation and refreshes its receipt", async ({
  page,
}) => {
  let scoreWriteCount = 0;
  let releaseScoreWrite!: () => void;
  let markScoreWriteStarted!: () => void;
  const scoreWriteGate = new Promise<void>((resolve) => (releaseScoreWrite = resolve));
  const scoreWriteStarted = new Promise<void>((resolve) => (markScoreWriteStarted = resolve));
  let detailReadCount = 0;
  await ready(page);
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (route) => {
    detailReadCount += 1;
    return route.fallback();
  });
  await page.route(`**/api/v1/opportunities/${opportunityId}/score-runs`, async (route) => {
    scoreWriteCount += 1;
    markScoreWriteStarted();
    await scoreWriteGate;
    await route.fulfill({ status: 202, json: envelope({ id: "queued-score-run" }) });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: base.name })).toBeVisible();
  await page.getByRole("button", { name: "重新评分", exact: true }).click();
  await scoreWriteStarted;

  await page.evaluate(() => {
    window.history.pushState({}, "", "/home");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "选品工作台", level: 1 })).toBeVisible();

  const detailRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname === `/api/v1/opportunities/${opportunityId}`,
  );
  await page.evaluate((id) => {
    window.history.pushState({}, "", `/opportunities/${id}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, opportunityId);
  await detailRequest;
  await expect(page.getByRole("heading", { name: base.name })).toBeVisible();
  const scoreButton = page.getByRole("button", { name: "重新评分", exact: true });
  await expect(scoreButton).toBeDisabled();
  await scoreButton.dispatchEvent("click");
  expect(scoreWriteCount).toBe(1);

  const previousReadCount = detailReadCount;
  releaseScoreWrite();
  await expect(
    page.getByText("页面切换期间写入回执已到达；已刷新当前工作区，请核对最新状态。"),
  ).toBeVisible();
  expect(detailReadCount).toBeGreaterThan(previousReadCount);
  await expect(scoreButton).toBeEnabled();
  expect(scoreWriteCount).toBe(1);
});

test("P18 preserves score queue acceptance alongside a failed detail refresh", async ({ page }) => {
  let detailReads = 0;
  let scoreQueuePosts = 0;
  await ready(page);
  await page.route(`**/api/v1/opportunities/${opportunityId}`, async (route) => {
    detailReads += 1;
    if (detailReads >= 2 && detailReads <= 4)
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: "dependency_unavailable",
            message: "机会详情暂不可用。",
            action_hint: "稍后重新读取机会详情。",
          },
          request_id: "p18-score-followup-read",
          trace_id: "p18-score-followup-read",
        },
      });
    return route.fallback();
  });
  await page.route(`**/api/v1/opportunities/${opportunityId}/score-runs`, async (route) => {
    scoreQueuePosts += 1;
    return route.fulfill({ status: 202, json: envelope({ id: "queued-score-run" }) });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: base.name })).toBeVisible();
  await page.getByRole("button", { name: "重新评分", exact: true }).click();

  const feedback = page.locator(".opportunity-message");
  await expect(feedback).toContainText("评分任务已进入宝塔 Node Worker 队列");
  await expect(feedback).toContainText("工作区刷新失败");
  await expect(feedback).toContainText("稍后重新读取机会详情。");
  await expect(feedback).toContainText("p18-score-followup-read");
  await expect(page.locator('.ui-state-panel[data-kind="blocked"]')).toBeVisible();
  expect(scoreQueuePosts).toBe(1);
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
    await route
      .fulfill({
        status: 503,
        json: { error: { code: "temporarily_unavailable", message: "旧机会读取失败" } },
      })
      .catch(() => {});
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await oldDetailStarted;
  const currentDetailRequest = page.waitForRequest((request) =>
    request.url().includes(`/api/v1/opportunities/${nextOpportunityId}`),
  );
  const oldDetailAbort = page.waitForEvent(
    "requestfailed",
    (request) =>
      request.url().includes(`/api/v1/opportunities/${opportunityId}`) &&
      request.failure()?.errorText.includes("ERR_ABORTED"),
  );
  await switchOpportunityInPlace(page, nextOpportunityId);
  await currentDetailRequest;
  await expect(page.getByRole("heading", { name: nextOpportunity.name })).toBeVisible();

  const failedRequest = await oldDetailAbort;
  expect(failedRequest.failure()?.errorText).toContain("ERR_ABORTED");
  releaseOldDetail();
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
    await route
      .fulfill({
        status: 503,
        json: { error: { code: "temporarily_unavailable", message: "旧机会利润读取失败" } },
      })
      .catch(() => {});
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await oldProfitStarted;
  const currentDetailRequest = page.waitForRequest((request) =>
    request.url().includes(`/api/v1/opportunities/${nextOpportunityId}`),
  );
  const oldProfitAbort = page.waitForEvent(
    "requestfailed",
    (request) =>
      request.url().includes(`/api/v1/opportunities/${opportunityId}/profit-analysis`) &&
      request.failure()?.errorText.includes("ERR_ABORTED"),
  );
  await switchOpportunityInPlace(page, nextOpportunityId);
  await currentDetailRequest;
  await expect(page.getByRole("heading", { name: nextOpportunity.name })).toBeVisible();

  const failedRequest = await oldProfitAbort;
  expect(failedRequest.failure()?.errorText).toContain("ERR_ABORTED");
  releaseOldProfit();
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
  await expect(panel.getByRole("region", { name: "当前采购输入" })).toHaveCount(0);
  const detailReadsBeforeRetry = detailReads;
  const profitReadsBeforeRetry = profitReads;

  profitUnavailable = false;
  await panel.getByRole("button", { name: "重新读取利润数据", exact: true }).click();
  await expect(panel).toContainText("利润未知");
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

test("late competitor data stays scoped to the opportunity that requested it", async ({ page }) => {
  const oldCompetitor = {
      id: "old-competitor",
      opportunity_id: opportunityId,
      market: "US",
      source_site: "amazon",
      external_id: "B000000441",
      title: "旧机会关联竞品",
      snapshot_count: 0,
      latest_snapshot: null,
    },
    currentCompetitor = {
      ...oldCompetitor,
      id: "current-competitor",
      opportunity_id: nextOpportunityId,
      external_id: "B000000442",
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
  await page.route(/\/api\/v1\/competitors(?:\?.*)?$/, async (route) => {
    competitorReadCount += 1;
    if (competitorReadCount === 1) {
      markOldCompetitorsStarted();
      await oldCompetitorsGate;
      await route.fulfill({ json: envelope([oldCompetitor]) }).catch(() => {});
      return;
    }
    await route.fulfill({ json: envelope([currentCompetitor]) });
  });

  await page.goto(`/opportunities/${opportunityId}?tab=competition`);
  await oldCompetitorsStarted;
  const currentDetailRequest = page.waitForRequest((request) =>
    request.url().includes(`/api/v1/opportunities/${nextOpportunityId}`),
  );
  const oldCompetitorsAbort = page.waitForEvent(
    "requestfailed",
    (request) =>
      request.url().includes("/api/v1/competitors") &&
      request.failure()?.errorText.includes("ERR_ABORTED"),
  );
  await switchOpportunityInPlace(page, nextOpportunityId, "tab=competition");
  await currentDetailRequest;
  await expect(page.getByText("当前机会关联竞品", { exact: true })).toBeVisible();

  const failedCompetitorsRequest = await oldCompetitorsAbort;
  expect(failedCompetitorsRequest.failure()?.errorText).toContain("ERR_ABORTED");
  releaseOldCompetitors();
  await expect(page.getByText("当前机会关联竞品", { exact: true })).toBeVisible();
  await expect(page.getByText("旧机会关联竞品", { exact: true })).toHaveCount(0);
});

for (const submittedAction of [
  { action: "adopt", trigger: "采纳建议", dialog: "记录采纳决定" },
  { action: "observe", trigger: "继续观察", dialog: "记录继续观察决定" },
  { action: "reject", trigger: "驳回", dialog: "记录驳回决定" },
] as const) {
  for (const closeMethod of ["escape", "header", "footer"] as const) {
    test(`a delayed ${submittedAction.action} receipt after ${closeMethod} cannot close a newer decision dialog`, async ({
      page,
    }) => {
      await ready(page, evidence, submittedAction.action === "adopt" ? recommendedBase : {});
      let releaseDecision!: () => void;
      let markDecisionStarted!: () => void;
      const decisionGate = new Promise<void>((resolve) => (releaseDecision = resolve));
      const decisionStarted = new Promise<void>((resolve) => (markDecisionStarted = resolve));
      let decisionRequests = 0;
      await page.route(`**/api/v1/opportunities/${opportunityId}/decisions`, async (route) => {
        decisionRequests += 1;
        markDecisionStarted();
        await decisionGate;
        await route.fulfill({
          status: 201,
          json: envelope({
            opportunity_id: opportunityId,
            decision_status: "observing",
            version: 2,
          }),
        });
      });

      await page.goto(`/opportunities/${opportunityId}`);
      await expect(page.getByRole("heading", { name: base.name })).toBeVisible();
      if (submittedAction.action !== "adopt")
        await page.getByText("提前人工处理", { exact: true }).click();
      await page.getByRole("button", { name: submittedAction.trigger, exact: true }).last().click();
      const dialog = page.getByRole("dialog", { name: submittedAction.dialog });
      await expect(dialog).toHaveAccessibleName(submittedAction.dialog);
      await expect(page.locator('[id="opportunity-decision-dialog-title"]')).toHaveCount(1);
      await dialog.getByLabel("原因（必填）").fill("离页前已提交的决定");
      await dialog.getByRole("button", { name: "确认记录" }).click();
      await decisionStarted;

      if (closeMethod === "escape") await page.keyboard.press("Escape");
      else
        await dialog
          .getByRole("button", { name: closeMethod === "header" ? "关闭" : "取消", exact: true })
          .click();
      await expect(dialog).toBeHidden();
      const secondAction = page.getByRole("button", { name: "驳回", exact: true }).last();
      if (submittedAction.action === "reject")
        await page.getByRole("button", { name: "继续观察", exact: true }).last().click();
      else await secondAction.click();
      const reopenedAction = submittedAction.action === "reject" ? "observe" : "reject";
      const rejectedDialog = page.getByRole("dialog", {
        name: reopenedAction === "reject" ? "记录驳回决定" : "记录继续观察决定",
      });
      await expect(rejectedDialog).toBeVisible();
      const decisionResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/v1/opportunities/${opportunityId}/decisions`) &&
          response.status() === 201,
      );
      releaseDecision();
      await decisionResponse;
      await page.waitForLoadState("networkidle");
      await expect(rejectedDialog).toBeVisible();
      await expect(rejectedDialog.getByLabel("原因（必填）")).toHaveValue("");
      expect(decisionRequests).toBe(1);
    });
  }
}

test("P18 decision receipt for an old opportunity cannot refresh the current opportunity", async ({
  page,
}) => {
  await ready(page);
  await readyForNextOpportunity(page);
  let releaseDecision!: () => void;
  let markDecisionStarted!: () => void;
  const decisionGate = new Promise<void>((resolve) => (releaseDecision = resolve));
  const decisionStarted = new Promise<void>((resolve) => (markDecisionStarted = resolve));
  let nextDetailReads = 0;
  await page.route(`**/api/v1/opportunities/${nextOpportunityId}`, (route) => {
    nextDetailReads += 1;
    return route.fallback();
  });
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
  await dialog.getByLabel("原因（必填）").fill("旧机会已提交的决定");
  await dialog.getByRole("button", { name: "确认记录" }).click();
  await decisionStarted;

  const currentDetailRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === `/api/v1/opportunities/${nextOpportunityId}`;
  });
  await switchOpportunityInPlace(page, nextOpportunityId);
  await currentDetailRequest;
  await expect(page.getByRole("heading", { name: nextOpportunity.name })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  const currentDetailReads = nextDetailReads;

  const oldDecisionResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/opportunities/${opportunityId}/decisions`) &&
      response.request().method() === "POST" &&
      response.status() === 201,
  );
  releaseDecision();
  await oldDecisionResponse;

  await expect(page.getByRole("heading", { name: nextOpportunity.name })).toBeVisible();
  await expect(page.locator(".opportunity-message")).toHaveCount(0);
  expect(nextDetailReads).toBe(currentDetailReads);
});

for (const decision of [
  {
    action: "adopt",
    trigger: "采纳建议",
    dialog: "记录采纳决定",
    reason: "五项质量门通过后采纳",
    decisionStatus: "adopted",
    opportunity: recommendedBase,
  },
  {
    action: "observe",
    trigger: "继续观察",
    dialog: "记录继续观察决定",
    reason: "核实趋势后继续观察",
    decisionStatus: "observing",
    opportunity: base,
  },
  {
    action: "reject",
    trigger: "驳回",
    dialog: "记录驳回决定",
    reason: "当前证据不满足准入条件",
    decisionStatus: "rejected",
    opportunity: base,
  },
] as const) {
  test(`P18 ${decision.action} decision rejects same-tick reentry while its POST is pending`, async ({
    page,
  }) => {
    await ready(
      page,
      decision.action === "adopt" ? evidence : undefined,
      decision.action === "adopt" ? recommendedBase : undefined,
    );
    let releaseDecision!: () => void;
    let markDecisionStarted!: () => void;
    const decisionGate = new Promise<void>((resolve) => (releaseDecision = resolve));
    const decisionStarted = new Promise<void>((resolve) => (markDecisionStarted = resolve));
    const submittedBodies: Record<string, unknown>[] = [];
    await page.route(`**/api/v1/opportunities/${opportunityId}/decisions`, async (route) => {
      submittedBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      markDecisionStarted();
      await decisionGate;
      await route.fulfill({
        status: 201,
        json: envelope({
          opportunity_id: opportunityId,
          decision_status: decision.decisionStatus,
          version: decision.opportunity.version + 1,
        }),
      });
    });

    await page.goto(`/opportunities/${opportunityId}`);
    if (decision.action !== "adopt") await page.getByText("提前人工处理", { exact: true }).click();
    await page.getByRole("button", { name: decision.trigger, exact: true }).last().click();
    const dialog = page.getByRole("dialog", { name: decision.dialog });
    await dialog.getByLabel("原因（必填）").fill(decision.reason);
    const form = dialog.locator("form");

    await form.evaluate((element) => {
      const formElement = element as HTMLFormElement;
      formElement.requestSubmit();
      formElement.requestSubmit();
    });
    await decisionStarted;

    expect(submittedBodies).toEqual([
      {
        action: decision.action,
        reason: decision.reason,
        expected_version: decision.opportunity.version,
      },
    ]);
    const response = page.waitForResponse(
      (candidate) =>
        candidate.url().includes(`/api/v1/opportunities/${opportunityId}/decisions`) &&
        candidate.status() === 201,
    );
    releaseDecision();
    await response;
    await expect(dialog).toBeHidden();
  });
}

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
  await expect(actionDock).toHaveCSS("display", "flex");
  for (const button of await actionDock.getByRole("button").all()) {
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
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
  await expect(page.getByRole("link", { name: base.name, exact: true })).toBeVisible();
});

test("selection views send explicit truthful recommendation filters", async ({ page }) => {
  await ready(page);
  const recommended = page.waitForRequest((request) =>
    request.url().includes("selection_view=recommended"),
  );
  await page.goto("/opportunities?view=recommended");
  await recommended;
  await expect(page.getByRole("button", { name: "推荐商品" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const queueButtons = page.locator(".catalogue-controls > nav button");
  await expect(queueButtons).toHaveCount(5);
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
  await page.getByRole("button", { name: "候选商品" }).click();
  await ruleCandidates;
  await expect(page).toHaveURL(/view=rule_candidates/);
  await expect(page.getByRole("heading", { name: "选品候选", level: 2 })).toBeVisible();

  const evidencePending = page.waitForRequest((request) =>
    request.url().includes("selection_view=evidence_pending"),
  );
  await page.getByRole("button", { name: "采集中" }).click();
  await evidencePending;
  await expect(page).toHaveURL(/view=evidence_pending/);
  await expect(
    page.getByRole("heading", { name: "1 个商品仍在采集", exact: true, level: 2 }),
  ).toBeVisible();

  const all = page.waitForRequest((request) => request.url().includes("selection_view=all"));
  await page.getByRole("button", { name: "全部商品" }).click();
  await all;
  await expect(page).toHaveURL(/view=all/);
  await expect(page.getByRole("button", { name: "手工添加", exact: true })).toHaveCount(0);
});

test("opportunity URL state and source return path survive list-detail navigation", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/opportunities?q=AI&coverage_status=partial");
  await expect(page.getByLabel("商品名称")).toHaveValue("AI");
  await page.getByRole("button", { name: /高级筛选/ }).click();
  await expect(page.getByLabel("证据完整度")).toHaveValue("partial");
  await page
    .getByRole("dialog", { name: "高级筛选" })
    .getByRole("button", { name: "关闭筛选条件", exact: true })
    .click();
  const result = page.locator("a").filter({ hasText: base.name });
  await result.click();
  await expect(page).toHaveURL(new RegExp(`/opportunities/${opportunityId}\\?from=`));
  await page.getByRole("link", { name: "← 返回来源列表" }).click();
  await expect(page).toHaveURL(/\/opportunities\?q=AI&coverage_status=partial$/);
  await expect(page.getByLabel("商品名称")).toHaveValue("AI");
});

test("opportunity detail tab supports a direct URL", async ({ page }) => {
  await ready(page);
  await page.goto(`/opportunities/${opportunityId}?tab=evidence`);
  const directory = page.locator(".selection-detail-navigation");
  await expect(directory.getByRole("button", { name: "情报证据", exact: true })).toHaveAttribute(
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

test("source prices remain visible when generic product profit has not been calculated", async ({
  page,
}) => {
  await ready(page);
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) =>
    route.fulfill({
      json: envelope({
        latest_run: null,
        cost_input_reviews: [],
        current_inputs: [
          {
            input_type: "sale_price",
            amount_value: 25,
            currency: "USD",
            platform: "amazon",
            source_type: "automatic_crawler_evidence",
            source_ref_id: "amazon:fixture-price",
            evidence_id: topicId,
            observed_at: "2026-10-17T00:00:00.000Z",
            input_version: 1,
            confirmation_mode: "automatic_evidence",
          },
          {
            input_type: "purchase_price",
            amount_value: 5,
            currency: "CNY",
            platform: "amazon",
            source_type: "automatic_crawler_evidence",
            source_ref_id: "1688:fixture-offer:p75:3",
            evidence_id: topicId,
            observed_at: "2026-10-17T00:00:00.000Z",
            input_version: 1,
            confirmation_mode: "automatic_evidence",
          },
        ],
      }),
    }),
  );
  await page.goto(`/opportunities/${opportunityId}?tab=profit`);
  const panel = page.locator(".opportunity-profit");
  await expect(panel.getByText("利润未知", { exact: true })).toBeVisible();
  await panel.getByText("查看计算依据", { exact: true }).click();
  const prices = panel.locator(".profit-current-inputs");
  await expect(prices.getByText("25 USD · amazon", { exact: true })).toBeVisible();
  await expect(prices.getByText("5 CNY · amazon", { exact: true })).toBeVisible();
  await expect(prices.getByText("采购价", { exact: true })).toBeVisible();
  await expect(prices.getByText(/1688:fixture-offer:p75:3/)).toBeVisible();
  await expect(panel.locator(".profit-summary")).toHaveCount(0);
});

test("unknown current profit stays explicit even when a historical calculated run exists", async ({
  page,
}) => {
  await ready(page, undefined, { profit_status: "insufficient_data" });
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) =>
    route.fulfill({
      json: envelope({
        latest_run: {
          status: "calculated",
          rule_version_code: "historical-phone-cost",
          sale_price: 25,
          total_cost: 12.66,
          net_profit: 12.34,
          net_margin_percent: 49.36,
          currency: "USD",
          components: [],
          missing_fields: [],
        },
        current_inputs: [],
        cost_input_reviews: [],
      }),
    }),
  );
  await page.goto(`/opportunities/${opportunityId}?tab=profit`);
  const panel = page.locator(".opportunity-profit");
  await expect(page.locator(".selection-product-header")).toContainText("利润未知");
  await expect(panel.getByText("利润未知", { exact: true })).toBeVisible();
  await expect(panel).toContainText("下方保留上次计算明细，不作为当前利润");
  await expect(panel.locator(".profit-summary")).toHaveCount(0);
  await expect(panel).not.toContainText("12.34");
});

// Actual Vue with twenty isolated rows; not real inventory or a production collection result.
test("compact catalogue exposes the first product title above the fold with twenty rows", async ({
  page,
}) => {
  await ready(page);
  const products = Array.from({ length: 20 }, (_, index) => ({
    ...recommendedBase,
    id: `00000000-0000-4000-8000-${String(800 + index).padStart(12, "0")}`,
    name: `目录演示商品 ${String(index + 1).padStart(2, "0")}`,
    main_asin: `B0FIX${String(index + 1).padStart(5, "0")}`,
    image_url: null,
    primary_product: {
      price: 19.99 + index,
      currency: "USD",
      rating_value: 4.5,
      review_count: 120 + index,
      captured_at: "2026-10-17T00:00:00Z",
      public_signals: null,
    },
  }));
  const longName =
    "Clear Magnetic Case for iPhone 17 Pro Max with Screen Protector, Military Grade Drop Protection, Anti-Yellowing Transparent Bumper and Non-Slip Grip";
  await page.route("**/api/v1/opportunities?*", (route) => {
    const all = new URL(route.request().url()).searchParams.get("selection_view") === "all";
    return route.fulfill({
      json: envelope(
        products.map((product, index) =>
          all && index === 0 ? { ...product, name: longName } : product,
        ),
        { page: 1, page_size: 20, total: 20 },
      ),
    });
  });
  await page.goto("/opportunities");
  await expect(page.locator(":is(.catalog-product,.selection-product-row)")).toHaveCount(20);
  await expect(page.getByRole("table", { name: "选品商品列表" })).toBeVisible();
  await expect(page.locator(".catalogue-readiness")).toHaveCount(0);
  const firstTitle = page
    .locator(":is(.catalog-product-identity,.selection-product-name) > strong")
    .first();
  await expect(firstTitle).toHaveText("目录演示商品 01");
  const box = await firstTitle.boundingBox();
  const bottomReserve = page.viewportSize()!.width <= 760 ? 80 : 24;
  expect(box!.y).toBeGreaterThan(0);
  expect(box!.y + box!.height).toBeLessThan(page.viewportSize()!.height - bottomReserve);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  const paths = await page
    .locator(".selection-product-name a")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(new Set(paths).size).toBe(20);
  const allRead = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/v1/opportunities" && url.searchParams.get("selection_view") === "all"
    );
  });
  await page.getByRole("button", { name: "全部商品", exact: true }).click();
  await allRead;
  await expect(page.locator(":is(.catalog-product,.selection-product-row)")).toHaveCount(20);
  await expect(page.getByRole("navigation", { name: "选品批量操作", exact: true })).toHaveCount(0);
  await expect(firstTitle).toHaveText(longName);
  const firstCard = page.locator(":is(.catalog-product,.selection-product-row)").first();
  await expect(firstCard.locator("input[type=checkbox]")).toHaveCount(0);
  const titleLayout = await firstTitle.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + 8, rect.top + 8);
    return {
      height: rect.height,
      lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
      unobscured: Boolean(hit?.closest(".catalog-product-identity,.selection-product-name")),
    };
  });
  expect(titleLayout.height).toBeLessThanOrEqual(titleLayout.lineHeight * 2 + 1);
  expect(titleLayout.unobscured).toBe(true);
  await expect(page).toHaveScreenshot("catalogue-data-list-all-20261019.png", {
    fullPage: false,
  });
  const allBox = await firstTitle.boundingBox();
  expect(allBox!.y + allBox!.height).toBeLessThan(page.viewportSize()!.height - bottomReserve);
  await expect(page.getByRole("button", { name: /^批量/ })).toHaveCount(0);
});

test("catalogue advanced filters trap focus and cancel without changing the applied URL", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/opportunities");
  const trigger = page.getByRole("button", { name: "高级筛选", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "高级筛选" });
  const close = dialog.getByRole("button", { name: "关闭筛选条件", exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "重置", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await dialog.getByLabel("市场", { exact: true }).fill("CA");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/\/opportunities$/);
});

for (const configured of [true, false]) {
  test(`empty recommended catalogue offers ${configured ? "refresh without setup" : "the missing score configuration"}`, async ({
    page,
  }) => {
    await ready(page);
    if (!configured)
      await page.route("**/api/v1/opportunity-score-rules", (route) =>
        route.fulfill({ json: envelope([]) }),
      );
    let reads = 0;
    await page.route("**/api/v1/opportunities?*", (route) => {
      reads += 1;
      return route.fulfill({ json: envelope([], { page: 1, page_size: 20, total: 0 }) });
    });
    const configs = Promise.all([
      page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/v1/opportunity-score-rules",
      ),
      page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/cost-rules"),
    ]);
    await page.goto("/opportunities?view=recommended");
    await configs;
    await expect(page.getByRole("heading", { name: "暂无选品结果" })).toBeVisible();
    if (configured) {
      await expect(page.locator(".catalogue-readiness")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "完善自动推荐配置", exact: true })).toHaveCount(
        0,
      );
      const before = reads;
      await page.getByRole("button", { name: "刷新列表", exact: true }).click();
      await expect.poll(() => reads).toBeGreaterThan(before);
      await expect(page).toHaveURL(/view=recommended/);
    } else {
      await expect(page.locator(".catalogue-readiness")).toBeVisible();
      await expect(page.getByRole("link", { name: "设置评分规则", exact: true })).toHaveAttribute(
        "href",
        "/opportunities/scoring-rules",
      );
      await expect(
        page.getByRole("button", { name: "完善自动推荐配置", exact: true }),
      ).toBeVisible();
    }
  });
}

for (const coverage of ["covered", "insufficient_data"]) {
  test(`risk detail renders ${coverage} coverage without inferring it from the saved level`, async ({
    page,
  }) => {
    await ready(page, evidence, {
      risk_level: coverage === "covered" ? "high" : "low",
      section_status: {
        market: "covered",
        competition: "covered",
        profit: "insufficient_data",
        risk: coverage,
        execution: "not_available",
      },
    });
    await page.goto(`/opportunities/${opportunityId}?tab=risk`);
    const risk = page.locator(".opportunity-risk-facts");
    await expect(risk).toContainText(coverage === "covered" ? "高" : "低");
    if (coverage === "covered") {
      await expect(page.getByText("风险评估资料不完整", { exact: true })).toHaveCount(0);
      await expect(
        page.getByText("当前风险资料已覆盖，请结合原始证据核对已保存的风险等级。", { exact: true }),
      ).toBeVisible();
    } else {
      await expect(page.getByText("风险评估资料不完整", { exact: true })).toBeVisible();
      await expect(
        page.getByText("当前风险资料已覆盖，请结合原始证据核对已保存的风险等级。", { exact: true }),
      ).toHaveCount(0);
    }
    await expect(page.locator(".opportunity-collection-tools")).toHaveCount(0);
    await page.getByRole("button", { name: "商品与评分", exact: true }).click();
    await expect(page.getByText("补证异常时手动处理", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "采集 Amazon 竞品" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "采集公开供应商" })).toHaveCount(0);
  });
}

test("empty competitor detail reports absent records without claiming a collector is running", async ({
  page,
}) => {
  await ready(page, evidence, {}, ["opportunity:read", "competitor:read"]);
  await page.route("**/api/v1/competitors?*", (route) => route.fulfill({ json: envelope([]) }));
  await page.goto(`/opportunities/${opportunityId}?tab=competition`);
  await expect(page.getByText("暂无相关竞品记录，请核对采集结果。", { exact: true })).toBeVisible();
  await expect(page.getByText("正在等待相关商品的采集结果。", { exact: true })).toHaveCount(0);
});

const supplySearch = (id: string, inputRef = opportunityId) => ({
  id,
  input_type: "opportunity",
  input_ref: inputRef,
  status: "completed",
  candidate_count: 1,
  missing_fields: [],
  created_at: "2026-08-08T00:00:00.000Z",
  updated_at: "2026-08-08T00:00:00.000Z",
});
const supplyCandidate = {
  id: "supply-candidate",
  supplier_name: "示例1688工厂",
  product_title: "示例便携风扇",
  specification: "4000mAh / 5档",
  moq: 0,
  quoted_price: 0,
  source_price_description: "按规格报价 ¥8–15",
  currency: "CNY",
  lead_time_days: null,
  location: null,
  original_url: "https://detail.1688.com/offer/123456789012.html",
  observed_at: "2026-08-08T00:00:00.000Z",
  evidence_id: "supply-evidence",
  confidence_value: null,
  status: "candidate",
  missing_fields: ["lead_time_days"],
  quote: null,
};
const supplyCapabilities = ["opportunity:read", "sourcing:read"];

test("product supply quotes load on demand, retain raw facts and switch only related searches", async ({
  page,
}) => {
  await ready(
    page,
    evidence,
    { name: "便携充电风扇（界面示例）", category: "户外" },
    supplyCapabilities,
  );
  const reads: string[] = [];
  await page.route("**/api/v1/sourcing/searches", (route) =>
    route.fulfill({
      json: envelope([
        supplySearch("supply-first"),
        supplySearch("foreign-search", nextOpportunityId),
        supplySearch("supply-second"),
      ]),
    }),
  );
  await page.route("**/api/v1/sourcing/searches/*", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1)!;
    reads.push(id);
    return route.fulfill({
      json: envelope({
        ...supplySearch(id),
        candidates: [
          {
            ...supplyCandidate,
            supplier_name: id === "supply-first" ? "示例1688工厂" : "第二家工厂",
            currency: id === "supply-first" ? "CNY" : "USD",
            quoted_price: id === "supply-first" ? 0 : 12,
          },
        ],
      }),
    });
  });
  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: "评分与采集进度" })).toBeVisible();
  expect(reads).toEqual([]);
  await page.getByRole("button", { name: "货源与利润", exact: true }).click();
  const panel = page.getByRole("region", { name: "当前商品货源报价" });
  await expect(panel.getByText("示例1688工厂", { exact: true })).toBeVisible();
  await expect(panel).toContainText("CNY 0");
  const quoteBox = await panel.getByText("CNY 0", { exact: true }).boundingBox();
  expect(quoteBox!.x).toBeGreaterThanOrEqual(0);
  expect(quoteBox!.x + quoteBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expect(panel.getByLabel("找货记录").locator("option").first()).toContainText("记录 1");
  await expect(panel.getByLabel("找货记录").locator("option").last()).toContainText("记录 2");
  await expect(panel).toContainText("原始报价：按规格报价 ¥8–15");
  await expect(panel).toContainText("4000mAh / 5档");
  await expect(panel).toContainText("交期未提供");
  await expect(panel).toContainText("地点未提供");
  await expect(panel.getByRole("link", { name: "查看原始货源 ↗" })).toHaveAttribute(
    "href",
    supplyCandidate.original_url,
  );
  await expect(panel.getByLabel("找货记录").locator("option")).toHaveCount(2);
  await panel.getByText("报价依据", { exact: true }).click();
  await expect(panel).toContainText("采集证据 supply-evidence");
  await panel.getByLabel("找货记录").selectOption("supply-second");
  await expect(panel.getByText("第二家工厂", { exact: true })).toBeVisible();
  await expect(panel.getByText("示例1688工厂", { exact: true })).toHaveCount(0);
  await expect(panel).toContainText("USD 12");
  expect(reads).toEqual(["supply-first", "supply-second"]);
  await expect(page.locator(".opportunity-profit")).toContainText("利润未知");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test("product supply detail rejects foreign identity and retries without hiding profit", async ({
  page,
}) => {
  await ready(page, evidence, {}, supplyCapabilities);
  await page.route("**/api/v1/sourcing/searches", (route) =>
    route.fulfill({ json: envelope([supplySearch("supply-first")]) }),
  );
  let mismatch = true;
  await page.route("**/api/v1/sourcing/searches/supply-first", (route) =>
    route.fulfill({
      json: envelope({
        ...supplySearch("supply-first", mismatch ? nextOpportunityId : opportunityId),
        candidates: [supplyCandidate],
      }),
    }),
  );
  await page.goto(`/opportunities/${opportunityId}?tab=profit`);
  const panel = page.getByRole("region", { name: "当前商品货源报价" });
  await expect(panel).toContainText("货源报价暂不可用");
  await expect(panel.getByText("示例1688工厂", { exact: true })).toHaveCount(0);
  await expect(page.locator(".opportunity-profit")).toContainText("利润未知");
  mismatch = false;
  await panel.getByRole("button", { name: "重试读取货源报价" }).click();
  await expect(panel.getByText("示例1688工厂", { exact: true })).toBeVisible();
});

test("product supply permissions hide records and prevent quote reads", async ({ page }) => {
  await ready(page);
  let reads = 0;
  await page.route("**/api/v1/sourcing/searches*", (route) => {
    reads++;
    return route.fulfill({ json: envelope([]) });
  });
  await page.goto(`/opportunities/${opportunityId}?tab=profit`);
  const panel = page.getByRole("region", { name: "当前商品货源报价" });
  await expect(panel).toContainText("暂无供应链查看权限。");
  await expect(panel.getByLabel("找货记录")).toHaveCount(0);
  expect(reads).toBe(0);
});

test("product supply cancels a pending quote when leaving the profit section", async ({ page }) => {
  await ready(page, evidence, {}, supplyCapabilities);
  await page.route("**/api/v1/sourcing/searches", (route) =>
    route.fulfill({ json: envelope([supplySearch("supply-first")]) }),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/sourcing/searches/supply-first", async (route) => {
    await gate;
    await route
      .fulfill({
        json: envelope({ ...supplySearch("supply-first"), candidates: [supplyCandidate] }),
      })
      .catch(() => {});
  });
  const read = page.waitForRequest("**/api/v1/sourcing/searches/supply-first");
  await page.goto(`/opportunities/${opportunityId}?tab=profit`);
  await read;
  await expect(page.getByText("正在读取货源报价…", { exact: true })).toBeVisible();
  const aborted = page.waitForEvent(
    "requestfailed",
    (request) =>
      request.url().endsWith("/sourcing/searches/supply-first") &&
      /ERR_ABORTED/.test(request.failure()?.errorText ?? ""),
  );
  await page.getByRole("button", { name: "商品与评分", exact: true }).click();
  await aborted;
  release();
  await expect(page.getByRole("heading", { name: "评分与采集进度" })).toBeVisible();
  await expect(page.getByRole("region", { name: "当前商品货源报价" })).toHaveCount(0);
});

test("product supply ignores a superseded quote response after another search is selected", async ({
  page,
}) => {
  await ready(page, evidence, {}, supplyCapabilities);
  await page.route("**/api/v1/sourcing/searches", (route) =>
    route.fulfill({
      json: envelope([supplySearch("supply-first"), supplySearch("supply-second")]),
    }),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/sourcing/searches/supply-first", async (route) => {
    await gate;
    await route
      .fulfill({
        json: envelope({ ...supplySearch("supply-first"), candidates: [supplyCandidate] }),
      })
      .catch(() => {});
  });
  await page.route("**/api/v1/sourcing/searches/supply-second", (route) =>
    route.fulfill({
      json: envelope({
        ...supplySearch("supply-second"),
        candidates: [
          {
            ...supplyCandidate,
            supplier_name: "当前选中工厂",
            original_url: "javascript:alert(1)",
            quote: {
              id: "saved-quote",
              version: 2,
              stability_status: "unknown",
              risk_level: "unknown",
              observed_at: supplyCandidate.observed_at,
              evidence_id: "saved-quote-evidence",
            },
          },
        ],
      }),
    }),
  );
  const read = page.waitForRequest("**/api/v1/sourcing/searches/supply-first");
  await page.goto(`/opportunities/${opportunityId}?tab=profit`);
  await read;
  const panel = page.getByRole("region", { name: "当前商品货源报价" });
  await panel.getByLabel("找货记录").selectOption("supply-second");
  await expect(panel.getByText("当前选中工厂", { exact: true })).toBeVisible();
  release();
  await expect(panel).toContainText("已保存报价 v2");
  await expect(panel.getByRole("link")).toHaveCount(0);
  await expect(panel).toContainText("原始链接不可用");
  await panel.getByText("报价依据", { exact: true }).click();
  await expect(panel).toContainText("报价证据 saved-quote-evidence");
  await expect(panel.getByText("示例1688工厂", { exact: true })).toHaveCount(0);
});

for (const populated of [false, true]) {
  test(`primary product header preserves ${populated ? "observed zero values and sales lower bounds" : "unknown facts without claiming no advertising"}`, async ({
    page,
  }) => {
    await ready(page, evidence, {
      main_asin: "B0HG839FVV",
      primary_product: populated
        ? {
            price: 0,
            currency: "USD",
            rating_value: 0,
            review_count: 0,
            captured_at: "2026-10-18T02:00:00.000Z",
            public_signals: {
              sales_badge: {
                text: "100+ bought in past month",
                quantity_lower_bound: 100,
                period: "past_month",
              },
              sponsored: true,
              best_seller_rank: { rank: 25, text: "#25 in Home" },
            },
          }
        : null,
    });
    await page.goto(`/opportunities/${opportunityId}`);
    const header = page.locator(".selection-product-header");
    await expect(header.getByRole("definition")).toHaveCount(7);
    await expect(header).toContainText(populated ? "USD 0.00" : "售价未采集");
    await expect(header).toContainText(populated ? "0.0 / 0 条" : "— / 未采集");
    await expect(header).toContainText(populated ? "近月 ≥ 100" : "购买提示未采集");
    await expect(header).toContainText(populated ? "观察到广告标记" : "广告标记未提供");
    await expect(header).not.toContainText("没有广告");
    if (populated) {
      await expect(header).toContainText("购买提示为平台公开下限，非精确销量");
      await expect(header).toContainText("#25");
    }
    expect(await header.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await header.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(header.getByText(/数据版本 v/)).toBeVisible();
  });
}

test("detail sections lead with their own content and keep decisions in product scoring", async ({
  page,
}) => {
  await ready(page, evidence, {
    score_components: [
      {
        dimension_code: "profit",
        weight_percent: 30,
        input_score: null,
        weighted_score: null,
        evidence_ids: [],
        missing_fields: ["automatic_evaluation.profit.automatic_cost_scope_mismatch"],
      },
    ],
  });
  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.locator(".opportunity-decision-summary")).toHaveCount(1);
  await page.getByText("缺失项", { exact: true }).click();
  await expect(page.getByText("费用规则未覆盖当前商品类别", { exact: true })).toBeVisible();
  for (const name of ["竞品对比", "货源与利润", "情报证据", "风险", "决策记录"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".opportunity-decision-summary")).toHaveCount(0);
    await expect(page.locator(".opportunity-collection-tools")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "商品与评分", exact: true }).click();
  await expect(page.locator(".opportunity-decision-summary")).toHaveCount(1);
  await expect(page.locator(".opportunity-collection-tools")).toHaveCount(0);
});

test("product supply batches retain every quote and reset when switching records", async ({
  page,
}) => {
  await ready(page, evidence, {}, supplyCapabilities);
  await page.route("**/api/v1/sourcing/searches", (route) =>
    route.fulfill({ json: envelope([supplySearch("many"), supplySearch("other")]) }),
  );
  let reads = 0;
  await page.route("**/api/v1/sourcing/searches/*", (route) => {
    reads++;
    const id = new URL(route.request().url()).pathname.split("/").at(-1)!;
    return route.fulfill({
      json: envelope({
        ...supplySearch(id),
        candidates: Array.from({ length: 41 }, (_, index) => ({
          ...supplyCandidate,
          id: `${id}-${index}`,
          supplier_name: `工厂 ${index + 1}`,
        })),
      }),
    });
  });
  await page.goto(`/opportunities/${opportunityId}?tab=profit`);
  const panel = page.getByRole("region", { name: "当前商品货源报价" });
  await expect(panel.locator("tbody tr")).toHaveCount(20);
  await panel.getByRole("button", { name: "继续显示 20 个货源" }).click();
  await expect(panel.locator("tbody tr")).toHaveCount(40);
  await panel.getByRole("button", { name: "继续显示 1 个货源" }).click();
  await expect(panel.locator("tbody tr")).toHaveCount(41);
  await expect(panel.getByText("工厂 41", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "收起到前 20 个" }).click();
  await expect(panel.locator("tbody tr")).toHaveCount(20);
  await panel.getByRole("button", { name: "继续显示 20 个货源" }).click();
  await panel.getByLabel("找货记录").selectOption("other");
  await expect(panel.locator("tbody tr")).toHaveCount(20);
  await expect(panel.getByRole("status")).toHaveText("已显示 20 / 41 个候选");
  expect(reads).toBe(2);
  await expect(page.locator(".opportunity-profit")).toContainText("利润未知");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test("score rule inspection returns to the exact product and original list context", async ({
  page,
}) => {
  await ready(page);
  const original = `/opportunities/${opportunityId}?from=${encodeURIComponent("/opportunities?view=all&page=2&q=风扇")}`;
  await page.goto(original);
  await page.getByRole("link", { name: "规则版本", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/opportunities/scoring-rules\\?from="));
  await page.getByRole("link", { name: "← 返回选品", exact: true }).click();
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(original);
  await expect(page.getByRole("heading", { name: "评分与采集进度" })).toBeVisible();
  await expect(page.getByRole("link", { name: "← 返回来源列表" })).toHaveAttribute(
    "href",
    "/opportunities?view=all&page=2&q=风扇",
  );
});

for (const from of [
  "https://example.test/",
  "//example.test/",
  "/opportunities/scoring-rules?from=loop",
]) {
  test(`score rule return rejects an invalid or self-referencing source: ${from}`, async ({
    page,
  }) => {
    await ready(page);
    await page.goto(`/opportunities/scoring-rules?from=${encodeURIComponent(from)}`);
    await expect(page.getByRole("link", { name: "← 返回选品", exact: true })).toHaveAttribute(
      "href",
      "/opportunities",
    );
  });
}

test("competition basis explains approved median scope and unknown facts without collection writes", async ({
  page,
}) => {
  await ready(page);
  const writes = [];
  page.on("request", (r) => {
    if (r.method() === "POST") writes.push(r.url());
  });
  await page.goto(`/opportunities/${opportunityId}?tab=overview`);
  await page.getByText("规则适用范围与竞争评分依据", { exact: true }).click();
  const basis = page
    .locator("details")
    .filter({ has: page.getByText("规则适用范围与竞争评分依据", { exact: true }) });
  await expect(basis).toContainText("主品评价数不参与竞争分");
  await expect(basis).toContainText("至少5个");
  await expect(basis).toContainText("中位数");
  await expect(basis).toContainText("不按0分或默认分补齐");
  await expect(basis).toContainText("不按名称判断商品类目");
  expect(writes).toEqual([]);
});

for (const mode of ["automatic_evidence", "human_review", "missing"]) {
  test(`current purchase input stays separate from supplier candidates: ${mode}`, async ({
    page,
  }) => {
    await ready(page, evidence, {}, supplyCapabilities);
    await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) =>
      route.fulfill({
        json: envelope({
          latest_run: null,
          current_inputs:
            mode === "missing"
              ? []
              : [
                  {
                    input_type: "purchase_price",
                    amount_value: 18.6,
                    currency: "CNY",
                    source_type: "crawler",
                    source_ref_id: "offer-current",
                    evidence_id: "purchase-proof",
                    observed_at: "2026-08-08T00:00:00.000Z",
                    input_version: 3,
                    platform: "amazon",
                    confirmation_mode: mode,
                  },
                ],
          cost_input_reviews: [],
        }),
      }),
    );
    const writes = [];
    page.on("request", (r) => {
      if (r.method() === "POST") writes.push(r.url());
    });
    await page.goto(`/opportunities/${opportunityId}?tab=profit`);
    const current = page.getByRole("region", { name: "当前采购输入" });
    if (mode === "missing") await expect(current).toContainText("货源候选报价不等于已匹配进货价");
    else {
      await expect(current).toContainText("CNY 18.6");
      await expect(current).toContainText(mode === "human_review" ? "人工记录" : "自动证据记录");
      await current.getByText("采购输入依据", { exact: true }).click();
      await expect(current).toContainText("purchase-proof");
      await expect(current).toContainText("不代表双人复核已完成");
    }
    await expect(page.getByText("人工双人复核", { exact: true })).toHaveCount(0);
    expect(writes).toEqual([]);
  });
}

test("current purchase facts preserve distinct platforms without choosing or merging a price", async ({
  page,
}) => {
  await ready(page, evidence, {}, supplyCapabilities);
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) =>
    route.fulfill({
      json: envelope({
        latest_run: null,
        current_inputs: [
          {
            input_type: "purchase_price",
            amount_value: 18.6,
            currency: "CNY",
            source_ref_id: "first",
            evidence_id: "first-evidence",
            input_version: 1,
            platform: "amazon",
            confirmation_mode: "human_review",
          },
          {
            input_type: "purchase_price",
            amount_value: 8,
            currency: "USD",
            source_ref_id: "second",
            evidence_id: "second-evidence",
            input_version: 1,
            platform: "PLATFORM",
            confirmation_mode: "automatic_evidence",
          },
        ],
      }),
    }),
  );
  await page.goto(`/opportunities/${opportunityId}?tab=profit`);
  const current = page.getByRole("region", { name: "当前采购输入" });
  await expect(current).toContainText("amazon");
  await expect(current).toContainText("PLATFORM");
  await expect(current).toContainText("CNY 18.6");
  await expect(current).toContainText("USD 8");
  await expect(current.getByText("采购输入依据", { exact: true })).toHaveCount(2);
});

for (const scenario of [
  {
    record: "queued",
    task: "blocked_captcha",
    recordLabel: "等待采集",
    taskLabel: "验证受阻",
    blocked: 1,
    active: 0,
    hasCandidate: false,
  },
  {
    record: "queued",
    task: "running",
    recordLabel: "等待采集",
    taskLabel: "采集中",
    blocked: 0,
    active: 1,
    hasCandidate: false,
  },
  {
    record: "succeeded_empty",
    task: "succeeded",
    recordLabel: "未找到可用候选",
    taskLabel: "采集成功",
    blocked: 0,
    active: 0,
    hasCandidate: false,
  },
  {
    record: "completed_with_warnings",
    task: "failed_terminal",
    recordLabel: "已完成但有缺失",
    taskLabel: "采集失败",
    blocked: 0,
    active: 0,
    hasCandidate: true,
  },
]) {
  test(`supplier record status and task facts are separate: ${scenario.task}`, async ({ page }) => {
    await ready(page, evidence, {}, supplyCapabilities);
    await page.route("**/api/v1/sourcing/searches", (r) =>
      r.fulfill({
        json: envelope([
          {
            ...supplySearch("state-proof"),
            status: scenario.record,
            candidate_count: scenario.hasCandidate ? 1 : 0,
          },
        ]),
      }),
    );
    let reads = 0;
    const writes = [];
    page.on("request", (r) => {
      if (r.method() === "POST") writes.push(r.url());
    });
    await page.route("**/api/v1/sourcing/searches/state-proof", (r) => {
      reads++;
      return r.fulfill({
        json: envelope({
          ...supplySearch("state-proof"),
          status: scenario.record,
          candidate_count: scenario.hasCandidate ? 1 : 0,
          candidates: scenario.hasCandidate ? [supplyCandidate] : [],
          missing_fields: ["specification"],
          collection_progress: {
            status: scenario.task,
            total_subqueries: 1,
            successful_subqueries: scenario.task === "succeeded" ? 1 : 0,
            failed_subqueries: scenario.task === "failed_terminal" ? 1 : 0,
            blocked_subqueries: scenario.blocked,
            active_subqueries: scenario.active,
            available_at: "2026-08-08T00:00:00.000Z",
          },
        }),
      });
    });
    await page.goto(`/opportunities/${opportunityId}?tab=profit`);
    const facts = page.getByRole("region", { name: "当前找货状态" });
    await expect(facts).toContainText(`记录状态：${scenario.recordLabel}`);
    await expect(facts).toContainText(`关联任务状态：${scenario.taskLabel}`);
    await expect(facts).toContainText(`受阻 ${scenario.blocked}`);
    await expect(facts).toContainText(`待处理/执行中 ${scenario.active}`);
    await facts.getByText("记录缺失项", { exact: true }).click();
    await expect(facts).toContainText("specification");
    const previous = reads;
    await facts.getByRole("button", { name: "重新读取找货记录", exact: true }).click();
    await expect.poll(() => reads).toBe(previous + 1);
    await expect(page.getByRole("region", { name: "当前找货状态" })).toContainText(
      scenario.taskLabel,
    );
    if (scenario.hasCandidate)
      await expect(
        page
          .getByRole("region", { name: "当前商品货源报价" })
          .getByText(supplyCandidate.supplier_name, { exact: true }),
      ).toBeVisible();
    expect(writes).toEqual([]);
  });
}

test("supplier refresh preserves keyboard focus after successful GET", async ({ page }) => {
  await ready(page, evidence, {}, supplyCapabilities);
  const record = {
    ...supplySearch("focus-record"),
    status: "succeeded_empty",
    candidate_count: 0,
    candidates: [],
  };
  await page.route("**/api/v1/sourcing/searches", (r) => r.fulfill({ json: envelope([record]) }));
  let reads = 0;
  await page.route("**/api/v1/sourcing/searches/focus-record", (r) => {
    reads++;
    return r.fulfill({ json: envelope(record) });
  });
  await page.goto(`/opportunities/${opportunityId}?tab=profit`);
  const button = page.getByRole("button", { name: "重新读取找货记录", exact: true });
  await expect(button).toBeVisible();
  await button.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => reads).toBe(2);
  await expect(button).toBeVisible();
  console.log(
    "REFRESH_FOCUS " +
      JSON.stringify({
        focused: await button.evaluate((el) => el === document.activeElement),
        reads,
      }),
  );
  await expect(button).toBeFocused();
});

for (const fail of [false, true]) {
  test(`supplier refresh keeps focus and guards pending requests (${fail ? "retry" : "success"})`, async ({
    page,
  }) => {
    await ready(page, evidence, {}, supplyCapabilities);
    const record = {
      ...supplySearch("focus-pending"),
      status: "succeeded_empty",
      candidate_count: 0,
      candidates: [],
    };
    await page.route("**/api/v1/sourcing/searches", (route) =>
      route.fulfill({ json: envelope([record]) }),
    );
    let reads = 0;
    let allowRecovery = false;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/v1/sourcing/searches/focus-pending", async (route) => {
      reads++;
      if (reads === 2) {
        await pending;
      }
      if (fail && reads >= 2 && !allowRecovery) {
        await route.fulfill({ status: 503, body: "Unavailable" });
        return;
      }
      await route.fulfill({ json: envelope(record) });
    });
    await page.goto(`/opportunities/${opportunityId}?tab=profit`);
    const button = page.getByRole("button", { name: "重新读取找货记录", exact: true });
    await expect(button).toBeVisible();
    await button.focus();
    await page.keyboard.press("Enter");
    const busy = page.getByRole("button", { name: "读取中…", exact: true });
    await expect(busy).toHaveAttribute("aria-disabled", "true");
    await expect(busy).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    expect(reads).toBe(2);
    release();
    if (fail) {
      const retry = page.getByRole("button", { name: "重试读取货源报价", exact: true });
      await expect(retry).toBeFocused();
      expect(reads).toBe(4);
      allowRecovery = true;
      await page.keyboard.press("Enter");
      await expect.poll(() => reads).toBe(5);
    }
    await expect(button).toBeFocused();
  });
}

for (const hasSnapshot of [true, false]) {
  test(`comparison exposes current snapshot provenance without inferring score membership (${hasSnapshot})`, async ({
    page,
  }) => {
    await ready(page, evidence, { main_asin: "B000000000" }, [
      "opportunity:read",
      "competitor:read",
    ]);
    const reads: string[] = [];
    let writes = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/competitors")) reads.push(request.url());
      if (request.url().includes("/api/v1/") && request.method() !== "GET") writes++;
    });
    await page.route(/\/api\/v1\/competitors(?:\?.*)?$/, (route) =>
      route.fulfill({
        json: envelope([
          {
            id: "provenance-competitor",
            opportunity_id: opportunityId,
            market: "US",
            source_site: "amazon",
            external_id: "B000000001",
            title: "证据可核对竞品",
            snapshot_count: hasSnapshot ? 1 : 0,
            latest_snapshot: hasSnapshot
              ? {
                  id: "snapshot-proof-123",
                  evidence_id: "evidence-proof-456",
                  current_price: 19.99,
                  currency: "USD",
                  review_count: 200,
                  rating_value: 4.3,
                  captured_at: "2026-10-17T00:00:00Z",
                  freshness: "stale",
                  source_status: "degraded",
                  detail_collected: false,
                  source_enabled: false,
                }
              : null,
          },
        ]),
      }),
    );
    await page.goto(`/opportunities/${opportunityId}?tab=competition`);
    const row = page
      .getByRole("region", { name: "Amazon 主品与竞品" })
      .locator('tbody tr[data-product-role="competitor"]')
      .first();
    await expect(row).toContainText("证据可核对竞品");
    console.log(
      "PROVENANCE " +
        JSON.stringify({ hasSnapshot, hasEvidence: (await row.innerText()).includes("详情依据") }),
    );
    await row.getByText("详情依据", { exact: true }).click();
    const fact = row.locator(".selection-comparison-provenance p").first();
    await expect(fact).toHaveCSS("font-weight", "400");
    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontSize);
    await expect(fact).toHaveCSS("font-size", bodyFont);
    const textColor = await page
      .getByRole("region", { name: "Amazon 主品与竞品" })
      .evaluate((el) => getComputedStyle(el).color);
    await expect(fact).toHaveCSS("color", textColor);
    if (hasSnapshot) {
      await expect(row).toContainText("snapshot-proof-123");
      await expect(row).toContainText("evidence-proof-456");
      await expect(row).toContainText("来源状态：降级");
      await expect(row).toContainText("详情证据：未通过");
      await expect(row).toContainText("新鲜度：已过期");
      await expect(row).toContainText("来源启用：已停用");
    } else {
      await expect(row).toContainText("快照编号：未知");
      await expect(row).toContainText("证据编号：未知");
      await expect(row).toContainText("来源状态：未知");
      await expect(row).toContainText("详情证据：未知");
    }
    await expect(row).toContainText("仅为当前快照资料，不代表该快照或评价数参与历史评分。");
    expect(reads).toHaveLength(1);
    expect(writes).toBe(0);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  });
}

for (const hasMainRecord of [true, false]) {
  test(`comparison keeps missing competitor facts honest with main record ${hasMainRecord}`, async ({
    page,
  }) => {
    await ready(page, evidence, { main_asin: "B000000000" }, [
      "opportunity:read",
      "competitor:read",
    ]);
    let writes = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/") && request.method() !== "GET") writes++;
    });
    await page.route(/\/api\/v1\/competitors(?:\?.*)?$/, (route) =>
      route.fulfill({
        json: envelope(
          hasMainRecord
            ? [
                {
                  id: "primary-only",
                  opportunity_id: opportunityId,
                  market: "US",
                  source_site: "amazon",
                  external_id: "B000000000",
                  title: "只有主品记录",
                  snapshot_count: 0,
                  latest_snapshot: null,
                },
              ]
            : [],
        ),
      }),
    );
    await page.goto(`/opportunities/${opportunityId}?tab=competition`);
    const comparison = page.getByRole("region", { name: "Amazon 主品与竞品" });
    await expect(comparison.locator('tr[data-product-role="primary"]')).toHaveCount(
      hasMainRecord ? 1 : 0,
    );
    await expect(comparison.locator('tr[data-product-role="competitor"]')).toHaveCount(0);
    await expect(comparison).toContainText("竞品对比 0 个");
    await expect(comparison).toContainText("详情齐备快照 0 / 至少 5 个");
    await expect(comparison).toContainText("暂无相关竞品记录，请核对采集结果。");
    if (hasMainRecord) {
      const row = comparison.locator('tr[data-product-role="primary"]');
      await expect(row.locator("td")).toHaveCount(7);
      await expect(row).toContainText("未采集");
      await expect(row).toContainText("未知");
      await expect(row).not.toContainText("当前评价门槛试算");
    } else await expect(comparison).toContainText("主品详情待采集");
    expect(writes).toBe(0);
  });
}
