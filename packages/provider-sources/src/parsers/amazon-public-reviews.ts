import { amazonTagContent } from "./amazon-public-signals.js";

const tagPattern = () =>
  /<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<(div|span|ul|h5|i|a)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
const attribute = (opening: string, name: string) =>
  new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(opening)?.[2] ?? null;
const plain = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

function field(card: string, hook: string) {
  for (const match of card.matchAll(tagPattern())) {
    if (!match[1] || attribute(match[0], "data-hook") !== hook) continue;
    const body = amazonTagContent(
      card,
      match.index! + match[0].length,
      match[1]!.toLowerCase() as Parameters<typeof amazonTagContent>[2],
    );
    return body == null ? null : plain(body);
  }
  return null;
}

/** Only the observed product-page local top-review list. Never an exhaustive or single-variant dataset. */
export function amazonPublicReviewFields(html: string) {
  const opening = [...html.matchAll(tagPattern())].find(
    (match) =>
      match[1]?.toLowerCase() === "ul" && attribute(match[0], "id") === "localTopReviewsList",
  );
  const root = opening ? amazonTagContent(html, opening.index! + opening[0].length, "ul") : null;
  if (root == null) return { review_samples_json: null, reviews_html: "" };
  const samples: Array<Record<string, string | number | null>> = [],
    seen = new Set<string>();
  const cards = tagPattern();
  let match: RegExpExecArray | null;
  while ((match = cards.exec(root)) && samples.length < 10) {
    if (match[1]?.toLowerCase() !== "div" || attribute(match[0], "data-hook") !== "review")
      continue;
    const id = attribute(match[0], "id"),
      start = match.index + match[0].length;
    const body = amazonTagContent(root, start, "div");
    if (body == null) continue;
    cards.lastIndex = start + body.length;
    if (!id || !/^R[A-Z0-9]{1,79}$/.test(id) || seen.has(id)) continue;
    const title = field(body, "reviewTitle"),
      content = field(body, "reviewRichContentContainer");
    if (!title || !content) continue;
    const stars = /^([1-5]) out of 5 stars$/.exec(field(body, "review-star-rating") ?? "");
    const helpful = field(body, "helpful-vote-statement");
    const helpfulCount =
      helpful === "One person found this helpful"
        ? 1
        : /^([1-9]\d*) people found this helpful$/.exec(helpful ?? "")?.[1];
    const votes = helpfulCount == null ? null : Number(helpfulCount);
    seen.add(id);
    samples.push({
      review_id: id,
      title: title.slice(0, 300),
      text: content.slice(0, 2000),
      rating: stars ? Number(stars[1]) : null,
      date_text: field(body, "review-date")?.slice(0, 200) || null,
      variation_text: field(body, "format-strip")?.slice(0, 200) || null,
      verified_purchase: field(body, "avp-badge") === "Verified Purchase" ? 1 : null,
      helpful_votes: votes != null && Number.isSafeInteger(votes) ? votes : null,
    });
  }
  return {
    review_samples_json: samples.length ? JSON.stringify(samples) : null,
    reviews_html: samples.length ? opening![0] + root + "</ul>" : "",
  };
}
