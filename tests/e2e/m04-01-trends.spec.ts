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
const relatedProduct = {
  id: "00000000-0000-4000-8000-000000000488",
  name: "情报对应的收纳盒",
  market: "US",
  main_asin: "B000000001",
  overall_score: null,
  competitor_count: 4,
  supplier_candidate_count: 60,
  profit_status: "insufficient_data",
};
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
  await expect(page.getByRole("heading", { name: /市场情报/, level: 2 })).toBeVisible();
  await expect(page.locator(".trend-collection-status, .trend-tabs")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "刷新情报", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建监控", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if ((page.viewportSize()?.width ?? 0) > 1100) {
    const metric = await page.locator(".trend-detail-facts div").first().boundingBox();
    expect(metric?.width).toBeGreaterThan(90);
  }
  await expect(page).toHaveScreenshot("m04-01-market-list.png", { fullPage: true });
  const trendList = page.locator(".trend-list");
  await expect(trendList.getByText("2 个来源")).toBeVisible();
  await expect(trendList.getByText(/新鲜度/)).toBeVisible();
  await expect(trendList.getByText("可信度 数据不足")).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) <= 1100) {
    await trendList.locator(":scope > button").first().click();
    await expect(trendList).toBeHidden();
    await expect(page.locator(".trend-detail")).toBeVisible();
    await expect(page.getByRole("button", { name: "返回趋势列表" })).toBeVisible();
  } else {
    await expect(trendList).toHaveCSS("overflow-y", "auto");
    await expect(page.locator(".trend-detail")).toHaveCSS("overflow-y", "auto");
  }
  const facts = page.getByRole("definition").filter({ hasText: "4 条" });
  await expect(facts).toBeVisible();
  await expect(page.getByLabel("情报资料")).toContainText("可信度数据不足");
  await expect(page.locator(".heat-summary, .trend-conclusion")).toHaveCount(0);
  const evidence = page.locator(".trend-evidence-item").filter({
    hasText: "AI Skin Care Demand Rises",
  });
  await expect(evidence).toContainText("Example News");
  await expect(evidence.getByRole("link", { name: "查看原文 ↗" })).toBeVisible();
  await expect(page.locator(".trend-workbench + .trend-explainer")).toBeVisible();
  await expect(page.locator(".trend-explainer")).not.toHaveAttribute("open");
  await expect(page.getByRole("link", { name: "转为机会" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "创建监控", exact: true })).toHaveCount(0);
  await page.getByLabel("来源筛选").selectOption({ label: "Example News" });
  await expect(page.locator(".timeline-bars")).toHaveAttribute(
    "aria-label",
    /来源 Example News，共 1 个时间点/,
  );
  // Both viewports capture fixed navigation at a deliberate scroll position.
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(
    await page
      .locator(".trend-detail-facts dt")
      .first()
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(13);
  await expect(page).toHaveScreenshot("intelligence-detail-readable-20261019.png", {
    fullPage: true,
  });
});

