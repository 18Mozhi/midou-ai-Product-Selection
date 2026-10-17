import {
  validateSupplyTitleClassifications,
  type SupplyTitleContext,
} from "./supply-title-classification.js";
export const AUTOMATIC_SELECTION_FORMULA_VERSION = "crawler-evidence-v1";

export interface ProductFacts {
  title: string;
  price: number | null;
  currency: string | null;
  reviewCount: number | null;
  rating: number | null;
  availability: "in_stock" | "out_of_stock" | "unknown";
  observedAt: Date;
  evidenceId: string;
  providerHealthy: boolean;
  qualityBlocked: boolean;
}

export interface SupplyFacts {
  title: string;
  price: number;
  currency: string;
  observedAt: Date;
  evidenceId: string;
  externalId: string;
  priceDescription?: string | null;
}

export interface SupplyMatch {
  item: SupplyFacts;
  confidence: number | null;
  sampleCount: number;
  conservativePrice: number;
  classification?: SupplyTitleContext;
}

export interface AutomaticScoreFacts {
  market_demand: number | null;
  competition: number | null;
  profit: number | null;
  risk: number | null;
  data_quality: number | null;
  riskLevel: "unknown" | "low" | "medium" | "high";
}

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value * 100) / 100));
const finite = (value: unknown) => {
  const parsed = value == null ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function normalizedProductFields(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const value = payload as Record<string, unknown>;
  return value.fields && typeof value.fields === "object" && !Array.isArray(value.fields)
    ? (value.fields as Record<string, unknown>)
    : value;
}

const normalizedIdentityText = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/苹果/g, " iphone ")
    .replace(/三星/g, " samsung ")
    .replace(/谷歌/g, " pixel ")
    .replace(/手机壳|保护壳|保护套|机壳/g, " phone case ")
    .replace(/手机套/g, " phone case ")
    .replace(/\bcover\b/g, " case ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\b(iphone|pixel)(?=\d)/g, "$1 ")
    .replace(/\b(1[1-8]|s\d{2}|a\d{2}|z\d|pixel\s*\d)(?=pro|max|plus|mini|ultra|fe)/g, "$1 ")
    .replace(/\bpro(?=max|plus|mini|ultra)/g, "pro ")
    .replace(/\s+/g, " ")
    .trim();

const stopWords = new Set([
  "a",
  "an",
  "and",
  "amazon",
  "case",
  "cover",
  "for",
  "new",
  "of",
  "phone",
  "the",
  "to",
  "with",
  "适用",
  "专用",
  "新款",
]);

const tokens = (value: string) =>
  new Set(
    normalizedIdentityText(value)
      .split(" ")
      .filter((item) => item.length >= 2 && !stopWords.has(item)),
  );

const family = (value: string) => {
  const normalized = normalizedIdentityText(value);
  if (/\b(?:iphone|apple)\b/.test(normalized)) return "iphone";
  if (/\b(?:samsung|galaxy)\b/.test(normalized)) return "galaxy";
  if (/\bpixel\b/.test(normalized)) return "pixel";
  return null;
};

const models = (value: string) => {
  const normalized = normalizedIdentityText(value),
    found = normalized.match(/\b(?:1[1-8]|s\d{2}|a\d{2}|z\d|pixel\s*\d)\b/g) ?? [];
  return new Set(found.map((item) => item.replace(/\s+/g, "")));
};

const variants = (value: string) => {
  const normalized = normalizedIdentityText(value),
    found = normalized.match(/\b(?:pro|max|plus|mini|ultra|fe)\b/g) ?? [];
  return new Set(found);
};

export const isPhoneCase = (value: string) => {
  if (/手机壳|手机套|手机保护壳|手机保护套|\b(?:cell\s*)?phone\s*(?:case|cover)\b/i.test(value))
    return true;
  return (
    family(value) !== null &&
    models(value).size > 0 &&
    /\b(?:iphone|apple|pixel|samsung(?:\s+galaxy)?|galaxy)\s+(?:\d{1,2}|s\d{2}|a\d{2}|z\d)\b/.test(
      normalizedIdentityText(value),
    ) &&
    /\b(?:case|cover)\b|保护壳|保护套|机壳/i.test(value)
  );
};
const intersects = <T>(left: Set<T>, right: Set<T>) => [...left].filter((item) => right.has(item));
const materialPatterns: Array<[string, RegExp]> = [
  ["nylon", /\bnylon\b|尼龙|锦纶/i],
  ["silicone", /\bsilicone\b|硅胶/i],
  ["leather", /\bleather\b|真皮|皮革/i],
  ["polyester", /\bpolyester\b|涤纶|聚酯/i],
  ["cotton", /\bcotton\b|纯棉|棉布/i],
  ["stainless_steel", /\bstainless\s+steel\b|不锈钢/i],
  ["plastic", /\bplastic\b|塑料/i],
  ["glass", /\bglass\b|玻璃/i],
  ["wood", /\bwood(?:en)?\b|实木|木质/i],
  ["aluminium", /\balumin(?:um|ium)\b|铝合金|铝制/i],
];
const explicitMaterials = (value: string) => {
  const title = value.normalize("NFKC");
  return materialPatterns.flatMap(([material, pattern]) => (pattern.test(title) ? [material] : []));
};
const numericTitleSpecifications = (title: string) =>
  new Set(title.normalize("NFKC").match(/\d+(?:[.,]\d+)?/g) ?? []);
const genericTitleFactsCompatible = (productTitle: string, supplyTitle: string) => {
  const product = explicitMaterials(productTitle),
    supply = explicitMaterials(supplyTitle),
    productNumbers = numericTitleSpecifications(productTitle),
    supplyNumbers = numericTitleSpecifications(supplyTitle);
  return (
    product.length === supply.length &&
    product.every((item) => supply.includes(item)) &&
    productNumbers.size === supplyNumbers.size &&
    [...productNumbers].every((item) => supplyNumbers.has(item))
  );
};

export function productIdentityConfidence(productTitle: string, supplyTitle: string): number {
  const productTokens = tokens(productTitle),
    supplyTokens = tokens(supplyTitle),
    sharedTokens = intersects(productTokens, supplyTokens),
    productFamily = family(productTitle),
    supplyFamily = family(supplyTitle),
    productModels = models(productTitle),
    supplyModels = models(supplyTitle),
    sharedModels = intersects(productModels, supplyModels),
    productVariants = variants(productTitle),
    supplyVariants = variants(supplyTitle),
    phoneCase = isPhoneCase(productTitle) || isPhoneCase(supplyTitle);

  if (phoneCase) {
    if (!isPhoneCase(productTitle) || !isPhoneCase(supplyTitle)) return 0;
    if (!productFamily || productFamily !== supplyFamily || !sharedModels.length) return 0;
    if (
      productVariants.size > 0 &&
      supplyVariants.size > 0 &&
      intersects(productVariants, supplyVariants).length === 0
    )
      return 0;
    const variantScore =
        productVariants.size === 0 || supplyVariants.size === 0
          ? 4
          : Math.min(10, intersects(productVariants, supplyVariants).length * 5),
      tokenScore = Math.min(10, sharedTokens.length * 2);
    return clamp(75 + variantScore + tokenScore);
  }

  if (!genericTitleFactsCompatible(productTitle, supplyTitle) || sharedTokens.length < 3) return 0;
  const union = new Set([...productTokens, ...supplyTokens]).size,
    jaccard = union ? sharedTokens.length / union : 0;
  return clamp(70 + Math.min(30, sharedTokens.length * 4 + jaccard * 20));
}

export function selectConservativeSupplyMatch(
  productTitle: string,
  supplies: SupplyFacts[],
  minimumConfidence = 80,
  minimumSamples = 3,
): SupplyMatch | null {
  // Repeated collections of one offer are observations, not independent supplier samples.
  const latestOffers = new Map<string, SupplyFacts>();
  for (const item of supplies) {
    if (!item.externalId.trim() || !Number.isFinite(item.observedAt.getTime())) continue;
    const current = latestOffers.get(item.externalId);
    if (!current || item.observedAt.getTime() > current.observedAt.getTime())
      latestOffers.set(item.externalId, item);
  }
  const matches = [...latestOffers.values()]
    .filter(
      (item) =>
        item.currency === "CNY" &&
        Number.isFinite(item.price) &&
        item.price > 0 &&
        !item.priceDescription?.includes("新人价") &&
        item.evidenceId.length > 0,
    )
    .map((item) => ({ item, confidence: productIdentityConfidence(productTitle, item.title) }))
    .filter((item) => item.confidence >= minimumConfidence)
    .sort(
      (left, right) => right.confidence - left.confidence || right.item.price - left.item.price,
    );
  if (matches.length < minimumSamples) return null;
  const strongest = matches[0]!.confidence,
    cohort = matches.filter((item) => item.confidence >= strongest - 5).slice(0, 20);
  if (cohort.length < minimumSamples) return null;
  const prices = cohort.map((item) => item.item.price).sort((left, right) => left - right),
    percentileIndex = Math.min(prices.length - 1, Math.ceil(prices.length * 0.75) - 1),
    conservativePrice = prices[percentileIndex]!,
    selected =
      cohort.find((item) => item.item.price === conservativePrice) ?? cohort[cohort.length - 1]!;
  return {
    item: selected.item,
    confidence: selected.confidence,
    sampleCount: cohort.length,
    conservativePrice,
  };
}

/** A classification can identify a quoted source, never create a price or similarity percentage. */
export function selectClassifiedSupplyQuote(
  productRef: string,
  productTitle: string,
  supplies: SupplyFacts[],
  context?: SupplyTitleContext,
): SupplyMatch | null {
  if (
    !context ||
    isPhoneCase(productTitle) ||
    context.input.product_ref !== productRef ||
    context.input.product_title !== productTitle
  )
    return null;
  let classifications;
  try {
    classifications = validateSupplyTitleClassifications(
      { classifications: context.classifications },
      context.input,
    );
  } catch {
    return null;
  }
  const latestOffers = new Map<string, SupplyFacts>();
  for (const item of supplies) {
    if (!item.externalId.trim() || !Number.isFinite(item.observedAt.getTime())) continue;
    const current = latestOffers.get(item.externalId);
    if (!current || item.observedAt > current.observedAt) latestOffers.set(item.externalId, item);
  }
  const candidates = new Map(context.input.candidates.map((item) => [item.source_ref, item.title]));
  for (const candidate of context.input.candidates) {
    const classification = classifications.find(
      (item) => item.source_ref === candidate.source_ref && item.relation === "compatible",
    );
    if (!classification) continue;
    const item = [...latestOffers.values()].find(
      (offer) => `${offer.externalId}:${offer.evidenceId}` === classification.source_ref,
    );
    if (
      !item ||
      candidates.get(classification.source_ref) !== item.title ||
      !genericTitleFactsCompatible(productTitle, item.title) ||
      isPhoneCase(item.title) ||
      item.currency !== "CNY" ||
      !Number.isFinite(item.price) ||
      item.price <= 0 ||
      !item.evidenceId ||
      item.priceDescription?.includes("新人价")
    )
      continue;
    return {
      item,
      confidence: null,
      sampleCount: 1,
      conservativePrice: item.price,
      classification: { input: context.input, classifications: [classification] },
    };
  }
  return null;
}

export function calculateAutomaticScoreFacts(input: {
  product: ProductFacts;
  netMarginPercent: number | null;
  evidenceAgeHours: number;
  requiredFieldsPresent: number;
  requiredFieldCount: number;
}): AutomaticScoreFacts {
  const reviewCount = finite(input.product.reviewCount),
    rating = finite(input.product.rating),
    ratingQuality = rating == null ? null : clamp(((rating - 3) / 2) * 100),
    demand =
      reviewCount == null || ratingQuality == null
        ? null
        : clamp((Math.log10(Math.max(0, reviewCount) + 1) / 4) * 80 + ratingQuality * 0.2),
    competition =
      reviewCount == null
        ? null
        : clamp(100 - (Math.log10(Math.max(0, reviewCount) + 1) / 5) * 100),
    profit =
      input.netMarginPercent == null ? null : clamp(((input.netMarginPercent - 10) / 30) * 100),
    freshnessPenalty = input.evidenceAgeHours > 168 ? 45 : input.evidenceAgeHours > 72 ? 20 : 0,
    risk = clamp(
      100 -
        freshnessPenalty -
        (input.product.providerHealthy ? 0 : 35) -
        (input.product.qualityBlocked ? 70 : 0) -
        (input.product.availability === "out_of_stock"
          ? 55
          : input.product.availability === "unknown"
            ? 15
            : 0),
    ),
    completeness = input.requiredFieldCount
      ? (input.requiredFieldsPresent / input.requiredFieldCount) * 100
      : 0,
    dataQuality = clamp(
      completeness -
        (input.product.providerHealthy ? 0 : 25) -
        (input.product.qualityBlocked ? 60 : 0),
    ),
    riskLevel = risk >= 80 ? "low" : risk >= 60 ? "medium" : risk > 0 ? "high" : "unknown";
  return {
    market_demand: demand,
    competition,
    profit,
    risk,
    data_quality: dataQuality,
    riskLevel,
  };
}
