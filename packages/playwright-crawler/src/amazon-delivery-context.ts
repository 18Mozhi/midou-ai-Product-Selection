import type { Page } from "playwright";

/** Public observation context only. Never operates a signed-in address book. */
export async function prepareAmazonDeliveryContext(
  page: Page,
  postalCode: string,
  assertSafe: () => Promise<void>,
) {
  if (typeof postalCode !== "string" || !/^\d{5}$/.test(postalCode))
    throw new Error("amazon_delivery_postal_invalid");
  await assertSafe();
  if (
    !(await page
      .getByRole("link", { name: "Hello, sign in Account & Lists", exact: true })
      .isVisible())
  )
    throw new Error("amazon_delivery_requires_anonymous_page");
  const header = page.locator("#glow-ingress-block");
  const postal = new RegExp(`\\b${postalCode}\\b`);
  if (postal.test((await header.textContent()) ?? "")) return false;
  await page.locator("#nav-global-location-popover-link").click();
  await assertSafe();
  await page.locator("#GLUXZipUpdateInput").fill(postalCode);
  await page.locator("#GLUXZipUpdate input").click();
  await page
    .locator("#GLUXZipConfirmationSection")
    .filter({ hasText: postal })
    .waitFor({ state: "visible" });
  await assertSafe();
  await page.locator('button[name="glowDoneButton"]').click();
  await header.filter({ hasText: postal }).waitFor({ state: "visible" });
  await assertSafe();
  return true;
}
