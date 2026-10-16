/** The user's selection workflow requires one primary product plus 5–10 independent competitors. */
export const MINIMUM_SELECTION_COMPETITORS = 5;
export const MAXIMUM_SELECTION_COMPETITORS = 10;
import type { AmazonPublicSignals } from "./amazon-public-signals.js";

/** Lightweight original-primary facts; no review bodies or private advertising estimates. */
export interface SelectionPrimaryProductFacts {
  price: number | null;
  currency: string | null;
  rating_value: number | null;
  review_count: number | null;
  captured_at: string;
  public_signals: AmazonPublicSignals | null;
}
