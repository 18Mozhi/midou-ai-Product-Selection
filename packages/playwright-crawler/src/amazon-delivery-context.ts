import type { Page } from "playwright";

/** Public observation context only. Never operates a signed-in address book. */
export async function prepareAmazonDeliveryContext(
  page: Page,
  postalCode: string,
  assertSafe: () => Promise<void>,
  reportStep: (step: string) => void = () => {},
) {
  if (typeof postalCode !== "string" || !/^\d{5}$/.test(postalCode))
    throw new Error("amazon_delivery_postal_invalid");
  const assertAnonymous = async () => {
    await assertSafe();
    if (
      !(await page
        .getByRole("link", { name: "Hello, sign in Account & Lists", exact: true })
        .isVisible())
    )
      throw new Error("amazon_delivery_requires_anonymous_page");
  };
  reportStep("initial_guard");
  await assertAnonymous();
  reportStep("initial_header");
  const header = page.locator("#glow-ingress-block");
  const postal = new RegExp(`\\b${postalCode}\\b`);
  if (postal.test((await header.textContent()) ?? "")) return false;
  // The visible empty-href link can precede its async modal handler. An early
  // click reloads the page; use the existing navigation budget before acting.
  reportStep("page_load");
  await page.waitForLoadState("load");
  reportStep("loaded_guard");
  await assertAnonymous();
  reportStep("loaded_header");
  if (postal.test((await header.textContent()) ?? "")) return false;
  reportStep("open_location");
  await page.locator("#nav-global-location-popover-link").click();
  await assertSafe();
  reportStep("fill_postal");
  await page.locator("#GLUXZipUpdateInput").fill(postalCode);
  reportStep("apply_postal");
  await page.locator("#GLUXZipUpdate input").click();
  reportStep("confirm_postal");
  await page
    .locator("#GLUXZipConfirmationSection")
    .filter({ hasText: postal })
    .waitFor({ state: "visible" });
  await assertSafe();
  reportStep("finish_location");
  // Done may return before its delayed main-frame reload starts. Register first,
  // using the existing navigation budget; in-place updates can finish directly.
  const navigation = page.waitForNavigation({ waitUntil: "domcontentloaded" });
  void navigation.catch(() => {});
  await page.locator('button[name="glowDoneButton"]').click();
  reportStep("location_navigation");
  const headerReady = header.filter({ hasText: postal }).waitFor({ state: "visible" });
  await Promise.any([navigation, headerReady]).catch(() => headerReady);
  await assertSafe();
  reportStep("verify_header");
  await header.filter({ hasText: postal }).waitFor({ state: "visible" });
  await assertSafe();
  return true;
}
