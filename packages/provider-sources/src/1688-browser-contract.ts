import { createHash } from "node:crypto";

import {
  ProviderAdapterFailure,
  type JsonScalar,
  type ProviderRawRecord,
} from "@scoutops/provider-adapters";

export const ALIBABA_1688_BROWSER_PARSER_VERSION =
  "1688-browser-contract-v1";
export const ALIBABA_1688_SNAPSHOT_SCHEMAS = {
  search: "1688.search.v1",
  offerDetail: "1688.offer-detail.v1",
  supplier: "1688.supplier.v1",
} as const;

type SnapshotKind = keyof typeof ALIBABA_1688_SNAPSHOT_SCHEMAS;
type ContractObject = Record<string, unknown>;
type ContractPaths = Record<string, string>;

const MAX_DOM_FRAGMENT_BYTES = 250_000;
const OFFER_PATH = /^\/offer\/(\d{1,40})\.html$/;

const failure = (code = "source_changed"): never => {
  throw new ProviderAdapterFailure(code, false);
};

const object = (value: unknown): ContractObject => {
  if (!value || typeof value !== "object" || Array.isArray(value)) failure();
  return value as ContractObject;
};

const requiredText = (value: unknown, max: number): string => {
  if (typeof value !== "string") return failure();
  const normalized = value.trim();
  if (!normalized || normalized.length > max) return failure();
  return normalized;
};

const optionalText = (value: unknown, max: number): string | null =>
  value == null ? null : requiredText(value, max);

const observedAt = (value: unknown): string => {
  const text = requiredText(value, 120),
    date = new Date(text);
  if (!Number.isFinite(date.getTime())) return failure();
  return date.toISOString();
};

const positiveInteger = (value: unknown): number | null => {
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 1) return failure();
  return Number(value);
};

const nonNegativeNumber = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return failure();
  return value;
};

const https1688Url = (value: unknown): URL => {
  const text = requiredText(value, 2048);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return failure("source_configuration_invalid");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (host !== "1688.com" && !host.endsWith(".1688.com"))
  )
    return failure("source_configuration_invalid");
  return url;
};

const offerUrl = (value: unknown, offerId: string): string => {
  const url = https1688Url(value),
    match = OFFER_PATH.exec(url.pathname);
  if (
    url.hostname !== "detail.1688.com" ||
    !match ||
    match[1] !== offerId
  )
    return failure();
  return url.toString();
};

const domFragment = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    Buffer.byteLength(value) > MAX_DOM_FRAGMENT_BYTES
  )
    return failure();
  return value;
};

const sourcePaths = (
  value: unknown,
  required: readonly string[],
): ContractPaths => {
  const input = object(value),
    paths: ContractPaths = {};
  for (const field of required)
    paths[field] = requiredText(input[field], 500);
  return paths;
};

const snapshot = (
  input: unknown,
  kind: SnapshotKind,
): { value: ContractObject; sourceUrl: string; observedAt: string } => {
  const value = object(input);
  if (value.schema_version !== ALIBABA_1688_SNAPSHOT_SCHEMAS[kind])
    return failure();
  const sourceUrl = https1688Url(value.source_url);
  if (kind === "search" && sourceUrl.hostname !== "s.1688.com")
    return failure("source_configuration_invalid");
  return {
    value,
    sourceUrl: sourceUrl.toString(),
    observedAt: observedAt(value.observed_at),
  };
};

const record = (input: {
  externalId: string;
  observedAt: string;
  evidenceKind: string;
  canonicalUrl: string;
  dom: string;
  fields: Record<string, JsonScalar>;
  paths: ContractPaths;
}): ProviderRawRecord => ({
  externalId: input.externalId,
  observedAt: input.observedAt,
  evidenceRef: `${input.evidenceKind}:${createHash("sha256")
    .update(
      JSON.stringify({
        external_id: input.externalId,
        canonical_url: input.canonicalUrl,
        observed_at: input.observedAt,
        dom: input.dom,
        fields: input.fields,
        paths: input.paths,
      }),
    )
    .digest("hex")}`,
  payload: {
    raw_content: input.dom,
    content_type: "text/html",
    canonical_url: input.canonicalUrl,
    fields: input.fields,
    source_paths: input.paths,
  },
});

