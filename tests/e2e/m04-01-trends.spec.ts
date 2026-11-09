import { chromium, test, expect, type Page } from "@playwright/test";

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
  await expect(page.locator(".trend-list > .trend-topic-row")).toHaveCount(1);
  await expect(page.locator(".trend-pagination")).toHaveCount(0);
  await expect(page).toHaveScreenshot("m04-01-market-list.png", { fullPage: true });
  const trendList = page.locator(".trend-list");
  await expect(trendList.getByText("2 个来源")).toBeVisible();
  await expect(trendList.getByText(/新鲜度/)).toBeVisible();
  await expect(trendList.getByText("可信度 数据不足")).toBeVisible();
  await expect(page.locator(".trend-detail")).toHaveCount(0);
  await trendList.locator(":scope > button").first().click();
  if ((page.viewportSize()?.width ?? 0) <= 840) {
    await expect(trendList).toBeHidden();
    await expect(page.locator(".trend-detail")).toBeVisible();
    await expect(page.getByRole("button", { name: "关闭详情 · 返回情报列表" })).toBeVisible();
  } else {
    // A single fully visible row needs no scrollbar; the detail pane still scrolls.
    await expect(trendList).not.toHaveAttribute("data-split-overflow", "true");
    await expect(trendList.locator(":scope > .trend-topic-row")).toBeInViewport({ ratio: 1 });
    if ((page.viewportSize()?.width ?? 0) >= 1101)
      await expect(trendList).toHaveCSS("overflow-y", "clip");
    await expect(page.locator(".trend-detail")).toHaveCSS("overflow-y", "auto");
  }
  const facts = page.getByRole("definition").filter({ hasText: "4 条" });
  await expect(facts).toBeVisible();
  await expect(page.getByLabel("情报资料")).toContainText("可信度数据不足");
  await expect(page.locator(".heat-summary, .trend-conclusion")).toHaveCount(0);
  await page.getByRole("tab", { name: "来源证据" }).click();
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

