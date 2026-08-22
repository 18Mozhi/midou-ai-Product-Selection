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
}

test("M02-06.A07/A08/A15 verified home dashboard is responsive and visual", async ({ page }) => {
  await nav(page);
  await page.route("**/api/v1/me/home-dashboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          actions: [
            item("00000000-0000-4000-8000-000000000610", "action", "处理逾期采集复核", "/tasks/1", {
              priority: "overdue",
              source_module: "task",
              source_label: "采集跟进",
              context_label: "打开完整处理上下文",
              risk_level: "critical",
              blocked: true,
              owner_label: "陈宇航",
              due_at: "2026-08-07T18:00:00.000Z",
            }),
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
          scope: { organization_id: org, workspace_id: workspace },
          generated_at: at,
        },
        request_id: "m02-06-home",
        trace_id: "m02-06-home",
      }),
    }),
  );
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "今天最值得做什么？" })).toBeVisible();
  await expect(page.getByText("处理逾期采集复核")).toBeVisible();
  await expect(page.getByText("风险 紧急")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /处理逾期采集复核.*打开完整处理上下文/ }),
  ).toHaveAttribute("href", "/tasks/1");
  await expect(page.getByText("竞品来源延迟")).toBeVisible();
  await expect(page.getByRole("heading", { name: "异常与数据健康" })).toBeVisible();
  const changeAction = page.getByRole("link", { name: /户外照明热度变化.*去处理/ });
  await expect(changeAction).toHaveAttribute("href", "/trends/1");
  await expect(page.locator(".home-priority-grid")).toContainText("今日行动");
  await expect(page.locator(".home-priority-grid")).toContainText("异常与数据健康");
  await expect(page.locator(".home-secondary")).toContainText("变化与关注");
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
  await expect(page.getByRole("navigation", { name: "机会详情返回路径" })).toContainText(
    "机会详情",
  );
  await expect(page.getByText("尚无评分运行；缺失输入不会用默认值补齐。")).toBeVisible();

  const finalEvidenceMessage = page.getByText("尚无评分运行；缺失输入不会用默认值补齐。");
  await markOcclusionProbe(finalEvidenceMessage);
  await expectAboveMobileNavigation(page, finalEvidenceMessage);
});

test("M02-06.A08/A16 empty then blocked recovery never fabricates metrics", async ({ page }) => {
  await nav(page);
  let blocked = false;
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
  await expect(page.getByRole("heading", { name: "当前范围还没有首页数据" })).toBeVisible();
  await expect(page.getByText("现在不展示模拟指标")).toBeVisible();
  await expect(page.getByRole("link", { name: /开始一次选品/ })).toHaveAttribute(
    "href",
    "/opportunities?create=1",
  );
  await expect(page.getByRole("link", { name: /添加竞品/ })).toHaveAttribute(
    "href",
    "/competitors?create=1",
  );
  await expect(page.getByRole("link", { name: /从 1688 找货/ })).toHaveAttribute(
    "href",
    "/sourcing?create=1",
  );
  blocked = true;
  await page.reload();
  await expect(page.getByRole("heading", { name: "依赖暂时受阻" })).toBeVisible();
  await expect(page.getByText("关联编号")).toBeVisible();
});
