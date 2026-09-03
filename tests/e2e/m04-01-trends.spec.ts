import { test, expect, type Page } from "@playwright/test";

const topicId = "00000000-0000-4000-8000-000000000404",
  ruleId = "00000000-0000-4000-8000-000000000405",
  issueId = "00000000-0000-4000-8000-000000000412";
const topic = {
  id: topicId,
  title: "AI 驱动的个性化护肤",
  category: "beauty",
  market: "US",
  language: "en-US",
  status: "active",
  signal_count: 4,
  source_count: 2,
  heat: { value: 4, unit: "signals" },
  momentum_percent: null,
  confidence: { score: null, status: "insufficient_data" },
  first_seen_at: "2026-08-07T08:00:00.000Z",
  last_seen_at: "2026-08-07T14:00:00.000Z",
  source_fresh_at: "2026-08-07T14:05:00.000Z",
  followed: false,
  version: 3,
};
const mergeTopic = {
  ...topic,
  id: "00000000-0000-4000-8000-000000000413",
  title: "个性化美容推荐",
  signal_count: 2,
  source_count: 1,
  version: 2,
};
const detail = {
  ...topic,
  keywords: [{ keyword: "ai 驱动的个性化护肤", type: "primary", language: "en-US", market: "US" }],
  timeline: [
    { at: "2026-08-07T08:00:00.000Z", signal_count: 1, source_count: 1 },
    { at: "2026-08-07T11:00:00.000Z", signal_count: 1, source_count: 1 },
    { at: "2026-08-07T14:00:00.000Z", signal_count: 2, source_count: 2 },
  ],
  timeline_sources: [
    {
      source_id: "00000000-0000-4000-8000-000000000407",
      source_label: "Example News",
      points: [{ at: "2026-08-07T14:00:00.000Z", signal_count: 1 }],
    },
    {
      source_id: "00000000-0000-4000-8000-000000000410",
      source_label: "Retail Example",
      points: [{ at: "2026-08-07T13:00:00.000Z", signal_count: 1 }],
    },
  ],
  evidence: [
    {
      id: "00000000-0000-4000-8000-000000000406",
      title: "AI Skin Care Demand Rises",
      publisher: "Example News",
      canonical_url: "https://example.test/news/ai-skincare",
      published_at: "2026-08-07T14:00:00.000Z",
      observed_at: "2026-08-07T14:05:00.000Z",
      provider_id: "00000000-0000-4000-8000-000000000407",
      raw_evidence_id: "00000000-0000-4000-8000-000000000408",
    },
    {
      id: "00000000-0000-4000-8000-000000000409",
      title: "Personalized beauty products gain attention",
      publisher: "Retail Example",
      canonical_url: "https://example.test/news/personalized-beauty",
      published_at: "2026-08-07T13:00:00.000Z",
      observed_at: "2026-08-07T13:05:00.000Z",
      provider_id: "00000000-0000-4000-8000-000000000410",
      raw_evidence_id: "00000000-0000-4000-8000-000000000411",
    },
  ],
  data_quality: { coverage_status: "covered", evidence_count: 2, source_count: 2, stale: false },
};
const rule = {
  id: ruleId,
  name: "AI 护肤观察",
  include_keywords: ["ai skincare", "personalized beauty"],
  negative_keywords: ["medical claim"],
  market: "US",
  language: "en-US",
  category: "beauty",
  notification_channel: "in_app",
  collection_interval_minutes: 60,
  recommendation_min_source_count: 2,
  status: "enabled",
  last_evaluated_at: null,
  version: 1,
  created_at: "2026-08-07T10:00:00.000Z",
  updated_at: "2026-08-07T10:00:00.000Z",
};
const envelope = (data: unknown, meta?: unknown) => ({
  data,
  ...(meta ? { meta } : {}),
  request_id: "m04-01-e2e-request",
  trace_id: "m04-01-e2e-trace",
});
const managerCapabilities = ["task:read", "trend:read", "trend:manage"];
async function navigation(page: Page, capabilities = managerCapabilities) {
  await page.route("**/api/v1/me/ui-preferences", (route) =>
    route.fulfill({ json: envelope({ theme: "deep-ocean", version: 1 }) }),
  );
  await page.route("**/api/v1/me/navigation?shell=member", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          shell: "member",
          organization_id: "00000000-0000-4000-8000-000000000401",
          workspace_id: "00000000-0000-4000-8000-000000000402",
          roles: ["member"],
          capabilities,
          platform_roles: [],
          platform_capabilities: [],
          guard_reason: "navigation_member_allowed",
        }),
      ),
    }),
  );
}
async function ready(
  page: Page,
  topics = [topic],
  options: {
    capabilities?: string[];
    detailData?: typeof detail;
    onGovernanceRequest?: () => void;
  } = {},
) {
  await navigation(page, options.capabilities);
  let changeRequests: unknown[] = [];
  await page.route("**/api/v1/trends/change-requests", async (route) => {
    options.onGovernanceRequest?.();
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as any;
      changeRequests = [
        {
          id: "00000000-0000-4000-8000-000000000414",
          operation: body.operation,
          target_topic: topic,
          source_topics: body.source_topic_ids.includes(mergeTopic.id) ? [mergeTopic] : [],
          signal_ids: body.signal_ids,
          new_title: body.new_title,
          new_category: body.new_category,
          reason: body.reason,
          status: "pending",
          result_topic_id: null,
          proposed_by: "00000000-0000-4000-8000-000000000415",
          decided_by: null,
          decision_reason: null,
          decided_at: null,
          version: 1,
          created_at: "2026-08-22T12:00:00.000Z",
          updated_at: "2026-08-22T12:00:00.000Z",
        },
      ];
      return route.fulfill({ status: 201, json: envelope(changeRequests[0]) });
    }
    return route.fulfill({ json: envelope(changeRequests) });
  });
  await page.route("**/api/v1/trends/monitoring-rules", async (route) => {
    if (route.request().method() === "POST")
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(envelope(rule)),
      });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope([rule])),
    });
  });
  await page.route(`**/api/v1/trends/${topicId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope(options.detailData ?? detail)),
    }),
  );
  await page.route(`**/api/v1/trends/${topicId}/follow`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope({ topic_id: topicId, followed: true })),
    }),
  );
  await page.route(`**/api/v1/trends/${topicId}/evidence/*/quality-issues`, (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          created: true,
          issue: { id: issueId, severity: "warning", status: "open", version: 1 },
        }),
      ),
    }),
  );
  await page.route("**/api/v1/trends?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope(topics, { page: 1, page_size: 20, total: topics.length })),
    }),
  );
}