test("tablet intelligence keeps filters and actions in two balanced rows", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Tablet filter layout");
  await page.setViewportSize({ width: 841, height: 900 });
  await ready(page);
  await page.goto("/trends");
  const form = page.locator(".trend-filters");
  const category = form.getByRole("textbox", { name: "分类", exact: true });
  await expect(form).toBeVisible();
  for (const width of [761, 841, 960, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await form.evaluate((el) => {
      const fields = Array.from(
        el.querySelectorAll(":scope > label, :scope > .trend-filter-actions"),
      );
      const first = fields.slice(0, 3).map((part) => part.getBoundingClientRect());
      const second = fields.slice(3).map((part) => part.getBoundingClientRect());
      const sameBottom = (boxes: DOMRect[]) =>
        Math.max(...boxes.map((b) => b.bottom)) - Math.min(...boxes.map((b) => b.bottom)) <= 1;
      const pageFits = document.documentElement.scrollWidth <= innerWidth;
      return {
        firstAligned: sameBottom(first),
        secondAligned: sameBottom(second),
        contained: fields.every(
          (part) => part.getBoundingClientRect().right <= el.getBoundingClientRect().right + 1,
        ),
        pageFits,
      };
    });
    expect(layout, `width=${width}`).toEqual({
      firstAligned: true,
      secondAligned: true,
      contained: true,
      pageFits: true,
    });
  }
  await category.fill("electronics");
  await form.getByRole("button", { name: "筛选", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("category")).toBe("electronics");
  await form.getByRole("button", { name: "重置", exact: true }).click();
  await expect(category).toHaveValue("");
  await page.setViewportSize({ width: 761, height: 900 });
  const [heading, filter] = await Promise.all([
    page.locator(".trend-market-heading p").boundingBox(),
    form.boundingBox(),
  ]);
  expect(filter!.y - heading!.y - heading!.height).toBeLessThan(42);
  await page.setViewportSize({ width: 760, height: 900 });
  const drawer = page.getByRole("button", { name: /筛选趋势/ });
  await expect(drawer).toBeVisible();
  await expect(form).toBeHidden();
  await drawer.click();
  await expect(form).toBeVisible();
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
  expect(Math.min(...controls.map((x) => x.height))).toBeGreaterThanOrEqual(40);
  const icons = page.locator(
    ".trend-filters :is(.trend-filter-field, .trend-filter-search) > svg:not(.trend-filter-chevron)",
  );
  await expect(icons).toHaveCount(5);
  for (const icon of await icons.all()) await expect(icon).toHaveCSS("width", "20px");
  await expect(page.locator(".trend-filter-search input")).toHaveCSS(
    "padding-inline-start",
    "42px",
  );
  await expect(page.getByRole("button", { name: "筛选", exact: true }).locator("svg")).toHaveCSS(
    "width",
    "20px",
  );
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
  await page.locator(".trend-list > button").first().click();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  await page.getByRole("tab", { name: "来源证据" }).click();
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
  await expect(
    page.getByRole("button", { name: "筛选", exact: true }).locator("svg"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "重置", exact: true }).locator("svg"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: detail.title })).toBeVisible();
  await page.getByRole("textbox", { name: "分类", exact: true }).fill("beauty");
  await page.getByRole("button", { name: "筛选", exact: true }).click();
  await expect(page).toHaveURL(/\/trends\?q=skin&sort=latest&category=beauty$/);
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
  await page.locator(".trend-list > button").filter({ hasText: topic.title }).first().click();
  await expect(page.locator('.trend-list > button[aria-pressed="true"]')).toContainText(
    topic.title,
  );
  if ((page.viewportSize()?.width ?? 0) <= 840) {
    await page.getByRole("button", { name: "关闭详情 · 返回情报列表" }).click();
    await expect(page).toHaveURL(/\/trends$/);
  }
  try {
    await page.locator(".trend-list > button").filter({ hasText: mergeTopic.title }).click();
    await expect(page.getByRole("heading", { name: "正在读取情报证据" })).toBeVisible();
    await expect(page.locator(".trend-detail h3")).toHaveCount(0);
    await expect(page.locator(".trend-detail-facts, .trend-detail .trend-evidence")).toHaveCount(0);
    if ((page.viewportSize()?.width ?? 0) <= 840) {
      await page.getByRole("button", { name: "关闭详情 · 返回情报列表" }).click();
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
  await expect(page).toHaveURL(/\/trends$/);
  await page.locator(".trend-list > button").first().click();
  await expect(page.getByRole("heading", { name: detail.title })).toBeVisible();
});

test("wide related product cards align identity and four metrics in one row", async ({ page }) => {
  await page.setViewportSize({ width: 1717, height: 916 });
  await ready(
    page,
    [
      topic,
      ...[1, 2, 3].map((index) => ({
        ...topic,
        id: `00000000-0000-4000-8000-0000000009${index}0`,
        title: `Market intelligence example with a longer product title for review ${index}`,
      })),
    ],
    { capabilities: [...managerCapabilities, "opportunity:read"] },
  );
  await page.route("**/api/v1/opportunities?*", (route) =>
    route.fulfill({
      json: envelope(
        [
          {
            ...relatedProduct,
            name: "Portable Home Storage Organizer with Stackable Compartments and a Removable Lid – Related Product Fixture",
          },
        ],
        { total: 1 },
      ),
    }),
  );
  await page.goto(`/trends?topic=${topicId}`);
  const card = page.getByRole("region", { name: "关联选品", exact: true }).locator("li");
  const icon = card.locator("svg");
  await expect(icon).toBeVisible();
  await expect(icon).toHaveAttribute("aria-hidden", "true");
  await expect(card.locator("dd")).toHaveCount(4);
  await expect(card.locator("dd").first()).toHaveText("未知");
  const [identity, metrics] = await Promise.all([
    card.locator("a").boundingBox(),
    card.locator("dl").boundingBox(),
  ]);
  const title = (await card.locator("strong").boundingBox())!;
  expect(Math.abs(title.x - 964)).toBeLessThanOrEqual(4);
  expect(title.height).toBeGreaterThan(34);
  await expect(page.locator(".trend-list > .trend-topic-row")).toHaveCount(4);
  expect(metrics!.x).toBeGreaterThan(identity!.x + identity!.width);
  expect(Math.abs(metrics!.y - identity!.y)).toBeLessThan(1);
  const positions = await card
    .locator("dt")
    .evaluateAll((labels) => labels.map((label) => label.getBoundingClientRect().y));
  expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(1);
  const reading = await page.evaluate(() => {
    const lastMetric = document.querySelector(".trend-related-products li dl > div:last-child")!;
    const activeTab = document.querySelector('.trend-detail-tabs > button[aria-selected="true"]')!;
    return {
      metricInset: getComputedStyle(lastMetric).paddingInlineStart,
      activeUnderlineInset: getComputedStyle(activeTab, "::after").insetInlineStart,
    };
  });
  console.log("INTELLIGENCE_METRIC_READING", JSON.stringify(reading));
  expect(reading).toEqual({ metricInset: "7px", activeUnderlineInset: "4px" });
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
  await page.getByRole("tab", { name: "关联选品", exact: true }).click();
  await region.getByRole("button", { name: "下一页" }).click();
  await expect(region).toContainText("第二页关联选品");
  await region.getByRole("button", { name: "上一页" }).click();
  await expect(region).toContainText(relatedProduct.name);
  expect(reads.map((url) => url.searchParams.get("page"))).toEqual(["1", "2", "1"]);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test("related product cards adapt metric columns to available width", async ({ page }) => {
  await ready(page, [topic], { capabilities: [...managerCapabilities, "opportunity:read"] });
  await page.route("**/api/v1/opportunities?*", (route) =>
    route.fulfill({ json: envelope([relatedProduct], { total: 1 }) }),
  );
  await page.setViewportSize({ width: 1717, height: 916 });
  await page.goto(`/trends?topic=${topicId}`);
  const card = page.getByRole("region", { name: "关联选品", exact: true }).locator("li");
  await expect(card).toBeVisible();
  const columns = () =>
    card
      .locator("dl")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  await expect.poll(columns).toBe(4);
  const cardTop = (await card.boundingBox())!.y;
  const note = page.locator(".trend-related-note");
  expect(cardTop).toBeLessThanOrEqual(724);
  expect((await note.boundingBox())!.y).toBeGreaterThanOrEqual(
    cardTop + (await card.boundingBox())!.height,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(columns).toBe(2);
  await expect(card.getByRole("link", { name: relatedProduct.name })).toBeVisible();
});

test("related products never read without opportunity permission", async ({ page }) => {
  await ready(page);
  let reads = 0;
  await page.route("**/api/v1/opportunities?*", (route) => {
    reads++;
    return route.fulfill({ json: envelope([], { total: 0 }) });
  });
  await page.goto(`/trends?topic=${topicId}`);
  await page.getByRole("tab", { name: "来源证据" }).click();
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
  await page.getByRole("tab", { name: "来源证据" }).click();
  await expect(page.getByRole("heading", { name: "主要证据", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "关联选品", exact: true }).click();
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
  await page.getByRole("tab", { name: "来源证据" }).click();
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
  await page.getByRole("tab", { name: "关联选品", exact: true }).click();
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
  await page.getByRole("tab", { name: "来源证据" }).click();
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
      await page.getByRole("button", { name: "关闭详情 · 返回情报列表" }).click();
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

test("metric help opens without retired member styles or horizontal overflow", async ({ page }) => {
  await ready(page);
  await page.goto("/trends");
  const help = page.locator(".trend-explainer");
  await expect(help).not.toHaveAttribute("open");
  await expect(help.locator("ol")).toBeHidden();
  await help.locator("summary").click();
  await expect(help).toHaveAttribute("open", "");
  const items = help.locator("li");
  await expect(items).toHaveCount(4);
  for (const item of await items.all()) {
    await expect(item).toBeVisible();
    const box = await item.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await help.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(help).not.toHaveAttribute("open");
  await expect(help.locator("ol")).toBeHidden();
});

test("midou reference list defaults closed, opens and closes detail without list reload", async ({
  page,
}) => {
  if (page.viewportSize()!.width >= 1101) {
    await page.setViewportSize({ width: 1717, height: 916 });
  }
  await ready(page, [
    topic,
    ...[1, 2, 3].map((index) => ({
      ...topic,
      id: `00000000-0000-4000-8000-0000000009${index}0`,
      title: `Long market intelligence product title for comparison, sourcing and analysis ${index}`,
    })),
  ]);
  let reads = 0,
    lists = 0;
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname === "/api/v1/trends/" + topicId) reads++;
    if (u.pathname === "/api/v1/trends") lists++;
  });
  await page.goto("/trends");
  await expect(page.locator(".trend-list > button")).toHaveCount(4);
  await expect(page.locator(".trend-pagination")).toHaveCount(0);
  await expect(page.locator(".trend-detail")).toHaveCount(0);
  expect(reads).toBe(0);
  if (page.viewportSize()!.width >= 1440) {
    const row = page.locator(".trend-topic-row").first();
    const [title, provenance, bounds] = await Promise.all([
      row.locator("strong").boundingBox(),
      row.locator(".trend-topic-provenance").boundingBox(),
      row.boundingBox(),
    ]);
    expect(provenance!.x).toBeGreaterThan(title!.x);
    expect(bounds!.height).toBeLessThanOrEqual(82);
  }
  await expect(page.getByRole("link", { name: "米兜智能选品", exact: true })).toBeVisible();
  expect(await page.getByRole("navigation", { name: "面包屑", exact: true }).count()).toBe(1);
  await page.locator(".trend-list > button").first().click();
  await expect(page.locator(".trend-detail")).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) >= 1101) {
    const list = page.locator(".trend-list");
    await expect(list.locator(".topic-copy > strong").last()).toHaveCSS(
      "-webkit-line-clamp",
      page.viewportSize()!.width >= 1600 ? "3" : "2",
    );
    if (page.viewportSize()!.width >= 1600 && page.viewportSize()!.height >= 916) {
      const filters = (await page.locator(".trend-filters").boundingBox())!;
      const heading = page.locator(".trend-market-heading");
      const actions = heading.locator(".trend-market-actions");
      const refresh = actions.getByRole("button", { name: "刷新情报" });
      await expect(refresh.locator("svg")).toHaveAttribute("aria-hidden", "true");
      await expect(refresh).toHaveCSS("background-color", "rgb(255, 255, 255)");
      const sources = actions.getByRole("button", { name: "查看来源" });
      await expect(sources).toHaveCSS("border-radius", "7px");
      await expect(sources).not.toHaveCSS("background-color", "rgb(255, 255, 255)");
      const [refreshBox, sourcesBox] = await Promise.all([
        refresh.boundingBox(),
        sources.boundingBox(),
      ]);
      expect([refreshBox!.width, sourcesBox!.width]).toEqual([139, 172]);
      expect(sourcesBox!.x - refreshBox!.x - refreshBox!.width).toBeCloseTo(16, 0);
      expect(Math.abs((await refresh.boundingBox())!.y - 143)).toBeLessThanOrEqual(3);
      await expect(heading.locator("h2 > span")).toHaveCSS("font-size", "15px");
      await expect(heading.locator("p")).toHaveCSS("font-size", "16px");
      expect(Math.abs(filters.y - 216)).toBeLessThanOrEqual(2);
      const filterBar = page.locator(".trend-filters");
      const filterActions = filterBar.locator(".trend-filter-actions");
      const resetBorder = await filterActions
        .getByRole("button", { name: "重置" })
        .evaluate((el) => getComputedStyle(el).borderTopColor);
      await expect(filterActions.getByRole("button", { name: "筛选" })).not.toHaveCSS(
        "border-top-color",
        resetBorder,
      );
      await expect(list.locator('.trend-topic-row[aria-pressed="false"]').first()).toHaveCSS(
        "border-radius",
        "0px",
      );
      const marketControl = filterBar.getByRole("combobox", { name: "市场", exact: true });
      const marketBounds = (await marketControl.boundingBox())!;
      expect(Math.abs(marketBounds.y - 257)).toBeLessThanOrEqual(3);
      expect(Math.abs(marketBounds.height - 40)).toBeLessThanOrEqual(1);
      const fields = await filterBar
        .locator(":scope > label")
        .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().width));
      expect(fields).toHaveLength(5);
      for (const [index, width] of [207, 215, 175, 297, 194].entries()) {
        expect(Math.abs(fields[index] - width)).toBeLessThanOrEqual(9);
      }
      const [apply, reset] = await filterBar
        .locator(".trend-filter-actions > button")
        .evaluateAll((nodes) =>
          nodes.map((node) => {
            const { x, width } = node.getBoundingClientRect();
            return { x, width };
          }),
        );
      expect([apply.width, reset.width, reset.x - apply.x - apply.width]).toEqual([97, 94, 14]);
      expect(Math.abs(apply.x - 1478)).toBeLessThanOrEqual(3);
      await expect(
        page.locator(".trend-filter-field svg:not(.trend-filter-chevron):visible"),
      ).toHaveCount(4);
      await expect(page.locator(".trend-filter-field .trend-filter-chevron:visible")).toHaveCount(
        3,
      );
      await expect(page.getByRole("combobox", { name: "市场", exact: true })).toHaveCSS(
        "padding-left",
        "44px",
      );
      const listBox = (await list.boundingBox())!;
      expect(Math.abs(listBox.y - 334)).toBeLessThanOrEqual(2);
      const listHeader = list.locator(":scope > header");
      const headerBox = (await listHeader.boundingBox())!;
      expect(Math.abs(headerBox.y + headerBox.height - 416)).toBeLessThanOrEqual(2);
      await expect(listHeader.getByText("情报列表", { exact: true })).toHaveCSS(
        "font-size",
        "20px",
      );
      await expect(listHeader.getByText("共 4 个主题", { exact: true })).toHaveCSS(
        "font-size",
        "14px",
      );
      expect(listBox.y - filters.y - filters.height).toBeCloseTo(21, 0);
      await expect(list.locator(".topic-copy > strong").first()).toHaveCSS("font-size", "16.2px");
      await expect(list.locator(".trend-topic-row").first()).toHaveCSS("padding-top", "11px");
      const heat = list.locator(".topic-heat").first();
      const [count, unit] = await Promise.all([
        heat.locator("b").boundingBox(),
        heat.locator("small").boundingBox(),
      ]);
      expect(Math.abs(count!.x + count!.width / 2 - 735)).toBeLessThanOrEqual(4);
      await expect(list.locator(".trend-topic-row > em").first()).toHaveCSS("width", "54px");
      expect(Math.abs(count!.x + count!.width / 2 - unit!.x - unit!.width / 2)).toBeLessThanOrEqual(
        1,
      );
      expect(Math.abs(unit!.y - count!.y - count!.height - 2)).toBeLessThanOrEqual(1);
      expect(
        await list.evaluate(
          (el) =>
            el.querySelector(".trend-topic-row:last-of-type")!.getBoundingClientRect().bottom -
            el.getBoundingClientRect().bottom,
        ),
      ).toBeLessThanOrEqual(0);
    }
  }
  expect(reads).toBe(1);
  const close = page.getByRole("button", { name: "关闭详情 · 返回情报列表" });
  await expect(page.locator(".trend-detail-badges")).toContainText("en-US");
  await expect(page.locator(".trend-detail-badges > span > svg")).toHaveCount(2);
  await expect(page.locator(".trend-detail > header h3")).toHaveCSS(
    "font-size",
    (page.viewportSize()?.width ?? 0) >= 1600
      ? "26.5px"
      : (page.viewportSize()?.width ?? 0) >= 1101
        ? "27px"
        : "22px",
  );
  await expect(page.getByLabel("情报资料").locator("dt svg")).toHaveCount(4);
  if (page.viewportSize()!.width >= 1440) {
    await expect(close).toHaveCSS("border-top-width", "1px");
    expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(36);
    const facts = page.getByLabel("情报资料");
    const panel = page.locator(".trend-detail");
    await expect(panel.locator(".trend-detail-freshness")).toHaveCSS("font-size", "15px");
    await expect(panel.locator(".trend-overview-evidence-title")).toHaveText(
      detail.evidence[0].title,
    );
    await expect(facts.locator("dt").nth(1).locator("path")).toHaveAttribute("d", /^m12 2 10 5/);
    await expect(facts.locator("dt").nth(2).locator("path")).toHaveAttribute("d", /^M5 2h9/);
    const badges = panel.locator(".trend-detail-badges");
    await expect(badges).toHaveCSS(
      "column-gap",
      page.viewportSize()!.width >= 1600 ? "14px" : "12px",
    );
    await expect(badges.locator(":scope > span").first()).toHaveCSS("min-height", "30px");
    await expect(panel.locator("h3")).toHaveCSS(
      "margin-top",
      page.viewportSize()!.width >= 1600 ? "9px" : "12px",
    );
    const detailTabs = panel.getByRole("tablist");
    await expect(detailTabs).toHaveCSS("column-gap", "8px");
    for (const tab of await detailTabs.getByRole("tab").all()) {
      await expect(tab).toHaveCSS("width", "116px");
    }
    const [panelBox, titleBox, factsBox] = await Promise.all(
      [panel, panel.locator("h3"), facts].map((part) => part.boundingBox()),
    );
    expect(factsBox!.x - panelBox!.x).toBeCloseTo(23, 0);
    expect(titleBox!.x - factsBox!.x).toBeCloseTo(8, 0);
    await expect(facts).toHaveCSS("min-height", "93px");
    await expect(facts).toHaveCSS("margin-top", "12px");
    expect(Math.abs(factsBox!.y - 505)).toBeLessThanOrEqual(5);
    await expect(facts.locator("dt").first()).toHaveCSS("font-size", "14px");
    await expect(facts.locator("dd").first()).toHaveCSS("font-size", "20px");
    await expect(facts.locator("dd[data-insufficient='true']")).toHaveCSS("font-size", "14px");
    const widths = await facts
      .locator(":scope > div")
      .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().width));
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
  }
  await close.click();
  await expect(page.locator(".trend-detail")).toHaveCount(0);
  await expect(page.locator(".trend-list")).toBeVisible();
  expect(lists).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("desktop intelligence pagination stays fully visible beside an open detail", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1717, height: 916 });
  await ready(page);
  const topics = [
    topic,
    ...Array.from({ length: 19 }, (_, index) => ({
      ...topic,
      id: `00000000-0000-4000-8000-000000000${index + 700}`,
    })),
  ];
  await page.route(/\/api\/v1\/trends\?/, (route) => {
    const secondPage = new URL(route.request().url()).searchParams.get("page") === "2";
    return route.fulfill({ json: envelope(secondPage ? topics.slice(-1) : topics, { total: 21 }) });
  });
  await page.goto("/trends");
  const list = page.locator(".trend-list");
  await expect(list.locator(".trend-topic-row")).toHaveCount(20);
  await list.locator(".trend-topic-row").first().click();
  await expect(page.locator(".trend-detail")).toBeVisible();
  const pager = list.locator(".trend-pagination");
  const bounds = (await list.boundingBox())!;
  const footer = (await pager.boundingBox())!;
  expect(footer.y).toBeGreaterThan(bounds.y);
  expect(footer.y + footer.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  const sort = list.getByRole("combobox", { name: "情报列表顺序" });
  const sortStart = (await sort.boundingBox())!;
  await list.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const sortEnd = (await sort.boundingBox())!;
  expect(sortEnd.y).toBeCloseTo(sortStart.y, 0);
  const panel = (await list.boundingBox())!;
  console.log(
    "intelligence split sort",
    JSON.stringify({
      before: sortStart.y,
      after: sortEnd.y,
      listTop: panel.y,
    }),
  );
  expect(sortEnd.y).toBeGreaterThanOrEqual(panel.y);
  expect(sortEnd.y + sortEnd.height).toBeLessThanOrEqual(panel.y + panel.height);
  await expect(sort).toBeInViewport({ ratio: 1 });
  await sort.focus();
  await expect(sort).toBeFocused();
  const last = (await list.locator(".trend-topic-row").last().boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual((await pager.boundingBox())!.y + 1);
  await pager.getByRole("button", { name: "下一页" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(list.locator(".trend-topic-row")).toHaveCount(1);
  await expect(pager).toContainText("第 2 / 2 页");
  await expect(pager.getByRole("button", { name: "下一页" })).toBeDisabled();
});

test("a late-page intelligence topic stays visible and regains focus after closing", async ({
  page,
}) => {
  const wide = page.viewportSize()!.width >= 1101;
  if (wide) await page.setViewportSize({ width: 1717, height: 916 });
  const chosen = { ...topic, title: "第 20 条情报", heat: { ...topic.heat, value: 1 } };
  const first = Array.from({ length: 19 }, (_, i) => ({
    ...topic,
    id: `00000000-0000-4000-8000-000000000${700 + i}`,
    title: `第 ${i + 1} 条情报`,
    heat: { ...topic.heat, value: 100 - i },
  }));
  await ready(page, [...first, chosen], { detailData: { ...detail, ...chosen } });
  let listReads = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/trends") listReads++;
  });
  await page.goto(`/trends?topic=${topicId}`);
  const list = page.locator(".trend-list");
  const selected = list.getByRole("button", { name: /第 20 条情报/ });
  await expect(page.locator(".trend-detail h3")).toHaveText(chosen.title);
  if (wide) {
    await expect(selected).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() =>
        selected.evaluate((node) => {
          const row = node.getBoundingClientRect();
          const list = node.closest<HTMLElement>(".trend-list")!;
          const pane = list.getBoundingClientRect();
          return {
            visible: row.top >= pane.top && row.bottom <= pane.bottom + 1,
            rowTop: Math.round(row.top),
            rowBottom: Math.round(row.bottom),
            paneTop: Math.round(pane.top),
            paneBottom: Math.round(pane.bottom),
            scrollTop: list.scrollTop,
            overflow: getComputedStyle(list).overflowY,
          };
        }),
      )
      .toMatchObject({ visible: true });
  }
  await page.getByRole("button", { name: "关闭详情 · 返回情报列表" }).click();
  await expect(page.locator(".trend-detail")).toHaveCount(0);
  await expect(selected).toBeFocused();
  await expect(selected).toBeInViewport({ ratio: 0.8 });
  await expect(list.locator(".trend-topic-row")).toHaveCount(20);
  expect(listReads).toBe(1);
});

