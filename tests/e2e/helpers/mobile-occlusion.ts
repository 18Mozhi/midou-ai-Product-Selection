import { expect, type Locator, type Page } from "@playwright/test";

export async function expectAboveMobileNavigation(page: Page, content: Locator) {
  await expect(content).toBeVisible();
  await content.scrollIntoViewIfNeeded();
  const measurement = await page.evaluate((selector) => {
    const navigation = document.querySelector(selector);
    if (!(navigation instanceof HTMLElement)) return { found: false, overlap: -1 };
    const point = document.elementFromPoint(
      Math.min(window.innerWidth - 1, Math.max(1, window.innerWidth / 2)),
      Math.max(1, navigation.getBoundingClientRect().top - 1),
    );
    const contentElement = document.querySelector<HTMLElement>("[data-occlusion-probe]");
    if (!contentElement) return { found: true, overlap: Number.POSITIVE_INFINITY };
    const contentRect = contentElement.getBoundingClientRect();
    const navigationRect = navigation.getBoundingClientRect();
    return {
      found: true,
      overlap: Math.max(0, contentRect.bottom - navigationRect.top),
      pointBelongsToNavigation: navigation.contains(point),
    };
  }, ".role-mobile-nav");
  expect(measurement.found).toBe(true);
  expect(measurement.overlap).toBe(0);
  expect(measurement.pointBelongsToNavigation).toBe(false);
}

export async function markOcclusionProbe(content: Locator) {
  await content.evaluate((element) => element.setAttribute("data-occlusion-probe", "true"));
}
