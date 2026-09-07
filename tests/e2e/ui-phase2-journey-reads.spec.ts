import { expect, test, type Page } from "@playwright/test";
import type { SelectionJourneyResult } from "../../apps/api/src/selection-journey-service";

// Real Vue with isolated responses: no source collection, database or production writes.
const journeyId = "00000000-0000-4000-8000-000000007701";
const storageKey = "scoutops.selection-journey.active-id";
const endpoint = `/api/v1/selection-journeys/${journeyId}`;
const envelope = (data: unknown) => ({ data, request_id: journeyId, trace_id: journeyId });
const fixture = (
  state: "running" | "succeeded_empty",
  input = "当前旅程",
): SelectionJourneyResult => ({
  id: journeyId,
  organization_id: journeyId,
  workspace_id: journeyId,
  input_kind: "keyword",
  input_value: input,
  provider_code: "google_news_search",
  task_id: journeyId,
  task_status: state === "running" ? "running" : "succeeded_empty",
  state,
  coverage_status: "insufficient_data",
  available_result_count: 0,
  results: [],
  first_result: null,
  blocked_reason: null,
  blocked_owner: null,
  blocked_next_step: null,
  timeline: [],
  decision: null,
  opportunity_id: null,
  verification_task_id: null,
  accepted_at: "2026-09-07T00:00:00.000Z",
  terminal_at: state === "running" ? null : "2026-09-07T00:00:12.000Z",
  decided_at: null,
  elapsed_ms: 12000,
  deadline_ms: 180000,
  within_deadline: true,
  request_id: journeyId,
  trace_id: journeyId,
});
async function setup(page: Page) {
  const writes: string[] = [];
  await page.addInitScript(
    ({ key, value, endpoint }) => {
      localStorage.setItem(key, value);
      // Keep late reads non-cancellable to prove ownership checks, not only abort().
      const original = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        return original(input, url.endsWith(endpoint) ? { ...init, signal: undefined } : init);
      };
    },
    { key: storageKey, value: journeyId, endpoint },
  );
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/selection-journeys") && request.method() !== "GET")
      writes.push(request.method());
  });
  await page.route("**/api/v1/me/ui-preferences", (route) =>
    route.fulfill({ json: envelope({ theme: "deep-ocean", version: 1 }) }),
  );
  await page.route("**/api/v1/me/navigation?shell=member", (route) =>
    route.fulfill({
      json: envelope({
        shell: "member",
        organization_id: journeyId,
        workspace_id: journeyId,
        roles: ["member"],
        capabilities: ["task:create", "opportunity:read", "opportunity:decide"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "allowed",
      }),
    }),
  );
  await page.route("**/api/v1/opportunities?*", (route) =>
    route.fulfill({ json: { ...envelope([]), meta: { page: 1, page_size: 20, total: 0 } } }),
  );
  return writes;
}
const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
function gate() {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { pending, release };
}

test("UI2-JR01 cached running journey pauses polling and refreshes once on return", async ({
  page,
}) => {
  const writes = await setup(page);
  let reads = 0;
  await page.route(`**${endpoint}`, (route) => {
    reads++;
    return route.fulfill({
      json: envelope(
        fixture(
          reads === 1 ? "running" : "succeeded_empty",
          reads === 1 ? "原始进度" : "服务端新进度",
        ),
      ),
    });
  });
  await page.goto("/opportunities/start");
  await expect(page.locator(".selection-status")).toHaveAttribute("data-state", "running");
  await page.getByRole("link", { name: "返回机会列表", exact: true }).click();
  await expect(page).toHaveURL(/\/opportunities$/);
  // Observe longer than the actual 2-second poll interval while KeepAlive is inactive.
  await page.waitForTimeout(2400);
  expect(reads).toBe(1);
  await page.goBack();
  await expect(page.locator(".selection-status")).toContainText("服务端新进度");
  await expect(page.locator(".selection-status")).toHaveAttribute("data-state", "succeeded_empty");
  expect(reads).toBe(2);
  expect(writes).toEqual([]);
});

