import { expect, test, type Page } from "@playwright/test";

// Real Vue and router, scoped synthetic API responses. No external collection or SQL.
const aId = "00000000-0000-4000-8000-000000000591";
const bId = "00000000-0000-4000-8000-000000000592";
const taskId = "00000000-0000-4000-8000-000000000593";
const envelope = (data: unknown) => ({
  data,
  request_id: "competitor-race-request",
  trace_id: "competitor-race-trace",
});
const makeItem = (id: string, title: string) => ({
  id,
  title,
  market: "US",
  source_site: "amazon.com",
  external_id: id === aId ? "B000000001" : "B000000002",
  product_url: "https://example.test/" + id,
  status: "active",
  revision: 7,
  snapshot_count: 0,
  latest_snapshot: null,
  snapshots: [],
  changes: [],
  alerts: [],
  latest_collection: {
    task_id: "old-" + id,
    status: "succeeded",
    last_error_code: null,
    attempt_count: 1,
    available_result_count: 0,
    updated_at: "2026-09-09T00:00:00Z",
  },
});
const a = makeItem(aId, "竞品 A"),
  b = makeItem(bId, "竞品 B");
const gate = () => {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release };
};
async function setup(page: Page) {
  await page.route("**/api/v1/me/navigation?shell=member", (route) =>
    route.fulfill({
      json: envelope({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000501",
        workspace_id: "00000000-0000-4000-8000-000000000502",
        roles: ["member"],
        capabilities: ["competitor:read", "competitor:manage"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/competitor-monitor-rules", (route) =>
    route.fulfill({ json: envelope([]) }),
  );
  await page.route("**/api/v1/competitors", (route) => route.fulfill({ json: envelope([a, b]) }));
  for (const item of [a, b])
    await page.route(`**/api/v1/competitors/${item.id}`, (route) =>
      route.fulfill({ json: envelope(item) }),
    );
  const loaded = page.waitForResponse((response) => response.url().endsWith("/competitors/" + aId));
  await page.goto("/competitors");
  await loaded;
  await expect(page.locator(".competitor-detail h3")).toHaveText(a.title);
}
async function settleResponse(page: Page) {
  // Two render frames after the controlled response has finished, not an arbitrary network sleep.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
for (const outcome of ["success", "failure"] as const) {
  test(`UI2-CP-RACE01 late detail ${outcome} cannot replace newer selection or feedback`, async ({
    page,
  }) => {
    await setup(page);
    const started = gate(),
      release = gate();
    await page.route(`**/api/v1/competitors/${aId}`, async (route) => {
      started.release();
      await release.wait;
      if (outcome === "success") await route.fulfill({ json: envelope(a) });
      else
        await route.fulfill({
          status: 404,
          json: {
            error: { code: "competitor_not_found", message: "旧 A 读取失败" },
            request_id: "old-a-failure",
          },
        });
    });
    try {
      await page.locator(".competitor-list button").filter({ hasText: a.title }).click();
      await started.wait;
      await page.locator(".competitor-list button").filter({ hasText: b.title }).click();
      await expect(page).toHaveURL(new RegExp(`competitor=${bId}`));
      const oldResponse = page.waitForResponse((response) =>
        response.url().endsWith("/competitors/" + aId),
      );
      release.release();
      await (await oldResponse).finished();
      await settleResponse(page);
      await expect(page.locator(".competitor-detail h3")).toHaveText(b.title);
      await expect(page).toHaveURL(new RegExp(`competitor=${bId}`));
      await expect(page.locator(".competitor-notice")).toHaveCount(0);
    } finally {
      release.release();
    }
  });
}
test("UI2-CP-RACE02 collection acceptance belongs to submitted competitor across selection changes", async ({
  page,
}) => {
  await setup(page);
  const started = gate(),
    release = gate();
  const posts: Array<{ url: string; body: unknown }> = [];
  await page.route(`**/api/v1/competitors/${aId}/collect`, async (route) => {
    posts.push({
      url: new URL(route.request().url()).pathname,
      body: route.request().postDataJSON(),
    });
    started.release();
    await release.wait;
    await route.fulfill({ json: envelope({ task_id: taskId, status: "queued" }) });
  });
  try {
    await page.getByRole("button", { name: "重新尝试首次采集" }).click();
    await started.wait;
    await page.locator(".competitor-list button").filter({ hasText: b.title }).click();
    await expect(page).toHaveURL(new RegExp(`competitor=${bId}`));
    const response = page.waitForResponse((r) => r.url().endsWith(`/${aId}/collect`));
    release.release();
    await (await response).finished();
    await settleResponse(page);
    await expect(page.locator(".competitor-detail h3")).toHaveText(b.title);
    await expect(page.getByRole("button", { name: "重新尝试首次采集" })).toBeEnabled();
    await expect(page.locator(".competitor-detail")).not.toContainText(taskId);
    await expect(page.locator(".competitor-notice")).toHaveCount(0);
    expect(posts).toEqual([{ url: `/api/v1/competitors/${aId}/collect`, body: {} }]);

    // The old server detail must not erase the accepted A task when returning to A.
    await page.locator(".competitor-list button").filter({ hasText: a.title }).click();
    await expect(page).toHaveURL(new RegExp(`competitor=${aId}`));
    await expect(page.getByRole("button", { name: "采集中…" })).toBeDisabled();
    await expect(page.locator(".competitor-collection-state")).toContainText(taskId);
  } finally {
    release.release();
  }
});

test("UI2-CP-RACE03 old collection failure cannot show on a different competitor", async ({
  page,
}) => {
  await setup(page);
  const started = gate(),
    release = gate();
  await page.route(`**/api/v1/competitors/${aId}/collect`, async (route) => {
    started.release();
    await release.wait;
    await route.fulfill({
      status: 409,
      json: {
        error: { code: "competitor_conflict", action_hint: "A 的采集冲突" },
        request_id: "old-a-collect",
      },
    });
  });
  try {
    await page.getByRole("button", { name: "重新尝试首次采集" }).click();
    await started.wait;
    await page.locator(".competitor-list button").filter({ hasText: b.title }).click();
    await expect(page).toHaveURL(new RegExp(`competitor=${bId}`));
    const response = page.waitForResponse((r) => r.url().endsWith(`/${aId}/collect`));
    release.release();
    await (await response).finished();
    await settleResponse(page);
    await expect(page.getByRole("button", { name: "重新尝试首次采集" })).toBeEnabled();
    await expect(page.locator(".competitor-notice")).toHaveCount(0);
    await expect(page.locator(".competitor-detail h3")).toHaveText(b.title);
  } finally {
    release.release();
  }
});

test("UI2-CP-RACE04 returning to the same ID still rejects an older read generation", async ({
  page,
}) => {
  await setup(page);
  const started = gate(),
    release = gate();
  let reads = 0;
  await page.route(`**/api/v1/competitors/${aId}`, async (route) => {
    reads += 1;
    if (reads === 1) {
      started.release();
      await release.wait;
      await route.fulfill({ json: envelope(a) });
    } else await route.fulfill({ json: envelope({ ...a, title: "竞品 A 新版本" }) });
  });
  try {
    await page.locator(".competitor-list button").filter({ hasText: a.title }).click();
    await started.wait;
    await page.locator(".competitor-list button").filter({ hasText: b.title }).click();
    await expect(page).toHaveURL(new RegExp(`competitor=${bId}`));
    await page.locator(".competitor-list button").filter({ hasText: a.title }).click();
    await expect(page.locator(".competitor-detail h3")).toHaveText("竞品 A 新版本");
    const response = page.waitForResponse((r) => r.url().endsWith(`/competitors/${aId}`));
    release.release();
    await (await response).finished();
    await settleResponse(page);
    await expect(page.locator(".competitor-detail h3")).toHaveText("竞品 A 新版本");
    await expect(page).toHaveURL(new RegExp(`competitor=${aId}`));
    expect(reads).toBe(2);
  } finally {
    release.release();
  }
});

test("UI2-CP-G04 follows browser route-query changes for competitor detail and search", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate((competitorId) => {
    history.pushState({}, "", `/competitors?competitor=${competitorId}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, bId);
  await expect(page).toHaveURL(new RegExp(`competitor=${bId}`));
  await expect(page.locator(".competitor-detail h3")).toHaveText(b.title);

  await page.evaluate(() => {
    history.pushState({}, "", "/competitors?q=B000000002");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/q=B000000002/);
  await expect(page.getByRole("searchbox", { name: "搜索竞品" })).toHaveValue("B000000002");
  await expect(page.locator(".competitor-list button")).toHaveCount(1);
  await expect(page.locator(".competitor-list button").first()).toContainText(b.title);

  await page.evaluate(() => {
    history.pushState({}, "", "/competitors?create=1");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("heading", { name: "添加竞品监控" })).toBeVisible();
  await page.evaluate(() => {
    history.pushState({}, "", "/competitors");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("heading", { name: "添加竞品监控" })).toHaveCount(0);

  await page.evaluate((competitorId) => {
    history.pushState({}, "", `/competitors/monitoring-rules?competitor=${competitorId}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, bId);
  await expect(page.getByRole("heading", { name: "新建监控规则" })).toBeVisible();
  await expect(page.getByLabel("竞品（留空为工作区全局）")).toHaveValue(bId);
  await page.evaluate(() => {
    history.pushState({}, "", "/competitors/monitoring-rules");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("heading", { name: "新建监控规则" })).toHaveCount(0);
});

test("UI2-CP-G05 ignores duplicate create submits and keeps a reopened form after the old success", async ({
  page,
}) => {
  await setup(page);
  const started = gate(),
    release = gate();
  const posts: Array<{ body: unknown }> = [];
  await page.route("**/api/v1/competitors", async (route) => {
    if (route.request().method() === "GET") return route.fallback();
    posts.push({ body: route.request().postDataJSON() });
    started.release();
    await release.wait;
    await route.fulfill({
      json: envelope(makeItem("00000000-0000-4000-8000-000000000594", "新建竞品")),
    });
  });

  try {
    await page.getByRole("button", { name: "添加竞品", exact: true }).click();
    let dialog = page.getByRole("dialog", { name: "添加竞品监控" });
    await dialog.getByLabel("商品网址").fill("https://www.amazon.com/dp/B000000003");
    await dialog.getByRole("button", { name: "下一步" }).click();
    await dialog.getByLabel("市场").fill("US");
    await dialog.getByLabel("监控名称").fill("延迟创建竞品");
    await dialog.getByRole("button", { name: "下一步" }).click();
    await dialog.getByRole("button", { name: "确认并开始采集" }).click();
    await started.wait;

    await dialog.locator("form").evaluate((form) => {
      (form as HTMLFormElement).requestSubmit();
      (form as HTMLFormElement).requestSubmit();
    });
    await expect.poll(() => posts).toHaveLength(1);
    await dialog.getByRole("button", { name: "关闭新建竞品" }).click();
    await page.getByRole("button", { name: "添加竞品", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "添加竞品监控" });
    await expect(dialog.getByLabel("商品网址")).toHaveValue("https://www.amazon.com/dp/B000000003");

    const response = page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/v1/competitors") && candidate.request().method() === "POST",
    );
    release.release();
    await (await response).finished();
    await settleResponse(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("商品网址")).toHaveValue("https://www.amazon.com/dp/B000000003");
    await expect(
      page.getByText("已关闭表单对应的竞品创建操作已成功；当前表单保持不变。"),
    ).toBeVisible();
    expect(posts).toEqual([
      {
        body: {
          market: "US",
          product_url: "https://www.amazon.com/dp/B000000003",
          title: "延迟创建竞品",
        },
      },
    ]);
  } finally {
    release.release();
  }
});

test("UI2-CP-G05 late delete for A cannot clear B's selected detail", async ({ page }) => {
  await setup(page);
  const started = gate(),
    release = gate();
  const deletes: Array<{ url: string; body: unknown }> = [];
  await page.route("**/api/v1/competitors", (route) =>
    route.request().method() === "GET" ? route.fulfill({ json: envelope([b]) }) : route.fallback(),
  );
  await page.route(`**/api/v1/competitors/${aId}`, async (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    deletes.push({
      url: new URL(route.request().url()).pathname,
      body: route.request().postDataJSON(),
    });
    started.release();
    await release.wait;
    await route.fulfill({ json: envelope({ deleted: true }) });
  });
  const openDeleteForCurrent = async () => {
    const actions = page.locator(".competitor-mobile-actions");
    if (await actions.isVisible())
      await actions.evaluate((element: HTMLDetailsElement) => {
        element.open = true;
      });
    await page.getByRole("button", { name: "删除竞品监控", exact: true }).click();
  };

  try {
    await openDeleteForCurrent();
    let dialog = page.getByRole("dialog", { name: "删除竞品监控" });
    await dialog.getByLabel("删除原因").fill("停止跟踪 A");
    await dialog.getByRole("button", { name: "确认删除" }).click();
    await started.wait;
    await dialog.getByRole("button", { name: "关闭删除确认" }).click();
    await page.locator(".competitor-list button").filter({ hasText: b.title }).click();
    await expect(page.locator(".competitor-detail h3")).toHaveText(b.title);
    const actions = page.locator(".competitor-mobile-actions");
    if (await actions.isVisible())
      await actions.evaluate((element: HTMLDetailsElement) => {
        element.open = true;
      });
    await expect(page.getByRole("button", { name: "删除竞品监控", exact: true })).toBeDisabled();

    const response = page.waitForResponse((candidate) =>
      candidate.url().endsWith(`/api/v1/competitors/${aId}`),
    );
    release.release();
    await (await response).finished();
    await settleResponse(page);
    await expect(page.getByRole("dialog", { name: "删除竞品监控" })).toHaveCount(0);
    await expect(page.locator(".competitor-list button")).toHaveCount(1);
    await expect(page.locator(".competitor-detail h3")).toHaveText(b.title);
    await expect(page.getByText(`竞品「${a.title}」已删除；当前显示对象保持不变。`)).toBeVisible();
    expect(deletes).toEqual([
      {
        url: `/api/v1/competitors/${aId}`,
        body: { expected_revision: 7, reason: "停止跟踪 A" },
      },
    ]);
  } finally {
    release.release();
  }
});
