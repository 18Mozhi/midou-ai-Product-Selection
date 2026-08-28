import { test, expect } from "@playwright/test";

const navigation = {
  shell: "platform_admin",
  organization_id: null,
  workspace_id: null,
  roles: [],
  capabilities: [],
  platform_roles: ["platform_operations_admin"],
  platform_capabilities: ["platform:operate", "collection:replay"],
  guard_reason: "navigation_platform_admin_allowed",
};
const ids = {
  task: "00000000-0000-4000-8000-000000000951",
  dead: "00000000-0000-4000-8000-000000000952",
  replay: "00000000-0000-4000-8000-000000000953",
  org: "00000000-0000-4000-8000-000000000961",
  ws: "00000000-0000-4000-8000-000000000971",
};
const tasks = [
  {
    id: ids.task,
    organization_id: ids.org,
    workspace_id: ids.ws,
    status: "completed_with_warnings",
    coverage_status: "partial",
    priority: "high",
    scheduled_at: "2026-08-07T20:00:00.000Z",
    available_at: "2026-08-07T20:00:00.000Z",
    attempt_count: 2,
    successful_subquery_count: 2,
    failed_subquery_count: 1,
    blocked_subquery_count: 0,
    available_result_count: 38,
    missing_fields: ["supplier.moq"],
    last_error_code: "parse_failed",
    replay_of_task_id: null,
    replay_reason: null,
    request_id: "m03-05-task-request",
    trace_id: "m03-05-task-trace",
    version: 8,
    created_at: "2026-08-07T20:00:00.000Z",
    updated_at: "2026-08-07T20:08:00.000Z",
  },
  {
    id: ids.dead,
    organization_id: ids.org,
    workspace_id: ids.ws,
    status: "dead_letter",
    coverage_status: null,
    priority: "critical",
    scheduled_at: "2026-08-07T18:00:00.000Z",
    available_at: "2026-08-07T18:21:00.000Z",
    attempt_count: 4,
    successful_subquery_count: 0,
    failed_subquery_count: 1,
    blocked_subquery_count: 0,
    available_result_count: 0,
    missing_fields: ["market.price"],
    last_error_code: "timeout",
    replay_of_task_id: null,
    replay_reason: null,
    request_id: "m03-05-dead-request",
    trace_id: "m03-05-dead-trace",
    version: 14,
    created_at: "2026-08-07T18:00:00.000Z",
    updated_at: "2026-08-07T18:37:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000954",
    organization_id: ids.org,
    workspace_id: ids.ws,
    status: "running",
    coverage_status: null,
    priority: "normal",
    scheduled_at: "2026-08-07T20:10:00.000Z",
    available_at: "2026-08-07T20:10:00.000Z",
    attempt_count: 1,
    successful_subquery_count: 0,
    failed_subquery_count: 0,
    blocked_subquery_count: 0,
    available_result_count: 0,
    missing_fields: [],
    last_error_code: null,
    replay_of_task_id: null,
    replay_reason: null,
    request_id: "m03-05-run-request",
    trace_id: "m03-05-run-trace",
    version: 3,
    created_at: "2026-08-07T20:10:00.000Z",
    updated_at: "2026-08-07T20:11:00.000Z",
  },
];
const detail = (task = tasks[1]) => ({
  task,
  subqueries: [
    {
      id: "00000000-0000-4000-8000-000000000981",
      provider_id: "00000000-0000-4000-8000-000000000982",
      provider_name: "Market Signals",
      ordinal: 1,
      is_required: true,
      status: "failed",
      available_result_count: 0,
      missing_fields: ["market.price"],
      error_code: "timeout",
      result_kind: null,
      robots_decision: null,
      retryable: false,
      started_at: "2026-08-07T18:21:00.000Z",
      finished_at: "2026-08-07T18:37:00.000Z",
    },
  ],
  attempts: [1, 2, 3, 4].map((attempt_number) => ({
    id: `attempt-${attempt_number}`,
    attempt_number,
    status: attempt_number === 4 ? "dead_letter" : "retry_scheduled",
    error_code: "timeout",
  })),
  events: [
    {
      id: "event-1",
      event_type: "collection.task.dead_letter",
      from_status: "running",
      to_status: "dead_letter",
      occurred_at: "2026-08-07T18:37:00.000Z",
    },
  ],
  dead_letter: {
    id: "dead-1",
    error_code: "timeout",
    status: "open",
    created_at: "2026-08-07T18:37:00.000Z",
  },
});
async function nav(page: any) {
  await page.route("**/api/v1/me/navigation?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: navigation, request_id: "m03-05-nav", trace_id: "m03-05-nav" }),
    }),
  );
}
async function list(page: any, data = tasks) {
  await page.route("**/api/v1/platform/collection/tasks?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data,
        meta: { page: 1, page_size: 50, total: data.length },
        request_id: "m03-05-list",
        trace_id: "m03-05-list",
      }),
    }),
  );
}

