import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { ProviderAdapterFailure, type ProviderRawRecord } from "@scoutops/provider-adapters";
import type { BrowserEvidenceArtifactContract } from "./1688-browser-contract.js";
import { parseAmazonProductPage } from "./parsers/index.js";

export const AMAZON_BROWSER_PARSER_VERSION = "amazon-public-browser-v1";
export const anonymousAmazonArchive = () => gzipSync(Buffer.alloc(1024));
export const anonymousAmazonFingerprint = () =>
  createHash("sha256").update(anonymousAmazonArchive()).digest("hex").slice(0, 16);

const verificationUrl = (url: URL) =>
  url.origin === "https://www.amazon.com" &&
  (url.pathname.startsWith("/checkpoint/") ||
    url.pathname.startsWith("/ap/") ||
    url.searchParams.has("bm-verify"));

/** Verification redirects are failures; discard their body and transient URL parameters. */
export function sanitizeAmazonBrowserRunResult(input: Record<string, unknown>) {
  if (!Array.isArray(input.artifacts)) return input;
  const denied = input.artifacts.some((artifact) => {
    try {
      return verificationUrl(new URL(String(artifact?.source_url)));
    } catch {
      return false;
    }
  });
  if (!denied) return input;
  const { artifacts, snapshots, ...rest } = input;
  return {
    ...rest,
    status: "dependency_failed",
    error_code: "permission_denied",
    item_count: 0,
    detail_count: 0,
  };
}