test("wide split intelligence aligns mixed photo and placeholder rows", async ({ page }) => {
  const image = "https://m.media-amazon.com/images/intelligence-mixed-layout.svg";
  const withPhoto = { ...topic, image_url: image };
  const noPhoto = { ...mergeTopic, image_url: null, source_url: null };
  await ready(page, [withPhoto, noPhoto]);
  await page.route(image, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#465b7c"/></svg>',
    }),
  );
  await page.setViewportSize({ width: 1717, height: 916 });
  await page.goto("/trends");
  const rows = page.locator(".trend-list > .trend-topic-row");
  const panel = page.locator(".trend-detail");
  await expect(panel).toHaveCount(0);
  await expect(rows).toHaveCount(2);
  await expect
    .poll(() =>
      rows
        .first()
        .locator("img")
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBe(48);
  await expect(rows.last().locator(".research-thumbnail svg")).toBeVisible();
  await rows.first().click();
  await expect(panel).toBeVisible();
  const measure = () =>
    rows.evaluateAll((nodes) =>
      nodes.map((row) => {
        const bounds = (selector: string) => row.querySelector(selector)!.getBoundingClientRect();
        const copy = bounds(".topic-copy"),
          index = bounds(".topic-index"),
          media = bounds(".research-thumbnail");
        return {
          copyX: copy.left,
          indexBottom: index.bottom,
          mediaTop: media.top,
          mediaRight: media.right,
          mediaWidth: media.width,
        };
      }),
    );
  for (const width of [1717, 1440]) {
    await page.setViewportSize({ width, height: 916 });
    const [first, last] = await measure();
    expect(Math.abs(first!.copyX - last!.copyX)).toBeLessThanOrEqual(1);
    for (const row of [first!, last!]) {
      expect(row.mediaRight).toBeLessThan(row.copyX);
      expect(row.indexBottom).toBeLessThanOrEqual(row.mediaTop);
    }
    expect(first!.mediaWidth).toBeGreaterThan(last!.mediaWidth);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await panel.getByRole("button", { name: "关闭详情" }).click();
  await expect(panel).toHaveCount(0);
  await expect(rows.first()).toBeFocused();
});

