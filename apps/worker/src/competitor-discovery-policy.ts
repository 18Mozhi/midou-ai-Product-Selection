import { MINIMUM_SELECTION_COMPETITORS, MAXIMUM_SELECTION_COMPETITORS } from "@scoutops/contracts";
export const COMPETITOR_DISCOVERY_MINIMUM = MINIMUM_SELECTION_COMPETITORS;
export const COMPETITOR_DISCOVERY_MAXIMUM = MAXIMUM_SELECTION_COMPETITORS;

export function amazonAsin(fields: Record<string, unknown>, canonicalUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(canonicalUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "www.amazon.com") return null;
  const fromUrl = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i
    .exec(url.pathname)?.[1]
    ?.toUpperCase();
  const fromFields = typeof fields.asin === "string" ? fields.asin.toUpperCase() : null;
  if (!fromUrl || (fromFields && fromFields !== fromUrl)) return null;
  return fromUrl;
}

/** Deduplicate product identity, not snapshot IDs; the primary product is never its own competitor. */
export function selectIndependentCompetitors<T>(
  records: T[],
  facts: (record: T) => { fields: Record<string, unknown>; canonicalUrl: string },
  primaryAsin: string | null,
  limit = COMPETITOR_DISCOVERY_MAXIMUM,
): T[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20)
    throw new Error("competitor_limit_invalid");
  const seen = new Set<string>(primaryAsin ? [primaryAsin.toUpperCase()] : []);
  const result: T[] = [];
  for (const record of records) {
    const { fields, canonicalUrl } = facts(record);
    const asin = amazonAsin(fields, canonicalUrl);
    if (!asin || seen.has(asin) || typeof fields.title !== "string" || !fields.title.trim())
      continue;
    seen.add(asin);
    result.push(record);
    if (result.length === limit) break;
  }
  return result;
}
