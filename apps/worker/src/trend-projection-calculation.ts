import { createHash } from "node:crypto";
import { BUILTIN_PROVIDER_SOURCES } from "@scoutops/provider-sources";

export interface TrendProjectionJob {
  id: string;
  organizationId: string;
  workspaceId: string;
  normalizedRecordId: string;
  providerId: string;
  providerCode: string;
  rawEvidenceId: string;
  collectionTaskId: string;
  payload: Record<string, unknown>;
  actorId: string;
  requestId: string;
  traceId: string;
  attemptCount: number;
}

const automaticTrendLocales = {
  us: { market: "US", language: "en-US" },
  gb: { market: "GB", language: "en-GB" },
  de: { market: "DE", language: "de-DE" },
  fr: { market: "FR", language: "fr-FR" },
  jp: { market: "JP", language: "ja-JP" },
  kr: { market: "KR", language: "ko-KR" },
  sg: { market: "SG", language: "en-SG" },
  au: { market: "AU", language: "en-AU" },
} as const;
const automaticTrendTopics = new Set([
  "consumer_trends",
  "viral_products",
  "amazon",
  "tiktok_shop",
  "etsy",
  "ebay",
  "retail_data",
  "search_data",
  "social_buzz",
  "reddit",
  "youtube",
  "new_products",
]);
const automaticProductTopics = new Set([
  "viral_products",
  "amazon",
  "tiktok_shop",
  "etsy",
  "ebay",
  "new_products",
]);
const automaticTrendTopicCategories = new Map<string, string>([
  ["consumer_trends", "news"],
  ["viral_products", "ecommerce"],
  ["amazon", "ecommerce"],
  ["tiktok_shop", "ecommerce"],
  ["etsy", "ecommerce"],
  ["ebay", "ecommerce"],
  ["retail_data", "data"],
  ["search_data", "data"],
  ["social_buzz", "community"],
  ["reddit", "community"],
  ["youtube", "community"],
  ["new_products", "news"],
]);
const automaticSources = new Map(
  BUILTIN_PROVIDER_SOURCES.filter(
    (source) => source.availability === "automatic" && source.category !== "product_supply",
  ).map((source) => [source.code, source]),
);

export type ProjectedTrendProviderContext =
  | { accepted: false }
  | {
      accepted: true;
      automatic: boolean;
      market: string;
      language: string;
      category: string | null;
    };

export function projectedTrendProviderContext(providerCode: string): ProjectedTrendProviderContext {
  if (providerCode === "google_news_search")
    return {
      accepted: true,
      automatic: false,
      market: "US",
      language: "en-US",
      category: null,
    };
  if (providerCode === "amazon_product")
    return {
      accepted: true,
      automatic: true,
      market: "US",
      language: "en-US",
      category: "ecommerce",
    };
  if (providerCode === "1688_search")
    return {
      accepted: true,
      automatic: true,
      market: "GLOBAL",
      language: "und",
      category: "ecommerce",
    };
  const source = automaticSources.get(providerCode);
  if (source) {
    const market =
        source.markets.find((value) => value !== "GLOBAL") ?? source.markets[0] ?? "GLOBAL",
      language = source.languages[0] ?? "multi";
    return { accepted: true, automatic: true, market, language, category: source.category };
  }
  const match = /^gnews_([a-z]{2})_(.+)$/.exec(providerCode),
    locale = match ? automaticTrendLocales[match[1] as keyof typeof automaticTrendLocales] : null;
  if (!match || !locale || !automaticTrendTopics.has(match[2]!)) return { accepted: false };
  return {
    accepted: true,
    automatic: true,
    ...locale,
    category: automaticTrendTopicCategories.get(match[1]!) ?? null,
  };
}

export function isAutomaticProductDiscoveryProvider(providerCode: string) {
  const context = projectedTrendProviderContext(providerCode);
  const match = /^gnews_[a-z]{2}_(.+)$/.exec(providerCode),
    source = automaticSources.get(providerCode);
  return (
    context.accepted &&
    context.automatic &&
    (providerCode === "1688_search" ||
      source?.category === "ecommerce" ||
      Boolean(match && automaticProductTopics.has(match[1]!)))
  );
}

export function isConcreteProductEvidence(payload: Record<string, unknown>, canonicalUrl: string) {
  const urlLooksLikeProduct = [
    /\/(?:dp|gp\/product)\/[A-Z0-9]{10}(?:[/?]|$)/i,
    /\/itm\//i,
    /\/ip\//i,
    /detail\.1688\.com\/offer\/\d+\.html(?:[/?]|$)/i,
    /\.made-in-china\.com\/product\//i,
    /\/product\/[^/]+/i,
  ].some((pattern) => pattern.test(canonicalUrl));
  const price = payload.price == null ? null : Number(payload.price);
  return (
    urlLooksLikeProduct ||
    (Number.isFinite(price) && price! >= 0 && typeof payload.image_url === "string")
  );
}

