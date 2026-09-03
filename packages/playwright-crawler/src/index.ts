import { createHash, randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, posix, resolve, sep } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { withMaterializedCredential, type CredentialCipherRecord } from "@scoutops/credentials";

export type BrowserRunStatus =
  | "succeeded"
  | "succeeded_empty"
  | "blocked_login"
  | "blocked_captcha"
  | "blocked_robots"
  | "rate_limited"
  | "timeout"
  | "parser_changed"
  | "dependency_failed";
export interface BrowserBlockSignals {
  login?: string;
  captcha?: string;
  robots?: string;
}
export interface BrowserCollectionPlan {
  start_url: string;
  allowed_origins: string[];
  search?: { input_selector: string; query: string; submit_selector?: string };
  item_selector: string;
  search_snapshot?: BrowserSearchSnapshotPlan;
  offer_detail_snapshot?: BrowserOfferDetailSnapshotPlan;
  next_page_selector?: string;
  detail_link_selector?: string;
  max_pages: number;
  max_scrolls: number;
  max_details: number;
  block_signals?: BrowserBlockSignals;
  evidence?: { parser_version: string };
}
export interface BrowserOfferDetailSnapshotPlan {
  schema_version: string;
  title_selector: string;
  supplier_name_selector: string;
  supplier_link_selector: string;
  specification_selector: string;
  price_selector: string;
  moq_selector: string;
  location_selector: string;
}
export interface BrowserSearchSnapshotPlan {
  schema_version: string;
  max_items: number;
  offer_id_query_param: string;
  canonical_url_template: string;
  title_selector: string;
  supplier_name_selector: string;
  price_selector?: string;
}
export interface BrowserRuntimeLimits {
  navigationTimeoutMs: number;
  actionTimeoutMs: number;
  maxPages: number;
  maxScrolls: number;
  maxDetails: number;
  maxArchiveBytes: number;
  maxExtractedBytes: number;
  maxArchiveFiles: number;
  headless: boolean;
  executablePath?: string;
}
export interface BrowserRunResult {
  status: BrowserRunStatus;
  page_count: number;
  item_count: number;
  detail_count: number;
  duration_ms: number;
  error_code: string | null;
  request_id: string;
  trace_id: string;
  artifacts?: BrowserEvidenceArtifact[];
  snapshots?: {
    search?: BrowserSearchSnapshot;
    offer_details?: BrowserOfferDetailSnapshot[];
  };
}
export interface BrowserSearchSnapshot {
  schema_version: string;
  source_url: string;
  observed_at: string;
  items: Array<{
    offer_id: string;
    title: string;
    supplier_id: null;
    supplier_name: string;
    quoted_price: number | null;
    currency: "CNY" | null;
    moq: null;
    location: null;
    canonical_url: string;
    dom_fragment: string;
    source_paths: Record<string, string>;
  }>;
}
export interface BrowserOfferDetailSnapshot {
  schema_version: string;
  source_url: string;
  observed_at: string;
  offer: {
    offer_id: string;
    title: string;
    supplier_id: string | null;
    supplier_name: string;
    specification: string | null;
    quoted_price: number | null;
    currency: "CNY" | null;
    moq: number | null;
    lead_time_days: null;
    location: string | null;
    canonical_url: string;
    dom_fragment: string;
    source_paths: Record<string, string>;
  };
}
export interface BrowserEvidenceArtifact {
  kind: "dom_fragment" | "screenshot";
  source_url: string;
  content_type: "text/html" | "image/jpeg";
  content_base64: string;
  content_sha256: string;
  captured_at: string;
  parser_version: string;
}
export type BrowserCookie = Parameters<BrowserContext["addCookies"]>[0][number];

export class PlaywrightCrawlerError extends Error {
  constructor(
    readonly code: string,
    readonly status: BrowserRunStatus,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "PlaywrightCrawlerError";
  }
}
const selector = (value: unknown) =>
    typeof value === "string" && value.trim().length > 0 && value.length <= 500,
  value = (input: unknown, max: number) =>
    typeof input === "string" && input.length > 0 && input.length <= max;
