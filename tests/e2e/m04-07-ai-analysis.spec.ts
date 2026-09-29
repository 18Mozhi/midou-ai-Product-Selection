import { test, expect, type Page } from "@playwright/test";
import { verifyAuditedReasonFocus } from "./helpers/audited-reason-focus";
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

async function openTab(page: Page, label: string) {
  const mobileDirectory = page.locator(".opportunity-detail-directory-mobile");
  if ((page.viewportSize()?.width ?? 0) <= 900) {
    const isOpen = await mobileDirectory.evaluate(
      (element) => (element as HTMLDetailsElement).open,
    );
    if (!isOpen) await mobileDirectory.locator("summary").click();
  }
  await page.getByRole("button", { name: label }).click();
}

test("a delayed AI enqueue receipt does not override a newer tab choice", async ({ page }) => {
  let releaseQueue!: () => void;
  let markQueueStarted!: () => void;
  const queueGate = new Promise<void>((resolve) => (releaseQueue = resolve));
  const queueStarted = new Promise<void>((resolve) => (markQueueStarted = resolve));
  await setup(page);
  await page.route(`**/api/v1/opportunities/${opportunityId}/ai-analyses`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    markQueueStarted();
    await queueGate;
    await route.fulfill({ status: 202, json: envelope({ id: "queued-ai-analysis" }) });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await openTab(page, "AI 辅助");
  await page.getByRole("button", { name: "生成新分析" }).click();
  await queueStarted;

  const overviewTab = page.getByRole("button", { name: "结论", exact: true });
  await overviewTab.click();
  await expect(overviewTab).toHaveAttribute("aria-current", "page");
  const queueResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/opportunities/${opportunityId}/ai-analyses`) &&
      response.request().method() === "POST",
  );
  releaseQueue();
  await queueResponse;
  await page.waitForLoadState("networkidle");
  await expect(overviewTab).toHaveAttribute("aria-current", "page");
});

test("P18 shared write lock rejects immediate repeated AI enqueue events", async ({ page }) => {
  let enqueueRequests = 0;
  let releaseEnqueue!: () => void;
  let markEnqueueStarted!: () => void;
  const enqueueGate = new Promise<void>((resolve) => (releaseEnqueue = resolve));
  const enqueueStarted = new Promise<void>((resolve) => (markEnqueueStarted = resolve));
  await setup(page);
  await page.route(`**/api/v1/opportunities/${opportunityId}/ai-analyses`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    enqueueRequests += 1;
    markEnqueueStarted();
    await enqueueGate;
    return route.fulfill({ status: 202, json: envelope({ id: "queued-ai-analysis" }) });
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await openTab(page, "AI 辅助");
  const enqueue = page.getByRole("button", { name: "生成新分析" });
  await enqueue.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await enqueueStarted;
  await page.waitForTimeout(100);

  expect(enqueueRequests).toBe(1);
  await expect(enqueue).toBeDisabled();
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes(`/api/v1/opportunities/${opportunityId}/ai-analyses`) &&
      candidate.request().method() === "POST",
  );
  releaseEnqueue();
  await response;
  await page.waitForLoadState("networkidle");
});

test("M04-07.A07/A08/A15 shows AI boundary evidence references and human sampling on desktop and 390", async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/opportunities/${opportunityId}`);
  await openTab(page, "AI 辅助");
  await expect(page.getByRole("heading", { name: "AI 辅助分析" })).toBeVisible();
  await expect(page.getByText("抽检 待复核")).toBeVisible();
  await expect(page.getByText(`opportunity:${opportunityId}`)).toHaveCount(2);
  await expect(page.getByRole("button", { name: "抽检通过" })).toBeVisible();
  await expect(page.getByText(/评分、利润、风险和决定仍以持久化事实与人工判断为准/)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
});

for (const outcome of ["approved", "rejected"] as const) {
  test(`UI2-SM01 AI ${outcome} reason keeps keyboard focus and cancels without a review`, async ({
    page,
  }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/") && !["GET", "HEAD"].includes(request.method()))
        writes.push(request.method());
    });
    await setup(page);
    await page.goto(`/opportunities/${opportunityId}`);
    await openTab(page, "AI 辅助");
    const trigger = page.getByRole("button", {
      name: outcome === "approved" ? "抽检通过" : "抽检驳回",
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", {
      name: outcome === "approved" ? "填写抽检通过说明" : "填写驳回原因",
    });
    await verifyAuditedReasonFocus(page, dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(writes).toEqual([]);
  });

  test(`UI2-SM02 AI ${outcome} failure restores the submitted reason without an automatic retry`, async ({
    page,
  }) => {
    const attempts: Array<Record<string, unknown>> = [];
    await setup(page);
    await page.route(`**/api/v1/ai-analyses/${resultId}/reviews`, (route) => {
      attempts.push(route.request().postDataJSON());
      if (attempts.length === 1)
        return route.fulfill({
          status: 503,
          json: {
            error: {
              code: "service_unavailable",
              message: "暂不可用",
              action_hint: "稍后确认抽检记录状态，再决定是否重试。",
            },
            request_id: "ui2-ai-review-failure",
            trace_id: "ui2-ai-review-failure",
          },
        });
      return route.fulfill({
        status: 201,
        json: envelope({ id: "00000000-0000-4000-8000-000000000706" }),
      });
    });
    await page.goto(`/opportunities/${opportunityId}`);
    await openTab(page, "AI 辅助");
    await page
      .getByRole("button", {
        name: outcome === "approved" ? "抽检通过" : "抽检驳回",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog", {
      name: outcome === "approved" ? "填写抽检通过说明" : "填写驳回原因",
    });
    await expect(dialog.getByRole("textbox", { name: /原因/ })).toHaveAttribute(
      "maxlength",
      "1000",
    );
    const reason = "核对来源后作出的人工抽检判断";
    await dialog.getByRole("textbox", { name: /原因/ }).fill(reason);
    await dialog.getByRole("button", { name: "确认提交" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: /原因/ })).toHaveValue(reason);
    await expect(dialog.getByRole("alert")).toContainText("稍后确认抽检记录状态，再决定是否重试。");
    expect(attempts).toEqual([{ outcome, notes: reason }]);

    await dialog.getByRole("button", { name: "确认提交" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(".opportunity-message")).toContainText("人工抽检已记录");
    expect(attempts).toEqual([
      { outcome, notes: reason },
      { outcome, notes: reason },
    ]);
  });
}

