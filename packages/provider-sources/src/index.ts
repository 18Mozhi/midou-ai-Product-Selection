import { createHash } from "node:crypto";
import {
  ProviderAdapterFailure,
  type AdapterHealthContext,
  type AdapterHealthSignal,
  type AdapterInvocationContext,
  type ProviderAdapter,
  type ProviderCollectBatch,
  type ProviderCollectRequest,
  type ProviderNormalizedRecord,
  type ProviderRawRecord,
} from "@scoutops/provider-adapters";
export {
  createProviderSourceFetch,
  decodeProviderProxyResponseBody,
} from "./proxy-fetch.js";
export type {
  ProviderSourceFetchDependencies,
  ProviderSourceProxyConfig,
} from "./proxy-fetch.js";

export type SourceCategory =
  "news" | "ecommerce" | "data" | "community" | "product_supply";
export type SourceAvailability = "automatic" | "setup_required" | "manual";
export interface BuiltinSourceDefinition {
  code: string;
  name: string;
  access_mode:
    | "public_rss"
    | "authenticated_browser"
    | "public_page"
    | "import"
    | "manual";
  target_url: string;
  markets: string[];
  languages: string[];
  fields: string[];
  schedule_minutes: number;
  concurrency_limit: number;
  timeout_ms: number;
  retry_limit: number;
  circuit_failure_threshold: number;
  dedupe_key: string;
  retention_days: number;
  failure_rules: string[];
  parser_version: string;
  healthcheck_url: string | null;
  owner_label: string;
  status: "disabled" | "enabled";
  category: SourceCategory;
  availability: SourceAvailability;
  production_policy:
    "automatic_public_feed" | "setup_required" | "ready_for_owner_enablement";
  policy_note: string;
}
const GOOGLE_TEMPLATE =
  "https://news.google.com/rss/search?q={urlEncodedQuery}&hl=en-US&gl=US&ceid=US:en";
