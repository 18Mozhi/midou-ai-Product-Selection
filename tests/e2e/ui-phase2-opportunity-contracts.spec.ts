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
    .getByRole("navigation", { name: "机会详情分区" })
    .getByRole("button", { name: label, exact: true })
    .click();
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
  await expect(page.locator(".opportunity-detail h1")).toHaveText("新候选草稿");
  expect(data.writes).toHaveLength(1);
  assertWrite(data.writes[0], "/opportunities", {
    name: "新候选草稿",
    market: "CA",
    category: null,
    source_topic_id: topicId,
  });
});

test("UI2-OP07 cached opportunity entry honors a new trend creation route", async ({ page }) => {
  const data = await ready(page, true, ["task:read"]);
  await page.goto("/opportunities?view=all");
  const createTrigger = page.getByRole("button", { name: "手工添加", exact: true });
  await expect(createTrigger).toBeVisible();
  const initialCreate = page.getByRole("dialog", { name: "创建机会候选", exact: true });
  await createTrigger.click();
  await initialCreate.getByLabel("机会名称").fill("离开前保留的草稿");
  await initialCreate.press("Escape");
  await expect(initialCreate).toBeHidden();

  await navigateSpa(page, "/home");
  await expect(page).toHaveURL(/\/home$/);

  await navigateSpa(page, "/opportunities?view=all");
  await expect(page).toHaveURL(/\/opportunities\?view=all$/);
  await createTrigger.click();
  await expect(initialCreate.getByLabel("机会名称")).toHaveValue("离开前保留的草稿");
  await initialCreate.press("Escape");
  await expect(initialCreate).toBeHidden();
  await navigateSpa(page, "/home");
  await expect(page).toHaveURL(/\/home$/);

  const target = new URL("/opportunities", page.url());
  target.searchParams.set("source_topic_id", topicId);
  target.searchParams.set("name", "缓存返回的趋势候选");
  target.searchParams.set("market", "US");
  target.searchParams.set("category", "居家");
  await navigateSpa(page, target.href);

  await expect(page).toHaveURL(/\/opportunities\?source_topic_id=/);
  const modal = page.getByRole("dialog", { name: "创建机会候选", exact: true });
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel("机会名称")).toHaveValue("缓存返回的趋势候选");
  await expect(modal.getByLabel("市场", { exact: true })).toHaveValue("US");
  await expect(modal.getByLabel("来源趋势 ID", { exact: false })).toHaveValue(topicId);
  await expect(modal.getByLabel("分类（可选）")).toHaveValue("居家");
  expect(data.writes).toHaveLength(0);
});

