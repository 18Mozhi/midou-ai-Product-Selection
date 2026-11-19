import { errors, type Page, type Frame, type BrowserContext } from "playwright";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, lstat, readFile, writeFile, rename, unlink, realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { requestAmazonDeliveryContext } from "./amazon-delivery-request.js";

type DeliveryCookies = Awaited<ReturnType<BrowserContext["cookies"]>>;
export interface DailyAmazonDelivery {
  cookies: DeliveryCookies;
  cached: boolean;
  save(context: BrowserContext): Promise<void>;
}

export async function assertAmazonDelivery(page: Page, postal: string, guard: () => Promise<void>) {
  await guard();
  if (
    new URL(page.url()).origin !== "https://www.amazon.com" ||
    !(await page
      .getByRole("link", { name: "Hello, sign in Account & Lists", exact: true })
      .isVisible())
  )
    throw new Error("amazon_delivery_requires_anonymous_page");
  await page
    .locator("#glow-ingress-block")
    .filter({ hasText: new RegExp(`\\b${postal}\\b`) })
    .waitFor({ state: "visible" });
}

/** Project-owned anonymous state, never an imported user/Star profile. One daily
 * homepage preparation is serialized across API and Python-launched runners. */
export async function withDailyAmazonDelivery<T>(
  root: string,
  identity: string,
  postal: string,
  work: (delivery: DailyAmazonDelivery) => Promise<T>,
  signal?: AbortSignal,
  clock: () => Date = () => new Date(),
): Promise<T> {
  if (!isAbsolute(root) || !identity || !/^\d{5}$/.test(postal))
    throw new Error("amazon_delivery_cache_invalid");
  root = resolve(root);
  await mkdir(root, { recursive: true, mode: 0o700 });
  if ((await realpath(root)) !== root) throw new Error("amazon_delivery_cache_invalid");
  // UTC+8 matches the project's operational day, not the OS/SQL timezone.
  const day = new Date(clock().getTime() + 8 * 3600_000).toISOString().slice(0, 10);
  const key = createHash("sha256")
    .update(identity)
    .update("\0" + postal)
    .digest("hex");
  const file = join(root, key + ".json"),
    lock = join(root, key + ".lock");
  const owner = JSON.stringify({ id: randomUUID(), pid: process.pid });
  let locked = false,
    scratch: string | undefined;
  const release = async () => {
    if (!locked) return;
    if ((await lstat(lock)).isSymbolicLink() || (await readFile(lock, "utf8")) !== owner)
      throw new Error("amazon_delivery_cache_lock_changed");
    await unlink(lock);
    locked = false;
  };
  const validCookies = (value: unknown): value is DeliveryCookies =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 200 &&
    value.every(
      (c) =>
        c &&
        typeof c === "object" &&
        typeof c.name === "string" &&
        typeof c.value === "string" &&
        !/[\r\n\0]/.test(c.name + c.value) &&
        c.name.length <= 128 &&
        c.value.length <= 8192 &&
        !["at-main", "sess-at-main"].includes(c.name) &&
        [".amazon.com", "www.amazon.com", "amazon.com"].includes(c.domain) &&
        typeof c.path === "string" &&
        c.path.startsWith("/") &&
        c.path.length <= 1024 &&
        typeof c.httpOnly === "boolean" &&
        typeof c.secure === "boolean" &&
        Number.isFinite(c.expires) &&
        ["Strict", "Lax", "None"].includes(c.sameSite),
    );
  try {
    const until = Date.now() + 30_000;
    while (!locked) {
      signal?.throwIfAborted();
      try {
        await writeFile(lock, owner, { flag: "wx", mode: 0o600 });
        locked = true;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        const st = await lstat(lock).catch((e) => {
          if (e.code === "ENOENT") return null;
          throw e;
        });
        if (!st) continue;
        if (!st.isFile() || st.isSymbolicLink() || st.size > 256)
          throw new Error("amazon_delivery_cache_invalid");
        const raw = await readFile(lock, "utf8");
        const prior = JSON.parse(raw);
        if (!Number.isSafeInteger(prior.pid) || prior.pid < 1)
          throw new Error("amazon_delivery_cache_invalid");
        let dead = false;
        try {
          process.kill(prior.pid, 0);
        } catch (e) {
          dead = (e as NodeJS.ErrnoException).code === "ESRCH";
        }
        if (dead && (await readFile(lock, "utf8")) === raw) {
          await unlink(lock);
          continue;
        }
        // Never steal from a possibly live process, or infer death from a timeout.
        if (Date.now() >= until) throw new Error("amazon_delivery_cache_busy");
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    let cookies: DeliveryCookies = [];
    try {
      const st = await lstat(file);
      if (!st.isFile() || st.isSymbolicLink() || st.size > 131072)
        throw new Error("amazon_delivery_cache_invalid");
      const state = JSON.parse(await readFile(file, "utf8"));
      if (
        state.version !== 1 ||
        state.key !== key ||
        typeof state.day !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(state.day) ||
        state.day > day ||
        !validCookies(state.cookies)
      )
        throw new Error("amazon_delivery_cache_invalid");
      if (state.day === day) cookies = state.cookies;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    const cached = cookies.length > 0;
    if (cached) await release();
    return await work({
      cookies,
      cached,
      async save(context) {
        if (cached || !locked) throw new Error("amazon_delivery_cache_invalid");
        const current = await context.cookies("https://www.amazon.com/");
        if (!validCookies(current)) throw new Error("amazon_delivery_cache_invalid");
        const data = JSON.stringify({ version: 1, key, day, cookies: current });
        if (Buffer.byteLength(data) > 131072) throw new Error("amazon_delivery_cache_invalid");
        scratch = file + "." + JSON.parse(owner).id + ".tmp";
        await writeFile(scratch, data, { flag: "wx", mode: 0o600 });
        await rename(scratch, file);
        scratch = undefined;
        await release();
      },
    });
  } finally {
    if (scratch) await unlink(scratch).catch(() => {});
    await release();
  }
}

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
  if (reread && navigationTimeoutMs !== undefined) {
    reportStep("request_delivery_context");
    if (await requestAmazonDeliveryContext(page, postalCode, navigationTimeoutMs)) {
      await assertAnonymous();
      reportStep("request_delivery_reread");
      await reread();
      await assertAnonymous();
      await header.filter({ hasText: postal }).waitFor({ state: "visible" });
      await assertSafe();
      return true;
    }
  }
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
