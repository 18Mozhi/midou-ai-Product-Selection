import {
  prepareAmazonDeliveryContext,
  assertAmazonDelivery,
  withDailyAmazonDelivery,
  type DailyAmazonDelivery,
} from "./amazon-delivery-context.js";
import { AmazonDeliveryRequestError } from "./amazon-delivery-request.js";
import { installPublicHttpTransport } from "./public-http-transport.js";
import { recordResourceFailure as retainResourceFailure } from "./resource-failures.js";
import { waitForManualCaptcha } from "./manual-handoff.js";
import { installNavigationRequestTransport } from "./navigation-transport.js";
import {
  createAuthenticatedBrowserProxy,
  AMAZON_MANUAL_WAF_HOST,
  browserResourceHostname,
} from "./authenticated-proxy.js";
export {
  BrowserHandoffStore,
  validHandoffCommand,
  handoffIdValid,
  HANDOFF_TTL_MS,
} from "./manual-handoff.js";
export type { HandoffInfo, HandoffCommand } from "./manual-handoff.js";
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
  amazon_delivery?: { country: "US"; postal_code: string };
  fail_on_http_error?: boolean;
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
  evidence?: {
    parser_version: string;
    dom_selectors?: string[];
    ancestor_ids?: string[];
    strip_non_content?: boolean;
  };
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
  if (input.fail_on_http_error !== undefined && typeof input.fail_on_http_error !== "boolean")
    throw new PlaywrightCrawlerError("crawler_http_policy_invalid", "parser_changed", false);
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
  if (
    input.amazon_delivery !== undefined &&
    (!input.amazon_delivery ||
      typeof input.amazon_delivery !== "object" ||
      start.origin !== "https://www.amazon.com" ||
      origins.length !== 1 ||
      input.amazon_delivery.country !== "US" ||
      typeof input.amazon_delivery.postal_code !== "string" ||
      !/^\d{5}$/.test(input.amazon_delivery.postal_code))
  )
    throw new PlaywrightCrawlerError("crawler_amazon_delivery_invalid", "parser_changed", false);
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
  if (input.evidence) {
    const {
      dom_selectors: selections,
      ancestor_ids: ancestors,
      strip_non_content: strip,
    } = input.evidence;
    if (
      (selections !== undefined &&
        (!Array.isArray(selections) ||
          !selections.length ||
          selections.length > 12 ||
          selections.some((x) => !selector(x)))) ||
      (ancestors !== undefined &&
        (!Array.isArray(ancestors) ||
          ancestors.length > 8 ||
          ancestors.some(
            (x) => typeof x !== "string" || !/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(x),
          ))) ||
      (strip !== undefined && typeof strip !== "boolean")
    )
      throw new PlaywrightCrawlerError(
        "crawler_evidence_projection_invalid",
        "parser_changed",
        false,
      );
  }
  return { ...input, allowed_origins: origins };
}
export function classifyBrowserFailure(error: unknown): {
  status: BrowserRunStatus;
  code: string;
  retryable: boolean;
} {
  if (error instanceof PlaywrightCrawlerError || error instanceof AmazonDeliveryRequestError)
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

/** Safe operational facts only; never emits a URL, text, cookie or attribute value. */
export function amazonDeliveryFailureKind(error: unknown) {
  if (!(error instanceof Error)) return "other";
  if (error.message === "amazon_delivery_requires_anonymous_page") return "anonymous_missing";
  if (error.message === "amazon_delivery_cache_invalid") return "daily_cache_invalid";
  if (error.message.includes("strict mode violation:")) return "selector_ambiguous";
  if (/Execution context was destroyed|Cannot find context with specified id/i.test(error.message))
    return "navigation_context_lost";
  if (/Target (?:page, context or browser|closed)|has been closed/i.test(error.message))
    return "page_closed";
  if (/is not a function/.test(error.message)) return "runtime_method_missing";
  if (/is not defined/.test(error.message)) return "runtime_reference_missing";
  if (/Cannot read properties/.test(error.message)) return "runtime_property_missing";
  if (/Frame was detached|Execution context is not available/i.test(error.message))
    return "navigation_context_lost";
  if (/Timeout/i.test(error.name + error.message)) return "readiness_timeout";
  return "other";
}

/** Shape counts only. Mirrors the unchanged daily cache contract, not admission. */
export function inspectAnonymousDeliveryCookieShape(cookies: Awaited<ReturnType<BrowserContext["cookies"]>>) {
  return {
    cookie_count: cookies.length,
    auth_cookie_count: cookies.filter((c) => ["at-main", "sess-at-main"].includes(c.name)).length,
    unaccepted_domain_count: cookies.filter((c) => ![".amazon.com", "www.amazon.com", "amazon.com"].includes(c.domain)).length,
    dotted_www_domain_count: cookies.filter((c) => c.domain === ".www.amazon.com").length,
    invalid_expiry_count: cookies.filter((c) => !Number.isFinite(c.expires)).length,
    invalid_same_site_count: cookies.filter((c) => !["Strict", "Lax", "None"].includes(c.sameSite)).length,
    unsafe_value_count: cookies.filter((c) => /[\r\n\0]/.test(c.name + c.value)).length,
    oversized_value_count: cookies.filter((c) => c.name.length > 128 || c.value.length > 8192).length,
    invalid_path_count: cookies.filter((c) => !c.path.startsWith("/") || c.path.length > 1024).length,
  };
}

export async function inspectAmazonDeliveryReadiness(page: Page, postal: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.all([
        page.evaluate((postal) => {
          const input = document.querySelector("#GLUXZipUpdateInput"),
            location = document.querySelector("#nav-global-location-popover-link"),
            header = document.querySelector("#glow-ingress-block"),
            account = document.querySelector("#nav-link-accountList"),
            href = location?.getAttribute("href");
          const visible = (node: Element | null) =>
            node instanceof HTMLElement && node.getClientRects().length > 0;
          const headers = [...document.querySelectorAll("#glow-ingress-block")];
          const matchingHeaders = headers.filter((node) =>
            new RegExp(`\\b${postal}\\b`).test(node.textContent ?? ""),
          );
          return {
            document_state: document.readyState,
            postal_input_present: Boolean(input),
            postal_input_visible: visible(input),
            location_link_present: Boolean(location),
            location_href_kind:
              href === "" ? "empty" : href?.startsWith("#") ? "fragment" : "other",
            postal_header_present: Boolean(header),
            postal_header_visible: visible(header),
            postal_header_count: headers.length,
            postal_matching_header_count: matchingHeaders.length,
            postal_matching_visible_header_count: matchingHeaders.filter(visible).length,
            postal_matches: new RegExp(`\\b${postal}\\b`).test(header?.textContent ?? ""),
            account_link_present: Boolean(account),
            account_link_visible: visible(account),
            account_has_expected_text:
              account?.textContent?.replace(/\s+/g, " ").trim() ===
              "Hello, sign in Account & Lists",
            password_input_present: Boolean(document.querySelector('input[type="password"]')),
          };
        }, postal),
        page.getByRole("link", { name: "Hello, sign in Account & Lists", exact: true }).count(),
        page.getByRole("link", { name: "Hello, sign in Account & Lists", exact: true }).isVisible(),
        page
          .getByRole("link", {
            name: "Hello, sign in Account & Lists",
            exact: true,
            includeHidden: true,
          })
          .isVisible(),
      ])
        .then(([dom, count, visible, hiddenVisible]) => ({
          ...dom,
          anonymous_exact_count: count,
          anonymous_exact_visible: visible,
          anonymous_aria_hidden_visible: hiddenVisible,
        }))
        .catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 750);
      }),
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function blocked(
  page: Page,
  signals: BrowserBlockSignals | undefined,
  onCaptcha?: (page: Page, selector: string) => Promise<void>,
  refreshSignals?: () => BrowserBlockSignals | undefined,
) {
  for (const [key, status] of [
    ["login", "blocked_login"],
    ["captcha", "blocked_captcha"],
    ["robots", "blocked_robots"],
  ] as const) {
    const css = signals?.[key];
    if (css && (await page.locator(css).count())) {
      if (key === "captcha" && onCaptcha) {
        await onCaptcha(page, css);
        await blocked(page, refreshSignals ? refreshSignals() : signals);
        return true;
      }
      throw new PlaywrightCrawlerError(status, status, false);
    }
  }
  return false;
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

/** Detached clones retain actual primary ancestry; the live page is never changed. */
export function projectBrowserEvidenceNodes(
  nodes: Element[],
  options: { ancestorIds: string[]; strip: boolean },
) {
  const selected = nodes.filter(
    (node) => !nodes.some((other) => other !== node && other.contains(node)),
  );
  const columns = new Map<Element, Element>();
  const output: Element[] = [];
  for (const node of selected) {
    const copy = node.cloneNode(true) as Element;
    if (options.strip)
      copy
        .querySelectorAll('script:not([type="application/ld+json"]), style')
        .forEach((child) => child.remove());
    const ancestor = options.ancestorIds.length
      ? node.closest(options.ancestorIds.map((id) => "#" + id).join(","))
      : null;
    if (ancestor && ancestor !== node) {
      let column = columns.get(ancestor);
      if (!column) {
        column = ancestor.cloneNode(false) as Element;
        columns.set(ancestor, column);
        output.push(column);
      }
      column.appendChild(copy);
    } else output.push(copy);
  }
  return output.map((node) => node.outerHTML).join("\n");
}

async function captureEvidence(
  page: Page,
  plan: BrowserCollectionPlan,
): Promise<BrowserEvidenceArtifact[]> {
  if (!plan.evidence) return [];
  const capturedAt = new Date().toISOString(),
    sourceUrl = httpUrl(page.url()).toString(),
    itemHtml = await page
      .locator(plan.evidence.dom_selectors?.join(",") ?? plan.item_selector)
      .evaluateAll(projectBrowserEvidenceNodes, {
        ancestorIds: plan.evidence.ancestor_ids ?? [],
        strip: plan.evidence.strip_non_content === true,
      }),
    pageHtml = itemHtml || (await page.locator("body").evaluate((node) => node.outerHTML)),
    deliveryHtml = plan.amazon_delivery
      ? await page.locator("#glow-ingress-block").evaluate((node) => node.outerHTML)
      : "",
    html = boundedUtf8(deliveryHtml ? deliveryHtml + "\n" + pageHtml : pageHtml, 250_000);
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
      proxy?: { server: string; username?: string; password?: string; connectTimeoutMs?: number };
      signal?: AbortSignal;
      handoff?: { root: string; runId: string };
      navigationTransport?: "browser" | "request";
      publicHttpRuntime?: { executable: string; script: string };
      dailyDelivery?: DailyAmazonDelivery;
    } = {},
  ): Promise<BrowserRunResult> {
    const plan = validateBrowserPlan(planInput, this.limits),
      started = Date.now();
    const handoffObservations: Record<string, unknown>[] = [];
    const documentResponses: Record<string, unknown>[] = [];
    const wafChallenges = new WeakSet<Page>();
    const wafSelector = 'script[src^="https://"][src*=".token.awswaf.com/"][src$="/challenge.js"]';
    const challengePresent = async (page: Page) =>
      Boolean(
        (plan.block_signals?.captcha && (await page.locator(plan.block_signals.captcha).count())) ||
        (wafChallenges.has(page) && (await page.locator(wafSelector).count())),
      );
    const signalsFor = (page: Page) =>
      plan.amazon_delivery && wafChallenges.has(page)
        ? {
            ...plan.block_signals,
            // This is a blocked-page marker, not permission to fetch or solve
            // WAF scripts. Keep the same bounded human-only handoff and guards.
            captcha: [plan.block_signals?.captcha, wafSelector].filter(Boolean).join(","),
          }
        : plan.block_signals;
    const guard = (page: Page) =>
      blocked(
        page,
        signalsFor(page),
        options.handoff && plan.amazon_delivery
          ? async (page, selector) => {
              let revokeManualChallenge: (() => void) | undefined;
              try {
                await waitForManualCaptcha({
                  root: options.handoff!.root,
                  runId: options.handoff!.runId,
                  requestId: ids.requestId,
                  page,
                  captchaSelector: selector,
                  allowedOrigins: plan.allowed_origins,
                  isChallengePresent: () => challengePresent(page),
                  onClaim: async (expiresAt) => {
                    if (
                      !localProxy ||
                      !wafChallenges.has(page) ||
                      new URL(page.url()).origin !== "https://www.amazon.com" ||
                      !(await page
                        .locator(
                          `script[src^="https://${AMAZON_MANUAL_WAF_HOST}/"][src$="/challenge.js"]`,
                        )
                        .count())
                    )
                      return;
                    revokeManualChallenge = localProxy.allowManualChallengeUntil(expiresAt);
                    // One normal same-page reload after the operator claims the
                    // session. No solver, token injection, new URL or proxy change.
                    const response = await page.reload({ waitUntil: "domcontentloaded" });
                    if (response?.status() === 429)
                      throw new PlaywrightCrawlerError("rate_limited", "rate_limited", true);
                  },
                  report: (observation) => {
                    if (handoffObservations.length === 10) handoffObservations.shift();
                    handoffObservations.push({ ...observation, elapsed_ms: Date.now() - started });
                  },
                  isReady: async () => {
                    if (rateLimited)
                      throw new PlaywrightCrawlerError("rate_limited", "rate_limited", true);
                    return page
                      .getByRole("link", {
                        name: "Hello, sign in Account & Lists",
                        exact: true,
                        includeHidden: true,
                      })
                      .isVisible();
                  },
                  ...(options.signal ? { signal: options.signal } : {}),
                });
              } catch (error) {
                if (error instanceof PlaywrightCrawlerError && error.code === "rate_limited")
                  throw error;
                throw new PlaywrightCrawlerError("blocked_captcha", "blocked_captcha", false);
              } finally {
                revokeManualChallenge?.();
              }
            }
          : undefined,
        () => signalsFor(page),
      );
    let context: BrowserContext | undefined,
      rateLimited = false,
      pageCount = 0,
      itemCount = 0,
      detailCount = 0;
    let localProxy: Awaited<ReturnType<typeof createAuthenticatedBrowserProxy>> | undefined;
    const onAbort = () => {
      void context?.close().catch(() => {});
    };
    let stage = "browser_launch";
    const resourceFailures: Record<string, unknown>[] = [];
    const recordResourceFailure = (failure: Record<string, unknown>) => {
      retainResourceFailure(resourceFailures, failure);
    };
    let artifacts: BrowserEvidenceArtifact[] = [];
    let searchSnapshot: BrowserSearchSnapshot | undefined;
    const offerDetails: BrowserOfferDetailSnapshot[] = [];
    try {
      options.signal?.throwIfAborted();
      if (options.proxy && !plan.amazon_delivery)
        throw new PlaywrightCrawlerError("crawler_proxy_scope_invalid", "parser_changed", false);
      if (options.navigationTransport === "request" && !plan.amazon_delivery)
        throw new PlaywrightCrawlerError("crawler_proxy_scope_invalid", "parser_changed", false);
      if (plan.amazon_delivery && options.cookies?.length)
        throw new PlaywrightCrawlerError("permission_denied", "blocked_login", false);
      if (options.proxy?.username && options.proxy.password)
        localProxy = await createAuthenticatedBrowserProxy(
          {
            server: options.proxy.server,
            username: options.proxy.username,
            password: options.proxy.password,
            ...(options.proxy.connectTimeoutMs === undefined
              ? {}
              : { connectTimeoutMs: options.proxy.connectTimeoutMs }),
          },
          (status, detail) => {
            if (status !== 200)
              recordResourceFailure({
                stage,
                resource_type: "proxy_connect",
                http_status: status,
                ...detail,
              });
          },
        );
      context = await chromium.launchPersistentContext(userDataDir, {
        headless: this.limits.headless,
        ...(options.proxy
          ? {
              proxy: localProxy?.proxy ?? {
                server: options.proxy.server,
                ...(options.proxy.username === undefined
                  ? {}
                  : { username: options.proxy.username }),
                ...(options.proxy.password === undefined
                  ? {}
                  : { password: options.proxy.password }),
              },
            }
          : {}),
        ...(this.limits.executablePath ? { executablePath: this.limits.executablePath } : {}),
        ...(options.locale ? { locale: options.locale } : {}),
        ...(options.timezoneId ? { timezoneId: options.timezoneId } : {}),
      });
      options.signal?.addEventListener("abort", onAbort, { once: true });
      options.signal?.throwIfAborted();
      if (options.cookies?.length) await context.addCookies(options.cookies);
      if (options.dailyDelivery?.cookies.length) {
        if (!plan.amazon_delivery)
          throw new PlaywrightCrawlerError("public_http_scope_invalid", "dependency_failed", false);
        await context.addCookies(options.dailyDelivery.cookies);
      }
      context.setDefaultTimeout(this.limits.actionTimeoutMs);
      context.setDefaultNavigationTimeout(this.limits.navigationTimeoutMs);
      if (options.publicHttpRuntime && !plan.amazon_delivery)
        throw new PlaywrightCrawlerError("public_http_scope_invalid", "dependency_failed", false);
      if (options.publicHttpRuntime)
        await installPublicHttpTransport(
          context,
          options.publicHttpRuntime.executable,
          options.publicHttpRuntime.script,
          this.limits.navigationTimeoutMs,
          options.proxy,
        );
      else if (options.navigationTransport === "request")
        await installNavigationRequestTransport(
          context,
          "https://www.amazon.com",
          this.limits.navigationTimeoutMs,
        );
      context.on("response", (response) => {
        if (response.status() === 429) rateLimited = true;
        const request = response.request();
        if (
          plan.amazon_delivery &&
          request.isNavigationRequest?.() &&
          request.frame().parentFrame() === null
        ) {
          const currentPage = request.frame().page();
          if (response.status() === 202 && response.headers()["x-amzn-waf-action"] === "challenge")
            wafChallenges.add(currentPage);
          else wafChallenges.delete(currentPage);
          if (documentResponses.length === 10) documentResponses.shift();
          documentResponses.push({
            http_status: response.status(),
            hostname: browserResourceHostname(response.url()),
            method:
              request.method() === "POST" ? "POST" : request.method() === "GET" ? "GET" : "other",
            elapsed_ms: Date.now() - started,
          });
        }
        if (plan.amazon_delivery && response.status() >= 400)
          recordResourceFailure({
            stage,
            resource_type: response.request().resourceType(),
            http_status: response.status(),
            ...(typeof response.url === "function"
              ? { hostname: browserResourceHostname(response.url()) }
              : {}),
          });
      });
      context.on("requestfailed", (request) => {
        if (!plan.amazon_delivery) return;
        const code = /net::(ERR_[A-Z0-9_]+)/.exec(request.failure()?.errorText ?? "")?.[1];
        if (code && code !== "ERR_ABORTED")
          recordResourceFailure({
            stage,
            resource_type: request.resourceType(),
            network_code: code,
            ...(typeof request.url === "function"
              ? { hostname: browserResourceHostname(request.url()) }
              : {}),
          });
      });
      const page = context.pages()[0] ?? (await context.newPage());
      if (plan.amazon_delivery && options.dailyDelivery && !options.dailyDelivery.cached) {
        stage = "amazon_delivery.daily_home";
        const home = "https://www.amazon.com/";
        await this.goto(page, home, plan.allowed_origins, true, guard);
        const check = async () => {
          await guard(page);
        };
        await prepareAmazonDeliveryContext(
          page,
          plan.amazon_delivery.postal_code,
          check,
          (step) => {
            stage = `amazon_delivery.${step}`;
          },
          () => this.goto(page, home, plan.allowed_origins, true, guard),
          this.limits.navigationTimeoutMs,
        );
        await assertAmazonDelivery(page, plan.amazon_delivery.postal_code, check);
        stage = "amazon_delivery.daily_cache_save";
        await options.dailyDelivery.save(context);
      }
      // An imported discovery link can carry Amazon's presentation slug and
      // referral suffix. Use the same exact-ASIN route as the health check,
      // without changing stored targets or any query that may select a variant.
      const originalTarget = new URL(plan.start_url);
      const referralAsin =
        plan.amazon_delivery &&
        originalTarget.origin === "https://www.amazon.com" &&
        !originalTarget.username &&
        !originalTarget.password &&
        !originalTarget.search &&
        !originalTarget.hash
          ? /^\/(?:[^/]+\/)?dp\/([A-Za-z0-9]{10})\/ref=[A-Za-z0-9_-]+\/?$/.exec(
              originalTarget.pathname,
            )?.[1]
          : undefined;
      const navigationTarget = referralAsin
        ? `https://www.amazon.com/dp/${referralAsin.toUpperCase()}`
        : plan.start_url;
      stage = "initial_navigation";
      await this.goto(page, navigationTarget, plan.allowed_origins, plan.fail_on_http_error, guard);
      stage = "initial_guard";
      await guard(page);
      if (plan.amazon_delivery) {
        const assertSafe = async () => {
          if (httpUrl(page.url()).origin !== "https://www.amazon.com")
            throw new PlaywrightCrawlerError("crawler_origin_forbidden", "parser_changed", false);
          await guard(page);
        };
        if (options.dailyDelivery) {
          // The daily homepage is the only place allowed to change location.
          // Every product/search response still proves its own anonymous ZIP.
          await assertAmazonDelivery(page, plan.amazon_delivery.postal_code, assertSafe);
        } else
          await prepareAmazonDeliveryContext(
            page,
            plan.amazon_delivery.postal_code,
            assertSafe,
            (step) => {
              stage = `amazon_delivery.${step}`;
            },
            async () => {
              await this.goto(
                page,
                navigationTarget,
                plan.allowed_origins,
                plan.fail_on_http_error,
                guard,
              );
            },
            this.limits.navigationTimeoutMs,
          );
        stage = "delivery_final_header";
        await assertSafe();
        await page
          .locator("#glow-ingress-block")
          .filter({ hasText: new RegExp(`\\b${plan.amazon_delivery.postal_code}\\b`) })
          .waitFor({ state: "visible" });
      }
      stage = "search_interaction";
      if (plan.search) {
        await page.locator(plan.search.input_selector).fill(plan.search.query);
        if (plan.search.submit_selector) await page.locator(plan.search.submit_selector).click();
        else await page.locator(plan.search.input_selector).press("Enter");
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        if (!plan.allowed_origins.includes(httpUrl(page.url()).origin))
          throw new PlaywrightCrawlerError("crawler_origin_forbidden", "parser_changed", false);
        await guard(page);
        await page
          .locator(plan.item_selector)
          .first()
          .waitFor({ state: "attached", timeout: this.limits.actionTimeoutMs })
          .catch(() => {});
      } else if (plan.amazon_delivery && originalTarget.pathname === "/s") {
        // Direct /s?k= plans do not have plan.search. Give their original result
        // selector the same bounded readiness wait before counting an empty page.
        await page
          .locator(plan.item_selector)
          .first()
          .waitFor({ state: "attached", timeout: this.limits.actionTimeoutMs })
          .catch(async () => {
            await guard(page);
          });
      }
      // A detail page has no legitimate empty-success state. Wait for its actual
      // title before counting/capturing; images alone are not product evidence.
      if (plan.amazon_delivery && new URL(plan.start_url).pathname !== "/s") {
        stage = "amazon_detail_ready";
        try {
          await page.waitForFunction(
            (itemSelector) =>
              Boolean(
                document.querySelector(itemSelector) &&
                document.querySelector("#productTitle")?.textContent?.trim(),
              ),
            plan.item_selector,
            { timeout: this.limits.actionTimeoutMs },
          );
        } catch (error) {
          // A challenge appearing during the wait retains its original blocked state.
          await guard(page);
          throw error;
        }
        await guard(page);
      }
      stage = "extract_items";
      for (let index = 0; index < plan.max_pages; index += 1) {
        if (rateLimited) throw new PlaywrightCrawlerError("rate_limited", "rate_limited", true);
        await guard(page);
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
              await this.goto(detailPage, item.canonical_url, plan.allowed_origins, false, guard);
              await guard(detailPage);
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
              await this.goto(detailPage, detail.toString(), plan.allowed_origins, false, guard);
              await guard(detailPage);
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
      const httpStatus = error instanceof Error && "httpStatus" in error ? error.httpStatus : null,
        networkCode =
          error instanceof Error ? /net::(ERR_[A-Z0-9_]+)/.exec(error.message)?.[1] : undefined;
      let deliveryState: Record<string, unknown> | null = null;
      let detailState: Record<string, unknown> | null = null;
      if (plan.amazon_delivery && stage === "amazon_detail_ready" && failure.code === "timeout") {
        const current = context?.pages()[0];
        if (current && current.url().startsWith("https://www.amazon.com/")) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            // Operational evidence only: never retain page text, cookies, or a URL.
            detailState = await Promise.race([
              current
                .evaluate(
                  ({ selector, initialPath, postal }) => {
                    const asin = (path: string) =>
                      /\/(?:dp|gp\/product)\/([A-Za-z0-9]{10})(?:\/|$)/
                        .exec(path)?.[1]
                        ?.toUpperCase();
                    const expected = asin(initialPath),
                      actual = asin(location.pathname);
                    const title = document.querySelector("#productTitle");
                    return {
                      document_state: document.readyState,
                      expected_product_path: Boolean(expected && actual === expected),
                      item_present: Boolean(document.querySelector(selector)),
                      title_present: Boolean(title),
                      title_nonempty: Boolean(title?.textContent?.trim()),
                      delivery_matches: Boolean(
                        document
                          .querySelector("#glow-ingress-block")
                          ?.textContent?.match(new RegExp(`\\b${postal}\\b`)),
                      ),
                    };
                  },
                  {
                    selector: plan.item_selector,
                    initialPath: new URL(plan.start_url).pathname,
                    postal: plan.amazon_delivery.postal_code,
                  },
                )
                .catch(() => null),
              new Promise<null>((resolve) => {
                timer = setTimeout(() => resolve(null), 750);
              }),
            ]);
          } finally {
            clearTimeout(timer);
          }
        }
      }
      if (plan.amazon_delivery && stage.startsWith("amazon_delivery.")) {
        const current = context?.pages()[0];
        if (current && current.url().startsWith("https://www.amazon.com/")) {
          deliveryState = await inspectAmazonDeliveryReadiness(
            current,
            plan.amazon_delivery.postal_code,
          );
          if (deliveryState) {
            deliveryState.failure_reason = amazonDeliveryFailureKind(error);
            deliveryState.failure_operation =
              error instanceof Error
                ? ["locator.waitFor", "locator.count", "locator.isVisible", "locator.textContent", "page.evaluate"]
                    .find((operation) => error.message.startsWith(`${operation}:`)) ?? "other"
                : "other";
            deliveryState.failure_type =
              error instanceof Error && ["Error", "TypeError", "ReferenceError", "TimeoutError", "SyntaxError"].includes(error.name)
                ? error.name : "other";
            deliveryState.failure_sites = error instanceof Error
              ? [...(error.stack ?? "").matchAll(/\b(amazon-delivery-context|index|locator|connection|channelOwner)\.js:(\d+):(\d+)/g)]
                  .slice(0, 4).map((match) => `${match[1]}.js:${match[2]}:${match[3]}`)
              : [];
            if (error instanceof Error && error.message === "amazon_delivery_cache_invalid" && context) {
              let timer: ReturnType<typeof setTimeout> | undefined;
              try {
                const cookies = await Promise.race([
                  context.cookies("https://www.amazon.com/"),
                  new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 750); }),
                ]);
                if (cookies) deliveryState.daily_cache_shape = inspectAnonymousDeliveryCookieShape(cookies);
              } finally { clearTimeout(timer); }
            }
          }
        }
      }
      if (plan.amazon_delivery)
        console.warn(
          JSON.stringify({
            event: "amazon_browser_step_failed",
            stage,
            error_code: failure.code,
            ...(typeof httpStatus === "number" && httpStatus >= 100 && httpStatus <= 599
              ? { http_status: httpStatus }
              : {}),
            ...(networkCode ? { network_code: networkCode } : {}),
            ...(deliveryState ? { delivery_state: deliveryState } : {}),
            ...(detailState ? { detail_state: detailState } : {}),
            ...(resourceFailures.length ? { resource_failures: resourceFailures } : {}),
            ...(handoffObservations.length ? { handoff_observations: handoffObservations } : {}),
            ...(documentResponses.length ? { main_document_responses: documentResponses } : {}),
            ...(localProxy ? { proxy_auth_relay: true } : {}),
            ...(options.navigationTransport === "request"
              ? { navigation_transport: "request" }
              : {}),
          }),
        );
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
      options.signal?.removeEventListener("abort", onAbort);
      await context?.close().catch(() => {});
      await localProxy?.close();
    }
  }
  private async goto(
    page: Page,
    target: string,
    origins: string[],
    strict = false,
    guard?: (page: Page) => Promise<boolean>,
  ) {
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
    // A challenge can itself be served with HTTP 503. Inspect it before treating
    // the response as a transport failure; a successful human handoff replaces it.
    if (await guard?.(page)) return;
    if (strict && response && response.status() >= 400) {
      const status = response.status(),
        code =
          status >= 500
            ? "network_error"
            : [404, 410].includes(status)
              ? "empty_result"
              : "permission_denied";
      throw Object.assign(new PlaywrightCrawlerError(code, "dependency_failed", status >= 500), {
        httpStatus: status,
      });
    }
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
    // Chromium may still be releasing its profile handles on Windows after close.
    await rm(directory, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
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
    await rm(directory, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
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
  options: {
    locale?: string;
    timezoneId?: string;
    signal?: AbortSignal;
    proxy?: { server: string; username?: string; password?: string; connectTimeoutMs?: number };
    handoff?: { root: string; runId: string };
    navigationTransport?: "browser" | "request";
    publicHttpRuntime?: { executable: string; script: string };
  } = {},
) {
  const run = (userDataDir: string) => {
    if (
      !plan.amazon_delivery ||
      record.kind !== "browser_profile" ||
      process.env.NODE_ENV !== "production"
    )
      return engine.run(plan, userDataDir, ids, options);
    return withDailyAmazonDelivery(
      join(dirname(resolve(tempRoot)), "tmp", "amazon-delivery-context"),
      `${record.assetId}:${record.assetVersion}:${options.proxy?.server ?? "direct"}`,
      plan.amazon_delivery.postal_code,
      (dailyDelivery) => engine.run(plan, userDataDir, ids, { ...options, dailyDelivery }),
      options.signal,
    );
  };
  return withMaterializedCredential(record, masterKey, tempRoot, (archivePath) =>
    record.kind === "cookie_bundle"
      ? withCookieProfileFile(archivePath, tempRoot, (userDataDir, cookies) =>
          engine.run(plan, userDataDir, ids, { ...options, cookies }),
        )
      : withExtractedProfileArchive(archivePath, tempRoot, archiveLimits, (userDataDir) =>
          run(userDataDir),
        ),
  );
}