test("UI2-OP07 cached trend entry does not bypass the decision capability", async ({ page }) => {
  const data = await ready(page, false, ["task:read"]);
  await page.goto("/opportunities?view=all");
  await expect(page.locator(".opportunity-workspace--review")).toBeVisible();
  await navigateSpa(page, "/home");
  await expect(page).toHaveURL(/\/home$/);

  const target = new URL("/opportunities", page.url());
  target.searchParams.set("source_topic_id", topicId);
  target.searchParams.set("name", "无决策权限的趋势候选");
  await navigateSpa(page, target.href);

  await expect(page).toHaveURL(/\/opportunities\?source_topic_id=/);
  await expect(page.getByRole("dialog", { name: "创建机会候选", exact: true })).toBeHidden();
  expect(data.writes).toHaveLength(0);
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
    await expect(modal).toContainText("本次仅处理当前结果中已选的 2 个机会");
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

test("UI2-OP04 filtered selections disclose the exact current-result batch scope", async ({
  page,
}) => {
  const data = await ready(page);
  const first = data.rows[0];
  const second = data.rows[1];
  data.queryRows = [second];
  await page.route("**/api/v1/opportunities/batch", (route) =>
    route.fulfill({ json: envelope({ affected_count: 1 }) }),
  );
  await page.goto("/opportunities?view=all");
  await page.getByRole("checkbox", { name: `选择机会：${first.name}`, exact: true }).check();

  const advancedFilterTrigger = page.getByRole("button", { name: /高级筛选/ });
  if (await advancedFilterTrigger.count()) await advancedFilterTrigger.click();
  const search = page.getByPlaceholder("搜索机会", { exact: true });
  await search.fill(second.name);
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  await expect(page).toHaveURL(/q=/);
  const closeFilter = page.getByRole("button", { name: "关闭筛选条件", exact: true });
  if (await closeFilter.isVisible()) await closeFilter.click();

  const batchBar = page.getByRole("navigation", { name: "机会批量操作", exact: true });
  await expect(batchBar).toContainText("已选 1 项");
  await expect(batchBar).toContainText("当前结果中没有已选机会");
  await expect(batchBar.getByRole("button", { name: "批量归档" })).toBeDisabled();
  await page.getByRole("checkbox", { name: `选择机会：${second.name}`, exact: true }).check();
  await expect(batchBar).toContainText("本次仅处理当前页已选的 1 项");
  await expect(batchBar).toContainText("另有 1 项不在当前结果中");

  await batchBar.getByRole("button", { name: "批量归档", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "机会批量操作影响预览" });
  await expect(modal).toContainText("本次仅处理当前结果中已选的 1 个机会");
  await expect(modal).toContainText("另有 1 个已选机会不在当前结果中，不会随本次操作提交");
  await modal.getByLabel("操作原因").fill("仅处理当前结果中的选中项");
  await modal.getByRole("button", { name: "确认执行", exact: true }).click();

  await expect(modal).toBeHidden();
  expect(data.writes).toHaveLength(1);
  assertWrite(data.writes[0], "/opportunities/batch", {
    action: "archive",
    items: [{ id: second.id, expected_version: second.version }],
    reason: "仅处理当前结果中的选中项",
    assignee_id: null,
  });
});

test("UI2-OP07 a delayed batch receipt cannot close or clear a newer batch intent", async ({
  page,
}) => {
  const data = await ready(page);
  let releaseBatch!: () => void;
  let markBatchStarted!: () => void;
  const batchGate = new Promise<void>((resolve) => (releaseBatch = resolve));
  const batchStarted = new Promise<void>((resolve) => (markBatchStarted = resolve));
  await page.route("**/api/v1/opportunities/batch", async (route) => {
    markBatchStarted();
    await batchGate;
    await route.fulfill({ json: envelope({ affected_count: 1 }) });
  });
  await page.goto("/opportunities?view=all");

  const first = data.rows[0];
  const second = data.rows[1];
  const firstCheckbox = page.getByRole("checkbox", {
    name: `选择机会：${first.name}`,
    exact: true,
  });
  const secondCheckbox = page.getByRole("checkbox", {
    name: `选择机会：${second.name}`,
    exact: true,
  });
  await firstCheckbox.check();
  await page.getByRole("button", { name: "批量归档", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "机会批量操作影响预览" });
  await modal.getByLabel("操作原因").fill("旧批量意图");
  await modal.getByRole("button", { name: "确认执行", exact: true }).click();
  await batchStarted;

  await modal.getByRole("button", { name: "返回", exact: true }).click();
  await expect(modal).toBeHidden();
  await secondCheckbox.check();
  await page.getByRole("button", { name: "批量归档", exact: true }).click();
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel("操作原因")).toHaveValue("");
  await modal.getByLabel("操作原因").fill("新批量意图");

  releaseBatch();
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel("操作原因")).toHaveValue("新批量意图");
  await expect(secondCheckbox).toBeChecked();
  expect(data.writes).toHaveLength(1);
  assertWrite(data.writes[0], "/opportunities/batch", {
    action: "archive",
    items: [{ id: first.id, expected_version: first.version }],
    reason: "旧批量意图",
    assignee_id: null,
  });
});

