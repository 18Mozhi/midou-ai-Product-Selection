import { expect, test, type Page, type Request } from "@playwright/test";
import type { SelectionJourneyResult } from "../../apps/api/src/selection-journey-service";

// Isolated real-Vue contracts, not external collection or real database acceptance.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const journeyId = id(7601),
  storageKey = "scoutops.selection-journey.active-id";
const at = "2026-08-10T12:00:00.000Z";
const envelope = (data: unknown) => ({
  data,
  request_id: "ui2-journey-request",
  trace_id: "ui2-journey-trace",
});
function fixture(): SelectionJourneyResult {
  return {
    id: journeyId,
    organization_id: id(7602),
    workspace_id: id(7603),
    input_kind: "keyword",
    input_value: "portable blender",
    provider_code: "google_news_search",
    task_id: id(7604),
    task_status: "succeeded",
    state: "result_ready",
    coverage_status: "partial",
    available_result_count: 2,
    results: [1, 2].map((n) => ({
      raw_evidence_id: id(7610 + n),
      title: `隔离候选 ${n}`,
      publisher: "隔离来源",
      canonical_url: `https://example.test/candidate-${n}`,
      observed_at: at,
      topic_id: n === 1 ? null : id(7620),
    })),
    first_result: null,
    blocked_reason: null,
    blocked_owner: null,
    blocked_next_step: null,
    timeline: [
      { stage: "queued", status: "completed", occurred_at: at },
      { stage: "collecting", status: "completed", occurred_at: at },
      { stage: "parsing", status: "completed", occurred_at: at },
      { stage: "decision", status: "active", occurred_at: at },
    ],
    decision: null,
    opportunity_id: null,
    verification_task_id: null,
    accepted_at: at,
    terminal_at: at,
    decided_at: null,
    elapsed_ms: 12000,
    deadline_ms: 180000,
    within_deadline: true,
    request_id: "ui2-journey-request",
    trace_id: "ui2-journey-trace",
  };
}
async function ready(page: Page, savedId?: string) {
  const data = { journey: fixture(), writes: [] as Request[], reads: [] as Request[] };
  data.journey.first_result = data.journey.results[0];
  if (savedId !== undefined)
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: storageKey,
      value: savedId,
    });
  page.on("request", (request) => {
    if (!new URL(request.url()).pathname.startsWith("/api/v1/selection-journeys")) return;
    (request.method() === "GET" ? data.reads : data.writes).push(request);
  });
  await page.route("**/api/v1/me/ui-preferences", (route) =>
    route.fulfill({ json: envelope({ theme: "deep-ocean", version: 1 }) }),
  );
  await page.route("**/api/v1/me/navigation?shell=member", (route) =>
    route.fulfill({
      json: envelope({
        shell: "member",
        organization_id: data.journey.organization_id,
        workspace_id: data.journey.workspace_id,
        roles: ["member"],
        capabilities: ["task:create", "opportunity:read", "opportunity:decide"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "allowed",
      }),
    }),
  );
  await page.route("**/api/v1/selection-journeys**", (route) => {
    const request = route.request();
    if (request.method() === "GET") return route.fulfill({ json: envelope(data.journey) });
    return route.fulfill({ status: 500, json: { error: { code: "unexpected_test_write" } } });
  });
  return data;
}
function assertPost(request: Request, path: string, body: unknown) {
  expect(request.method()).toBe("POST");
  expect(new URL(request.url()).pathname).toBe(`/api/v1${path}`);
  expect(request.postDataJSON()).toEqual(body);
  for (const header of ["idempotency-key", "x-request-id", "x-trace-id"])
    expect(request.headers()[header]).toMatch(/^[0-9a-f-]{36}$/);
}
const savedId = (page: Page) => page.evaluate((key) => localStorage.getItem(key), storageKey);

