import { expect, test, type Page, type Request } from "@playwright/test";
import type { OpportunityDetail } from "../../apps/web/src/components/opportunity-workspace-types";

// Real Vue with isolated API fixtures; not a database, RBAC or production acceptance result.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const opportunityId = id(424),
  memberId = id(423),
  topicId = id(425);
const at = "2026-08-08T00:00:00.000Z";
const envelope = (data: unknown, meta?: unknown) => ({
  data,
  ...(meta ? { meta } : {}),
  request_id: "ui2-op-request",
  trace_id: "ui2-op-trace",
});
function detailFixture(): OpportunityDetail {
  return {
    id: opportunityId,
    name: "隔离机会候选",
    image_url: null,
    market: "US",
    category: null,
    source_type: "manual",
    source_ref_id: null,
    owner_id: memberId,
    lifecycle_status: "ready",
    lifecycle_entered_at: at,
    lifecycle_dwell_seconds: 60,
    recommendation_status: "insufficient_data",
    overall_score: null,
    trend_score: null,
    competition_score: null,
    profit_status: "insufficient_data",
    risk_level: "unknown",
    confidence: { status: "insufficient_data", score: null },
    evidence_count: 0,
    source_count: 0,
    competitor_count: 0,
    supplier_candidate_count: 0,
    matched_rule_count: 0,
    selection_stage: "not_eligible",
    quality_gates: {
      score: false,
      market: false,
      competition: false,
      cost: false,
      risk: false,
      all_passed: false,
    },
    coverage_status: "incomplete",
    blocking_reasons: ["evidence_insufficient", "recommendation_insufficient"],
    decision_status: "pending",
    version: 3,
    updated_at: at,
    operating_feedback: { facts: [], calibration: null },
    lineage: {
      freshness: { observed_at: null, age_seconds: null },
      failure_impact: { level: "none", codes: [], affected_stages: [] },
      request_ids: [],
      trace_ids: [],
      nodes: [],
    },
    adoption_blockers: [],
    redecision_ready: false,
    score_rule_version: null,
    scored_at: null,
    latest_score_run: null,
    score_components: [],
    evidence: [],
    decisions: [],
    section_status: {
      market: "insufficient_data",
      competition: "insufficient_data",
      profit: "insufficient_data",
      risk: "insufficient_data",
      execution: "not_available",
    },
  };
}
async function ready(page: Page, canDecide = true, extraCapabilities: string[] = []) {
  const detail = detailFixture();
  const data = {
    detail,
    rows: [detail, { ...detail, id: id(426), name: "第二个隔离候选", version: 7 }],
    queryRows: null as OpportunityDetail[] | null,
    writes: [] as Request[],
    detailReads: 0,
    listReads: 0,
  };
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      request.method() !== "GET" &&
      (path.startsWith("/api/v1/opportunities") || path === "/api/v1/imports/erp-products")
    )
      data.writes.push(request);
  });
  await page.route("**/api/v1/me/ui-preferences", (route) =>
    route.fulfill({ json: envelope({ theme: "deep-ocean", version: 1 }) }),
  );
  await page.route("**/api/v1/me/navigation?shell=member", (route) =>
    route.fulfill({
      json: envelope({
        shell: "member",
        organization_id: id(421),
        workspace_id: id(422),
        roles: ["member"],
        capabilities: [
          "opportunity:read",
          ...(canDecide ? ["opportunity:decide"] : []),
          ...extraCapabilities,
        ],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  for (const path of ["opportunity-score-rules", "cost-rules", "competitor-monitor-rules"])
    await page.route(`**/api/v1/${path}`, (route) => route.fulfill({ json: envelope([]) }));
  await page.route("**/api/v1/opportunities**", (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (request.method() !== "GET")
      return route.fulfill({ status: 500, json: { error: { code: "unexpected_test_write" } } });
    if (path.endsWith("/profit-analysis"))
      return route.fulfill({
        json: envelope({ latest_run: null, current_inputs: [], cost_input_reviews: [] }),
      });
    if (path.endsWith("/ai-analyses")) return route.fulfill({ json: envelope([]) });
    if (path === `/api/v1/opportunities/${opportunityId}`) {
      data.detailReads += 1;
      return route.fulfill({ json: envelope(data.detail) });
    }
    if (path === "/api/v1/opportunities") {
      data.listReads += 1;
      const url = new URL(request.url());
      const rows = url.searchParams.has("q") && data.queryRows ? data.queryRows : data.rows;
      return route.fulfill({
        json: envelope(rows, { total: rows.length, page: 1, page_size: 20 }),
      });
    }
    return route.fulfill({ status: 404, json: { error: { code: "unexpected_test_read" } } });
  });
  return data;
}
function assertWrite(request: Request, path: string, body: unknown) {
  expect(request.method()).toBe("POST");
  expect(new URL(request.url()).pathname).toBe(`/api/v1${path}`);
  expect(request.postDataJSON()).toEqual(body);
  for (const header of ["idempotency-key", "x-request-id", "x-trace-id"])
    expect(request.headers()[header]).toMatch(/^[0-9a-f-]{36}$/);
}
async function navigateSpa(page: Page, href: string) {
  await page.evaluate((target) => {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, href);
}

async function openOpportunitySection(page: Page, label: string) {
  const mobileDirectory = page.locator(".opportunity-detail-directory-mobile");
  if (await mobileDirectory.isVisible()) await mobileDirectory.locator("summary").click();
  await page
    .getByRole("navigation", { name: "选品详情分区" })
    .getByRole("button", { name: label, exact: true })
    .click();
}

test("completed analysis view survives refresh and view navigation without requiring recommendation setup", async ({
  page,
}) => {
  const data = await ready(page);
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/opportunities")
      requests.push(url.searchParams.get("selection_view") ?? "");
  });
  await page.goto("/opportunities?view=completed");
  await expect(page.getByRole("button", { name: "已完成分析", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("heading", { name: "2 个商品已完成分析" })).toBeVisible();
  await expect(
    page.getByText(
      "全部日期 · 按工作区内首次完成的主品 ASIN 去重，包含低分、不推荐和利润未知的结果。",
      { exact: true },
    ),
  ).toBeVisible();
  expect(requests.at(-1)).toBe("completed");
  await page.getByRole("button", { name: "推荐商品", exact: true }).click();
  await expect(page).not.toHaveURL(/view=completed/);
  await expect.poll(() => requests.at(-1)).toBe("recommended");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "2 个商品已完成分析" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "已完成分析", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(requests.at(-1)).toBe("completed");
  data.queryRows = [];
  await page.goto("/opportunities?view=completed&q=no-results");
  await expect(page.getByRole("heading", { name: "暂无选品结果" })).toBeVisible();
  await expect(page.getByRole("button", { name: "完善自动推荐配置", exact: true })).toHaveCount(0);
  expect(data.writes).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

for (const canDecide of [true, false]) {
  test(`UI2-OP01 retired manual and trend creation stay inactive with decision permission ${canDecide}`, async ({
    page,
  }) => {
    const data = await ready(page, canDecide, ["task:read"]);
    let createRequests = 0;
    await page.route("**/api/v1/opportunities", (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      createRequests += 1;
      return route.abort();
    });
    for (const view of ["recommended", "rule_candidates", "evidence_pending", "all"]) {
      await page.goto(
        `/opportunities?view=${view}&create=1&source_topic_id=${topicId}&name=retired-draft&market=US&category=home`,
      );
      await expect(page.locator(".opportunity-workspace--review")).toBeVisible();
      await expect(page.getByRole("button", { name: "手工添加", exact: true })).toHaveCount(0);
      await expect(page.getByRole("dialog", { name: "创建机会候选", exact: true })).toHaveCount(0);
    }
    await navigateSpa(page, "/home");
    await expect(page).toHaveURL(/\/home$/);
    await navigateSpa(
      page,
      `/opportunities?view=all&create=1&source_topic_id=${topicId}&name=cached-retired-draft`,
    );
    await expect(page.locator(".opportunity-workspace--review")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "创建机会候选", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "手工添加", exact: true })).toHaveCount(0);
    expect(createRequests).toBe(0);
    expect(data.writes).toHaveLength(0);
  });
}

for (const [action, label] of [
  ["observe", "继续观察"],
  ["reject", "驳回"],
] as const) {
  test(`UI2-OP03 ${action} preserves failed reason and records returned decision on explicit retry`, async ({
    page,
  }) => {
    const data = await ready(page);
    let attempts = 0;
    await page.route(`**/api/v1/opportunities/${opportunityId}/decisions`, (route) => {
      attempts += 1;
      if (attempts === 1)
        return route.fulfill({
          status: 503,
          json: {
            error: {
              code: "service_unavailable",
              message: "暂不可用",
              action_hint: "稍后重试记录决定。",
            },
            request_id: "ui2-decision-failure",
            trace_id: "ui2-decision-failure",
          },
        });
      const body = route.request().postDataJSON();
      data.detail.version = 4;
      data.detail.decision_status = action === "observe" ? "observing" : "rejected";
      data.detail.decisions = [
        {
          id: topicId,
          action,
          reason: body.reason.trim(),
          actor_id: memberId,
          created_at: at,
          opportunity_version: 4,
        },
      ];
      return route.fulfill({
        json: envelope({
          opportunity_id: opportunityId,
          decision_status: data.detail.decision_status,
          version: 4,
          decision_id: topicId,
        }),
      });
    });
    await page.goto(`/opportunities/${opportunityId}`);
    await expect(page.locator(".opportunity-detail")).toBeVisible();
    await expect(page.getByRole("button", { name: "采纳建议" })).toHaveCount(0);
    await page.locator("summary").filter({ hasText: "提前人工处理" }).click();
    const trigger = page
      .getByRole("navigation", { name: "候选提前人工处理" })
      .getByRole("button", { name: label, exact: true });
    await trigger.click();
    const modal = page.getByRole("dialog", { name: `记录${label}决定`, exact: true });
    await modal.getByLabel("原因（必填）").fill("取消原因");
    await modal.press("Escape");
    await expect(modal).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(data.writes).toHaveLength(0);
    await trigger.click();
    await expect(modal.getByLabel("原因（必填）")).toHaveValue("");
    await modal.getByRole("button", { name: "确认记录" }).click();
    expect(data.writes).toHaveLength(0);
    const reasonField = modal.getByLabel("原因（必填）");
    await expect(reasonField).toHaveAttribute("aria-invalid", "true");
    await expect(reasonField).toHaveAttribute(
      "aria-describedby",
      "opportunity-decision-reason-help opportunity-decision-reason-error",
    );
    await expect(modal.getByRole("alert")).toHaveText("请填写原因后再记录决定。");
    const reason = "  核对证据后人工决定  ";
    await reasonField.fill(reason);
    await expect(reasonField).not.toHaveAttribute("aria-invalid", "true");
    await expect(modal.getByRole("alert")).toHaveCount(0);
    await modal.getByRole("button", { name: "确认记录" }).click();
    await expect(page.locator(".opportunity-message")).toContainText("稍后重试记录决定。");
    await expect(modal.getByLabel("原因（必填）")).toHaveValue(reason);
    expect(attempts).toBe(1);
    const readsBefore = data.detailReads;
    await modal.getByRole("button", { name: "确认记录" }).click();
    await expect(modal).toHaveCount(0);
    await expect(page.locator(".opportunity-message")).toContainText("决策已记录");
    expect(data.detailReads).toBeGreaterThan(readsBefore);
    expect(data.writes).toHaveLength(2);
    for (const request of data.writes)
      assertWrite(request, `/opportunities/${opportunityId}/decisions`, {
        action,
        reason,
        expected_version: 3,
      });
    expect(data.writes[0].headers()["idempotency-key"]).not.toBe(
      data.writes[1].headers()["idempotency-key"],
    );
    await openOpportunitySection(page, "决策记录");
    await expect(page.locator(".opportunity-detail")).toContainText(reason.trim());
  });
}

test("UI2-OP04 retired AI tab falls back to product facts without analysis reads or writes", async ({
  page,
}) => {
  const data = await ready(page, false);
  let reads = 0;
  await page.route(`**/api/v1/opportunities/${opportunityId}/ai-analyses`, (route) => {
    reads += 1;
    return route.fulfill({
      status: 503,
      json: { error: { code: "service_unavailable", action_hint: "退休入口不应读取分析。" } },
    });
  });
  await page.goto(`/opportunities/${opportunityId}?tab=ai`);
  await expect(page.locator(".opportunity-detail")).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "选品详情分区" })
      .getByRole("button", { name: "商品与评分", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".opportunity-ai")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "生成新分析" })).toHaveCount(0);
  expect(reads).toBe(0);
  expect(data.writes).toHaveLength(0);
});

test("UI2-OP05 retired ERP import has no entry, file input or bridge writes", async ({ page }) => {
  const data = await ready(page);
  let importRequests = 0;
  await page.route("**/api/v1/imports/erp-products", (route) => {
    importRequests += 1;
    return route.abort();
  });
  for (const view of ["recommended", "rule_candidates", "evidence_pending", "all"]) {
    await page.goto(`/opportunities?view=${view}&erp_import=1`);
    await expect(page.locator(".opportunity-workspace--review")).toBeVisible();
    await expect(page.getByRole("button", { name: "从 ERP 导入", exact: true })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "从米豆 ERP 商品列表导入" })).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  }
  await page.evaluate(() =>
    window.postMessage(
      {
        type: "SCOUTOPS_BROWSER_BRIDGE_RESULT",
        request_id: "retired-erp-request",
        ok: true,
        data: {
          items: [{ spu: "RETIRED-ERP" }],
          source_url: "https://medou.medouai.com/#/ProductList",
        },
      },
      location.origin,
    ),
  );
  await navigateSpa(page, "/home");
  await navigateSpa(page, "/opportunities?view=all");
  await expect(page.locator(".opportunity-workspace--review")).toBeVisible();
  await expect(page.getByRole("button", { name: "从 ERP 导入", exact: true })).toHaveCount(0);
  expect(importRequests).toBe(0);
  expect(data.writes).toHaveLength(0);
});