test("wide intelligence filters share one control row without widening the page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await ready(page);
  await page.goto("/trends");
  await expect(page.locator(".trend-filters")).toBeVisible();
  const controls = await page
    .locator(".trend-filters label input,.trend-filters label select,.trend-filter-actions")
    .evaluateAll((els) =>
      els.map((el) => ({
        top: el.getBoundingClientRect().top,
        height: el.getBoundingClientRect().height,
      })),
    );
  expect(controls).toHaveLength(6);
  expect(
    Math.max(...controls.map((x) => x.top)) - Math.min(...controls.map((x) => x.top)),
  ).toBeLessThan(2);
  expect(Math.min(...controls.map((x) => x.height))).toBeGreaterThanOrEqual(44);
  expect((await page.locator(".trend-filters").boundingBox())!.height).toBeLessThan(120);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
  if ((page.viewportSize()?.width ?? 0) <= 1100)
    await page.locator(".trend-list > button").first().click();
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
test("member intelligence exposes no configuration or mutation controls even to managers", async ({
  page,
}) => {
  await ready(page);
  await page.goto("/trends");
  await expect(page.getByRole("heading", { name: /市场情报/, level: 2 })).toBeVisible();
  for (const name of ["新建监控", "创建监控", "关注", "标记无关", "报告异常"])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
  await expect(page.locator(".trend-rule-dialog, .trend-governance, .trend-tabs")).toHaveCount(0);
});

test("retired monitoring and governance links resolve to intelligence without configuration requests", async ({
  page,
}) => {
  await ready(page);
  for (const query of ["section=rules", "tab=rules", "section=governance"]) {
    await page.goto(`/trends?${query}&q=skin`);
    await expect(page.getByRole("heading", { name: /市场情报/, level: 2 })).toBeVisible();
    await expect(page).not.toHaveURL(/(?:section|tab)=/);
    await expect(page).toHaveURL(/q=skin/);
    await expect(page.locator(".trend-tabs")).toHaveCount(0);
  }
});

test("trend:read-only loads intelligence and evidence without requesting management", async ({
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
  if ((page.viewportSize()?.width ?? 0) <= 1100)
    await page.locator(".trend-list > button").first().click();
  await expect(page.getByRole("heading", { name: topic.title })).toBeVisible();
  await expect(page.getByRole("button", { name: "刷新情报" })).toBeVisible();
  await expect(page.getByRole("button", { name: /合并与拆分/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /创建监控/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "关注", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "标记无关" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "报告异常" })).toHaveCount(0);

  await page.waitForLoadState("networkidle");
  expect(governanceRequests).toBe(0);
  expect(consoleErrors).toEqual([]);
  expect(requestFailures).toEqual([]);
});

test("refreshing intelligence only reloads facts and never calls management endpoints", async ({
  page,
}) => {
  let mutations = 0,
    legacyReads = 0;
  await ready(page);
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith("/api/v1/trends") && req.method() !== "GET") mutations++;
    if (/\/trends\/(monitoring-rules|change-requests)/.test(url.pathname)) legacyReads++;
  });
  await page.goto("/trends");
  await expect(page.getByRole("heading", { name: /市场情报/, level: 2 })).toBeVisible();
  const refreshed = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/trends");
  await page.getByRole("button", { name: "刷新情报", exact: true }).click();
  await refreshed;
  await expect(page.locator(".trend-list > button")).toHaveCount(1);
  expect(mutations).toBe(0);
  expect(legacyReads).toBe(0);
});

test("trend view URL restores filters, sorting and direct topic navigation", async ({ page }) => {
  await ready(page);
  await page.goto(`/trends?q=skin&sort=latest&topic=${topicId}`);
  if ((page.viewportSize()?.width ?? 0) <= 760)
    await page.getByRole("button", { name: /筛选趋势/ }).click();
  await expect(page.getByRole("textbox", { name: "关键词", exact: true })).toHaveValue("skin");
  await expect(page.getByLabel("排序")).toHaveValue("latest");
  await expect(page.getByRole("heading", { name: detail.title })).toBeVisible();
  await page.getByRole("textbox", { name: "分类", exact: true }).fill("beauty");
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`/trends\\?q=skin&sort=latest&category=beauty&topic=${topicId}$`),
  );
});

test("all-status selection survives the URL and reload without adding an API status filter", async ({
  page,
}) => {
  await ready(page);
  const listQueries: { routeStatus: string | null; query: URLSearchParams }[] = [];
  await page.unroute("**/api/v1/trends?*");
  await page.route("**/api/v1/trends?*", (route) => {
    listQueries.push({
      routeStatus: new URL(page.url()).searchParams.get("status"),
      query: new URL(route.request().url()).searchParams,
    });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope([topic], { page: 1, page_size: 20, total: 1 })),
    });
  });

  await page.goto("/trends");
  if ((page.viewportSize()?.width ?? 0) <= 760)
    await page.getByRole("button", { name: /筛选趋势/ }).click();
  await page.getByLabel("状态").selectOption("");
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.has("status")).toBe(true);
  await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe("");
  await expect(page.getByLabel("状态")).toHaveValue("");
  await expect.poll(() => listQueries.some((entry) => entry.routeStatus === "")).toBe(true);

  await page.reload();
  if ((page.viewportSize()?.width ?? 0) <= 760)
    await page.getByRole("button", { name: /筛选趋势/ }).click();
  await expect(page.getByLabel("状态")).toHaveValue("");
  await expect
    .poll(() => listQueries.filter((entry) => entry.routeStatus === "").length >= 2)
    .toBe(true);
  expect(listQueries.some((entry) => entry.query.get("status") === "active")).toBe(true);
  expect(
    listQueries
      .filter((entry) => entry.routeStatus === "")
      .every((entry) => !entry.query.has("status")),
  ).toBe(true);
});

