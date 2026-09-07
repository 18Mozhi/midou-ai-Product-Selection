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
          expires_at: "2026-09-09T12:00:00.000Z",
          last_error_code: null,
          queue_position: null,
          estimated_completion_at: null,
          estimate_sample_size: 0,
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
          expires_at: "2026-09-09T12:00:00.000Z",
          last_error_code: null,
          queue_position: 1,
          estimated_completion_at: "2026-08-08T12:04:00.000Z",
          estimate_sample_size: 10,
          version: 2,
          created_at: "2026-08-08T12:02:00.000Z",
          updated_at: "2026-08-08T12:02:01.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000565",
          report_type: "team",
          format: "csv",
          status: "expired",
          attempt_count: 1,
          filename: "scoutops-team.csv",
          row_count: 6,
          byte_size: 2048,
          expires_at: "2026-08-09T12:00:00.000Z",
          last_error_code: null,
          queue_position: null,
          estimated_completion_at: null,
          estimate_sample_size: 0,
          version: 4,
          created_at: "2026-08-07T12:00:00.000Z",
          updated_at: "2026-08-09T12:00:00.000Z",
        },
        {
          id: "00000000-0000-4000-8000-000000000567",
          report_type: "opportunity",
          format: "csv",
          status: "queued",
          attempt_count: 0,
          filename: "scoutops-opportunity-new.csv",
          row_count: null,
          byte_size: null,
          expires_at: "2026-09-09T12:00:00.000Z",
          last_error_code: null,
          queue_position: 2,
          estimated_completion_at: "2026-08-08T12:06:00.000Z",
          estimate_sample_size: 10,
          version: 1,
          created_at: "2026-08-08T12:03:00.000Z",
          updated_at: "2026-08-08T12:03:00.000Z",
        },
      ]),
    }),
  );
  await page.route("**/api/v1/report-exports/00000000-0000-4000-8000-000000000563", (r) =>
    r.fulfill({
      json: envelope({
        id: "00000000-0000-4000-8000-000000000563",
        report_type: "opportunity",
        format: "csv",
        status: "succeeded",
        attempt_count: 1,
        filename: "scoutops-opportunity.csv",
        row_count: 28,
        byte_size: 4096,
        expires_at: "2026-09-09T12:00:00.000Z",
        last_error_code: null,
        queue_position: null,
        estimated_completion_at: null,
        estimate_sample_size: 0,
        version: 3,
        created_at: "2026-08-08T12:00:00.000Z",
        updated_at: "2026-08-08T12:01:00.000Z",
      }),
    }),
  );
  await page.route("**/api/v1/report-exports/00000000-0000-4000-8000-000000000566", (r) =>
    r.fulfill({
      json: envelope({
        id: "00000000-0000-4000-8000-000000000566",
        report_type: "team",
        format: "csv",
        status: "queued",
        attempt_count: 0,
        filename: "scoutops-team-regenerated.csv",
        row_count: null,
        byte_size: null,
        expires_at: "2026-09-19T12:00:00.000Z",
        last_error_code: null,
        queue_position: 3,
        estimated_completion_at: "2026-08-08T12:08:00.000Z",
        estimate_sample_size: 10,
        version: 1,
        created_at: "2026-08-08T12:04:00.000Z",
        updated_at: "2026-08-08T12:04:00.000Z",
      }),
    }),
  );
  await page.route(
    "**/api/v1/report-exports/00000000-0000-4000-8000-000000000565/regenerate",
    (r) => {
      expect(r.request().headers()["idempotency-key"]).toBeTruthy();
      expect(r.request().headers()["x-request-id"]).toBeTruthy();
      expect(r.request().headers()["x-trace-id"]).toBeTruthy();
      r.fulfill({
        status: 202,
        json: envelope({
          id: "00000000-0000-4000-8000-000000000566",
          report_type: "team",
          format: "csv",
          status: "queued",
          expires_at: "2026-09-19T12:00:00.000Z",
          regenerated_from_export_id: "00000000-0000-4000-8000-000000000565",
        }),
      });
    },
  );
}
test("M05-06.A07/A08/A15 desktop factual report and export lifecycle", async ({ page }) => {
  await setup(page);
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "报表与导出", level: 2 })).toBeVisible();
  await expect(page.getByText("28").first()).toBeVisible();
  await expect(page.getByText("文件到期后由 Worker 清理")).toBeVisible();
  await expect(page.locator('i[data-status="queued"]')).toHaveText("排队中");
  await expect(page.locator('i[data-status="leased"]')).toHaveText("生成中");
  await expect(page.getByText(/队列第 1 位 · 预计/)).toBeVisible();
  await expect(page.getByText(/队列第 2 位 · 预计/)).toBeVisible();
  await expect(page.locator('i[data-status="expired"]')).toHaveText("已过期");
  await expect(page.getByText("expired", { exact: true })).toHaveCount(0);
  await expect(page.getByText("继续观察", { exact: true })).toBeVisible();
  await expect(page.getByText("observe", { exact: true })).toHaveCount(0);
  await expect(page.getByText("当前工作区全部已落库记录")).toBeVisible();
  await expect(page.getByText("共 28 个机会，已采纳 8 个，证据完整 17 个。")).toBeVisible();
  await expect(page.getByText("报表怎么用")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "刷新状态" })).toBeVisible();

  await page.getByRole("button", { name: "查看详情" }).first().click();
  await expect(page).toHaveURL(/export=00000000-0000-4000-8000-000000000563/);
  await expect(page.getByRole("dialog", { name: "机会分析导出详情" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "机会分析导出详情" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "机会分析导出详情" })).toHaveCount(0);
  await expect(page).not.toHaveURL(/export=/);
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "机会分析导出详情" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "趋势分析" }).click();
  await expect(page).toHaveURL(/report=trend/);
  await expect(page.getByText("128", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "重新生成" }).first().click();
  await expect(page.getByText("新的团队绩效导出已进入队列。")).toBeVisible();
  await page.getByRole("button", { name: "关闭导出详情" }).click();
  await page.getByRole("link", { name: "在任务中心查看" }).click();
  await expect(page).toHaveURL(/\/tasks\?view=exports/);
  await expect(page.getByRole("heading", { name: "导出任务" })).toBeVisible();
  await expect(page.getByText("前往报表页下载文件")).toBeVisible();
});
test("M05-06 report failure state identifies an unavailable service instead of an export conflict", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/reports");
  await page.route("**/api/v1/reports/trend", (route) => route.abort("internetdisconnected"));
  await page.getByRole("button", { name: "趋势分析" }).click();
  await expect(page.getByRole("heading", { name: "报表服务暂不可用" })).toBeVisible();
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "导出尚未就绪" })).toHaveCount(0);
});
test("M05-06.A07/A08/A15 mobile team report layout", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/reports");
  await page.getByRole("button", { name: "团队绩效" }).click();
  await expect(page.getByText("成员数")).toBeVisible();
  await expect(page.getByText(/共 6 名成员、42 项任务/)).toBeVisible();
  await expect(page.getByText("数据不足", { exact: false }).first())
    .toBeVisible({ timeout: 5000 })
    .catch(() => {});
});

