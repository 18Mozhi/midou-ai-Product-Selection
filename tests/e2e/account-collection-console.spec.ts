import { expect, test } from "@playwright/test";
import { collectionConsoleHttpFacts } from "../fixtures/collection-console-http.mjs";

test("account collection overview drops retired URL filters but keeps provider and original task facts", async ({
  page,
}) => {
  const envelope = (data: unknown) => ({ data, request_id: "fixture", trace_id: "fixture" });
  const reads: URL[] = [];
  const original = "00000000-0000-4000-8000-000000000637";
  await page.route("**/api/v1/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/me/navigation"))
      return route.fulfill({
        json: envelope({
          shell: "platform_admin",
          account_rehearsal: true,
          organization_id: null,
          workspace_id: null,
          roles: [],
          capabilities: [],
          platform_roles: ["platform_super_admin"],
          platform_capabilities: ["platform:operate", "platform:superadmin", "collection:replay"],
          guard_reason: "navigation_platform_admin_allowed",
        }),
      });
    if (url.pathname.endsWith("/platform/collection/console")) {
      reads.push(url);
      const facts = collectionConsoleHttpFacts({ attemptPage: 1, deadLetterPage: 1 });
      return route.fulfill({
        json: envelope({
          ...facts,
          dead_letters: [
            {
              id: "dead-original",
              task_id: original,
              account_id: "account-owner",
              error_code: "parser_failed",
              status: "open",
              created_at: "2026-10-15T01:00:00Z",
            },
          ],
        }),
      });
    }
    return route.fulfill({ json: envelope({ authenticated: true, account_rehearsal: true }) });
  });
  await page.goto(
    "/platform-admin/collection/overview?organization_id=removed&workspace_id=removed&window=7d",
  );
  await expect(page.locator(".collection-ops")).toContainText("HTTP 验证公开趋势 RSS");
  await expect(page.getByRole("link", { name: "查看并重放" })).toHaveAttribute(
    "href",
    `/platform-admin/collection?task=${original}`,
  );
  await expect(page.getByLabel("组织内部编号筛选")).toHaveCount(0);
  await expect(page.getByLabel("工作区内部编号筛选")).toHaveCount(0);
  await expect(page).toHaveURL(/\/platform-admin\/collection\/overview\?window=7d$/);
  expect(reads).toHaveLength(1);
  expect(reads[0]?.searchParams.get("window")).toBe("7d");
  expect(reads[0]?.searchParams.has("organization_id")).toBe(false);
  expect(reads[0]?.searchParams.has("workspace_id")).toBe(false);
});
