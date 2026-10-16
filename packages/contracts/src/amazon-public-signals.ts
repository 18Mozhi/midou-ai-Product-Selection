export interface AmazonPublicSignals {
  sales_badge: {
    text: string;
    quantity_lower_bound: number;
    period: "past_month" | "past_week";
  } | null;
  /** A missing public badge never proves that advertising is absent. */
  sponsored: true | null;
  best_seller_rank: { rank: number; text: string } | null;
}