const locales = [
  {
    code: "us",
    name: "美国",
    market: "US",
    language: "en-US",
    hl: "en-US",
    gl: "US",
    ceid: "US:en",
  },
  {
    code: "gb",
    name: "英国",
    market: "GB",
    language: "en-GB",
    hl: "en-GB",
    gl: "GB",
    ceid: "GB:en",
  },
  {
    code: "de",
    name: "德国",
    market: "DE",
    language: "de-DE",
    hl: "de",
    gl: "DE",
    ceid: "DE:de",
  },
  {
    code: "fr",
    name: "法国",
    market: "FR",
    language: "fr-FR",
    hl: "fr",
    gl: "FR",
    ceid: "FR:fr",
  },
  {
    code: "jp",
    name: "日本",
    market: "JP",
    language: "ja-JP",
    hl: "ja",
    gl: "JP",
    ceid: "JP:ja",
  },
  {
    code: "kr",
    name: "韩国",
    market: "KR",
    language: "ko-KR",
    hl: "ko",
    gl: "KR",
    ceid: "KR:ko",
  },
  {
    code: "sg",
    name: "新加坡",
    market: "SG",
    language: "en-SG",
    hl: "en-SG",
    gl: "SG",
    ceid: "SG:en",
  },
  {
    code: "au",
    name: "澳大利亚",
    market: "AU",
    language: "en-AU",
    hl: "en-AU",
    gl: "AU",
    ceid: "AU:en",
  },
] as const;
const topics = [
  {
    code: "consumer_trends",
    name: "消费趋势",
    query: "consumer product trend",
    category: "news",
  },
  {
    code: "viral_products",
    name: "爆款商品",
    query: "viral products shopping",
    category: "ecommerce",
  },
  {
    code: "amazon",
    name: "Amazon 热点",
    query: "Amazon marketplace trending products",
    category: "ecommerce",
  },
  {
    code: "tiktok_shop",
    name: "TikTok Shop 热点",
    query: "TikTok Shop trending products",
    category: "ecommerce",
  },
  {
    code: "etsy",
    name: "Etsy 热点",
    query: "Etsy trending products",
    category: "ecommerce",
  },
  {
    code: "ebay",
    name: "eBay 热点",
    query: "eBay trending products",
    category: "ecommerce",
  },
  {
    code: "retail_data",
    name: "零售数据",
    query: "retail sales data consumer demand",
    category: "data",
  },
  {
    code: "search_data",
    name: "搜索趋势数据",
    query: "search trends shopping data",
    category: "data",
  },
  {
    code: "social_buzz",
    name: "社交讨论",
    query: "social media product buzz",
    category: "community",
  },
  {
    code: "reddit",
    name: "Reddit 讨论",
    query: "site:reddit.com product recommendation trending",
    category: "community",
  },
  {
    code: "youtube",
    name: "YouTube 评测",
    query: "site:youtube.com product review trending",
    category: "community",
  },
  {
    code: "new_products",
    name: "新品发布",
    query: "new consumer product launch",
    category: "news",
  },
] as const satisfies readonly {
  code: string;
  name: string;
  query: string;
  category: Exclude<SourceCategory, "product_supply">;
}[];
const syndicationFeeds = [
  {
    code: "techcrunch",
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    category: "news",
    market: "US",
    language: "en-US",
  },
  {
    code: "the_verge",
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    category: "news",
    market: "US",
    language: "en-US",
  },
  {
    code: "bbc_business",
    name: "BBC Business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    category: "news",
    market: "GB",
    language: "en-GB",
  },
  {
    code: "wired",
    name: "WIRED",
    url: "https://www.wired.com/feed/rss",
    category: "news",
    market: "US",
    language: "en-US",
  },
  {
    code: "ars_technica",
    name: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    category: "news",
    market: "US",
    language: "en-US",
  },
  {
    code: "guardian_business",
    name: "The Guardian Business",
    url: "https://www.theguardian.com/uk/business/rss",
    category: "news",
    market: "GB",
    language: "en-GB",
  },
  {
    code: "japan_times_business",
    name: "The Japan Times Business",
    url: "https://www.japantimes.co.jp/feed/business/",
    category: "news",
    market: "JP",
    language: "en-JP",
  },
  {
    code: "straits_times_business",
    name: "The Straits Times Business",
    url: "https://www.straitstimes.com/news/business/rss.xml",
    category: "news",
    market: "SG",
    language: "en-SG",
  },
  {
    code: "shopify_blog",
    name: "Shopify 电商资讯",
    url: "https://www.shopify.com/blog.atom",
    category: "ecommerce",
    market: "GLOBAL",
    language: "en",
  },
  {
    code: "etsy_seller_handbook",
    name: "Etsy Seller Handbook",
    url: "https://www.etsy.com/seller-handbook/rss",
    category: "ecommerce",
    market: "GLOBAL",
    language: "en",
  },
  {
    code: "woocommerce_blog",
    name: "WooCommerce 电商资讯",
    url: "https://woocommerce.com/posts/feed/",
    category: "ecommerce",
    market: "GLOBAL",
    language: "en",
  },
  {
    code: "bigcommerce_blog",
    name: "BigCommerce 电商资讯",
    url: "https://www.bigcommerce.com/blog/feed/",
    category: "ecommerce",
    market: "GLOBAL",
    language: "en",
  },
  {
    code: "ebay_announcements",
    name: "eBay 社区公告",
    url: "https://community.ebay.com/t5/Announcements/bg-p/Announcements/rss",
    category: "ecommerce",
    market: "US",
    language: "en-US",
  },
  {
    code: "practical_ecommerce",
    name: "Practical Ecommerce",
    url: "https://www.practicalecommerce.com/feed",
    category: "ecommerce",
    market: "US",
    language: "en-US",
  },
  {
    code: "ecommercebytes",
    name: "EcommerceBytes",
    url: "https://www.ecommercebytes.com/feed/",
    category: "ecommerce",
    market: "US",
    language: "en-US",
  },
  {
    code: "retail_dive",
    name: "Retail Dive",
    url: "https://www.retaildive.com/feeds/news/",
    category: "ecommerce",
    market: "US",
    language: "en-US",
  },
  {
    code: "hacker_news",
    name: "Hacker News 热门讨论",
    url: "https://news.ycombinator.com/rss",
    category: "community",
    market: "GLOBAL",
    language: "en",
  },
  {
    code: "product_hunt",
    name: "Product Hunt 新品社区",
    url: "https://www.producthunt.com/feed",
    category: "community",
    market: "GLOBAL",
    language: "en",
  },
  {
    code: "reddit_buyitforlife",
    name: "Reddit · BuyItForLife",
    url: "https://www.reddit.com/r/BuyItForLife/.rss",
    category: "community",
    market: "US",
    language: "en-US",
  },
  {
    code: "reddit_gadgets",
    name: "Reddit · Gadgets",
    url: "https://www.reddit.com/r/gadgets/.rss",
    category: "community",
    market: "GLOBAL",
    language: "en",
  },
  {
    code: "reddit_ecommerce",
    name: "Reddit · Ecommerce",
    url: "https://www.reddit.com/r/ecommerce/.rss",
    category: "community",
    market: "GLOBAL",
    language: "en",
  },
  {
    code: "reddit_smallbusiness",
    name: "Reddit · Small Business",
    url: "https://www.reddit.com/r/smallbusiness/.rss",
    category: "community",
    market: "US",
    language: "en-US",
  },
  {
    code: "reddit_askuk",
    name: "Reddit · AskUK",
    url: "https://www.reddit.com/r/AskUK/.rss",
    category: "community",
    market: "GB",
    language: "en-GB",
  },
  {
    code: "reddit_de",
    name: "Reddit · Germany",
    url: "https://www.reddit.com/r/de/.rss",
    category: "community",
    market: "DE",
    language: "de-DE",
  },
  {
    code: "reddit_france",
    name: "Reddit · France",
    url: "https://www.reddit.com/r/france/.rss",
    category: "community",
    market: "FR",
    language: "fr-FR",
  },
  {
    code: "reddit_japanlife",
    name: "Reddit · Japan Life",
    url: "https://www.reddit.com/r/japanlife/.rss",
    category: "community",
    market: "JP",
    language: "en-JP",
  },
  {
    code: "reddit_korea",
    name: "Reddit · Korea",
    url: "https://www.reddit.com/r/korea/.rss",
    category: "community",
    market: "KR",
    language: "en-KR",
  },
  {
    code: "reddit_australia",
    name: "Reddit · Australia",
    url: "https://www.reddit.com/r/australia/.rss",
    category: "community",
    market: "AU",
    language: "en-AU",
  },
  {
    code: "reddit_singapore",
    name: "Reddit · Singapore",
    url: "https://www.reddit.com/r/singapore/.rss",
    category: "community",
    market: "SG",
    language: "en-SG",
  },
  {
    code: "hatena_hotentry",
    name: "Hatena 日本热门内容",
    url: "https://b.hatena.ne.jp/hotentry.rss",
    category: "community",
    market: "JP",
    language: "ja-JP",
  },
  ...["US", "GB", "DE", "FR", "JP", "KR", "SG", "AU", "CA", "BR"].map(
    (market) => ({
      code: `google_trends_${market.toLowerCase()}`,
      name: `Google Trends · ${market}`,
      url: `https://trends.google.com/trending/rss?geo=${market}`,
      category: "data" as const,
      market,
      language: "multi",
    }),
  ),
] as const satisfies readonly {
  code: string;
  name: string;
  url: string;
  category: Exclude<SourceCategory, "product_supply">;
  market: string;
  language: string;
}[];
const publicCatalogPages = [
  {
    code: "amazon_bestsellers_us",
    name: "Amazon 美国畅销榜",
    url: "https://www.amazon.com/Best-Sellers/zgbs",
    market: "US",
    language: "en-US",
  },
  {
    code: "ebay_deals_us",
    name: "eBay 美国热门折扣",
    url: "https://www.ebay.com/deals",
    market: "US",
    language: "en-US",
  },
] as const;
const syndicationChannel = (
  feed: (typeof syndicationFeeds)[number],
): BuiltinSourceDefinition => {
  const pageOverride =
    feed.code === "shopify_blog"
      ? { url: "https://www.shopify.com/blog", owner: "平台电商来源中心" }
      : feed.code === "ebay_announcements"
        ? {
            url: "https://community.ebay.com/forum/announcements-57928/",
            owner: "平台电商来源中心",
          }
        : null;
  return {
  code: `feed_${feed.code}`,
  name: feed.name,
  access_mode: pageOverride ? "public_page" : "public_rss",
  target_url: pageOverride?.url ?? feed.url,
  markets: [feed.market],
  languages: [feed.language],
  fields: pageOverride
    ? ["title", "position", "source_url", "publisher", "observed_at"]
    : ["title", "summary", "published_at", "source_url", "publisher"],
  schedule_minutes: 15,
  concurrency_limit: 1,
  timeout_ms: 20000,
  retry_limit: 3,
  circuit_failure_threshold: 5,
  dedupe_key: "guid_or_link",
  retention_days: 90,
  failure_rules: [
    "network_error",
    "timeout",
    "rate_limited",
    "source_changed",
    "parse_failed",
    "empty_result",
  ],
  parser_version: pageOverride
    ? "structured-public-page-v1"
    : "syndication-feed-v1",
  healthcheck_url: pageOverride?.url ?? feed.url,
  owner_label: pageOverride?.owner ?? "平台热点中心",
  status: "enabled",
  category: feed.category,
  availability: "automatic",
  production_policy: "automatic_public_feed",
  policy_note: pageOverride
    ? "固定抓取平台公开内容列表页面，不需要官方 API Key；页面结构变化会明确标记为解析失败。"
    : "公开 RSS/Atom 频道；系统按 15 分钟周期自动采集并保留原文证据，也可在热点页手动刷新。",
  };
};
const publicCatalogChannel = (
  page: (typeof publicCatalogPages)[number],
): BuiltinSourceDefinition => ({
  code: `page_${page.code}`,
  name: page.name,
  access_mode: "public_page",
  target_url: page.url,
  markets: [page.market],
  languages: [page.language],
  fields: [
    "title",
    "price",
    "currency",
    "position",
    "source_url",
    "publisher",
    "observed_at",
  ],
  schedule_minutes: 60,
  concurrency_limit: 1,
  timeout_ms: 30000,
  retry_limit: 2,
  circuit_failure_threshold: 4,
  dedupe_key: "canonical_url",
  retention_days: 90,
  failure_rules: [
    "network_error",
    "timeout",
    "rate_limited",
    "source_changed",
    "parse_failed",
    "empty_result",
  ],
  parser_version: "structured-public-page-v1",
  healthcheck_url: page.url,
  owner_label: "平台电商来源中心",
  status: "enabled",
  category: "ecommerce",
  availability: "automatic",
  production_policy: "automatic_public_feed",
  policy_note:
    "直接抓取平台公开榜单页面的结构化商品数据，不需要官方 API Key；页面结构变化会明确标记为解析失败。",
});
const googleChannel = (
  locale: (typeof locales)[number],
  topic: (typeof topics)[number],
): BuiltinSourceDefinition => ({
  code: `gnews_${locale.code}_${topic.code}`,
  name: `Google News · ${locale.name} · ${topic.name}`,
  access_mode: "public_rss",
  target_url: `https://news.google.com/rss/search?q=${encodeURIComponent(topic.query)}&hl=${locale.hl}&gl=${locale.gl}&ceid=${locale.ceid}`,
  markets: [locale.market],
  languages: [locale.language],
  fields: ["title", "summary", "published_at", "source_url", "publisher"],
  schedule_minutes: 15,
  concurrency_limit: 1,
  timeout_ms: 20000,
  retry_limit: 3,
  circuit_failure_threshold: 5,
  dedupe_key: "guid",
  retention_days: 90,
  failure_rules: [
    "network_error",
    "timeout",
    "rate_limited",
    "source_changed",
    "parse_failed",
    "empty_result",
  ],
  parser_version: "google-news-fixed-rss-v1",
  healthcheck_url: `https://news.google.com/rss?hl=${locale.hl}&gl=${locale.gl}&ceid=${locale.ceid}`,
  owner_label: "平台热点中心",
  status: "enabled",
  category: topic.category,
  availability: "automatic",
  production_policy: "automatic_public_feed",
  policy_note:
    "公开 RSS 热点频道；系统每 15 分钟自动采集，也可在热点页手动刷新。",
});
const setupSources: readonly BuiltinSourceDefinition[] = [
  ["amazon_product", "Amazon 商品页面", "public_page", "ecommerce"],
  ["keepa", "Keepa 网页价格历史", "authenticated_browser", "data"],
  ["amazon_bestsellers", "Amazon 畅销榜", "public_page", "ecommerce"],
  ["tiktok_shop", "TikTok Shop", "authenticated_browser", "ecommerce"],
  ["temu", "Temu", "authenticated_browser", "ecommerce"],
  ["shein", "SHEIN", "authenticated_browser", "ecommerce"],
  ["aliexpress", "AliExpress", "authenticated_browser", "ecommerce"],
  ["ebay_browse", "eBay 商品页面", "public_page", "ecommerce"],
  ["etsy_listings", "Etsy 商品页面", "public_page", "ecommerce"],
  ["walmart", "Walmart", "public_page", "ecommerce"],
  ["target", "Target", "public_page", "ecommerce"],
  ["bestbuy", "Best Buy", "public_page", "ecommerce"],
  ["wayfair", "Wayfair", "public_page", "ecommerce"],
  ["homedepot", "Home Depot", "public_page", "ecommerce"],
  ["lowes", "Lowe's", "public_page", "ecommerce"],
  ["costco", "Costco", "public_page", "ecommerce"],
  ["1688_search", "1688 搜索", "authenticated_browser", "product_supply"],
  ["taobao", "淘宝", "authenticated_browser", "ecommerce"],
  ["tmall", "天猫", "authenticated_browser", "ecommerce"],
  ["jd", "京东", "authenticated_browser", "ecommerce"],
  ["pinduoduo", "拼多多", "authenticated_browser", "ecommerce"],
  ["douyin", "抖音电商", "authenticated_browser", "ecommerce"],
  ["xiaohongshu", "小红书", "authenticated_browser", "community"],
  ["reddit_search", "Reddit 论坛搜索", "public_page", "community"],
  ["youtube_search", "YouTube 公开搜索", "public_page", "community"],
  ["pinterest", "Pinterest", "public_page", "community"],
  ["instagram", "Instagram", "authenticated_browser", "community"],
  ["facebook", "Facebook", "authenticated_browser", "community"],
  ["quora", "Quora", "public_page", "community"],
  ["google_trends", "Google Trends", "public_page", "data"],
  ["similarweb", "Similarweb 公开榜单", "public_page", "data"],
  ["semrush", "Semrush 网页趋势", "authenticated_browser", "data"],
  ["exploding_topics", "Exploding Topics", "public_page", "data"],
  ["statista", "Statista", "public_page", "data"],
  ["kaggle", "Kaggle 数据集", "public_page", "data"],
  ["world_bank", "World Bank Data", "public_page", "data"],
  ["oecd", "OECD Data", "public_page", "data"],
].map(([code, name, access, category]) => ({
  code: String(code),
  name: String(name),
  access_mode: access as BuiltinSourceDefinition["access_mode"],
  target_url: `setup://${code}`,
  markets: ["GLOBAL"],
  languages: ["und"],
  fields: ["title", "observed_at", "source_url"],
  schedule_minutes: 30,
  concurrency_limit: 1,
  timeout_ms: 20000,
  retry_limit: 2,
  circuit_failure_threshold: 5,
  dedupe_key: "external_id",
  retention_days: 90,
  failure_rules: [
    "permission_denied",
    "login_required",
    "rate_limited",
    "source_changed",
  ],
  parser_version: "setup-required-v1",
  healthcheck_url: null,
  owner_label: "平台来源中心",
  status: "disabled",
  category: category as SourceCategory,
  availability: "setup_required",
  production_policy: "setup_required",
  policy_note:
    "来源已登记为公开页面或网页登录爬虫；目标页面与字段回放完成后即可启用，不要求官方 API Key。",
}));
export const BUILTIN_PROVIDER_SOURCES: readonly BuiltinSourceDefinition[] = [
  {
    code: "google_news_search",
    name: "Google News 手动关键词",
    access_mode: "public_rss",
    target_url: GOOGLE_TEMPLATE,
    markets: ["GLOBAL"],
    languages: ["multi"],
    fields: ["title", "summary", "published_at", "source_url", "publisher"],
    schedule_minutes: 15,
    concurrency_limit: 1,
    timeout_ms: 20000,
    retry_limit: 3,
    circuit_failure_threshold: 5,
    dedupe_key: "guid",
    retention_days: 90,
    failure_rules: [
      "network_error",
      "timeout",
      "rate_limited",
      "source_changed",
      "parse_failed",
      "empty_result",
    ],
    parser_version: "google-news-rss-v1",
    healthcheck_url: "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
    owner_label: "平台热点中心",
    status: "enabled",
    category: "news",
    availability: "manual",
    production_policy: "ready_for_owner_enablement",
    policy_note: "用于用户输入关键词后立即采集；不会在浏览器暴露密钥。",
  },
  ...locales.flatMap((locale) =>
    topics.map((topic) => googleChannel(locale, topic)),
  ),
  ...syndicationFeeds.map(syndicationChannel),
  ...publicCatalogPages.map(publicCatalogChannel),
  ...setupSources,
  {
    code: "manual_product_supply_csv",
    name: "商品与供应链 CSV 导入",
    access_mode: "import",
    target_url: "inline://product-supply-csv-v1",
    markets: ["GLOBAL"],
    languages: ["und"],
    fields: [
      "external_id",
      "title",
      "price",
      "currency",
      "supplier_name",
      "moq",
      "canonical_url",
      "observed_at",
    ],
    schedule_minutes: 10080,
    concurrency_limit: 1,
    timeout_ms: 10000,
    retry_limit: 0,
    circuit_failure_threshold: 1,
    dedupe_key: "external_id",
    retention_days: 365,
    failure_rules: ["validation_failed", "empty_result"],
    parser_version: "product-supply-csv-v1",
    healthcheck_url: null,
    owner_label: "平台来源中心",
    status: "disabled",
    category: "product_supply",
    availability: "manual",
    production_policy: "ready_for_owner_enablement",
    policy_note:
      "处理用户明确上传的商品与供应链 CSV，不连接或伪造外部平台数据。",
  },
];

