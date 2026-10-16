import type { Page, TestInfo } from "@playwright/test";

// Fixture review images belong to this test run; never overwrite historical design assets.
export async function saveP23PaginationReviewImage(
  page: Page,
  width: number,
  state: "first" | "last",
  testInfo: TestInfo,
) {
  await page.screenshot({
    path: testInfo.outputPath(`${width}-P23-pagination-${state}.png`),
    fullPage: true,
    animations: "disabled",
  });
}
