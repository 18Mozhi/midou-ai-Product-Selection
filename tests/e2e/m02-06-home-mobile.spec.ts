import { test, expect } from "@playwright/test";
import { expectAboveMobileNavigation, markOcclusionProbe } from "./helpers/mobile-occlusion";

const org = "00000000-0000-4000-8000-000000000601";
const workspace = "00000000-0000-4000-8000-000000000602";
const opportunityId = "00000000-0000-4000-8000-000000000620";
const navigation = {
  shell: "member",
  organization_id: org,
  workspace_id: workspace,
  roles: ["member"],
  capabilities: [
    "task:read",
    "task:create",
    "trend:read",
    "trend:manage",
    "opportunity:read",
    "competitor:read",
    "sourcing:read",
    "notification:read",
  ],
  platform_roles: [],
  platform_capabilities: [],
  guard_reason: "navigation_member_allowed",
};
const at = "2026-08-07T16:30:00.000Z";
const item = (id: string, kind: string, title: string, route: string, extra = {}) => ({
  id,
  kind,
  title,
  reason: "来自当前工作区的已验证投影",
  route,
  source_module: "projection",
  source_label: "工作事项",
  context_label: "去处理",
  priority: null,
  risk_level: null,
  value_score: null,
  blocked: false,
  owner_label: null,
  due_at: null,
  source_count: null,
  observed_at: at,
  severity: "info",
  source_version: 1,
  ...extra,
});
const envelope = (data: unknown) => ({
  data,
  request_id: "m02-06-request",
  trace_id: "m02-06-trace",
});

async function nav(page: any) {
  await page.route("**/api/v1/me/navigation?**", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: navigation, request_id: "m02-06-nav", trace_id: "m02-06-nav" }),
    }),
  );
  await page.route("**/api/v1/trends/monitoring-rules", (route: any) =>
    route.fulfill({ json: envelope([]) }),
  );
}