test("M03-05.A07/A08/A15 task monitor is responsive and visual", async ({ page }) => {
  await nav(page);
  await list(page);
  await page.goto("/platform-admin/collection");
  await expect(page.getByRole("heading", { name: "采集任务监控", level: 2 })).toBeVisible();
  await expect(page.getByText("部分完成").first()).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: /部分完成 · 38 条证据/ }).click();
    await expect(page.getByText("supplier.moq", { exact: true })).toBeVisible();
    await page.getByText("技术详情").click();
    await expect(page.getByText(ids.task, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "关闭详情" }).last().click();
  } else await expect(page.getByText("缺 supplier.moq", { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("m03-05-collection-tasks.png", { fullPage: true });
});
test("M03-05.A08/A09/A16 dead letter detail requires an explicit confirmed replay reason", async ({
  page,
}) => {
  await nav(page);
  await list(page);
  await page.route(`**/api/v1/platform/collection/tasks/${ids.dead}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: detail(),
        request_id: "m03-05-detail",
        trace_id: "m03-05-detail",
      }),
    }),
  );
  await page.route(`**/api/v1/platform/collection/tasks/${ids.dead}/replay`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: detail({
          ...tasks[1],
          id: ids.replay,
          status: "scheduled",
          attempt_count: 0,
          replay_of_task_id: ids.dead,
          replay_reason: "登录状态与来源连接已恢复",
        }),
        request_id: "m03-05-replay",
        trace_id: "m03-05-replay",
      }),
    }),
  );
  await page.goto("/platform-admin/collection");
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: /死信 · 0 条证据/ }).click();
    await page.getByRole("button", { name: "打开完整任务详情" }).click();
  } else await page.getByRole("button", { name: "查看" }).nth(1).click();
  await expect(page.getByText("Market Signals")).toBeVisible();
  await expect(page.getByText("结果 0 条 · 耗时 16 分 0 秒 · timeout")).toBeVisible();
  await expect(page.getByText("缺失 market.price")).toBeVisible();
  await expect(page.getByRole("region", { name: "建议恢复动作" })).toContainText("填写原因并重放");
  await page
    .getByPlaceholder("说明恢复条件和重放原因（2–500 字）")
    .fill("登录状态与来源连接已恢复");
  await page.getByRole("button", { name: "人工重放" }).click();
  await page.getByPlaceholder("确认重放").fill("确认重放");
  await page.getByRole("button", { name: "确认重放" }).click();
  await expect(page.getByText(/已创建重放任务/)).toBeVisible();
});
test("collection task failures expose a factual recovery destination", async ({ page }) => {
  await nav(page);
  await list(page);
  await page.route(`**/api/v1/platform/collection/tasks/${ids.task}`, (route) =>
    route.fulfill({
      json: {
        data: detail(tasks[0]),
        request_id: "m03-05-warning-detail",
        trace_id: "m03-05-warning-detail",
      },
    }),
  );
  await page.goto(`/platform-admin/collection?task=${ids.task}`);
  const recovery = page.getByRole("region", { name: "建议恢复动作" });
  await expect(recovery).toContainText("查看根因与来源健康");
  await expect(recovery.getByRole("link", { name: "查看根因与来源健康" })).toHaveAttribute(
    "href",
    "/platform-admin/collection/overview",
  );
});
test("RSS subqueries label empty success, parse failure and no new content separately", async ({
  page,
}) => {
  await nav(page);
  await list(page);
  const rssDetail: any = detail(tasks[0]);
  rssDetail.subqueries = [
    {
      ...rssDetail.subqueries[0],
      id: "00000000-0000-4000-8000-000000000983",
      provider_name: "RSS 空频道",
      status: "succeeded_empty",
      error_code: null,
      result_kind: "empty_success",
      robots_decision: {
        decision_version: "scoutops-robots-policy-v1",
        allowed: true,
        decision_basis: "matched_rule",
        robots_url: "https://example.test/robots.txt",
        robots_http_status: 200,
        matched_user_agent: "ScoutOpsPublicCrawler",
        matched_rule: {
          directive: "allow",
          pattern_preview: "/feed/",
          pattern_sha256: "a".repeat(64),
          truncated: false,
        },
      },
    },
    {
      ...rssDetail.subqueries[0],
      id: "00000000-0000-4000-8000-000000000984",
      provider_name: "RSS 增量频道",
      status: "succeeded_empty",
      error_code: null,
      result_kind: "no_new_content",
    },
    {
      ...rssDetail.subqueries[0],
      id: "00000000-0000-4000-8000-000000000985",
      provider_name: "RSS 异常频道",
      status: "failed",
      error_code: "parse_failed",
      result_kind: "parse_failed",
    },
  ];
  await page.route(`**/api/v1/platform/collection/tasks/${ids.task}`, (route) =>
    route.fulfill({
      json: {
        data: rssDetail,
        request_id: "m03-05-rss-result-kind",
        trace_id: "m03-05-rss-result-kind",
      },
    }),
  );
  await page.goto(`/platform-admin/collection?task=${ids.task}`);
  await expect(page.getByText("空成功：来源响应有效，但没有可解析条目")).toBeVisible();
  await expect(page.getByText("无新内容：本次结果均已存在，未重复写入")).toBeVisible();
  await expect(page.getByText("解析失败：来源载荷未通过当前解析合同")).toBeVisible();
  await expect(page.getByText("robots 判定：允许 · Allow /feed/")).toBeVisible();
  await page.getByText("robots 判定：允许 · Allow /feed/").click();
  await expect(page.getByText(/判定版本 scoutops-robots-policy-v1/)).toBeVisible();
});
test("M03-05.A08/A09/A16 empty forbidden and dependency states are truthful", async ({ page }) => {
  await nav(page);
  let status = 200;
  await page.route("**/api/v1/platform/collection/tasks?**", (route) =>
    route.fulfill(
      status === 200
        ? {
            status,
            contentType: "application/json",
            body: JSON.stringify({
              data: [],
              meta: { page: 1, page_size: 50, total: 0 },
              request_id: "m03-05-empty",
              trace_id: "m03-05-empty",
            }),
          }
        : {
            status,
            contentType: "application/json",
            body: JSON.stringify({
              error: {
                code: status === 403 ? "authorization_denied" : "dependency_unavailable",
                message: "请求失败",
                action_hint: "按状态恢复",
              },
              request_id: `m03-05-${status}`,
              trace_id: `m03-05-${status}`,
            }),
          },
    ),
  );
  await page.goto("/platform-admin/collection");
  await expect(page.locator('[data-kind="empty"]')).toBeVisible();
  status = 403;
  await page.reload();
  await expect(page.locator('[data-kind="forbidden"]')).toBeVisible();
  status = 503;
  await page.reload();
  await expect(page.locator('[data-kind="blocked"]')).toBeVisible();
});

test("collection queue paginates all records and preserves accessible detail context", async ({
  page,
}) => {
  await nav(page);
  const pageOne = Array.from({ length: 50 }, (_, index) => ({
    ...tasks[0],
    id: `00000000-0000-4000-8000-${String(index + 1000).padStart(12, "0")}`,
    request_id: `m03-05-page-${index + 1}`,
  }));
  await page.route("**/api/v1/platform/collection/tasks?**", (route) => {
    const requestedPage = new URL(route.request().url()).searchParams.get("page");
    const data = requestedPage === "2" ? [tasks[1]] : pageOne;
    return route.fulfill({
      json: {
        data,
        meta: { page: Number(requestedPage), page_size: 50, total: 51 },
        request_id: `m03-05-page-${requestedPage}`,
        trace_id: `m03-05-page-${requestedPage}`,
      },
    });
  });
  await page.route(`**/api/v1/platform/collection/tasks/${ids.dead}`, (route) =>
    route.fulfill({
      json: {
        data: detail(),
        request_id: "m03-05-page-detail",
        trace_id: "m03-05-page-detail",
      },
    }),
  );
  await page.goto("/platform-admin/collection");
  await expect(page.getByRole("navigation", { name: "采集任务分页" })).toContainText("第 1 / 2 页");
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("本页 1 条")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "筛选当前页采集任务" })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: /死信 · 0 条证据/ }).click();
    await page.getByRole("button", { name: "打开完整任务详情" }).click();
  } else await page.getByRole("button", { name: "查看" }).click();
  await expect(page).toHaveURL(new RegExp(`page=2.*task=${ids.dead}|task=${ids.dead}.*page=2`));
  const dialog = page.getByRole("dialog", { name: `任务 ${ids.dead.slice(0, 8)}…` });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭任务详情" })).toBeFocused();
  await page.reload();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/page=2/);
  await expect(page).not.toHaveURL(/task=/);
});

test("detail read failure never leaves the previous task visible", async ({ page }) => {
  await nav(page);
  await list(page);
  let fail = false;
  await page.route("**/api/v1/platform/collection/tasks/*", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: {
            error: {
              code: "dependency_unavailable",
              message: "详情依赖不可用",
              action_hint: "稍后重试详情读取。",
            },
            request_id: "m03-05-detail-failed",
            trace_id: "m03-05-detail-failed",
          },
        })
      : route.fulfill({
          json: {
            data: detail(tasks[0]),
            request_id: "m03-05-detail-ready",
            trace_id: "m03-05-detail-ready",
          },
        }),
  );
  await page.goto("/platform-admin/collection");
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: /部分完成 · 38 条证据/ }).click();
    await page.getByRole("button", { name: "打开完整任务详情" }).click();
  } else await page.getByRole("button", { name: "查看" }).first().click();
  await expect(page.getByRole("dialog")).toContainText(tasks[0].id.slice(0, 8));
  await page.getByRole("button", { name: "关闭任务详情" }).click();
  fail = true;
  if ((page.viewportSize()?.width ?? 1000) <= 760) {
    await page.getByRole("button", { name: /死信 · 0 条证据/ }).click();
    await page.getByRole("button", { name: "打开完整任务详情" }).click();
  } else await page.getByRole("button", { name: "查看" }).nth(1).click();
  await expect(page.getByRole("alert")).toContainText("任务详情未能读取");
  await expect(page.getByRole("dialog")).not.toContainText(tasks[0].id.slice(0, 8));
});