export const AUTOMATIC_PROVIDER_SOURCE_HOSTS = Object.freeze([
  ...new Set(
    BUILTIN_PROVIDER_SOURCES.filter(
      (item) => item.availability === "automatic",
    ).map((item) => new URL(item.target_url).hostname.toLowerCase()),
  ),
]);

export interface SourceEvidencePayload {
  raw_content: string;
  content_type: string;
  canonical_url: string;
  fields: Record<string, string | number | null>;
  source_paths: Record<string, string>;
}
const text = (value: unknown, name: string, max: number) => {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new ProviderAdapterFailure(`${name}_invalid`, false);
  return value.trim();
};
const entity = (value: string) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([a-f0-9]+);/gi, (_, n) =>
      String.fromCodePoint(Number.parseInt(n, 16)),
    )
    .trim();
const tag = (xml: string, name: string) => {
  const match = xml.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"),
  );
  return match?.[1] ? entity(match[1]) : "";
};
const stripHtml = (value: string) =>
  entity(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
const httpUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ProviderAdapterFailure("source_url_invalid", false);
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new ProviderAdapterFailure("source_url_invalid", false);
  return url.toString();
};
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

export function parseGoogleNewsRss(
  xml: string,
  limit = 20,
): ProviderRawRecord[] {
  if (
    typeof xml !== "string" ||
    Buffer.byteLength(xml) > 2_000_000 ||
    !/<rss\b/i.test(xml) ||
    !/<channel\b/i.test(xml)
  )
    throw new ProviderAdapterFailure("invalid_payload", false);
  const blocks = [
    ...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),
  ].slice(0, Math.min(100, limit));
  return blocks.map((match) => {
    const raw = match[0],
      guid = text(tag(raw, "guid"), "rss_guid", 2048),
      title = text(tag(raw, "title"), "rss_title", 1000),
      link = httpUrl(text(tag(raw, "link"), "rss_link", 2048)),
      published = text(tag(raw, "pubDate"), "rss_pub_date", 120),
      publisher = text(tag(raw, "source"), "rss_publisher", 300),
      summary = stripHtml(tag(raw, "description")).slice(0, 2000),
      observedAt = new Date(published);
    if (!Number.isFinite(observedAt.getTime()))
      throw new ProviderAdapterFailure("rss_pub_date_invalid", false);
    const payload: SourceEvidencePayload = {
      raw_content: raw,
      content_type: "application/rss+xml",
      canonical_url: link,
      fields: {
        title,
        summary,
        published_at: observedAt.toISOString(),
        source_url: link,
        publisher,
      },
      source_paths: {
        title: "rss.item.title",
        summary: "rss.item.description",
        published_at: "rss.item.pubDate",
        source_url: "rss.item.link",
        publisher: "rss.item.source",
      },
    };
    return {
      externalId: sha(guid),
      observedAt: observedAt.toISOString(),
      evidenceRef: `google-news-rss:${sha(guid)}`,
      payload,
    };
  });
}

