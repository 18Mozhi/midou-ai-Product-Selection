import type { Page } from "@playwright/test";
export async function setupRetiredCompetitor(page: Page, canReadSelection = true) {
  const calls: Array<{ path: string; method: string }> = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    calls.push({ path, method: request.method() });
    const envelope = (data: unknown, meta?: unknown) => ({
      data,
      meta,
      request_id: "retired-competitor",
      trace_id: "retired-competitor",
    });
    if (path === "/api/v1/me/navigation")
      return route.fulfill({
        json: envelope({
          shell: "member",
          organization_id: "00000000-0000-4000-8000-000000000561",
          workspace_id: "00000000-0000-4000-8000-000000000562",
          roles: ["member"],
          capabilities: canReadSelection
            ? ["opportunity:read", "competitor:read"]
            : ["competitor:read"],
          platform_roles: [],
          platform_capabilities: [],
          guard_reason: "navigation_member_allowed",
        }),
      });
    if (path === "/api/v1/opportunities")
      return route.fulfill({ json: envelope([], { page: 1, page_size: 20, total: 0 }) });
    return route.fulfill({
      status: 503,
      json: {
        error: { code: "dependency_unavailable", action_hint: "Fixture dependency unavailable" },
        request_id: "retired-competitor",
        trace_id: "retired-competitor",
      },
    });
  });
  return calls;
}
export const isStandaloneCompetitorRead = (path: string) =>
  /^\/api\/v1\/(?:competitors|competitor-monitor-rules)(?:\/|$)/.test(path);
