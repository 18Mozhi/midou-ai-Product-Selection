import { expect, test, type Page, type Request } from "@playwright/test";
import type {
  TrendDetail,
  TrendRule,
  TrendTopicChangeRequest,
} from "../../apps/web/src/components/trend-workspace-types";

// Local real-Vue contract fixtures. No production, SQL, crawler or actual governance execution.
const id = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const topicId = id(404),
  ruleId = id(405),
  signalId = id(406),
  issueId = id(412);
const at = "2026-08-07T14:05:00.000Z";
const envelope = (data: unknown, meta?: unknown) => ({
  data,
  ...(meta ? { meta } : {}),
  request_id: "ui2-trend-request",
  trace_id: "ui2-trend-trace",
});
function fixture() {
  const detail: TrendDetail = {
    id: topicId,
    title: "AI 护肤观察主题",
    category: "beauty",
    market: "US",
    language: "en-US",
    status: "active",
    signal_count: 2,
    source_count: 1,
    heat: { value: 2, unit: "signals" },
    momentum_percent: null,
    confidence: { score: null, status: "insufficient_data" },
    first_seen_at: at,
    last_seen_at: at,
    source_fresh_at: at,
    followed: false,
    version: 3,
    keywords: [],
    timeline: [{ at, signal_count: 2, source_count: 1 }],
    timeline_sources: [],
    evidence: [406, 409].map((n) => ({
      id: id(n),
      title: `隔离证据 ${n}`,
      publisher: "Example News",
      canonical_url: `https://example.test/news/${n}`,
      published_at: at,
      observed_at: at,
      provider_id: id(407),
      raw_evidence_id: id(n + 100),
    })),
    data_quality: { coverage_status: "covered", evidence_count: 2, source_count: 1, stale: false },
    relevance_history: [],
  };
  const rule: TrendRule = {
    id: ruleId,
    name: "隔离趋势规则",
    include_keywords: ["ai skincare", "beauty"],
    negative_keywords: [],
    market: "US",
    language: "en-US",
    category: "beauty",
    notification_channel: "in_app",
    collection_interval_minutes: 180,
    recommendation_min_source_count: 3,
    status: "enabled",
    last_evaluated_at: null,
    last_collection_at: null,
    next_collection_at: null,
    last_collection_task_id: null,
    last_failed_sources: [],
    version: 4,
    updated_at: at,
  };
  const changes: TrendTopicChangeRequest[] = [];
  return { detail, rule, changes, writes: [] as Request[] };
}
type Fixture = ReturnType<typeof fixture>;
async function ready(page: Page) {
  const data = fixture();
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1/trends") && request.method() !== "GET")
      data.writes.push(request);
  });
  await page.route("**/api/v1/me/ui-preferences", (route) =>
    route.fulfill({ json: envelope({ theme: "deep-ocean", version: 1 }) }),
  );
  await page.route("**/api/v1/me/navigation?shell=member", (route) =>
    route.fulfill({
      json: envelope({
        shell: "member",
        organization_id: id(401),
        workspace_id: id(402),
        roles: ["member"],
        capabilities: ["task:read", "trend:read", "trend:manage"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/trends**", (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (request.method() !== "GET")
      return route.fulfill({ status: 500, json: { error: { code: "unexpected_test_write" } } });
    const value = url.pathname.endsWith("/monitoring-rules")
      ? [data.rule]
      : url.pathname.endsWith("/change-requests")
        ? data.changes
        : url.pathname.endsWith(`/${topicId}`)
          ? data.detail
          : [data.detail];
    return route.fulfill({ json: envelope(value, { page: 1, page_size: 20, total: 1 }) });
  });
  return data;
}
async function openDetail(page: Page) {
  await page.goto(`/trends?topic=${topicId}`);
  await expect(page.locator(".trend-detail")).toBeVisible();
  await expect(page.locator(".trend-detail")).toHaveAttribute("aria-busy", "false");
}
function assertWrite(request: Request, method: string, path: string, body: unknown) {
  expect(request.method()).toBe(method);
  expect(new URL(request.url()).pathname).toBe(`/api/v1${path}`);
  if (body === null) expect(request.postData()).toBeNull();
  else expect(request.postDataJSON()).toEqual(body);
  for (const header of ["idempotency-key", "x-request-id", "x-trace-id"])
    expect(request.headers()[header]).toMatch(/^[0-9a-f-]{36}$/);
}
function change(data: Fixture): TrendTopicChangeRequest {
  return {
    id: id(414),
    operation: "split",
    target_topic: data.detail,
    source_topics: [],
    signal_ids: [signalId],
    new_title: "单独观察",
    new_category: null,
    reason: "证据应单独核对",
    status: "pending",
    result_topic_id: null,
    proposed_by: id(415),
    decided_by: null,
    decision_reason: null,
    decided_at: null,
    version: 2,
    created_at: at,
    updated_at: at,
  };
}

test("UI2-TR01 follow and unfollow preserve bodyless methods and returned state", async ({
  page,
}) => {
  const data = await ready(page);
  await page.route(`**/api/v1/trends/${topicId}/follow`, (route) => {
    data.detail.followed = route.request().method() === "PUT";
    return route.fulfill({ json: envelope({ topic_id: topicId, followed: data.detail.followed }) });
  });
  await openDetail(page);
  await page.getByRole("button", { name: "关注", exact: true }).click();
  await page.getByRole("button", { name: "已关注", exact: true }).click();
  await expect(page.getByRole("button", { name: "关注", exact: true })).toBeVisible();
  expect(data.writes).toHaveLength(2);
  assertWrite(data.writes[0], "PUT", `/trends/${topicId}/follow`, null);
  assertWrite(data.writes[1], "DELETE", `/trends/${topicId}/follow`, null);
  expect(data.writes[0].headers()["idempotency-key"]).not.toBe(
    data.writes[1].headers()["idempotency-key"],
  );
});

test("UI2-TR02 relevance cancel writes nothing and restore uses the refreshed version", async ({
  page,
}) => {
  const data = await ready(page);
  await page.route(`**/api/v1/trends/${topicId}/relevance`, (route) => {
    const body = route.request().postDataJSON();
    data.detail.status = body.status;
    data.detail.version += 1;
    data.detail.relevance_history.push({
      status: body.status,
      reason: body.reason,
      actor_id: id(415),
      version: data.detail.version,
      occurred_at: at,
    });
    return route.fulfill({ json: envelope(data.detail) });
  });
  await openDetail(page);
  await page.getByRole("button", { name: "标记无关", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "标记为无关" });
  await expect(modal.getByRole("button", { name: "确认并记录" })).toBeDisabled();
  await modal.getByLabel("变更原因").fill("取消这次输入");
  await modal.getByRole("button", { name: "取消", exact: true }).click();
  expect(data.writes).toHaveLength(0);
  await page.getByRole("button", { name: "标记无关", exact: true }).click();
  await expect(modal.getByLabel("变更原因")).toHaveValue("");
  await modal.getByLabel("变更原因").fill("  与当前研究无关  ");
  await modal.getByRole("button", { name: "确认并记录" }).click();
  await expect(modal).toBeHidden();
  await page.getByRole("button", { name: "恢复为相关", exact: true }).click();
  const restore = page.getByRole("dialog", { name: "恢复为相关" });
  await restore.getByLabel("变更原因").fill("  已补充相关证据  ");
  await restore.getByRole("button", { name: "确认并记录" }).click();
  await expect(restore).toBeHidden();
  await expect(page.getByRole("button", { name: "标记无关", exact: true })).toBeVisible();
  expect(data.writes).toHaveLength(2);
  assertWrite(data.writes[0], "POST", `/trends/${topicId}/relevance`, {
    status: "irrelevant",
    reason: "与当前研究无关",
    expected_version: 3,
  });
  assertWrite(data.writes[1], "POST", `/trends/${topicId}/relevance`, {
    status: "active",
    reason: "已补充相关证据",
    expected_version: 4,
  });
});

test("UI2-TR03 anomaly failure preserves input and explicit retry reuses returned issue", async ({
  page,
}) => {
  const data = await ready(page);
  let attempts = 0;
  await page.route(`**/api/v1/trends/${topicId}/evidence/${signalId}/quality-issues`, (route) => {
    attempts += 1;
    if (attempts === 1)
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: "service_unavailable",
            message: "暂不可用",
            action_hint: "稍后重新提交异常报告。",
          },
          request_id: "ui2-anomaly-failure",
          trace_id: "ui2-anomaly-failure",
        },
      });
    return route.fulfill({
      status: 200,
      json: envelope({
        created: false,
        issue: { id: issueId, severity: "critical", status: "open", version: 2 },
      }),
    });
  });
  await openDetail(page);
  const evidence = page.locator(".trend-evidence-item").filter({ hasText: "隔离证据 406" });
  await evidence.getByRole("button", { name: "报告异常" }).click();
  const modal = page.getByRole("dialog", { name: "创建数据质量工单" });
  await expect(modal.getByRole("button", { name: "创建质量工单" })).toBeDisabled();
  await modal.getByLabel("风险等级").selectOption("critical");
  await modal.getByLabel("异常说明").fill("  原始证据与解析内容冲突  ");
  await modal.getByRole("button", { name: "创建质量工单" }).click();
  await expect(page.locator(".trend-message")).toContainText("稍后重新提交异常报告。");
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel("风险等级")).toHaveValue("critical");
  await expect(modal.getByLabel("异常说明")).toHaveValue("  原始证据与解析内容冲突  ");
  expect(attempts).toBe(1);
  await modal.getByRole("button", { name: "创建质量工单" }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator(".trend-message")).toContainText(`已有未关闭质量工单 ${issueId}`);
  await expect(evidence.getByRole("button", { name: "已建质量工单" })).toBeDisabled();
  expect(data.writes).toHaveLength(2);
  for (const request of data.writes)
    assertWrite(request, "POST", `/trends/${topicId}/evidence/${signalId}/quality-issues`, {
      severity: "critical",
      reason: "原始证据与解析内容冲突",
    });
});

