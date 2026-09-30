import { expect, test, type Page, type Request } from "@playwright/test";
import type {
  TrendDetail,
  TrendRule,
  TrendTopicChangeRequest,
} from "../../apps/web/src/components/trend-workspace-types";

// Local real-Vue contract fixtures. No production, SQL, crawler or actual governance execution.
const id = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const topicId = id(404),
  ruleId = id(405),
  signalId = id(406),
  issueId = id(412);
const at = "2026-08-07T14:05:00.000Z";
const envelope = (data: unknown, meta?: unknown) => ({
  data,
  ...(meta ? { meta } : {}),
  request_id: "ui2-trend-request",
  trace_id: "ui2-trend-trace",
});
function fixture() {
  const detail: TrendDetail = {
    id: topicId,
    title: "AI 护肤观察主题",
    category: "beauty",
    market: "US",
    language: "en-US",
    status: "active",
    signal_count: 2,
    source_count: 1,
    heat: { value: 2, unit: "signals" },
    momentum_percent: null,
    confidence: { score: null, status: "insufficient_data" },
    first_seen_at: at,
    last_seen_at: at,
    source_fresh_at: at,
    followed: false,
    version: 3,
    keywords: [],
    timeline: [{ at, signal_count: 2, source_count: 1 }],
    timeline_sources: [],
    evidence: [406, 409].map((n) => ({
      id: id(n),
      title: `隔离证据 ${n}`,
      publisher: "Example News",
      canonical_url: `https://example.test/news/${n}`,
      published_at: at,
      observed_at: at,
      provider_id: id(407),
      raw_evidence_id: id(n + 100),
    })),
    data_quality: { coverage_status: "covered", evidence_count: 2, source_count: 1, stale: false },
    relevance_history: [],
  };
  const rule: TrendRule = {
    id: ruleId,
    name: "隔离趋势规则",
    include_keywords: ["ai skincare", "beauty"],
    negative_keywords: [],
    market: "US",
    language: "en-US",
    category: "beauty",
    notification_channel: "in_app",
    collection_interval_minutes: 180,
    recommendation_min_source_count: 3,
    status: "enabled",
    last_evaluated_at: null,
    last_collection_at: null,
    next_collection_at: null,
    last_collection_task_id: null,
    last_failed_sources: [],
    version: 4,
    updated_at: at,
  };
  const changes: TrendTopicChangeRequest[] = [];
  return { detail, rule, changes, writes: [] as Request[] };
}
type Fixture = ReturnType<typeof fixture>;
async function ready(page: Page, capabilities = ["task:read", "trend:read", "trend:manage"]) {
  const data = fixture();
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1/trends") && request.method() !== "GET")
      data.writes.push(request);
  });
  await page.route("**/api/v1/me/ui-preferences", (route) =>
    route.fulfill({ json: envelope({ theme: "deep-ocean", version: 1 }) }),
  );
  await page.route("**/api/v1/me/navigation?shell=member", (route) =>
    route.fulfill({
      json: envelope({
        shell: "member",
        organization_id: id(401),
        workspace_id: id(402),
        roles: ["member"],
        capabilities,
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/trends**", (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (request.method() !== "GET")
      return route.fulfill({ status: 500, json: { error: { code: "unexpected_test_write" } } });
    const value = url.pathname.endsWith("/monitoring-rules")
      ? [data.rule]
      : url.pathname.endsWith("/change-requests")
        ? data.changes
        : url.pathname.endsWith(`/${topicId}`)
          ? data.detail
          : [data.detail];
    return route.fulfill({ json: envelope(value, { page: 1, page_size: 20, total: 1 }) });
  });
  return data;
}
async function openDetail(page: Page) {
  await page.goto(`/trends?topic=${topicId}`);
  await expect(page.locator(".trend-detail")).toBeVisible();
  await expect(page.locator(".trend-detail")).toHaveAttribute("aria-busy", "false");
}
function assertWrite(request: Request, method: string, path: string, body: unknown) {
  expect(request.method()).toBe(method);
  expect(new URL(request.url()).pathname).toBe(`/api/v1${path}`);
  if (body === null) expect(request.postData()).toBeNull();
  else expect(request.postDataJSON()).toEqual(body);
  for (const header of ["idempotency-key", "x-request-id", "x-trace-id"])
    expect(request.headers()[header]).toMatch(/^[0-9a-f-]{36}$/);
}
function change(data: Fixture): TrendTopicChangeRequest {
  return {
    id: id(414),
    operation: "split",
    target_topic: data.detail,
    source_topics: [],
    signal_ids: [signalId],
    new_title: "单独观察",
    new_category: null,
    reason: "证据应单独核对",
    status: "pending",
    result_topic_id: null,
    proposed_by: id(415),
    decided_by: null,
    decision_reason: null,
    decided_at: null,
    version: 2,
    created_at: at,
    updated_at: at,
  };
}

test("UI2-TR01 follow and unfollow preserve bodyless methods and returned state", async ({
  page,
}) => {
  const data = await ready(page);
  await page.route(`**/api/v1/trends/${topicId}/follow`, (route) => {
    data.detail.followed = route.request().method() === "PUT";
    return route.fulfill({ json: envelope({ topic_id: topicId, followed: data.detail.followed }) });
  });
  await openDetail(page);
  await page.getByRole("button", { name: "关注", exact: true }).click();
  await page.getByRole("button", { name: "已关注", exact: true }).click();
  await expect(page.getByRole("button", { name: "关注", exact: true })).toBeVisible();
  expect(data.writes).toHaveLength(2);
  assertWrite(data.writes[0], "PUT", `/trends/${topicId}/follow`, null);
  assertWrite(data.writes[1], "DELETE", `/trends/${topicId}/follow`, null);
  expect(data.writes[0].headers()["idempotency-key"]).not.toBe(
    data.writes[1].headers()["idempotency-key"],
  );
});

test("UI2-TR follow completion updates the topic that started the request", async ({ page }) => {
  const data = await ready(page);
  const secondTopicId = id(417);
  const secondTopic = { ...data.detail, id: secondTopicId, title: "另一条观察主题" };
  await page.route("**/api/v1/trends**", async (route) => {
    const request = route.request();
    if (request.method() !== "GET") return route.fallback();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith("/monitoring-rules"))
      return route.fulfill({ json: envelope([data.rule]) });
    if (pathname.endsWith("/change-requests"))
      return route.fulfill({ json: envelope(data.changes) });
    if (pathname === `/api/v1/trends/${topicId}`)
      return route.fulfill({ json: envelope(data.detail) });
    if (pathname === `/api/v1/trends/${secondTopicId}`)
      return route.fulfill({ json: envelope(secondTopic) });
    if (pathname === "/api/v1/trends")
      return route.fulfill({
        json: envelope([data.detail, secondTopic], { page: 1, page_size: 20, total: 2 }),
      });
    return route.fallback();
  });

  let releaseFollow!: () => void;
  let markFollowStarted!: () => void;
  const followStarted = new Promise<void>((resolve) => (markFollowStarted = resolve));
  const followPending = new Promise<void>((resolve) => (releaseFollow = resolve));
  await page.route(`**/api/v1/trends/${topicId}/follow`, async (route) => {
    markFollowStarted();
    await followPending;
    await route.fulfill({ json: envelope({ topic_id: topicId, followed: true }) });
  });

  await openDetail(page);
  await page.getByRole("button", { name: "关注", exact: true }).click();
  await followStarted;
  if ((page.viewportSize()?.width ?? 0) <= 1100)
    await page.getByRole("button", { name: "返回趋势列表" }).click();
  await page
    .locator(".trend-list")
    .getByRole("button", { name: /另一条观察主题/ })
    .click();
  await expect(page.locator(".trend-detail")).toContainText("另一条观察主题");
  await expect(page.locator(".trend-detail").getByRole("button", { name: "关注" })).toBeVisible();

  releaseFollow();
  await expect(page.locator(".trend-detail").getByRole("button", { name: "关注" })).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) <= 1100)
    await page.getByRole("button", { name: "返回趋势列表" }).click();
  const firstRow = page.locator(".trend-list").getByRole("button", { name: /AI 护肤观察主题/ });
  const secondRow = page.locator(".trend-list").getByRole("button", { name: /另一条观察主题/ });
  await expect(firstRow).toContainText("已关注");
  await expect(secondRow).not.toContainText("已关注");
  expect(data.writes).toHaveLength(1);
  assertWrite(data.writes[0], "PUT", `/trends/${topicId}/follow`, null);
});