test("an intelligence topic without an image uses its own source favicon", async ({ page }) => {
  await ready(page, [
    { ...topic, image_url: null, source_url: "https://www.amazon.com/dp/B000000001" },
  ]);
  const expectedIcon = "https://www.amazon.com/favicon.ico";
  // Playwright aborts requests whose URL ends with /favicon.ico before routing them.
  // Record the component's exact URL, then add a fixture-only query to deliver image bytes.
  await page.addInitScript((url) => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src")!;
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...descriptor,
      set(this: HTMLImageElement, value: string) {
        if (value === url) {
          this.dataset.requestedFavicon = value;
          descriptor.set!.call(this, `${value}?fixture=1`);
        } else descriptor.set!.call(this, value);
      },
    });
  }, expectedIcon);
  await page.route(`${expectedIcon}?fixture=1`, (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#465b7c"/></svg>',
    }),
  );
  await page.goto("/trends");
  const icon = page.locator(".trend-list .research-thumbnail img");
  await expect(icon).toHaveAttribute("data-requested-favicon", expectedIcon);
  await expect.poll(() => icon.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(24);
  const checkSize = async (img: typeof icon) => {
    const geometry = await img.evaluate((el) => {
      const frame = el.parentElement!.getBoundingClientRect();
      const icon = el.getBoundingClientRect();
      return {
        size: icon.width,
        frameSize: frame.width,
        centerOffset: Math.abs((icon.left + icon.right - frame.left - frame.right) / 2),
      };
    });
    console.log("INTEL_FAVICON_FRAME", JSON.stringify(geometry));
    expect(geometry.size).toBeGreaterThan(0);
    expect(geometry.size).toBeLessThanOrEqual(24);
    expect(geometry.frameSize - geometry.size).toBeGreaterThan(10);
    expect(geometry.centerOffset).toBeLessThanOrEqual(1);
  };
  await checkSize(icon);

  await expect(page.locator(".trend-detail")).toHaveCount(0);
  await page.locator(".trend-topic-row").first().click();
  const detailIcon = page.locator(".trend-detail-thumbnail img");
  await expect(detailIcon).toHaveAttribute("data-requested-favicon", expectedIcon);
  await expect
    .poll(() => detailIcon.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBe(24);
  await checkSize(detailIcon);
});

test("midou reference source icon fallback is bounded on image failures", async ({ page }) => {
  await ready(page, [
    {
      ...topic,
      image_url: "https://m.media-amazon.com/images/test.jpg",
      source_url: "https://example.test/news",
      source_name: "Example News",
    },
  ] as any);
  await page.route("https://m.media-amazon.com/**", (r) => r.abort());
  await page.route("https://example.test/favicon.ico", (r) => r.abort());
  await page.goto("/trends");
  await expect(page.locator(".trend-list .research-thumbnail svg")).toBeVisible();
  await expect(page.locator(".trend-detail")).toHaveCount(0);
});

test("a failed thumbnail does not reflow split-view topic titles", async ({ page }) => {
  await page.setViewportSize({ width: 1717, height: 916 });
  const photo = "https://m.media-amazon.com/images/trend-layout.jpg";
  const title =
    "Adjustable grow light for indoor plants with full spectrum LEDs, a timer, variable brightness and adjustable arms";
  await ready(page, [{ ...topic, title, image_url: photo, source_url: null }]);
  let rejectPhoto: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    rejectPhoto = resolve;
  });
  await page.route(photo, async (route) => {
    await held;
    await route.abort();
  });
  await page.goto(`/trends?topic=${topicId}`, { waitUntil: "domcontentloaded" });
  const row = page.locator(".trend-workbench.is-detail-open .trend-topic-row").first();
  const copy = row.locator(".topic-copy");
  try {
    await expect(row.locator(".research-thumbnail img")).toBeVisible();
    const heading = copy.locator("strong");
    await expect(heading).toHaveText(title);
    await expect(heading).toHaveCSS("-webkit-line-clamp", "3");
    expect((await heading.boundingBox())!.height).toBe(63);
    const before = await copy.boundingBox();
    rejectPhoto();
    await expect(row.locator(".research-thumbnail > svg")).toBeVisible();
    expect(await copy.boundingBox()).toEqual(before);
  } finally {
    rejectPhoto();
  }
});

test("related selection uses the existing product image and preserves its slot on failure", async ({
  page,
}) => {
  await ready(page, [topic], { capabilities: [...managerCapabilities, "opportunity:read"] });
  const image = "https://m.media-amazon.com/images/intelligence-product.svg";
  let broken = false;
  await page.route("**/api/v1/opportunities?*", (route) =>
    route.fulfill({ json: envelope([{ ...relatedProduct, image_url: image }], { total: 1 }) }),
  );
  await page.route(image, (route) =>
    broken
      ? route.abort()
      : route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50"><rect width="50" height="50" fill="#465b7c"/></svg>',
        }),
  );
  await page.goto(`/trends?topic=${topicId}`);
  const item = page.getByRole("region", { name: "关联选品", exact: true });
  const picture = item.locator(".trend-related-picture");
  const img = picture.locator("img");
  await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(50);
  await expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(item.getByRole("link", { name: new RegExp(relatedProduct.name) })).toBeVisible();
  const before = (await picture.boundingBox())!;
  await page.getByRole("tab", { name: "关联选品", exact: true }).click();
  await expect(img).toBeVisible();
  broken = true;
  await page.reload();
  await expect(picture.locator("svg")).toBeVisible();
  const after = (await picture.boundingBox())!;
  expect([after.width, after.height]).toEqual([before.width, before.height]);
});

test("related product cards align mixed media and keep wide counts in their own cells", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Mixed cards at two desktop widths");
  await ready(page, [topic], { capabilities: [...managerCapabilities, "opportunity:read"] });
  const image = "https://m.media-amazon.com/images/intelligence-mixed-related.svg";
  const count = 999_999_999;
  await page.route(image, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#465b7c"/></svg>',
    }),
  );
  await page.route("**/api/v1/opportunities?*", (route) =>
    route.fulfill({
      json: envelope(
        [
          {
            ...relatedProduct,
            name: "带主图的关联选品",
            image_url: image,
            competitor_count: count,
          },
          {
            ...relatedProduct,
            id: "00000000-0000-4000-8000-000000000489",
            name: "无主图的关联选品",
            image_url: null,
            supplier_candidate_count: count,
          },
        ],
        { total: 2 },
      ),
    }),
  );
  await page.setViewportSize({ width: 1717, height: 916 });
  await page.goto("/trends?topic=" + topicId);
  const region = page.getByRole("region", { name: "关联选品", exact: true });
  const cards = region.locator("li");
  await expect(cards).toHaveCount(2);
  await expect
    .poll(() =>
      cards
        .first()
        .locator("img")
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBe(48);
  for (const width of [1717, 1440]) {
    await page.setViewportSize({ width, height: 916 });
    const x = await cards
      .locator("a strong")
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().left));
    expect(Math.abs(x[0]! - x[1]!)).toBeLessThanOrEqual(1);
    await expect(cards.first().locator("dd").nth(1)).toHaveText(String(count));
    await expect(cards.last().locator("dd").nth(2)).toHaveText(String(count));
    expect(
      await cards
        .locator("dd")
        .evaluateAll((nodes) => nodes.every((node) => node.scrollWidth <= node.clientWidth + 1)),
    ).toBe(true);
  }
  await page.getByRole("tab", { name: "关联选品", exact: true }).click();
  await expect(cards).toHaveCount(2);
  await expect(cards.first().getByRole("link")).toHaveAttribute(
    "href",
    new RegExp("/opportunities/" + relatedProduct.id),
  );
});

