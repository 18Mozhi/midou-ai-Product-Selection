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
  if (test.info().project.name === "mobile-390") {
    await expect(page.locator(".home-library-details")).not.toHaveAttribute("open");
    const title = await results
      .getByRole("link", { name: product().name, exact: true })
      .boundingBox();
    expect(title!.y + 20).toBeLessThan(page.viewportSize()!.height - 80);
    await page.locator(".home-library-details > summary").click();
    await expect(page.getByRole("link", { name: "5 选品候选", exact: true })).toBeVisible();
    await page.locator(".home-library-details > summary").click();
    expect(counters.completed).toBe(1);
  }
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
  const refresh = page.getByRole("button", { name: "刷新", exact: true });
  await expect(refresh.locator("svg")).toBeVisible();
  await refresh.click();
  await expect.poll(() => h.counters.completed).toBe(2);
  h.setSummary(summary(2));
  await page.clock.runFor(5100);
  await expect.poll(() => h.counters.completed).toBe(3);
});

test("workbench completed empty action fits in the reference desktop first fold", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await setup(page);
  await page.route(completedRoute, (route) => route.fulfill({ json: envelope([]) }));
  await page.goto("/home");
  const result = page.getByRole("region", { name: "选品结果" });
  const link = result.getByRole("link", { name: "查看候选进度" });
  await expect(link).toHaveAttribute("href", "/opportunities?view=rule_candidates");
  await expect(result.locator(".home-completed-empty svg")).toHaveAttribute("aria-hidden", "true");
  const bounds = await result.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(941);
  const overview = (await page.locator(".home-automation-overview").boundingBox())!;
  const flow = (await page.getByRole("region", { name: "选品任务流程" }).boundingBox())!;
  expect(Math.abs(overview.y - 378), "library overview top").toBeLessThanOrEqual(5);
  expect(Math.abs(flow.y - 529), "workflow top").toBeLessThanOrEqual(5);
  expect(Math.abs(bounds!.y - flow.y - flow.height - 18), "workflow-to-results gap").toBeLessThanOrEqual(2);
  const quickCandidate = page.locator(".midou-home-quick .home-quick-candidates");
  await expect(quickCandidate).toHaveCSS("font-size", "16px");
  await expect(quickCandidate).toHaveAttribute("href", "/opportunities?view=rule_candidates");
  await expect(quickCandidate.locator("b")).toHaveCSS("font-weight", "700");
  const progress = page.getByRole("progressbar", { name: "今日完成整条选品流程目标进度" });
  await expect(progress).toHaveCSS("height", "9px");
  await expect(progress).toHaveAttribute("max", "100");
  const facts = page.locator(".home-status-facts > a");
  await expect(facts).toHaveCount(4);
  await expect(facts.first().locator("span")).toHaveCSS("font-size", "14px");
  expect(await facts.first().evaluate((el) => getComputedStyle(el, "::after").content)).toBe('""');
  await expect(facts.nth(1)).toHaveAttribute("href", "/opportunities?view=rule_candidates");
  const steps = page.getByRole("region", { name: "选品任务流程" }).getByRole("listitem");
  await expect(steps).toHaveCount(5);
  const stepMarkers = await steps.locator(":scope > b").evaluateAll((markers) =>
    markers.map((marker) => {
      const box = marker.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width };
    }),
  );
  expect(stepMarkers.every(({ y, width }) => y === stepMarkers[0].y && width === 30)).toBe(true);
  expect(Math.abs(stepMarkers[0].x - 345)).toBeLessThanOrEqual(5);
  expect(Math.abs(stepMarkers[4].x - 1218)).toBeLessThanOrEqual(12);
  expect(
    await steps.evaluateAll((items) =>
      items.map((item) => getComputedStyle(item, "::after").content),
    ),
  ).toEqual(['""', '""', '""', '""', "none"]);
  await expect(steps.first().getByRole("link")).toHaveAttribute("href", "/trends");
  await expect(steps.last().getByRole("link")).toHaveAttribute(
    "href",
    "/opportunities?view=completed",
  );
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

