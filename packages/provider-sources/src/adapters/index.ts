import {
  ProviderAdapterFailure,
  type AdapterHealthContext,
  type AdapterHealthSignal,
  type AdapterInvocationContext,
  type ProviderAdapter,
  type ProviderCollectBatch,
  type ProviderCollectRequest,
  type ProviderNormalizedRecord,
  type ProviderRawRecord,
} from "@scoutops/provider-adapters";
import { request as httpsRequest } from "node:https";
import { BUILTIN_PROVIDER_SOURCES } from "../catalog/index.js";
import {
  parseAmazonProductPage,
  parseDhgateSupplierSearchPage,
  parseEc21SupplierSearchPage,
  parseGoogleNewsRss,
  parseMadeInChinaSearchPage,
  parseProductSupplyCsv,
  parseStructuredCatalogPage,
  parseSyndicationFeed,
  sourceEvidencePayload,
  text,
} from "../parsers/index.js";

const AMAZON_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

async function fetchAmazonWithNativeHttps(
  url: string,
  signal: AbortSignal,
  headers: Record<string, string>,
) {
  return await new Promise<Response>((resolve, reject) => {
    let settled = false;
    const finish = (error: unknown, response?: Response) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(response!);
    };
    const request = httpsRequest(url, { method: "GET", headers }, (incoming) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      incoming.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > AMAZON_MAX_RESPONSE_BYTES) {
          incoming.destroy();
          request.destroy();
          finish(new ProviderAdapterFailure("invalid_payload", false));
          return;
        }
        chunks.push(chunk);
      });
      incoming.once("error", (error) => finish(error));
      incoming.once("end", () => {
        const responseHeaders = new Headers();
        for (const [name, value] of Object.entries(incoming.headers)) {
          if (Array.isArray(value)) for (const item of value) responseHeaders.append(name, item);
          else if (value !== undefined) responseHeaders.set(name, value);
        }
        const response = new Response(new Uint8Array(Buffer.concat(chunks)), {
          status: incoming.statusCode ?? 502,
          headers: responseHeaders,
          ...(incoming.statusMessage ? { statusText: incoming.statusMessage } : {}),
        });
        Object.defineProperty(response, "url", { configurable: true, value: url });
        finish(null, response);
      });
    });
    const abort = () => request.destroy(signal.reason);
    request.once("error", (error) => finish(signal.aborted ? signal.reason : error));
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
    request.end();
  });
}

abstract class SourceAdapter implements ProviderAdapter {
  abstract readonly key: string;
  abstract readonly accessMode: "public_rss" | "public_page" | "authenticated_browser" | "import";
  abstract readonly version: string;
  abstract collect(
    request: ProviderCollectRequest,
    signal: AbortSignal,
  ): Promise<ProviderCollectBatch>;
  abstract healthCheck(
    context: AdapterHealthContext,
    signal: AbortSignal,
  ): Promise<AdapterHealthSignal>;
  normalize(
    record: ProviderRawRecord,
    context: AdapterInvocationContext,
  ): ProviderNormalizedRecord {
    const value = sourceEvidencePayload(record);
    return {
      external_id: record.externalId,
      observed_at: record.observedAt,
      canonical_url: value.canonical_url,
      fields: value.fields,
      evidence_ref: record.evidenceRef,
      provenance: {
        provider_id: context.provider.id,
        adapter_key: this.key,
        adapter_version: this.version,
        parser_version: context.provider.parserVersion,
      },
    };
  }
}

export class Alibaba1688BrowserAdapter extends SourceAdapter {
  readonly key = "1688_search";
  readonly accessMode = "authenticated_browser" as const;
  readonly version = "1688-browser-adapter-v1";
  async collect(): Promise<ProviderCollectBatch> {
    throw new ProviderAdapterFailure("browser_runtime_required", false);
  }
  async healthCheck(): Promise<AdapterHealthSignal> {
    return {
      status: "blocked",
      latencyMs: 0,
      errorCode: "browser_profile_verification_required",
      message: "需由 Python Crawler 使用有效浏览器档案执行并回写固定样本结果。",
    };
  }
}