test("native intelligence detail keeps the title and close action aligned across tabs", async ({
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop native scrollbar");
  const browser = await chromium.launch({
    ...testInfo.project.use.launchOptions,
    ignoreDefaultArgs: ["--hide-scrollbars"],
  });
  try {
    const page = await browser.newPage({ baseURL, viewport: { width: 1717, height: 916 } });
    const evidence = Array.from({ length: 16 }, (_, index) => ({
      ...detail.evidence[0]!,
      id: `00000000-0000-4000-8000-${String(8100 + index).padStart(12, "0")}`,
      title: `来源证据样例 ${index + 1}`,
    }));
    await ready(page, [topic], {
      detailData: {
        ...detail,
        evidence,
        data_quality: { ...detail.data_quality, evidence_count: evidence.length },
      },
    });
    await page.goto("/trends");
    const row = page.locator(".trend-topic-row").first();
    const panel = page.locator(".trend-detail");
    await expect(panel).toHaveCount(0);
    await row.click();
    await expect(panel.getByRole("heading", { name: topic.title, exact: true })).toBeVisible();
    await expect(page.locator(".role-shell")).toHaveAttribute("data-native-scrollbar", "true");
    const tabs = panel.getByRole("tablist", { name: "情报详情视图" });
    const overview = tabs.getByRole("tab", { name: "情报概览" });
    const measure = () =>
      panel.evaluate((el) => {
        const pane = el as HTMLElement;
        const box = (selector: string) => {
          const { x, width } = pane.querySelector(selector)!.getBoundingClientRect();
          return [x, width];
        };
        return {
          scrollable: pane.scrollHeight > pane.clientHeight,
          gutter: pane.offsetWidth - pane.clientWidth - pane.clientLeft * 2,
          title: box("header h3"),
          close: box(".trend-detail-back"),
          facts: box(".trend-detail-facts"),
        };
      });
    const short = await measure();
    await overview.focus();
    await overview.press("ArrowRight");
    await expect(tabs.getByRole("tab", { name: "来源证据" })).toBeFocused();
    await expect(panel.getByRole("heading", { name: "主要证据" })).toBeVisible();
    const long = await measure();
    console.log("native intelligence detail geometry", JSON.stringify({ short, long }));
    expect(short.scrollable).toBe(false);
    expect(long.scrollable).toBe(true);
    expect(long.gutter).toBeGreaterThan(0);
    expect(short.gutter).toBe(long.gutter);
    for (const key of ["title", "close", "facts"] as const) expect(long[key]).toEqual(short[key]);
    await panel.getByRole("button", { name: "关闭详情 · 返回情报列表" }).click();
    await expect(panel).toHaveCount(0);
    await expect(row).toBeFocused();
  } finally {
    await browser.close();
  }
});

test("intelligence detail tabs default to overview and support keyboard navigation", async ({
  page,
}) => {
  await ready(page);
  let detailReads = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(`/trends/${topicId}`)) detailReads++;
  });
  await page.goto("/trends");
  const sources = page.getByRole("button", { name: "查看来源", exact: true });
  await expect(sources).toHaveCount(0);
  await page.locator(".trend-list > button").first().click();
  const tabs = page.getByRole("tablist", { name: "情报详情视图" });
  const overview = tabs.getByRole("tab", { name: "情报概览" });
  await expect(overview).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".trend-detail-facts dt")).toHaveText([
    "信号",
    "来源",
    "证据",
    "可信度",
  ]);
  await expect(page.locator(".trend-detail-secondary dt")).toHaveText(["数据状态", "环比"]);
  await expect(page.getByRole("heading", { name: "主要证据" })).toBeHidden();
  await overview.focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "来源证据" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "主要证据" })).toBeVisible();
  await expect(page.locator(".trend-detail-secondary")).toHaveCount(0);
  await page.keyboard.press("End");
  await expect(page.getByRole("tabpanel", { name: "关联选品" })).toContainText("不可查看关联选品");
  await page.keyboard.press("Home");
  await expect(overview).toBeFocused();
  const readsBeforeShortcut = detailReads;
  await sources.click();
  await expect(tabs.getByRole("tab", { name: "来源证据" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "主要证据" })).toBeVisible();
  expect(detailReads).toBe(readsBeforeShortcut);
});

test("wide intelligence overview keeps unbroken evidence in its own reading column", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Explicit desktop widths");
  const evidenceTitle =
    "Retail product reference " + "AMAZONMODEL2026".repeat(14) + " product evidence";
  await page.setViewportSize({ width: 1717, height: 916 });
  await ready(page, [topic], {
    detailData: { ...detail, evidence: [{ ...detail.evidence[0], title: evidenceTitle }] },
  });
  const requests = { list: 0, detail: 0 };
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/trends") requests.list++;
    if (path === "/api/v1/trends/" + topicId) requests.detail++;
  });
  await page.goto("/trends");
  const row = page.locator(".trend-list > .trend-topic-row").first();
  await expect(row).toBeVisible();
  await expect(page.locator(".trend-detail")).toHaveCount(0);
  expect(requests).toEqual({ list: 1, detail: 0 });
  await row.click();
  const lead = page.locator(".trend-overview-evidence-title");
  await expect(lead).toHaveText(evidenceTitle);
  await expect(lead).toHaveAttribute("title", evidenceTitle);
  const readings = [];
  for (const width of [1440, 1600, 1717, 1920]) {
    await page.setViewportSize({ width, height: 916 });
    readings.push(
      await lead.evaluate((node) => {
        const style = getComputedStyle(node);
        const box = node.getBoundingClientRect();
        const text = document.createRange();
        text.selectNodeContents(node);
        const lines = [...text.getClientRects()];
        return {
          viewport: innerWidth,
          spill: Math.round(Math.max(0, ...lines.map((line) => line.right - box.right))),
          lines: lines.length,
          visibleHeight: Math.round(box.height),
          maxVisibleHeight: 2 * Number.parseFloat(style.lineHeight),
          clamp: style.webkitLineClamp,
        };
      }),
    );
  }
  console.log("INTELLIGENCE_EVIDENCE_WRAP", JSON.stringify(readings));
  expect(readings.every((value) => value.spill <= 1 && value.lines > 2)).toBe(true);
  expect(
    readings.every((value) => value.clamp === "2" && value.visibleHeight <= value.maxVisibleHeight),
  ).toBe(true);
  await page.getByRole("button", { name: "关闭详情 · 返回情报列表" }).click();
  await expect(page.locator(".trend-detail")).toHaveCount(0);
  await expect(row).toBeFocused();
  expect(requests).toEqual({ list: 1, detail: 1 });
});

