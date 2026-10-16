export const AMAZON_PUBLIC_PRODUCT_PARSER_VERSION = "amazon-public-product-v4";
export function amazonPublicSignalPaths(detail: boolean) {
  const badge = detail
    ? "amazon.html.centerCol.span#social-proofing-faceout-title-tk_bought"
    : "amazon.html.search_result.span.a-color-secondary.sales_badge";
  return {
    review_samples_json: "amazon.html.ul#localTopReviewsList.div[data-hook=review]",
    sales_badge_text: badge,
    sales_badge_quantity_lower_bound: badge,
    sales_badge_period: badge,
    sponsored: "amazon.html.search_result.span.puis-sponsored-label-text",
    best_seller_rank: "amazon.html.product_details.tr[Best Sellers Rank].li[0]",
    best_seller_rank_text: "amazon.html.product_details.tr[Best Sellers Rank].li[0]",
  };
}

const plain = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const count = (value: string) => {
  if (!/^(?:[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)$/.test(value)) return null;
  const number = Number(value.replace(/,/g, ""));
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

/** Extract one div, stopping at its own closing tag, never at the next product. */
function tagContent(
  html: string,
  contentStart: number,
  tag: "div" | "span" | "ul" | "h5" | "i" | "a",
) {
  const tags =
    /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?(?:div|span|ul|h5|i|a)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
  const relevant = new RegExp(`^<\\/?${tag}\\b`, "i");
  tags.lastIndex = contentStart;
  let depth = 1,
    match: RegExpExecArray | null;
  while ((match = tags.exec(html))) {
    if (!relevant.test(match[0])) continue;
    depth += /^<\//.test(match[0]) ? -1 : 1;
    if (!depth) return html.slice(contentStart, match.index);
  }
  return null;
}
export const amazonTagContent = tagContent;

export const amazonDivContent = (html: string, contentStart: number) =>
  tagContent(html, contentStart, "div");

export function amazonPrimaryColumn(html: string) {
  const opening = /<div\b(?=[^>]*\bid=["']centerCol["'])[^>]*>/i.exec(html);
  return opening ? amazonDivContent(html, opening.index + opening[0].length) : null;
}

/** Only observed, product-scoped labels; missing labels remain unknown. */
export function amazonPublicSignalFields(html: string, detail: boolean) {
  const fields: Record<string, string | number | null> = {
    sales_badge_text: null,
    sales_badge_quantity_lower_bound: null,
    sales_badge_period: null,
    sponsored: null,
    best_seller_rank: null,
    best_seller_rank_text: null,
  };
  const spans = [...html.matchAll(/<span\b([^>]*)>([^<]*)<\/span>/gi)];
  const detailOpening = detail
    ? /<span\b(?=[^>]*\bid=["']social-proofing-faceout-title-tk_bought["'])[^>]*>/i.exec(html)
    : null;
  const sale = !detail
    ? spans.find(
        (span) =>
          /\bclass=["'][^"']*\ba-color-secondary\b[^"']*["']/i.test(span[1]!) &&
          /bought in past (month|week)/i.test(span[2]!),
      )
    : null;
  const badge = detailOpening
    ? plain(tagContent(html, detailOpening.index + detailOpening[0].length, "span") ?? "")
    : sale
      ? plain(sale[2]!)
      : "";
  const parsed = /^([1-9][\d,]*)(K)?\+ bought in past (month|week)$/i.exec(badge);
  const quantity = parsed ? count(parsed[1]!) : null;
  const lowerBound = quantity == null ? null : quantity * (parsed?.[2] ? 1000 : 1);
  if (lowerBound != null && Number.isSafeInteger(lowerBound)) {
    fields.sales_badge_text = badge;
    fields.sales_badge_quantity_lower_bound = lowerBound;
    fields.sales_badge_period = parsed![3]!.toLowerCase() === "month" ? "past_month" : "past_week";
  }
  if (
    !detail &&
    /<span\b[^>]*class=["'][^"']*\bpuis-sponsored-label-text\b[^"']*["'][^>]*>\s*(?:<span\b[^>]*>\s*)?Sponsored\s*<\/span>/i.test(
      html,
    )
  )
    fields.sponsored = 1;
  return fields;
}

export function amazonBestSellerRankFields(html: string) {
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const heading = row[1]!.match(/<th\b[^>]*>([\s\S]*?)<\/th>/i)?.[1];
    if (!heading || plain(heading) !== "Best Sellers Rank") continue;
    const first = row[1]!.match(/<li\b[^>]*>([\s\S]*?)<\/li>/i)?.[1];
    const label = first ? plain(first) : "";
    const rankText = /^#([\d,]+) in .+/.exec(label)?.[1];
    const rank = rankText ? count(rankText) : null;
    if (rank)
      return {
        best_seller_rank: rank,
        best_seller_rank_text: label.slice(0, 500),
        rank_html: row[0],
      };
  }
  return { best_seller_rank: null, best_seller_rank_text: null, rank_html: "" };
}