function httpUrl(input: string) {
  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
      throw new Error();
    return url;
  } catch {
    throw new PlaywrightCrawlerError("crawler_url_invalid", "parser_changed", false);
  }
}
export function validateBrowserPlan(
  input: BrowserCollectionPlan,
  limits: BrowserRuntimeLimits,
): BrowserCollectionPlan {
  if (!input || typeof input !== "object")
    throw new PlaywrightCrawlerError("crawler_plan_invalid", "parser_changed", false);
  const start = httpUrl(input.start_url),
    origins = [...new Set(input.allowed_origins ?? [])];
  if (
    !origins.length ||
    origins.length > 20 ||
    origins.some((origin) => httpUrl(origin).origin !== origin) ||
    !origins.includes(start.origin)
  )
    throw new PlaywrightCrawlerError("crawler_origin_invalid", "parser_changed", false);
  for (const [key, current, max] of [
    ["max_pages", input.max_pages, limits.maxPages],
    ["max_scrolls", input.max_scrolls, limits.maxScrolls],
    ["max_details", input.max_details, limits.maxDetails],
  ] as const)
    if (
      !Number.isSafeInteger(current) ||
      current < 0 ||
      current > max ||
      (key === "max_pages" && current < 1)
    )
      throw new PlaywrightCrawlerError(`crawler_${key}_invalid`, "parser_changed", false);
  if (
    !selector(input.item_selector) ||
    (input.next_page_selector && !selector(input.next_page_selector)) ||
    (input.detail_link_selector && !selector(input.detail_link_selector))
  )
    throw new PlaywrightCrawlerError("crawler_selector_invalid", "parser_changed", false);
  if (
    input.search &&
    (!selector(input.search.input_selector) ||
      !value(input.search.query, 500) ||
      (input.search.submit_selector && !selector(input.search.submit_selector)))
  )
    throw new PlaywrightCrawlerError("crawler_search_invalid", "parser_changed", false);
  if (input.search_snapshot) {
    const snapshot = input.search_snapshot,
      canonicalProbe = snapshot.canonical_url_template.replace("{offer_id}", "1");
    if (
      !/^[A-Za-z0-9._-]{1,120}$/.test(snapshot.schema_version) ||
      !Number.isSafeInteger(snapshot.max_items) ||
      snapshot.max_items < 1 ||
      snapshot.max_items > 20 ||
      !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(snapshot.offer_id_query_param) ||
      !snapshot.canonical_url_template.includes("{offer_id}") ||
      snapshot.canonical_url_template.length > 2048 ||
      !origins.includes(httpUrl(canonicalProbe).origin) ||
      !selector(snapshot.title_selector) ||
      !selector(snapshot.supplier_name_selector) ||
      (snapshot.price_selector && !selector(snapshot.price_selector))
    )
      throw new PlaywrightCrawlerError("crawler_snapshot_invalid", "parser_changed", false);
  }
  if (input.offer_detail_snapshot) {
    const snapshot = input.offer_detail_snapshot;
    if (
      !input.search_snapshot ||
      !/^[A-Za-z0-9._-]{1,120}$/.test(snapshot.schema_version) ||
      !selector(snapshot.title_selector) ||
      !selector(snapshot.supplier_name_selector) ||
      !selector(snapshot.supplier_link_selector) ||
      !selector(snapshot.specification_selector) ||
      !selector(snapshot.price_selector) ||
      !selector(snapshot.moq_selector) ||
      !selector(snapshot.location_selector)
    )
      throw new PlaywrightCrawlerError("crawler_snapshot_invalid", "parser_changed", false);
  }
  for (const signal of Object.values(input.block_signals ?? {}))
    if (signal && !selector(signal))
      throw new PlaywrightCrawlerError("crawler_block_signal_invalid", "parser_changed", false);
  if (input.evidence && !/^[A-Za-z0-9._-]{1,120}$/.test(input.evidence.parser_version))
    throw new PlaywrightCrawlerError("crawler_parser_version_invalid", "parser_changed", false);
  return { ...input, allowed_origins: origins };
}
export function classifyBrowserFailure(error: unknown): {
  status: BrowserRunStatus;
  code: string;
  retryable: boolean;
} {
  if (error instanceof PlaywrightCrawlerError)
    return {
      status: error.status,
      code: error.code,
      retryable: error.retryable,
    };
  if (error instanceof Error && /Timeout/i.test(error.name + error.message))
    return { status: "timeout", code: "timeout", retryable: true };
  return {
    status: "dependency_failed",
    code: "dependency_unavailable",
    retryable: true,
  };
}