test("P18 AI review exposes its pending state and ignores a second action until the receipt", async ({
  page,
}) => {
  const attempts: Array<Record<string, unknown>> = [];
  let reviewed = false;
  let releaseReview!: () => void;
  let markReviewStarted!: () => void;
  let releaseRefresh!: () => void;
  let markRefreshStarted!: () => void;
  const reviewGate = new Promise<void>((resolve) => (releaseReview = resolve));
  const reviewStarted = new Promise<void>((resolve) => (markReviewStarted = resolve));
  const refreshGate = new Promise<void>((resolve) => (releaseRefresh = resolve));
  const refreshStarted = new Promise<void>((resolve) => (markRefreshStarted = resolve));
  await setup(page);
  await page.route(`**/api/v1/ai-analyses/${resultId}/reviews`, async (route) => {
    attempts.push(route.request().postDataJSON());
    markReviewStarted();
    await reviewGate;
    reviewed = true;
    await route.fulfill({ status: 201, json: envelope({ id: "saved-review" }) });
  });
  await page.route(`**/api/v1/opportunities/${opportunityId}/ai-analyses`, async (route) => {
    if (route.request().method() === "GET" && reviewed) {
      markRefreshStarted();
      await refreshGate;
      return route.fulfill({ json: envelope([]) });
    }
    return route.fallback();
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await openTab(page, "AI 辅助");
  await page.getByRole("button", { name: "抽检通过", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "填写抽检通过说明" });
  await dialog.getByRole("textbox", { name: /原因/ }).fill("已核对来源和事实引用");
  await dialog.getByRole("button", { name: "确认提交" }).click();
  await reviewStarted;

  await expect(page.locator(".opportunity-ai-review-progress")).toContainText("正在提交人工抽检");
  await expect(page.getByRole("button", { name: "抽检通过", exact: true })).toBeDisabled();
  const rejectButton = page.getByRole("button", { name: "抽检驳回", exact: true });
  await expect(rejectButton).toBeDisabled();
  await rejectButton.dispatchEvent("click");
  await expect(page.getByRole("dialog", { name: "填写驳回原因" })).toBeHidden();
  expect(attempts).toEqual([{ outcome: "approved", notes: "已核对来源和事实引用" }]);

  releaseReview();
  await refreshStarted;
  await expect(page.locator(".opportunity-ai-review-progress")).toContainText(
    "抽检已提交，正在刷新记录",
  );
  releaseRefresh();
  await expect(page.locator(".opportunity-message")).toContainText("人工抽检已记录");
  await expect(page.getByRole("button", { name: "抽检通过", exact: true })).toHaveCount(0);
  expect(attempts).toEqual([{ outcome: "approved", notes: "已核对来源和事实引用" }]);
});

test("P18 keeps the previous AI snapshot visible after malformed refresh and separates enqueue acceptance", async ({
  page,
}) => {
  let reads = 0;
  await setup(page);
  await page.route(`**/api/v1/opportunities/${opportunityId}/ai-analyses`, async (route) => {
    if (route.request().method() === "POST")
      return route.fulfill({ status: 202, json: envelope({ id: "queued-ai-analysis" }) });
    reads += 1;
    if (reads === 2) return route.fulfill({ json: envelope({ invalid: true }) });
    return route.fallback();
  });

  await page.goto(`/opportunities/${opportunityId}`);
  await openTab(page, "AI 辅助");
  await expect(
    page.getByText("当前机会已有市场方向，但评分、利润和风险证据仍不足。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "生成新分析" }).click();

  await expect(page.locator(".opportunity-message")).toContainText("已进入宝塔 Node Worker 队列");
  await expect(page.getByRole("alert")).toContainText("不能将其解释为没有分析记录");
  await expect(
    page.getByText("当前机会已有市场方向，但评分、利润和风险证据仍不足。"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "抽检通过" })).toBeDisabled();

  await page.getByRole("button", { name: "重新读取" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "抽检通过" })).toBeEnabled();
  expect(reads).toBe(3);
});
