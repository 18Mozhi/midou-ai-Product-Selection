import { test, expect, type Page } from "@playwright/test";

const topicId = "00000000-0000-4000-8000-000000000404",
  ruleId = "00000000-0000-4000-8000-000000000405";
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
async function navigation(page: Page) {
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
          capabilities: ["task:read", "trend:read", "trend:manage"],
          platform_roles: [],
          platform_capabilities: [],
          guard_reason: "navigation_member_allowed",
        }),
      ),
    }),
  );
}
async function ready(page: Page) {
  await navigation(page);
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
      body: JSON.stringify(envelope(detail)),
    }),
  );
  await page.route(`**/api/v1/trends/${topicId}/follow`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope({ topic_id: topicId, followed: true })),
    }),
  );
  await page.route("**/api/v1/trends?*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope([topic], { page: 1, page_size: 20, total: 1 })),
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
  await expect(page.getByRole("link", { name: /AI Skin Care Demand Rises/ })).toContainText(
    "Example News",
  );
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
test("M04-01.A08/A09 monitoring rule and empty/forbidden states are explicit", async ({ page }) => {
  await ready(page);
  await page.goto("/trends");
  await page.getByRole("button", { name: /监控规则/ }).click();
  await expect(page.getByRole("heading", { name: "趋势监控规则" })).toBeVisible();
  await expect(page.getByText(/邮件服务未确认/)).toBeVisible();
  await page.getByRole("button", { name: "＋ 创建规则" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("规则名称").fill("新的监控");
  await page.getByLabel("包含关键词（逗号分隔）").fill("desk lamp");
  await page.getByRole("button", { name: "创建并启用" }).click();
  await expect(page.getByText("监控规则已启用；当前仅发送站内通知。")).toBeVisible();
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