async function blocked(page: Page, signals: BrowserBlockSignals | undefined) {
  for (const [key, status] of [
    ["login", "blocked_login"],
    ["captcha", "blocked_captcha"],
    ["robots", "blocked_robots"],
  ] as const) {
    const css = signals?.[key];
    if (css && (await page.locator(css).count()))
      throw new PlaywrightCrawlerError(status, status, false);
  }
}
const artifact = (
  kind: BrowserEvidenceArtifact["kind"],
  sourceUrl: string,
  contentType: BrowserEvidenceArtifact["content_type"],
  content: Buffer,
  parserVersion: string,
  capturedAt: string,
): BrowserEvidenceArtifact => ({
  kind,
  source_url: sourceUrl,
  content_type: contentType,
  content_base64: content.toString("base64"),
  content_sha256: createHash("sha256").update(content).digest("hex"),
  captured_at: capturedAt,
  parser_version: parserVersion,
});

const boundedUtf8 = (value: string, maximumBytes: number): Buffer => {
  let low = 0,
    high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(value.slice(0, middle)) <= maximumBytes) low = middle;
    else high = middle - 1;
  }
  return Buffer.from(value.slice(0, low));
};

async function captureEvidence(
  page: Page,
  plan: BrowserCollectionPlan,
): Promise<BrowserEvidenceArtifact[]> {
  if (!plan.evidence) return [];
  const capturedAt = new Date().toISOString(),
    sourceUrl = httpUrl(page.url()).toString(),
    itemHtml = await page
      .locator(plan.item_selector)
      .evaluateAll((nodes) => nodes.map((node) => node.outerHTML).join("\n")),
    pageHtml = itemHtml || (await page.locator("body").evaluate((node) => node.outerHTML)),
    html = boundedUtf8(pageHtml, 250_000);
  if (!html.byteLength)
    throw new PlaywrightCrawlerError("crawler_dom_fragment_invalid", "parser_changed", false);
  let screenshot = await page.screenshot({ type: "jpeg", quality: 35, fullPage: false });
  if (screenshot.byteLength > 800_000)
    screenshot = await page.screenshot({ type: "jpeg", quality: 15, fullPage: false });
  if (!screenshot.byteLength || screenshot.byteLength > 800_000)
    throw new PlaywrightCrawlerError("crawler_screenshot_too_large", "dependency_failed", true);
  return [
    artifact(
      "dom_fragment",
      sourceUrl,
      "text/html",
      html,
      plan.evidence.parser_version,
      capturedAt,
    ),
    artifact(
      "screenshot",
      sourceUrl,
      "image/jpeg",
      screenshot,
      plan.evidence.parser_version,
      capturedAt,
    ),
  ];
}

