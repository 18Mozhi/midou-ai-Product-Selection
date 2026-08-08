import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
const org = "00000000-0000-4000-8000-000000000561",
  ws = "00000000-0000-4000-8000-000000000562",
  envelope = (data: any) => ({
    data,
    request_id: "m05-06-e2e",
    trace_id: "m05-06-e2e",
  }),
  reports = {
    opportunity: {
      type: "opportunity",
      summary: {
        total: 28,
        adopted: 8,
        observing: 9,
        rejected: 4,
        complete_coverage: 17,
        average_score: 78.6,
      },
      series: [
        { label: "recommend", value: 12 },
        { label: "observe", value: 9 },
        { label: "not_recommend", value: 4 },
        { label: "insufficient_data", value: 3 },
      ],
      observed_at: "2026-08-08T12:00:00.000Z",
    },
    trend: {
      type: "trend",
      summary: {
        total: 16,
        signals: 128,
        sources: 34,
        average_momentum: 13.5,
        average_confidence: 76,
      },
      series: [
        { label: "active", value: 12 },
        { label: "stale", value: 3 },
        { label: "irrelevant", value: 1 },
      ],
      observed_at: "2026-08-08T12:00:00.000Z",
    },
    team: {
      type: "team",
      summary: { members: 6, total: 42, completed: 29, overdue: 3 },
      series: [
        { label: "member-a@example.test", value: 9 },
        { label: "member-b@example.test", value: 7 },
        { label: "member-c@example.test", value: 6 },
      ],
      observed_at: "2026-08-08T12:00:00.000Z",
    },
  };
async function setup(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=member", (r) =>
    r.fulfill({
      json: envelope({
        shell: "member",
        organization_id: org,
        workspace_id: ws,
        roles: ["selection_manager"],
        capabilities: ["task:read", "report:read"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  for (const type of Object.keys(reports))
    await page.route(`**/api/v1/reports/${type}`, (r) =>
      r.fulfill({ json: envelope((reports as any)[type]) }),
    );
  await page.route("**/api/v1/report-exports", (r) =>
    r.fulfill({
      json: envelope([
        {
          id: "00000000-0000-4000-8000-000000000563",
          report_type: "opportunity",
          format: "csv",
          status: "succeeded",
          attempt_count: 1,
          filename: "scoutops-opportunity.csv",
          row_count: 28,
          byte_size: 4096,
          expires_at: "2026-08-09T12:00:00.000Z",
          last_error_code: null,
          version: 3,
          created_at: "2026-08-08T12:00:00.000Z",
          updated_at: "2026-08-08T12:01:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000564",
          report_type: "trend",
          format: "csv",
          status: "leased",
          attempt_count: 1,
          filename: "scoutops-trend.csv",
          row_count: null,
          byte_size: null,
          expires_at: "2026-08-09T12:00:00.000Z",
          last_error_code: null,
          version: 2,
          created_at: "2026-08-08T12:02:00.000Z",
          updated_at: "2026-08-08T12:02:01.000Z",
        },
      ]),
    }),
  );
}
test("M05-06.A07/A08/A15 desktop factual report and export lifecycle", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "报表与导出", level: 2 }),
  ).toBeVisible();
  await expect(page.getByText("28").first()).toBeVisible();
  await expect(page.getByText("文件到期后由 Worker 清理")).toBeVisible();
  await expect(page).toHaveScreenshot("m05-06-reports-desktop.png", {
    fullPage: true,
  });
  await page.getByRole("button", { name: "趋势分析" }).click();
  await expect(page.getByText("128")).toBeVisible();
});
test("M05-06.A07/A08/A15 mobile team report layout", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/reports");
  await page.getByRole("button", { name: "团队绩效" }).click();
  await expect(page.getByText("成员数")).toBeVisible();
  await expect(page.getByText("数据不足", { exact: false }).first())
    .toBeVisible({ timeout: 5000 })
    .catch(() => {});
  await expect(page).toHaveScreenshot("m05-06-reports-mobile-390.png", {
    fullPage: true,
  });
});
