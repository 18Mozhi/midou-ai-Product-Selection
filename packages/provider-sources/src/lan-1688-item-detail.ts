import { createHash } from "node:crypto";
import { ProviderAdapterFailure, type ProviderRawRecord } from "@scoutops/provider-adapters";

export const LAN_1688_DETAIL_VERSION = "1688-lan-item-detail-v1";
export const LAN_1688_IMAGE_DETAIL_CONTEXT_VERSION = "1688-lan-image-detail-context-v1";
export const LAN_1688_DETAIL_BATCH_SIZE = 2;
export const LAN_1688_DETAIL_MAX_SKUS = 120;
const invalid = () => new ProviderAdapterFailure("invalid_payload", false);
const obj = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
};
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const positive = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const id = (value: unknown) => (/^\d{1,40}$/.test(text(value)) ? text(value) : null);

/** Exact offer/SKU identities and the declared SKU quote, never the offer's minimum. */
export function parseLan1688ItemDetails(
  payload: unknown,
  requested: string[],
  observedAt: string,
): ProviderRawRecord[] {
  const envelope = obj(payload);
  if (
    !requested.length ||
    requested.length > LAN_1688_DETAIL_BATCH_SIZE ||
    requested.some((value) => !id(value)) ||
    new Set(requested).size !== requested.length ||
    envelope.success !== true ||
    !Array.isArray(envelope.items) ||
    envelope.items.length !== requested.length
  )
    throw invalid();
  if (
    envelope.complete !== true ||
    envelope.partial !== false ||
    envelope.failed !== 0 ||
    envelope.incomplete !== 0
  )
    throw new ProviderAdapterFailure("dependency_unavailable", true);
  const seen = new Set<string>();
  const records: ProviderRawRecord[] = [];
  for (const raw of envelope.items) {
    const item = obj(raw),
      offerId = id(item.offer_id),
      data = obj(item.data);
    if (
      !offerId ||
      !requested.includes(offerId) ||
      seen.has(offerId) ||
      item.success !== true ||
      data.offer_id !== offerId ||
      !text(data.title) ||
      text(data.title).length > 1000 ||
      data.product_url !== `https://detail.1688.com/offer/${offerId}.html` ||
      !Array.isArray(data.skus) ||
      data.skus.length > LAN_1688_DETAIL_MAX_SKUS ||
      data.sku_count !== data.skus.length ||
      !Array.isArray(data.attributes) ||
      !Array.isArray(data.missing_fields)
    )
      throw invalid();
    seen.add(offerId);
    const shop = obj(data.shop),
      price = obj(data.price);
    const supplierKey = text(shop.authCompanyName) ? "authCompanyName" : "companyName";
    if (!text(shop[supplierKey])) throw invalid();
    const attributes = data.attributes.map((value) => {
      const attribute = obj(value);
      if (!text(attribute.name) || !text(attribute.value)) throw invalid();
      return { name: text(attribute.name), value: text(attribute.value) };
    });
    // Retain original nesting/array indexes for every cited fact, excluding duplicated
    // raw upstream blobs and executable description HTML. This is a JSON projection.
    const context = { ...item, data: { ...data } };
    delete context.data.source_data;
    if (context.data.description) {
      const description = obj(context.data.description);
      context.data.description = { text: description.text, status: description.status };
    }
    const rawContent = JSON.stringify(context);
    const detailComplete =
      data.complete === true && data.status === "PUBLISHED" && data.missing_fields.length === 0;
    const skuIds = new Set<string>();
    data.skus.forEach((value, index) => {
      const sku = obj(value),
        skuId = id(sku.sku_id);
      if (
        !skuId ||
        skuIds.has(skuId) ||
        !Array.isArray(sku.properties) ||
        !Array.isArray(sku.packages)
      )
        throw invalid();
      skuIds.add(skuId);
      const source = sku.source_data == null ? {} : obj(sku.source_data);
      if (source.skuId !== undefined && source.skuId !== skuId) throw invalid();
      for (const pack of sku.packages) {
        const packageItem = obj(pack);
        if (packageItem.skuId !== undefined && packageItem.skuId !== skuId) throw invalid();
      }
      const priceSource = text(sku.price_source);
      const quoted = ["discountPrice", "original.price"].includes(priceSource)
        ? positive(sku.price)
        : null;
      const declaredValue = priceSource === "discountPrice" ? source.discountPrice : source.price;
      if (declaredValue !== undefined && quoted != null && positive(declaredValue) !== quoted)
        throw invalid();
      const properties = sku.properties.map((value) => {
        const property = obj(value);
        if (!text(property.name) || !text(property.value)) throw invalid();
        return { name: text(property.name), value: text(property.value) };
      });
      const prefix = `$.data.skus[${index}]`;
      const fields = {
        record_type: "offer_sku_detail",
        external_id: offerId,
        sku_id: skuId,
        title: text(data.title),
        supplier_name: text(shop[supplierKey]),
        price: quoted,
        quoted_price: quoted,
        currency: "CNY",
        price_description: null,
        price_amount: positive(sku.price_amount),
        price_source: priceSource || null,
        price_unit: text(price.unit) || null,
        moq: positive(price.min_order_quantity),
        specification: text(sku.spec_attrs) || null,
        attributes,
        sku_properties: properties,
        packaging: sku.packages,
        package_units: sku.package_units ?? null,
        stock:
          typeof sku.stock === "number" && Number.isFinite(sku.stock) && sku.stock >= 0
            ? sku.stock
            : null,
        detail_complete: detailComplete,
        image_url: text(sku.image_url) || null,
        location:
          data.shipping && typeof data.shipping === "object"
            ? text(obj(data.shipping).location) || null
            : null,
        missing_detail_fields: data.missing_fields,
        canonical_url: text(data.product_url),
        observed_at: observedAt,
      };
      const sourcePaths = Object.fromEntries(Object.keys(fields).map((key) => [key, "$"]));
      Object.assign(sourcePaths, {
        external_id: "$.offer_id",
        sku_id: `${prefix}.sku_id`,
        title: "$.data.title",
        supplier_name: `$.data.shop.${supplierKey}`,
        moq: "$.data.price.min_order_quantity",
        specification: `${prefix}.spec_attrs`,
        attributes: "$.data.attributes",
        sku_properties: `${prefix}.properties`,
        packaging: `${prefix}.packages`,
        package_units: `${prefix}.package_units`,
        stock: `${prefix}.stock`,
        price_amount: `${prefix}.price_amount`,
        price_unit: "$.data.price.unit",
        canonical_url: "$.data.product_url",
        price: quoted != null ? `${prefix}.price` : "$",
        quoted_price: quoted != null ? `${prefix}.price` : "$",
        price_source: `${prefix}.price_source`,
        missing_detail_fields: "$.data.missing_fields",
        image_url: `${prefix}.image_url`,
        location: "$.data.shipping.location",
      });
      for (const [key, sourcePath] of Object.entries(sourcePaths)) {
        let cursor: unknown = context;
        for (const segment of sourcePath
          .replace(/\[(\d+)\]/g, ".$1")
          .split(".")
          .slice(1)) {
          if (!cursor || typeof cursor !== "object" || !Object.hasOwn(cursor, segment)) {
            sourcePaths[key] = "$";
            break;
          }
          cursor = (cursor as Record<string, unknown>)[segment];
        }
      }
      records.push({
        externalId: `1688-detail:${offerId}:${skuId}`,
        observedAt,
        evidenceRef: `1688-detail:${createHash("sha256").update(rawContent).update(skuId).digest("hex")}`,
        payload: {
          raw_content: rawContent,
          content_type: "application/json",
          canonical_url: fields.canonical_url,
          fields,
          source_paths: sourcePaths,
        },
      });
    });
  }
  return records;
}
