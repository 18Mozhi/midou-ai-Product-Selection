import type { BrowserContext } from "playwright";

/** Relay the original main-frame request through this context's existing request
 * transport. No URL/header/body/status overrides, retries or redirect following.
 * All actual responses, including 403/429/503 and CAPTCHA, reach the same page. */
export async function installNavigationRequestTransport(
  context: BrowserContext,
  origin: string,
  timeout: number,
) {
  await context.route(
    (url) => url.origin === origin,
    async (route) => {
      let response: Awaited<ReturnType<typeof route.fetch>> | undefined;
      try {
        const request = route.request();
        if (!request.isNavigationRequest() || request.frame().parentFrame() !== null) {
          await route.continue();
          return;
        }
        response = await route.fetch({ timeout, maxRetries: 0, maxRedirects: 0 });
        await route.fulfill({ response });
      } catch {
        await route.abort("failed").catch(() => {});
      } finally {
        await response?.dispose().catch(() => {});
      }
    },
  );
}
