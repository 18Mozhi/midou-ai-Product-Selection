import { expect, test, type Page } from "@playwright/test";
const envelope = (data: unknown) => ({
  data,
  request_id: "paged-fixture",
  trace_id: "paged-fixture",
});
const row = (i: number) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  input_type: "keyword",
  input_ref: i === 83 ? "跨页目标商品" : `找货记录${i}`,
  display_name: i === 83 ? "跨页目标商品" : `找货记录${i}`,
  status: "queued",
  candidate_count: 0,
  missing_fields: [],
  created_at: "2026-11-04T00:00:00Z",
  updated_at: "2026-11-04T00:00:00Z",
});
async function setup(page: Page, baseURL: string) {
  const all = Array.from({ length: 95 }, (_, i) => row(i + 1)),
    reads: Array<{ page: string | null; q: string | null; record: string | null }> = [],
    writes: string[] = [];
  let denied = false;
  let blocked: string | null = null,
    release: () => void = () => {},
    gate: Promise<void> = Promise.resolve();
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== new URL(baseURL).origin) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (request.method() !== "GET") {
      writes.push(url.pathname);
      return route.abort();
    }
    if (url.pathname === "/api/v1/me/navigation")
      return route.fulfill({
        json: envelope({
          shell: "member",
          organization_id: "org",
          workspace_id: "ws",
          roles: ["member"],
          capabilities: ["sourcing:read", "opportunity:read"],
          platform_roles: [],
          platform_capabilities: [],
          guard_reason: "navigation_member_allowed",
        }),
      });
    if (url.pathname === "/api/v1/sourcing/searches") {
      if (denied)
        return route.fulfill({
          status: 403,
          json: {
            error: { code: "forbidden", action_hint: "访问已撤销" },
            request_id: "denied-fixture",
          },
        });
      expect(url.searchParams.get("page_size")).toBe("20");
      const q = url.searchParams.get("q") ?? "",
        record = url.searchParams.get("record");
      reads.push({ page: url.searchParams.get("page"), q, record });
      if (q === blocked) await gate;
      const filtered = all.filter((r) =>
        `${r.display_name} ${r.input_ref} ${r.status}`.toLowerCase().includes(q.toLowerCase()),
      );
      const index = record ? filtered.findIndex((r) => r.id === record) : -1;
      const pageNumber = Math.min(
        index >= 0 ? Math.floor(index / 20) + 1 : Number(url.searchParams.get("page") ?? 1),
        Math.max(1, Math.ceil(filtered.length / 20)),
      );
      return route
        .fulfill({
          json: {
            ...envelope(filtered.slice((pageNumber - 1) * 20, pageNumber * 20)),
            meta: {
              page: pageNumber,
              page_size: 20,
              total: filtered.length,
              summary: { total: 95, running: 95, candidates: 0, ready: 0 },
            },
          },
        })
        .catch(() => {});
    }
    if (url.pathname.startsWith("/api/v1/sourcing/searches/")) {
      const r = all.find((r) => url.pathname.endsWith(r.id));
      return route.fulfill({ json: envelope({ ...r, candidates: [] }) });
    }
    return route.fulfill({ json: envelope([]) });
  });
  return {
    reads,
    writes,
    deny() {
      denied = true;
    },
    hold(q: string) {
      blocked = q;
      gate = new Promise<void>((r) => (release = r));
    },
    release() {
      release();
    },
  };
}
test("paged records request only20 rows, retain whole-workspace counts and support next/back", async ({
  page,
  baseURL,
}) => {
  const h = await setup(page, baseURL!);
  await page.goto("/sourcing?page=2");
  const list = page.getByRole("complementary", { name: "找货记录", exact: true });
  await expect(list.getByRole("button").filter({ hasText: "找货记录21" })).toBeVisible();
  await expect(list.locator(".sourcing-record-items > button")).toHaveCount(20);
  await expect(
    list.getByRole("button").filter({ hasText: "找货记录1", hasNotText: "找货记录2" }),
  ).toHaveCount(0);
  await expect(page.locator(".sourcing-summary").getByText("95", { exact: true })).toHaveCount(2);
  await list.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(list.getByRole("button").filter({ hasText: "找货记录41" })).toBeVisible();
  await expect(page).toHaveURL(/page=3/);
  await page.goBack();
  await expect(list.getByRole("button").filter({ hasText: "找货记录21" })).toBeVisible();
  expect(h.reads.every((r) => r.page !== null)).toBe(true);
  expect(h.writes).toEqual([]);
});
test("search is debounced and reaches records outside the currently loaded page", async ({
  page,
  baseURL,
}) => {
  const h = await setup(page, baseURL!);
  await page.goto("/sourcing");
  await expect(page.locator(".sourcing-record-items > button")).toHaveCount(20);
  const input = page.getByRole("searchbox", { name: "搜索找货记录" });
  await input.fill("跨");
  await input.fill("跨页目标");
  await expect(page.locator(".sourcing-record-items > button")).toHaveCount(1);
  await expect(page.getByRole("button").filter({ hasText: "跨页目标商品" })).toBeVisible();
  expect(h.reads.filter((r) => r.q)).toEqual([{ page: "1", q: "跨页目标", record: null }]);
  await expect(page.locator(".sourcing-toolbar")).toContainText("共 1 条结果");
  await input.fill("没有匹配商品");
  await expect(page.getByText("没有匹配的找货记录", { exact: true })).toBeVisible();
  await expect(page.locator(".sourcing-summary").getByText("95", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "清空搜索", exact: true }).click();
  await expect(page.locator(".sourcing-record-items > button")).toHaveCount(20);
  expect(h.writes).toEqual([]);
});
test("deep-link and oversized page normalization are server authoritative", async ({
  page,
  baseURL,
}) => {
  const h = await setup(page, baseURL!);
  await page.goto(`/sourcing?record=${row(83).id}`);
  await expect(page.locator(".sourcing-detail h3")).toHaveText("跨页目标商品");
  await expect(page.getByRole("navigation", { name: "找货记录分页" })).toContainText("5 / 5");
  expect(h.reads[0].record).toBe(row(83).id);
  expect(h.reads[0].page).toBeNull();
  await page.goto("/sourcing?page=99");
  await expect(page).toHaveURL(/page=5/);
  await expect(page.locator(".sourcing-record-items > button")).toHaveCount(15);
});
test("a slow superseded search cannot replace a newer result", async ({ page, baseURL }) => {
  const h = await setup(page, baseURL!);
  await page.goto("/sourcing");
  await expect(page.locator(".sourcing-record-items > button")).toHaveCount(20);
  h.hold("等待");
  const input = page.getByRole("searchbox", { name: "搜索找货记录" });
  await input.fill("等待");
  await expect.poll(() => h.reads.some((r) => r.q === "等待")).toBe(true);
  // Search remains reachable in the persistent toolbar while list data is loading.
  await input.fill("跨页目标");
  await expect(page.locator(".sourcing-detail h3")).toHaveText("跨页目标商品");
  h.release();
  await expect(page.locator(".sourcing-record-items > button")).toHaveCount(1);
  expect(h.writes).toEqual([]);
});