async function captureSearchSnapshot(
  page: Page,
  plan: BrowserCollectionPlan,
): Promise<BrowserSearchSnapshot | undefined> {
  const snapshot = plan.search_snapshot;
  if (!snapshot) return undefined;
  const observedAt = new Date().toISOString(),
    sourceUrl = httpUrl(page.url()).toString(),
    rawItems = await page.locator(plan.item_selector).evaluateAll(
      (nodes, input) =>
        nodes.slice(0, input.maxItems).map((node) => {
          const root = node as HTMLElement,
            link =
              node instanceof HTMLAnchorElement
                ? node
                : root.querySelector<HTMLAnchorElement>("a[href]"),
            text = (selector: string | undefined) =>
              selector ? (root.querySelector(selector)?.textContent?.trim() ?? "") : "";
          return {
            href: link?.href ?? "",
            title: text(input.titleSelector),
            supplierName: text(input.supplierNameSelector),
            priceText: text(input.priceSelector),
            dom: root.outerHTML,
          };
        }),
      {
        maxItems: snapshot.max_items,
        titleSelector: snapshot.title_selector,
        supplierNameSelector: snapshot.supplier_name_selector,
        priceSelector: snapshot.price_selector,
      },
    ),
    items: BrowserSearchSnapshot["items"] = [];
  for (const raw of rawItems) {
    let href: URL;
    try {
      href = httpUrl(raw.href);
    } catch {
      continue;
    }
    const offerId = href.searchParams.get(snapshot.offer_id_query_param)?.trim() ?? "",
      title = raw.title.trim(),
      supplierName = raw.supplierName.trim();
    if (!/^\d{1,40}$/.test(offerId) || !title || !supplierName) continue;
    const canonicalUrl = snapshot.canonical_url_template.replace("{offer_id}", offerId),
      canonical = httpUrl(canonicalUrl);
    if (!plan.allowed_origins.includes(canonical.origin))
      throw new PlaywrightCrawlerError("crawler_origin_forbidden", "parser_changed", false);
    const normalizedPrice = raw.priceText.replace(/\s+/g, ""),
      priceMatch = /(?:¥|￥)?(\d+(?:\.\d+)?)/.exec(normalizedPrice),
      quotedPrice = priceMatch ? Number(priceMatch[1]) : null;
    items.push({
      offer_id: offerId,
      title: title.slice(0, 1000),
      supplier_id: null,
      supplier_name: supplierName.slice(0, 500),
      quoted_price: quotedPrice != null && Number.isFinite(quotedPrice) ? quotedPrice : null,
      currency: quotedPrice != null && Number.isFinite(quotedPrice) ? "CNY" : null,
      moq: null,
      location: null,
      canonical_url: canonical.toString(),
      dom_fragment: boundedUtf8(raw.dom, 15_000).toString("utf8"),
      source_paths: {
        title: snapshot.title_selector,
        supplier_name: snapshot.supplier_name_selector,
        quoted_price: snapshot.price_selector ?? "current search card does not expose price",
        moq: "current search card does not expose MOQ",
        location: "current search card does not expose location",
        canonical_url: `${plan.item_selector} @href query:${snapshot.offer_id_query_param}`,
      },
    });
  }
  return {
    schema_version: snapshot.schema_version,
    source_url: sourceUrl,
    observed_at: observedAt,
    items,
  };
}

