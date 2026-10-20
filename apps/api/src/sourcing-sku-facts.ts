/** Read-only SKU facts from this candidate's exactly linked normalized evidence. */
export function sourcingSkuFacts(fields: Record<string, unknown>) {
  if (
    fields.record_type !== "offer_sku_detail" ||
    !/^\d{1,40}$/.test(String(fields.sku_id)) ||
    !/^\d{1,40}$/.test(String(fields.external_id))
  )
    return null;
  const pairs = (value: unknown): Array<{ name: string; value: string }> =>
    Array.isArray(value)
      ? value
          .filter((item) => item && typeof item.name === "string" && typeof item.value === "string")
          .map((item) => ({ name: item.name, value: item.value }))
      : [];
  const unitKeys = ["length", "width", "height", "volume", "weight"];
  const rawUnits =
    fields.package_units && typeof fields.package_units === "object"
      ? (fields.package_units as Record<string, unknown>)
      : {};
  const units = Object.fromEntries(
    unitKeys
      .filter((key) => typeof rawUnits[key] === "string")
      .map((key) => [key, String(rawUnits[key])]),
  );
  const packages = Array.isArray(fields.packaging)
    ? fields.packaging.flatMap((value) => {
        if (
          !value ||
          typeof value !== "object" ||
          (value.skuId !== undefined && value.skuId !== fields.sku_id)
        )
          return [];
        return [
          Object.fromEntries(
            unitKeys
              .filter(
                (key) =>
                  typeof value[key] === "number" && Number.isFinite(value[key]) && value[key] >= 0,
              )
              .map((key) => [key, Number(value[key])]),
          ),
        ];
      })
    : [];
  return {
    offer_id: String(fields.external_id),
    sku_id: String(fields.sku_id),
    price_source: typeof fields.price_source === "string" ? fields.price_source : null,
    price_amount: typeof fields.price_amount === "number" ? fields.price_amount : null,
    price_unit: typeof fields.price_unit === "string" ? fields.price_unit : null,
    properties: pairs(fields.sku_properties),
    attributes: pairs(fields.attributes),
    packages,
    package_units: units,
  };
}
