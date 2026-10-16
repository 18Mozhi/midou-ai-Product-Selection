import { test, expect, type Page } from "@playwright/test";
const opportunityId = "00000000-0000-4000-8000-000000000701",
  envelope = (data: unknown) => ({
    data,
    request_id: "m04-07-e2e-request",
    trace_id: "m04-07-e2e-trace",
  });
async function setup(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=member", (r) =>
    r.fulfill({
      json: envelope({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000703",
        workspace_id: "00000000-0000-4000-8000-000000000704",
        roles: ["selection_manager"],
        capabilities: ["task:read", "opportunity:read", "opportunity:decide"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  const detail = {
    id: opportunityId,
    image_url: null,
    main_asin: "B000000001",
    adoption_blockers: [],
    name: "便携净水杯机会",
    market: "US",
    category: "outdoor",
    source_type: "manual",
    source_ref_id: null,
    owner_id: null,
    lifecycle_status: "ready",
    recommendation_status: "insufficient_data",
    overall_score: null,
    trend_score: null,
    competition_score: null,
    profit_status: "insufficient_data",
    risk_level: "unknown",
    confidence: { status: "insufficient_data", score: null },
    evidence_count: 1,
    source_count: 1,
    coverage_status: "partial",
    decision_status: "pending",
    version: 1,
    updated_at: "2026-08-08T12:00:00.000Z",
    score_rule_version: null,
    scored_at: null,
    latest_score_run: null,
    score_components: [],
    evidence: [],
    decisions: [],
    section_status: {
      market: "covered",
      competition: "insufficient_data",
      profit: "insufficient_data",
      risk: "insufficient_data",
      execution: "not_available",
    },
  };
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (r) =>
    r.fulfill({ json: envelope({ latest_run: null, current_inputs: [] }) }),
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (r) =>
    r.fulfill({ json: envelope(detail) }),
  );
  return detail;
}

// These retired user panels are intentionally absent. Backend AI validation remains covered separately.
for (const [retired, canonical] of [
  ["ai", null],
  ["lineage", null],
  ["feedback", null],
  ["market", "evidence"],
] as const) {
  test(`retired ${retired} detail links resolve to the core workflow without legacy requests`, async ({
    page,
  }) => {
    const unwantedRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/ai-analyses(?:[/?]|$)|\/operating-feedback(?:[/?]|$)/.test(request.url()))
        unwantedRequests.push(request.url());
    });
    await setup(page);
    await page.goto(
      `/opportunities/${opportunityId}?tab=${retired}&from=${encodeURIComponent("/opportunities?view=all")}`,
    );
    await expect(page.getByRole("heading", { name: "便携净水杯机会" })).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("tab")).toBe(canonical);
    expect(new URL(page.url()).searchParams.get("from")).toBe("/opportunities?view=all");
    const navigation = page.getByRole("navigation", { name: "选品详情分区" });
    await expect(navigation.getByRole("button")).toHaveText([
      "商品与评分",
      "竞品对比",
      "货源与利润",
      "情报证据",
      "风险",
      "决策记录",
    ]);
    await expect(
      navigation.getByRole("button", { name: canonical ? "情报证据" : "商品与评分", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page.getByRole("button", { name: /生成新分析|抽检通过|录入经营复盘|业务血缘/ }),
    ).toHaveCount(0);
    await expect(page.locator(".selection-detail-more")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    expect(unwantedRequests).toEqual([]);
  });
}
