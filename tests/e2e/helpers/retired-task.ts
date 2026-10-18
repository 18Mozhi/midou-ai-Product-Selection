import type { Page } from "@playwright/test";
import { setupRetiredCompetitor } from "./retired-competitor";
export async function setupRetiredTask(page: Page, canReadSelection = true) {
  const calls = await setupRetiredCompetitor(page, canReadSelection);
  await page.route("**/api/v1/me/navigation?shell=member", (route) => {
    calls.push({ path: "/api/v1/me/navigation", method: route.request().method() });
    return route.fulfill({
      json: {
        data: {
          shell: "member",
          organization_id: "00000000-0000-4000-8000-000000000561",
          workspace_id: "00000000-0000-4000-8000-000000000562",
          roles: ["member"],
          capabilities: canReadSelection ? ["task:read", "opportunity:read"] : ["task:read"],
          platform_roles: [],
          platform_capabilities: [],
          guard_reason: "navigation_member_allowed",
        },
        request_id: "retired-task",
        trace_id: "retired-task",
      },
    });
  });
  return calls;
}