export class GoogleNewsRssAdapter extends SourceAdapter {
  readonly key = "google_news_search";
  readonly accessMode = "public_rss" as const;
  readonly version = "google-news-rss-adapter-v1";
  constructor(private readonly fetcher: typeof fetch = fetch) {
    super();
  }
  private url(target: string, query: string) {
    if (
      target !== "https://news.google.com/rss/search?q={urlEncodedQuery}&hl=en-US&gl=US&ceid=US:en"
    )
      throw new ProviderAdapterFailure("source_configuration_invalid", false);
    return target.replace("{urlEncodedQuery}", encodeURIComponent(text(query, "query", 200)));
  }
  async collect(request: ProviderCollectRequest, signal: AbortSignal) {
    const query = (request as ProviderCollectRequest & { target?: Record<string, unknown> }).target
        ?.query,
      url = this.url(request.provider.targetUrl, query as string),
      response = await this.fetcher(url, {
        signal,
        redirect: "error",
        headers: {
          accept: "application/rss+xml, application/xml;q=0.9",
          "user-agent": "ScoutOps/0.1 source-admission",
        },
      });
    if (response.status === 429) throw new ProviderAdapterFailure("rate_limited", true);
    if (response.status >= 500) throw new ProviderAdapterFailure("network_error", true);
    if (!response.ok) throw new ProviderAdapterFailure("permission_denied", false);
    const type = response.headers.get("content-type") ?? "";
    if (!/(xml|rss)/i.test(type)) throw new ProviderAdapterFailure("source_changed", false);
    const xml = await response.text(),
      records = parseGoogleNewsRss(xml, Math.min(request.limit, 20));
    return { records, nextCursor: null };
  }
  async healthCheck(
    context: AdapterHealthContext,
    signal: AbortSignal,
  ): Promise<AdapterHealthSignal> {
    const started = Date.now(),
      url = this.url(context.provider.targetUrl, "product");
    try {
      const response = await this.fetcher(url, {
        signal,
        redirect: "error",
        headers: {
          accept: "application/rss+xml, application/xml;q=0.9",
          "user-agent": "ScoutOps/0.1 source-health",
        },
      });
      if (response.status === 429)
        return {
          status: "degraded",
          latencyMs: Date.now() - started,
          errorCode: "rate_limited",
          message: "Google News RSS 返回限流。",
        };
      if (!response.ok)
        return {
          status: "degraded",
          latencyMs: Date.now() - started,
          errorCode: "network_error",
          message: `Google News RSS 返回 HTTP ${response.status}。`,
        };
      const sample = await response.text();
      parseGoogleNewsRss(sample, 1);
      return {
        status: "ready",
        latencyMs: Date.now() - started,
        errorCode: null,
        message: "Google News RSS XML 合同可读取；生产启用仍需所有者政策复核。",
      };
    } catch (error) {
      if (error instanceof ProviderAdapterFailure) throw error;
      throw new ProviderAdapterFailure("network_error", true);
    }
  }
}
export class FixedGoogleNewsRssAdapter extends SourceAdapter {
  readonly accessMode = "public_rss" as const;
  readonly version = "google-news-fixed-rss-adapter-v1";
  constructor(
    readonly key: string,
    private readonly configuredUrl: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    super();
  }
  private url(target: string) {
    if (target !== this.configuredUrl)
      throw new ProviderAdapterFailure("source_configuration_invalid", false);
    const url = new URL(target);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "news.google.com" ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new ProviderAdapterFailure("source_configuration_invalid", false);
    return url.toString();
  }
  async collect(request: ProviderCollectRequest, signal: AbortSignal) {
    const response = await this.fetcher(this.url(request.provider.targetUrl), {
      signal,
      redirect: "error",
      headers: {
        accept: "application/rss+xml, application/xml;q=0.9",
        "user-agent": "ScoutOps/1.0 automatic-hotspot-collector",
      },
    });
    if (response.status === 429) throw new ProviderAdapterFailure("rate_limited", true);
    if (response.status >= 500) throw new ProviderAdapterFailure("network_error", true);
    if (!response.ok) throw new ProviderAdapterFailure("permission_denied", false);
    const type = response.headers.get("content-type") ?? "";
    if (!/(xml|rss)/i.test(type)) throw new ProviderAdapterFailure("source_changed", false);
    return {
      records: parseGoogleNewsRss(await response.text(), Math.min(request.limit, 20)),
      nextCursor: null,
    };
  }
  async healthCheck(
    context: AdapterHealthContext,
    signal: AbortSignal,
  ): Promise<AdapterHealthSignal> {
    const started = Date.now();
    try {
      const response = await this.fetcher(this.url(context.provider.targetUrl), {
        signal,
        redirect: "error",
        headers: {
          accept: "application/rss+xml, application/xml;q=0.9",
          "user-agent": "ScoutOps/1.0 source-health",
        },
      });
      if (!response.ok)
        return {
          status: "degraded",
          latencyMs: Date.now() - started,
          errorCode: response.status === 429 ? "rate_limited" : "network_error",
          message: `热点 RSS 返回 HTTP ${response.status}。`,
        };
      parseGoogleNewsRss(await response.text(), 1);
      return {
        status: "ready",
        latencyMs: Date.now() - started,
        errorCode: null,
        message: "公开热点 RSS 可读取。",
      };
    } catch (error) {
      if (error instanceof ProviderAdapterFailure) throw error;
      throw new ProviderAdapterFailure("network_error", true);
    }
  }
}
export class FixedSyndicationFeedAdapter extends SourceAdapter {
  readonly accessMode = "public_rss" as const;
  readonly version = "syndication-feed-adapter-v1";
  constructor(
    readonly key: string,
    private readonly configuredUrl: string,
    private readonly sourceName: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    super();
  }
  private url(target: string) {
    if (target !== this.configuredUrl)
      throw new ProviderAdapterFailure("source_configuration_invalid", false);
    const url = new URL(target);
    if (url.protocol !== "https:" || url.username || url.password || url.hash)
      throw new ProviderAdapterFailure("source_configuration_invalid", false);
    return url.toString();
  }
  private async response(target: string, signal: AbortSignal) {
    const response = await this.fetcher(this.url(target), {
      signal,
      redirect: "error",
      headers: {
        accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9",
        "user-agent": "ScoutOps/1.0 automatic-hotspot-collector",
      },
    });
    if (response.status === 429) throw new ProviderAdapterFailure("rate_limited", true);
    if (response.status >= 500) throw new ProviderAdapterFailure("network_error", true);
    if (!response.ok) throw new ProviderAdapterFailure("permission_denied", false);
    return response;
  }
  async collect(request: ProviderCollectRequest, signal: AbortSignal) {
    const response = await this.response(request.provider.targetUrl, signal);
    return {
      records: parseSyndicationFeed(
        await response.text(),
        this.sourceName,
        Math.min(request.limit, 20),
      ),
      nextCursor: null,
    };
  }
  async healthCheck(
    context: AdapterHealthContext,
    signal: AbortSignal,
  ): Promise<AdapterHealthSignal> {
    const started = Date.now();
    try {
      const response = await this.response(context.provider.targetUrl, signal);
      parseSyndicationFeed(await response.text(), this.sourceName, 1);
      return {
        status: "ready",
        latencyMs: Date.now() - started,
        errorCode: null,
        message: "公开 RSS/Atom 频道可读取。",
      };
    } catch (error) {
      if (error instanceof ProviderAdapterFailure) throw error;
      throw new ProviderAdapterFailure("network_error", true);
    }
  }
}
export class FixedStructuredPublicPageAdapter extends SourceAdapter {
  readonly accessMode = "public_page" as const;
  readonly version = "structured-public-page-adapter-v1";
  constructor(
    readonly key: string,
    private readonly configuredUrl: string,
    private readonly sourceName: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    super();
  }
  private url(target: string) {
    if (target !== this.configuredUrl)
      throw new ProviderAdapterFailure("source_configuration_invalid", false);
    const url = new URL(target);
    if (url.protocol !== "https:" || url.username || url.password || url.hash)
      throw new ProviderAdapterFailure("source_configuration_invalid", false);
    return url.toString();
  }
  private async response(target: string, signal: AbortSignal) {
    const response = await this.fetcher(this.url(target), {
      signal,
      redirect: "error",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 (compatible; ScoutOpsCatalogCrawler/1.0)",
      },
    });
    if (response.status === 429) throw new ProviderAdapterFailure("rate_limited", true);
    if (response.status >= 500) throw new ProviderAdapterFailure("network_error", true);
    if (!response.ok) throw new ProviderAdapterFailure("permission_denied", false);
    const type = response.headers.get("content-type") ?? "";
    if (!/html/i.test(type)) throw new ProviderAdapterFailure("source_changed", false);
    return response;
  }
  async collect(request: ProviderCollectRequest, signal: AbortSignal) {
    const response = await this.response(request.provider.targetUrl, signal);
    return {
      records: parseStructuredCatalogPage(
        await response.text(),
        this.configuredUrl,
        this.sourceName,
        Math.min(request.limit, 20),
      ),
      nextCursor: null,
    };
  }
  async healthCheck(
    context: AdapterHealthContext,
    signal: AbortSignal,
  ): Promise<AdapterHealthSignal> {
    const started = Date.now();
    try {
      const response = await this.response(context.provider.targetUrl, signal);
      parseStructuredCatalogPage(await response.text(), this.configuredUrl, this.sourceName, 1);
      return {
        status: "ready",
        latencyMs: Date.now() - started,
        errorCode: null,
        message: "公开平台榜单页面可读取并解析。",
      };
    } catch (error) {
      if (error instanceof ProviderAdapterFailure)
        return {
          status: "degraded",
          latencyMs: Date.now() - started,
          errorCode: error.message,
          message: "公开榜单页面暂不可解析。",
        };
      throw new ProviderAdapterFailure("network_error", true);
    }
  }
}