test("switching topics hides previous evidence until the requested detail arrives", async ({
  page,
}) => {
  await ready(page, [topic, mergeTopic]);
  let releaseDetail!: () => void;
  const detailGate = new Promise<void>((resolve) => {
    releaseDetail = resolve;
  });
  await page.route(`**/api/v1/trends/${mergeTopic.id}`, async (route) => {
    await detailGate;
    await route.fulfill({ json: envelope({ ...detail, ...mergeTopic, evidence: [] }) });
  });
  await page.goto("/trends");
  await expect(page.locator('.trend-list > button[aria-pressed="true"]')).toContainText(
    topic.title,
  );
  try {
    await page.locator(".trend-list > button").filter({ hasText: mergeTopic.title }).click();
    await expect(page.getByRole("heading", { name: "正在读取情报证据" })).toBeVisible();
    await expect(page.locator(".trend-detail h3")).toHaveCount(0);
    await expect(page.locator(".trend-detail-facts, .trend-detail .trend-evidence")).toHaveCount(0);
    if ((page.viewportSize()?.width ?? 0) <= 1100) {
      await page.getByRole("button", { name: "返回趋势列表" }).click();
      await expect(page.locator(".trend-list")).toBeVisible();
      await page.locator(".trend-list > button").filter({ hasText: mergeTopic.title }).click();
    }
    releaseDetail();
    await expect(page.locator(".trend-detail h3")).toHaveText(mergeTopic.title);
    await expect(page.getByRole("heading", { name: "正在读取情报证据" })).toHaveCount(0);
    await expect(page.locator(".trend-detail")).not.toContainText(detail.evidence[0].title);
  } finally {
    releaseDetail();
  }
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
  if ((page.viewportSize()?.width ?? 0) <= 1100)
    await page.locator(".trend-list > button").first().click();
  await expect(page.getByRole("heading", { name: detail.title })).toBeVisible();
});

test("related products use exact topic scope, preserve unknowns and paginate without writes", async ({
  page,
}) => {
  await ready(page, [topic], { capabilities: [...managerCapabilities, "opportunity:read"] });
  const reads: URL[] = [];
  await page.route("**/api/v1/opportunities?*", async (route) => {
    const query = new URL(route.request().url());
    reads.push(query);
    expect(route.request().method()).toBe("GET");
    expect(query.searchParams.get("source_topic_id")).toBe(topicId);
    expect(query.searchParams.get("selection_view")).toBe("all");
    expect(query.searchParams.get("page_size")).toBe("5");
    const second = query.searchParams.get("page") === "2";
    await route.fulfill({
      json: envelope(
        [{ ...relatedProduct, name: second ? "第二页关联选品" : relatedProduct.name }],
        { total: 6 },
      ),
    });
  });
  await page.goto(`/trends?topic=${topicId}`);
  const region = page.getByRole("region", { name: "关联选品", exact: true });
  await expect(region.getByRole("link", { name: relatedProduct.name })).toBeVisible();
  await expect(region).toContainText("不代表已推荐或整链完成");
  await expect(region).toContainText("未知");
  await expect(region).toContainText("竞品候选");
  const href = await region.getByRole("link", { name: relatedProduct.name }).getAttribute("href");
  expect(new URL(href!, "https://example.test").searchParams.get("from")).toBe(
    `/trends?topic=${topicId}`,
  );
  await region.scrollIntoViewIfNeeded();
  await expect(page).toHaveScreenshot("intelligence-related-products-20261019.png", {
    fullPage: false,
  });
  await region.getByRole("button", { name: "下一页" }).click();
  await expect(region).toContainText("第二页关联选品");
  await region.getByRole("button", { name: "上一页" }).click();
  await expect(region).toContainText(relatedProduct.name);
  expect(reads.map((url) => url.searchParams.get("page"))).toEqual(["1", "2", "1"]);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test("related products never read without opportunity permission", async ({ page }) => {
  await ready(page);
  let reads = 0;
  await page.route("**/api/v1/opportunities?*", (route) => {
    reads++;
    return route.fulfill({ json: envelope([], { total: 0 }) });
  });
  await page.goto(`/trends?topic=${topicId}`);
  await expect(page.getByRole("heading", { name: "主要证据", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "关联选品", exact: true })).toHaveCount(0);
  expect(reads).toBe(0);
});

test("related product failure is local and retry reads only related products", async ({ page }) => {
  await ready(page, [topic], { capabilities: [...managerCapabilities, "opportunity:read"] });
  let reads = 0;
  await page.route("**/api/v1/opportunities?*", (route) => {
    reads++;
    return reads === 1
      ? route.fulfill({
          status: 500,
          json: {
            error: { code: "internal_error", message: "test failure" },
            request_id: "related-read",
            trace_id: "related-read",
          },
        })
      : route.fulfill({ json: envelope([relatedProduct], { total: 1 }) });
  });
  await page.goto(`/trends?topic=${topicId}`);
  const region = page.getByRole("region", { name: "关联选品", exact: true });
  await expect(region).toContainText("读取失败");
  await expect(page.getByRole("heading", { name: "主要证据", exact: true })).toBeVisible();
  await region.getByRole("button", { name: "重试关联选品" }).click();
  await expect(region).toContainText(relatedProduct.name);
  expect(reads).toBe(2);
});

test("related product permission denial preserves evidence without offering a blind retry", async ({
  page,
}) => {
  await ready(page, [topic], { capabilities: [...managerCapabilities, "opportunity:read"] });
  let reads = 0;
  await page.route("**/api/v1/opportunities?*", (route) => {
    reads++;
    return route.fulfill({
      status: 403,
      json: {
        error: { code: "capability_required", message: "denied" },
        request_id: "denied-related",
        trace_id: "denied-related",
      },
    });
  });
  await page.goto(`/trends?topic=${topicId}`);
  const region = page.getByRole("region", { name: "关联选品", exact: true });
  await expect(region).toContainText("无权读取关联选品");
  await expect(region.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "主要证据", exact: true })).toBeVisible();
  expect(reads).toBe(1);
});

