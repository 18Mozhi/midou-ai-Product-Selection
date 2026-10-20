import { test, expect, type Page } from "@playwright/test";
const org = "00000000-0000-4000-8000-000000000701",
  workspace = "00000000-0000-4000-8000-000000000702";
const at = "2026-10-20T00:00:00Z";
const envelope = (data: unknown) => ({
  data,
  request_id: "home-results-test",
  trace_id: "home-results-test",
});
const product = (name = "界面验证已完成收纳盒（模拟）") => ({
  id: "00000000-0000-4000-8000-000000000710",
  name,
  image_url: null,
  main_asin: "B0HOME0001",
  market: "US",
  category: "storage",
  source_type: "trend_topic",
  source_ref_id: null,
  owner_id: null,
  primary_product: {
    price: 19.95,
    currency: "USD",
    rating_value: 4.3,
    review_count: 125,
    captured_at: at,
    public_signals: null,
  },
  automatic_purchase_price: {
    id: "cost",
    amount_value: 3.25,
    currency: "CNY",
    observed_at: at,
    evidence_id: "raw",
    source_ref_id: "1688:123:classified-title:v1",
  },
  lifecycle_status: "candidate",
  lifecycle_entered_at: at,
  lifecycle_dwell_seconds: 0,
  recommendation_status: "not_recommend",
  overall_score: 52.5,
  trend_score: 60,
  competition_score: 55,
  profit_status: "insufficient_data",
  risk_level: "low",
  confidence: { status: "partial", score: null },
  evidence_count: 6,
  source_count: 2,
  competitor_count: 5,
  supplier_candidate_count: 7,
  matched_rule_count: 1,
  selection_stage: "rule_candidate",
  quality_gates: {
    score: false,
    market: true,
    competition: true,
    cost: false,
    risk: true,
    all_passed: false,
  },
  coverage_status: "partial",
  blocking_reasons: ["recommendation_insufficient"],
  decision_status: "pending",
  version: 1,
  updated_at: at,
});
function summary(count = 1, scopedWorkspace = workspace) {
  return {
    actions: [],
    changes: [],
    follows: [],
    health: [],
    scope: { organization_id: org, workspace_id: scopedWorkspace },
    generated_at: at,
    automatic_selection: {
      state: "running",
      enabled_rule_count: 1,
      candidate_count: 12,
      rule_candidate_count: 5,
      recommended_count: 0,
      awaiting_evidence_count: 7,
      adopted_count: 0,
      recommended_items: [],
      last_collection_at: at,
      next_collection_at: at,
      daily_production: {
        date: "2026-10-20",
        timezone: "Asia/Shanghai",
        target_minimum: 100,
        completed_count: count,
        discovered_count: 8,
        qualified_count: 0,
        measured_at: at,
      },
    },
  };
}
async function setup(page: Page, canRead = true) {
  const counters = { home: 0, completed: 0, writes: 0 };
  let home = summary();
  await page.route("**/api/v1/me/navigation?**", (route) =>
    route.fulfill({
      json: envelope({
        shell: "member",
        organization_id: org,
        workspace_id: workspace,
        roles: ["member"],
        capabilities: ["task:read", "trend:read", ...(canRead ? ["opportunity:read"] : [])],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/me/home-dashboard", (route) => {
    counters.home += 1;
    return route.fulfill({ json: envelope(home) });
  });
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.startsWith("/api/v1/") &&
      !["GET", "HEAD"].includes(request.method())
    )
      counters.writes += 1;
  });
  return {
    counters,
    setSummary(value: ReturnType<typeof summary>) {
      home = value;
    },
  };
}
const completedRoute = /\/api\/v1\/opportunities\?selection_view=completed(?:&|$)/;