export function normalizeProjectedTrendTitle(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.length > 1000)
    throw new TrendProjectionError("trend_title_invalid", false);
  return value.trim().normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

const supplierKeywordRules: Array<[RegExp, string]> = [
  [/\btoner\s+pads?\b/i, "facial toner pads"],
  [/\bcotton\s+swabs?\b/i, "cotton swabs"],
  [/\bcotton\s+rounds?\b/i, "cotton rounds"],
  [/\b(?:acne|pimple|hydrocolloid)\b.*\bpatch(?:es)?\b/i, "hydrocolloid acne patches"],
  [/\bglycolic\s+acid\b.*\btoner\b/i, "glycolic acid toner"],
  [/\bbody\s+lotion\b/i, "body lotion"],
  [/\bpaper\s+towels?\b/i, "paper towels"],
  [/\btoilet\s+(?:paper|tissue)\b/i, "toilet paper"],
  [/\balkaline\s+batter(?:y|ies)\b/i, "alkaline batteries"],
  [/\bwireless\s+earbuds?\b/i, "wireless earbuds"],
  [/\b(?:wired\s+ear\s*buds?|earpods?)\b/i, "wired earbuds"],
  [/\b(?:airtag|key\s+finder|item\s+tracker)\b/i, "bluetooth item tracker"],
  [/\b(?:surge\s+protector|power\s+strip)\b/i, "surge protector power strip"],
  [/\bboxer\s+briefs?\b/i, "mens boxer briefs"],
  [/\bmens?\s+underwear\b/i, "mens underwear"],
  [/\bundershirts?\b/i, "cotton undershirts"],
];
const supplierStopWords = new Set([
  "amazon",
  "basics",
  "with",
  "for",
  "and",
  "the",
  "pack",
  "packs",
  "count",
  "white",
  "black",
  "new",
  "more",
  "from",
  "your",
  "this",
]);

export function buildSupplierSearchQuery(title: string) {
  const normalized = title.normalize("NFKC").replace(/\s+/g, " ").trim();
  for (const [pattern, query] of supplierKeywordRules) if (pattern.test(normalized)) return query;
  const words = normalized
    .split(/[|,;:()[\]{}\-–—]+/, 1)[0]!
    .match(/[\p{L}\p{N}]+/gu)
    ?.filter((word) => !supplierStopWords.has(word.toLocaleLowerCase("en-US")))
    .filter((word) => !/^\d+(?:\.\d+)?$/.test(word))
    .slice(0, 6);
  return (words?.join(" ") || normalized).slice(0, 120);
}

export class TrendProjectionError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "TrendProjectionError";
  }
}

const text = (value: unknown, code: string, maximum: number) => {
  if (typeof value !== "string" || !value.trim() || value.length > maximum)
    throw new TrendProjectionError(code, false);
  return value.trim();
};
const date = (value: unknown, code: string) => {
  const result = new Date(text(value, code, 120));
  if (!Number.isFinite(result.getTime())) throw new TrendProjectionError(code, false);
  return result;
};
const http = (value: unknown) => {
  const raw = text(value, "trend_url_invalid", 2048);
  let result: URL;
  try {
    result = new URL(raw);
  } catch {
    throw new TrendProjectionError("trend_url_invalid", false);
  }
  if (
    !["http:", "https:"].includes(result.protocol) ||
    result.username ||
    result.password ||
    result.hash
  )
    throw new TrendProjectionError("trend_url_invalid", false);
  return result.toString();
};

export function calculateTrendProjection(job: TrendProjectionJob) {
  const title = text(job.payload.title, "trend_title_invalid", 1000),
    normalizedTitle = normalizeProjectedTrendTitle(title),
    publisher = text(
      job.payload.publisher ??
        (job.providerCode === "1688_search" ? job.payload.supplier_name : null),
      "trend_publisher_invalid",
      300,
    ),
    canonicalUrl = http(job.payload.canonical_url),
    publishedAt = date(
      job.payload.published_at ?? job.payload.observed_at,
      "trend_published_at_invalid",
    ),
    observedAt = date(job.payload.observed_at, "trend_observed_at_invalid"),
    providerContext = projectedTrendProviderContext(job.providerCode);
  if (!providerContext.accepted)
    throw new TrendProjectionError("trend_provider_unsupported", false);
  const topicKey = createHash("sha256")
    .update(`${providerContext.market}\0${providerContext.language}\0${normalizedTitle}`)
    .digest("hex");
  return {
    title,
    normalizedTitle,
    publisher,
    canonicalUrl,
    publishedAt,
    observedAt,
    providerContext,
    topicKey,
  };
}
