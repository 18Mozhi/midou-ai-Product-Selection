import type { APIResponse, Page } from "playwright";

export class AmazonDeliveryRequestError extends Error {
  constructor(
    readonly status: "blocked_captcha" | "blocked_login" | "rate_limited" | "dependency_failed",
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
  }
}

async function checked(response: APIResponse) {
  try {
    const body = await response.text();
    const url = new URL(response.url());
    if (url.origin !== "https://www.amazon.com")
      throw new AmazonDeliveryRequestError("dependency_failed", "permission_denied", false);
    if (response.status() === 429)
      throw new AmazonDeliveryRequestError("rate_limited", "rate_limited", true);
    const markup = body.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
    if (
      /<form\b[^>]*action\s*=\s*["'][^"']*validateCaptcha|<input\b[^>]*(?:id|name)\s*=\s*["']captchacharacters["']|<meta\b[^>]*content\s*=\s*["'][^"']*bm-verify/i.test(
        markup,
      )
    )
      throw new AmazonDeliveryRequestError("blocked_captcha", "blocked_captcha", false);
    if (response.status() === 401 || /^\/ap\/signin(?:\/|$)/.test(url.pathname))
      throw new AmazonDeliveryRequestError("blocked_login", "blocked_login", false);
    if (response.status() !== 200)
      throw new AmazonDeliveryRequestError(
        "dependency_failed",
        response.status() >= 500 ? "network_error" : "permission_denied",
        response.status() >= 500,
      );
    if (body.length > 1_048_576)
      throw new AmazonDeliveryRequestError("dependency_failed", "invalid_payload", false);
    return body;
  } finally {
    await response.dispose().catch(() => {});
  }
}

/** Port of Xingxing's provider-issued modal/CSRF chain. Uses only this anonymous
 * browser's request jar, never an imported account cookie or an address book. */
export async function requestAmazonDeliveryContext(page: Page, postal: string, timeout: number) {
  if (!/^\d{5}$/.test(postal)) throw new Error("amazon_delivery_postal_invalid");
  // Older test/adapter pages may not expose the request transport or modal data.
  if (!page.request) return false;
  if ((await page.locator("#nav-global-location-data-modal-action").count()) === 0) return false;
  const raw = await page
    .locator("#nav-global-location-data-modal-action")
    .getAttribute("data-a-modal");
  if (!raw) return false;
  let modal: { url?: unknown; ajaxHeaders?: Record<string, unknown> };
  try {
    modal = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!modal || typeof modal.url !== "string") return false;
  const url = new URL(modal.url, "https://www.amazon.com");
  if (url.origin !== "https://www.amazon.com" || url.username || url.password || url.hash)
    throw new AmazonDeliveryRequestError("dependency_failed", "permission_denied", false);
  const pageType = url.searchParams.get("pageType"),
    storeContext = url.searchParams.get("storeContext");
  if (!pageType || !storeContext) return false;
  const headers: Record<string, string> = {
    "accept-language": "en-US,en;q=0.9",
    "x-requested-with": "XMLHttpRequest",
    referer: page.url(),
  };
  const initialToken = modal.ajaxHeaders?.["anti-csrftoken-a2z"];
  if (typeof initialToken === "string" && !/[\r\n]/.test(initialToken))
    headers["anti-csrftoken-a2z"] = initialToken;
  const rendered = await checked(
    await page.request.get(url.toString(), {
      headers,
      timeout,
      maxRedirects: 0,
      maxRetries: 0,
    }),
  );
  const match = /\bCSRF_TOKEN\s*:\s*("(?:\\.|[^"\\])*")/.exec(rendered);
  if (!match) return false;
  let token: unknown;
  try {
    token = JSON.parse(match[1]!);
  } catch {
    return false;
  }
  if (typeof token !== "string" || !token || /[\r\n]/.test(token)) return false;
  await checked(
    await page.request.post(
      "https://www.amazon.com/portal-migration/hz/glow/address-change?actionSource=glow",
      {
        headers: {
          ...headers,
          "anti-csrftoken-a2z": token,
          "content-type": "application/json",
          accept: "application/json",
        },
        data: {
          locationType: "LOCATION_INPUT",
          zipCode: postal,
          deviceType: "web",
          pageType,
          storeContext,
          actionSource: "glow",
        },
        timeout,
        maxRedirects: 0,
        maxRetries: 0,
      },
    ),
  );
  // A 200 response is not delivery proof. The caller must reread the original
  // document and enforce the exact anonymous + postal guards before collection.
  return true;
}
