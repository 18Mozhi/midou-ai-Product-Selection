import { createHash } from "node:crypto";
import { ProviderAdapterFailure, type ProviderRawRecord } from "@scoutops/provider-adapters";

export const LAN_1688_ENDPOINTS = Object.freeze(
  Array.from({ length: 6 }, (_, index) => `http://192.168.1.${221 + index}:8880/1688/image-search`),
);
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
  if (response.success !== true || !Array.isArray(response.items) || response.items.length > 60)
    throw new ProviderAdapterFailure("invalid_payload", false);
  return response.items.map((raw, index) => {
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
    const paths = Object.fromEntries(Object.keys(fields).map((key) => [key, `$.items[${index}]`]));
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

  async collect(imageUrl: unknown, heartbeat: () => Promise<void>, signal?: AbortSignal) {
    let url: URL;
    try {
      url = new URL(string(imageUrl));
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
    const start = this.next++ % LAN_1688_ENDPOINTS.length;
    let lastError: ProviderAdapterFailure = new ProviderAdapterFailure(
      "dependency_unavailable",
      true,
    );
    for (let index = 0; index < LAN_1688_ENDPOINTS.length; index++) {
      if (signal?.aborted) throw signal.reason;
      const endpoint = LAN_1688_ENDPOINTS[(start + index) % LAN_1688_ENDPOINTS.length]!;
      if (this.busy.has(endpoint)) continue;
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
            begin_page: 1,
            page_size: 60,
            result_limit: 10,
          }),
        });
        if (response.status === 401 || response.status === 403) {
          await response.body?.cancel();
          throw new ProviderAdapterFailure("permission_denied", false);
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
        await heartbeat();
        return { records, nextCursor: null };
      } catch (error) {
        if (signal?.aborted) throw signal.reason;
        if (error instanceof ProviderAdapterFailure && !error.retryable) throw error;
        lastError =
          error instanceof ProviderAdapterFailure
            ? error
            : new ProviderAdapterFailure("dependency_unavailable", true);
      } finally {
        this.busy.delete(endpoint);
      }
    }
    throw lastError;
  }
}