test("UI2-TR02 relevance cancel writes nothing and restore uses the refreshed version", async ({
  page,
}) => {
  const data = await ready(page);
  await page.route(`**/api/v1/trends/${topicId}/relevance`, (route) => {
    const body = route.request().postDataJSON();
    data.detail.status = body.status;
    data.detail.version += 1;
    data.detail.relevance_history.push({
      status: body.status,
      reason: body.reason,
      actor_id: id(415),
      version: data.detail.version,
      occurred_at: at,
    });
    return route.fulfill({ json: envelope(data.detail) });
  });
  await openDetail(page);
  await page.getByRole("button", { name: "标记无关", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "标记为无关" });
  await expect(modal.getByRole("button", { name: "确认并记录" })).toBeDisabled();
  await modal.getByLabel("变更原因").fill("取消这次输入");
  await modal.getByRole("button", { name: "取消", exact: true }).click();
  expect(data.writes).toHaveLength(0);
  await page.getByRole("button", { name: "标记无关", exact: true }).click();
  await expect(modal.getByLabel("变更原因")).toHaveValue("");
  await modal.getByLabel("变更原因").fill("  与当前研究无关  ");
  await modal.getByRole("button", { name: "确认并记录" }).click();
  await expect(modal).toBeHidden();
  await page.getByRole("button", { name: "恢复为相关", exact: true }).click();
  const restore = page.getByRole("dialog", { name: "恢复为相关" });
  await restore.getByLabel("变更原因").fill("  已补充相关证据  ");
  await restore.getByRole("button", { name: "确认并记录" }).click();
  await expect(restore).toBeHidden();
  await expect(page.getByRole("button", { name: "标记无关", exact: true })).toBeVisible();
  expect(data.writes).toHaveLength(2);
  assertWrite(data.writes[0], "POST", `/trends/${topicId}/relevance`, {
    status: "irrelevant",
    reason: "与当前研究无关",
    expected_version: 3,
  });
  assertWrite(data.writes[1], "POST", `/trends/${topicId}/relevance`, {
    status: "active",
    reason: "已补充相关证据",
    expected_version: 4,
  });
});

