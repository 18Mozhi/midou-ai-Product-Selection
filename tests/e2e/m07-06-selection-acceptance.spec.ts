import { expect, test, type Page } from "@playwright/test";
const env = (data: any) => ({ data, request_id: "m07-06-e2e", trace_id: "m07-06-e2e" }),
  base = {
    id: "11111111-1111-4111-8111-111111111111",
    organization_id: "22222222-2222-4222-8222-222222222222",
    workspace_id: "33333333-3333-4333-8333-333333333333",
    input_kind: "keyword",
    input_value: "portable blender",
    provider_code: "google_news_search",
    task_id: "44444444-4444-4444-8444-444444444444",
    task_status: "scheduled",
    state: "accepted",
    coverage_status: null,
    available_result_count: 0,
    results: [],
    first_result: null,
    blocked_reason: null,
    decision: null,
    opportunity_id: null,
    accepted_at: "2026-08-10T12:00:00.000Z",
    terminal_at: null,
    decided_at: null,
    elapsed_ms: 1200,
    deadline_ms: 180000,
    within_deadline: true,
    request_id: "m07-06-e2e",
    trace_id: "m07-06-e2e",
  };
async function guard(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=member", (r) =>
    r.fulfill({
      json: env({
        shell: "member",
        organization_id: base.organization_id,
        workspace_id: base.workspace_id,
        roles: ["member"],
        capabilities: ["task:create", "opportunity:read", "opportunity:decide"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "allowed",
      }),
    }),
  );
}
async function scrollTop(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
}
test.beforeEach(async ({ page }) => guard(page));
test("M07-06.A07/A08/A15 member completes real result decision and evidence view on desktop and 390", async ({
  page,
}) => {
  let decided = false;
  const result = {
    ...base,
    task_status: "succeeded",
    state: "result_ready",
    coverage_status: "partial",
    available_result_count: 1,
    first_result: {
      raw_evidence_id: "55555555-5555-4555-8555-555555555555",
      title: "Portable blender market update",
      publisher: "Example News",
      canonical_url: "https://example.com/portable-blender",
      observed_at: "2026-08-10T12:00:12.000Z",
      topic_id: "66666666-6666-4666-8666-666666666666",
    },
    terminal_at: "2026-08-10T12:00:12.000Z",
    elapsed_ms: 12000,
  };
  await page.route("**/api/v1/selection-journeys", (r) =>
    r.request().method() === "POST"
      ? r.fulfill({ status: 202, json: env(base) })
      : r.fulfill({ json: env(decided ? { ...result, state: "decided" } : result) }),
  );
  await page.route(`**/api/v1/selection-journeys/${base.id}`, (r) =>
    r.fulfill({
      json: env(
        decided
          ? {
              ...result,
              state: "decided",
              decision: {
                action: "observe",
                reason: "保留真实来源结果并继续观察",
                actor_id: "77777777-7777-4777-8777-777777777777",
                created_at: "2026-08-10T12:00:20.000Z",
              },
              opportunity_id: "88888888-8888-4888-8888-888888888888",
              decided_at: "2026-08-10T12:00:20.000Z",
            }
          : result,
      ),
    }),
  );
  await page.route(`**/api/v1/selection-journeys/${base.id}/decisions`, (r) => {
    decided = true;
    return r.fulfill({
      status: 201,
      json: env({
        ...result,
        state: "decided",
        decision: {
          action: "observe",
          reason: "保留真实来源结果并继续观察",
          actor_id: "77777777-7777-4777-8777-777777777777",
          created_at: "2026-08-10T12:00:20.000Z",
        },
        opportunity_id: "88888888-8888-4888-8888-888888888888",
        decided_at: "2026-08-10T12:00:20.000Z",
      }),
    });
  });
  await page.goto("/opportunities/start");
  await expect(page.getByRole("heading", { name: "开始一次选品" })).toBeVisible();
  await page.getByPlaceholder("例如 portable blender").fill("portable blender");
  await page.getByRole("button", { name: "创建真实选品任务" }).click();
  await expect(page.getByText("首个可验证结果已到达")).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("link", { name: "查看来源原文 ↗" })).toHaveAttribute(
    "href",
    "https://example.com/portable-blender",
  );
  await scrollTop(page);
  const isMobile = (page.viewportSize()?.width ?? 0) <= 430;
  await page.getByLabel("决策原因").fill("保留真实来源结果并继续观察");
  await page.getByRole("button", { name: "保存审计决策" }).click();
  const decision = page.getByText("决策已保存 · 继续观察");
  await expect(decision).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await decision.evaluate((el) =>
    el.closest("article")?.scrollIntoView({ block: "center", behavior: "instant" }),
  );
});
test("selection journey resumes and adopts only the compared candidate", async ({ page }) => {
  const first = {
      raw_evidence_id: "55555555-5555-4555-8555-555555555551",
      title: "候选一：信息不足",
      publisher: "来源一",
      canonical_url: "https://example.com/candidate-one",
      observed_at: "2026-08-10T12:00:11.000Z",
      topic_id: null,
    },
    second = {
      raw_evidence_id: "55555555-5555-4555-8555-555555555552",
      title: "候选二：可生成机会",
      publisher: "来源二",
      canonical_url: "https://example.com/candidate-two",
      observed_at: "2026-08-10T12:00:12.000Z",
      topic_id: "66666666-6666-4666-8666-666666666666",
    },
    result = {
      ...base,
      task_status: "succeeded",
      state: "result_ready",
      coverage_status: "partial",
      available_result_count: 2,
      results: [first, second],
      first_result: first,
      terminal_at: "2026-08-10T12:00:12.000Z",
      elapsed_ms: 12000,
    };
  let decisionBody: any = null;
  await page.addInitScript(({ key, id }) => localStorage.setItem(key, id), {
    key: "scoutops.selection-journey.active-id",
    id: base.id,
  });
  await page.route(`**/api/v1/selection-journeys/${base.id}`, (route) =>
    route.fulfill({ json: env(result) }),
  );
  await page.route(`**/api/v1/selection-journeys/${base.id}/decisions`, async (route) => {
    decisionBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: env({
        ...result,
        state: "decided",
        decision: {
          action: "adopt",
          reason: "比较后选择候选二",
          selected_raw_evidence_id: second.raw_evidence_id,
          actor_id: "77777777-7777-4777-8777-777777777777",
          created_at: "2026-08-10T12:00:20.000Z",
        },
        opportunity_id: "88888888-8888-4888-8888-888888888888",
        decided_at: "2026-08-10T12:00:20.000Z",
      }),
    });
  });
  await page.goto("/opportunities/start");
  await expect(page.getByText("已恢复上次未完成的选品进度。")).toBeVisible();
  await expect(page.getByText("比较 2 条候选后再生成机会")).toBeVisible();
  await page.getByText("候选二：可生成机会").click();
  await page.getByLabel("采纳并生成机会").check();
  await page.getByLabel("决策原因").fill("比较后选择候选二");
  await page.getByRole("button", { name: "保存审计决策" }).click();
  expect(decisionBody?.selected_raw_evidence_id).toBe(second.raw_evidence_id);
  await expect(page.getByText("决策已保存 · 已采纳")).toBeVisible();
  await expect(page.getByRole("link", { name: "查看机会、证据与决策历史 ↗" })).toBeVisible();
});
test("M07-06.A08/A16 shows succeeded_empty and forbidden without fake evidence", async ({
  page,
}) => {
  let status = 202;
  await page.route("**/api/v1/selection-journeys", (r) =>
    status === 202
      ? r.fulfill({
          status,
          json: env({
            ...base,
            state: "succeeded_empty",
            task_status: "succeeded_empty",
            terminal_at: "2026-08-10T12:00:10.000Z",
            elapsed_ms: 10000,
          }),
        })
      : r.fulfill({
          status,
          json: {
            error: { action_hint: "需要普通成员任务创建权限" },
            request_id: "m07-06-denied",
            trace_id: "m07-06-denied",
          },
        }),
  );
  await page.goto("/opportunities/start");
  await page.getByPlaceholder("例如 portable blender").fill("no result keyword");
  await page.getByRole("button", { name: "创建真实选品任务" }).click();
  await expect(page.getByText("真实来源没有返回可用结果")).toBeVisible();
  await expect(
    page.getByText(/错误码：none。请结合任务状态与事件记录排查阻塞原因。/),
  ).toBeVisible();
  await page.getByRole("button", { name: "开始下一次" }).click();
  status = 403;
  await page.getByPlaceholder("例如 portable blender").fill("denied keyword");
  await page.getByRole("button", { name: "创建真实选品任务" }).click();
  await expect(page.getByText("需要普通成员任务创建权限")).toBeVisible();
});
