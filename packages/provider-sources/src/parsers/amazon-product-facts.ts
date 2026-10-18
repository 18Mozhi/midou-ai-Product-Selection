import { amazonDivContent, amazonTagContent } from "./amazon-public-signals.js";

const unescape = (value: string) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
const attribute = (tag: string, name: string) => {
  // Consume each complete quoted value before looking for the next name. Text
  // inside an onload/data attribute is never another HTML attribute.
  for (const match of tag.matchAll(/\s([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
    if (match[1]!.toLowerCase() === name.toLowerCase()) return match[2] ?? match[3];
  return undefined;
};
const visibleMarkup = (html: string) =>
  html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, (value) =>
    " ".repeat(value.length),
  );

/** A missing amount must never become Number("") = 0. */
export function amazonMoney(value: string | undefined) {
  if (!value) return null;
  const amount =
    /^(?:(?:[A-Z]{3})\s*|[$€£]\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)\s*(?:[A-Z]{3})?$/.exec(
      value.replace(/&nbsp;|&#160;/g, " ").trim(),
    )?.[1];
  if (!amount) return null;
  const parsed = Number(amount.replaceAll(",", ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function amazonImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(unescape(value));
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      ["m.media-amazon.com", "images-na.ssl-images-amazon.com"].includes(url.hostname) &&
      url.pathname.startsWith("/images/I/")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function amazonSearchImage(html: string) {
  const tag = visibleMarkup(html).match(/<img\b(?=[^>]*\bclass=["'][^"']*\bs-image\b)[^>]*>/i)?.[0];
  return tag ? amazonImageUrl(attribute(tag, "src") ?? attribute(tag, "data-src")) : null;
}

function block(html: string, id: string) {
  const opening = new RegExp(`<div\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`, "i").exec(
    visibleMarkup(html),
  );
  if (!opening) return null;
  const body = amazonDivContent(html, opening.index + opening[0].length);
  return body == null ? null : { opening: opening[0], body };
}

/** Only the primary offer and primary image column; recommendations are not fallback facts. */
export function amazonDetailFacts(html: string, primaryColumn: string | null, asin: string) {
  let priceText: string | undefined,
    priceHtml = "";
  for (const id of ["corePriceDisplay_desktop_feature_div", "corePrice_feature_div"]) {
    const primaryRegion = primaryColumn == null ? null : block(primaryColumn, id);
    const region = primaryRegion ?? block(html, id);
    if (!region) continue;
    const identity = attribute(region.opening, "data-csa-c-asin");
    if (!primaryRegion && identity?.toUpperCase() !== asin) continue;
    if (identity && identity.toUpperCase() !== asin) continue;
    for (const offer of visibleMarkup(region.body).matchAll(
      /<span\b[^>]*class=["']([^"']*\ba-price\b[^"']*)["'][^>]*>/gi,
    )) {
      if (/\ba-text-price\b/.test(offer[1]!)) continue;
      const content = amazonTagContent(region.body, offer.index! + offer[0].length, "span");
      const label = content?.match(
        /<span\b[^>]*class=["'][^"']*\ba-offscreen\b[^"']*["'][^>]*>([^<]*)<\/span>/i,
      )?.[1];
      if (amazonMoney(label) != null) {
        priceText = label;
        priceHtml = region.opening + region.body + "</div>";
        break;
      }
    }
    if (priceText) break;
  }
  const imageColumn = block(html, "leftCol");
  const imageTag =
    imageColumn &&
    [...visibleMarkup(imageColumn.body).matchAll(/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)]
      .map((match) => match[0])
      .find((tag) => attribute(tag, "id") === "landingImage");
  const imageUrl = imageTag
    ? (amazonImageUrl(attribute(imageTag, "data-old-hires")) ??
      amazonImageUrl(attribute(imageTag, "src")))
    : null;
  return { priceText, imageUrl, priceHtml, imageHtml: imageUrl ? imageColumn!.body : "" };
}