export class AmazonProductSearchAdapter extends SourceAdapter {
  readonly key = "amazon_product";
  readonly accessMode = "public_page" as const;
  readonly version = "amazon-structured-product-adapter-v4";
  constructor(private readonly fetcher?: typeof fetch) {
    super();
  }
  private url(target: Record<string, unknown> | undefined) {
    const page = typeof target?.page_url === "string" ? target.page_url : null;
    if (page) {
      const url = new URL(page);
      if (url.protocol !== "https:" || url.hostname !== "www.amazon.com")
        throw new ProviderAdapterFailure("source_configuration_invalid", false);
      return url.toString();
    }
    const query = text(target?.query, "query", 300);
    return `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
  }
  private async response(url: string, signal: AbortSignal) {
    const headers = {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36",
      },
      response = this.fetcher
        ? await this.fetcher(url, { signal, redirect: "error", headers })
        : await fetchAmazonWithNativeHttps(url, signal, headers);
    if (response.status === 429) throw new ProviderAdapterFailure("rate_limited", true);
    if (response.status >= 500) throw new ProviderAdapterFailure("network_error", true);
    if (response.status === 404 || response.status === 410)
      throw new ProviderAdapterFailure("empty_result", false);
    if (!response.ok) throw new ProviderAdapterFailure("permission_denied", false);
    return response;
  }
  private async records(url: string, signal: AbortSignal, limit: number) {
    let firstDrift: ProviderAdapterFailure | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.response(url, signal);
        return parseAmazonProductPage(await response.text(), url, limit);
      } catch (error) {
        if (
          attempt === 0 &&
          !signal.aborted &&
          error instanceof ProviderAdapterFailure &&
          error.code === "source_changed"
        ) {
          firstDrift = error;
          continue;
        }
        throw error;
      }
    }
    throw firstDrift ?? new ProviderAdapterFailure("source_changed", false);
  }
  async collect(request: ProviderCollectRequest, signal: AbortSignal) {
    const url = this.url(request.target);
    return {
      records: await this.records(url, signal, Math.min(request.limit, 20)),
      nextCursor: null,
    };
  }
  async healthCheck(_: AdapterHealthContext, signal: AbortSignal) {
    const started = Date.now(),
      url = "https://www.amazon.com/s?k=storage+box";
    try {
      await this.records(url, signal, 1);
      return {
        status: "ready" as const,
        latencyMs: Date.now() - started,
        errorCode: null,
        message: "Amazon 公开商品搜索页面可抓取。",
      };
    } catch (error) {
      return {
        status: "degraded" as const,
        latencyMs: Date.now() - started,
        errorCode: error instanceof ProviderAdapterFailure ? error.code : "network_error",
        message: "Amazon 公开商品页当前不可解析。",
      };
    }
  }
}

export class MadeInChinaSearchAdapter extends SourceAdapter {
  readonly key = "made_in_china_search";
  readonly accessMode = "public_page" as const;
  readonly version = "made-in-china-search-adapter-v1";
  constructor(private readonly fetcher: typeof fetch = fetch) {
    super();
  }
  private url(target: Record<string, unknown> | undefined) {
    const query = text(target?.query, "query", 300),
      slug = query
        .normalize("NFKD")
        .replace(/[^A-Za-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 120);
    if (!slug) throw new ProviderAdapterFailure("query_invalid", false);
    return `https://www.made-in-china.com/products-search/hot-china-products/${slug}.html`;
  }
  private async response(url: string, signal: AbortSignal) {
    const response = await this.fetcher(url, {
      signal,
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36",
      },
    });
    if (new URL(response.url || url).hostname.toLowerCase() === "captcha.made-in-china.com")
      throw new ProviderAdapterFailure("captcha", false);
    if (!/(^|\.)made-in-china\.com$/i.test(new URL(response.url || url).hostname))
      throw new ProviderAdapterFailure("permission_denied", false);
    if (response.status === 429) throw new ProviderAdapterFailure("rate_limited", true);
    if (response.status >= 500) throw new ProviderAdapterFailure("network_error", true);
    if (!response.ok) throw new ProviderAdapterFailure("permission_denied", false);
    return response;
  }
  async collect(request: ProviderCollectRequest, signal: AbortSignal) {
    const url = this.url(request.target),
      response = await this.response(url, signal);
    return {
      records: parseMadeInChinaSearchPage(await response.text(), url, Math.min(request.limit, 20)),
      nextCursor: null,
    };
  }
  async healthCheck(_: AdapterHealthContext, signal: AbortSignal) {
    const started = Date.now(),
      url = this.url({ query: "storage box" });
    try {
      const response = await this.response(url, signal);
      parseMadeInChinaSearchPage(await response.text(), url, 1);
      return {
        status: "ready" as const,
        latencyMs: Date.now() - started,
        errorCode: null,
        message: "公开供应商商品页可抓取。",
      };
    } catch (error) {
      return {
        status: "degraded" as const,
        latencyMs: Date.now() - started,
        errorCode: error instanceof ProviderAdapterFailure ? error.code : "network_error",
        message: "供应商公开页面当前不可解析。",
      };
    }
  }
}

