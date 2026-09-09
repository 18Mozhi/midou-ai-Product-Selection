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