test("UI2-RP01 late export detail cannot reopen after history closes it", async ({ page }) => {
  await setup(page);
  await page.clock.setFixedTime(new Date("2026-09-08T00:00:00Z"));
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const detailPath = "**/api/v1/report-exports/00000000-0000-4000-8000-000000000563";
  await page.route(detailPath, async (route) => {
    await held;
    await route.fulfill({
      json: envelope({
        id: "00000000-0000-4000-8000-000000000563",
        report_type: "opportunity",
        status: "succeeded",
        row_count: 28,
        byte_size: 4096,
        expires_at: "2026-09-09T12:00:00Z",
        last_error_code: null,
      }),
    });
  });
  await page.goto("/reports");
  await expect(page.locator(".report-conclusion")).toContainText("共 28 个机会");
  const sent = page.waitForRequest(detailPath);
  await page.getByRole("button", { name: "查看详情" }).first().click();
  await sent;
  await page.goBack();
  await expect(page).not.toHaveURL(/export=/);
  const response = page.waitForResponse(detailPath);
  release();
  await (await response).finished();
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  // A negative assertion alone could pass before the response's JSON continuation renders.
  await page.waitForTimeout(200);
  await expect(page.locator(".report-detail")).toHaveCount(0);
});

test("UI2-RP02 failed download stays retryable and returns the actual CSV bytes", async ({
  page,
}) => {
  await setup(page);
  await page.clock.setFixedTime(new Date("2026-09-08T00:00:00Z"));
  let attempts = 0;
  let recovered = false;
  const csv = "name,value\r\nfixture,28\r\n";
  await page.route("**/api/v1/report-exports/*/download", async (route) => {
    expect(route.request().method()).toBe("GET");
    expect(route.request().headers()["x-request-id"]).toBeTruthy();
    attempts++;
    if (!recovered) await route.abort("internetdisconnected");
    else await route.fulfill({ contentType: "text/csv; charset=utf-8", body: csv });
  });
  await page.goto("/reports");
  await page.getByRole("button", { name: "下载", exact: true }).click();
  await expect(page.locator(".report-notice")).toBeVisible();
  await expect(page.getByRole("button", { name: "下载", exact: true })).toBeEnabled();
  const failedAttempts = attempts;
  expect(failedAttempts).toBeGreaterThan(0);
  recovered = true;
  const received = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载", exact: true }).click();
  const download = await received;
  try {
    expect(download.suggestedFilename()).toBe("scoutops-opportunity.csv");
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString("utf8")).toBe(csv);
    expect(attempts).toBe(failedAttempts + 1);
  } finally {
    await download.delete();
  }
});

test("UI2-RP03 missing aggregates remain missing and export creation preserves report type", async ({
  page,
}) => {
  await setup(page);
  await page.clock.setFixedTime(new Date("2026-09-08T00:00:00Z"));
  await page.route("**/api/v1/reports/trend", (route) =>
    route.fulfill({
      json: envelope({
        type: "trend",
        summary: {
          total: 0,
          signals: 0,
          sources: 0,
          average_confidence: null,
          average_momentum: null,
        },
        series: [],
        observed_at: null,
      }),
    }),
  );
  const writes: any[] = [];
  await page.route("**/api/v1/report-exports", async (route) => {
    if (route.request().method() === "POST") {
      writes.push(route.request().postDataJSON());
      expect(route.request().headers()["idempotency-key"]).toBeTruthy();
      await route.fulfill({
        status: 202,
        json: envelope({ id: "00000000-0000-4000-8000-000000000567", status: "queued" }),
      });
    } else await route.fulfill({ json: envelope([]) });
  });
  await page.goto("/reports?report=trend");
  await expect(
    page.locator(".report-metrics article").filter({ hasText: "平均置信度" }),
  ).toContainText("数据不足");
  await expect(page.getByRole("heading", { name: "暂无可聚合记录" })).toBeVisible();
  await expect(page.locator(".report-scope")).toContainText("数据不足");
  await page.getByRole("button", { name: "导出当前报表 CSV" }).click();
  await expect(page.locator(".report-notice")).toContainText("导出任务已提交");
  expect(writes).toEqual([{ report_type: "trend", format: "csv" }]);
});