test("related products recover from a page that disappears without hiding existing records", async ({
  page,
}) => {
  await ready(page, [topic], { capabilities: [...managerCapabilities, "opportunity:read"] });
  let reads = 0;
  await page.route("**/api/v1/opportunities?*", (route) => {
    reads++;
    const second = new URL(route.request().url()).searchParams.get("page") === "2";
    return route.fulfill({
      json: envelope(second ? [] : [relatedProduct], { total: reads === 1 ? 6 : 1 }),
    });
  });
  await page.goto(`/trends?topic=${topicId}`);
  const region = page.getByRole("region", { name: "关联选品", exact: true });
  await expect(region).toContainText(relatedProduct.name);
  await region.getByRole("button", { name: "下一页" }).click();
  await expect(region).toContainText("1 个未归档记录");
  await expect(region).toContainText(relatedProduct.name);
  await expect(region.getByRole("navigation")).toHaveCount(0);
  expect(reads).toBe(3);
});

test("related products empty state does not claim discovery is running", async ({ page }) => {
  await ready(page, [topic], { capabilities: [...managerCapabilities, "opportunity:read"] });
  await page.route("**/api/v1/opportunities?*", (route) =>
    route.fulfill({ json: envelope([], { total: 0 }) }),
  );
  await page.goto(`/trends?topic=${topicId}`);
  const region = page.getByRole("region", { name: "关联选品", exact: true });
  await expect(region).toContainText("尚无已关联的未归档选品记录");
  await expect(region).not.toContainText("正在读取");
  await expect(region.getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "主要证据", exact: true })).toBeVisible();
});

test("a late related product response cannot replace the newly selected topic", async ({
  page,
}) => {
  await ready(page, [topic, mergeTopic], {
    capabilities: [...managerCapabilities, "opportunity:read"],
  });
  await page.route(`**/api/v1/trends/${mergeTopic.id}`, (route) =>
    route.fulfill({ json: envelope({ ...detail, ...mergeTopic }) }),
  );
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let firstRead!: () => void;
  const started = new Promise<void>((resolve) => {
    firstRead = resolve;
  });
  let finishOld!: () => void;
  const oldFinished = new Promise<void>((resolve) => {
    finishOld = resolve;
  });
  await page.route("**/api/v1/opportunities?*", async (route) => {
    const old = new URL(route.request().url()).searchParams.get("source_topic_id") === topicId;
    if (old) {
      firstRead();
      await blocked;
    }
    await route
      .fulfill({
        json: envelope([{ ...relatedProduct, name: old ? "过期关联选品" : "新主题关联选品" }], {
          total: 1,
        }),
      })
      .catch(() => {});
    if (old) finishOld();
  });
  await page.goto(`/trends?topic=${topicId}`);
  await started;
  try {
    if ((page.viewportSize()?.width ?? 0) <= 1100)
      await page.getByRole("button", { name: "返回趋势列表" }).click();
    await page.locator(".trend-list > button").filter({ hasText: mergeTopic.title }).click();
    const region = page.getByRole("region", { name: "关联选品", exact: true });
    await expect(region).toContainText("新主题关联选品");
    release();
    await oldFinished;
    await expect(region).not.toContainText("过期关联选品");
  } finally {
    release();
  }
});
