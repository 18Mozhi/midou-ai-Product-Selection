import type { SelectionPrimaryProductFacts } from "@scoutops/contracts";
import { currentProductVersionJoinSql } from "@scoutops/database";
import { readAmazonPublicSignals } from "./amazon-public-signals.js";
const opportunityPrimaryAsinSql = "o.primary_fact_asin";
const keys = [
  "price",
  "currency",
  "rating_value",
  "review_count",
  "image_url",
  "sales_badge_text",
  "sales_badge_quantity_lower_bound",
  "sales_badge_period",
  "sponsored",
  "best_seller_rank",
  "best_seller_rank_text",
];
const projection = (time: string) =>
  "JSON_OBJECT(" +
  keys.map((k) => `'${k}',JSON_EXTRACT(n.payload_json,'$.${k}')`).join(",") +
  // MySQL DATETIME uses the same local interpretation as the existing mysql2 pool.
  // Add UTC only after Date parsing; appending Z here would shift non-UTC hosts.
  `,'captured_at',DATE_FORMAT(${time},'%Y-%m-%dT%H:%i:%s.%f'))`;
const identity =
  ` AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.asin')))=BINARY ${opportunityPrimaryAsinSql} ` +
  "AND JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.canonical_url')) REGEXP CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.asin')),'([/?#]|$)') ";
export const opportunityPrimaryRecordsSql =
  `(SELECT ${projection("n.created_at")} FROM opportunity_evidence_links l ` +
  currentProductVersionJoinSql("l", "n") +
  "JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' WHERE l.opportunity_id=o.id AND l.organization_id=o.organization_id AND l.workspace_id=o.workspace_id " +
  identity +
  "ORDER BY l.observed_at DESC,n.created_at DESC,n.id DESC LIMIT 1) primary_linked_record," +
  `(SELECT ${projection("n.created_at")} FROM competitors c JOIN competitor_snapshots s ON s.competitor_id=c.id AND s.organization_id=c.organization_id AND s.workspace_id=c.workspace_id ` +
  currentProductVersionJoinSql("s", "n", "evidence_id") +
  "JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' WHERE c.opportunity_id=o.id AND c.organization_id=o.organization_id AND c.workspace_id=o.workspace_id AND c.deleted_at IS NULL AND c.source_site='Amazon' " +
  `AND BINARY UPPER(c.external_id)=BINARY ${opportunityPrimaryAsinSql} ` +
  identity +
  "ORDER BY s.captured_at DESC,s.id DESC,n.created_at DESC,n.id DESC LIMIT 1) primary_detail_record";
const record = (raw: unknown): Record<string, unknown> | null => {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof value.captured_at === "string" &&
      Number.isFinite(Date.parse(value.captured_at))
      ? value
      : null;
  } catch {
    return null;
  }
};
const number = (v: unknown, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null;
export function readOpportunityPrimaryProduct(
  linked: unknown,
  detail: unknown,
): { facts: SelectionPrimaryProductFacts | null; imageUrl: string | null } {
  const a = record(linked),
    b = record(detail),
    value =
      b && (!a || Date.parse(String(b.captured_at)) >= Date.parse(String(a.captured_at))) ? b : a;
  if (!value) return { facts: null, imageUrl: null };
  let imageUrl: string | null = null;
  try {
    const url = new URL(String(value.image_url));
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      ["m.media-amazon.com", "images-na.ssl-images-amazon.com"].includes(url.hostname)
    )
      imageUrl = url.toString();
  } catch {
    imageUrl = null;
  }
  const count = number(value.review_count);
  return {
    imageUrl,
    facts: {
      price: number(value.price),
      currency:
        typeof value.currency === "string" && /^[A-Z]{3}$/.test(value.currency)
          ? value.currency
          : null,
      rating_value: number(value.rating_value, 5),
      review_count: count !== null && Number.isSafeInteger(count) ? count : null,
      captured_at: new Date(String(value.captured_at)).toISOString(),
      public_signals: readAmazonPublicSignals(
        Object.fromEntries(
          [
            "sales_badge_text",
            "sales_badge_quantity_lower_bound",
            "sales_badge_period",
            "sponsored",
            "best_seller_rank",
            "best_seller_rank_text",
          ].map((key) => [key, value[key]]),
        ),
      ),
    },
  };
}