const attribute = (xml: string, name: string) => {
  const match = xml.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"));
  return match?.[1] ? entity(match[1]) : "";
};
export function parseSyndicationFeed(
  xml: string,
  sourceName: string,
  limit = 20,
): ProviderRawRecord[] {
  if (
    typeof xml !== "string" ||
    Buffer.byteLength(xml) > 2_000_000 ||
    !/(<rss\b|<feed\b|<rdf:RDF\b)/i.test(xml)
  )
    throw new ProviderAdapterFailure("invalid_payload", false);
  const atom = /<feed\b/i.test(xml),
    rdf = /<rdf:RDF\b/i.test(xml),
    pattern = atom
      ? /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi
      : /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  const blocks = [...xml.matchAll(pattern)].slice(0, Math.min(100, limit));
  if (!blocks.length) throw new ProviderAdapterFailure("empty_result", true);
  return blocks.map((match, index) => {
    const raw = match[0],
      title = text(tag(raw, "title"), "feed_title", 1000);
    const atomLink =
      [...raw.matchAll(/<link\b[^>]*>/gi)]
        .map((value) => attribute(value[0], "href"))
        .find(Boolean) ?? "";
    const link = httpUrl(
      text(atom ? atomLink : tag(raw, "link"), "feed_link", 2048),
    );
    const identity = tag(raw, atom ? "id" : "guid") || link;
    const published =
      tag(raw, atom ? "published" : "pubDate") ||
      tag(raw, "updated") ||
      tag(raw, "dc:date") ||
      new Date().toISOString();
    const observedAt = new Date(published);
    if (!Number.isFinite(observedAt.getTime()))
      throw new ProviderAdapterFailure("feed_date_invalid", false);
    const summary = stripHtml(
      tag(raw, atom ? "summary" : "description") || tag(raw, "content"),
    ).slice(0, 2000);
    const publisher =
      stripHtml(
        tag(tag(raw, "author"), "name") || tag(raw, "source") || sourceName,
      ).slice(0, 300) || sourceName;
    const payload: SourceEvidencePayload = {
      raw_content: raw,
      content_type: atom
        ? "application/atom+xml"
        : rdf
          ? "application/rdf+xml"
          : "application/rss+xml",
      canonical_url: link,
      fields: {
        title,
        summary,
        published_at: observedAt.toISOString(),
        source_url: link,
        publisher,
      },
      source_paths: {
        title: atom
          ? "atom.entry.title"
          : rdf
            ? "rdf.item.title"
            : "rss.item.title",
        summary: atom
          ? "atom.entry.summary"
          : rdf
            ? "rdf.item.description"
            : "rss.item.description",
        published_at: atom
          ? "atom.entry.published"
          : rdf
            ? "rdf.item.dc:date"
            : "rss.item.pubDate",
        source_url: atom
          ? "atom.entry.link@href"
          : rdf
            ? "rdf.item.link"
            : "rss.item.link",
        publisher: atom
          ? "atom.entry.author.name"
          : rdf
            ? "crawler.source"
            : "rss.item.source",
      },
    };
    return {
      externalId: sha(identity || `${link}\0${index}`),
      observedAt: observedAt.toISOString(),
      evidenceRef: `syndication-feed:${sha(identity || link)}`,
      payload,
    };
  });
}