test("UI2-TR04 rule cancel resets defaults and creation sends the exact form contract", async ({
  page,
}) => {
  const data = await ready(page);
  await page.route("**/api/v1/trends/monitoring-rules", (route) => {
    if (route.request().method() === "GET") return route.fallback();
    Object.assign(data.rule, route.request().postDataJSON());
    return route.fulfill({ status: 201, json: envelope(data.rule) });
  });
  await page.goto("/trends?section=rules");
  await page.getByRole("button", { name: "＋ 创建规则", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "创建趋势监控", exact: true });
  await modal.getByLabel("规则名称", { exact: true }).fill("待取消");
  await modal.getByRole("button", { name: "取消", exact: true }).click();
  expect(data.writes).toHaveLength(0);
  await page.getByRole("button", { name: "＋ 创建规则", exact: true }).click();
  await expect(modal.getByLabel("规则名称", { exact: true })).toHaveValue("");
  await expect(modal.getByLabel("市场", { exact: true })).toHaveValue("US");
  await expect(modal.getByLabel("语言", { exact: true })).toHaveValue("en-US");
  await expect(modal.getByLabel("自动采集周期")).toHaveValue("60");
  await expect(modal.getByLabel("候选来源门槛")).toHaveValue("1");
  await modal.getByRole("button", { name: "创建并启用" }).click();
  expect(data.writes).toHaveLength(0);
  await expect(modal.getByLabel("规则名称", { exact: true })).toBeFocused();
  await modal.getByLabel("规则名称", { exact: true }).fill("独立规则");
  await modal.getByLabel("包含关键词（逗号分隔）").fill(" Desk Lamp， reading , ");
  await modal.getByLabel("排除关键词（可选）").fill(" medical，used ");
  await modal.getByLabel("自动采集周期").selectOption("180");
  await modal.getByLabel("候选来源门槛").selectOption("3");
  await modal.getByRole("button", { name: "创建并启用" }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator(".trend-message")).toContainText("监控规则已启用");
  expect(data.writes).toHaveLength(1);
  assertWrite(data.writes[0], "POST", "/trends/monitoring-rules", {
    name: "独立规则",
    include_keywords: ["Desk Lamp", "reading"],
    negative_keywords: ["medical", "used"],
    market: "US",
    language: "en-US",
    category: null,
    notification_channel: "in_app",
    collection_interval_minutes: 180,
    recommendation_min_source_count: 3,
  });
});