test("reference intelligence opens the fourth topic with related selection", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop reference uses a split view");
  await page.setViewportSize({ width: 1717, height: 916 });
  const selectedTopic = {
    ...topic,
    title: "Logo Brands Notre Dame Fighting Irish 14oz Relief Mug",
    category: "ecommerce",
    source_fresh_at: "2026-10-21T02:02:00.000Z",
    heat: { ...topic.heat, value: 1 },
    source_count: 1,
    signal_count: 1,
  };
  const topics = [
    ...[
      "Samsung Galaxy S25 Ultra 5G, 512GB + 12GB RAM, Black - Unlocked (Renewed)",
      "Sony Interactive Entertainment The Last of Us Part 1 Standard PlayStation 5",
      "LEOTER Grow Light for Indoor Plants - Upgraded Version 80 LED Lamps with Full Spectrum & Red Blue Spectrum",
    ].map((title, index) => ({
      ...topic,
      id: `00000000-0000-4000-8000-0000000009${index}4`,
      title,
      heat: { ...topic.heat, value: index === 0 ? 3 : 2 },
      category: "ecommerce",
      source_fresh_at: `2026-10-21T01:${[17, 39, 37][index]}:00.000Z`,
      source_count: 1,
    })),
    selectedTopic,
  ];
  await ready(page, topics, {
    capabilities: [...managerCapabilities, "opportunity:read"],
    detailData: {
      ...detail,
      ...selectedTopic,
      evidence: [
        {
          ...detail.evidence[0],
          title:
            selectedTopic.title +
            " - Officially Licensed Mug, Sculpted 3D Logo and Team Colors - Comfortable Handle and Glossy Finish for College Sports Fans",
        },
      ],
      data_quality: { ...detail.data_quality, evidence_count: 1, source_count: 1 },
    },
  });
  await page.route("**/api/v1/opportunities?*", (route) =>
    route.fulfill({
      json: envelope(
        [
          {
            ...relatedProduct,
            name: "Logo Brands Notre Dame Fighting Irish 14oz Relief Mug - Officially Licensed Mug, Sculpted 3D Logo and Team Colors - Comfortable Handle and Glossy Finish for College Sports Fans",
            competitor_count: 0,
            supplier_candidate_count: 0,
          },
        ],
        { total: 1 },
      ),
    }),
  );
  let listReads = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/trends") listReads++;
  });
  await page.goto("/trends");
  const rows = page.locator(".trend-list > .trend-topic-row");
  await expect(rows).toHaveCount(4);
  await expect(page.locator(".trend-detail")).toHaveCount(0);
  const listOrder = page.getByRole("combobox", { name: "情报列表顺序", exact: true });
  await expect(page.locator(".trend-list-order > svg").first().locator("path")).toHaveCount(4);
  await listOrder.selectOption("latest");
  await expect(page.locator(".trend-filters").getByLabel("排序")).toHaveValue("latest");
  await listOrder.selectOption("impact");
  expect(listReads).toBe(1);
  await rows.nth(3).click();
  await expect(rows.nth(3)).toHaveAttribute("aria-pressed", "true");
  const rowBounds = await rows.evaluateAll((items) =>
    items.map((item) => {
      const { top, bottom } = item.getBoundingClientRect();
      return { top, bottom };
    }),
  );
  for (let index = 1; index < rowBounds.length; index++) {
    expect(rowBounds[index]!.top).toBeGreaterThanOrEqual(rowBounds[index - 1]!.bottom - 0.5);
  }
  const activeRow = rows.nth(3);
  await expect(activeRow).toHaveCSS("min-height", "109px");
  expect(
    await activeRow.evaluate((node) => {
      const surface = getComputedStyle(node, "::before");
      return { inset: surface.insetBlockEnd, pointerEvents: surface.pointerEvents };
    }),
  ).toEqual({ inset: "5px", pointerEvents: "none" });
  await expect(rows.first().locator(".topic-copy > strong")).toHaveCSS("font-family", /^Arial,/);
  await expect(rows.first().locator(".topic-copy > strong")).toHaveCSS(
    "padding-inline-end",
    "12px",
  );
  const provenance = rows.nth(3).locator(".trend-topic-provenance > small:last-child");
  await expect(provenance).toContainText(selectedTopic.language);
  await expect(provenance).toHaveCSS("clip-path", "inset(50%)");
  await expect(rows.nth(3).locator(".research-thumbnail")).toBeHidden();
  const [rank, copy] = await Promise.all([
    rows.nth(3).locator(".topic-index").boundingBox(),
    rows.nth(3).locator(".topic-copy").boundingBox(),
  ]);
  expect(rank!.x + rank!.width).toBeLessThan(copy!.x);
  await expect(page.getByRole("heading", { name: selectedTopic.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: selectedTopic.title })).toHaveCSS(
    "font-size",
    "26.5px",
  );
  await expect(page.getByLabel("情报资料").locator("dt svg").first()).toHaveCSS("width", "20px");
  await expect(page.locator(".trend-dashboard--review")).toHaveCSS("font-family", /DengXian/);
  const detailHeader = page.locator(".trend-detail > header > div");
  await expect(detailHeader).toHaveCSS("display", "grid");
  const [badgesBox, datesBox, closeBox] = await Promise.all(
    [".trend-detail-badges", ".trend-detail-freshness", ".trend-detail-back"].map((selector) =>
      detailHeader.locator(selector).boundingBox(),
    ),
  );
  expect(badgesBox!.x + badgesBox!.width).toBeLessThan(datesBox!.x);
  expect(datesBox!.x + datesBox!.width).toBeLessThan(closeBox!.x);
  expect([closeBox!.width, closeBox!.height]).toEqual([36, 36]);
  const closeAction = detailHeader.getByRole("button", { name: "关闭详情 · 返回情报列表" });
  await expect(closeAction).toHaveAttribute("title", "关闭详情");
  await expect(closeAction.locator("svg")).toBeVisible();
  await expect(closeAction.locator("svg")).toHaveAttribute("aria-hidden", "true");
  await expect(closeAction.locator(":scope > span")).toBeHidden();
  const related = page.getByRole("region", { name: "关联选品", exact: true });
  await expect(related.locator("li")).toHaveCount(1);
  await expect(related.locator("dd")).toHaveText(["未知", "0", "0", "未知"]);
  await expect(page.locator(".trend-market-heading > div > p")).toHaveCSS(
    "inset-block-start",
    "-5px",
  );
  await expect(page.locator(".trend-detail-tabs")).toHaveCSS("column-gap", "8px");
  for (const tab of await page.locator(".trend-detail-tabs").getByRole("tab").all()) {
    await expect(tab).toHaveCSS("padding-inline-start", "10px");
    expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const overviewCard = related.locator("li").first();
  await expect(overviewCard).toHaveCSS("padding-block-start", "12px");
  await expect(overviewCard).toHaveCSS("padding-block-end", "12px");
  const noteClearance = await overviewCard.evaluate((card) => {
    const note = card.closest(".trend-related-products")!.querySelector(".trend-related-note")!;
    return note.getBoundingClientRect().top - card.getBoundingClientRect().bottom;
  });
  expect(noteClearance).toBeGreaterThanOrEqual(8);
  console.log(
    "INTELLIGENCE_OVERVIEW_CLEARANCE",
    JSON.stringify({
      padding: await overviewCard.evaluate((card) => getComputedStyle(card).paddingBlock),
      noteClearance,
    }),
  );
  await expect(related.locator("li strong").first()).toHaveCSS("font-size", "14px");
  await expect(related.locator("li strong").first()).toHaveCSS("line-height", "20.75px");
  const associationNote = related.locator(".trend-related-note");
  await expect(associationNote).toBeVisible();
  await expect(associationNote).toContainText("不代表已推荐或整链完成");
  await expect(associationNote).toHaveCSS("font-size", "13px");
  await expect(associationNote).toHaveCSS("line-height", "20px");
  await expect(page.locator(".trend-market-heading > div").first()).toHaveCSS(
    "translate",
    "1px -1px",
  );
  await expect(page.locator(".trend-overview-evidence-title")).toHaveCSS("font-size", "18px");
  const detailTabs = page.locator(".trend-detail-tabs");
  const activeDetailTab = detailTabs.getByRole("tab", { selected: true });
  await expect(activeDetailTab).toHaveCSS("font-size", "17px");
  await expect(activeDetailTab).toHaveCSS("padding-block-end", "9px");
  expect(await activeDetailTab.evaluate((node) => getComputedStyle(node, "::after").height)).toBe(
    "2px",
  );
  await expect(rows.first().locator("em")).toHaveCSS("min-block-size", "27px");
  await expect(rows.first().locator("em")).toHaveCSS("translate", "4px 1px");
  await expect(rows.first().locator(".topic-index")).toHaveCSS("padding-block-start", "1px");
  await expect(rows.nth(3).locator(".topic-copy")).toHaveCSS("translate", "1px -2px");
  await expect(related.locator("li dt").first()).toHaveCSS("translate", "1px -1px");
  await expect(related.locator("li dd").first()).toHaveCSS("font-size", "18px");
  await expect(related.locator(".trend-related-icon")).toHaveCSS("margin-block-start", "8px");
  const caption = (await detailHeader.locator(".trend-overview-evidence-title").boundingBox())!;
  const detailTitle = (await detailHeader.locator("h3").boundingBox())!;
  expect(detailTitle.width - caption.width).toBeCloseTo(24, 0);
  await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
  await expect(page.locator(".trend-detail-badges")).toHaveCSS("column-gap", "14px");
  await expect(page.locator(".trend-topic-row[aria-pressed='true'] .topic-heat")).toHaveCSS(
    "translate",
    "0px -3px",
  );
  const confidence = page.getByLabel("情报资料").locator('dd[data-insufficient="true"]');
  await expect(confidence).toHaveText("数据不足");
  await expect(confidence).toHaveCSS("translate", "0px 2px");
  const rowTitle = rows.first().locator(".topic-copy > strong");
  await expect(rowTitle).toHaveCSS("font-size", "16.2px");
  await expect(rowTitle).toHaveCSS("letter-spacing", "0.1px");
  const titleTrack = related.locator("li a > span:not(.trend-related-picture)").first();
  await expect(titleTrack).toHaveCSS("padding-inline-end", "8px");
  const gap = await titleTrack.evaluate((track) => {
    const title = track.getBoundingClientRect();
    const metrics = track.closest("li")!.querySelector("dl")!.getBoundingClientRect();
    return metrics.left - title.right + parseFloat(getComputedStyle(track).paddingInlineEnd);
  });
  expect(gap).toBeGreaterThanOrEqual(20);
  await expect(related.locator("li dl").first()).toHaveCSS("inset-inline-start", "-2px");
  await expect(related.locator(":scope > header")).toHaveCSS("padding-inline-start", "5px");
  const appearance = await page.locator(".trend-dashboard--review").evaluate((workspace) => {
    const color = document.createElement("canvas").getContext("2d")!;
    const resolve = (value: string) => {
      color.fillStyle = value.trim();
      return color.fillStyle;
    };
    return {
      panel: resolve(getComputedStyle(workspace).getPropertyValue("--so-panel")),
      cards: [".trend-filters", ".trend-list", ".trend-detail"].map((selector) =>
        resolve(getComputedStyle(workspace.querySelector(selector)!).backgroundColor),
      ),
    };
  });
  expect(appearance.cards).toEqual(Array(3).fill(appearance.panel));
  const contextLine = rows.nth(3).locator(".topic-copy > small");
  const provenanceLine = rows.nth(3).locator(".trend-topic-provenance > small").first();
  const relatedIdentity = related.locator("li a small").first();
  const metadataReading = {
    context: await contextLine.evaluate((node) => getComputedStyle(node).fontSize),
    provenance: await provenanceLine.evaluate((node) => getComputedStyle(node).fontSize),
    identityGap: await relatedIdentity.evaluate((node) => getComputedStyle(node).marginBlockStart),
  };
  console.log("INTELLIGENCE_METADATA_READING", JSON.stringify(metadataReading));
  expect(metadataReading).toEqual({ context: "14.5px", provenance: "14.5px", identityGap: "6px" });

  const scrollProbe = await page.locator(".trend-list").evaluate((pane) => {
    const before = pane.scrollTop;
    pane.scrollTop = 100;
    const after = pane.scrollTop;
    pane.scrollTop = before;
    return { before, after };
  });
  console.log("short intelligence list scroll", JSON.stringify(scrollProbe));
  expect(scrollProbe).toEqual({ before: 0, after: 0 });
  const detailHeaderLayout = () =>
    detailHeader.evaluate((header) => {
      const bounds = (selector: string) => {
        const { x, y, width, height } = header.querySelector(selector)!.getBoundingClientRect();
        return [x, y, width, height];
      };
      return {
        display: getComputedStyle(header).display,
        close: bounds(".trend-detail-back"),
        badges: bounds(".trend-detail-badges"),
        freshness: bounds(".trend-detail-freshness"),
        title: bounds("h3"),
      };
    });
  const overviewHeader = await detailHeaderLayout();
  for (const tabName of ["来源证据", "关联选品", "情报概览"]) {
    await detailTabs.getByRole("tab", { name: tabName, exact: true }).click();
    await expect(detailTabs.getByRole("tab", { selected: true })).toHaveText(tabName);
    await expect(page.locator(".trend-overview-evidence-title")).toHaveCount(
      tabName === "情报概览" ? 1 : 0,
    );
    expect(await detailHeaderLayout(), tabName).toEqual(overviewHeader);
    await expect(page.getByRole("button", { name: "关闭详情 · 返回情报列表" })).toBeInViewport();
  }
  expect(listReads).toBe(1);
  console.log("intelligence detail layout stabilized", JSON.stringify(overviewHeader));
  await page.setViewportSize({ width: 1440, height: 916 });
  const panel = page.locator(".trend-detail");
  await expect(closeAction.locator("svg")).toBeHidden();
  await expect(closeAction.locator(":scope > span")).toBeVisible();
  const heading = (await panel.locator("h3").boundingBox())!;
  const freshness = (await panel.locator(".trend-detail-freshness").boundingBox())!;
  const facts = (await panel.locator(".trend-detail-facts").boundingBox())!;
  expect(heading.height).toBeGreaterThan(40);
  expect(facts.y - freshness.y - freshness.height).toBeLessThanOrEqual(24);
  await page.getByRole("button", { name: "关闭详情 · 返回情报列表" }).click();
  await expect(page.locator(".trend-detail")).toHaveCount(0);
  await expect(rows).toHaveCount(4);
  await page.setViewportSize({ width: 1717, height: 916 });
  await expect(provenance).toHaveCSS("clip-path", "none");
  await expect(rows.nth(3).locator(".research-thumbnail")).toBeVisible();
  expect(listReads).toBe(1);
});