const productFields = (
  item: ContractObject,
  options: { detail: boolean },
): {
  offerId: string;
  canonicalUrl: string;
  fields: Record<string, JsonScalar>;
} => {
  const offerId = requiredText(item.offer_id, 40);
  if (!/^\d{1,40}$/.test(offerId)) return failure();
  const price = nonNegativeNumber(item.quoted_price),
    currency = item.currency == null ? null : requiredText(item.currency, 3);
  if ((price == null && currency != null) || (price != null && currency !== "CNY"))
    return failure();
  const moq = positiveInteger(item.moq),
    location = optionalText(item.location, 255),
    specification = options.detail
      ? optionalText(item.specification, 1000)
      : null,
    leadTimeDays = options.detail ? positiveInteger(item.lead_time_days) : null,
    missingFields = [
      ...(price == null ? ["quoted_price"] : []),
      ...(moq == null ? ["moq"] : []),
      ...(location == null ? ["location"] : []),
      ...(options.detail && specification == null ? ["specification"] : []),
      ...(options.detail && leadTimeDays == null ? ["lead_time_days"] : []),
    ];
  return {
    offerId,
    canonicalUrl: offerUrl(item.canonical_url, offerId),
    fields: {
      record_type: options.detail ? "offer_detail" : "search_offer",
      external_id: offerId,
      title: requiredText(item.title, 1000),
      supplier_id: optionalText(item.supplier_id, 120),
      supplier_name: requiredText(item.supplier_name, 500),
      specification,
      price,
      currency,
      moq,
      lead_time_days: leadTimeDays,
      location,
      missing_fields_json: JSON.stringify(missingFields),
    } satisfies Record<string, JsonScalar>,
  };
};

export function parse1688SearchSnapshot(
  input: unknown,
  limit = 20,
): ProviderRawRecord[] {
  const current = snapshot(input, "search"),
    items = current.value.items;
  if (
    !Array.isArray(items) ||
    items.length > 100 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    return failure();
  return items.slice(0, limit).map((raw: unknown) => {
    const item = object(raw),
      parsed = productFields(item, { detail: false }),
      paths = sourcePaths(item.source_paths, [
        "title",
        "supplier_name",
        "quoted_price",
        "moq",
        "location",
        "canonical_url",
      ]);
    return record({
      externalId: `1688-search:${parsed.offerId}`,
      observedAt: current.observedAt,
      evidenceKind: "1688-search",
      canonicalUrl: parsed.canonicalUrl,
      dom: domFragment(item.dom_fragment),
      fields: {
        ...parsed.fields,
        canonical_url: parsed.canonicalUrl,
        observed_at: current.observedAt,
      },
      paths,
    });
  });
}

export function parse1688OfferDetailSnapshot(input: unknown): ProviderRawRecord {
  const current = snapshot(input, "offerDetail"),
    item = object(current.value.offer),
    parsed = productFields(item, { detail: true }),
    paths = sourcePaths(item.source_paths, [
      "title",
      "supplier_id",
      "supplier_name",
      "specification",
      "quoted_price",
      "moq",
      "lead_time_days",
      "location",
      "canonical_url",
    ]);
  if (https1688Url(current.sourceUrl).toString() !== parsed.canonicalUrl)
    failure("source_configuration_invalid");
  return record({
    externalId: `1688-offer:${parsed.offerId}`,
    observedAt: current.observedAt,
    evidenceKind: "1688-offer",
    canonicalUrl: parsed.canonicalUrl,
    dom: domFragment(item.dom_fragment),
    fields: {
      ...parsed.fields,
      canonical_url: parsed.canonicalUrl,
      observed_at: current.observedAt,
    },
    paths,
  });
}

export function parse1688SupplierSnapshot(input: unknown): ProviderRawRecord {
  const current = snapshot(input, "supplier"),
    item = object(current.value.supplier),
    supplierId = requiredText(item.supplier_id, 120);
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(supplierId)) failure();
  const canonicalUrl = https1688Url(item.canonical_url).toString(),
    location = optionalText(item.location, 255),
    paths = sourcePaths(item.source_paths, [
      "supplier_name",
      "location",
      "canonical_url",
    ]);
  if (https1688Url(current.sourceUrl).toString() !== canonicalUrl)
    failure("source_configuration_invalid");
  return record({
    externalId: `1688-supplier:${supplierId}`,
    observedAt: current.observedAt,
    evidenceKind: "1688-supplier",
    canonicalUrl,
    dom: domFragment(item.dom_fragment),
    fields: {
      record_type: "supplier",
      supplier_id: supplierId,
      supplier_name: requiredText(item.supplier_name, 500),
      location,
      canonical_url: canonicalUrl,
      observed_at: current.observedAt,
      missing_fields_json: JSON.stringify(location == null ? ["location"] : []),
    },
    paths,
  });
}