test("M02-06.A07/A08/A15 verified home dashboard is responsive and visual", async ({
  page,
}, testInfo) => {
  await nav(page);
  await page.route("**/api/v1/me/home-dashboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          actions: [
            item(
              "00000000-0000-4000-8000-000000000610",
              "action",
              "便携咖啡机候选",
              "/opportunities/00000000-0000-4000-8000-000000000610",
              {
                priority: "high_value",
                source_module: "opportunity",
                source_label: "自动选品",
                context_label: "进入人工决策",
                value_score: 86.5,
              },
            ),
          ],
          changes: [
            item(
              "00000000-0000-4000-8000-000000000611",
              "change",
              "户外照明热度变化",
              "/trends/1",
              { source_count: 3 },
            ),
          ],
          follows: [
            item(
              "00000000-0000-4000-8000-000000000612",
              "follow",
              "关注竞品出现变动",
              "/competitors/1",
            ),
          ],
          health: [
            item(
              "00000000-0000-4000-8000-000000000613",
              "health",
              "竞品来源延迟",
              "/platform-admin/collection",
              { severity: "warning" },
            ),
          ],
          automatic_selection: {
            state: "running",
            enabled_rule_count: 3,
            candidate_count: 12,
            rule_candidate_count: 5,
            recommended_count: 4,
            awaiting_evidence_count: 8,
            adopted_count: 2,
            recommended_items: [
              item(
                "00000000-0000-4000-8000-000000000610",
                "action",
                "便携咖啡机候选",
                "/opportunities/00000000-0000-4000-8000-000000000610",
                {
                  priority: "high_value",
                  source_module: "opportunity",
                  source_label: "自动选品",
                  context_label: "进入人工决策",
                  value_score: 86.5,
                },
              ),
            ],
            last_collection_at: "2026-08-07T16:00:00.000Z",
            next_collection_at: "2026-08-07T17:00:00.000Z",
          },
          scope: { organization_id: org, workspace_id: workspace },
          generated_at: at,
        },
        request_id: "m02-06-home",
        trace_id: "m02-06-home",
      }),
    }),
  );
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "选品工作台", exact: true })).toBeVisible();
  await expect(page.locator(".home-system-state")).toHaveText("采集调度已配置");
  await expect(page.getByText("便携咖啡机候选")).toBeVisible();
  await expect(page.getByText("86.5 分")).toBeVisible();
  await expect(page.getByRole("link", { name: /便携咖啡机候选/ })).toHaveAttribute(
    "href",
    "/opportunities/00000000-0000-4000-8000-000000000610",
  );
  await expect(page.getByRole("link", { name: "管理规则" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "查看选品库" })).toHaveAttribute(
    "href",
    "/opportunities",
  );
  const actionHeights = await page
    .locator(".home-command-bar nav a,.home-command-bar nav button")
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(actionHeights.length).toBeGreaterThanOrEqual(3);
  expect(Math.min(...actionHeights)).toBeGreaterThanOrEqual(44);
  await expect(page.locator('a[href="/opportunities/start"]')).toHaveCount(0);
  await expect(page.getByText("竞品来源延迟")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "推荐清单" })).toBeVisible();
  await expect(page.locator(".home-status-facts")).toContainText("4待你采纳");
  await expect(page.locator(".home-status-facts")).toContainText("5选品候选");
  await expect(page.locator(".home-status-facts")).toContainText("8待补证据");
  await expect(page.locator(".home-status-facts")).toContainText("2累计采纳");
  await expect(page.getByRole("link", { name: "4 待你采纳" })).toHaveAttribute(
    "href",
    "/opportunities?view=recommended",
  );
  await expect(page.getByRole("link", { name: "5 选品候选" })).toHaveAttribute(
    "href",
    "/opportunities?view=rule_candidates",
  );
  await expect(page.getByRole("link", { name: "8 待补证据" })).toHaveAttribute(
    "href",
    "/opportunities?view=evidence_pending",
  );
  await expect(page.getByRole("link", { name: "2 累计采纳" })).toHaveAttribute(
    "href",
    "/opportunities?view=all&decision_status=adopted",
  );
  await expect(page.getByRole("heading", { name: "采集记录" })).toBeHidden();
  await page.getByText("运行详情", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "采集记录" })).toBeVisible();
  await expect(page.locator(".home-runtime-panel")).toContainText("待决策记录12 条");
  await expect(page.locator(".home-runtime-panel")).toContainText("人工已采纳2 条");
  await expect(page.locator(".home-runtime-panel li")).toHaveCount(0);
  await expect(page.locator(".home-runtime-panel")).toContainText("不代表 Worker 实时运行状态");
  await expect(page.getByText("推荐需人工采纳")).toBeHidden();
  await page.getByText("数据说明", { exact: true }).click();
  await expect(page.getByText("推荐需人工采纳")).toBeVisible();
  const layout = await page.evaluate(() => {
    const header = document.querySelector(".home-command-bar")!;
    const metrics = document.querySelector(".home-automation-overview")!;
    const queue = document.querySelector(".home-review-queue")!;
    return {
      headerColor: getComputedStyle(header).backgroundColor,
      queueColor: getComputedStyle(queue).backgroundColor,
      headerHeight: header.getBoundingClientRect().height,
      metricsAboveQueue: metrics.getBoundingClientRect().top < queue.getBoundingClientRect().top,
      metricsInSidebar: Boolean(metrics.closest("aside")),
    };
  });
  expect(layout.headerColor).toBe(layout.queueColor);
  expect(layout.headerHeight).toBeLessThan(testInfo.project.name === "mobile-390" ? 260 : 160);
  expect(layout.metricsAboveQueue).toBe(true);
  expect(layout.metricsInSidebar).toBe(false);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  if (testInfo.project.name === "mobile-390") {
    const firstRecommendation = page.getByRole("link", { name: /便携咖啡机候选/ });
    await markOcclusionProbe(firstRecommendation);
    await expectAboveMobileNavigation(page, firstRecommendation);
  }
  await page.getByText("运行详情", { exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("home-workspace.png"), fullPage: true });
});

