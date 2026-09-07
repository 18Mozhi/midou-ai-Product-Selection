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
    title:
      "Wallet Case for iPhone 16,RFID Blocking,Crossbody,Purple | 8 Card Slots|Magnetic|Kickstand|Detachable Wallet",
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
async function setup(
  page: Page,
  capabilities = ["task:read", "task:create", "competitor:read", "competitor:manage"],
) {
  await page.route("**/api/v1/me/navigation?shell=member", (r) =>
    r.fulfill({
      json: envelope({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000501",
        workspace_id: "00000000-0000-4000-8000-000000000502",
        roles: ["member"],
        capabilities,
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
          revision: 1,
          updated_at: "2026-08-08T12:01:01.000Z",
        },
      ]),
    }),
  );
  await page.route("**/api/v1/competitors", (r) => r.fulfill({ json: envelope([item]) }));
  await page.route(`**/api/v1/competitors/${id}`, (r) =>
    r.fulfill({
      json: envelope({
        ...item,
        latest_collection: {
          task_id: "00000000-0000-4000-8000-000000000511",
          status: "succeeded",
          last_error_code: null,
          attempt_count: 1,
          available_result_count: 1,
          updated_at: "2026-08-08T12:01:01.000Z",
        },
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
  await expect(
    page.getByRole("heading", { name: "竞品变化正在持续进入竞争证据链", level: 2 }),
  ).toBeVisible();
  const readiness = page.getByLabel("竞争质量门 · 证据就绪");
  await expect(readiness.getByText("1 / 1")).toBeVisible();
  await expect(readiness.getByText("2 份")).toBeVisible();
  await expect(readiness.getByText("1 条启用")).toBeVisible();
  await expect(page.getByRole("heading", { name: "添加竞品监控" })).toBeVisible();
  await expect(page.getByLabel("添加竞品步骤").getByText("1 商品链接")).toHaveAttribute(
    "aria-current",
    "step",
  );
  await page.getByRole("button", { name: "关闭新建竞品" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page
        .locator(".competitor-list b")
        .first()
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true);
  await expect(page.locator(".competitor-guide")).not.toHaveAttribute("open");
  await page.getByRole("button", { name: /Wallet Case for iPhone 16/ }).click();
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
  await expect(dialog.getByLabel("市场")).toHaveAttribute("pattern", "[A-Za-z0-9._-]+");
  await expect(dialog.getByLabel("市场")).toHaveAttribute("maxlength", "40");
  await expect(dialog.getByLabel("关联机会编号（可选）")).toHaveAttribute("maxlength", "36");
  await expect(dialog.getByLabel("监控名称")).toHaveAttribute("maxlength", "500");
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

test("initial selection loads full snapshot history and empty search can be reset", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/competitors");
  await expect(
    page.getByLabel("价格与库存时间轴").getByText("缺货 · 评分 4.6 · 评论 825"),
  ).toBeVisible();
  await page.getByLabel("搜索竞品").fill("不存在的 ASIN");
  await expect(page.getByRole("heading", { name: "没有匹配的竞品" })).toBeVisible();
  await page.getByRole("button", { name: "清空搜索" }).click();
  await expect(page.getByRole("button", { name: /Wallet Case for iPhone 16/ })).toBeVisible();
});

test("auditor keeps full read detail but does not receive competitor write controls", async ({
  page,
}) => {
  await setup(page, ["task:read", "competitor:read"]);
  await page.goto("/competitors?create=1");
  await expect(page.getByRole("heading", { name: item.title })).toBeVisible();
  await expect(page.getByRole("button", { name: "添加竞品监控" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "立即采集" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "暂停监控" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "删除竞品监控" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "添加竞品监控" })).toHaveCount(0);
});

test("queued first collection refreshes the selected detail until a real snapshot arrives", async ({
  page,
}) => {
  await setup(page);
  await page.unroute("**/api/v1/competitors");
  await page.unroute(`**/api/v1/competitors/${id}`);
  const pending = { ...item, snapshot_count: 0, latest_snapshot: null };
  let detailReads = 0;
  await page.route("**/api/v1/competitors", (route) =>
    route.fulfill({ json: envelope([pending]) }),
  );
  await page.route(`**/api/v1/competitors/${id}`, (route) => {
    detailReads += 1;
    route.fulfill({
      json: envelope(
        detailReads === 1
          ? {
              ...pending,
              latest_collection: {
                task_id: "00000000-0000-4000-8000-000000000511",
                status: "queued",
                last_error_code: null,
                attempt_count: 0,
                available_result_count: 0,
                updated_at: "2026-08-08T12:00:00.000Z",
              },
              snapshots: [],
              changes: [],
              alerts: [],
            }
          : {
              ...item,
              latest_collection: {
                task_id: "00000000-0000-4000-8000-000000000511",
                status: "succeeded",
                last_error_code: null,
                attempt_count: 1,
                available_result_count: 1,
                updated_at: "2026-08-08T12:01:01.000Z",
              },
              snapshots: [item.latest_snapshot],
              changes: [],
              alerts: [],
            },
      ),
    });
  });
  await page.goto("/competitors");
  await expect(page.getByText("已排队", { exact: true })).toBeVisible();
  await expect(page.getByText("USD 26.99").first()).toBeVisible({ timeout: 5_000 });
  expect(detailReads).toBeGreaterThanOrEqual(2);
});

test("manual collection keeps polling when the first detail read still points at the previous task", async ({
  page,
}) => {
  await setup(page);
  await page.unroute(`**/api/v1/competitors/${id}`);
  const previousTask = "00000000-0000-4000-8000-000000000511",
    currentTask = "00000000-0000-4000-8000-000000000512";
  let detailReads = 0;
  await page.route(`**/api/v1/competitors/${id}/collect`, (route) =>
    route.fulfill({ json: envelope({ task_id: currentTask, status: "scheduled" }) }),
  );
  await page.route(`**/api/v1/competitors/${id}`, (route) => {
    detailReads += 1;
    const completed = detailReads >= 3;
    return route.fulfill({
      json: envelope({
        ...item,
        snapshot_count: completed ? 3 : 2,
        latest_collection: {
          task_id: completed ? currentTask : previousTask,
          status: "succeeded",
          last_error_code: null,
          attempt_count: 1,
          available_result_count: 1,
          updated_at: completed ? "2026-08-08T12:03:00.000Z" : "2026-08-08T12:01:01.000Z",
        },
        snapshots: completed
          ? [
              {
                ...item.latest_snapshot,
                id: "00000000-0000-4000-8000-000000000513",
                current_price: 25.99,
              },
              item.latest_snapshot,
              baseline,
            ]
          : [item.latest_snapshot, baseline],
        changes: [],
        alerts: [],
      }),
    });
  });
  await page.goto("/competitors");
  await page.getByRole("button", { name: "立即采集" }).click();
  await expect(page.getByRole("button", { name: "采集中…" })).toBeDisabled();
  await expect(page.getByText("USD 25.99").first()).toBeVisible({ timeout: 7_000 });
  expect(detailReads).toBeGreaterThanOrEqual(3);
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
  await expect(page).toHaveURL("/competitors/monitoring-rules");
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  await expect(page.getByLabel("竞品监控规则列表").getByText("价格 · 减少 USD 2")).toBeVisible();
  await expect(page.getByLabel("竞品监控规则列表").getByText("已生效")).toBeVisible();
  await expect(page.getByText("更新于 2026/08/08 20:01 · 版本 1")).toBeVisible();
  await expect(page.getByRole("link", { name: "返回竞品列表" })).toHaveAttribute(
    "href",
    "/competitors",
  );

  await page.goto(`/competitors/monitoring-rules?competitor=${id}`);
  await page.getByRole("button", { name: "启用规则" }).click();
  await expect(page).toHaveURL("/competitors/monitoring-rules");
  await expect(page.getByText("监控阈值已启用。")).toBeVisible();
});

test("monitoring rule form only offers directions accepted by the selected metric", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/competitors/monitoring-rules");
  await page.getByRole("button", { name: "新建监控规则" }).click();
  const metric = page.getByLabel("指标"),
    direction = page.getByLabel("方向");
  await metric.selectOption("availability");
  await expect(direction).toHaveValue("change");
  await expect(direction.locator("option")).toHaveText(["任意变化", "变为缺货"]);
  await direction.selectOption("became_unavailable");
  await metric.selectOption("price");
  await expect(direction).toHaveValue("change");
  await expect(direction.locator('option[value="became_unavailable"]')).toHaveCount(0);
});

test("monitoring rules API failure is not presented as an empty rule list", async ({ page }) => {
  await setup(page);
  await page.unroute("**/api/v1/competitor-monitor-rules");
  await page.route("**/api/v1/competitor-monitor-rules", (route) =>
    route.fulfill({
      status: 500,
      json: {
        error: {
          code: "rule_read_failed",
          message: "rule_read_failed",
          action_hint: "规则读取失败",
        },
        request_id: "rule-read-failed-request",
        trace_id: "rule-read-failed-trace",
      },
    }),
  );
  await page.goto("/competitors/monitoring-rules");
  await expect(page.getByText("规则读取失败")).toBeVisible();
  await expect(page.getByText("尚未配置监控规则")).toHaveCount(0);
});

test("auditor can read monitoring rules without receiving rule write controls", async ({
  page,
}) => {
  await setup(page, ["task:read", "competitor:read"]);
  await page.goto(`/competitors/monitoring-rules?competitor=${id}`);
  await expect(page.getByLabel("竞品监控规则列表").getByText("已生效")).toBeVisible();
  await expect(page.getByRole("button", { name: "新建监控规则" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "新建监控规则" })).toHaveCount(0);
});

function competitorWrites(page: Page) {
  const writes: Array<{ method: string; path: string; body: unknown; key: string | undefined }> =
    [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      request.method() === "GET" ||
      !/^\/api\/v1\/(competitors|competitor-monitor-rules|tasks)(\/|$)/.test(path)
    )
      return;
    writes.push({
      method: request.method(),
      path,
      body: request.postDataJSON(),
      key: request.headers()["idempotency-key"],
    });
  });
  return writes;
}

const writeFailure = {
  error: {
    code: "competitor_revision_conflict",
    message: "revision conflict",
    action_hint: "复核后重试本次操作",
  },
  request_id: "competitor-write-conflict",
  trace_id: "competitor-write-trace",
};

test("UI2-CP01 creation cancellation keeps local fields and failed submission retries the exact contract", async ({
  page,
}) => {
  await setup(page);
  const writes = competitorWrites(page);
  let attempts = 0;
  await page.route("**/api/v1/competitors", (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: envelope([item]) });
    attempts += 1;
    return attempts === 1
      ? route.fulfill({ status: 409, json: writeFailure })
      : route.fulfill({
          status: 201,
          json: envelope({ id, task_id: "00000000-0000-4000-8000-000000000511" }),
        });
  });
  await page.goto("/competitors");
  await page.getByRole("button", { name: "添加竞品监控", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "添加竞品监控" });
  const url = "https://www.amazon.com/dp/B0SCOUTOPS";
  await dialog.getByLabel("商品网址").fill(url);
  await dialog.getByRole("button", { name: "下一步" }).click();
  await dialog.getByLabel("监控名称").fill("本地草稿竞品");
  await dialog.getByRole("button", { name: "关闭新建竞品" }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "添加竞品监控", exact: true }).click();
  await expect(dialog.getByLabel("商品网址")).toHaveValue(url);
  await dialog.getByRole("button", { name: "下一步" }).click();
  await expect(dialog.getByLabel("监控名称")).toHaveValue("本地草稿竞品");
  await dialog.getByRole("button", { name: "下一步" }).click();
  expect(writes).toEqual([]);
  await dialog.getByRole("button", { name: "确认并开始采集" }).click();
  await expect(dialog.getByRole("alert")).toContainText("复核后重试本次操作");
  await expect(dialog.getByText("3 确认采集")).toHaveAttribute("aria-current", "step");
  await expect(dialog.getByText("本地草稿竞品")).toBeVisible();
  expect(writes).toHaveLength(1);
  await dialog.getByRole("button", { name: "确认并开始采集" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("竞品已建立");
  expect(writes).toHaveLength(2);
  for (const write of writes) {
    expect(write.method).toBe("POST");
    expect(write.path).toBe("/api/v1/competitors");
    expect(write.body).toEqual({ market: "US", product_url: url, title: "本地草稿竞品" });
    expect(write.key).toBeTruthy();
  }
});

for (const ruleCase of [
  { metric: "availability", direction: "became_unavailable", target: id, threshold: null },
  { metric: "rank", direction: "increase", target: "", threshold: 0.25 },
]) {
  test(`UI2-CP02 ${ruleCase.metric} rule preserves failed input and sends only supported fields`, async ({
    page,
  }) => {
    await setup(page);
    const writes = competitorWrites(page);
    let attempts = 0;
    await page.route("**/api/v1/competitor-monitor-rules", (route) => {
      if (route.request().method() === "GET") return route.fallback();
      attempts += 1;
      return attempts === 1
        ? route.fulfill({ status: 409, json: writeFailure })
        : route.fulfill({
            status: 201,
            json: envelope({
              id: "00000000-0000-4000-8000-000000000508",
              status: "enabled",
              revision: 1,
            }),
          });
    });
    await page.goto("/competitors/monitoring-rules");
    await expect(page.getByRole("heading", { name: "监控规则", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "新建监控规则", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "新建监控规则" });
    await dialog.getByLabel("竞品（留空为工作区全局）").selectOption(ruleCase.target);
    await dialog.getByLabel("指标").selectOption(ruleCase.metric);
    await dialog.getByLabel("方向").selectOption(ruleCase.direction);
    if (ruleCase.threshold === null)
      await expect(dialog.getByLabel("阈值", { exact: true })).toHaveCount(0);
    else await dialog.getByLabel("阈值", { exact: true }).fill(String(ruleCase.threshold));
    await dialog.getByRole("button", { name: "启用规则" }).click();
    await expect(dialog.getByRole("alert")).toContainText("复核后重试本次操作");
    await expect(dialog.getByLabel("指标")).toHaveValue(ruleCase.metric);
    await expect(dialog.getByLabel("方向")).toHaveValue(ruleCase.direction);
    await expect(dialog.getByLabel("竞品（留空为工作区全局）")).toHaveValue(ruleCase.target);
    expect(writes).toHaveLength(1);
    await dialog.getByRole("button", { name: "启用规则" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("监控阈值已启用");
    expect(writes).toHaveLength(2);
    for (const write of writes) {
      expect(write.method).toBe("POST");
      expect(write.path).toBe("/api/v1/competitor-monitor-rules");
      expect(write.body).toEqual({
        competitor_id: ruleCase.target || null,
        metric: ruleCase.metric,
        direction: ruleCase.direction,
        ...(ruleCase.threshold === null ? {} : { threshold_value: ruleCase.threshold }),
      });
      expect(write.key).toBeTruthy();
    }
  });
}

test("UI2-CP03 delete cancellation writes nothing and conflict retains the trimmed reason contract", async ({
  page,
}) => {
  await setup(page);
  const writes = competitorWrites(page);
  await page.route(`**/api/v1/competitors/${id}`, (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({ status: 409, json: writeFailure })
      : route.fallback(),
  );
  await page.goto("/competitors");
  await expect(page.getByRole("heading", { name: item.title })).toBeVisible();
  const more = page.locator(".competitor-mobile-actions summary");
  if (await more.isVisible()) await more.click();
  await page.getByRole("button", { name: "删除竞品监控", exact: true }).click();
  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: "删除竞品监控" }) });
  await dialog.getByLabel("删除原因").fill("取消的原因");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "删除竞品监控", exact: true }).click();
  await expect(dialog.getByLabel("删除原因")).toHaveValue("");
  await dialog.getByLabel("删除原因").fill("  不再跟踪该竞品  ");
  await dialog.getByRole("button", { name: "确认删除" }).click();
  await expect(dialog.getByRole("alert")).toContainText("复核后重试本次操作");
  await expect(dialog.getByLabel("删除原因")).toHaveValue("  不再跟踪该竞品  ");
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    method: "DELETE",
    path: `/api/v1/competitors/${id}`,
    body: { expected_revision: 2, reason: "不再跟踪该竞品" },
  });
  expect(writes[0]?.key).toBeTruthy();
  await dialog.getByRole("button", { name: "关闭删除确认" }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toHaveLength(1);
});