test("UI2-OP07 a delayed batch receipt preserves a reopened intent with the same selection", async ({
  page,
}) => {
  const data = await ready(page);
  let releaseBatch!: () => void;
  let markBatchStarted!: () => void;
  const batchGate = new Promise<void>((resolve) => (releaseBatch = resolve));
  const batchStarted = new Promise<void>((resolve) => (markBatchStarted = resolve));
  await page.route("**/api/v1/opportunities/batch", async (route) => {
    markBatchStarted();
    await batchGate;
    await route.fulfill({ json: envelope({ affected_count: 1 }) });
  });
  await page.goto("/opportunities?view=all");

  const first = data.rows[0];
  const checkbox = page.getByRole("checkbox", {
    name: `选择机会：${first.name}`,
    exact: true,
  });
  await checkbox.check();
  await page.getByRole("button", { name: "批量归档", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "机会批量操作影响预览" });
  await modal.getByLabel("操作原因").fill("旧批量意图");
  await modal.getByRole("button", { name: "确认执行", exact: true }).click();
  await batchStarted;

  await modal.getByRole("button", { name: "返回", exact: true }).click();
  await expect(modal).toBeHidden();
  await page.getByRole("button", { name: "批量归档", exact: true }).click();
  await expect(modal).toBeVisible();
  await modal.getByLabel("操作原因").fill("同一选择的新批量意图");

  releaseBatch();
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel("操作原因")).toHaveValue("同一选择的新批量意图");
  await expect(checkbox).toBeChecked();
  expect(data.writes).toHaveLength(1);
});

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
    await openOpportunitySection(page, "决策历史");
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
  const close = modal.getByRole("button", { name: "关闭 ERP 导入" });
  const read = modal.getByRole("button", { name: "从当前浏览器读取" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(read).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
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

async function captureErpBridgeRequest(page: Page) {
  await page.addInitScript(() => {
    window.addEventListener("message", (event) => {
      if (
        event.data?.type === "SCOUTOPS_BROWSER_BRIDGE_REQUEST" &&
        event.data?.action === "erp.products.read"
      )
        (
          window as typeof window & { __erpBridgeRequest?: { request_id: string } }
        ).__erpBridgeRequest = event.data;
    });
  });
}

async function readErpBridgeRequestId(page: Page) {
  return page.evaluate(
    () =>
      (window as typeof window & { __erpBridgeRequest?: { request_id: string } }).__erpBridgeRequest
        ?.request_id ?? "",
  );
}

async function resolveErpBridgeRequest(page: Page, requestId: string) {
  await page.evaluate(
    ({ requestId, at }) => {
      window.postMessage(
        {
          type: "SCOUTOPS_BROWSER_BRIDGE_RESULT",
          request_id: requestId,
          ok: true,
          data: {
            items: [{ spu: "UI2-STALE-ERP", product: { title: "过期导入意图" } }],
            source_url: "https://medou.medouai.com/#/ProductList",
            captured_at: at,
            total: 1,
          },
        },
        location.origin,
      );
    },
    { requestId, at },
  );
}

test("UI2-OP07 ignores an ERP bridge result after its dialog intent is replaced", async ({
  page,
}) => {
  const data = await ready(page);
  await captureErpBridgeRequest(page);
  await page.goto("/opportunities?view=all");
  await page.getByRole("button", { name: "从 ERP 导入", exact: true }).click();
  let modal = page.getByRole("dialog", { name: "从米豆 ERP 商品列表导入" });
  await modal.getByRole("button", { name: "从当前浏览器读取", exact: true }).click();
  await expect.poll(() => readErpBridgeRequestId(page)).toMatch(/^[0-9a-f-]{36}$/u);
  const oldRequestId = await readErpBridgeRequestId(page);

  await modal.getByRole("button", { name: "关闭 ERP 导入" }).click();
  await expect(modal).toBeHidden();
  await page.getByRole("button", { name: "从 ERP 导入", exact: true }).click();
  modal = page.getByRole("dialog", { name: "从米豆 ERP 商品列表导入" });
  await expect(modal).toBeVisible();
  await resolveErpBridgeRequest(page, oldRequestId);

  await expect(modal).toBeVisible();
  await expect(modal.getByRole("button", { name: "从当前浏览器读取", exact: true })).toBeEnabled();
  expect(data.writes).toHaveLength(0);
});

test("UI2-OP07 does not persist ERP bridge data after the opportunity page is deactivated", async ({
  page,
}) => {
  const data = await ready(page);
  await captureErpBridgeRequest(page);
  await page.goto("/opportunities?view=all");
  await page.getByRole("button", { name: "从 ERP 导入", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "从米豆 ERP 商品列表导入" });
  await modal.getByRole("button", { name: "从当前浏览器读取", exact: true }).click();
  await expect.poll(() => readErpBridgeRequestId(page)).toMatch(/^[0-9a-f-]{36}$/u);
  const oldRequestId = await readErpBridgeRequestId(page);

  await navigateSpa(page, "/home");
  await expect(page).toHaveURL(/\/home$/u);
  await navigateSpa(page, "/opportunities?view=all");
  await expect(page.locator(".opportunity-workspace--review")).toBeVisible();
  await resolveErpBridgeRequest(page, oldRequestId);

  await expect(page.getByRole("dialog", { name: "从米豆 ERP 商品列表导入" })).toBeHidden();
  expect(data.writes).toHaveLength(0);
});