test("intelligence signal totals stay in their own column with the detail open or closed", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Explicit intelligence layout probes");
  const count = 987654321;
  const record = { ...topic, heat: { ...topic.heat, value: count }, signal_count: count };
  await page.setViewportSize({ width: 1717, height: 916 });
  await ready(page, [record], { detailData: { ...detail, ...record } });
  await page.goto("/trends");
  const row = page.locator(".trend-topic-row").first();
  const total = row.locator(".topic-heat > b");
  await expect(total).toHaveText(String(count));
  for (const [width, open] of [
    [1717, false],
    [1440, false],
    [841, false],
    [390, false],
    [1101, true],
    [1440, true],
    [1717, true],
  ] as const) {
    await page.setViewportSize({ width, height: 916 });
    const panel = page.locator(".trend-detail");
    if (open && !(await panel.count())) await row.click();
    await expect(panel).toHaveCount(open ? 1 : 0);
    if (width === 390) {
      await expect(total).toBeHidden();
      continue;
    }
    await expect(total).toBeVisible();
    const geometry = await total.evaluate((el) => {
      const track = el.parentElement!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el);
      const lines = [...range.getClientRects()];
      return {
        trackWidth: Math.round(track.width),
        lineWidth: Math.round(Math.max(...lines.map((line) => line.width))),
        lines: lines.length,
        fits: lines.every((line) => line.left >= track.left - 1 && line.right <= track.right + 1),
      };
    });
    console.log("intelligence list signal track", width, open, JSON.stringify(geometry));
    expect(geometry.fits).toBe(true);
    await expect(total).toHaveText(String(count));
  }
});

test("wide intelligence metadata wraps without covering dates or the close action", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Wide detail metadata layout");
  await page.setViewportSize({ width: 1600, height: 916 });
  const locale = "zh-Hant-TW-x-cross-border-commerce-evidence-supplier-catalogue";
  const title = "跨市场供应线索 " + "LongUnbrokenProductIdentifier".repeat(5);
  const record = { ...topic, title, language: locale };
  const count = 1234567890123;
  await ready(page, [record], {
    detailData: {
      ...detail,
      ...record,
      signal_count: count,
      source_count: count,
      data_quality: { ...detail.data_quality, evidence_count: count },
    },
  });
  await page.goto("/trends");
  const row = page.locator(".trend-topic-row").first();
  await row.click();
  const label = row.locator(".topic-copy > strong");
  await expect(label).toHaveText(title);
  await expect(label).toHaveCSS("-webkit-line-clamp", "3");
  expect(await label.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  const [titleBox, signalBox] = await Promise.all([
    label.boundingBox(),
    row.locator(".topic-heat").boundingBox(),
  ]);
  expect(titleBox!.x + titleBox!.width).toBeLessThan(signalBox!.x);
  const header = page.locator(".trend-detail > header");
  const badges = header.locator(".trend-detail-badges");
  const longBadge = badges.getByText(locale, { exact: true });
  const dates = header.locator(".trend-detail-freshness");
  const close = header.getByRole("button", { name: "关闭详情 · 返回情报列表" });
  await expect(longBadge).toBeVisible();
  await expect(dates).toBeVisible();
  await expect(close).toBeVisible();
  const [badge, date, button] = await Promise.all([
    longBadge.boundingBox(),
    dates.boundingBox(),
    close.boundingBox(),
  ]);
  expect(badge!.x + badge!.width).toBeLessThan(date!.x);
  expect(await longBadge.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  expect(date!.x + date!.width).toBeLessThan(button!.x);
  const facts = page.getByLabel("情报资料");
  await expect(facts.locator("dd").first()).toHaveText(`${count} 条`);
  const contained = await facts.locator("dd").evaluateAll((items) =>
    items.map((item) => {
      const text = document.createRange();
      text.selectNodeContents(item);
      const bounds = item.parentElement!.getBoundingClientRect();
      return [...text.getClientRects()].every(
        (line) => line.left >= bounds.left - 1 && line.right <= bounds.right + 1,
      );
    }),
  );
  expect(contained).toEqual([true, true, true, true]);
  for (const width of [390, 760, 761, 840, 841, 950, 1100]) {
    await page.setViewportSize({ width, height: 916 });
    const geometry = await header.evaluate((node) => {
      const panel = node.closest(".trend-detail")!;
      const workbench = panel.parentElement!;
      const panelBox = panel.getBoundingClientRect();
      const title = node.querySelector("h3")!;
      const locale = node.querySelector(".trend-detail-badges > span:nth-child(2)")!;
      const textFits = (el: Element) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return [...range.getClientRects()].every(
          (box) => box.right <= panelBox.right && box.left >= panelBox.left,
        );
      };
      return {
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        panel: Math.round(panelBox.width),
        workbench: Math.round(workbench.getBoundingClientRect().width),
        titleFits: textFits(title),
        localeFits: textFits(locale),
      };
    });
    console.log("intelligence detail containment", JSON.stringify(geometry));
    expect(
      geometry.scrollWidth,
      `width ${width}: page does not scroll horizontally`,
    ).toBeLessThanOrEqual(width);
    expect(geometry.panel, `width ${width}: detail uses the available reading column`).toBeCloseTo(
      geometry.workbench,
      0,
    );
    expect(geometry.titleFits, `width ${width}: full title wraps inside the pane`).toBe(true);
    expect(geometry.localeFits, `width ${width}: complete locale stays inside the pane`).toBe(true);
  }
  await close.click();
  await expect(header).toHaveCount(0);
});

