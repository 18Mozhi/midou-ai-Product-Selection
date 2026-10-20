import type { SupplyFacts } from "./automatic-selection-evaluation.js";

export const supplyIdentityKey = (item: SupplyFacts) =>
  item.skuId ? `${item.externalId}:sku:${item.skuId}` : item.externalId;
export const supplySourceRef = (item: SupplyFacts) =>
  `${supplyIdentityKey(item)}:${item.evidenceId}`;

/** Product attributes and the selected SKU only; package sizes/weights are deliberately separate. */
export function supplyDetailText(item: SupplyFacts): string {
  if (!item.skuId) return "";
  const properties = item.skuProperties ?? [];
  const names = new Set(properties.map((value) => value.name));
  const hasSize = names.has("尺寸") || names.has("规格");
  const attributes = (item.attributes ?? []).filter(
    (value) =>
      ["材质", "功能", "规格", "尺寸", "适用场景", "结构造型", "适用性别"].includes(value.name) &&
      !names.has(value.name) &&
      !(hasSize && ["尺寸", "规格"].includes(value.name)),
  );
  return [...properties, ...attributes].map((value) => `${value.name}: ${value.value}`).join("\n");
}

export function supplyDetailEligible(item: SupplyFacts) {
  if (!item.skuId) return true;
  return (
    /^\d{1,40}$/.test(item.skuId) &&
    item.detailComplete === true &&
    item.priceAmount === 1 &&
    typeof item.stock === "number" &&
    item.stock > 0 &&
    Boolean(supplyDetailText(item))
  );
}

/** A component SKU cannot borrow the parent offer's set identity. */
export function supplySkuUseCompatible(productTitle: string, item: SupplyFacts) {
  if (!item.skuId) return true;
  const selected = (item.skuProperties ?? []).map((property) => property.value).join(" ");
  return !(/\b(?:set|kit|bundle)\b/i.test(productTitle) && /单把|单张|单个/.test(selected));
}