const jsonLdBlocks = (html: string) =>
  [
    ...html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
const walkJson = (
  value: unknown,
  visit: (item: Record<string, unknown>) => void,
) => {
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, visit);
    return;
  }
  if (!value || typeof value !== "object") return;
  const item = value as Record<string, unknown>;
  visit(item);
  for (const child of Object.values(item)) walkJson(child, visit);
};
const absoluteUrl = (value: unknown, base: string) => {
  try {
    const url = new URL(String(value ?? ""), base);
    return httpUrl(url.toString());
  } catch {
    return "";
  }
};
export function parseStructuredCatalogPage(
  html: string,
  pageUrl: string,
  sourceName: string,
  limit = 20,
): ProviderRawRecord[] {
  if (
    typeof html !== "string" ||
    Buffer.byteLength(html) > 5_000_000 ||
    !/<html\b/i.test(html)
  )
    throw new ProviderAdapterFailure("invalid_payload", false);
  const observedAt = new Date().toISOString(),
    candidates: Array<{
      title: string;
      url: string;
      price: number | null;
      currency: string | null;
      position: number | null;
      raw: string;
      sourceKind: "jsonld" | "html_anchor";
    }> = [];
  for (const block of jsonLdBlocks(html)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(entity(block));
    } catch {
      continue;
    }
    walkJson(parsed, (item) => {
      const types = Array.isArray(item["@type"])
          ? item["@type"]
          : [item["@type"]],
        isProduct = types.some((type) =>
          ["Product", "ListItem"].includes(String(type)),
        );
      if (!isProduct) return;
      const nested = (
          item.item && typeof item.item === "object" ? item.item : item
        ) as Record<string, unknown>,
        title = String(nested.name ?? item.name ?? "").trim(),
        url = absoluteUrl(nested.url ?? item.url, pageUrl),
        offers = (
          nested.offers && typeof nested.offers === "object"
            ? nested.offers
            : {}
        ) as Record<string, unknown>,
        priceValue = Number(offers.price ?? offers.lowPrice),
        price =
          Number.isFinite(priceValue) && priceValue >= 0 ? priceValue : null,
        currency = offers.priceCurrency
          ? String(offers.priceCurrency).toUpperCase()
          : null,
        positionValue = Number(item.position),
        position =
          Number.isSafeInteger(positionValue) && positionValue > 0
            ? positionValue
            : null;
      if (title.length >= 2 && url)
        candidates.push({
          title: title.slice(0, 1000),
          url,
          price,
          currency,
          position,
          raw: JSON.stringify(item),
          sourceKind: "jsonld",
        });
    });
  }
  if (!candidates.length) {
    const host = new URL(pageUrl).hostname,
      pattern = host.includes("amazon.")
        ? /\/dp\/[A-Z0-9]{10}/i
        : host === "www.ebay.com"
          ? /\/itm\//i
          : host === "community.ebay.com"
            ? /^\/forum\/announcements-\d+\/topic\//i
            : host === "www.shopify.com"
              ? /^\/blog\/(?!topics(?:\/|$)|authors(?:\/|$)|latest\/?$)[^/]+\/?$/i
          : host.includes("walmart.")
            ? /\/ip\//i
            : null;
    if (pattern) {
      for (const match of html.matchAll(
        /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      )) {
        const url = absoluteUrl(match[1], pageUrl),
          title = stripHtml(match[2] ?? "").trim();
        if (url && pattern.test(new URL(url).pathname) && title.length >= 3)
          candidates.push({
            title: title.slice(0, 1000),
            url,
            price: null,
            currency: null,
            position: candidates.length + 1,
            raw: match[0],
            sourceKind: "html_anchor",
          });
        if (candidates.length >= limit) break;
      }
    }
  }
  const unique = [
    ...new Map(candidates.map((item) => [item.url, item])).values(),
  ].slice(0, Math.min(100, limit));
  if (!unique.length) throw new ProviderAdapterFailure("source_changed", false);
  return unique.map((item, index) => {
    const fields = {
        title: item.title,
        price: item.price,
        currency: item.currency,
        position: item.position ?? index + 1,
        source_url: item.url,
        publisher: sourceName,
        observed_at: observedAt,
      },
      isJsonLd = item.sourceKind === "jsonld",
      payload: SourceEvidencePayload = {
        raw_content: item.raw,
        content_type: isJsonLd ? "application/ld+json" : "text/html",
        canonical_url: item.url,
        fields,
        source_paths: {
          title: isJsonLd ? "jsonld.name" : "html.anchor.text",
          price: isJsonLd ? "jsonld.offers.price" : "not_available",
          currency: isJsonLd
            ? "jsonld.offers.priceCurrency"
            : "not_available",
          position: isJsonLd ? "jsonld.position" : "html.anchor.order",
          source_url: isJsonLd ? "jsonld.url" : "html.anchor.href",
          publisher: "crawler.source",
          observed_at: "crawler.observed_at",
        },
      };
    return {
      externalId: sha(item.url),
      observedAt,
      evidenceRef: `${isJsonLd ? "structured-public-page" : "public-page-link"}:${sha(item.url)}`,
      payload,
    };
  });
}

