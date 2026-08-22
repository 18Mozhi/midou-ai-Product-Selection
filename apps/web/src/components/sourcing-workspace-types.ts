export type SourcingState =
  "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";

export interface SourcingCandidate {
  id: string;
  supplier_name: string;
  product_title: string;
  specification: string | null;
  moq: number | null;
  quoted_price: number;
  currency: string;
  lead_time_days: number | null;
  location: string | null;
  original_url: string;
  observed_at: string;
  evidence_id: string;
  confidence_value: number | null;
  status: string;
  missing_fields: string[];
  quote: {
    id: string;
    version: number;
    stability_status: string;
    risk_level: string;
    observed_at: string;
    evidence_id: string;
  } | null;
}

export interface SourcingSearch {
  id: string;
  input_type: string;
  input_ref: string;
  display_name?: string;
  status: string;
  candidate_count: number;
  missing_fields: string[];
  created_at: string;
  updated_at: string;
  candidates?: SourcingCandidate[];
  erp_reference?: {
    normalized_record_id: string;
    evidence_id: string;
    title: string;
    image_url: string | null;
    supplier_code: string | null;
    cost_cny: number | null;
    cost_usd: number | null;
    source_url: string;
    observed_at: string;
  } | null;
  collection_task_id?: string;
  collection_progress?: {
    status: string;
    total_subqueries: number;
    successful_subqueries: number;
    failed_subqueries: number;
    blocked_subqueries: number;
    active_subqueries: number;
    available_at: string;
  } | null;
}

export interface SourcingComparisonQuote {
  id: string;
  supplier_name: string;
  product_title: string;
  specification: string;
  moq: number;
  quoted_price: number;
  currency: string;
  lead_time_days: number;
  location: string;
  confidence_value: number;
  stability_status: string;
  risk_level: string;
  evidence_id: string;
}

export interface SourcingComparison {
  id: string;
  name: string;
  quotes: SourcingComparisonQuote[];
  created_at: string;
}