test("UI2-TR05 rule status updates retain schedule and use returned versions", async ({ page }) => {
  const data = await ready(page);
  await page.route(`**/api/v1/trends/monitoring-rules/${ruleId}`, (route) => {
    data.rule.status = route.request().postDataJSON().status;
    data.rule.version += 1;
    return route.fulfill({ json: envelope(data.rule) });
  });
  await page.goto("/trends?section=rules");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.getByRole("button", { name: "启用", exact: true }).click();
  await expect(page.getByRole("button", { name: "暂停", exact: true })).toBeVisible();
  expect(data.writes).toHaveLength(2);
  for (const [index, status] of ["paused", "enabled"].entries())
    assertWrite(data.writes[index], "PATCH", `/trends/monitoring-rules/${ruleId}`, {
      status,
      expected_version: 4 + index,
      collection_interval_minutes: 180,
      recommendation_min_source_count: 3,
    });
});

test("UI2-TR06 split proposes exact evidence and versions without executing a decision", async ({
  page,
}) => {
  const data = await ready(page);
  await page.route("**/api/v1/trends/change-requests", (route) => {
    if (route.request().method() === "GET") return route.fallback();
    data.changes.push(change(data));
    return route.fulfill({ status: 201, json: envelope(data.changes[0]) });
  });
  await openDetail(page);
  await page.getByRole("button", { name: /合并与拆分/ }).click();
  await page.getByRole("button", { name: "拆分主题", exact: true }).click();
  await expect(page.getByRole("button", { name: "提交确认队列" })).toBeDisabled();
  await page.getByRole("checkbox", { name: /隔离证据 406/ }).check();
  await page.getByLabel("新主题名称").fill(" 单独观察 ");
  await page.getByLabel("提议原因").fill("  证据应单独核对  ");
  await page.getByRole("button", { name: "提交确认队列" }).click();
  await expect(page.locator(".trend-message")).toContainText("需要另一位趋势管理员确认");
  await expect(page.locator(".trend-change-queue article")).toHaveAttribute(
    "data-status",
    "pending",
  );
  expect(data.writes).toHaveLength(1);
  assertWrite(data.writes[0], "POST", "/trends/change-requests", {
    operation: "split",
    target_topic_id: topicId,
    source_topic_ids: [],
    signal_ids: [signalId],
    new_title: "单独观察",
    new_category: null,
    expected_versions: { [topicId]: 3 },
    reason: "证据应单独核对",
  });
});

