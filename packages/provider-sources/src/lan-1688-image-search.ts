import { createHash } from "node:crypto";
import { ProviderAdapterFailure, type ProviderRawRecord } from "@scoutops/provider-adapters";

import { parseLan1688ItemDetails, LAN_1688_DETAIL_BATCH_SIZE } from "./lan-1688-item-detail.js";

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
  private detailCooldownUntil = 0;
  private readonly busy = new Set<string>();
  private readonly releaseWaiters = new Set<() => void>();
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
      if (this.busy.has(new URL(endpoint).origin)) continue;
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
    const payload = await this.requestPayload(
      endpoint,
      {
        image_url: url.toString(),
        begin_page: page,
        page_size: 60,
        result_limit: LAN_1688_RESULT_LIMIT,
      },
      heartbeat,
      signal,
    );
    const records = parseLan1688Result(payload, new Date().toISOString());
    const envelope = object(payload);
    if (envelope.begin_page !== undefined && envelope.begin_page !== page)
      throw new ProviderAdapterFailure("invalid_payload", false);
    if (envelope.has_more !== undefined && typeof envelope.has_more !== "boolean")
      throw new ProviderAdapterFailure("invalid_payload", false);
    return { records, hasMore: envelope.has_more === true };
  }

  async collectItemDetails(
    offerIds: string[],
    heartbeat: () => Promise<void>,
    signal?: AbortSignal,
  ) {
    if (!this.token) throw new ProviderAdapterFailure("permission_denied", false);
    if (Date.now() < this.detailCooldownUntil)
      throw new ProviderAdapterFailure("rate_limited", true);
    if (
      offerIds.length > LAN_1688_COLLECTION_LIMIT ||
      offerIds.some((id) => !/^\d{1,40}$/.test(id))
    )
      throw new ProviderAdapterFailure("invalid_payload", false);
    const ids = [...new Set(offerIds)],
      batches: string[][] = [];
    for (let offset = 0; offset < ids.length; offset += LAN_1688_DETAIL_BATCH_SIZE)
      batches.push(ids.slice(offset, offset + LAN_1688_DETAIL_BATCH_SIZE));
    const controller = new AbortController();
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    const results: ProviderRawRecord[][] = new Array(batches.length);
    let nextBatch = 0;
    const workers = Array.from(
      { length: Math.min(LAN_1688_ENDPOINTS.length, batches.length) },
      async () => {
        while (nextBatch < batches.length) {
          combined.throwIfAborted();
          const index = nextBatch++,
            batch = batches[index]!;
          const start = this.next++ % LAN_1688_ENDPOINTS.length;
          let failure: unknown = new ProviderAdapterFailure("dependency_unavailable", true);
          let complete = false;
          const attempted = new Set<string>();
          while (attempted.size < LAN_1688_ENDPOINTS.length) {
            combined.throwIfAborted();
            const endpoint = Array.from(
              { length: LAN_1688_ENDPOINTS.length },
              (_, offset) => LAN_1688_ENDPOINTS[(start + offset) % LAN_1688_ENDPOINTS.length]!,
            ).find(
              (endpoint) => !attempted.has(endpoint) && !this.busy.has(new URL(endpoint).origin),
            );
            if (!endpoint) {
              await this.waitForRelease(combined);
              continue;
            }
            attempted.add(endpoint);
            try {
              const payload = await this.requestPayload(
                endpoint.replace("/image-search", "/item-detail"),
                { offer_ids: batch },
                heartbeat,
                combined,
              );
              results[index] = parseLan1688ItemDetails(payload, batch, new Date().toISOString());
              complete = true;
              break;
            } catch (error) {
              combined.throwIfAborted();
              if (
                error instanceof ProviderAdapterFailure &&
                (!error.retryable || error.code === "rate_limited")
              )
                throw error;
              if (!(failure instanceof ProviderAdapterFailure) || failure.code !== "rate_limited")
                failure =
                  error instanceof ProviderAdapterFailure
                    ? error
                    : new ProviderAdapterFailure("dependency_unavailable", true);
            }
          }
          if (!complete) throw failure;
        }
      },
    );
    try {
      await Promise.all(workers);
      combined.throwIfAborted();
      return { records: results.flat(), nextCursor: null };
    } catch (error) {
      controller.abort();
      await Promise.allSettled(workers);
      if (signal?.aborted) throw signal.reason;
      throw error;
    }
  }

  async collectEnriched(imageUrl: unknown, heartbeat: () => Promise<void>, signal?: AbortSignal) {
    if (Date.now() < this.detailCooldownUntil)
      throw new ProviderAdapterFailure("rate_limited", true);
    const image = await this.collect(imageUrl, heartbeat, signal);
    const ids = image.records.map((record) =>
      String((record.payload as { fields: { external_id: string } }).fields.external_id),
    );
    const details = await this.collectItemDetails(ids, heartbeat, signal);
    const facts = (record: ProviderRawRecord) => object(object(record.payload).fields);
    const matched: ProviderRawRecord[] = [];
    for (const imageRecord of image.records) {
      const fields = facts(imageRecord),
        offerId = String(fields.external_id),
        skuId = fields.sku_id;
      const offerRecords = details.records.filter(
        (record) => facts(record).external_id === offerId,
      );
      const chosen =
        typeof skuId === "string" && /^\d{1,40}$/.test(skuId)
          ? offerRecords.find((record) => facts(record).sku_id === skuId)
          : undefined;
      if (chosen) {
        const imagePayload = object(imageRecord.payload),
          payload = object(chosen.payload);
        const context = object(JSON.parse(String(payload.raw_content)));
        context.image_search = JSON.parse(String(imagePayload.raw_content));
        const content = JSON.stringify(context);
        matched.push({
          ...chosen,
          evidenceRef: `1688-detail:${createHash("sha256").update(content).digest("hex")}`,
          payload: {
            ...payload,
            raw_content: content,
            fields: { ...facts(chosen), price_description: fields.price_description ?? null },
            source_paths: {
              ...object(payload.source_paths),
              price_description: Object.hasOwn(object(context.image_search), "price_description")
                ? "$.image_search.price_description"
                : "$",
            },
          },
        });
      } else if (offerRecords[0]) {
        const first = offerRecords[0],
          payload = object(first.payload),
          common = facts(first);
        const commonFields = {
          ...common,
          record_type: "offer_detail_unselected",
          sku_id: null,
          specification: null,
          sku_properties: [],
          packaging: [],
          package_units: null,
          stock: null,
          price: null,
          quoted_price: null,
          price_amount: null,
          detail_complete: false,
          image_url: null,
        };
        matched.push({
          ...first,
          externalId: `1688-detail:${offerId}:unselected`,
          payload: {
            ...payload,
            fields: commonFields,
            source_paths: {
              ...object(payload.source_paths),
              ...Object.fromEntries(
                [
                  "record_type",
                  "sku_id",
                  "specification",
                  "sku_properties",
                  "packaging",
                  "package_units",
                  "stock",
                  "price",
                  "quoted_price",
                  "price_amount",
                  "detail_complete",
                  "image_url",
                ].map((key) => [key, "$"]),
              ),
            },
          },
        });
      }
      object(object(imageRecord.payload).fields).price_eligible = false;
      object(object(imageRecord.payload).source_paths).price_eligible = "$";
    }
    return { records: [...image.records, ...matched], nextCursor: null };
  }

  private waitForRelease(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.releaseWaiters.delete(released);
        signal.removeEventListener("abort", aborted);
      };
      const released = () => {
        cleanup();
        resolve();
      };
      const aborted = () => {
        cleanup();
        reject(signal.reason);
      };
      this.releaseWaiters.add(released);
      signal.addEventListener("abort", aborted, { once: true });
    });
  }

  private async requestPayload(
    endpoint: string,
    body: Record<string, unknown>,
    heartbeat: () => Promise<void>,
    signal?: AbortSignal,
  ) {
    if (this.busy.has(new URL(endpoint).origin))
      throw new ProviderAdapterFailure("dependency_unavailable", true);
    if (signal?.aborted) throw signal.reason;
    this.busy.add(new URL(endpoint).origin);
    try {
      await heartbeat();
      const abort = AbortSignal.timeout(this.timeoutMs);
      const response = await this.fetcher(endpoint, {
        method: "POST",
        redirect: "error",
        signal: signal ? AbortSignal.any([signal, abort]) : abort,
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 401 || response.status === 403) {
        await response.body?.cancel();
        throw new ProviderAdapterFailure("permission_denied", false);
      }
      const detailRequest = endpoint.endsWith("/item-detail");
      const retryAfter = response.headers.get("retry-after");
      const retryAt =
        retryAfter && /^\d+$/.test(retryAfter.trim())
          ? Date.now() + Number(retryAfter.trim()) * 1000
          : retryAfter
            ? Date.parse(retryAfter)
            : NaN;
      const cooling = Number.isFinite(retryAt) && retryAt > Date.now();
      if (response.status === 429 || (detailRequest && response.status === 409 && cooling)) {
        if (detailRequest && cooling)
          this.detailCooldownUntil = Math.max(this.detailCooldownUntil, retryAt);
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
      await heartbeat();
      signal?.throwIfAborted();
      return payload;
    } finally {
      this.busy.delete(new URL(endpoint).origin);
      for (const notify of [...this.releaseWaiters]) notify();
    }
  }
}
