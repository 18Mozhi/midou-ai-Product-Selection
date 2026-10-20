import type { SupplyFacts } from "./automatic-selection-evaluation.js";

/** Same scoped source decoding for the price writer and the completion recheck. */
export function supplyFacts(rows: Array<Record<string, unknown>>): SupplyFacts[] {
  const decode = (row: (typeof rows)[number]): Record<string, unknown> => {
    let payload: unknown = row.payload_json;
    try {
      if (typeof payload === "string") payload = JSON.parse(payload);
    } catch {
      return {};
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
    const value = payload as Record<string, unknown>;
    return value.fields && typeof value.fields === "object" && !Array.isArray(value.fields)
      ? (value.fields as Record<string, unknown>)
      : value;
  };
  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const pairs = (value: unknown): Array<{ name: string; value: string }> =>
    Array.isArray(value)
      ? value
          .filter((item) => item && typeof item.name === "string" && typeof item.value === "string")
          .map((item) => ({ name: item.name, value: item.value }))
      : [];
  const detailed = new Map<string, number>();
  for (const row of rows) {
    const fields = decode(row);
    if (!["offer_sku_detail", "offer_detail_unselected"].includes(String(fields.record_type)))
      continue;
    const stamp = new Date(String(fields.observed_at ?? row.created_at)).getTime();
    if (Number.isFinite(stamp))
      detailed.set(
        text(fields.external_id),
        Math.max(detailed.get(text(fields.external_id)) ?? 0, stamp),
      );
  }
  return rows.flatMap((row) => {
    const fields = decode(row),
      externalId = text(fields.external_id),
      detail = fields.record_type === "offer_sku_detail";
    if (
      !externalId ||
      fields.price_eligible === false ||
      fields.record_type === "offer_detail_unselected" ||
      (!detail && detailed.has(externalId))
    )
      return [];
    const observed = fields.observed_at ?? row.created_at;
    const observedAt = observed instanceof Date ? observed : new Date(String(observed));
    if (detail && observedAt.getTime() < (detailed.get(externalId) ?? 0)) return [];
    return [
      {
        externalId,
        title: text(fields.title),
        price: fields.price == null ? NaN : Number(fields.price),
        currency: text(fields.currency).toUpperCase(),
        observedAt,
        evidenceId: String(row.raw_evidence_id),
        priceDescription: text(fields.price_description) || null,
        ...(detail
          ? {
              skuId: text(fields.sku_id),
              detailComplete: fields.detail_complete === true,
              priceAmount: fields.price_amount == null ? null : Number(fields.price_amount),
              stock: fields.stock == null ? null : Number(fields.stock),
              attributes: pairs(fields.attributes),
              skuProperties: pairs(fields.sku_properties),
            }
          : {}),
      },
    ];
  });
}
