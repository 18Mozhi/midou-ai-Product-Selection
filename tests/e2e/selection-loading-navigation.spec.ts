import { expect, test } from "@playwright/test";
const envelope = (data: unknown) => ({
  data,
  request_id: "loading-fixture",
  trace_id: "loading-fixture",
});
const search = (id: string) => ({
  id,
  input_type: "opportunity",
  input_ref: id,
  display_name: `找货记录${id}`,
  status: "queued",
  candidate_count: 0,
  missing_fields: [],
  created_at: "2026-11-04T00:00:00Z",
  updated_at: "2026-11-04T00:00:00Z",
});
test("finding records paints before detail, deduplicates current read and cancels superseded detail", async ({
  page,
  baseURL,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let firstReads = 0,
    writes = 0;
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== new URL(baseURL!).origin) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (request.method() !== "GET") {
      writes += 1;
      return route.abort();
    }
    if (url.pathname === "/api/v1/me/navigation")
      return route.fulfill({
        json: envelope({
          shell: "member",
          organization_id: "org",
          workspace_id: "workspace",
          roles: ["member"],
          capabilities: ["sourcing:read", "supplier_quote:manage", "opportunity:read"],
          platform_roles: [],
          platform_capabilities: [],
          guard_reason: "navigation_member_allowed",
        }),
      });
    if (url.pathname === "/api/v1/sourcing/searches")
      return route.fulfill({ json: envelope([search("first"), search("second")]) });
    if (url.pathname === "/api/v1/sourcing/searches/first") {
      firstReads += 1;
      await gate;
      return route
        .fulfill({ json: envelope({ ...search("first"), candidates: [] }) })
        .catch(() => {});
    }
    if (url.pathname === "/api/v1/sourcing/searches/second")
      return route.fulfill({ json: envelope({ ...search("second"), candidates: [] }) });
    return route.fulfill({ json: envelope([]) });
  });
  try {
    await page.goto("/sourcing");
    const records = page.getByRole("complementary", { name: "找货记录", exact: true });
    const first = records.getByRole("button").filter({ hasText: "找货记录first" });
    await expect(first).toBeVisible();
    await expect(page.getByText("正在读取货源报价与采集进度…", { exact: true })).toBeVisible();
    await expect(page.locator(".sourcing-pending")).toHaveCount(0);
    await first.click();
    expect(firstReads).toBe(1);
    await records.getByRole("button").filter({ hasText: "找货记录second" }).click();
    await expect(page.getByRole("region", { name: "找货记录详情" })).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(page.locator(".sourcing-detail h3")).toHaveText("找货记录second");
    release();
    await expect(page.locator(".sourcing-detail h3")).toHaveText("找货记录second");
    expect(writes).toBe(0);
  } finally {
    release();
  }
});
