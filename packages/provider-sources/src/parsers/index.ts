import { createHash } from "node:crypto";
import { ProviderAdapterFailure, type ProviderRawRecord } from "@scoutops/provider-adapters";

export interface SourceEvidencePayload {
  raw_content: string;
  content_type: string;
  canonical_url: string;
  fields: Record<string, string | number | null>;
  source_paths: Record<string, string>;
}
export const text = (value: unknown, name: string, max: number) => {
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
    .replace(/&#x([a-f0-9]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .trim();
const tag = (xml: string, name: string) => {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match?.[1] ? entity(match[1]) : "";
};
const stripHtml = (value: string) => entity(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
const httpUrl = (value: string) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ProviderAdapterFailure("source_url_invalid", false);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash)
    throw new ProviderAdapterFailure("source_url_invalid", false);
  return url.toString();
};
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

export function parseGoogleNewsRss(xml: string, limit = 20): ProviderRawRecord[] {
  if (
    typeof xml !== "string" ||
    Buffer.byteLength(xml) > 2_000_000 ||
    !/<rss\b/i.test(xml) ||
    !/<channel\b/i.test(xml)
  )
    throw new ProviderAdapterFailure("invalid_payload", false);
  const blocks = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(
    0,
    Math.min(100, limit),
  );
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
    const link = httpUrl(text(atom ? atomLink : tag(raw, "link"), "feed_link", 2048));
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
      stripHtml(tag(tag(raw, "author"), "name") || tag(raw, "source") || sourceName).slice(
        0,
        300,
      ) || sourceName;
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
        title: atom ? "atom.entry.title" : rdf ? "rdf.item.title" : "rss.item.title",
        summary: atom
          ? "atom.entry.summary"
          : rdf
            ? "rdf.item.description"
            : "rss.item.description",
        published_at: atom ? "atom.entry.published" : rdf ? "rdf.item.dc:date" : "rss.item.pubDate",
        source_url: atom ? "atom.entry.link@href" : rdf ? "rdf.item.link" : "rss.item.link",
        publisher: atom ? "atom.entry.author.name" : rdf ? "crawler.source" : "rss.item.source",
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
  [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
const walkJson = (value: unknown, visit: (item: Record<string, unknown>) => void) => {
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
  if (typeof html !== "string" || Buffer.byteLength(html) > 5_000_000 || !/<html\b/i.test(html))
    throw new ProviderAdapterFailure("invalid_payload", false);
  const observedAt = new Date().toISOString(),
    candidates: Array<{
      title: string;
      url: string;
      price: number | null;
      currency: string | null;
      position: number | null;
      imageUrl: string | null;
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
      const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]],
        isProduct = types.some((type) => ["Product", "ListItem"].includes(String(type)));
      if (!isProduct) return;
      const nested = (item.item && typeof item.item === "object" ? item.item : item) as Record<
          string,
          unknown
        >,
        title = String(nested.name ?? item.name ?? "").trim(),
        url = absoluteUrl(nested.url ?? item.url, pageUrl),
        offers = (
          nested.offers && typeof nested.offers === "object" ? nested.offers : {}
        ) as Record<string, unknown>,
        priceValue = Number(offers.price ?? offers.lowPrice),
        price = Number.isFinite(priceValue) && priceValue >= 0 ? priceValue : null,
        currency = offers.priceCurrency ? String(offers.priceCurrency).toUpperCase() : null,
        positionValue = Number(item.position),
        position = Number.isSafeInteger(positionValue) && positionValue > 0 ? positionValue : null,
        imageValue = Array.isArray(nested.image) ? nested.image[0] : nested.image,
        imageUrl =
          absoluteUrl(
            typeof imageValue === "object" && imageValue
              ? ((imageValue as Record<string, unknown>).url ??
                  (imageValue as Record<string, unknown>).contentUrl ??
                  (imageValue as Record<string, unknown>).thumbnailUrl)
              : imageValue,
            pageUrl,
          ) || null;
      if (title.length >= 2 && url)
        candidates.push({
          title: title.slice(0, 1000),
          url,
          price,
          currency,
          position,
          imageUrl,
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
      for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        const url = absoluteUrl(match[1], pageUrl),
          title = stripHtml(match[2] ?? "").trim();
        if (url && pattern.test(new URL(url).pathname) && title.length >= 3)
          candidates.push({
            title: title.slice(0, 1000),
            url,
            price: null,
            currency: null,
            position: candidates.length + 1,
            imageUrl:
              absoluteUrl(
                match[0].match(/<img\b[^>]*(?:src|data-src)=["']([^"']+)["']/i)?.[1],
                pageUrl,
              ) || null,
            raw: match[0],
            sourceKind: "html_anchor",
          });
        if (candidates.length >= limit) break;
      }
    }
  }
  const unique = [...new Map(candidates.map((item) => [item.url, item])).values()].slice(
    0,
    Math.min(100, limit),
  );
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
        image_url: item.imageUrl,
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
          currency: isJsonLd ? "jsonld.offers.priceCurrency" : "not_available",
          position: isJsonLd ? "jsonld.position" : "html.anchor.order",
          source_url: isJsonLd ? "jsonld.url" : "html.anchor.href",
          publisher: "crawler.source",
          observed_at: "crawler.observed_at",
          image_url: isJsonLd ? "jsonld.image" : "html.anchor.img",
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
export function parseProductSupplyCsv(csv: string, limit = 20): ProviderRawRecord[] {
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
  return rows.slice(1, Math.min(rows.length, limit + 1)).map((values, index) => {
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

export function sourceEvidencePayload(record: ProviderRawRecord) {
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

const money = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const countValue = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9]/g, ""));
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
};
const cleanUrl = (value: string, base: string) => {
  try {
    const url = new URL(entity(value), base);
    url.hash = "";
    url.search = "";
    return httpUrl(url.toString());
  } catch {
    return "";
  }
};

const amazonAsin = (...values: unknown[]) => {
  for (const value of values) {
    const match = String(value ?? "")
      .toUpperCase()
      .match(/(?:^|[:/])([A-Z0-9]{10})(?:[/?#]|$)/);
    if (match?.[1]) return match[1];
  }
  return null;
};
const amazonStructuredRecords = (html: string, pageUrl: string, limit: number) => {
  const observedAt = new Date().toISOString(),
    records: ProviderRawRecord[] = [],
    seen = new Set<string>();
  for (const block of jsonLdBlocks(html)) {
    let document: unknown;
    try {
      document = JSON.parse(entity(block));
    } catch {
      continue;
    }
    walkJson(document, (product) => {
      if (records.length >= Math.min(20, limit)) return;
      const types = Array.isArray(product["@type"]) ? product["@type"] : [product["@type"]],
        isProduct = types.some((type) => String(type).toLowerCase() === "product");
      if (!isProduct) return;
      const asin = amazonAsin(product.sku, product.productID, product.url, pageUrl);
      if (!asin || seen.has(asin)) return;
      const title = String(product.name ?? "").trim();
      if (!title) return;
      const offers = Array.isArray(product.offers) ? product.offers : [product.offers],
        offer = offers.find((value): value is Record<string, unknown> =>
          Boolean(value && typeof value === "object"),
        ),
        aggregateRating =
          product.aggregateRating && typeof product.aggregateRating === "object"
            ? (product.aggregateRating as Record<string, unknown>)
            : null,
        image = Array.isArray(product.image) ? product.image[0] : product.image,
        imageValue =
          image && typeof image === "object"
            ? ((image as Record<string, unknown>).url ??
              (image as Record<string, unknown>).contentUrl)
            : image,
        sourceUrl = `https://www.amazon.com/dp/${asin}`,
        price = money(String(offer?.price ?? offer?.lowPrice ?? "")),
        currencyValue = String(offer?.priceCurrency ?? "").toUpperCase(),
        rating = Number(aggregateRating?.ratingValue),
        reviews = countValue(
          String(aggregateRating?.reviewCount ?? aggregateRating?.ratingCount ?? ""),
        ),
        availabilityValue = String(offer?.availability ?? ""),
        fields = {
          asin,
          title: title.slice(0, 1000),
          price,
          currency: price != null && /^[A-Z]{3}$/.test(currencyValue) ? currencyValue : null,
          position: null,
          review_count: reviews,
          rating_value: Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : null,
          availability: availabilityValue
            ? (availabilityValue.split(/[\/#]/).filter(Boolean).at(-1)?.toLowerCase() ?? "unknown")
            : "unknown",
          image_url: absoluteUrl(imageValue, pageUrl) || null,
          source_url: sourceUrl,
          publisher: "Amazon",
          observed_at: observedAt,
        },
        payload: SourceEvidencePayload = {
          raw_content: JSON.stringify(product),
          content_type: "application/ld+json",
          canonical_url: sourceUrl,
          fields,
          source_paths: {
            asin: "amazon.jsonld.Product.sku_or_productID_or_url",
            title: "amazon.jsonld.Product.name",
            price: "amazon.jsonld.Product.offers.price_or_lowPrice",
            currency: "amazon.jsonld.Product.offers.priceCurrency",
            position: "amazon.jsonld.Product.position",
            review_count: "amazon.jsonld.Product.aggregateRating.reviewCount_or_ratingCount",
            rating_value: "amazon.jsonld.Product.aggregateRating.ratingValue",
            availability: "amazon.jsonld.Product.offers.availability",
            image_url: "amazon.jsonld.Product.image",
            source_url: "amazon.jsonld.Product.url_or_sku",
            publisher: "crawler.provider",
            observed_at: "crawler.observed_at",
          },
        };
      seen.add(asin);
      records.push({
        externalId: asin,
        observedAt,
        evidenceRef: `amazon-product:${asin}:${sha(sourceUrl)}`,
        payload,
      });
    });
  }
  return records;
};

export function parseAmazonProductPage(
  html: string,
  pageUrl: string,
  limit = 20,
): ProviderRawRecord[] {
  if (typeof html !== "string" || Buffer.byteLength(html) > 5_000_000 || !/<html\b/i.test(html))
    throw new ProviderAdapterFailure("invalid_payload", false);
  const structuredRecords = amazonStructuredRecords(html, pageUrl, limit);
  if (structuredRecords.length) return structuredRecords;
  const observedAt = new Date().toISOString(),
    resultBlockPattern = new RegExp(
      "<div\\b(?=[^>]*data-component-type=[\"']s-search-result[\"'])" +
        "(?=[^>]*data-asin=[\"']([A-Z0-9]{10})[\"'])[^>]*>" +
        "([\\s\\S]*?)(?=<div\\b(?=[^>]*data-component-type=[\"']s-search-result[\"'])|<\\/body>)",
      "gi",
    ),
    blocks = [...html.matchAll(resultBlockPattern)],
    directAsin = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i
      .exec(pageUrl)?.[1]
      ?.toUpperCase(),
    sourceBlocks = blocks.length
      ? blocks.map((match) => ({ asin: match[1]!, html: match[2]! }))
      : directAsin
        ? [{ asin: directAsin, html }]
        : [];
  const records: ProviderRawRecord[] = [];
  for (const [index, item] of sourceBlocks.entries()) {
    const title = stripHtml(
        item.html.match(/<(?:h1|h2)\b[^>]*>[\s\S]*?<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1] ??
          item.html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\//i)?.[1] ??
          "",
      ),
      href =
        item.html.match(
          new RegExp(`href=["']([^"']*\\/(?:dp|gp\\/product)\\/${item.asin}[^"']*)["']`, "i"),
        )?.[1] ?? `/dp/${item.asin}`,
      sourceUrl = cleanUrl(href, pageUrl),
      priceText =
        item.html.match(/class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)</i)?.[1] ??
        item.html.match(/class=["'][^"']*a-price-whole[^"']*["'][^>]*>([^<]+)/i)?.[1],
      ratingText =
        item.html.match(/([0-5](?:\.[0-9])?)\s+out of 5 stars/i)?.[1] ??
        item.html.match(/([0-5](?:\.[0-9])?)\s*\/\s*5/i)?.[1],
      reviewText =
        item.html.match(/aria-label=["']([0-9,.]+)\s+(?:ratings|reviews)["']/i)?.[1] ??
        item.html.match(/class=["'][^"']*s-underline-text[^"']*["'][^>]*>([0-9,.]+)</i)?.[1],
      imageUrl =
        absoluteUrl(
          item.html.match(
            /<img\b[^>]*class=["'][^"']*s-image[^"']*["'][^>]*(?:src|data-src)=["']([^"']+)/i,
          )?.[1] ??
            item.html.match(
              /id=["']landingImage["'][^>]*(?:src|data-old-hires)=["']([^"']+)/i,
            )?.[1],
          pageUrl,
        ) || null,
      price = money(priceText),
      rating = ratingText ? Number(ratingText) : null,
      reviews = countValue(reviewText);
    if (!title || !sourceUrl) continue;
    const fields = {
        asin: item.asin,
        title: title.slice(0, 1000),
        price,
        currency: price == null ? null : "USD",
        position: blocks.length ? index + 1 : null,
        review_count: reviews,
        rating_value:
          rating != null && Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating : null,
        availability: "unknown",
        image_url: imageUrl,
        source_url: sourceUrl,
        publisher: "Amazon",
        observed_at: observedAt,
      },
      payload: SourceEvidencePayload = {
        raw_content: item.html,
        content_type: "text/html",
        canonical_url: sourceUrl,
        fields,
        source_paths: Object.fromEntries(
          Object.keys(fields).map((key) => [key, `amazon.html.${key}`]),
        ),
      };
    records.push({
      externalId: item.asin,
      observedAt,
      evidenceRef: `amazon-product:${item.asin}:${sha(sourceUrl)}`,
      payload,
    });
    if (records.length >= Math.min(20, limit)) break;
  }
  if (!records.length) throw new ProviderAdapterFailure("source_changed", false);
  return records;
}

export function parseMadeInChinaSearchPage(
  html: string,
  pageUrl: string,
  limit = 20,
): ProviderRawRecord[] {
  if (typeof html !== "string" || Buffer.byteLength(html) > 5_000_000 || !/<html\b/i.test(html))
    throw new ProviderAdapterFailure("invalid_payload", false);
  const observedAt = new Date().toISOString(),
    links = [
      ...new Set(
        [...html.matchAll(/href=["'](https:\/\/[^"']+\.made-in-china\.com\/product\/[^"']+)["']/gi)]
          .map((match) => cleanUrl(match[1]!, pageUrl))
          .filter(Boolean),
      ),
    ],
    products: Record<string, unknown>[] = [];
  for (const block of jsonLdBlocks(html)) {
    try {
      walkJson(JSON.parse(entity(block)), (item) => {
        const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
        if (types.some((type) => String(type) === "Product")) products.push(item);
      });
    } catch (error) {
      void error;
    }
  }
  const records: ProviderRawRecord[] = [];
  for (const [index, item] of products.entries()) {
    const offers =
        item.offers && typeof item.offers === "object"
          ? (item.offers as Record<string, unknown>)
          : {},
      seller =
        offers.seller && typeof offers.seller === "object"
          ? (offers.seller as Record<string, unknown>)
          : {},
      title = String(item.name ?? "").trim(),
      supplier = String(seller.name ?? "").trim(),
      sourceUrl = links[index] ?? links.find((url) => url.includes("/product/")) ?? "",
      priceValue = Number(offers.lowPrice ?? offers.price),
      price = Number.isFinite(priceValue) && priceValue >= 0 ? priceValue : null,
      currency = offers.priceCurrency ? String(offers.priceCurrency).toUpperCase() : null,
      imageUrl = absoluteUrl(item.image, pageUrl) || null;
    if (!title || !supplier || !sourceUrl || price == null || !currency) continue;
    const fields = {
        title: title.slice(0, 1000),
        supplier_name: supplier.slice(0, 500),
        price,
        currency,
        moq: null,
        image_url: imageUrl,
        source_url: sourceUrl,
        publisher: "中国制造网",
        observed_at: observedAt,
      },
      payload: SourceEvidencePayload = {
        raw_content: JSON.stringify(item),
        content_type: "application/ld+json",
        canonical_url: sourceUrl,
        fields,
        source_paths: Object.fromEntries(
          Object.keys(fields).map((key) => [key, `jsonld.product.${key}`]),
        ),
      };
    records.push({
      externalId: sha(sourceUrl),
      observedAt,
      evidenceRef: `made-in-china-product:${sha(sourceUrl)}`,
      payload,
    });
    if (records.length >= Math.min(20, limit)) break;
  }
  if (!records.length) throw new ProviderAdapterFailure("source_changed", false);
  return records;
}

export function parseEc21SupplierSearchPage(
  html: string,
  pageUrl: string,
  limit = 20,
): ProviderRawRecord[] {
  if (typeof html !== "string" || Buffer.byteLength(html) > 5_000_000 || !/<html\b/i.test(html))
    throw new ProviderAdapterFailure("invalid_payload", false);
  const starts = [...html.matchAll(/<li\b[^>]*class=["'][^"']*galleryLs[^"']*["'][^>]*>/gi)].map(
      (match) => match.index ?? 0,
    ),
    observedAt = new Date().toISOString(),
    records: ProviderRawRecord[] = [];
  for (let index = 0; index < starts.length; index++) {
    const block = html.slice(
        starts[index]!,
        starts[index + 1] ?? Math.min(html.length, starts[index]! + 20000),
      ),
      link = block.match(
        /<h2\b[^>]*class=["'][^"']*pdtName[^"']*["'][^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
      ),
      sourceUrl = link?.[1] ? cleanUrl(link[1], pageUrl) : "",
      title = link?.[2] ? stripHtml(link[2]).trim() : "",
      currency =
        block
          .match(/itemprop=["']priceCurrency["'][^>]*content=["']([A-Za-z]{3})["']/i)?.[1]
          ?.toUpperCase() ?? null,
      priceText = block.match(/itemprop=["']price["'][^>]*>([^<]+)/i)?.[1],
      price = money(priceText),
      moqText = block.match(
        /<span\b[^>]*class=["'][^"']*pr5[^"']*["'][^>]*>([0-9,.]+)<\/span>\s*<span\b[^>]*class=["'][^"']*pr5[^"']*["'][^>]*>[^<]*<\/span>\s*\(Min\. Order\)/i,
      )?.[1],
      moq = countValue(moqText),
      supplier =
        block
          .match(
            /class=["'][^"']*pdtCompany[^"']*["'][\s\S]{0,1000}?<a\b[^>]*title=["']([^"']+)["']/i,
          )?.[1]
          ?.trim() ?? "",
      imageUrl =
        absoluteUrl(
          block.match(
            /<img\b[^>]*(?:src|data-src)=["']([^"']+)["'][^>]*itemprop=["']image["']/i,
          )?.[1],
          pageUrl,
        ) || null;
    if (
      !sourceUrl ||
      !/^https:\/\/www\.ec21\.com\/product-/i.test(sourceUrl) ||
      !title ||
      !supplier ||
      price == null ||
      !currency
    )
      continue;
    const fields = {
        title: title.slice(0, 1000),
        supplier_name: supplier.slice(0, 500),
        price,
        currency,
        moq,
        image_url: imageUrl,
        source_url: sourceUrl,
        publisher: "EC21",
        observed_at: observedAt,
      },
      payload: SourceEvidencePayload = {
        raw_content: block.slice(0, 20000),
        content_type: "text/html",
        canonical_url: sourceUrl,
        fields,
        source_paths: Object.fromEntries(
          Object.keys(fields).map((key) => [key, `ec21.html.${key}`]),
        ),
      };
    records.push({
      externalId: sha(sourceUrl),
      observedAt,
      evidenceRef: `ec21-product:${sha(sourceUrl)}`,
      payload,
    });
    if (records.length >= Math.min(20, limit)) break;
  }
  if (!records.length) throw new ProviderAdapterFailure("source_changed", false);
  return records;
}