const firstPositiveInteger = (value: string): number | null => {
  const match = /(\d+)/.exec(value.replace(/,/g, "")),
    parsed = match ? Number(match[1]) : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

async function captureOfferDetailSnapshot(
  page: Page,
  plan: BrowserCollectionPlan,
  source: BrowserSearchSnapshot["items"][number],
): Promise<BrowserOfferDetailSnapshot | undefined> {
  const snapshot = plan.offer_detail_snapshot;
  if (!snapshot) return undefined;
  const raw = await page.evaluate(
      (input) => {
        const node = (selector: string) => document.querySelector<HTMLElement>(selector),
          text = (selector: string) =>
            node(selector)?.textContent?.replace(/\s+/g, " ").trim() ?? "",
          roots = [
            input.titleSelector,
            input.supplierNameSelector,
            input.specificationSelector,
            input.priceSelector,
            input.moqSelector,
            input.locationSelector,
          ];
        return {
          title: text(input.titleSelector),
          supplierName: text(input.supplierNameSelector),
          supplierHref:
            node(input.supplierLinkSelector) instanceof HTMLAnchorElement
              ? (node(input.supplierLinkSelector) as HTMLAnchorElement).href
              : "",
          specification: text(input.specificationSelector),
          price: text(input.priceSelector),
          moq: text(input.moqSelector),
          location: text(input.locationSelector),
          dom: roots
            .map((selector) => node(selector)?.outerHTML ?? "")
            .filter(Boolean)
            .join("\n"),
        };
      },
      {
        titleSelector: snapshot.title_selector,
        supplierNameSelector: snapshot.supplier_name_selector,
        supplierLinkSelector: snapshot.supplier_link_selector,
        specificationSelector: snapshot.specification_selector,
        priceSelector: snapshot.price_selector,
        moqSelector: snapshot.moq_selector,
        locationSelector: snapshot.location_selector,
      },
    ),
    currentUrl = httpUrl(page.url()),
    expectedUrl = httpUrl(source.canonical_url);
  if (currentUrl.origin !== expectedUrl.origin || currentUrl.pathname !== expectedUrl.pathname)
    throw new PlaywrightCrawlerError("crawler_detail_url_changed", "parser_changed", false);
  if (!raw.title || !raw.supplierName || !raw.dom)
    throw new PlaywrightCrawlerError("crawler_detail_snapshot_invalid", "parser_changed", false);
  let supplierId: string | null = null;
  if (raw.supplierHref) {
    const supplierUrl = httpUrl(raw.supplierHref),
      match = /^shop([A-Za-z0-9._-]+)\.1688\.com$/i.exec(supplierUrl.hostname);
    supplierId = match?.[1] ?? null;
  }
  const priceMatch = /(?:¥|￥)\s*(\d+(?:\.\d+)?)/.exec(raw.price.replace(/,/g, "")),
    quotedPrice = priceMatch ? Number(priceMatch[1]) : null,
    moqMatch = /(\d[\d,]*)\s*[^\d\s]{0,6}\s*起批/.exec(raw.moq),
    moqText = moqMatch?.[1],
    moq = moqText ? firstPositiveInteger(moqText) : null;
  return {
    schema_version: snapshot.schema_version,
    source_url: expectedUrl.toString(),
    observed_at: new Date().toISOString(),
    offer: {
      offer_id: source.offer_id,
      title: raw.title.slice(0, 1000),
      supplier_id: supplierId,
      supplier_name: raw.supplierName.slice(0, 500),
      specification: raw.specification ? raw.specification.slice(0, 1000) : null,
      quoted_price:
        quotedPrice != null && Number.isFinite(quotedPrice) && quotedPrice >= 0
          ? quotedPrice
          : null,
      currency:
        quotedPrice != null && Number.isFinite(quotedPrice) && quotedPrice >= 0 ? "CNY" : null,
      moq,
      lead_time_days: null,
      location: raw.location ? raw.location.slice(0, 255) : null,
      canonical_url: expectedUrl.toString(),
      dom_fragment: boundedUtf8(raw.dom, 30_000).toString("utf8"),
      source_paths: {
        title: snapshot.title_selector,
        supplier_id: `${snapshot.supplier_link_selector} @href hostname shop{id}.1688.com`,
        supplier_name: snapshot.supplier_name_selector,
        specification: snapshot.specification_selector,
        quoted_price: snapshot.price_selector,
        moq: snapshot.moq_selector,
        lead_time_days: "current detail page exposes destination ETA, not supplier lead time",
        location: snapshot.location_selector,
        canonical_url: "document.location.href",
      },
    },
  };
}
export class PlaywrightCrawlerEngine {
  constructor(private readonly limits: BrowserRuntimeLimits) {}
  async run(
    planInput: BrowserCollectionPlan,
    userDataDir: string,
    ids: { requestId: string; traceId: string },
    options: {
      locale?: string;
      timezoneId?: string;
      cookies?: BrowserCookie[];
    } = {},
  ): Promise<BrowserRunResult> {
    const plan = validateBrowserPlan(planInput, this.limits),
      started = Date.now();
    let context: BrowserContext | undefined,
      rateLimited = false,
      pageCount = 0,
      itemCount = 0,
      detailCount = 0;
    let artifacts: BrowserEvidenceArtifact[] = [];
    let searchSnapshot: BrowserSearchSnapshot | undefined;
    const offerDetails: BrowserOfferDetailSnapshot[] = [];
    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        headless: this.limits.headless,
        ...(this.limits.executablePath ? { executablePath: this.limits.executablePath } : {}),
        ...(options.locale ? { locale: options.locale } : {}),
        ...(options.timezoneId ? { timezoneId: options.timezoneId } : {}),
      });
      if (options.cookies?.length) await context.addCookies(options.cookies);
      context.setDefaultTimeout(this.limits.actionTimeoutMs);
      context.setDefaultNavigationTimeout(this.limits.navigationTimeoutMs);
      context.on("response", (response) => {
        if (response.status() === 429) rateLimited = true;
      });
      const page = context.pages()[0] ?? (await context.newPage());
      await this.goto(page, plan.start_url, plan.allowed_origins);
      await blocked(page, plan.block_signals);
      if (plan.search) {
        await page.locator(plan.search.input_selector).fill(plan.search.query);
        if (plan.search.submit_selector) await page.locator(plan.search.submit_selector).click();
        else await page.locator(plan.search.input_selector).press("Enter");
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        if (!plan.allowed_origins.includes(httpUrl(page.url()).origin))
          throw new PlaywrightCrawlerError("crawler_origin_forbidden", "parser_changed", false);
        await blocked(page, plan.block_signals);
        await page
          .locator(plan.item_selector)
          .first()
          .waitFor({ state: "attached", timeout: this.limits.actionTimeoutMs })
          .catch(() => {});
      }
      for (let index = 0; index < plan.max_pages; index += 1) {
        if (rateLimited) throw new PlaywrightCrawlerError("rate_limited", "rate_limited", true);
        await blocked(page, plan.block_signals);
        pageCount += 1;
        for (let scroll = 0; scroll < plan.max_scrolls; scroll += 1) {
          await page.evaluate(() => window.scrollBy(0, Math.max(window.innerHeight, 600)));
          await page.waitForTimeout(25);
        }
        if (plan.search) {
          const readinessDeadline = Date.now() + this.limits.actionTimeoutMs;
          let previousItemCount = -1,
            stableSamples = 0;
          while (Date.now() <= readinessDeadline) {
            const currentItemCount = await page.locator(plan.item_selector).count();
            stableSamples =
              currentItemCount > 0 && currentItemCount === previousItemCount
                ? stableSamples + 1
                : 0;
            if (stableSamples >= 2) break;
            previousItemCount = currentItemCount;
            await page.waitForTimeout(250);
          }
        }
        itemCount += await page.locator(plan.item_selector).count();
        if (!artifacts.length) artifacts = await captureEvidence(page, plan);
        const currentSearchSnapshot = await captureSearchSnapshot(page, plan);
        if (currentSearchSnapshot) {
          if (!searchSnapshot) searchSnapshot = currentSearchSnapshot;
          else {
            const known = new Set(searchSnapshot.items.map((item) => item.offer_id));
            for (const item of currentSearchSnapshot.items)
              if (!known.has(item.offer_id) && searchSnapshot.items.length < 100) {
                searchSnapshot.items.push(item);
                known.add(item.offer_id);
              }
          }
        }
        if (plan.offer_detail_snapshot && currentSearchSnapshot && detailCount < plan.max_details) {
          for (const item of currentSearchSnapshot.items) {
            if (detailCount >= plan.max_details) break;
            if (offerDetails.some((detail) => detail.offer.offer_id === item.offer_id)) continue;
            const detailPage = await context.newPage();
            try {
              await this.goto(detailPage, item.canonical_url, plan.allowed_origins);
              await blocked(detailPage, plan.block_signals);
              const detail = await captureOfferDetailSnapshot(detailPage, plan, item);
              if (detail) offerDetails.push(detail);
              detailCount += 1;
            } finally {
              await detailPage.close();
            }
          }
        } else if (plan.detail_link_selector && detailCount < plan.max_details) {
          const hrefs = await page
            .locator(plan.detail_link_selector)
            .evaluateAll(
              (nodes, cap) =>
                nodes.slice(0, Number(cap)).map((node) => (node as HTMLAnchorElement).href),
              plan.max_details - detailCount,
            );
          for (const href of hrefs) {
            if (detailCount >= plan.max_details) break;
            const detail = httpUrl(href);
            if (!plan.allowed_origins.includes(detail.origin)) continue;
            const detailPage = await context.newPage();
            try {
              await this.goto(detailPage, detail.toString(), plan.allowed_origins);
              await blocked(detailPage, plan.block_signals);
              detailCount += 1;
            } finally {
              await detailPage.close();
            }
          }
        }
        if (!plan.next_page_selector || index + 1 >= plan.max_pages) break;
        const next = page.locator(plan.next_page_selector).first();
        if (!(await next.count()) || (await next.isDisabled().catch(() => false))) break;
        const previousUrl = page.url(),
          previousFirstItem = await page
            .locator(plan.item_selector)
            .first()
            .getAttribute("href")
            .catch(() => null);
        await next.click();
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        await page
          .waitForFunction(
            ({ url, firstItem, itemSelector }) =>
              location.href !== url ||
              document.querySelector(itemSelector)?.getAttribute("href") !== firstItem,
            { url: previousUrl, firstItem: previousFirstItem, itemSelector: plan.item_selector },
            { timeout: this.limits.actionTimeoutMs },
          )
          .catch(() => {});
        if (!plan.allowed_origins.includes(httpUrl(page.url()).origin))
          throw new PlaywrightCrawlerError("crawler_origin_forbidden", "parser_changed", false);
      }
      return {
        status: itemCount ? "succeeded" : "succeeded_empty",
        page_count: pageCount,
        item_count: itemCount,
        detail_count: detailCount,
        duration_ms: Date.now() - started,
        error_code: null,
        request_id: ids.requestId,
        trace_id: ids.traceId,
        ...(artifacts.length ? { artifacts } : {}),
        ...(searchSnapshot || offerDetails.length
          ? {
              snapshots: {
                ...(searchSnapshot ? { search: searchSnapshot } : {}),
                ...(offerDetails.length ? { offer_details: offerDetails } : {}),
              },
            }
          : {}),
      };
    } catch (error) {
      const failure = classifyBrowserFailure(error);
      return {
        status: failure.status,
        page_count: pageCount,
        item_count: itemCount,
        detail_count: detailCount,
        duration_ms: Date.now() - started,
        error_code: failure.code,
        request_id: ids.requestId,
        trace_id: ids.traceId,
        ...(artifacts.length ? { artifacts } : {}),
        ...(searchSnapshot || offerDetails.length
          ? {
              snapshots: {
                ...(searchSnapshot ? { search: searchSnapshot } : {}),
                ...(offerDetails.length ? { offer_details: offerDetails } : {}),
              },
            }
          : {}),
      };
    } finally {
      await context?.close().catch(() => {});
    }
  }
  private async goto(page: Page, target: string, origins: string[]) {
    const url = httpUrl(target);
    if (!origins.includes(url.origin))
      throw new PlaywrightCrawlerError("crawler_origin_forbidden", "parser_changed", false);
    const response = await page.goto(url.toString(), {
      waitUntil: "domcontentloaded",
    });
    if (!origins.includes(httpUrl(page.url()).origin))
      throw new PlaywrightCrawlerError("crawler_origin_forbidden", "parser_changed", false);
    if (response?.status() === 429)
      throw new PlaywrightCrawlerError("rate_limited", "rate_limited", true);
  }
}

