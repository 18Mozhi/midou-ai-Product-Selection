export type PrimaryObservation<T> = {
  value: T;
  observedAt: unknown;
  price: unknown;
  currency: unknown;
};
const time = (value: unknown) =>
  value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : NaN;

/** Preserve real newer quotes, but discovery blanks cannot erase an actual detail observation. */
export function selectPrimaryObservation<T>(
  discovery?: PrimaryObservation<T>,
  detail?: PrimaryObservation<T>,
): T | undefined {
  if (!detail) return discovery?.value;
  if (!discovery) return detail.value;
  const quote =
    typeof discovery.price === "number" &&
    Number.isFinite(discovery.price) &&
    discovery.price >= 0 &&
    typeof discovery.currency === "string" &&
    /^[A-Z]{3}$/.test(discovery.currency);
  return quote && time(discovery.observedAt) > time(detail.observedAt)
    ? discovery.value
    : detail.value;
}
