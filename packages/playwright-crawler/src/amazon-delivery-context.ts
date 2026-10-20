import { errors, type Page, type Frame } from "playwright";

/** Public observation context only. Never operates a signed-in address book. */
export async function prepareAmazonDeliveryContext(
  page: Page,
  postalCode: string,
  assertSafe: () => Promise<void>,
  reportStep: (step: string) => void = () => {},
  reread?: () => Promise<void>,
  navigationTimeoutMs?: number,
) {
  if (typeof postalCode !== "string" || !/^\d{5}$/.test(postalCode))
    throw new Error("amazon_delivery_postal_invalid");
  const assertAnonymous = async (includeAriaHidden = false) => {
    await assertSafe();
    if (
      !(await page
        .getByRole("link", {
          name: "Hello, sign in Account & Lists",
          exact: true,
          includeHidden: includeAriaHidden,
        })
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
  let locationReloaded = false;
  const observeReload = (frame: Frame) => {
    if (frame === page.mainFrame()) locationReloaded = true;
  };
  page.on?.("framenavigated", observeReload);
  const fillPostal = () =>
    page
      .locator("#GLUXZipUpdateInput")
      .fill(
        postalCode,
        navigationTimeoutMs === undefined ? undefined : { timeout: navigationTimeoutMs },
      );
  try {
    await page.locator("#nav-global-location-popover-link").click();
    await assertSafe();
    reportStep("fill_postal");
    try {
      await fillPostal();
    } catch (error) {
      // An actual main-frame reload, not the absence of an input or a timeout
      // alone, permits one guarded reopening of the asynchronous empty-href link.
      if (!(error instanceof errors.TimeoutError) || !locationReloaded) throw error;
      reportStep("location_reload_guard");
      await page.waitForLoadState("load");
      await assertAnonymous();
      if (postal.test((await header.textContent()) ?? "")) return false;
      if (!(await page.locator("#GLUXZipUpdateInput").isVisible())) {
        reportStep("location_reload_reopen");
        await page.locator("#nav-global-location-popover-link").click();
        await assertSafe();
      }
      reportStep("fill_postal_retry");
      await fillPostal();
    }
  } finally {
    page.off?.("framenavigated", observeReload);
  }
  reportStep("apply_postal");
  await page.locator("#GLUXZipUpdate input").click();
  reportStep("confirm_postal");
  let postalFormClosed = false;
  try {
    const confirmation = page
      .locator("#GLUXZipConfirmationSection")
      .filter({ hasText: postal })
      .waitFor({ state: "visible" });
    if (reread) {
      // Both are actual DOM observations. A closed form still proves no region:
      // it only permits the existing anonymous guard and protected URL reread.
      const formDetached = await Promise.any([
        confirmation.then(() => false),
        page
          .locator("#GLUXZipUpdateInput")
          .waitFor({ state: "detached" })
          .then(() => true),
      ]).catch((error: unknown) => {
        // Preserve the original confirmation error and its TimeoutError contract.
        if (error instanceof AggregateError) throw error.errors[0];
        throw error;
      });
      if (formDetached && (await page.locator("#GLUXZipUpdateInput").count()) === 0) {
        postalFormClosed = true;
      } else {
        // A transient detach/reinsert cannot replace confirmation.
        await confirmation;
      }
    } else {
      await confirmation;
    }
  } catch (error) {
    if (
      !(error instanceof errors.TimeoutError) ||
      !reread ||
      (await page.locator("#GLUXZipUpdateInput").count()) !== 0
    )
      throw error;
    // Some pages close the postal form without the legacy confirmation/Done.
    // Its absence proves nothing: only the original-URL reread and final strict
    // postal header can establish the observation region below.
    postalFormClosed = true;
  }
  if (postalFormClosed) {
    reportStep("postal_form_closed_guard");
    // A confirmation overlay can aria-hide the still CSS-visible account link.
    // This branch still requires its exact anonymous label and CSS visibility.
    await assertAnonymous(true);
  }
  await assertSafe();
  if (!postalFormClosed) reportStep("finish_location");
  // Done may return before its delayed main-frame reload starts. Register first,
  // using the existing navigation budget; in-place updates can finish directly.
  const navigation = reread ? undefined : page.waitForNavigation({ waitUntil: "domcontentloaded" });
  void navigation?.catch(() => {});
  if (!postalFormClosed) await page.locator('button[name="glowDoneButton"]').click();
  if (reread) {
    // Amazon can confirm the new region without refreshing its stale header.
    // Reuse the engine's original-URL reread before requiring that header.
    reportStep("reread_navigation");
    await assertSafe();
    try {
      await reread();
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("net::ERR_ABORTED")) throw error;
      // Done can start a competing main-frame reload. Observe that navigation and
      // recheck the original guards before one original-URL reread, never a loop.
      reportStep("reread_interrupted_wait");
      await page.waitForEvent(
        "domcontentloaded",
        navigationTimeoutMs === undefined ? undefined : { timeout: navigationTimeoutMs },
      );
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