export interface ProfileArchiveLimits {
  maxArchiveBytes: number;
  maxExtractedBytes: number;
  maxFiles: number;
}
export async function withExtractedProfileArchive<T>(
  archivePath: string,
  tempRoot: string,
  limits: ProfileArchiveLimits,
  use: (userDataDir: string) => Promise<T>,
): Promise<T> {
  const root = resolve(tempRoot);
  if (root === resolve(sep))
    throw new PlaywrightCrawlerError("profile_temp_scope_invalid", "dependency_failed", false);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(join(root, "playwright-profile-"));
  if (!resolve(directory).startsWith(`${root}${sep}`))
    throw new PlaywrightCrawlerError("profile_temp_scope_invalid", "dependency_failed", false);
  let compressed: Buffer | undefined, tar: Buffer | undefined;
  try {
    const stat = await import("node:fs/promises").then((module) => module.stat(archivePath));
    if (stat.size > limits.maxArchiveBytes)
      throw new PlaywrightCrawlerError("profile_archive_too_large", "dependency_failed", false);
    compressed = await readFile(archivePath);
    try {
      tar = gunzipSync(compressed, {
        maxOutputLength: limits.maxExtractedBytes,
      });
    } catch {
      throw new PlaywrightCrawlerError("profile_archive_invalid", "dependency_failed", false);
    }
    let offset = 0,
      total = 0,
      files = 0;
    while (offset + 512 <= tar.length) {
      const header = tar.subarray(offset, offset + 512);
      if (header.every((byte) => byte === 0)) break;
      const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, ""),
        prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, ""),
        relative = prefix ? `${prefix}/${name}` : name,
        type = String.fromCharCode(header[156] || 48),
        sizeText = header.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim(),
        size = parseInt(sizeText || "0", 8);
      if (
        !relative ||
        isAbsolute(relative) ||
        relative.includes("\\") ||
        posix.normalize(relative).startsWith("../") ||
        posix.normalize(relative) === ".." ||
        !Number.isSafeInteger(size) ||
        size < 0 ||
        !["0", "5"].includes(type)
      )
        throw new PlaywrightCrawlerError(
          "profile_archive_traversal_or_type",
          "dependency_failed",
          false,
        );
      files += 1;
      total += size;
      if (files > limits.maxFiles || total > limits.maxExtractedBytes)
        throw new PlaywrightCrawlerError(
          "profile_archive_limit_exceeded",
          "dependency_failed",
          false,
        );
      const target = resolve(directory, ...posix.normalize(relative).split("/"));
      if (!target.startsWith(`${resolve(directory)}${sep}`))
        throw new PlaywrightCrawlerError(
          "profile_archive_traversal_or_type",
          "dependency_failed",
          false,
        );
      if (type === "5") await mkdir(target, { recursive: true, mode: 0o700 });
      else {
        await mkdir(dirname(target), { recursive: true, mode: 0o700 });
        await writeFile(target, tar.subarray(offset + 512, offset + 512 + size), {
          mode: 0o600,
          flag: "wx",
        });
      }
      offset += 512 + Math.ceil(size / 512) * 512;
    }
    await chmod(directory, 0o700);
    return await use(directory);
  } finally {
    compressed?.fill(0);
    tar?.fill(0);
    await rm(directory, { recursive: true, force: true });
  }
}
export function hashLeaseToken(token: string) {
  return createHash("sha256").update("scoutops:crawler-lease:v1\0").update(token).digest("hex");
}
export function createLeaseToken() {
  return { id: randomUUID(), token: randomUUID() + randomUUID() };
}
export function parseCookieBundle(value: string): BrowserCookie[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new PlaywrightCrawlerError("cookie_bundle_invalid", "dependency_failed", false);
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { format?: unknown }).format !== "scoutops-cookie-bundle-v1" ||
    !Array.isArray((parsed as { cookies?: unknown }).cookies)
  )
    throw new PlaywrightCrawlerError("cookie_bundle_invalid", "dependency_failed", false);
  const cookies = (parsed as { cookies: BrowserCookie[] }).cookies;
  if (!cookies.length || cookies.length > 500)
    throw new PlaywrightCrawlerError("cookie_bundle_invalid", "dependency_failed", false);
  return cookies;
}
export async function withCookieProfileFile<T>(
  cookiePath: string,
  tempRoot: string,
  use: (userDataDir: string, cookies: BrowserCookie[]) => Promise<T>,
) {
  const root = resolve(tempRoot);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(join(root, "playwright-cookie-profile-"));
  try {
    const content = await readFile(cookiePath, "utf8");
    return await use(directory, parseCookieBundle(content));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
export async function runWithEncryptedProfile(
  engine: PlaywrightCrawlerEngine,
  record: CredentialCipherRecord,
  masterKey: string,
  tempRoot: string,
  archiveLimits: ProfileArchiveLimits,
  plan: BrowserCollectionPlan,
  ids: { requestId: string; traceId: string },
  options: { locale?: string; timezoneId?: string } = {},
) {
  return withMaterializedCredential(record, masterKey, tempRoot, (archivePath) =>
    record.kind === "cookie_bundle"
      ? withCookieProfileFile(archivePath, tempRoot, (userDataDir, cookies) =>
          engine.run(plan, userDataDir, ids, { ...options, cookies }),
        )
      : withExtractedProfileArchive(archivePath, tempRoot, archiveLimits, (userDataDir) =>
          engine.run(plan, userDataDir, ids, options),
        ),
  );
}