for (const lateStatus of [200, 404]) {
  test(`UI2-JR02 late ${lateStatus} resume cannot replace the reactivated snapshot or clear its ID`, async ({
    page,
  }) => {
    const writes = await setup(page);
    const old = gate();
    let reads = 0;
    await page.route(`**${endpoint}`, async (route) => {
      reads++;
      if (reads > 1)
        return route.fulfill({ json: envelope(fixture("succeeded_empty", "最新服务端结果")) });
      await old.pending;
      return route.fulfill({
        status: lateStatus,
        headers: { "x-ui2-late": "resume" },
        json:
          lateStatus === 200
            ? envelope(fixture("running", "过期响应"))
            : { error: { code: "selection_journey_not_found", action_hint: "过期错误" } },
      });
    });
    try {
      await page.goto("/opportunities/start");
      await expect.poll(() => reads).toBe(1);
      await expect(page.getByRole("button", { name: "正在恢复进度…", exact: true })).toBeDisabled();
      await expect(page.getByRole("region", { name: "选品旅程", exact: true })).toHaveAttribute(
        "aria-busy",
        "true",
      );
      await page.getByRole("link", { name: "返回机会列表", exact: true }).click();
      await expect(page).toHaveURL(/\/opportunities$/);
      await page.goBack();
      await expect(page.locator(".selection-status")).toContainText("最新服务端结果");
      const late = page.waitForResponse(
        (response) => response.headers()["x-ui2-late"] === "resume",
      );
      old.release();
      await (await late).finished();
      await settle(page);
      await expect(page.locator(".selection-status")).toContainText("最新服务端结果");
      await expect(page.locator(".selection-status")).toHaveAttribute(
        "data-state",
        "succeeded_empty",
      );
      expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(journeyId);
      expect(writes).toEqual([]);
    } finally {
      old.release();
    }
  });
}

test("UI2-JR03 reset invalidates an in-flight poll without recreating the old journey", async ({
  page,
}) => {
  const writes = await setup(page);
  const poll = gate();
  let reads = 0;
  await page.route(`**${endpoint}`, async (route) => {
    reads++;
    if (reads === 1) return route.fulfill({ json: envelope(fixture("running")) });
    await poll.pending;
    return route.fulfill({
      headers: { "x-ui2-late": "poll" },
      json: envelope(fixture("succeeded_empty", "已重置的旧旅程")),
    });
  });
  try {
    await page.goto("/opportunities/start");
    await expect(page.locator(".selection-status")).toHaveAttribute("data-state", "running");
    await expect.poll(() => reads).toBe(2);
    await page.getByRole("button", { name: "开始下一次", exact: true }).click();
    await expect(page.locator(".selection-start")).toBeVisible();
    const late = page.waitForResponse((response) => response.headers()["x-ui2-late"] === "poll");
    poll.release();
    await (await late).finished();
    await settle(page);
    await expect(page.locator(".selection-start")).toBeVisible();
    await expect(page.locator(".selection-status")).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
    expect(writes).toEqual([]);
  } finally {
    poll.release();
  }
});

test("UI2-JR04 failed resume explicitly rereads the saved ID instead of discarding it", async ({
  page,
}) => {
  const writes = await setup(page);
  let reads = 0;
  await page.route(`**${endpoint}`, (route) => {
    reads++;
    return reads === 1
      ? route.fulfill({
          status: 500,
          json: { error: { code: "read_failed", action_hint: "状态读取失败" } },
        })
      : route.fulfill({ json: envelope(fixture("succeeded_empty", "恢复读取成功")) });
  });
  await page.goto("/opportunities/start");
  await expect(page.locator(".ui-state-panel")).toContainText("状态读取失败");
  await page.locator(".ui-state-panel .primary").click();
  await expect(page.locator(".selection-status")).toContainText("恢复读取成功");
  await expect(page.locator(".ui-state-panel")).toHaveCount(0);
  expect(reads).toBe(2);
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(journeyId);
  expect(writes).toEqual([]);
});