test("completed products own the initial workspace, show actual facts and link directly to analysis", async ({
  page,
}) => {
  const { counters } = await setup(page);
  await page.route(completedRoute, (route) => {
    counters.completed += 1;
    const url = new URL(route.request().url());
    expect(url.searchParams.get("page_size")).toBe("5");
    return route.fulfill({ json: envelope([product()]) });
  });
  await page.goto("/home");
  const results = page.getByRole("region", { name: "选品结果", exact: true });
  await expect(results.getByRole("button", { name: "已完成分析", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(results.getByText("USD 19.95", { exact: true })).toBeVisible();
  await expect(results.getByText("CNY 3.25", { exact: true })).toBeVisible();
  await expect(results.getByText("利润未知", { exact: true })).toBeVisible();
  await expect(results.getByRole("link", { name: /^查看分析：/ })).toHaveAttribute(
    "href",
    /from=\/home/,
  );
  await expect(results.getByRole("link", { name: /^审阅并采纳/ })).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await results.getByRole("button", { name: /^待采纳推荐/ }).click();
  await expect(results.getByText("当前没有待人工采纳的推荐")).toBeVisible();
  await results.getByRole("button", { name: "已完成分析", exact: true }).click();
  await expect(results.getByRole("table", { name: "选品商品列表" })).toBeVisible();
  expect(counters.completed).toBe(2);
  expect(counters.writes).toBe(0);
});

test("home polling does not repeat unchanged product queries; manual refresh and changed completion count do", async ({
  page,
}) => {
  await page.clock.install();
  const h = await setup(page);
  await page.route(completedRoute, (route) => {
    h.counters.completed += 1;
    return route.fulfill({ json: envelope([product()]) });
  });
  await page.goto("/home");
  await expect(page.getByRole("table", { name: "选品商品列表" })).toBeVisible();
  await page.clock.runFor(5100);
  await expect.poll(() => h.counters.home).toBe(2);
  expect(h.counters.completed).toBe(1);
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await expect.poll(() => h.counters.completed).toBe(2);
  h.setSummary(summary(2));
  await page.clock.runFor(5100);
  await expect.poll(() => h.counters.completed).toBe(3);
});

for (const status of [200, 401, 403, 500]) {
  test(`completed list distinguishes empty success from ${status} access or read failure`, async ({
    page,
  }) => {
    await setup(page);
    await page.route(completedRoute, (route) =>
      route.fulfill({
        status,
        json:
          status === 200
            ? envelope([])
            : {
                error: {
                  code: status === 401 ? "session_expired" : "read_failed",
                  action_hint: "界面验证读取失败",
                },
              },
      }),
    );
    await page.goto("/home");
    const area = page.locator(".home-completed-products");
    if (status === 200) await expect(area.getByText("暂无已完成分析的商品")).toBeVisible();
    else {
      await expect(
        area.locator(
          `.ui-state-panel[data-kind="${status === 401 ? "expired" : status === 403 ? "forbidden" : "error"}"]`,
        ),
      ).toBeVisible();
      await expect(area.getByText("暂无已完成分析的商品")).toHaveCount(0);
    }
  });
}
test("missing opportunity-read capability makes no product request", async ({ page }) => {
  const { counters } = await setup(page, false);
  await page.route(completedRoute, (route) => {
    counters.completed += 1;
    return route.fulfill({ json: envelope([product()]) });
  });
  await page.goto("/home");
  await expect(page.getByText("当前没有待人工采纳的推荐")).toBeVisible();
  await expect(page.getByRole("button", { name: "已完成分析", exact: true })).toHaveCount(0);
  expect(counters.completed).toBe(0);
});
test("scope change discards a late product response", async ({ page }) => {
  const h = await setup(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(completedRoute, async (route) => {
    h.counters.completed += 1;
    if (h.counters.completed === 1) {
      await gate;
      await route.fulfill({ json: envelope([product("旧工作区商品（模拟）")]) }).catch(() => {});
    } else await route.fulfill({ json: envelope([product("新工作区商品（模拟）")]) });
  });
  await page.goto("/home");
  await expect.poll(() => h.counters.completed).toBe(1);
  h.setSummary(summary(2, "00000000-0000-4000-8000-000000000799"));
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await expect(page.getByRole("link", { name: "新工作区商品（模拟）", exact: true })).toBeVisible();
  release();
  await expect(page.getByText("旧工作区商品（模拟）", { exact: true })).toHaveCount(0);
});
for (const status of [401, 403, 500]) {
  test(`refresh ${status} clears protected rows or labels a retained transient snapshot`, async ({
    page,
  }) => {
    await setup(page);
    let failed = false;
    await page.route(completedRoute, (route) =>
      route.fulfill({
        status: failed ? status : 200,
        json: failed
          ? { error: { code: "read_failed", action_hint: "界面验证读取失败" } }
          : envelope([product()]),
      }),
    );
    await page.goto("/home");
    await expect(page.getByRole("table", { name: "选品商品列表" })).toBeVisible();
    failed = true;
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    const area = page.locator(".home-completed-products");
    if (status === 500) {
      await expect(area.getByRole("alert")).toContainText("当前显示上次读取的结果");
      await expect(area.getByRole("table")).toBeVisible();
    } else {
      await expect(area.locator(".ui-state-panel")).toHaveAttribute(
        "data-kind",
        status === 401 ? "expired" : "forbidden",
      );
      await expect(area.getByRole("table")).toHaveCount(0);
    }
  });
}
