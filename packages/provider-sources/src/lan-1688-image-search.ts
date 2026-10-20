import { createHash } from "node:crypto";
import { ProviderAdapterFailure, type ProviderRawRecord } from "@scoutops/provider-adapters";

export const LAN_1688_ENDPOINTS = Object.freeze(
  Array.from({ length: 6 }, (_, index) => `http://192.168.1.${221 + index}:8880/1688/image-search`),
);
export const LAN_1688_PARSER_VERSION = "1688-lan-image-v1";
// Verified page capacity; normal collection may follow one explicitly advertised next page.
export const LAN_1688_RESULT_LIMIT = 60;
export const LAN_1688_MAX_PAGES = 2;
export const LAN_1688_COLLECTION_LIMIT = LAN_1688_RESULT_LIMIT * LAN_1688_MAX_PAGES;
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ProviderAdapterFailure("invalid_payload", false);
  return value as Record<string, unknown>;
};
const string = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const numeric = (value: unknown) => {
  if (value == null || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
};

export function parseLan1688Result(payload: unknown, observedAt: string): ProviderRawRecord[] {
  const response = object(payload);
  if (
    response.success !== true ||
    !Array.isArray(response.items) ||
    response.items.length > LAN_1688_RESULT_LIMIT
  )
    throw new ProviderAdapterFailure("invalid_payload", false);
  return response.items.map((raw) => {
    const item = object(raw),
      id = string(item.offerId),
      title = string(item.title);
    if (!/^\d{1,40}$/.test(id) || !title || !string(item.shop_name))
      throw new ProviderAdapterFailure("invalid_payload", false);
    const canonical = `https://detail.1688.com/offer/${id}.html`;
    const fields = {
      record_type: "search_offer",
      external_id: id,
      title,
      supplier_name: string(item.shop_name),
      supplier_id: null,
      quoted_price: numeric(item.price),
      price: numeric(item.price),
      currency: "CNY",
      price_description: string(item.price_description) || null,
      moq: numeric(item.min_order_quantity),
      location: [item.province, item.city].filter(Boolean).join(" ") || null,
      image_url: string(item.image_url) || null,
      shop_url: string(item.shop_url) || null,
      sales_quantity: numeric(item.sales_quantity),
      monthly_sales: numeric(item.monthly_sales),
      sales_text: string(item.sales_text) || null,
      rating: numeric(item.rating),
      review_count: numeric(item.review_count),
      shipping_fee: numeric(item.shipping_fee),
      shipping_text: string(item.shipping_text) || null,
      shop_score: numeric(item.shop_score),
      shop_years: numeric(item.shop_years),
      repurchase_rate: string(item.repurchase_rate) || null,
      sku_id: string(item.sku_id) || null,
      weight: numeric(item.weight),
      dimensions: typeof item.dimensions === "string" ? item.dimensions : null,
      canonical_url: canonical,
      observed_at: observedAt,
    };
    const rawContent = JSON.stringify(item);
    // raw_content stores this offer, not the whole response envelope. Derived
    // values bind to the row context; observed fields bind to their actual key.
    const rawKeys: Record<string, string> = {
      external_id: "offerId",
      supplier_name: "shop_name",
      quoted_price: "price",
      moq: "min_order_quantity",
      canonical_url: "offerId",
    };
    const derived = new Set(["record_type", "supplier_id", "currency", "location", "observed_at"]);
    const paths = Object.fromEntries(
      Object.keys(fields).map((key) => {
        const rawKey = rawKeys[key] ?? key;
        return [key, !derived.has(key) && Object.hasOwn(item, rawKey) ? `$.${rawKey}` : "$"];
      }),
    );
    return {
      externalId: `1688-search:${id}`,
      observedAt,
      evidenceRef: `1688-lan:${createHash("sha256").update(rawContent).digest("hex")}`,
      payload: {
        raw_content: rawContent,
        content_type: "application/json",
        canonical_url: canonical,
        fields,
        source_paths: paths,
      },
    };
  });
}

/** One in-flight request per appliance; failover remains within the six approved hosts. */
export class Lan1688ImageSearch {
  private next = 0;
  private readonly busy = new Set<string>();
  constructor(
    private readonly token: string,
    private readonly timeoutMs = 45_000,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private imageUrl(imageUrl: unknown) {
    let url: URL;
    try {
      url = new URL(String(imageUrl));
    } catch {
      throw new ProviderAdapterFailure("invalid_payload", false);
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !["m.media-amazon.com", "images-na.ssl-images-amazon.com"].includes(url.hostname)
    )
      throw new ProviderAdapterFailure("invalid_payload", false);
    if (!this.token) throw new ProviderAdapterFailure("permission_denied", false);
    return url;
  }

  async collect(imageUrl: unknown, heartbeat: () => Promise<void>, signal?: AbortSignal) {
    const url = this.imageUrl(imageUrl);
    const start = this.next++ % LAN_1688_ENDPOINTS.length;
    let lastError: ProviderAdapterFailure = new ProviderAdapterFailure(
      "dependency_unavailable",
      true,
    );
    for (let index = 0; index < LAN_1688_ENDPOINTS.length; index++) {
      if (signal?.aborted) throw signal.reason;
      const endpoint = LAN_1688_ENDPOINTS[(start + index) % LAN_1688_ENDPOINTS.length]!;
      if (this.busy.has(endpoint)) continue;
      try {
        const records = new Map<string, ProviderRawRecord>();
        for (let page = 1; page <= LAN_1688_MAX_PAGES; page++) {
          const batch = await this.requestEndpoint(url, endpoint, heartbeat, signal, page);
          for (const record of batch.records)
            if (!records.has(record.externalId)) records.set(record.externalId, record);
          if (!batch.hasMore || !batch.records.length) break;
        }
        return { records: [...records.values()], nextCursor: null };
      } catch (error) {
        if (signal?.aborted) throw signal.reason;
        if (error instanceof ProviderAdapterFailure && !error.retryable) throw error;
        const failure =
          error instanceof ProviderAdapterFailure
            ? error
            : new ProviderAdapterFailure("dependency_unavailable", true);
        if (lastError.code !== "rate_limited") lastError = failure;
      }
    }
    throw lastError;
  }

  /** Pool availability only: validate any approved node, discard sample offers and cancel siblings. */
  async checkPoolHealth(imageUrl: unknown, signal: AbortSignal): Promise<void> {
    const url = this.imageUrl(imageUrl);
    signal.throwIfAborted();
    const controller = new AbortController();
    const combined = AbortSignal.any([signal, controller.signal]);
    const checks = LAN_1688_ENDPOINTS.map((endpoint) =>
      this.requestEndpoint(url, endpoint, async () => {}, combined),
    );
    try {
      await Promise.any(checks);
      signal.throwIfAborted();
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (error instanceof AggregateError) {
        const failures = error.errors.filter(
          (item): item is ProviderAdapterFailure => item instanceof ProviderAdapterFailure,
        );
        throw (
          failures.find((item) => !item.retryable) ??
          failures.find((item) => item.code === "rate_limited") ??
          failures[0] ??
          new ProviderAdapterFailure("dependency_unavailable", true)
        );
      }
      throw error;
    } finally {
      controller.abort();
      await Promise.allSettled(checks);
    }
  }

  private async requestEndpoint(
    url: URL,
    endpoint: string,
    heartbeat: () => Promise<void>,
    signal?: AbortSignal,
    page = 1,
  ) {
    if (this.busy.has(endpoint)) throw new ProviderAdapterFailure("dependency_unavailable", true);
    if (signal?.aborted) throw signal.reason;
    this.busy.add(endpoint);
    try {
      await heartbeat();
      const abort = AbortSignal.timeout(this.timeoutMs);
      const response = await this.fetcher(endpoint, {
        method: "POST",
        redirect: "error",
        signal: signal ? AbortSignal.any([signal, abort]) : abort,
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: url.toString(),
          begin_page: page,
          page_size: 60,
          result_limit: LAN_1688_RESULT_LIMIT,
        }),
      });
      if (response.status === 401 || response.status === 403) {
        await response.body?.cancel();
        throw new ProviderAdapterFailure("permission_denied", false);
      }
      if (response.status === 429) {
        await response.body?.cancel();
        throw new ProviderAdapterFailure("rate_limited", true);
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new ProviderAdapterFailure("dependency_unavailable", true);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new ProviderAdapterFailure("invalid_payload", false);
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.length;
          if (bytes > 2 * 1024 * 1024) {
            await reader.cancel();
            throw new ProviderAdapterFailure("invalid_payload", false);
          }
          chunks.push(part.value);
        }
      } finally {
        reader.releaseLock();
      }
      let payload: unknown;
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        throw new ProviderAdapterFailure("invalid_payload", false);
      }
      const records = parseLan1688Result(payload, new Date().toISOString());
      const envelope = object(payload);
      if (envelope.begin_page !== undefined && envelope.begin_page !== page)
        throw new ProviderAdapterFailure("invalid_payload", false);
      if (envelope.has_more !== undefined && typeof envelope.has_more !== "boolean")
        throw new ProviderAdapterFailure("invalid_payload", false);
      await heartbeat();
      signal?.throwIfAborted();
      return { records, hasMore: envelope.has_more === true };
    } finally {
      this.busy.delete(endpoint);
    }
  }
}