export function amazonBrowserUrl(target: Record<string, unknown>) {
  if (target.page_url !== undefined) {
    if (typeof target.page_url !== "string")
      throw new ProviderAdapterFailure("invalid_payload", false);
    let url: URL;
    try {
      url = new URL(target.page_url);
    } catch {
      throw new ProviderAdapterFailure("invalid_payload", false);
    }
    if (
      url.searchParams.has("bm-verify") ||
      url.protocol !== "https:" ||
      url.hostname !== "www.amazon.com" ||
      url.username ||
      url.password ||
      url.hash ||
      !/^\/(?:[^?#]*\/)?(?:dp|gp\/product)\/[A-Za-z0-9]{10}(?:\/|$)/.test(url.pathname)
    )
      throw new ProviderAdapterFailure("invalid_payload", false);
    return url.toString();
  }
  if (
    typeof target.query !== "string" ||
    !target.query.trim() ||
    target.query.length > 200 ||
    /[\u0000-\u001f]/.test(target.query)
  )
    throw new ProviderAdapterFailure("query_invalid", false);
  return "https://www.amazon.com/s?k=" + encodeURIComponent(target.query.trim());
}

export function createAmazonBrowserExecutionRequest(target: Record<string, unknown>) {
  const url = amazonBrowserUrl(target),
    detail = new URL(url).pathname !== "/s";
  return {
    purpose: "amazon_public",
    plan: {
      start_url: url,
      allowed_origins: ["https://www.amazon.com"],
      fail_on_http_error: true,
      item_selector: detail ? "#title" : '[data-component-type="s-search-result"]',
      max_pages: 1,
      max_scrolls: 0,
      max_details: 0,
      block_signals: {
        login: 'input[type="password"]',
        captcha:
          'form[action*="validateCaptcha"], #captchacharacters, meta[http-equiv="refresh"][content*="bm-verify"]',
      },
      evidence: {
        parser_version: AMAZON_BROWSER_PARSER_VERSION,
        ...(detail
          ? {
              dom_selectors: [
                "#landingImage",
                "#title",
                "#averageCustomerReviews",
                "#corePriceDisplay_desktop_feature_div",
                "#corePrice_feature_div",
                "#social-proofing-faceout-title-tk_bought",
                "#detailBulletsWrapper_feature_div",
                "#productDetails_detailBullets_sections1",
                "#localTopReviewsList",
              ],
              ancestor_ids: ["leftCol", "centerCol"],
              strip_non_content: true,
            }
          : {}),
      },
    },
  };
}

export function parseAmazonBrowserEvidenceArtifacts(
  input: unknown,
): BrowserEvidenceArtifactContract[] {
  if (!Array.isArray(input) || input.length !== 2)
    throw new ProviderAdapterFailure("source_changed", false);
  const output: BrowserEvidenceArtifactContract[] = input.map((a: Record<string, unknown>) => {
    if (
      !a ||
      typeof a !== "object" ||
      typeof a.source_url !== "string" ||
      typeof a.content_base64 !== "string" ||
      a.parser_version !== AMAZON_BROWSER_PARSER_VERSION
    )
      throw new ProviderAdapterFailure("invalid_payload", false);
    let u: URL;
    try {
      u = new URL(a.source_url);
    } catch {
      throw new ProviderAdapterFailure("invalid_payload", false);
    }
    if (verificationUrl(u)) throw new ProviderAdapterFailure("permission_denied", false);
    const bytes = Buffer.from(a.content_base64, "base64"),
      date = new Date(String(a.captured_at));
    if (
      u.searchParams.has("bm-verify") ||
      u.origin !== "https://www.amazon.com" ||
      u.username ||
      u.password ||
      u.hash ||
      !Number.isFinite(date.getTime()) ||
      !bytes.length ||
      bytes.toString("base64") !== a.content_base64 ||
      createHash("sha256").update(bytes).digest("hex") !== a.content_sha256
    )
      throw new ProviderAdapterFailure("invalid_payload", false);
    if (a.kind === "dom_fragment") {
      if (
        a.content_type !== "text/html" ||
        bytes.length > 250000 ||
        !Buffer.from(bytes.toString("utf8")).equals(bytes)
      )
        throw new ProviderAdapterFailure("invalid_payload", false);
    } else if (a.kind === "screenshot") {
      if (
        a.content_type !== "image/jpeg" ||
        bytes.length > 800000 ||
        bytes[0] !== 255 ||
        bytes[1] !== 216 ||
        bytes[2] !== 255
      )
        throw new ProviderAdapterFailure("invalid_payload", false);
    } else throw new ProviderAdapterFailure("invalid_payload", false);
    return {
      kind: a.kind,
      source_url: u.toString(),
      content_type: a.content_type,
      content: bytes,
      content_sha256: String(a.content_sha256),
      captured_at: date,
      parser_version: AMAZON_BROWSER_PARSER_VERSION,
    } as BrowserEvidenceArtifactContract;
  });
  if (new Set(output.map((a) => a.kind)).size !== 2)
    throw new ProviderAdapterFailure("invalid_payload", false);
  return output;
}

export function parseAmazonBrowserRunResult(
  input: Record<string, unknown>,
  target: Record<string, unknown>,
) {
  if (!["succeeded", "succeeded_empty"].includes(String(input.status)))
    throw new ProviderAdapterFailure(
      String(input.error_code ?? "dependency_unavailable"),
      ["timeout", "rate_limited", "dependency_unavailable"].includes(String(input.error_code)),
    );
  const artifacts = parseAmazonBrowserEvidenceArtifacts(input.artifacts);
  if (new Set(artifacts.map((a) => a.source_url)).size !== 1)
    throw new ProviderAdapterFailure("invalid_payload", false);
  const expected = new URL(amazonBrowserUrl(target));
  const dom = artifacts.find((a) => a.kind === "dom_fragment")!;
  for (const a of artifacts) {
    const url = new URL(a.source_url);
    const identity = (u: URL) =>
      /\/(?:dp|gp\/product)\/([A-Za-z0-9]{10})(?:\/|$)/.exec(u.pathname)?.[1]?.toUpperCase();
    if (
      expected.pathname === "/s"
        ? url.pathname !== "/s" || url.searchParams.get("k") !== expected.searchParams.get("k")
        : identity(url) !== identity(expected)
    )
      throw new ProviderAdapterFailure("invalid_payload", false);
  }
  const records = parseAmazonProductPage(
    "<html><body>" + dom.content.toString("utf8") + "</body></html>",
    dom.source_url,
    20,
  );
  if (!records.length) throw new ProviderAdapterFailure("source_changed", false);
  for (const r of records) {
    r.observedAt = dom.captured_at.toISOString();
    const payload = r.payload as {
      fields: Record<string, unknown>;
      source_paths: Record<string, string>;
    };
    payload.fields.observed_at = dom.captured_at.toISOString();
    payload.source_paths.observed_at = "browser.artifact.captured_at";
  }
  return records;
}