test("workspace breadcrumb stays exclusively above page content across list routes", async ({
  page,
}) => {
  await setup(page);
  await page.route(completedRoute, (route) => route.fulfill({ json: envelope([]) }));
  await page.route(/\/api\/v1\/opportunities\?/, (route) =>
    route.fulfill({ json: { ...envelope([]), meta: { total: 0 } } }),
  );
  await page.goto("/home");
  const crumb = page.getByRole("navigation", { name: "面包屑", exact: true });
  await expect(crumb).toHaveCount(1);
  await expect(page.locator(".role-content > .role-top-breadcrumb")).toBeVisible();
  await expect(page.locator(".role-topbar .role-page-breadcrumb")).toHaveCount(0);
  if (test.info().project.name === "mobile-390") {
    await page.getByRole("button", { name: "打开导航菜单", exact: true }).click();
    await page
      .locator("#role-navigation")
      .getByRole("link", { name: "选品库", exact: true })
      .click();
  } else
    await page
      .locator(".commerce-sidebar")
      .getByRole("link", { name: "选品库", exact: true })
      .click();
  await expect(crumb).toContainText("选品库");
  await expect(crumb).toHaveCount(1);
  const currentCrumb = crumb.locator('[aria-current="page"]');
  const parentCrumb = crumb.getByRole("link", { name: "选品工作区" });
  await expect(currentCrumb).toHaveCSS("font-weight", "650");
  await expect(parentCrumb).toHaveCSS("text-decoration-line", "none");
  expect(await parentCrumb.evaluate((el) => getComputedStyle(el).color)).not.toBe(
    await currentCrumb.evaluate((el) => getComputedStyle(el).color),
  );
  await parentCrumb.focus();
  await expect(parentCrumb).toBeFocused();
  await expect(page.locator(".role-content")).toHaveCSS("font-size", "14px");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

for (const palette of [
  {
    theme: "deep-ocean",
    primary: "rgb(20, 91, 255)",
    soft: "rgb(234, 241, 255)",
    warning: "rgb(154, 91, 0)",
  },
  {
    theme: "aurora-purple",
    primary: "rgb(70, 83, 101)",
    soft: "rgb(238, 241, 245)",
    warning: "rgb(146, 85, 0)",
  },
  {
    theme: "cloud-white",
    primary: "rgb(20, 126, 151)",
    soft: "rgb(234, 247, 250)",
    warning: "rgb(143, 87, 0)",
  },
])
  test(
    "reference semantic accents keep evidence amber and selected controls themed: " + palette.theme,
    async ({ page }) => {
      const { counters } = await setup(page);
      await page.addInitScript(
        (theme) => localStorage.setItem("scoutops:ui-theme", theme),
        palette.theme,
      );
      await page.route("**/api/v1/me/theme", (route) =>
        route.fulfill({ json: envelope({ theme: palette.theme, version: 1 }) }),
      );
      await page.route(completedRoute, (route) => route.fulfill({ json: envelope([]) }));
      await page.goto("/home");
      await expect(page.locator("html")).toHaveAttribute("data-theme", palette.theme);
      const quick = page.getByRole("complementary", { name: "待办与快捷入口" });
      const evidence = quick.locator(".home-quick-evidence");
      const candidate = quick.locator(".home-quick-candidates");
      await expect(evidence).toHaveAttribute("href", "/opportunities?view=evidence_pending");
      await expect(candidate).toHaveAttribute("href", "/opportunities?view=rule_candidates");
      await expect(evidence).toHaveCSS("background-color", "rgb(255, 243, 214)");
      await expect(evidence.locator("b")).toHaveCSS("color", palette.warning);
      await expect(evidence.locator("svg").first()).toHaveCSS("color", palette.warning);
      await expect(candidate).toHaveCSS("background-color", palette.soft);
      await expect(candidate.locator("b")).toHaveCSS("color", palette.primary);
      await expect(candidate.locator("svg").first()).toHaveCSS("color", palette.primary);
      const desktopBadge = page.viewportSize()!.width >= 1101;
      for (const row of [candidate, evidence]) {
        const badge = row.locator("b");
        if (desktopBadge) {
          await expect(badge).toHaveCSS("background-color", /^color\(srgb /);
          await expect(badge).not.toHaveCSS("background-color", await row.evaluate((el) => getComputedStyle(el).backgroundColor));
        } else {
          await expect(badge).toHaveCSS("background-color", "rgb(255, 255, 255)");
        }
      }
      const neutral = await quick
        .getByRole("link", { name: "市场情报", exact: true })
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      await expect(evidence).not.toHaveCSS("background-color", neutral);
      await expect(candidate).not.toHaveCSS("background-color", neutral);
      await expect(page.locator(".home-primary-action")).toHaveCSS(
        "background-color",
        palette.primary,
      );
      const mobile = page.viewportSize()!.width <= 840;
      if (mobile) await page.getByRole("button", { name: "打开导航菜单", exact: true }).click();
      const activeNavigation = page
        .locator(mobile ? ".role-navigation-frame" : ".commerce-sidebar")
        .getByRole("link", { name: "选品工作台", exact: true });
      await expect(activeNavigation).toBeVisible();
      await expect(activeNavigation).toHaveCSS("color", palette.primary);
      if (mobile) await page.getByRole("button", { name: "关闭导航菜单", exact: true }).click();
      await expect(page.locator('.home-result-header button[aria-pressed="true"]')).toHaveCSS(
        "color",
        palette.primary,
      );
      await expect(page.locator('.home-result-header button[aria-pressed="true"]')).toHaveCSS(
        "font-weight",
        "600",
      );
      await expect(page.getByRole("navigation", { name: "面包屑", exact: true })).toHaveCount(1);
      expect(counters.writes).toBe(0);
    },
  );

test("catalogue empty workflow leads to the real candidate list without writes", async ({
  page,
}) => {
  const { counters } = await setup(page);
  await page.route(/\/api\/v1\/opportunities\?/, (route) => {
    const view = new URL(route.request().url()).searchParams.get("selection_view");
    const data = view === "rule_candidates" ? [product("候选商品视觉夹具")] : [];
    return route.fulfill({ json: { ...envelope(data), meta: { total: data.length } } });
  });
  await page.goto("/opportunities?view=completed");
  const empty = page.getByRole("region", { name: "已完成分析空状态" });
  await expect(empty).toBeVisible();
  await expect(empty.getByRole("list", { name: "分析流程说明" }).locator("li")).toHaveCount(5);
  await expect(page.locator(".catalogue-title-line [role=note]")).toHaveText("当前为只读权限。");
  await empty.getByRole("button", { name: "查看候选商品" }).click();
  await expect(page).toHaveURL(/view=rule_candidates/);
  await expect(page.locator(".product-catalog")).toContainText("候选商品视觉夹具");
  await expect(page.locator(".catalog-data-note")).toContainText("不等于精确销量");
  expect(counters.writes).toBe(0);
});