test("intelligence palette stays local and follows all supported themes", async ({ page }) => {
  await ready(page);
  await page.goto("/trends");
  const dashboard = page.locator(".trend-dashboard--review");
  await expect(dashboard).toBeVisible();
  for (const theme of ["deep-ocean", "aurora-purple", "cloud-white"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    const colors = await dashboard.evaluate((element) => {
      const local = getComputedStyle(element);
      return {
        surface: local.getPropertyValue("--trend-surface").trim(),
        panel: local.getPropertyValue("--so-panel").trim(),
        accent: local.getPropertyValue("--trend-blue").trim(),
        primary: local.getPropertyValue("--so-primary").trim(),
        leaked: getComputedStyle(document.documentElement)
          .getPropertyValue("--trend-surface")
          .trim(),
      };
    });
    expect(colors.surface).toBeTruthy();
    expect(colors.surface).toBe(colors.panel);
    expect(colors.accent).toBe(colors.primary);
    expect(colors.leaked).toBe("");
  }
  await expect(page.locator(".trend-detail")).toHaveCount(0);
});

test("intelligence detail reuses only the current topic image and leaves no empty media slot", async ({
  page,
}) => {
  const wide = page.viewportSize()!.width >= 1101;
  if (wide) await page.setViewportSize({ width: 1717, height: 916 });
  const photo = "https://m.media-amazon.com/images/detail-visual-fixture.svg";
  await ready(page, [
    { ...topic, image_url: photo, source_url: null },
    { ...mergeTopic, image_url: null, source_url: null },
  ]);
  await page.route(photo, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#426294"/></svg>',
    }),
  );
  await page.route(`**/api/v1/trends/${mergeTopic.id}`, (route) =>
    route.fulfill({ json: envelope({ ...detail, ...mergeTopic }) }),
  );
  let listReads = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/v1/trends") listReads++;
  });
  await page.goto("/trends");
  const rows = page.locator(".trend-topic-row");
  await expect(page.locator(".trend-detail")).toHaveCount(0);
  await rows.filter({ hasText: topic.title }).click();
  const pane = page.locator(".trend-detail");
  const media = pane.locator(".trend-detail-thumbnail");
  const image = media.locator("img");
  await expect(image).toHaveAttribute("src", photo);
  await expect
    .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
    .toBe(80);
  const [box, title] = await Promise.all([media.boundingBox(), pane.locator("h3").boundingBox()]);
  expect(box!.width).toBe(wide ? 42 : 36);
  expect(box!.y + box!.height).toBeLessThanOrEqual(title!.y + 1);
  const status = (await pane.locator(".trend-detail-badges > [data-status]").boundingBox())!;
  expect(status.y + status.height / 2).toBeCloseTo(box!.y + box!.height / 2, 0);
  expect(status.height).toBeLessThan(box!.height);
  await pane.getByRole("button", { name: /关闭详情/ }).click();
  await rows.filter({ hasText: mergeTopic.title }).click();
  await expect(pane.getByRole("heading", { name: mergeTopic.title, exact: true })).toBeVisible();
  await expect(media).toHaveCount(0);
  expect(listReads).toBe(1);
});

test("mid-width intelligence split list stacks media below rank and frees the title track", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop split list");
  const photo = "https://m.media-amazon.com/images/split-reading-fixture.svg";
  const title =
    "Adjustable indoor grow light with wide spectrum LEDs, timer, long adjustable arms and variable brightness";
  await ready(page, [
    { ...topic, title, image_url: photo, source_url: null },
    { ...mergeTopic, image_url: null, source_url: null },
  ]);
  await page.route(photo, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#465b7c"/></svg>',
    }),
  );
  await page.setViewportSize({ width: 1101, height: 916 });
  await page.goto("/trends");
  const panel = page.locator(".trend-detail");
  const rows = page.locator(".trend-list > .trend-topic-row");
  await expect(panel).toHaveCount(0);
  await expect(rows).toHaveCount(2);
  await expect(rows.first().locator(".research-thumbnail img")).toBeVisible();
  await rows.first().click();
  await expect(panel).toBeVisible();
  await expect(rows.first().locator(".topic-copy > strong")).toHaveText(title);

  for (const width of [1101, 1280, 1439]) {
    await page.setViewportSize({ width, height: 916 });
    const bounds = await rows.evaluateAll((items) =>
      items.map((row) => {
        const rect = (selector: string) => row.querySelector(selector)!.getBoundingClientRect();
        const index = rect(".topic-index"),
          media = rect(".research-thumbnail");
        const copy = rect(".topic-copy"),
          signal = rect(".topic-heat");
        return {
          indexBottom: index.bottom,
          mediaTop: media.top,
          mediaRight: media.right,
          mediaWidth: media.width,
          copyLeft: copy.left,
          copyRight: copy.right,
          copyWidth: copy.width,
          signalLeft: signal.left,
        };
      }),
    );
    console.log(
      "intelligence medium title widths",
      width,
      bounds.map(({ copyWidth }) => copyWidth),
    );
    for (const row of bounds) {
      expect(row.mediaTop).toBeGreaterThanOrEqual(row.indexBottom);
      expect(row.mediaRight).toBeLessThan(row.copyLeft);
      expect(row.copyRight).toBeLessThan(row.signalLeft);
      expect(row.copyWidth).toBeGreaterThan(145);
    }
    expect(bounds[0]!.copyLeft).toBeCloseTo(bounds[1]!.copyLeft, 0);
    expect(bounds.map(({ mediaWidth }) => mediaWidth)).toEqual([38, 26]);
  }
  await page.setViewportSize({ width: 1101, height: 916 });
  const confidence = panel.locator('.trend-detail-facts dd[data-insufficient="true"]');
  await expect(confidence).toHaveText("数据不足");
  const lines = await confidence.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getClientRects().length;
  });
  expect(lines).toBe(1);
  await panel.getByRole("button", { name: /关闭详情/ }).click();
  await expect(panel).toHaveCount(0);
  await expect(rows.first()).toBeFocused();
});

test("one-page intelligence keeps split sort visible and restores the selected row", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop split list");
  await page.setViewportSize({ width: 1717, height: 916 });
  const image = "https://m.media-amazon.com/images/intelligence-single-page.svg";
  const topics = Array.from({ length: 20 }, (_, i) => ({
    ...topic,
    id: i === 0 ? topicId : `00000000-0000-4000-8000-000000000${810 + i}`,
    title: `第 ${i + 1} 条混合来源情报`,
    image_url: i % 2 ? null : image,
    source_url: null,
    heat: { ...topic.heat, value: 20 - i },
  }));
  await ready(page, topics, { detailData: { ...detail, ...topics[0]! } });
  await page.route(image, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#465b7c"/></svg>',
    }),
  );
  let listReads = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/trends") listReads++;
  });

  await page.goto("/trends");
  const list = page.locator(".trend-list");
  const rows = list.locator(".trend-topic-row");
  const panel = page.locator(".trend-detail");
  const sort = list.getByRole("combobox", { name: "情报列表顺序" });
  await expect(panel).toHaveCount(0);
  await expect(rows).toHaveCount(20);
  await expect(list.locator(".trend-pagination")).toHaveCount(0);
  await expect
    .poll(() =>
      rows
        .first()
        .locator("img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(48);
  await expect(rows.nth(1).locator(".research-thumbnail svg")).toBeVisible();

  await rows.first().click();
  await expect(panel.locator("h3")).toHaveText(topics[0]!.title);
  await expect(list.locator("header")).toHaveCSS("position", "sticky");
  const before = await sort.boundingBox();
  await list.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  const [after, pane, last] = await Promise.all(
    [sort, list, rows.last()].map((node) => node.boundingBox()),
  );
  expect(after!.y).toBeCloseTo(before!.y, 0);
  expect(after!.y).toBeGreaterThanOrEqual(pane!.y);
  expect(last!.y + last!.height).toBeLessThanOrEqual(pane!.y + pane!.height);
  await expect(sort).toBeInViewport({ ratio: 1 });
  await sort.focus();
  await expect(sort).toBeFocused();
  await panel.getByRole("button", { name: "关闭详情" }).click();
  await expect(panel).toHaveCount(0);
  await expect(rows.first()).toBeFocused();
  await expect(rows.first()).toBeInViewport({ ratio: 0.8 });
  expect(listReads).toBe(1);
});
