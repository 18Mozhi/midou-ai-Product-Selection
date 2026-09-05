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
}

export interface SupplyMatch {
  item: SupplyFacts;
  confidence: number;
  sampleCount: number;
  conservativePrice: number;
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

export const isPhoneCase = (value: string) =>
  /\b(?:phone\s+)?case\b|手机壳|保护壳|保护套|机壳/i.test(value);
const intersects = <T>(left: Set<T>, right: Set<T>) => [...left].filter((item) => right.has(item));

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

  if (sharedTokens.length < 3) return 0;
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
  const matches = supplies
    .filter(
      (item) =>
        item.currency === "CNY" &&
        Number.isFinite(item.price) &&
        item.price > 0 &&
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
