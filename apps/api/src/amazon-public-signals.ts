import type { AmazonPublicSignals, AmazonPublicReviewSample } from "@scoutops/contracts";

export const amazonPublicSignalJoinSql =
  "LEFT JOIN normalized_records n_signal ON LEFT(s.source_ref_id,11)='collection:' " +
  "AND n_signal.id=CONVERT(RIGHT(s.source_ref_id,36) USING ascii) " +
  "AND n_signal.organization_id=c.organization_id AND n_signal.workspace_id=c.workspace_id " +
  "AND s.organization_id=c.organization_id AND s.workspace_id=c.workspace_id " +
  "AND n_signal.provider_id=c.provider_id AND n_signal.raw_evidence_id=s.evidence_id " +
  "AND p_snapshot.code='amazon_product' AND c.source_site='Amazon' " +
  "AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_signal.payload_json,'$.asin')))=BINARY UPPER(c.external_id) ";

const signalProjectionSql = (includeReviews: boolean) =>
  "JSON_OBJECT(" +
  [
    "sales_badge_text",
    "sales_badge_quantity_lower_bound",
    "sales_badge_period",
    "sponsored",
    "best_seller_rank",
    "best_seller_rank_text",
    ...(includeReviews ? ["review_samples_json"] : []),
  ]
    .map((key) => `'${key}',JSON_EXTRACT(n_signal.payload_json,'$.${key}')`)
    .join(",") +
  ") public_signals_json,";

export const amazonPublicSignalSelectSql = signalProjectionSql(false);
export const amazonPublicSignalsWithReviewsSelectSql = signalProjectionSql(true);

export function readAmazonPublicSignals(value: unknown): AmazonPublicSignals | null {
  let fields: Record<string, unknown>;
  try {
    fields = typeof value === "string" ? JSON.parse(value) : value;
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) return null;
  } catch {
    return null;
  }
  const positive = (input: unknown): input is number =>
    typeof input === "number" && Number.isSafeInteger(input) && input > 0;
  const period = fields.sales_badge_period;
  const sales: AmazonPublicSignals["sales_badge"] =
    typeof fields.sales_badge_text === "string" &&
    fields.sales_badge_text.trim().length > 0 &&
    fields.sales_badge_text.length <= 160 &&
    positive(fields.sales_badge_quantity_lower_bound) &&
    (period === "past_month" || period === "past_week")
      ? {
          text: fields.sales_badge_text,
          quantity_lower_bound: fields.sales_badge_quantity_lower_bound,
          period,
        }
      : null;
  const rank =
    positive(fields.best_seller_rank) &&
    typeof fields.best_seller_rank_text === "string" &&
    fields.best_seller_rank_text.trim().length > 0 &&
    fields.best_seller_rank_text.length <= 500
      ? { rank: fields.best_seller_rank, text: fields.best_seller_rank_text }
      : null;
  const sponsored = fields.sponsored === 1 ? true : null;
  const reviews = readAmazonReviewSamples(fields.review_samples_json);
  return sales || rank || sponsored || reviews.length
    ? {
        sales_badge: sales,
        best_seller_rank: rank,
        sponsored,
        ...(reviews.length ? { review_samples: reviews } : {}),
      }
    : null;
}

export function readAmazonReviewSamples(value: unknown): AmazonPublicReviewSample[] {
  let rows: unknown;
  try {
    if (typeof value === "string" && value.length > 120_000) return [];
    rows = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const text = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null;
  return rows.slice(0, 10).flatMap((row: unknown) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const item = row as Record<string, unknown>;
    const id = text(item.review_id, 80),
      title = text(item.title, 300),
      body = text(item.text, 2000);
    if (!id || !/^R[A-Z0-9]+$/.test(id) || !title || !body || seen.has(id)) return [];
    seen.add(id);
    return [
      {
        review_id: id,
        title,
        text: body,
        rating:
          typeof item.rating === "number" &&
          Number.isInteger(item.rating) &&
          item.rating >= 1 &&
          item.rating <= 5
            ? item.rating
            : null,
        date_text: text(item.date_text, 200),
        variation_text: text(item.variation_text, 200),
        verified_purchase: item.verified_purchase === 1 ? (true as const) : null,
        helpful_votes:
          typeof item.helpful_votes === "number" &&
          Number.isSafeInteger(item.helpful_votes) &&
          item.helpful_votes > 0
            ? item.helpful_votes
            : null,
      },
    ];
  });
}