for (const decision of ["confirm", "reject"] as const) {
  test(`UI2-TR07 ${decision} cancel and exact decision contract with refreshed queue`, async ({
    page,
  }) => {
    const data = await ready(page),
      item = change(data);
    data.changes.push(item);
    await page.route(`**/api/v1/trends/change-requests/${item.id}/decisions`, (route) => {
      const body = route.request().postDataJSON();
      item.status = decision === "confirm" ? "confirmed" : "rejected";
      item.decision_reason = body.reason;
      item.decided_by = id(416);
      item.decided_at = at;
      item.version += 1;
      return route.fulfill({ json: envelope(item) });
    });
    await page.goto("/trends?section=governance");
    const card = page.locator(".trend-change-queue article");
    const begin = card.getByRole("button", {
      name: decision === "confirm" ? "确认执行" : "驳回",
      exact: true,
    });
    await begin.click();
    const form = card.locator(".trend-change-decision");
    const submit = form.getByRole("button", {
      name: decision === "confirm" ? "提交确认" : "提交驳回",
    });
    await expect(submit).toBeDisabled();
    await form.getByRole("textbox").fill("暂不提交");
    await form.getByRole("button", { name: "取消", exact: true }).click();
    expect(data.writes).toHaveLength(0);
    await begin.click();
    await expect(form.getByRole("textbox")).toHaveValue("");
    await form.getByRole("textbox").fill("  已核对具体信号与范围  ");
    await submit.click();
    await expect(card).toHaveAttribute(
      "data-status",
      decision === "confirm" ? "confirmed" : "rejected",
    );
    await expect(form).toBeHidden();
    await expect(card).toContainText("处理说明：已核对具体信号与范围");
    expect(data.writes).toHaveLength(1);
    assertWrite(data.writes[0], "POST", `/trends/change-requests/${item.id}/decisions`, {
      decision,
      reason: "已核对具体信号与范围",
      expected_version: 2,
    });
  });
}