function parseCsvRows(input: string) {
  if (typeof input !== "string" || Buffer.byteLength(input) > 1_048_576)
    throw new ProviderAdapterFailure("csv_size_invalid", false);
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw new ProviderAdapterFailure("csv_quote_invalid", false);
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((value) => value.some((cell) => cell.trim()));
}
const CSV_HEADERS = [
  "external_id",
  "title",
  "price",
  "currency",
  "supplier_name",
  "moq",
  "canonical_url",
  "observed_at",
] as const;
export function parseProductSupplyCsv(
  csv: string,
  limit = 20,
): ProviderRawRecord[] {
  const rows = parseCsvRows(csv),
    header = rows[0];
  if (
    rows.length < 2 ||
    rows.length > 101 ||
    !header ||
    header.length !== CSV_HEADERS.length ||
    header.some((value, index) => value.trim() !== CSV_HEADERS[index])
  )
    throw new ProviderAdapterFailure("csv_header_invalid", false);
  return rows
    .slice(1, Math.min(rows.length, limit + 1))
    .map((values, index) => {
      if (values.length !== CSV_HEADERS.length)
        throw new ProviderAdapterFailure("csv_column_count_invalid", false);
      const row = Object.fromEntries(
          CSV_HEADERS.map((name, i) => [name, (values[i] ?? "").trim()]),
        ) as Record<(typeof CSV_HEADERS)[number], string>,
        externalId = text(row.external_id, "external_id", 200),
        title = text(row.title, "title", 1000),
        price = Number(row.price),
        currency = text(row.currency, "currency", 3).toUpperCase(),
        supplier = text(row.supplier_name, "supplier_name", 500),
        moq = Number(row.moq),
        canonical = httpUrl(text(row.canonical_url, "canonical_url", 2048)),
        observed = new Date(text(row.observed_at, "observed_at", 120));
      if (
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isSafeInteger(moq) ||
        moq < 1 ||
        !/^[A-Z]{3}$/.test(currency) ||
        !Number.isFinite(observed.getTime())
      )
        throw new ProviderAdapterFailure("csv_value_invalid", false);
      const fields = {
          external_id: externalId,
          title,
          price,
          currency,
          supplier_name: supplier,
          moq,
          canonical_url: canonical,
          observed_at: observed.toISOString(),
        },
        sourcePaths = Object.fromEntries(
          CSV_HEADERS.map((name) => [name, `csv.row[${index + 2}].${name}`]),
        ),
        payload: SourceEvidencePayload = {
          raw_content: JSON.stringify(row),
          content_type: "application/json",
          canonical_url: canonical,
          fields,
          source_paths: sourcePaths,
        };
      return {
        externalId,
        observedAt: observed.toISOString(),
        evidenceRef: `manual-product-supply:${sha(`${externalId}\0${canonical}`)}`,
        payload,
      };
    });
}

function payload(record: ProviderRawRecord) {
  const value = record.payload as Partial<SourceEvidencePayload>;
  if (
    !value ||
    typeof value.raw_content !== "string" ||
    typeof value.content_type !== "string" ||
    typeof value.canonical_url !== "string" ||
    !value.fields ||
    !value.source_paths
  )
    throw new ProviderAdapterFailure("invalid_payload", false);
  return value as SourceEvidencePayload;
}
abstract class SourceAdapter implements ProviderAdapter {
  abstract readonly key: string;
  abstract readonly accessMode: "public_rss" | "public_page" | "import";
  abstract readonly version: string;
  abstract collect(
    request: ProviderCollectRequest,
    signal: AbortSignal,
  ): Promise<ProviderCollectBatch>;
  abstract healthCheck(
    context: AdapterHealthContext,
    signal: AbortSignal,
  ): Promise<AdapterHealthSignal>;
  normalize(
    record: ProviderRawRecord,
    context: AdapterInvocationContext,
  ): ProviderNormalizedRecord {
    const value = payload(record);
    return {
      external_id: record.externalId,
      observed_at: record.observedAt,
      canonical_url: value.canonical_url,
      fields: value.fields,
      evidence_ref: record.evidenceRef,
      provenance: {
        provider_id: context.provider.id,
        adapter_key: this.key,
        adapter_version: this.version,
        parser_version: context.provider.parserVersion,
      },
    };
  }
}

