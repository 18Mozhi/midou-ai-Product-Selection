export interface AmazonPublicReviewSample {
  review_id: string;
  title: string;
  text: string;
  rating: number | null;
  date_text: string | null;
  variation_text: string | null;
  verified_purchase: true | null;
  helpful_votes: number | null;
}

export interface AmazonPublicSignals {
  sales_badge: {
    text: string;
    quantity_lower_bound: number;
    period: "past_month" | "past_week";
  } | null;
  /** A missing public badge never proves that advertising is absent. */
  sponsored: true | null;
  best_seller_rank: { rank: number; text: string } | null;
  /** Product-page excerpts may cover multiple variations; not an exhaustive review dataset. */
  review_samples?: AmazonPublicReviewSample[];
}
