import { expect, test, type Page, type Request } from "@playwright/test";
import type { TrendDetail } from "../../apps/web/src/components/trend-workspace-types";

// Local real-Vue contract fixtures. No production, SQL, crawler or actual governance execution.
const id = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const topicId = id(404);
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
  return { detail, writes: [] as Request[] };
}

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
    const value = url.pathname.endsWith(`/${topicId}`) ? data.detail : [data.detail];
    return route.fulfill({ json: envelope(value, { page: 1, page_size: 20, total: 1 }) });
  });
  return data;
}
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
  const lastAction = drawer.getByRole("button", { name: "清除", exact: true });
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

test("UI2-TR10 late filter reads cannot replace or block the current topic list", async ({
  page,
}) => {
  const data = await ready(page);
  const failedRequests: Request[] = [];
  page.on("requestfailed", (request) => failedRequests.push(request));
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
        return route
          .fulfill({
            json: envelope([staleSuccess], { page: 1, page_size: 20, total: 1 }),
          })
          .catch(() => {});
      }
      if (category === "late-failure") {
        markFailureStarted();
        await failureGate;
        return route
          .fulfill({
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
          })
          .catch(() => {});
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
  await expect
    .poll(() =>
      failedRequests.some(
        (request) =>
          new URL(request.url()).searchParams.get("category") === "late-success" &&
          request.failure()?.errorText.includes("ERR_ABORTED"),
      ),
    )
    .toBe(true);
  releaseSuccess();
  await expect(page.locator("#trend-list > button").first()).toContainText("当前筛选主题");

  await applyCategory("late-failure");
  await failureStarted;
  await applyCategory("current-after-failure");
  await expect(page.locator("#trend-list > button").first()).toContainText("失败后当前主题");
  await expect
    .poll(() =>
      failedRequests.some(
        (request) =>
          new URL(request.url()).searchParams.get("category") === "late-failure" &&
          request.failure()?.errorText.includes("ERR_ABORTED"),
      ),
    )
    .toBe(true);
  releaseFailure();
  await expect(page.locator("#trend-list > button").first()).toContainText("失败后当前主题");
  await expect(page.locator("#trend-list")).toBeVisible();
  expect(data.writes).toHaveLength(0);
});

test("UI2-TR10 route topic reads cancel superseded success and failure requests", async ({
  page,
}) => {
  const data = await ready(page, ["task:read", "trend:read"]);
  const failedRequests: Request[] = [];
  page.on("requestfailed", (request) => failedRequests.push(request));
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
    const detailId = url.pathname.match(/^\/api\/v1\/trends\/([^/]+)$/)?.[1];
    if (detailId === secondTopic.id) {
      if (!raceArmed) return route.fulfill({ json: envelope(secondTopic) });
      secondTopicReads += 1;
      if (secondTopicReads > 1) return route.fulfill({ json: envelope(secondTopic) });
      if (raceMode === "success") {
        markLateSuccessStarted();
        await lateSuccessGate;
        return route.fulfill({ json: envelope(secondTopic) }).catch(() => {});
      }
      markLateFailureStarted();
      await lateFailureGate;
      return route
        .fulfill({
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
        })
        .catch(() => {});
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
  await expect
    .poll(() =>
      failedRequests.some(
        (request) =>
          new URL(request.url()).pathname === `/api/v1/trends/${secondTopic.id}` &&
          request.failure()?.errorText.includes("ERR_ABORTED"),
      ),
    )
    .toBe(true);
  releaseLateSuccess();
  await expect(page.locator(".trend-detail")).toContainText(thirdTopic.title);
  await expect(page.locator(".trend-detail")).not.toContainText(secondTopic.title);

  raceMode = "failure";
  secondTopicReads = 0;
  await chooseTopic(secondTopic.title);
  await lateFailureStarted;
  await chooseTopic(thirdTopic.title);
  await expect(page.locator(".trend-detail")).toContainText(thirdTopic.title);
  await expect
    .poll(
      () =>
        failedRequests.filter(
          (request) =>
            new URL(request.url()).pathname === `/api/v1/trends/${secondTopic.id}` &&
            request.failure()?.errorText.includes("ERR_ABORTED"),
        ).length,
    )
    .toBe(2);
  releaseLateFailure();
  await expect(page.locator(".trend-detail")).toContainText(thirdTopic.title);
  await expect(page.locator("body")).not.toContainText("迟到主题读取失败");
  await expect(page.locator("body")).not.toContainText("ui2-stale-topic-read");
  expect(data.writes).toHaveLength(0);
});

test("P14 deactivation cancels reads and activation refreshes once", async ({ page }) => {
  const data = await ready(page);
  const failedRequests: Request[] = [];
  page.on("requestfailed", (request) => failedRequests.push(request));
  let releaseLateRead!: () => void,
    markLateReadStarted!: () => void,
    filterReadCount = 0;
  const lateReadGate = new Promise<void>((resolve) => (releaseLateRead = resolve));
  const lateReadStarted = new Promise<void>((resolve) => (markLateReadStarted = resolve));
  await page.route("**/api/v1/trends**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/trends" && url.searchParams.get("category") === "deactivate") {
      filterReadCount += 1;
      if (filterReadCount > 1)
        return route.fulfill({
          json: envelope([data.detail], { page: 1, page_size: 20, total: 1 }),
        });
      markLateReadStarted();
      await lateReadGate;
      return route
        .fulfill({ json: envelope([data.detail], { page: 1, page_size: 20, total: 1 }) })
        .catch(() => {});
    }
    return route.fallback();
  });

  await page.goto("/trends");
  await expect(page.locator("#trend-list > button").first()).toContainText(data.detail.title);
  if ((page.viewportSize()?.width ?? 1440) <= 760)
    await page.getByRole("button", { name: /筛选趋势/ }).click();
  const filters =
    (page.viewportSize()?.width ?? 1440) <= 760
      ? page.getByRole("dialog", { name: "筛选趋势" })
      : page.locator(".trend-filters");
  await filters.getByRole("textbox", { name: "分类" }).fill("deactivate");
  await filters.getByRole("button", { name: "筛选", exact: true }).click();
  await lateReadStarted;
  expect(filterReadCount).toBe(1);

  await page.evaluate(() => {
    window.history.pushState({}, "", "/home");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/home(?:$|\?)/);
  await expect
    .poll(() =>
      failedRequests.some(
        (request) =>
          new URL(request.url()).searchParams.get("category") === "deactivate" &&
          request.failure()?.errorText.includes("ERR_ABORTED"),
      ),
    )
    .toBe(true);
  expect(filterReadCount).toBe(1);
  releaseLateRead();
  const readsBeforeActivation = filterReadCount;
  await page.evaluate(() => {
    window.history.pushState({}, "", "/trends?category=deactivate");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/trends\?category=deactivate/);
  await expect.poll(() => filterReadCount).toBe(readsBeforeActivation + 1);
  await expect(page.locator("#trend-list > button").first()).toContainText(data.detail.title);
  expect(data.writes).toHaveLength(0);
});
