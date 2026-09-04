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
  await expect(page.getByRole("heading", { name: "选品控制台" })).toBeVisible();
  await expect(page.getByText("自动选品运行中")).toBeVisible();
  await expect(page.getByText("便携咖啡机候选")).toBeVisible();
  await expect(page.getByText("86.5 分")).toBeVisible();
  await expect(page.getByRole("link", { name: /便携咖啡机候选/ })).toHaveAttribute(
    "href",
    "/opportunities/00000000-0000-4000-8000-000000000610",
  );
  await expect(page.getByRole("link", { name: "管理规则" })).toHaveAttribute(
    "href",
    "/trends?section=rules",
  );
  await expect(page.getByRole("link", { name: "查看推荐清单" })).toHaveAttribute(
    "href",
    "/opportunities",
  );
  await expect(page.getByText("竞品来源延迟")).toBeVisible();
  await expect(page.getByRole("heading", { name: "推荐清单" })).toBeVisible();
  await expect(page.locator(".home-status-facts")).toContainText("4待你采纳");
  await expect(page.locator(".home-status-facts")).toContainText("5规则命中候选");
  await expect(page.locator(".home-status-facts")).toContainText("8采集中");
  await expect(page.locator(".home-status-facts")).toContainText("3运行规则");
  await expect(page.getByRole("link", { name: "4 待你采纳" })).toHaveAttribute(
    "href",
    "/opportunities?view=recommended",
  );
  await expect(page.getByRole("link", { name: "5 规则命中候选" })).toHaveAttribute(
    "href",
    "/opportunities?view=rule_candidates",
  );
  await expect(page.getByRole("link", { name: "8 采集中" })).toHaveAttribute(
    "href",
    "/opportunities?view=evidence_pending",
  );
  await expect(page.getByRole("link", { name: "3 运行规则" })).toHaveAttribute(
    "href",
    "/trends?section=rules",
  );
  await expect(page.getByRole("heading", { name: "系统正在做什么" })).toBeHidden();
  await page.getByText("运行详情", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "系统正在做什么" })).toBeVisible();
  await expect(page.locator(".home-runtime-panel")).toContainText("规则候选12 条");
  await expect(page.locator(".home-runtime-panel")).toContainText("人工已采纳2 条");
  await expect(page.locator(".home-runtime-panel li").first()).toHaveAttribute("data-done", "true");
  await expect(page.getByText("自动推荐不等于自动采纳")).toBeHidden();
  await page.getByText("数据说明", { exact: true }).click();
  await expect(page.getByText("自动推荐不等于自动采纳")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  if (testInfo.project.name === "mobile-390") {
    const firstRecommendation = page.getByRole("link", { name: /便携咖啡机候选/ });
    await markOcclusionProbe(firstRecommendation);
    await expectAboveMobileNavigation(page, firstRecommendation);
  }
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
    page.getByText("尚未达到规则来源门槛，或当前机会不属于自动选品规则，暂不能采纳。"),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "机会详情返回路径" })).toContainText(
    "机会详情",
  );
  await expect(page.getByText("尚无评分运行；缺失输入不会用默认值补齐。")).toBeVisible();

  const finalEvidenceMessage = page.getByText("尚无评分运行；缺失输入不会用默认值补齐。");
  await markOcclusionProbe(finalEvidenceMessage);
  await expectAboveMobileNavigation(page, finalEvidenceMessage);
});

test("M02-06.A08/A16 empty then blocked recovery never fabricates metrics", async ({
  page,
}, testInfo) => {
  await nav(page);
  let blocked = false;
  let createdRuleBody: Record<string, unknown> | null = null;
  await page.unroute("**/api/v1/trends/monitoring-rules");
  await page.route("**/api/v1/trends/monitoring-rules", async (route) => {
    if (route.request().method() === "POST") {
      createdRuleBody = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({
        status: 201,
        json: envelope({
          id: "00000000-0000-4000-8000-000000000630",
          ...createdRuleBody,
          status: "enabled",
          version: 1,
        }),
      });
    }
    return route.fulfill({ json: envelope(createdRuleBody ? [{ ...createdRuleBody }] : []) });
  });
  await page.route("**/api/v1/me/home-dashboard", (route) =>
    route.fulfill(
      blocked
        ? {
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                code: "dependency_unavailable",
                message: "依赖不可用",
                action_hint: "稍后重试",
              },
              request_id: "m02-06-blocked",
              trace_id: "m02-06-blocked",
            }),
          }
        : {
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                actions: [],
                changes: [],
                follows: [],
                health: [],
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
                scope: { organization_id: org, workspace_id: workspace },
                generated_at: at,
              },
              request_id: "m02-06-empty",
              trace_id: "m02-06-empty",
            }),
          },
    ),
  );
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "选品控制台" })).toBeVisible();
  await expect(page.getByText("自动选品未配置")).toBeVisible();
  await expect(page.getByText("先告诉系统要找什么")).toBeVisible();
  await expect(page.getByRole("heading", { name: "创建自动选品规则" })).toBeVisible();
  await page.getByText("运行详情", { exact: true }).click();
  await expect(page.locator(".home-runtime-panel li").first()).toHaveAttribute(
    "data-done",
    "false",
  );
  const emptyRecommendation = page.getByText("系统会在五项质量门全部通过后自动加入这里。");
  await expect(emptyRecommendation).toBeVisible();
  if (testInfo.project.name === "mobile-390") {
    await markOcclusionProbe(emptyRecommendation);
    await expectAboveMobileNavigation(page, emptyRecommendation);
  }
  await page.getByLabel("想找的商品关键词").fill("egg washer, egg brush");
  await page.getByLabel("形成候选的来源门槛").selectOption("2");
  await page.getByRole("button", { name: "保存并开始自动选品" }).click();
  await expect.poll(() => createdRuleBody?.recommendation_min_source_count).toBe(2);
  await expect.poll(() => createdRuleBody?.include_keywords).toEqual(["egg washer", "egg brush"]);
  blocked = true;
  await page.reload();
  await expect(page.getByRole("heading", { name: "依赖暂时受阻" })).toBeVisible();
  await expect(page.getByText("关联编号")).toBeVisible();
});