test("UI2-TR02 relevance dialog traps focus, Escape closes, and focus returns to its opener", async ({
  page,
}) => {
  await ready(page);
  await openDetail(page);
  const trigger = page.getByRole("button", { name: "标记无关", exact: true });
  await trigger.click();
  const modal = page.getByRole("dialog", { name: "标记为无关" });
  const reason = modal.getByLabel("变更原因");
  await reason.fill("与当前研究范围无关");

  expect(await modal.evaluate((element) => element.matches(":modal"))).toBe(true);
  await expect(reason).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(modal.getByRole("button", { name: "取消", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(modal.getByRole("button", { name: "确认并记录" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(modal.getByRole("button", { name: "关闭相关性变更" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(reason).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(modal.getByRole("button", { name: "关闭相关性变更" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(modal.getByRole("button", { name: "确认并记录" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("UI2-TR04 rule dialog uses native modal focus lifecycle", async ({ page }) => {
  await ready(page);
  await page.goto("/trends?section=rules");
  const trigger = page.getByRole("button", { name: "＋ 创建规则", exact: true });
  await trigger.click();
  const modal = page.getByRole("dialog", { name: "创建趋势监控", exact: true });
  const name = modal.getByLabel("规则名称", { exact: true });
  expect(await modal.evaluate((element) => element.matches(":modal"))).toBe(true);
  await expect(name).toBeFocused();
  const close = modal.getByRole("button", { name: "关闭", exact: true });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(modal.getByRole("button", { name: "创建并启用" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("UI2-TR02 anomaly dialog uses native modal focus lifecycle", async ({ page }) => {
  await ready(page);
  await openDetail(page);
  const evidence = page.locator(".trend-evidence-item").filter({ hasText: "隔离证据 406" });
  const trigger = evidence.getByRole("button", { name: "报告异常" });
  await trigger.click();
  const modal = page.getByRole("dialog", { name: "创建数据质量工单" });
  const reason = modal.getByLabel("异常说明");
  expect(await modal.evaluate((element) => element.matches(":modal"))).toBe(true);
  await expect(reason).toBeFocused();
  const close = modal.getByRole("button", { name: "关闭异常报告" });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(modal.getByRole("button", { name: "取消", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("UI2-TR08 responsive trend filters preserve desktop grouping and mobile focus lifecycle", async ({
  page,
}) => {
  const data = await ready(page);
  await page.goto("/trends");
  if ((page.viewportSize()?.width ?? 1440) > 760) {
    await expect(page.getByRole("group", { name: "筛选趋势" })).toBeVisible();
    await expect(page.locator(".responsive-filter-drawer__trigger")).toBeHidden();
    await expect(page.getByRole("dialog", { name: "筛选趋势" })).toHaveCount(0);
    return;
  }

  const trigger = page.getByRole("button", { name: /筛选趋势/ });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "筛选趋势" });
  const close = drawer.getByRole("button", { name: "关闭筛选条件" });
  const lastAction = drawer.getByRole("button", { name: "保存视图链接" });
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute("aria-modal", "true");
  await expect(close).toBeFocused();
  for (const [role, name] of [
    ["combobox", "市场"],
    ["textbox", "分类"],
    ["combobox", "状态"],
    ["textbox", "关键词"],
    ["combobox", "排序"],
  ] as const)
    await expect(drawer.getByRole(role, { name, exact: true })).toBeVisible();

  await page.keyboard.press("Shift+Tab");
  await expect(lastAction).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await drawer.getByRole("button", { name: "关闭筛选条件" }).click();
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await drawer.getByRole("button", { name: "筛选", exact: true }).click();
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(data.writes).toHaveLength(0);
});

test("UI2-TR13 trend filter badge counts only non-default filter fields", async ({ page }) => {
  await ready(page);
  await page.goto("/trends");

  const mobile = (page.viewportSize()?.width ?? 1440) <= 760;
  if (mobile) await page.getByRole("button", { name: /筛选趋势/ }).click();
  const filters = mobile
    ? page.getByRole("dialog", { name: "筛选趋势" }).locator("form")
    : page.getByRole("group", { name: "筛选趋势" }).locator("form");
  const badge = page.locator(".responsive-filter-drawer__trigger b");

  await expect(badge).toHaveCount(0);
  await filters.getByRole("combobox", { name: "排序" }).selectOption("latest");
  await expect(badge).toHaveCount(0);

  await filters.getByRole("textbox", { name: "关键词" }).fill("护肤");
  await expect(badge).toHaveText("1 项已选");
  await filters.getByRole("combobox", { name: "市场" }).selectOption("US");
  await expect(badge).toHaveText("2 项已选");
  await filters.getByRole("textbox", { name: "分类" }).fill("beauty");
  await expect(badge).toHaveText("3 项已选");
  await filters.getByRole("combobox", { name: "状态" }).selectOption("irrelevant");
  await expect(badge).toHaveText("4 项已选");
  await filters.getByRole("combobox", { name: "状态" }).selectOption("");
  await expect(badge).toHaveText("4 项已选");

  await filters.getByRole("button", { name: "清除", exact: true }).click();
  await expect(badge).toHaveCount(0);
});

test("UI2-TR08 preserves all-status URLs, current-page sorting, paging, and copy fallback", async ({
  page,
}) => {
  const data = await ready(page);
  const highHeat = {
      ...data.detail,
      id: id(420),
      title: "高热未关注主题",
      heat: { value: 50, unit: "signals" as const },
      followed: false,
    },
    followed = {
      ...data.detail,
      id: id(421),
      title: "低热关注主题",
      heat: { value: 1, unit: "signals" as const },
      followed: true,
    },
    listRequests: URL[] = [];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("clipboard unavailable")) },
    });
  });
  await page.route("**/api/v1/trends**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET")
      return route.fulfill({ status: 500, json: { error: { code: "unexpected_test_write" } } });
    if (url.pathname === "/api/v1/trends") {
      listRequests.push(url);
      const currentPage = Number(url.searchParams.get("page") ?? 1);
      return route.fulfill({
        json: envelope([highHeat, followed], { page: currentPage, page_size: 20, total: 41 }),
      });
    }
    const detailId = url.pathname.match(/^\/api\/v1\/trends\/([^/]+)$/)?.[1];
    if (detailId && detailId !== "monitoring-rules" && detailId !== "change-requests")
      return route.fulfill({ json: envelope({ ...data.detail, id: detailId }) });
    return route.fallback();
  });

  await page.goto("/trends");
  const topicButtons = page.locator("#trend-list > button");
  await expect(topicButtons).toHaveCount(2);
  await expect(topicButtons.nth(0)).toContainText("高热未关注主题");

  const mobile = (page.viewportSize()?.width ?? 1440) <= 760;
  if (mobile) await page.getByRole("button", { name: /筛选趋势/ }).click();
  const filters = mobile
    ? page.getByRole("dialog", { name: "筛选趋势" })
    : page.locator(".trend-filters");
  await filters.getByRole("combobox", { name: "排序" }).selectOption("followed");
  await expect(topicButtons.nth(0)).toContainText("低热关注主题");
  await filters.getByRole("button", { name: "筛选", exact: true }).click();
  await expect(page).toHaveURL(/sort=followed/);
  expect(listRequests.length).toBeGreaterThan(0);
  expect(listRequests.every((url) => !url.searchParams.has("sort"))).toBe(true);

  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("第 2 / 3 页")).toBeVisible();
  await expect(page.getByRole("button", { name: "上一页" })).toBeEnabled();
  expect(listRequests.at(-1)?.searchParams.get("page")).toBe("2");
  await page.getByRole("button", { name: "上一页" }).click();
  await expect(page).not.toHaveURL(/page=/);
  await expect(page.getByRole("button", { name: "上一页" })).toBeDisabled();
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page).toHaveURL(/page=3/);
  await expect(page.getByRole("button", { name: "下一页" })).toBeDisabled();

  if (mobile) await page.getByRole("button", { name: /筛选趋势/ }).click();
  const activeFilters = mobile
    ? page.getByRole("dialog", { name: "筛选趋势" })
    : page.locator(".trend-filters");
  await activeFilters.getByRole("combobox", { name: "状态" }).selectOption("");
  await activeFilters.getByRole("button", { name: "筛选", exact: true }).click();
  const address = new URL(page.url());
  expect(address.searchParams.has("status")).toBe(true);
  expect(address.searchParams.get("status")).toBe("");
  expect(address.searchParams.has("page")).toBe(false);
  expect(listRequests.at(-1)?.searchParams.has("status")).toBe(false);
  await page.reload();
  if (mobile) await page.getByRole("button", { name: /筛选趋势/ }).click();
  const reloadedFilters = mobile
    ? page.getByRole("dialog", { name: "筛选趋势" })
    : page.locator(".trend-filters");
  await expect(reloadedFilters.getByRole("combobox", { name: "状态" })).toHaveValue("");

  await reloadedFilters.getByRole("button", { name: "清除", exact: true }).click();
  const clearedAddress = new URL(page.url());
  expect(clearedAddress.searchParams.has("status")).toBe(false);
  expect(clearedAddress.searchParams.has("sort")).toBe(false);
  expect(clearedAddress.searchParams.has("page")).toBe(false);
  await expect(reloadedFilters.getByRole("combobox", { name: "状态" })).toHaveValue("active");
  await reloadedFilters.getByRole("button", { name: "保存视图链接" }).click();
  await expect(page.getByRole("status")).toContainText("当前视图已同步到地址栏，可复制地址保存。");
  expect(data.writes).toHaveLength(0);
});

test("UI2-TR10 late filter reads cannot replace or block the current topic list", async ({
  page,
}) => {
  const data = await ready(page);
  const staleSuccess = { ...data.detail, id: id(422), title: "迟到的旧主题" },
    currentSuccess = { ...data.detail, id: id(423), title: "当前筛选主题" },
    currentAfterFailure = { ...data.detail, id: id(424), title: "失败后当前主题" };
  let releaseSuccess!: () => void,
    markSuccessStarted!: () => void,
    releaseFailure!: () => void,
    markFailureStarted!: () => void;
  const successGate = new Promise<void>((resolve) => (releaseSuccess = resolve));
  const successStarted = new Promise<void>((resolve) => (markSuccessStarted = resolve));
  const failureGate = new Promise<void>((resolve) => (releaseFailure = resolve));
  const failureStarted = new Promise<void>((resolve) => (markFailureStarted = resolve));
  await page.route("**/api/v1/trends**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET")
      return route.fulfill({ status: 500, json: { error: { code: "unexpected_test_write" } } });
    if (url.pathname === "/api/v1/trends") {
      const category = url.searchParams.get("category");
      if (category === "late-success") {
        markSuccessStarted();
        await successGate;
        return route.fulfill({
          json: envelope([staleSuccess], { page: 1, page_size: 20, total: 1 }),
        });
      }
      if (category === "late-failure") {
        markFailureStarted();
        await failureGate;
        return route.fulfill({
          status: 503,
          json: {
            error: {
              code: "service_unavailable",
              message: "旧范围暂不可用",
              action_hint: "旧范围读取失败。",
            },
            request_id: "ui2-stale-filter-read",
            trace_id: "ui2-stale-filter-read",
          },
        });
      }
      const topic =
        category === "current-success"
          ? currentSuccess
          : category === "current-after-failure"
            ? currentAfterFailure
            : data.detail;
      return route.fulfill({ json: envelope([topic], { page: 1, page_size: 20, total: 1 }) });
    }
    const detailId = url.pathname.match(/^\/api\/v1\/trends\/([^/]+)$/)?.[1];
    const matchingTopic = [staleSuccess, currentSuccess, currentAfterFailure].find(
      (topic) => topic.id === detailId,
    );
    if (matchingTopic) return route.fulfill({ json: envelope(matchingTopic) });
    return route.fallback();
  });

  await page.goto("/trends");
  await expect(page.locator("#trend-list > button").first()).toContainText(data.detail.title);
  const mobile = (page.viewportSize()?.width ?? 1440) <= 760;
  const applyCategory = async (category: string) => {
    if (mobile) await page.getByRole("button", { name: /筛选趋势/ }).click();
    const panel = mobile
      ? page.getByRole("dialog", { name: "筛选趋势" })
      : page.locator(".trend-filters");
    await panel.getByRole("textbox", { name: "分类" }).fill(category);
    await panel.getByRole("button", { name: "筛选", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`category=${category}`));
  };

  await applyCategory("late-success");
  await successStarted;
  await applyCategory("current-success");
  await expect(page.locator("#trend-list > button").first()).toContainText("当前筛选主题");
  const staleSuccessResponse = page.waitForResponse(
    (response) => new URL(response.url()).searchParams.get("category") === "late-success",
  );
  releaseSuccess();
  await staleSuccessResponse;
  await expect(page.locator("#trend-list > button").first()).toContainText("当前筛选主题");

  await applyCategory("late-failure");
  await failureStarted;
  await applyCategory("current-after-failure");
  await expect(page.locator("#trend-list > button").first()).toContainText("失败后当前主题");
  const staleFailureResponse = page.waitForResponse(
    (response) => new URL(response.url()).searchParams.get("category") === "late-failure",
  );
  releaseFailure();
  await staleFailureResponse;
  await expect(page.locator("#trend-list > button").first()).toContainText("失败后当前主题");
  await expect(page.locator("#trend-list")).toBeVisible();
  expect(data.writes).toHaveLength(0);
});

test("UI2-TR10 route topic reads discard stale success and failure responses", async ({ page }) => {
  const data = await ready(page, ["task:read", "trend:read"]);
  const secondTopic = { ...data.detail, id: id(425), title: "第二主题" },
    thirdTopic = { ...data.detail, id: id(426), title: "第三主题" };
  let secondTopicReads = 0,
    raceArmed = false,
    raceMode: "success" | "failure" = "success",
    releaseLateSuccess!: () => void,
    markLateSuccessStarted!: () => void,
    releaseLateFailure!: () => void,
    markLateFailureStarted!: () => void;
  const lateSuccessGate = new Promise<void>((resolve) => (releaseLateSuccess = resolve));
  const lateSuccessStarted = new Promise<void>((resolve) => (markLateSuccessStarted = resolve));
  const lateFailureGate = new Promise<void>((resolve) => (releaseLateFailure = resolve));
  const lateFailureStarted = new Promise<void>((resolve) => (markLateFailureStarted = resolve));

  await page.route("**/api/v1/trends**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET")
      return route.fulfill({ status: 500, json: { error: { code: "unexpected_test_write" } } });
    if (url.pathname === "/api/v1/trends")
      return route.fulfill({
        json: envelope([data.detail, secondTopic, thirdTopic], {
          page: 1,
          page_size: 20,
          total: 3,
        }),
      });
    if (url.pathname.endsWith("/monitoring-rules"))
      return route.fulfill({ json: envelope([data.rule]) });
    if (url.pathname.endsWith("/change-requests"))
      return route.fulfill({ json: envelope(data.changes) });

    const detailId = url.pathname.match(/^\/api\/v1\/trends\/([^/]+)$/)?.[1];
    if (detailId === secondTopic.id) {
      if (!raceArmed) return route.fulfill({ json: envelope(secondTopic) });
      secondTopicReads += 1;
      if (secondTopicReads > 1) return route.fulfill({ json: envelope(secondTopic) });
      if (raceMode === "success") {
        markLateSuccessStarted();
        await lateSuccessGate;
        return route.fulfill({ json: envelope(secondTopic) });
      }
      markLateFailureStarted();
      await lateFailureGate;
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: "service_unavailable",
            message: "迟到主题读取失败",
            action_hint: "迟到主题读取失败。",
          },
          request_id: "ui2-stale-topic-read",
          trace_id: "ui2-stale-topic-read",
        },
      });
    }
    if (detailId === thirdTopic.id) return route.fulfill({ json: envelope(thirdTopic) });
    if (detailId === data.detail.id) return route.fulfill({ json: envelope(data.detail) });
    return route.fallback();
  });

  await page.goto(`/trends?topic=${topicId}`);
  await expect(page.locator(".trend-detail")).toContainText(data.detail.title);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#trend-list > button")).toHaveCount(3);
  raceArmed = true;
  const mobile = (page.viewportSize()?.width ?? 1440) <= 760;
  const chooseTopic = async (title: string) => {
    if (mobile && !(await page.locator("#trend-list").isVisible()))
      await page.getByRole("button", { name: "返回趋势列表" }).click();
    await page.locator("#trend-list > button").filter({ hasText: title }).click();
  };

  await chooseTopic(secondTopic.title);
  await lateSuccessStarted;
  await chooseTopic(thirdTopic.title);
  await expect(page.locator(".trend-detail")).toContainText(thirdTopic.title);
  const lateSuccessResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === `/api/v1/trends/${secondTopic.id}`,
  );
  releaseLateSuccess();
  await lateSuccessResponse;
  await expect(page.locator(".trend-detail")).toContainText(thirdTopic.title);
  await expect(page.locator(".trend-detail")).not.toContainText(secondTopic.title);

  raceMode = "failure";
  secondTopicReads = 0;
  await chooseTopic(secondTopic.title);
  await lateFailureStarted;
  await chooseTopic(thirdTopic.title);
  await expect(page.locator(".trend-detail")).toContainText(thirdTopic.title);
  const lateFailureResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/v1/trends/${secondTopic.id}` &&
      response.status() === 503,
  );
  releaseLateFailure();
  await lateFailureResponse;
  await expect(page.locator(".trend-detail")).toContainText(thirdTopic.title);
  await expect(page.locator("body")).not.toContainText("迟到主题读取失败");
  await expect(page.locator("body")).not.toContainText("ui2-stale-topic-read");
  expect(data.writes).toHaveLength(0);
});

test("UI2-TR10 stale rule and governance reads cannot replace the current view", async ({
  page,
}) => {
  const data = await ready(page);
  const staleRule = { ...data.rule, name: "迟到规则" },
    currentRule = { ...data.rule, name: "当前规则" },
    staleRequest = { ...change(data), id: id(427), new_title: "迟到队列" },
    currentSuccessRequest = { ...change(data), id: id(428), new_title: "当前成功队列" },
    currentFailureRequest = { ...change(data), id: id(429), new_title: "失败后当前队列" };
  const deferred = () => {
    let release!: () => void, markStarted!: () => void;
    return {
      wait: new Promise<void>((resolve) => (release = resolve)),
      started: new Promise<void>((resolve) => (markStarted = resolve)),
      release: () => release(),
      markStarted: () => markStarted(),
    };
  };
  let race:
    | {
        outcome: "success" | "failure";
        rules: ReturnType<typeof deferred>;
        governance: ReturnType<typeof deferred>;
        ruleCalls: number;
        governanceCalls: number;
      }
    | undefined;
  const failure = (requestId: string) => ({
    status: 503,
    json: {
      error: {
        code: "service_unavailable",
        message: "旧范围读取失败",
        action_hint: "旧范围读取失败。",
      },
      request_id: requestId,
      trace_id: requestId,
    },
  });

  await page.route("**/api/v1/trends**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (request.method() !== "GET")
      return route.fulfill({ status: 500, json: { error: { code: "unexpected_test_write" } } });
    if (url.pathname === "/api/v1/trends")
      return route.fulfill({
        json: envelope([data.detail], { page: 1, page_size: 20, total: 1 }),
      });
    if (url.pathname.endsWith("/monitoring-rules")) {
      if (!race) return route.fulfill({ json: envelope([data.rule]) });
      if (++race.ruleCalls === 1) {
        race.rules.markStarted();
        await race.rules.wait;
        return race.outcome === "success"
          ? route.fulfill({ json: envelope([staleRule]) })
          : route.fulfill(failure("ui2-stale-rule-read"));
      }
      return route.fulfill({ json: envelope([currentRule]) });
    }
    if (url.pathname.endsWith("/change-requests")) {
      if (!race) return route.fulfill({ json: envelope(data.changes) });
      if (++race.governanceCalls === 1) {
        race.governance.markStarted();
        await race.governance.wait;
        return race.outcome === "success"
          ? route.fulfill({ json: envelope([staleRequest]) })
          : route.fulfill(failure("ui2-stale-governance-read"));
      }
      const request =
        new URL(page.url()).searchParams.get("category") === "current-success"
          ? currentSuccessRequest
          : currentFailureRequest;
      return route.fulfill({ json: envelope([request]) });
    }
    const detailId = url.pathname.match(/^\/api\/v1\/trends\/([^/]+)$/)?.[1];
    if (detailId === data.detail.id) return route.fulfill({ json: envelope(data.detail) });
    return route.fallback();
  });

  await page.goto("/trends");
  await expect(page.locator("#trend-list > button").first()).toContainText(data.detail.title);
  await page.waitForLoadState("networkidle");
  const mobile = (page.viewportSize()?.width ?? 1440) <= 760;
  const applyCategory = async (category: string) => {
    if (mobile) await page.getByRole("button", { name: /筛选趋势/ }).click();
    const panel = mobile
      ? page.getByRole("dialog", { name: "筛选趋势" })
      : page.locator(".trend-filters");
    await panel.getByRole("textbox", { name: "分类" }).fill(category);
    await panel.getByRole("button", { name: "筛选", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`category=${category}`));
  };
  const expectCurrentView = async (requestTitle: string) => {
    await page
      .locator(".trend-tabs")
      .getByRole("button", { name: /监控规则/ })
      .click();
    await expect(page.locator(".trend-rules article h4")).toHaveText("当前规则");
    await page.getByRole("button", { name: /合并与拆分/ }).click();
    await expect(page.locator(".trend-change-queue article")).toContainText(requestTitle);
  };
  const runRace = async (
    category: string,
    nextCategory: string,
    outcome: "success" | "failure",
    requestTitle: string,
  ) => {
    const oldRules = deferred(),
      oldGovernance = deferred();
    race = {
      outcome,
      rules: oldRules,
      governance: oldGovernance,
      ruleCalls: 0,
      governanceCalls: 0,
    };
    await page.getByRole("button", { name: /趋势主题/ }).click();
    await applyCategory(category);
    await Promise.all([oldRules.started, oldGovernance.started]);
    await applyCategory(nextCategory);
    await expect(page).toHaveURL(new RegExp(`category=${nextCategory}`));
    await expect(page.locator("#trend-list > button").first()).toContainText(data.detail.title);
    await expectCurrentView(requestTitle);

    const oldRuleResponse = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/v1/trends/monitoring-rules" &&
          (outcome === "success" || response.status() === 503),
      ),
      oldGovernanceResponse = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/v1/trends/change-requests" &&
          (outcome === "success" || response.status() === 503),
      );
    oldRules.release();
    oldGovernance.release();
    await Promise.all([oldRuleResponse, oldGovernanceResponse]);
    await expectCurrentView(requestTitle);
    if (outcome === "failure") {
      await expect(page.locator("body")).not.toContainText("旧范围读取失败");
      await expect(page.locator("body")).not.toContainText("ui2-stale-rule-read");
      await expect(page.locator("body")).not.toContainText("ui2-stale-governance-read");
    }
  };

  await runRace("late-success", "current-success", "success", "当前成功队列");
  await runRace("late-failure", "current-after-failure", "failure", "失败后当前队列");
  expect(data.writes).toHaveLength(0);
});

test("UI2-TR02 relevance failure retains the draft and prevents dismissal while saving", async ({
  page,
}) => {
  const data = await ready(page);
  let attempts = 0,
    releaseFailure!: () => void,
    markRequestStarted!: () => void;
  const failureGate = new Promise<void>((resolve) => (releaseFailure = resolve));
  const requestStarted = new Promise<void>((resolve) => (markRequestStarted = resolve));
  await page.route(`**/api/v1/trends/${topicId}/relevance`, async (route) => {
    attempts += 1;
    if (attempts === 1) {
      markRequestStarted();
      await failureGate;
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: "service_unavailable",
            message: "暂不可用",
            action_hint: "稍后重试相关性变更。",
          },
          request_id: "ui2-relevance-failure",
          trace_id: "ui2-relevance-failure",
        },
      });
    }
    const body = route.request().postDataJSON();
    data.detail.status = body.status;
    data.detail.version += 1;
    data.detail.relevance_history.push({
      status: body.status,
      reason: body.reason,
      actor_id: id(415),
      version: data.detail.version,
      occurred_at: at,
    });
    return route.fulfill({ json: envelope(data.detail) });
  });

  await openDetail(page);
  await page.getByRole("button", { name: "标记无关", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "标记为无关" });
  const reason = "该主题与当前研究范围无关";
  await modal.getByLabel("变更原因").fill(reason);
  await modal.getByRole("button", { name: "确认并记录" }).click();
  await requestStarted;
  await expect(modal.getByRole("button", { name: "关闭相关性变更" })).toBeDisabled();
  await expect(modal.getByRole("button", { name: "取消", exact: true })).toBeDisabled();
  await expect(modal.getByRole("button", { name: "提交中…" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(modal).toBeVisible();

  releaseFailure();
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel("变更原因")).toHaveValue(reason);
  await expect(page.getByRole("status")).toContainText("稍后重试相关性变更。");

  await modal.getByRole("button", { name: "确认并记录" }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByRole("button", { name: "恢复为相关", exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});

test("UI2-TR03 anomaly failure preserves input and explicit retry reuses returned issue", async ({
  page,
}) => {
  const data = await ready(page);
  let attempts = 0;
  await page.route(`**/api/v1/trends/${topicId}/evidence/${signalId}/quality-issues`, (route) => {
    attempts += 1;
    if (attempts === 1)
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: "service_unavailable",
            message: "暂不可用",
            action_hint: "稍后重新提交异常报告。",
          },
          request_id: "ui2-anomaly-failure",
          trace_id: "ui2-anomaly-failure",
        },
      });
    return route.fulfill({
      status: 200,
      json: envelope({
        created: false,
        issue: { id: issueId, severity: "critical", status: "open", version: 2 },
      }),
    });
  });
  await openDetail(page);
  const evidence = page.locator(".trend-evidence-item").filter({ hasText: "隔离证据 406" });
  await evidence.getByRole("button", { name: "报告异常" }).click();
  const modal = page.getByRole("dialog", { name: "创建数据质量工单" });
  await expect(modal.getByRole("button", { name: "创建质量工单" })).toBeDisabled();
  await modal.getByLabel("风险等级").selectOption("critical");
  await modal.getByLabel("异常说明").fill("  原始证据与解析内容冲突  ");
  await modal.getByRole("button", { name: "创建质量工单" }).click();
  await expect(page.locator(".trend-message")).toContainText("稍后重新提交异常报告。");
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel("风险等级")).toHaveValue("critical");
  await expect(modal.getByLabel("异常说明")).toHaveValue("  原始证据与解析内容冲突  ");
  expect(attempts).toBe(1);
  await modal.getByRole("button", { name: "创建质量工单" }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator(".trend-message")).toContainText(`已有未关闭质量工单 ${issueId}`);
  await expect(evidence.getByRole("button", { name: "已建质量工单" })).toBeDisabled();
  expect(data.writes).toHaveLength(2);
  for (const request of data.writes)
    assertWrite(request, "POST", `/trends/${topicId}/evidence/${signalId}/quality-issues`, {
      severity: "critical",
      reason: "原始证据与解析内容冲突",
    });
});

test("UI2-TR04 rule cancel resets defaults and creation sends the exact form contract", async ({
  page,
}) => {
  const data = await ready(page);
  await page.route("**/api/v1/trends/monitoring-rules", (route) => {
    if (route.request().method() === "GET") return route.fallback();
    Object.assign(data.rule, route.request().postDataJSON());
    return route.fulfill({ status: 201, json: envelope(data.rule) });
  });
  await page.goto("/trends?section=rules");
  await page.getByRole("button", { name: "＋ 创建规则", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "创建趋势监控", exact: true });
  await modal.getByLabel("规则名称", { exact: true }).fill("待取消");
  await modal.getByRole("button", { name: "取消", exact: true }).click();
  expect(data.writes).toHaveLength(0);
  await page.getByRole("button", { name: "＋ 创建规则", exact: true }).click();
  await expect(modal.getByLabel("规则名称", { exact: true })).toHaveValue("");
  await expect(modal.getByLabel("市场", { exact: true })).toHaveValue("US");
  await expect(modal.getByLabel("语言", { exact: true })).toHaveValue("en-US");
  await expect(modal.getByLabel("自动采集周期")).toHaveValue("60");
  await expect(modal.getByLabel("候选来源门槛")).toHaveValue("1");
  await modal.getByRole("button", { name: "创建并启用" }).click();
  expect(data.writes).toHaveLength(0);
  await expect(modal.getByLabel("规则名称", { exact: true })).toBeFocused();
  await modal.getByLabel("规则名称", { exact: true }).fill("独立规则");
  await modal.getByLabel("包含关键词（逗号分隔）").fill(" Desk Lamp， reading , ");
  await modal.getByLabel("排除关键词（可选）").fill(" medical，used ");
  await modal.getByLabel("自动采集周期").selectOption("180");
  await modal.getByLabel("候选来源门槛").selectOption("3");
  await modal.getByRole("button", { name: "创建并启用" }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator(".trend-message")).toContainText("监控规则已启用");
  expect(data.writes).toHaveLength(1);
  assertWrite(data.writes[0], "POST", "/trends/monitoring-rules", {
    name: "独立规则",
    include_keywords: ["Desk Lamp", "reading"],
    negative_keywords: ["medical", "used"],
    market: "US",
    language: "en-US",
    category: null,
    notification_channel: "in_app",
    collection_interval_minutes: 180,
    recommendation_min_source_count: 3,
  });
});

test("UI2-TR05 rule status updates retain schedule and use returned versions", async ({ page }) => {
  const data = await ready(page);
  await page.route(`**/api/v1/trends/monitoring-rules/${ruleId}`, (route) => {
    data.rule.status = route.request().postDataJSON().status;
    data.rule.version += 1;
    return route.fulfill({ json: envelope(data.rule) });
  });
  await page.goto("/trends?section=rules");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.getByRole("button", { name: "启用", exact: true }).click();
  await expect(page.getByRole("button", { name: "暂停", exact: true })).toBeVisible();
  expect(data.writes).toHaveLength(2);
  for (const [index, status] of ["paused", "enabled"].entries())
    assertWrite(data.writes[index], "PATCH", `/trends/monitoring-rules/${ruleId}`, {
      status,
      expected_version: 4 + index,
      collection_interval_minutes: 180,
      recommendation_min_source_count: 3,
    });
});

test("UI2-TR06 split proposes exact evidence and versions without executing a decision", async ({
  page,
}) => {
  const data = await ready(page);
  await page.route("**/api/v1/trends/change-requests", (route) => {
    if (route.request().method() === "GET") return route.fallback();
    data.changes.push(change(data));
    return route.fulfill({ status: 201, json: envelope(data.changes[0]) });
  });
  await openDetail(page);
  await page.getByRole("button", { name: /合并与拆分/ }).click();
  await page.getByRole("button", { name: "拆分主题", exact: true }).click();
  await expect(page.getByRole("button", { name: "提交确认队列" })).toBeDisabled();
  await page.getByRole("checkbox", { name: /隔离证据 406/ }).check();
  await page.getByLabel("新主题名称").fill(" 单独观察 ");
  await page.getByLabel("提议原因").fill("  证据应单独核对  ");
  await page.getByRole("button", { name: "提交确认队列" }).click();
  await expect(page.locator(".trend-message")).toContainText("需要另一位趋势管理员确认");
  await expect(page.locator(".trend-change-queue article")).toHaveAttribute(
    "data-status",
    "pending",
  );
  expect(data.writes).toHaveLength(1);
  assertWrite(data.writes[0], "POST", "/trends/change-requests", {
    operation: "split",
    target_topic_id: topicId,
    source_topic_ids: [],
    signal_ids: [signalId],
    new_title: "单独观察",
    new_category: null,
    expected_versions: { [topicId]: 3 },
    reason: "证据应单独核对",
  });
});

for (const decision of ["confirm", "reject"] as const) {
  test(`UI2-TR07 ${decision} cancel and exact decision contract with refreshed queue`, async ({
    page,
  }) => {
    const data = await ready(page),
      item = change(data);
    data.changes.push(item);
    await page.route(`**/api/v1/trends/change-requests/${item.id}/decisions`, (route) => {
      const body = route.request().postDataJSON();
      item.status = decision === "confirm" ? "confirmed" : "rejected";
      item.decision_reason = body.reason;
      item.decided_by = id(416);
      item.decided_at = at;
      item.version += 1;
      return route.fulfill({ json: envelope(item) });
    });
    await page.goto("/trends?section=governance");
    const card = page.locator(".trend-change-queue article");
    const begin = card.getByRole("button", {
      name: decision === "confirm" ? "确认执行" : "驳回",
      exact: true,
    });
    await begin.click();
    const form = card.locator(".trend-change-decision");
    const submit = form.getByRole("button", {
      name: decision === "confirm" ? "提交确认" : "提交驳回",
    });
    await expect(submit).toBeDisabled();
    await form.getByRole("textbox").fill("暂不提交");
    await form.getByRole("button", { name: "取消", exact: true }).click();
    expect(data.writes).toHaveLength(0);
    await begin.click();
    await expect(form.getByRole("textbox")).toHaveValue("");
    await form.getByRole("textbox").fill("  已核对具体信号与范围  ");
    await submit.click();
    await expect(card).toHaveAttribute(
      "data-status",
      decision === "confirm" ? "confirmed" : "rejected",
    );
    await expect(form).toBeHidden();
    await expect(card).toContainText("处理说明：已核对具体信号与范围");
    expect(data.writes).toHaveLength(1);
    assertWrite(data.writes[0], "POST", `/trends/change-requests/${item.id}/decisions`, {
      decision,
      reason: "已核对具体信号与范围",
      expected_version: 2,
    });
  });
}