test("access revocation clears previously rendered paged records and global summary", async ({
  page,
  baseURL,
}) => {
  const h = await setup(page, baseURL!);
  await page.goto("/sourcing");
  await expect(page.locator(".sourcing-record-items > button")).toHaveCount(20);
  h.deny();
  await page.getByRole("button", { name: "刷新记录", exact: true }).click();
  await expect(page.locator('.ui-state-panel[data-kind="forbidden"]')).toBeVisible();
  await expect(page.locator(".sourcing-record-items > button")).toHaveCount(0);
  await expect(page.locator(".sourcing-summary")).toHaveCount(0);
  expect(h.writes).toEqual([]);
});

test("browser back cancels an uncommitted debounce and restores the page filter", async ({
  page,
  baseURL,
}) => {
  await page.clock.install();
  const h = await setup(page, baseURL!);
  await page.goto("/sourcing?page=2");
  await expect(page.locator(".sourcing-record-items > button").first()).toContainText("找货记录21");
  await page
    .getByRole("navigation", { name: "找货记录分页" })
    .getByRole("button", { name: "下一页", exact: true })
    .click();
  await expect(page.locator(".sourcing-record-items > button").first()).toContainText("找货记录41");
  await page.getByRole("searchbox", { name: "搜索找货记录" }).fill("跨页目标");
  await page.goBack();
  await page.clock.runFor(400);
  await expect(page.locator(".sourcing-record-items > button").first()).toContainText("找货记录21");
  await expect(page.getByRole("searchbox", { name: "搜索找货记录" })).toHaveValue("");
  expect(h.reads.filter((r) => r.q)).toEqual([]);
});