test("UI2-CP04 paused monitoring cannot collect and resume uses the current revision", async ({
  page,
}) => {
  await setup(page);
  const writes = competitorWrites(page);
  const paused = { ...item, status: "paused", revision: 7 };
  await page.route("**/api/v1/competitors", (route) => route.fulfill({ json: envelope([paused]) }));
  await page.route(`**/api/v1/competitors/${id}`, (route) =>
    route.fulfill({ json: envelope(paused) }),
  );
  await page.route(`**/api/v1/competitors/${id}/actions`, (route) =>
    route.fulfill({ status: 409, json: writeFailure }),
  );
  await page.goto("/competitors");
  await expect(page.getByRole("button", { name: "恢复后可采集" })).toBeDisabled();
  const more = page.locator(".competitor-mobile-actions summary");
  if (await more.isVisible()) await more.click();
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "恢复监控", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("复核后重试本次操作");
  await expect(page.getByRole("button", { name: "恢复后可采集" })).toBeDisabled();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    method: "POST",
    path: `/api/v1/competitors/${id}/actions`,
    body: { status: "active", expected_revision: 7 },
  });
});

test("UI2-CP05 rule cancellation clears the deep-link target and resets the next new rule", async ({
  page,
}) => {
  await setup(page);
  const writes = competitorWrites(page);
  await page.goto(`/competitors/monitoring-rules?competitor=${id}`);
  const dialog = page.getByRole("dialog", { name: "新建监控规则" });
  await expect(dialog.getByLabel("竞品（留空为工作区全局）")).toHaveValue(id);
  await dialog.getByLabel("指标").selectOption("availability");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page).toHaveURL("/competitors/monitoring-rules");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "新建监控规则", exact: true }).click();
  await expect(dialog.getByLabel("竞品（留空为工作区全局）")).toHaveValue("");
  await expect(dialog.getByLabel("指标")).toHaveValue("price");
  await expect(dialog.getByLabel("方向")).toHaveValue("decrease");
  await expect(dialog.getByLabel("阈值", { exact: true })).toHaveValue("1");
  await dialog.getByRole("button", { name: "关闭告警规则" }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("UI2-CP06 task creation uses change evidence and its own permission without competitor management", async ({
  page,
}) => {
  await setup(page, ["task:read", "task:create", "competitor:read"]);
  const writes = competitorWrites(page);
  const taskId = "00000000-0000-4000-8000-000000000520";
  await page.route("**/api/v1/tasks", (route) =>
    route.fulfill({
      status: 201,
      json: envelope({ id: taskId, title: route.request().postDataJSON().title }),
    }),
  );
  await page.goto("/competitors");
  await expect(page.getByRole("heading", { name: item.title })).toBeVisible();
  await expect(page.getByRole("button", { name: "立即采集", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "删除竞品监控", exact: true })).toHaveCount(0);
  const event = page
    .getByLabel("竞品处理时间轴")
    .locator("article")
    .filter({ hasText: "USD 29.99 → 26.99" });
  await event.getByRole("button", { name: "生成验证任务" }).click();
  await expect(event.getByRole("link", { name: "打开验证任务" })).toHaveAttribute(
    "href",
    `/tasks?task=${taskId}`,
  );
  await expect(event.getByRole("button", { name: "生成验证任务" })).toHaveCount(0);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    method: "POST",
    path: "/api/v1/tasks",
    body: {
      title: `复核竞品变化 · 当前价格 · ${item.title}`.slice(0, 200),
      description: `核验竞品 ${id} 的变化事件 c1。\n字段：当前价格\n变化：USD 29.99 → 26.99\n证据：${item.latest_snapshot.evidence_id}\n采集时间：2026-08-08T12:01:00.000Z\n请核对原始证据后记录结论，不覆盖竞品快照历史。`,
      priority: "high",
      due_at: null,
    },
  });
  expect(writes[0]?.key).toBeTruthy();
});
