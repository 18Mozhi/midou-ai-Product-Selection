export type OpportunityWorkspaceState =
  "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";

export type OpportunityPartialLoadState = "loading" | "ready" | "error";

export interface OpportunityCompetitorSummary {
  id: string;
  opportunity_id: string | null;
  market: string;
  source_site: string;
  external_id: string;
  title: string;
  snapshot_count: number;
  latest_snapshot: null | {
    current_price: number | null;
    currency: string | null;
    review_count: number | null;
    rating_value: number | null;
    captured_at: string;
    freshness: string;
  };
}

export type OpportunityTab =
  | "overview"
  | "lineage"
  | "feedback"
  | "market"
  | "competition"
  | "profit"
  | "risk"
  | "ai"
  | "evidence"
  | "decisions";

export interface OpportunitySummary {
  id: string;
  name: string;
  image_url: string | null;
  market: string;
  category: string | null;
  source_type: "manual" | "trend_topic";
  source_ref_id: string | null;
  owner_id: string | null;
  lifecycle_status: string;
  lifecycle_entered_at: string;
  lifecycle_dwell_seconds: number;
  recommendation_status: string;
  overall_score: number | null;
  trend_score: number | null;
  competition_score: number | null;
  profit_status: string;
  risk_level: string;
  confidence: { status: string; score: number | null };
  evidence_count: number;
  source_count: number;
  competitor_count: number;
  supplier_candidate_count: number;
  matched_rule_count: number;
  selection_stage: "rule_candidate" | "recommended" | "not_eligible";
  quality_gates: {
    score: boolean;
    market: boolean;
    competition: boolean;
    cost: boolean;
    risk: boolean;
    all_passed: boolean;
  };
  coverage_status: string;
  blocking_reasons: Array<"evidence_insufficient" | "recommendation_insufficient">;
  decision_status: string;
  version: number;
  updated_at: string;
}

export interface OpportunityDetail extends OpportunitySummary {
  operating_feedback: {
    facts: Array<{
      id: string;
      period_start: string;
      period_end: string;
      sales_units: number;
      revenue_amount: number;
      ad_spend_amount: number;
      returned_units: number;
      purchase_lead_time_days: number;
      actual_profit_amount: number;
      currency: string;
      source_ref: string;
      notes: string | null;
      score_rule_version_snapshot: string | null;
      profit_rule_version_snapshot: string | null;
      decision_status_snapshot: string;
      predicted_profit_amount: number | null;
      predicted_currency: string | null;
      quoted_lead_time_days: number | null;
      observed_at: string;
      request_id: string;
      trace_id: string;
      created_at: string;
    }>;
    calibration: null | {
      fact_id: string;
      return_rate_percent: number | null;
      ad_spend_ratio_percent: number | null;
      profit_variance_amount: number | null;
      profit_variance_currency: string | null;
      lead_time_variance_days: number | null;
      score_rule_version: string | null;
      profit_rule_version: string | null;
      decision_status_snapshot: string;
      human_review_required: true;
      automatic_rule_update: false;
      automatic_decision: false;
    };
  };
  lineage: {
    freshness: { observed_at: string | null; age_seconds: number | null };
    failure_impact: {
      level: "none" | "degraded" | "blocked";
      codes: string[];
      affected_stages: string[];
    };
    request_ids: string[];
    trace_ids: string[];
    nodes: Array<{
      kind: string;
      id: string;
      label: string;
      status: string;
      occurred_at: string;
      request_id: string | null;
      trace_id: string | null;
      route: string;
    }>;
  };
  adoption_blockers: Array<{
    code: "evidence_insufficient" | "recommendation_insufficient";
    status: "blocked" | "in_progress" | "cleared";
    progress_percent: number | null;
    next_action: string;
    task_id: string | null;
    task_status: string | null;
    score_job_status: string | null;
  }>;
  redecision_ready: boolean;
  score_rule_version: string | null;
  scored_at: string | null;
  latest_score_run: null | {
    id: string;
    status: string;
    coverage_percent: number;
    confidence_score: number | null;
    recommendation_status: string;
    missing_fields: string[];
    scored_at: string;
  };
  score_components: Array<{
    dimension_code: string;
    weight_percent: number;
    input_score: number | null;
    weighted_score: number | null;
    evidence_ids: string[];
    missing_fields: string[];
  }>;
  evidence: Array<{
    id: string;
    title: string;
    publisher: string;
    canonical_url: string;
    observed_at: string;
  }>;
  decisions: Array<{
    id: string;
    action: string;
    reason: string;
    actor_id: string;
    created_at: string;
    opportunity_version: number;
  }>;
  section_status: {
    market: string;
    competition: string;
    profit: string;
    risk: string;
    execution: string;
  };
}

export interface OpportunityProfitAnalysis {
  latest_run: null | {
    id: string;
    status: "calculated" | "insufficient_data";
    rule_version_code: string;
    platform: string;
    market: string;
    currency: string | null;
    sale_price: number | null;
    total_cost: number | null;
    net_profit: number | null;
    net_margin_percent: number | null;
    missing_fields: string[];
    calculated_at: string;
    components: Array<{
      component_type: string;
      source_amount: number | null;
      source_currency: string | null;
      converted_amount: number | null;
      target_currency: string | null;
      source_ref_id: string | null;
      evidence_id: string | null;
      exchange_quote_id: string | null;
      missing_reason: string | null;
    }>;
  };
  current_inputs: Array<{
    input_type: "sale_price" | "purchase_price" | "logistics";
    amount_value: number;
    currency: string;
    source_type: string;
    source_ref_id: string;
    evidence_id: string;
    observed_at: string;
    input_version: number;
    platform: string;
    confirmation_mode: "human_review" | "automatic_evidence";
  }>;
  cost_input_reviews: Array<{
    id: string;
    cost_input_id: string;
    input_type: "sale_price" | "purchase_price" | "logistics";
    amount_value: number;
    currency: string;
    platform: string;
    source_type: string;
    source_ref_id: string;
    evidence_id: string;
    observed_at: string;
    input_version: number;
    submitter_id: string;
    submitter_label: string;
    reviewer_id: string;
    reviewer_label: string;
    status: "pending" | "approved" | "rejected";
    due_at: string;
    overdue: boolean;
    decision_reason: string | null;
    reviewed_at: string | null;
    version: number;
    created_at: string;
    can_review: boolean;
  }>;
}
