/** Keep each iPhone generation attached to its suffix; title prices have no SKU attributes. */
const devices = (title: string) => {
  const text = title.normalize("NFKC").toLowerCase();
  const found = new Set<string>();
  for (const match of text.matchAll(
    /(?<![a-z0-9])(?:iphone[\s-]*)?(1[1-8])(?:[\s-]*(pro[\s-]*max|pro|plus|mini|max|air))?(?![a-z0-9])/g,
  )) {
    // A separated alternative suffix does not identify a single quoted configuration.
    if (
      /^\s*[/|、]\s*(?:pro|max|plus|mini|air)\b/i.test(text.slice(match.index! + match[0].length))
    )
      return null;
    found.add(`${match[1]}:${(match[2] ?? "base").replace(/[\s-]+/g, "")}`);
  }
  return found.size ? found : null;
};

/** Multi-device declarations must agree too: a listing-level price cannot select a hidden SKU. */
export const iphoneCaseDeviceFit = (productTitle: string, supplyTitle: string) => {
  const product = devices(productTitle),
    supply = devices(supplyTitle);
  return Boolean(
    product &&
    supply &&
    product.size === supply.size &&
    [...product].every((item) => supply.has(item)),
  );
};