test("M04-01.A07/A08/A15 trend dashboard is responsive, truthful and visual", async ({ page }) => {
  await ready(page);
  await page.goto("/trends");
  await expect(
    page.getByRole("heading", { name: "系统自动找热点，你也可以马上刷新", level: 2 }),
  ).toBeVisible();
  const trendList = page.locator(".trend-list");
  await expect(trendList.getByText("2 个来源")).toBeVisible();
  await expect(trendList.getByText(/新鲜度/)).toBeVisible();
  await expect(trendList.getByText("可信度 数据不足")).toBeVisible();
  await expect(page.getByText("实际信号数", { exact: true })).toBeVisible();
  await expect(page.getByText("置信度：数据不足；不会用默认分数代替。")).toBeVisible();
  const evidence = page.locator(".trend-evidence-item").filter({
    hasText: "AI Skin Care Demand Rises",
  });
  await expect(evidence).toContainText("Example News");
  await evidence.getByRole("button", { name: "报告异常" }).click();
  await page.getByLabel("异常说明").fill("标题与原始页面字段不一致");
  await page.getByRole("button", { name: "创建质量工单" }).click();
  await expect(page.getByText(new RegExp(`质量工单 ${issueId} 已创建`))).toBeVisible();
  await expect(evidence.getByRole("button", { name: "已建质量工单" })).toBeDisabled();
  await expect(page.locator(".trend-workbench + .trend-explainer")).toBeVisible();
  await expect(page.locator(".trend-explainer")).not.toHaveAttribute("open");
  await expect(page.getByRole("link", { name: "转为机会" })).toHaveAttribute(
    "href",
    new RegExp(`source_topic_id=${topicId}`),
  );
  await expect(page.getByRole("button", { name: "创建监控", exact: true })).toBeVisible();
  await page.getByLabel("来源筛选").selectOption({ label: "Example News" });
  await expect(page.locator(".timeline-bars")).toHaveAttribute(
    "aria-label",
    /来源 Example News，共 1 个时间点/,
  );
  await page.getByRole("button", { name: "关注", exact: true }).click();
  await expect(page.getByRole("button", { name: "已关注", exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page).toHaveScreenshot("m04-01-trends.png", { fullPage: true });
});

test("long trend timelines scroll inside the detail card without widening the page", async ({
  page,
}) => {
  const timeline = Array.from({ length: 48 }, (_, index) => ({
    at: new Date(Date.UTC(2026, 7, 7, index)).toISOString(),
    signal_count: (index % 9) + 1,
    source_count: 1,
  }));
  await ready(page, [topic], { detailData: { ...detail, timeline, timeline_sources: [] } });
  await page.goto("/trends");
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page
        .locator(".timeline-bars")
        .evaluate((element) => element.scrollWidth > element.clientWidth),
    )
    .toBe(true);
});
test("M04-01.A08/A09 monitoring rule and empty/forbidden states are explicit", async ({ page }) => {
  await ready(page);
  await page.goto("/trends");
  await page.getByRole("button", { name: /监控规则/ }).click();
  await expect(page.getByRole("heading", { name: "趋势监控规则" })).toBeVisible();
  await expect(page.getByText(/邮件服务未确认/)).toBeVisible();
  await expect(page.getByText("至少 2 个独立来源")).toBeVisible();
  await page.getByRole("button", { name: "＋ 创建规则" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("推荐不等于采纳")).toBeVisible();
  await page.getByLabel("规则名称").fill("新的监控");
  await page.getByLabel("包含关键词（逗号分隔）").fill("desk lamp");
  await page.getByRole("button", { name: "创建并启用" }).click();
  await expect(page.getByText("监控规则已启用；当前仅发送站内通知。")).toBeVisible();
});

test("monitoring-rule deep links open the rule view and keep the legacy alias working", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/trends?section=rules");
  await expect(page.getByRole("heading", { name: "趋势监控规则" })).toBeVisible();
  await page.goto("/trends?tab=rules");
  await expect(page.getByRole("heading", { name: "趋势监控规则" })).toBeVisible();
});

test("trend:read-only loads topics and rules without requesting or exposing governance", async ({
  page,
}) => {
  let governanceRequests = 0;
  const consoleErrors: string[] = [],
    requestFailures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => requestFailures.push(request.url()));
  await ready(page, [topic], {
    capabilities: ["task:read", "trend:read"],
    onGovernanceRequest: () => (governanceRequests += 1),
  });

  await page.goto("/trends?section=governance");
  await expect(page).not.toHaveURL(/section=governance/);
  await expect(page.getByRole("heading", { name: topic.title })).toBeVisible();
  await expect(page.getByRole("button", { name: "立即获取热点" })).toBeVisible();
  await expect(page.getByRole("button", { name: /合并与拆分/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /创建监控/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "关注", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "标记无关" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "报告异常" })).toHaveCount(0);

  await page.getByRole("button", { name: /监控规则/ }).click();
  await expect(page.getByRole("heading", { name: "趋势监控规则" })).toBeVisible();
  await expect(page.getByText(/当前为只读权限/)).toBeVisible();
  await expect(page.getByText(rule.name)).toBeVisible();
  await expect(page.getByRole("button", { name: "暂停" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "查看趋势结果" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(governanceRequests).toBe(0);
  expect(consoleErrors).toEqual([]);
  expect(requestFailures).toEqual([]);
});

test("trend governance proposes a merge into a second-person confirmation queue", async ({
  page,
}) => {
  await ready(page, [topic, mergeTopic]);
  await page.goto("/trends");
  await page.getByRole("button", { name: /合并与拆分/ }).click();
  await expect(page.getByRole("heading", { name: "合并与拆分确认队列" })).toBeVisible();
  await page.getByText(`${mergeTopic.title} · v${mergeTopic.version}`).click();
  await page.getByLabel("提议原因").fill("两个主题描述同一消费信号");
  await page.getByRole("button", { name: "提交确认队列" }).click();
  await expect(page.getByText("治理提议已进入确认队列；需要另一位趋势管理员确认。")).toBeVisible();
  await expect(page.getByText("1 项待确认")).toBeVisible();
  await expect(page.getByText(`并入：${mergeTopic.title}`)).toBeVisible();
});

test("trend view URL restores filters, sorting and direct topic navigation", async ({ page }) => {
  await ready(page);
  await page.goto(`/trends?q=skin&sort=latest&topic=${topicId}`);
  await expect(page.getByLabel("关键词")).toHaveValue("skin");
  await expect(page.getByLabel("排序")).toHaveValue("latest");
  await expect(page.getByRole("heading", { name: detail.title })).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) <= 760)
    await page.getByRole("button", { name: /筛选趋势/ }).click();
  await page.getByLabel("分类").fill("beauty");
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/trends\\?q=skin&sort=latest&category=beauty&topic=${topicId}$`),
  );
});

test("empty trend filters expose a one-step recovery action", async ({ page }) => {
  await ready(page);
  await page.unroute("**/api/v1/trends?*");
  await page.route("**/api/v1/trends?*", (route) => {
    const empty = new URL(route.request().url()).searchParams.get("q") === "no-match";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        envelope(empty ? [] : [topic], { page: 1, page_size: 20, total: empty ? 0 : 1 }),
      ),
    });
  });
  await page.goto("/trends?q=no-match");
  await page.getByRole("button", { name: "清除筛选并恢复" }).click();
  await expect(page).toHaveURL(new RegExp(`/trends\\?topic=${topicId}$`));
  await expect(page.getByRole("heading", { name: detail.title })).toBeVisible();
});
