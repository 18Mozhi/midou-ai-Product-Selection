import { errors, type Page } from "playwright";

/** Public observation context only. Never operates a signed-in address book. */
export async function prepareAmazonDeliveryContext(
  page: Page,
  postalCode: string,
  assertSafe: () => Promise<void>,
  reportStep: (step: string) => void = () => {},
  reread?: () => Promise<void>,
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
  try {
    await page.waitForLoadState("load");
  } catch (error) {
    if (!(error instanceof errors.TimeoutError)) throw error;
    // Deferred page resources may outlive the navigation budget while the
    // location handler is usable. All anonymous, modal and postal guards below
    // still have to pass; this timeout alone never proves page readiness.
    reportStep("page_load_timeout");
  }
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
  const navigation = reread ? undefined : page.waitForNavigation({ waitUntil: "domcontentloaded" });
  void navigation?.catch(() => {});
  await page.locator('button[name="glowDoneButton"]').click();
  if (reread) {
    // Amazon can confirm the new region without refreshing its stale header.
    // Reuse the engine's original-URL reread before requiring that header.
    reportStep("reread_navigation");
    await assertSafe();
    try {
      await reread();
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("net::ERR_ABORTED")) throw error;
      // Done can start a competing main-frame reload. Settle its document and
      // recheck the original guards before one original-URL reread, never a loop.
      reportStep("reread_interrupted_wait");
      await page.waitForLoadState("domcontentloaded");
      await assertAnonymous();
      reportStep("reread_retry");
      await reread();
    }
    await assertAnonymous();
  } else {
    reportStep("location_navigation");
    const headerReady = header.filter({ hasText: postal }).waitFor({ state: "visible" });
    await Promise.any([navigation!, headerReady]).catch(() => headerReady);
    await assertSafe();
  }
  reportStep("verify_header");
  await header.filter({ hasText: postal }).waitFor({ state: "visible" });
  await assertSafe();
  return true;
}
