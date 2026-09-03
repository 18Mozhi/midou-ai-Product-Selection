import { test, expect, type Page } from "@playwright/test";
const opportunityId = "00000000-0000-4000-8000-000000000701",
  resultId = "00000000-0000-4000-8000-000000000702",
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
  await page.route(`**/api/v1/opportunities/${opportunityId}/ai-analyses`, (r) =>
    r.fulfill({
      json: envelope([
        {
          id: "00000000-0000-4000-8000-000000000705",
          status: "succeeded",
          attempt_count: 1,
          last_error_code: null,
          input_sha256: "a".repeat(64),
          prompt_contract_version: "opportunity-assist-v1",
          created_at: "2026-08-08T12:01:00.000Z",
          result: {
            id: resultId,
            content: {
              summary: "当前机会已有市场方向，但评分、利润和风险证据仍不足。",
              classifications: [
                {
                  label: "需要人工补充",
                  rationale: "现有事实不足以支持可靠结论。",
                  source_refs: [`opportunity:${opportunityId}`],
                },
              ],
              missing_fields: [
                {
                  field: "profit",
                  reason: "尚无确定性利润运行。",
                  source_refs: [`opportunity:${opportunityId}`],
                },
              ],
            },
            ai_generated: true,
            model_name: "Qwen3.5-9B-AWQ-4bit",
            provider_request_id: "provider-test",
            review_status: "pending",
            review: null,
          },
        },
      ]),
    }),
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (r) =>
    r.fulfill({ json: envelope(detail) }),
  );
}
test("M04-07.A07/A08/A15 shows AI boundary evidence references and human sampling on desktop and 390", async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/opportunities/${opportunityId}`);
  await page.locator(".opportunity-tabs details > summary").click();
  await page.getByRole("button", { name: "AI 辅助" }).click();
  await expect(page.getByRole("heading", { name: "AI 辅助分析" })).toBeVisible();
  await expect(page.getByText("智能分析 · 待复核")).toBeVisible();
  await expect(page.getByText(`opportunity:${opportunityId}`)).toHaveCount(2);
  await expect(page.getByRole("button", { name: "抽检通过" })).toBeVisible();
  await expect(page.getByText("输出不能替代事实、评分、利润或人工决策。")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
});