export class Ec21SupplierSearchAdapter extends SourceAdapter {
  readonly key = "ec21_supplier_search";
  readonly accessMode = "public_page" as const;
  readonly version = "ec21-supplier-search-adapter-v1";
  constructor(private readonly fetcher: typeof fetch = fetch) {
    super();
  }
  private url(target: Record<string, unknown> | undefined) {
    const query = text(target?.query, "query", 300),
      slug = query
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120);
    if (!slug) throw new ProviderAdapterFailure("query_invalid", false);
    return `https://www.ec21.com/ec-market/${encodeURIComponent(slug)}.html`;
  }
  private async response(url: string, signal: AbortSignal) {
    const response = await this.fetcher(url, {
      signal,
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36",
      },
    });
    if (new URL(response.url || url).hostname !== "www.ec21.com")
      throw new ProviderAdapterFailure("permission_denied", false);
    if (response.status === 429) throw new ProviderAdapterFailure("rate_limited", true);
    if (response.status >= 500) throw new ProviderAdapterFailure("network_error", true);
    if (!response.ok) throw new ProviderAdapterFailure("permission_denied", false);
    return response;
  }
  async collect(request: ProviderCollectRequest, signal: AbortSignal) {
    const url = this.url(request.target),
      response = await this.response(url, signal);
    return {
      records: parseEc21SupplierSearchPage(await response.text(), url, Math.min(request.limit, 20)),
      nextCursor: null,
    };
  }
  async healthCheck(_: AdapterHealthContext, signal: AbortSignal) {
    const started = Date.now(),
      url = this.url({ query: "storage box" });
    try {
      const response = await this.response(url, signal);
      parseEc21SupplierSearchPage(await response.text(), url, 1);
      return {
        status: "ready" as const,
        latencyMs: Date.now() - started,
        errorCode: null,
        message: "EC21 公开供应商列表可抓取。",
      };
    } catch (error) {
      return {
        status: "degraded" as const,
        latencyMs: Date.now() - started,
        errorCode: error instanceof ProviderAdapterFailure ? error.code : "network_error",
        message: "EC21 公开供应商列表当前不可解析。",
      };
    }
  }
}
export class DhgateSupplierSearchAdapter extends SourceAdapter {
  readonly key = "dhgate_supplier_search";
  readonly accessMode = "public_page" as const;
  readonly version = "dhgate-supplier-search-adapter-v1";
  constructor(private readonly fetcher: typeof fetch = fetch) {
    super();
  }
  private url(target: Record<string, unknown> | undefined) {
    const query = text(target?.query, "query", 300),
      slug = query
        .normalize("NFKC")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => encodeURIComponent(part))
        .join("+");
    if (!slug) throw new ProviderAdapterFailure("query_invalid", false);
    return `https://www.dhgate.com/wholesale/${slug}.html`;
  }
  private async response(url: string, signal: AbortSignal) {
    const response = await this.fetcher(url, {
      signal,
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36",
      },
    });
    if (new URL(response.url || url).hostname !== "www.dhgate.com")
      throw new ProviderAdapterFailure("permission_denied", false);
    if (response.status === 429) throw new ProviderAdapterFailure("rate_limited", true);
    if (response.status >= 500) throw new ProviderAdapterFailure("network_error", true);
    if (!response.ok) throw new ProviderAdapterFailure("permission_denied", false);
    return response;
  }
  async collect(request: ProviderCollectRequest, signal: AbortSignal) {
    const url = this.url(request.target),
      response = await this.response(url, signal);
    return {
      records: parseDhgateSupplierSearchPage(
        await response.text(),
        url,
        Math.min(request.limit, 20),
      ),
      nextCursor: null,
    };
  }
  async healthCheck(_: AdapterHealthContext, signal: AbortSignal) {
    const started = Date.now(),
      url = this.url({ query: "storage box" });
    try {
      const response = await this.response(url, signal);
      parseDhgateSupplierSearchPage(await response.text(), url, 1);
      return {
        status: "ready" as const,
        latencyMs: Date.now() - started,
        errorCode: null,
        message: "DHgate 批发公开页可抓取。",
      };
    } catch (error) {
      return {
        status: "degraded" as const,
        latencyMs: Date.now() - started,
        errorCode: error instanceof ProviderAdapterFailure ? error.code : "network_error",
        message: "DHgate 批发公开页当前不可解析。",
      };
    }
  }
}
export class ManualProductSupplyCsvAdapter extends SourceAdapter {
  readonly key = "manual_product_supply_csv";
  readonly accessMode = "import" as const;
  readonly version = "manual-product-supply-csv-adapter-v1";
  async collect(request: ProviderCollectRequest) {
    if (request.provider.targetUrl !== "inline://product-supply-csv-v1")
      throw new ProviderAdapterFailure("source_configuration_invalid", false);
    const csv = (request as ProviderCollectRequest & { target?: Record<string, unknown> }).target
      ?.csv_text;
    return {
      records: parseProductSupplyCsv(csv as string, Math.min(request.limit, 20)),
      nextCursor: null,
    };
  }
  async healthCheck() {
    return {
      status: "ready" as const,
      latencyMs: 0,
      errorCode: null,
      message: "CSV Parser 合同已就绪；仅处理显式导入内容。",
    };
  }
}
const normalizeUnquotedHrefFetcher =
  (fetcher: typeof fetch): typeof fetch =>
  async (input, init) => {
    const response = await fetcher(input, init);
    if (!response.ok) return response;
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (new URL(url).hostname !== "www.ebay.com") return response;
    const html = (await response.text()).replace(/\shref=([^\s"'=<>`]+)/gi, ' href="$1"');
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
export function createBuiltinSourceAdapters(fetcher: typeof fetch = fetch) {
  return [
    new GoogleNewsRssAdapter(fetcher),
    ...BUILTIN_PROVIDER_SOURCES.filter((item) => item.availability === "automatic").map((item) =>
      item.parser_version === "syndication-feed-v1"
        ? new FixedSyndicationFeedAdapter(item.code, item.target_url, item.name, fetcher)
        : item.parser_version === "structured-public-page-v1"
          ? new FixedStructuredPublicPageAdapter(
              item.code,
              item.target_url,
              item.name,
              item.code === "page_ebay_deals_us" ? normalizeUnquotedHrefFetcher(fetcher) : fetcher,
            )
          : new FixedGoogleNewsRssAdapter(item.code, item.target_url, fetcher),
    ),
    new AmazonProductSearchAdapter(fetcher === fetch ? undefined : fetcher),
    new MadeInChinaSearchAdapter(fetcher),
    new Ec21SupplierSearchAdapter(fetcher),
    new DhgateSupplierSearchAdapter(fetcher),
    new ManualProductSupplyCsvAdapter(),
    new Alibaba1688BrowserAdapter(),
  ];
}
