import type { Page } from "playwright";

/** Only an explicitly bound, encrypted Amazon cookie bundle may opt in. */
export function validAmazonAdministratorCookies(value: unknown, now = Date.now()): boolean {
  if (!Array.isArray(value) || !value.length || value.length > 500) return false;
  const names = new Set<string>();
  for (const cookie of value) {
    if (
      !cookie ||
      typeof cookie !== "object" ||
      typeof cookie.name !== "string" ||
      typeof cookie.value !== "string" ||
      !cookie.name ||
      cookie.name.length > 128 ||
      cookie.value.length > 8192 ||
      /[\r\n\0]/.test(cookie.name + cookie.value) ||
      ![".amazon.com", "amazon.com", ".www.amazon.com", "www.amazon.com"].includes(cookie.domain) ||
      typeof cookie.path !== "string" ||
      !cookie.path.startsWith("/") ||
      cookie.path.length > 1024 ||
      (cookie.expires !== undefined &&
        (typeof cookie.expires !== "number" ||
          !Number.isFinite(cookie.expires) ||
          (cookie.expires !== -1 && cookie.expires * 1000 <= now)))
    )
      return false;
    if (
      cookie.value &&
      cookie.path === "/" &&
      cookie.secure !== false &&
      (cookie.expires === undefined || cookie.expires === -1 || cookie.expires * 1000 > now)
    )
      names.add(cookie.name);
  }
  return names.has("at-main") && names.has("sess-at-main");
}

/** Check observation region only; never open a signed-in address book or GLUX. */
export async function assertAmazonAdministratorDelivery(
  page: Page,
  postal: string,
  guard: () => Promise<void>,
) {
  await guard();
  if (new URL(page.url()).origin !== "https://www.amazon.com")
    throw new Error("amazon_cookie_origin_invalid");
  if (
    !validAmazonAdministratorCookies(await page.context().cookies("https://www.amazon.com/")) ||
    (await page
      .getByRole("link", { name: "Hello, sign in Account & Lists", exact: true })
      .isVisible())
  )
    throw new Error("amazon_administrator_session_expired");
  await page
    .locator("#glow-ingress-block")
    .filter({ hasText: new RegExp(`\\b${postal}\\b`) })
    .waitFor({ state: "visible" });
  await guard();
}
