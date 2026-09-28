import { resolve } from "node:path";
import type { Page } from "@playwright/test";

// These are design-review assets from an isolated fixture, not E2E screenshot coverage.
export async function saveP23PaginationReviewImage(
  page: Page,
  width: number,
  state: "first" | "last",
) {
  await page.screenshot({
    path: resolve(
      "design-plans/ui-phase-2-2026-09-07/design/tasks",
      `${width}-P23-pagination-${state}.png`,
    ),
    fullPage: true,
    animations: "disabled",
  });
}
