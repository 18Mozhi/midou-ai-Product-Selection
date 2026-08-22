import { test, expect, type Page } from "@playwright/test";
const id = "00000000-0000-4000-8000-000000000505",
  envelope = (data: unknown) => ({
    data,
    request_id: "m04-05-e2e-request",
    trace_id: "m04-05-e2e-trace",
  }),
  item = {
    id,
    market: "US",
    source_site: "Amazon US",
    external_id: "B0SCOUTOPS",
    product_url: "https://example.test/product",
    title: "便携式净水杯竞品",
    status: "active",
    revision: 2,
    snapshot_count: 2,
    latest_snapshot: {
      id: "00000000-0000-4000-8000-000000000506",
      current_price: 26.99,
      currency: "USD",
      rank_value: 105,
      review_count: 825,
      rating_value: 4.6,
      availability: "out_of_stock",
      captured_at: "2026-08-08T12:01:00.000Z",
      freshness: "fresh",
      source_status: "healthy",
      source_ref_id: "amazon:B0SCOUTOPS:20260808",
      evidence_id: "00000000-0000-4000-8000-000000000507",
    },
    updated_at: "2026-08-08T12:01:01.000Z",
  },
  baseline = {
    ...item.latest_snapshot,
    id: "00000000-0000-4000-8000-000000000509",
    current_price: 29.99,
    availability: "in_stock",
    captured_at: "2026-08-01T12:01:00.000Z",
    evidence_id: "00000000-0000-4000-8000-000000000510",
  };
async function setup(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=member", (r) =>
    r.fulfill({
      json: envelope({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000501",
        workspace_id: "00000000-0000-4000-8000-000000000502",
        roles: ["member"],
        capabilities: ["task:read", "competitor:read", "competitor:manage"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/competitor-monitor-rules", (r) =>
    r.fulfill({
      json: envelope([
        {
          id: "00000000-0000-4000-8000-000000000508",
          competitor_id: id,
          metric: "price",
          direction: "decrease",
          threshold_value: 2,
          status: "enabled",
        },
      ]),
    }),
  );
  await page.route("**/api/v1/competitors", (r) => r.fulfill({ json: envelope([item]) }));
  await page.route(`**/api/v1/competitors/${id}`, (r) =>
    r.fulfill({
      json: envelope({
        ...item,
        snapshots: [item.latest_snapshot, baseline],
        changes: [
          {
            id: "c1",
            field: "current_price",
            previous: "29.99",
            current: "26.99",
            changed_at: "2026-08-08T12:01:00.000Z",
            evidence_id: item.latest_snapshot.evidence_id,
            impact_explanation: "价格由 29.99 变为 26.99；请结合来源证据复核影响。",
          },
          {
            id: "c2",
            field: "availability",
            previous: "in_stock",
            current: "out_of_stock",
            changed_at: "2026-08-08T12:01:00.000Z",
            evidence_id: item.latest_snapshot.evidence_id,
            impact_explanation: "库存由 in_stock 变为 out_of_stock；请结合来源证据复核影响。",
          },
        ],
        alerts: [
          {
            id: "a1",
            change_id: "c1",
            rule_id: "00000000-0000-4000-8000-000000000508",
            notification_status: "queued",
            task_status: "queued",
            payload: { field: "current_price" },
            created_at: "2026-08-08T12:01:01.000Z",
          },
        ],
      }),
    }),
  );
}
test("M04-05.A07/A08/A09/A15 renders source-backed baseline changes thresholds and responsive rule controls", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/competitors?create=1");
  await expect(page.getByRole("heading", { name: "竞品监控", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "添加竞品监控" })).toBeVisible();
  await expect(page.getByLabel("添加竞品步骤").getByText("1 商品链接")).toHaveAttribute(
    "aria-current",
    "step",
  );
  await page.getByRole("button", { name: "关闭新建竞品" }).click();
  await page.getByRole("button", { name: /便携式净水杯竞品/ }).click();
  await expect(page).toHaveURL(new RegExp(`competitor=${id}`));
  await expect(page.getByLabel("基线、变动与阈值").getByText("USD 29.99")).toBeVisible();
  await expect(page.getByLabel("基线、变动与阈值").getByText("价格 · 减少 USD 2")).toBeVisible();
  await expect(page.getByText(/证据 00000000/).first()).toBeVisible();
  await expect(page.getByText("USD 29.99 → 26.99")).toBeVisible();
  await expect(page.getByText("有货 → 缺货")).toBeVisible();
  const activity = page.getByLabel("竞品处理时间轴");
  await expect(activity.getByText("告警、任务与结论时间轴")).toBeVisible();
  await expect(activity.getByText("系统告警 待发送 · 系统任务 待创建")).toBeVisible();
  await expect(activity.getByText("结论").first()).toBeVisible();
  await expect(activity.getByText("未命中监控阈值")).toBeVisible();
  await expect(
    page.getByLabel("价格与库存时间轴").getByText("缺货 · 评分 4.6 · 评论 825"),
  ).toBeVisible();
  await expect(page.getByText("2026/08/08 20:01").first()).toBeVisible();
  await page.getByRole("button", { name: "当前竞品规则" }).click();
  await expect(page.getByRole("heading", { name: "新建监控规则" })).toBeVisible();
  await expect(page.getByLabel("竞品（留空为工作区全局）")).toHaveValue(id);
  await page.getByRole("button", { name: "关闭告警规则" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
});

test("competitor creation uses link, market and confirmation steps", async ({ page }) => {
  await setup(page);
  await page.goto("/competitors");
  await page.getByRole("button", { name: "添加竞品监控" }).click();
  const dialog = page.getByRole("dialog", { name: "添加竞品监控" });
  await dialog.getByLabel("商品网址").fill("https://www.amazon.com/dp/B0SCOUTOPS");
  await dialog.getByRole("button", { name: "下一步" }).click();
  await expect(dialog.getByText("2 市场信息")).toHaveAttribute("aria-current", "step");
  await dialog.getByLabel("市场").fill("US");
  await dialog.getByLabel("监控名称").fill("便携式净水杯竞品");
  await dialog.getByRole("button", { name: "下一步" }).click();
  await expect(dialog.getByText("3 确认采集")).toHaveAttribute("aria-current", "step");
  await expect(dialog.getByText("https://www.amazon.com/dp/B0SCOUTOPS")).toBeVisible();
});

test("competitor search and detail restore from the URL", async ({ page }) => {
  await setup(page);
  await page.goto(`/competitors?q=净水&competitor=${id}`);
  await expect(page.getByLabel("搜索竞品")).toHaveValue("净水");
  await expect(page.getByRole("heading", { name: item.title })).toBeVisible();
});

test("competitor monitoring rules use an independent route and retain the source competitor", async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/competitors?competitor=${id}`);
  await page.getByRole("button", { name: "当前竞品规则" }).click();
  await expect(page).toHaveURL(new RegExp(`/competitors/monitoring-rules\\?competitor=${id}`));
  await expect(page.getByRole("heading", { name: "监控规则", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "新建监控规则" })).toBeVisible();
  await expect(page.getByLabel("竞品（留空为工作区全局）")).toHaveValue(id);
  await page.getByRole("button", { name: "关闭告警规则" }).click();
  await expect(page.getByLabel("竞品监控规则列表").getByText("价格 · 减少 USD 2")).toBeVisible();
  await expect(page.getByRole("link", { name: "返回竞品列表" })).toHaveAttribute(
    "href",
    "/competitors",
  );
});
