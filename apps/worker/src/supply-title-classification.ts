export type SupplyTitleCandidate = { source_ref: string; title: string };
export type SupplyTitleInput = {
  product_ref: string;
  product_title: string;
  candidates: SupplyTitleCandidate[];
};
export type SupplyTitleAttribute = {
  kind: "product_type" | "material" | "size" | "function" | "design" | "compatibility";
  product_excerpt: string;
  supply_excerpt: string;
};
export type SupplyTitleClassification = {
  source_ref: string;
  relation: "compatible" | "incompatible" | "uncertain";
  rationale: string;
  attributes: SupplyTitleAttribute[];
};
export interface SupplyTitleClassifier {
  classifySupplies(input: SupplyTitleInput): Promise<SupplyTitleClassification[]>;
}
export type SupplyTitleContext = {
  input: SupplyTitleInput;
  classifications: SupplyTitleClassification[];
};
const keys = (value: object, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
const text = (value: unknown, maximum: number): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= maximum &&
  !/[\u0000-\u001f]/u.test(value);
const invalid = () => new Error("supply_title_classification_invalid");

/** Model classifications stay separate from source facts; all supporting excerpts must exist verbatim. */
export function validateSupplyTitleClassifications(
  value: unknown,
  input: SupplyTitleInput,
): SupplyTitleClassification[] {
  const object = value as { classifications: SupplyTitleClassification[] };
  if (
    !object ||
    typeof object !== "object" ||
    Array.isArray(object) ||
    !keys(object, ["classifications"]) ||
    !Array.isArray(object.classifications) ||
    object.classifications.length > input.candidates.length
  )
    throw invalid();
  const candidates = new Map(input.candidates.map((item) => [item.source_ref, item]));
  const seen = new Set<string>();
  for (const result of object.classifications) {
    if (
      !result ||
      typeof result !== "object" ||
      Array.isArray(result) ||
      !keys(result, ["source_ref", "relation", "rationale", "attributes"]) ||
      !candidates.has(result.source_ref) ||
      seen.has(result.source_ref) ||
      !["compatible", "incompatible", "uncertain"].includes(result.relation) ||
      !text(result.rationale, 800) ||
      !Array.isArray(result.attributes) ||
      result.attributes.length > 6
    )
      throw invalid();
    seen.add(result.source_ref);
    const candidate = candidates.get(result.source_ref)!,
      kinds = new Set<string>(),
      productExcerpts: string[] = [],
      supplyExcerpts: string[] = [];
    for (const attribute of result.attributes) {
      if (
        !attribute ||
        typeof attribute !== "object" ||
        Array.isArray(attribute) ||
        !keys(attribute, ["kind", "product_excerpt", "supply_excerpt"]) ||
        !["product_type", "material", "size", "function", "design", "compatibility"].includes(
          attribute.kind,
        ) ||
        kinds.has(attribute.kind) ||
        !text(attribute.product_excerpt, 120) ||
        !text(attribute.supply_excerpt, 120) ||
        !input.product_title.includes(attribute.product_excerpt) ||
        !candidate.title.includes(attribute.supply_excerpt)
      )
        throw invalid();
      const productExcerpt = attribute.product_excerpt.trim().toLocaleLowerCase("en-US"),
        supplyExcerpt = attribute.supply_excerpt.trim().toLocaleLowerCase("en-US");
      if (
        productExcerpts.some(
          (item) => item.includes(productExcerpt) || productExcerpt.includes(item),
        ) ||
        supplyExcerpts.some((item) => item.includes(supplyExcerpt) || supplyExcerpt.includes(item))
      )
        throw invalid();
      productExcerpts.push(productExcerpt);
      supplyExcerpts.push(supplyExcerpt);
      kinds.add(attribute.kind);
    }
    if (result.relation === "compatible" && (!kinds.has("product_type") || kinds.size < 3))
      throw invalid();
  }
  return structuredClone(object.classifications);
}
