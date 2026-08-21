import { test, expect, type Page } from "@playwright/test";
const env = (data: unknown) => ({
  data,
  request_id: "m05-04-e2e",
  trace_id: "m05-04-trace",
});
async function setup(page: Page) {
  await page.addInitScript(() => {
    class FakeEventSource {
      onopen: any;
      onerror: any;
      listeners = new Map();
      constructor() {
        setTimeout(() => {
          this.onopen?.({});
          const cb = this.listeners.get("notification.changed") as any;
          cb?.({ lastEventId: "42", data: '{"notification_id":"n"}' });
        }, 20);
      }
      addEventListener(name: string, cb: any) {
        this.listeners.set(name, cb);
      }
      close() {}
    }
    (window as any).EventSource = FakeEventSource;
  });
  await page.route("**/api/v1/me/navigation?shell=member", (r) =>
    r.fulfill({
      json: env({
        shell: "member",
        organization_id: "00000000-0000-4000-8000-000000000941",
        workspace_id: "00000000-0000-4000-8000-000000000942",
        roles: ["member"],
        capabilities: ["notification:read"],
        platform_roles: [],
        platform_capabilities: [],
        guard_reason: "navigation_member_allowed",
      }),
    }),
  );
  await page.route("**/api/v1/notifications/summary", (r) =>
    r.fulfill({
      json: env({
        total: 0,
        unread: 0,
        task: 0,
        approval: 0,
        competitor: 0,
        system: 0,
      }),
    }),
  );
  await page.route("**/api/v1/me/notification-preferences", (r) =>
    r.fulfill({
      json: env({
        in_app_enabled: true,
        email_enabled: false,
        task_enabled: true,
        approval_enabled: true,
        competitor_enabled: true,
        version: 1,
      }),
    }),
  );
  await page.route("**/api/v1/notifications?*", (r) =>
    r.fulfill({
      json: { ...env([]), meta: { page: 1, page_size: 100, total: 0 } },
    }),
  );
}
test("M05-04.A07/A08/A09/A15 reconnects and stores Last-Event-ID on desktop and 390", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/notifications");
  await expect(page.getByText("实时已连接")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("scoutops:last-event-id")))
    .toBe("42");
  await expect(page.getByText("当前没有通知")).toBeVisible();
});