test("M02-06.A07/A15 390 opportunity detail route consumes the completed P04 contract", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await nav(page);
  await page.route(`**/api/v1/opportunities/${opportunityId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          id: opportunityId,
          name: "移动端真实机会",
          market: "US",
          category: "beauty",
          source_type: "manual",
          source_ref_id: null,
          owner_id: null,
          lifecycle_status: "ready",
          recommendation_status: "insufficient_data",
          selection_stage: "not_eligible",
          quality_gates: {
            score: false,
            market: false,
            competition: false,
            cost: false,
            risk: false,
          },
          overall_score: null,
          trend_score: null,
          competition_score: null,
          profit_status: "insufficient_data",
          risk_level: "unknown",
          confidence: { status: "insufficient_data", score: null },
          evidence_count: 0,
          source_count: 0,
          coverage_status: "insufficient",
          decision_status: "pending",
          version: 1,
          updated_at: at,
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
        }),
      ),
    }),
  );
  await page.route(`**/api/v1/opportunities/${opportunityId}/profit-analysis`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(envelope({ latest_run: null, current_inputs: [] })),
    }),
  );
  await page.goto(`/opportunities/${opportunityId}`);
  await expect(page.getByRole("heading", { name: "移动端真实机会" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "待判断", level: 3 })).toBeVisible();
  await expect(
    page.getByText("尚未取得真实 Amazon 主品证据，或当前商品已结束决策，暂不能采纳。"),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "机会详情返回路径" })
      .getByRole("link", { name: "← 返回来源列表" }),
  ).toHaveAttribute("href", "/opportunities");
  await expect(page.getByText("暂无评分记录。")).toBeVisible();

  const finalEvidenceMessage = page.getByText("暂无评分记录。");
  await markOcclusionProbe(finalEvidenceMessage);
  await expectAboveMobileNavigation(page, finalEvidenceMessage);
});

test("M02-06.A08/A16 empty and blocked home do not create monitoring or fabricate metrics", async ({
  page,
}, testInfo) => {
  await nav(page);
  let blocked = false,
    legacyRequests = 0;
  await page.route("**/api/v1/trends/monitoring-rules", (route) => {
    legacyRequests++;
    return route.abort();
  });
  const summary = {
    actions: [],
    changes: [],
    follows: [],
    health: [],
    scope: { organization_id: org, workspace_id: workspace },
    generated_at: at,
    automatic_selection: {
      state: "not_configured",
      enabled_rule_count: 0,
      candidate_count: 0,
      rule_candidate_count: 0,
      recommended_count: 0,
      awaiting_evidence_count: 0,
      adopted_count: 0,
      recommended_items: [],
      last_collection_at: null,
      next_collection_at: null,
    },
  };
  await page.route("**/api/v1/me/home-dashboard", (route) =>
    route.fulfill(
      blocked
        ? {
            status: 503,
            json: {
              error: {
                code: "dependency_unavailable",
                message: "依赖不可用",
                action_hint: "稍后重试",
              },
              request_id: "blocked",
              trace_id: "blocked",
            },
          }
        : { json: envelope(summary) },
    ),
  );
  await page.goto("/home");
  await expect(page.getByText("等待采集来源就绪")).toBeVisible();
  await expect(page.getByRole("button", { name: "设置关键词监控", exact: true })).toHaveCount(0);
  expect(legacyRequests).toBe(0);
  blocked = true;
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await expect(page.getByText(/当前显示上次成功读取的快照/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "重新读取", exact: true })).toBeVisible();
  await expect(page.locator(".home-status-facts")).toHaveCount(0);
  expect(legacyRequests).toBe(0);
});

test("M02-06.A10/A12 missing selection and failed rule read remain unknown and non-actionable", async ({
  page,
}) => {
  await nav(page);
  await page.unroute("**/api/v1/trends/monitoring-rules");
  await page.route("**/api/v1/trends/monitoring-rules", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "forbidden", message: "无权限", action_hint: "请联系管理员" },
        request_id: "m02-06-rules-forbidden",
        trace_id: "m02-06-rules-forbidden",
      }),
    }),
  );
  await page.route("**/api/v1/me/home-dashboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        envelope({
          actions: [],
          changes: [],
          follows: [],
          health: [],
          scope: { organization_id: org, workspace_id: workspace },
          generated_at: at,
        }),
      ),
    }),
  );

  await page.goto("/home");
  await expect(page.getByText("自动选品状态暂不可用")).toBeVisible();
  await expect(page.getByText("自动选品数据暂不可用")).toBeVisible();
  await expect(page.getByText(/选品规则读取失败，请重试/)).toHaveCount(0);
  await expect(page.getByText("等待采集来源就绪")).toBeHidden();
  await expect(page.getByRole("heading", { name: "添加关键词监控" })).toBeHidden();
  await expect(page.locator(".home-status-facts")).toHaveCount(0);
});

test("M02-06 home state errors expose only the wired retry action", async ({ page }) => {
  await nav(page);
  let status = 403,
    reads = 0;
  await page.route("**/api/v1/me/home-dashboard", (route) => {
    reads += 1;
    if (status !== 200)
      return route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code:
              status === 403
                ? "forbidden"
                : status === 503
                  ? "dependency_unavailable"
                  : "home_failed",
            action_hint: "请联系管理员或稍后重试。",
          },
          request_id: `m02-06-home-state-${status}`,
          trace_id: `m02-06-home-state-${status}`,
        }),
      });
    return route.fulfill({
      json: envelope({
        actions: [],
        automatic_selection: {
          state: "running",
          enabled_rule_count: 1,
          candidate_count: 1,
          rule_candidate_count: 0,
          recommended_count: 1,
          awaiting_evidence_count: 0,
          adopted_count: 0,
          recommended_items: [
            item(
              "00000000-0000-4000-8000-000000000690",
              "action",
              "重新读取后可见",
              "/opportunities",
            ),
          ],
          last_collection_at: at,
          next_collection_at: null,
        },
        changes: [],
        follows: [],
        health: [],
        scope: { organization_id: org, workspace_id: workspace },
        generated_at: at,
      }),
    });
  });

  for (const [code, label] of [
    [403, "你没有此项权限"],
    [503, "依赖暂时受阻"],
    [500, "操作未完成"],
  ] as const) {
    status = code;
    await page.goto("/home");
    const panel = page.locator(".ui-state-panel");
    await expect(panel.getByRole("heading", { name: label })).toBeVisible();
    await expect(panel.getByRole("button", { name: "重新读取", exact: true })).toBeVisible();
    for (const unsupported of ["申请权限", "查看影响", "返回上一页"])
      await expect(panel.getByRole("button", { name: unsupported, exact: true })).toHaveCount(0);
  }

  status = 200;
  const readsBeforeRetry = reads;
  await page.locator(".ui-state-panel").getByRole("button", { name: "重新读取" }).click();
  await expect(page.getByText("重新读取后可见")).toBeVisible();
  expect(reads).toBeGreaterThan(readsBeforeRetry);
});

test("home continuously reads new results and stops when cached off route", async ({
  page,
}, testInfo) => {
  await nav(page);
  await page.clock.install();
  let reads = 0;
  await page.route("**/api/v1/me/home-dashboard", (route) => {
    reads++;
    return route.fulfill({
      json: envelope({
        automatic_selection: {
          state: "running",
          enabled_rule_count: 1,
          candidate_count: reads,
          rule_candidate_count: reads,
          recommended_count: 1,
          awaiting_evidence_count: 0,
          adopted_count: 0,
          recommended_items: [item("live", "action", `最新结果 ${reads}`, "/opportunities")],
          last_collection_at: at,
          next_collection_at: at,
        },
        actions: [],
        changes: [],
        follows: [],
        health: [],
        scope: { organization_id: org, workspace_id: workspace },
        generated_at: at,
      }),
    });
  });
  await page.goto("/home");
  await expect(page.getByText("最新结果 1", { exact: true })).toBeVisible();
  await page.clock.runFor(5100);
  await expect(page.getByText("最新结果 2", { exact: true })).toBeVisible();
  await page.route("**/api/v1/opportunities?**", (route) =>
    route.fulfill({ json: envelope({ items: [], total: 0 }) }),
  );
  await page.getByRole("link", { name: "查看选品库", exact: true }).click();
  await expect(page).toHaveURL(/opportunities/);
  const paused = reads;
  await page.clock.runFor(16000);
  expect(reads).toBe(paused);
  await page.goBack();
  await expect(page.getByText(`最新结果 ${paused + 1}`, { exact: true })).toBeVisible();
});

test("home background expiry clears protected cached results", async ({ page }) => {
  await nav(page);
  await page.clock.install();
  let reads = 0;
  let expired = true;
  await page.route("**/api/v1/me/home-dashboard", (route) => {
    reads++;
    return reads === 1 || !expired
      ? route.fulfill({
          json: envelope({
            automatic_selection: {
              state: "running",
              enabled_rule_count: 1,
              candidate_count: 1,
              rule_candidate_count: 1,
              recommended_count: 1,
              awaiting_evidence_count: 0,
              adopted_count: 0,
              recommended_items: [item("secret", "action", "工作区受保护结果", "/opportunities")],
              last_collection_at: at,
              next_collection_at: at,
            },
            actions: [],
            changes: [],
            follows: [],
            health: [],
            scope: { organization_id: org, workspace_id: workspace },
            generated_at: at,
          }),
        })
      : route.fulfill({
          status: 401,
          json: { error: { code: "session_expired", action_hint: "请重新登录" } },
        });
  });
  await page.goto("/home");
  await expect(page.getByText("工作区受保护结果", { exact: true })).toBeVisible();
  await page.clock.runFor(5100);
  await expect(page.getByText("工作区受保护结果", { exact: true })).toHaveCount(0);
  const stopped = reads;
  await page.clock.runFor(15000);
  expect(reads).toBe(stopped);
  expired = false;
  await page
    .locator(".ui-state-panel")
    .getByRole("button", { name: "重新读取", exact: true })
    .click();
  await expect(page.getByText("工作区受保护结果", { exact: true })).toBeVisible();
  await page.clock.runFor(5100);
  await expect.poll(() => reads).toBeGreaterThan(stopped + 1);
});

test("home polling stays independent from retired keyword setup without overlapping reads", async ({
  page,
}) => {
  await nav(page);
  await page.clock.install();
  let reads = 0;
  let release: (() => void) | undefined;
  const summary = {
    actions: [],
    changes: [],
    follows: [],
    health: [],
    scope: { organization_id: org, workspace_id: workspace },
    generated_at: at,
    automatic_selection: {
      state: "not_configured",
      enabled_rule_count: 0,
      candidate_count: 0,
      rule_candidate_count: 0,
      recommended_count: 0,
      awaiting_evidence_count: 0,
      adopted_count: 0,
      recommended_items: [],
      last_collection_at: null,
      next_collection_at: null,
    },
  };
  await page.route("**/api/v1/me/home-dashboard", async (route) => {
    reads++;
    if (reads === 2)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await route.fulfill({ json: envelope(summary) });
  });
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "添加关键词监控" })).toBeHidden();
  await expect(page.getByRole("button", { name: "设置关键词监控", exact: true })).toHaveCount(0);
  await page.clock.runFor(5100);
  await expect.poll(() => reads).toBe(2);
  await page.clock.runFor(16000);
  expect(reads).toBe(2);
  release?.();
  await expect(page.getByRole("button", { name: "刷新", exact: true })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "添加关键词监控" })).toBeHidden();
  await expect(page.getByRole("button", { name: "设置关键词监控", exact: true })).toHaveCount(0);
});

test.describe("daily snapshots retain Beijing time in overseas browsers", () => {
  test.use({ timezoneId: "America/Los_Angeles" });
  for (const completed of [0, 87, 125, null, undefined]) {
    test(`daily product production separates measured progress from missing data: ${completed}`, async ({
      page,
    }) => {
      await nav(page);
      await page.route("**/api/v1/me/home-dashboard", (route) =>
        route.fulfill({
          json: envelope({
            actions: [],
            changes: [],
            follows: [],
            health: [],
            scope: { organization_id: org, workspace_id: workspace },
            generated_at: at,
            automatic_selection: {
              state: "running",
              enabled_rule_count: 0,
              candidate_count: 900,
              rule_candidate_count: 500,
              recommended_count: 300,
              awaiting_evidence_count: 20,
              adopted_count: 100,
              recommended_items: [],
              last_collection_at: at,
              next_collection_at: at,
              daily_production:
                completed === null
                  ? null
                  : {
                      date: "2026-10-17",
                      timezone: "Asia/Shanghai",
                      discovered_count: 150,
                      completed_count: completed,
                      qualified_count:
                        typeof completed === "number" ? Math.max(0, completed - 10) : 87,
                      target_minimum: 100,
                      measured_at: "2026-10-17T00:00:00Z",
                    },
            },
          }),
        }),
      );
      await page.goto("/home");
      const daily = page.getByRole("region", { name: "每日选品产出" });
      const dailyBox = await daily.boundingBox();
      const cumulativeBox = await page.locator(".home-automation-overview").boundingBox();
      expect(dailyBox!.y).toBeLessThan(cumulativeBox!.y);
      await expect(page.getByText("采集调度已配置", { exact: true }).first()).toBeVisible();
      if (completed === null) {
        await expect(
          daily.getByText("每日产出尚未读取，暂不显示数量或目标达成状态。", { exact: true }),
        ).toBeVisible();
        await expect(daily.locator("progress")).toHaveCount(0);
      } else if (completed === undefined) {
        await expect(
          daily.getByText("完成流程数尚未读取，不使用新增数或推荐数代替。", { exact: true }),
        ).toBeVisible();
        await expect(daily.locator("progress")).toHaveCount(0);
        await expect(daily).toContainText("87");
      } else {
        await expect(daily.getByText("150", { exact: true })).toBeVisible();
        await expect(daily.locator("progress")).toHaveAttribute("value", String(completed));
        await expect(daily.locator("progress")).toHaveAttribute("max", "100");
        await expect(daily.getByText(/当前快照不能证明全天不间断运行/)).toBeVisible();
        await expect(daily).toContainText("统计时间 2026/10/17 08:00:00");
        await expect(daily.locator("dd").nth(0)).toHaveText(`${completed} / 100 目标`);
        expect(
          await daily
            .locator("dd")
            .first()
            .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
        ).toBeGreaterThanOrEqual(36);
        await expect(daily).toContainText("明确标注利润未知的已分析商品");
      }
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      if (completed === 87) {
        await daily.evaluate((element) => element.scrollIntoView({ block: "center" }));
        if (test.info().project.name === "mobile-390") {
          await markOcclusionProbe(daily);
          await expectAboveMobileNavigation(page, daily);
        }
        await expect(daily).toHaveScreenshot("daily-product-production.png");
      }
    });
  }
});
