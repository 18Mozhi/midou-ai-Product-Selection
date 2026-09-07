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
async function ready(page: Page, canDecide = true) {
  const detail = detailFixture();
  const data = {
    detail,
    rows: [detail, { ...detail, id: id(426), name: "第二个隔离候选", version: 7 }],
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
        capabilities: ["opportunity:read", ...(canDecide ? ["opportunity:decide"] : [])],
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
    if (path.endsWith("/member-options"))
      return route.fulfill({ json: envelope([{ id: memberId, label: "隔离复核成员" }]) });
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
      return route.fulfill({
        json: envelope(data.rows, { total: data.rows.length, page: 1, page_size: 20 }),
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

test("UI2-OP01 manual creation validates, preserves canceled draft and follows returned ID", async ({
  page,
}) => {
  const data = await ready(page);
  await page.route("**/api/v1/opportunities", (route) => {
    if (route.request().method() === "GET") return route.fallback();
    const body = route.request().postDataJSON();
    Object.assign(data.detail, body, {
      source_type: "trend_topic",
      source_ref_id: body.source_topic_id,
    });
    return route.fulfill({ status: 201, json: envelope(data.detail) });
  });
  await page.goto("/opportunities?view=all");
  const trigger = page.getByRole("button", { name: "手工添加", exact: true });
  await trigger.click();
  const modal = page.getByRole("dialog", { name: "创建机会候选", exact: true });
  await expect(modal.getByRole("button", { name: "关闭", exact: true })).toBeFocused();
  await modal.getByRole("button", { name: "创建机会", exact: true }).click();
  await expect(modal.getByLabel("机会名称")).toBeFocused();
  expect(data.writes).toHaveLength(0);
  await modal.getByLabel("机会名称").fill("新候选草稿");
  await modal.getByLabel("市场", { exact: true }).fill("CA");
  await modal.getByLabel("来源趋势 ID", { exact: false }).fill(topicId);
  await modal.press("Escape");
  await expect(modal).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(data.writes).toHaveLength(0);
  await trigger.click();
  await expect(modal.getByLabel("机会名称")).toHaveValue("新候选草稿");
  await expect(modal.getByLabel("市场", { exact: true })).toHaveValue("CA");
  await modal.getByRole("button", { name: "创建机会", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/opportunities/${opportunityId}$`));
  await expect(page.locator(".opportunity-detail h3").first()).toHaveText("新候选草稿");
  expect(data.writes).toHaveLength(1);
  assertWrite(data.writes[0], "/opportunities", {
    name: "新候选草稿",
    market: "CA",
    category: null,
    source_topic_id: topicId,
  });
});

for (const [action, label] of [
  ["assign", "批量指派"],
  ["review", "批量复核"],
  ["archive", "批量归档"],
] as const) {
  test(`UI2-OP02 ${action} cancels without writes and submits exact current-page versions`, async ({
    page,
  }) => {
    const data = await ready(page);
    await page.route("**/api/v1/opportunities/batch", (route) => {
      for (const row of data.rows) row.version += 1;
      return route.fulfill({ json: envelope({ affected_count: 2 }) });
    });
    await page.goto("/opportunities?view=all");
    for (const row of data.rows)
      await page.getByRole("checkbox", { name: `选择机会：${row.name}`, exact: true }).check();
    const trigger = page.getByRole("button", { name: label, exact: true });
    await trigger.click();
    const modal = page.getByRole("dialog", { name: "机会批量操作影响预览" });
    await expect(modal).toContainText("当前已选的 2 个机会");
    await modal.getByLabel("操作原因").fill("取消草稿");
    if (action === "assign")
      await modal.getByRole("combobox", { name: /^负责人/ }).selectOption(memberId);
    await modal.getByRole("button", { name: "返回", exact: true }).click();
    await expect(modal).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(data.writes).toHaveLength(0);
    await trigger.click();
    await expect(modal.getByLabel("操作原因")).toHaveValue("");
    if (action === "assign")
      await expect(modal.getByRole("combobox", { name: /^负责人/ })).toHaveValue("");
    await modal.getByRole("button", { name: "确认执行" }).click();
    expect(data.writes).toHaveLength(0);
    if (action === "assign")
      await modal.getByRole("combobox", { name: /^负责人/ }).selectOption(memberId);
    await modal.getByLabel("操作原因").fill("  已核对本批机会范围  ");
    const readsBefore = data.listReads;
    await modal.getByRole("button", { name: "确认执行" }).click();
    await expect(modal).toBeHidden();
    await expect(page.locator(".opportunity-message")).toContainText("批量操作已完成 2 项");
    await expect(page.getByRole("navigation", { name: "机会批量操作", exact: true })).toHaveCount(
      0,
    );
    expect(data.listReads).toBeGreaterThan(readsBefore);
    expect(data.writes).toHaveLength(1);
    assertWrite(data.writes[0], "/opportunities/batch", {
      action,
      items: [
        { id: opportunityId, expected_version: 3 },
        { id: id(426), expected_version: 7 },
      ],
      reason: "已核对本批机会范围",
      assignee_id: action === "assign" ? memberId : null,
    });
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
    // Scope by native top-layer: current source duplicates the decision heading ID.
    // This test does not certify the dialog's accessible-name contract.
    const modal = page.locator("dialog.opportunity-modal[open]");
    await modal.getByLabel("原因（必填）").fill("取消原因");
    await modal.press("Escape");
    await expect(modal).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(data.writes).toHaveLength(0);
    await trigger.click();
    await expect(modal.getByLabel("原因（必填）")).toHaveValue("");
    await modal.getByRole("button", { name: "确认记录" }).click();
    expect(data.writes).toHaveLength(0);
    const reason = "  核对证据后人工决定  ";
    await modal.getByLabel("原因（必填）").fill(reason);
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
    await page.locator("summary").filter({ hasText: "更多分析" }).click();
    await page.getByRole("button", { name: "决策历史", exact: true }).click();
    await expect(page.locator(".opportunity-detail")).toContainText(reason.trim());
  });
}

test("UI2-OP04 read-only AI failure stays distinct from empty and retries without writes", async ({
  page,
}) => {
  const data = await ready(page, false);
  let unavailable = true,
    reads = 0;
  await page.route(`**/api/v1/opportunities/${opportunityId}/ai-analyses`, (route) => {
    reads += 1;
    return unavailable
      ? route.fulfill({
          status: 503,
          json: {
            error: { code: "service_unavailable", message: "暂不可用", action_hint: "稍后重试。" },
          },
        })
      : route.fulfill({ json: envelope([]) });
  });
  await page.goto(`/opportunities/${opportunityId}?tab=ai`);
  await expect(page.locator(".opportunity-detail")).toBeVisible();
  const panel = page.locator(".opportunity-ai");
  await expect(panel.getByRole("alert")).toContainText("AI 分析读取失败");
  await expect(panel.getByText("尚无 AI 分析；当前机会事实未被修改。")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "生成新分析" })).toHaveCount(0);
  const readsBefore = reads;
  unavailable = false;
  await panel.getByRole("button", { name: "重试读取" }).click();
  await expect(panel).toContainText("尚无 AI 分析；当前机会事实未被修改。");
  await expect(panel.getByRole("alert")).toHaveCount(0);
  expect(reads).toBeGreaterThan(readsBefore);
  expect(data.writes).toHaveLength(0);
});

test("UI2-OP05 ERP file selection imports immediately without browser bridge or final submit", async ({
  page,
}) => {
  const data = await ready(page);
  await page.route("**/api/v1/imports/erp-products", (route) =>
    route.fulfill({
      status: 201,
      json: envelope({
        received_count: 1,
        opportunity_count: 1,
        competitor_count: 0,
        sourcing_search_count: 0,
      }),
    }),
  );
  await page.goto("/opportunities?view=all");
  await page.getByRole("button", { name: "从 ERP 导入", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "从米豆 ERP 商品列表导入" });
  await expect(modal.getByLabel("本次导入数量")).toHaveValue("200");
  await modal.getByRole("button", { name: "取消", exact: true }).click();
  expect(data.writes).toHaveLength(0);
  await page.getByRole("button", { name: "从 ERP 导入", exact: true }).click();
  // Minimal row fields from normalizeErpProductRow; persistence remains mocked here.
  const items = [{ spu: "UI2-LOCAL-ERP", product: { title: "隔离导入商品" }, last_sync_time: at }];
  await modal.locator('input[type="file"]').setInputFiles({
    name: "erp-local.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ list: items })),
  });
  await expect(modal).toBeHidden();
  await expect(page.locator(".opportunity-message")).toContainText("ERP 已读取 1 条");
  expect(data.writes).toHaveLength(1);
  const body = data.writes[0].postDataJSON();
  expect(new Date(body.captured_at).toISOString()).toBe(body.captured_at);
  assertWrite(data.writes[0], "/imports/erp-products", {
    items,
    source_url: "https://medou.medouai.com/#/ProductList",
    captured_at: body.captured_at,
  });
  await expect(page).toHaveURL(/\/opportunities\?view=all$/);
});