for (const [kind, radio, field, value] of [
  ["keyword", "关键词", "商品关键词", " portable blender "],
  ["asin", "ASIN", "10 位 ASIN", "b012345678"],
  ["product_url", "商品链接", "HTTPS 商品链接", "https://example.test/product"],
] as const) {
  test(`UI2-J01 ${kind} validates native input and sends only the actual create fields`, async ({
    page,
  }) => {
    const data = await ready(page);
    await page.route("**/api/v1/selection-journeys", (route) => {
      const body = route.request().postDataJSON();
      data.journey.input_kind = body.input_kind;
      data.journey.input_value = body.input_value.trim();
      return route.fulfill({ status: 202, json: envelope(data.journey) });
    });
    await page.goto("/opportunities/start");
    const form = page.locator(".selection-start");
    await form.getByRole("radio", { name: radio, exact: true }).check();
    await form.getByRole("button", { name: "创建真实选品任务" }).click();
    await expect(form.getByLabel(field, { exact: true })).toBeFocused();
    expect(data.writes).toHaveLength(0);
    if (kind === "asin") {
      await form.getByLabel(field, { exact: true }).fill("short");
      await form.getByRole("button", { name: "创建真实选品任务" }).click();
      expect(data.writes).toHaveLength(0);
    }
    await form.getByLabel(field, { exact: true }).fill(value);
    await form.getByRole("button", { name: "创建真实选品任务" }).click();
    await expect(page.locator(".selection-status")).toHaveAttribute("data-state", "result_ready");
    expect(data.writes).toHaveLength(1);
    assertPost(data.writes[0], "/selection-journeys", { input_kind: kind, input_value: value });
    expect(await savedId(page)).toBe(journeyId);
    await expect(page.locator(".selection-candidates")).toContainText("已选 0 条");
    await expect(page.getByRole("radio", { name: "采纳并生成机会" })).toBeDisabled();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

test("UI2-J02 invalid stored ID is removed without a journey GET or POST", async ({ page }) => {
  const data = await ready(page, "not-a-uuid");
  await page.goto("/opportunities/start");
  await expect(page.locator(".selection-start")).toBeVisible();
  await expect.poll(() => savedId(page)).toBeNull();
  expect(data.reads).toHaveLength(0);
  expect(data.writes).toHaveLength(0);
});

test("UI2-J03 a missing saved journey clears only its active ID and allows a new input", async ({
  page,
}) => {
  const data = await ready(page, journeyId);
  await page.route(`**/api/v1/selection-journeys/${journeyId}`, (route) =>
    route.fulfill({
      status: 404,
      json: {
        error: {
          code: "selection_journey_not_found",
          message: "记录不存在",
          action_hint: "重新创建任务。",
        },
      },
    }),
  );
  await page.goto("/opportunities/start");
  await expect.poll(() => savedId(page)).toBeNull();
  await expect(page.locator(".selection-start")).toBeVisible();
  await expect(page.locator(".selection-status")).toHaveCount(0);
  expect(data.reads).toHaveLength(1);
  expect(new URL(data.reads[0].url()).pathname).toBe(`/api/v1/selection-journeys/${journeyId}`);
  expect(data.writes).toHaveLength(0);
});

for (const [action, label] of [
  ["observe", "继续观察"],
  ["reject", "驳回"],
] as const) {
  test(`UI2-J04 ${action} sends null candidate and renders the returned verification task without an opportunity`, async ({
    page,
  }) => {
    const data = await ready(page, journeyId);
    await page.route(`**/api/v1/selection-journeys/${journeyId}/decisions`, (route) => {
      const body = route.request().postDataJSON();
      Object.assign(data.journey, {
        state: "decided",
        decided_at: at,
        verification_task_id: id(7630),
        decision: {
          action,
          reason: body.reason.trim(),
          selected_raw_evidence_id: null,
          actor_id: id(7640),
          created_at: at,
        },
      });
      return route.fulfill({ status: 201, json: envelope(data.journey) });
    });
    await page.goto("/opportunities/start");
    await expect(page.locator(".selection-footer")).toContainText("已恢复上次未完成的选品进度。");
    await page.getByText("隔离候选 2", { exact: true }).click();
    const form = page.locator(".selection-decision");
    await form.getByRole("radio", { name: label, exact: true }).check();
    await form.getByRole("button", { name: "保存审计决策" }).click();
    await expect(form.getByLabel("决策原因")).toBeFocused();
    expect(data.writes).toHaveLength(0);
    const reason = "  核对候选后记录判断  ";
    await form.getByLabel("决策原因").fill(reason);
    await form.getByRole("button", { name: "保存审计决策" }).click();
    await expect(page.locator(".selection-status")).toHaveAttribute("data-state", "decided");
    await expect(form).toHaveCount(0);
    await expect(page.locator(".selection-complete h3")).toHaveText(reason.trim());
    await expect(page.getByRole("link", { name: "查看机会、证据与决策历史 ↗" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "打开自动生成的验证任务 ↗" })).toHaveAttribute(
      "href",
      `/tasks/${id(7630)}`,
    );
    expect(await savedId(page)).toBeNull();
    expect(data.writes).toHaveLength(1);
    assertPost(data.writes[0], `/selection-journeys/${journeyId}/decisions`, {
      action,
      reason,
      selected_raw_evidence_id: null,
    });
  });
}

test("UI2-J05 create failure retains input and explicit retry uses a fresh idempotency key", async ({
  page,
}) => {
  const data = await ready(page);
  let attempts = 0;
  await page.route("**/api/v1/selection-journeys", (route) => {
    attempts += 1;
    return attempts === 1
      ? route.fulfill({
          status: 503,
          json: {
            error: {
              code: "service_unavailable",
              message: "暂不可用",
              action_hint: "创建未获得成功确认，请稍后核对。",
            },
            request_id: "ui2-create-failure",
            trace_id: "ui2-create-failure",
          },
        })
      : route.fulfill({ status: 202, json: envelope(data.journey) });
  });
  await page.goto("/opportunities/start");
  const form = page.locator(".selection-start");
  await form.getByLabel("商品关键词", { exact: true }).fill("portable blender");
  await form.getByRole("button", { name: "创建真实选品任务" }).click();
  await expect(page.locator(".ui-state-panel")).toContainText("创建未获得成功确认");
  await expect(form.getByLabel("商品关键词", { exact: true })).toHaveValue("portable blender");
  expect(attempts).toBe(1);
  expect(await savedId(page)).toBeNull();
  await form.getByRole("button", { name: "创建真实选品任务" }).click();
  await expect(page.locator(".selection-status")).toHaveAttribute("data-state", "result_ready");
  expect(data.writes).toHaveLength(2);
  for (const request of data.writes)
    assertPost(request, "/selection-journeys", {
      input_kind: "keyword",
      input_value: "portable blender",
    });
  expect(data.writes[0].headers()["idempotency-key"]).not.toBe(
    data.writes[1].headers()["idempotency-key"],
  );
  // Does not certify duplicate prevention after a server commit with a lost response.
});

test("UI2-J06 accepted journey polls existing ID and uses the server terminal result", async ({
  page,
}) => {
  const data = await ready(page);
  await page.route("**/api/v1/selection-journeys", (route) =>
    route.fulfill({
      status: 202,
      json: envelope({
        ...data.journey,
        state: "accepted",
        task_status: "scheduled",
        results: [],
        first_result: null,
        available_result_count: 0,
        terminal_at: null,
        elapsed_ms: 100,
        timeline: data.journey.timeline.map((step) => ({
          ...step,
          status: step.stage === "queued" ? "completed" : "waiting",
          occurred_at: step.stage === "queued" ? at : null,
        })),
      }),
    }),
  );
  await page.goto("/opportunities/start");
  await page.getByLabel("商品关键词", { exact: true }).fill("portable blender");
  await page.getByRole("button", { name: "创建真实选品任务" }).click();
  await expect(page.locator(".selection-status")).toHaveAttribute("data-state", "accepted");
  await expect(page.locator(".selection-decision")).toHaveCount(0);
  await expect(page.locator(".selection-status")).toHaveAttribute("data-state", "result_ready", {
    timeout: 6000,
  });
  expect(data.reads).toHaveLength(1);
  expect(new URL(data.reads[0].url()).pathname).toBe(`/api/v1/selection-journeys/${journeyId}`);
  expect(data.writes).toHaveLength(1);
  await expect(page.locator(".selection-status")).toContainText("已进行 12 秒");
  await page.getByRole("button", { name: "开始下一次" }).click();
  await expect(page.getByLabel("商品关键词", { exact: true })).toHaveValue("");
  expect(await savedId(page)).toBeNull();
  expect(data.writes).toHaveLength(1);
});