export class GoogleNewsRssAdapter extends SourceAdapter {
  readonly key = "google_news_search";
  readonly accessMode = "public_rss" as const;
  readonly version = "google-news-rss-adapter-v1";
  constructor(private readonly fetcher: typeof fetch = fetch) {
    super();
  }
  private url(target: string, query: string) {
    if (
      target !==
      "https://news.google.com/rss/search?q={urlEncodedQuery}&hl=en-US&gl=US&ceid=US:en"
    )
      throw new ProviderAdapterFailure("source_configuration_invalid", false);
    return target.replace(
      "{urlEncodedQuery}",
      encodeURIComponent(text(query, "query", 200)),
    );
  }
  async collect(request: ProviderCollectRequest, signal: AbortSignal) {
    const query = (
        request as ProviderCollectRequest & { target?: Record<string, unknown> }
      ).target?.query,
      url = this.url(request.provider.targetUrl, query as string),
      response = await this.fetcher(url, {
        signal,
        redirect: "error",
        headers: {
          accept: "application/rss+xml, application/xml;q=0.9",
          "user-agent": "ScoutOps/0.1 source-admission",
        },
      });
    if (response.status === 429)
      throw new ProviderAdapterFailure("rate_limited", true);
    if (response.status >= 500)
      throw new ProviderAdapterFailure("network_error", true);
    if (!response.ok)
      throw new ProviderAdapterFailure("permission_denied", false);
    const type = response.headers.get("content-type") ?? "";
    if (!/(xml|rss)/i.test(type))
      throw new ProviderAdapterFailure("source_changed", false);
    const xml = await response.text(),
      records = parseGoogleNewsRss(xml, Math.min(request.limit, 20));
    return { records, nextCursor: null };
  }
  async healthCheck(
    context: AdapterHealthContext,
    signal: AbortSignal,
  ): Promise<AdapterHealthSignal> {
    const started = Date.now(),
      url = this.url(context.provider.targetUrl, "product");
    try {
      const response = await this.fetcher(url, {
        signal,
        redirect: "error",
        headers: {
          accept: "application/rss+xml, application/xml;q=0.9",
          "user-agent": "ScoutOps/0.1 source-health",
        },
      });
      if (response.status === 429)
        return {
          status: "degraded",
          latencyMs: Date.now() - started,
          errorCode: "rate_limited",
          message: "Google News RSS 返回限流。",
        };
      if (!response.ok)
        return {
          status: "degraded",
          latencyMs: Date.now() - started,
          errorCode: "network_error",
          message: `Google News RSS 返回 HTTP ${response.status}。`,
        };
      const sample = await response.text();
      parseGoogleNewsRss(sample, 1);
      return {
        status: "ready",
        latencyMs: Date.now() - started,
        errorCode: null,
        message: "Google News RSS XML 合同可读取；生产启用仍需所有者政策复核。",
      };
    } catch (error) {
      if (error instanceof ProviderAdapterFailure) throw error;
      throw new ProviderAdapterFailure("network_error", true);
    }
  }
}
export class FixedGoogleNewsRssAdapter extends SourceAdapter {
  readonly accessMode = "public_rss" as const;
  readonly version = "google-news-fixed-rss-adapter-v1";
  constructor(
    readonly key: string,
    private readonly configuredUrl: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    super();
  }
  private url(target: string) {
    if (target !== this.configuredUrl)
      throw new ProviderAdapterFailure("source_configuration_invalid", false);
    const url = new URL(target);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "news.google.com" ||
      url.username ||
      url.password ||
      url.hash
    )
      throw new ProviderAdapterFailure("source_configuration_invalid", false);
    return url.toString();
  }
  async collect(request: ProviderCollectRequest, signal: AbortSignal) {
    const response = await this.fetcher(this.url(request.provider.targetUrl), {
      signal,
      redirect: "error",
      headers: {
        accept: "application/rss+xml, application/xml;q=0.9",
        "user-agent": "ScoutOps/1.0 automatic-hotspot-collector",
      },
    });
    if (response.status === 429)
      throw new ProviderAdapterFailure("rate_limited", true);
    if (response.status >= 500)
      throw new ProviderAdapterFailure("network_error", true);
    if (!response.ok)
      throw new ProviderAdapterFailure("permission_denied", false);
    const type = response.headers.get("content-type") ?? "";
    if (!/(xml|rss)/i.test(type))
      throw new ProviderAdapterFailure("source_changed", false);
    return {
      records: parseGoogleNewsRss(
        await response.text(),
        Math.min(request.limit, 20),
      ),
      nextCursor: null,
    };
  }
  async healthCheck(
    context: AdapterHealthContext,
    signal: AbortSignal,
  ): Promise<AdapterHealthSignal> {
    const started = Date.now();
    try {
      const response = await this.fetcher(
        this.url(context.provider.targetUrl),
        {
          signal,
          redirect: "error",
          headers: {
            accept: "application/rss+xml, application/xml;q=0.9",
            "user-agent": "ScoutOps/1.0 source-health",
          },
        },
      );
      if (!response.ok)
        return {
          status: "degraded",
          latencyMs: Date.now() - started,
          errorCode: response.status === 429 ? "rate_limited" : "network_error",
          message: `热点 RSS 返回 HTTP ${response.status}。`,
        };
      parseGoogleNewsRss(await response.text(), 1);
      return {
        status: "ready",
        latencyMs: Date.now() - started,
        errorCode: null,
        message: "公开热点 RSS 可读取。",
      };
    } catch (error) {
      if (error instanceof ProviderAdapterFailure) throw error;
      throw new ProviderAdapterFailure("network_error", true);
    }
  }
}
export class FixedSyndicationFeedAdapter extends SourceAdapter {
  readonly accessMode = "public_rss" as const;
  readonly version = "syndication-feed-adapter-v1";
  constructor(
    readonly key: string,
    private readonly configuredUrl: string,
    private readonly sourceName: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    super();
  }
  private url(target: string) {
    if (target !== this.configuredUrl)
      throw new ProviderAdapterFailure("source_configuration_invalid", false);
    const url = new URL(target);
    if (url.protocol !== "https:" || url.username || url.password || url.hash)
      throw new ProviderAdapterFailure("source_configuration_invalid", false);
    return url.toString();
  }
  private async response(target: string, signal: AbortSignal) {
    const response = await this.fetcher(this.url(target), {
      signal,
      redirect: "follow",
      headers: {
        accept:
          "application/rss+xml, application/atom+xml, application/xml;q=0.9",
        "user-agent": "ScoutOps/1.0 automatic-hotspot-collector",
      },
    });
    if (response.status === 429)
      throw new ProviderAdapterFailure("rate_limited", true);
    if (response.status >= 500)
      throw new ProviderAdapterFailure("network_error", true);
    if (!response.ok)
      throw new ProviderAdapterFailure("permission_denied", false);
    return response;
  }
  async collect(request: ProviderCollectRequest, signal: AbortSignal) {
    const response = await this.response(request.provider.targetUrl, signal);
    return {
      records: parseSyndicationFeed(
        await response.text(),
        this.sourceName,
        Math.min(request.limit, 20),
      ),
      nextCursor: null,
    };
  }
  async healthCheck(
    context: AdapterHealthContext,
    signal: AbortSignal,
  ): Promise<AdapterHealthSignal> {
    const started = Date.now();
    try {
      const response = await this.response(context.provider.targetUrl, signal);
      parseSyndicationFeed(await response.text(), this.sourceName, 1);
      return {
        status: "ready",
        latencyMs: Date.now() - started,
        errorCode: null,
        message: "公开 RSS/Atom 频道可读取。",
      };
    } catch (error) {
      if (error instanceof ProviderAdapterFailure) throw error;
      throw new ProviderAdapterFailure("network_error", true);
    }
  }
}
export class FixedStructuredPublicPageAdapter extends SourceAdapter {
  readonly accessMode = "public_page" as const;
  readonly version = "structured-public-page-adapter-v1";
  constructor(
    readonly key: string,
    private readonly configuredUrl: string,
    private readonly sourceName: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    super();
  }
  private url(target: string) {
    if (target !== this.configuredUrl)
      throw new ProviderAdapterFailure("source_configuration_invalid", false);
    const url = new URL(target);
    if (url.protocol !== "https:" || url.username || url.password || url.hash)
      throw new ProviderAdapterFailure("source_configuration_invalid", false);
    return url.toString();
  }
  private async response(target: string, signal: AbortSignal) {
    const response = await this.fetcher(this.url(target), {
      signal,
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 (compatible; ScoutOpsCatalogCrawler/1.0)",
      },
    });
    if (response.status === 429)
      throw new ProviderAdapterFailure("rate_limited", true);
    if (response.status >= 500)
      throw new ProviderAdapterFailure("network_error", true);
    if (!response.ok)
      throw new ProviderAdapterFailure("permission_denied", false);
    const type = response.headers.get("content-type") ?? "";
    if (!/html/i.test(type))
      throw new ProviderAdapterFailure("source_changed", false);
    return response;
  }
  async collect(request: ProviderCollectRequest, signal: AbortSignal) {
    const response = await this.response(request.provider.targetUrl, signal);
    return {
      records: parseStructuredCatalogPage(
        await response.text(),
        this.configuredUrl,
        this.sourceName,
        Math.min(request.limit, 20),
      ),
      nextCursor: null,
    };
  }
  async healthCheck(
    context: AdapterHealthContext,
    signal: AbortSignal,
  ): Promise<AdapterHealthSignal> {
    const started = Date.now();
    try {
      const response = await this.response(context.provider.targetUrl, signal);
      parseStructuredCatalogPage(
        await response.text(),
        this.configuredUrl,
        this.sourceName,
        1,
      );
      return {
        status: "ready",
        latencyMs: Date.now() - started,
        errorCode: null,
        message: "公开平台榜单页面可读取并解析。",
      };
    } catch (error) {
      if (error instanceof ProviderAdapterFailure)
        return {
          status: "degraded",
          latencyMs: Date.now() - started,
          errorCode: error.message,
          message: "公开榜单页面暂不可解析。",
        };
      throw new ProviderAdapterFailure("network_error", true);
    }
  }
}
export class ManualProductSupplyCsvAdapter extends SourceAdapter {
  readonly key = "manual_product_supply_csv";
  readonly accessMode = "import" as const;
  readonly version = "manual-product-supply-csv-adapter-v1";
  async collect(request: ProviderCollectRequest) {
    if (request.provider.targetUrl !== "inline://product-supply-csv-v1")
      throw new ProviderAdapterFailure("source_configuration_invalid", false);
    const csv = (
      request as ProviderCollectRequest & { target?: Record<string, unknown> }
    ).target?.csv_text;
    return {
      records: parseProductSupplyCsv(
        csv as string,
        Math.min(request.limit, 20),
      ),
      nextCursor: null,
    };
  }
  async healthCheck() {
    return {
      status: "ready" as const,
      latencyMs: 0,
      errorCode: null,
      message: "CSV Parser 合同已就绪；仅处理显式导入内容。",
    };
  }
}
const normalizeUnquotedHrefFetcher =
  (fetcher: typeof fetch): typeof fetch =>
  async (input, init) => {
    const response = await fetcher(input, init);
    if (!response.ok) return response;
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (new URL(url).hostname !== "www.ebay.com") return response;
    const html = (await response.text()).replace(
      /\shref=([^\s"'=<>`]+)/gi,
      ' href="$1"',
    );
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
export function createBuiltinSourceAdapters(fetcher: typeof fetch = fetch) {
  return [
    new GoogleNewsRssAdapter(fetcher),
    ...BUILTIN_PROVIDER_SOURCES.filter(
      (item) => item.availability === "automatic",
    ).map((item) =>
      item.parser_version === "syndication-feed-v1"
        ? new FixedSyndicationFeedAdapter(
            item.code,
            item.target_url,
            item.name,
            fetcher,
          )
        : item.parser_version === "structured-public-page-v1"
          ? new FixedStructuredPublicPageAdapter(
              item.code,
              item.target_url,
              item.name,
              item.code === "page_ebay_deals_us"
                ? normalizeUnquotedHrefFetcher(fetcher)
                : fetcher,
            )
          : new FixedGoogleNewsRssAdapter(item.code, item.target_url, fetcher),
    ),
    new ManualProductSupplyCsvAdapter(),
  ];
}
export function sourceEvidencePayload(record: ProviderRawRecord) {
  return payload(record);
}
