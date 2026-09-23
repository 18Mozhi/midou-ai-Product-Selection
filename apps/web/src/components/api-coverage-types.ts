export type ApiCoverageReportStatus = "current" | "missing" | "invalid" | "outdated";

export interface ApiCoverageEvidence {
  applicable: boolean;
  status: "passed" | "failed" | "not_run" | "not_applicable";
  test_id: string | null;
  latest_result: string | null;
}

export interface ApiCoverageOperation {
  operation_id: string;
  method: string;
  path: string;
  required_capability: string | null;
  expected_roles: string[];
  data_source: string;
  ui_consumers: string[];
  crawler_side_effect: string;
  verification_role: string | null;
  http_status: number | null;
  outcome: string;
  request_id: string | null;
  trace_id: string | null;
  evidence: Record<string, ApiCoverageEvidence>;
}

export interface ApiCoverageCount {
  key: string;
  count: number;
}

export interface ApiCoverageDashboardData {
  report_status: ApiCoverageReportStatus;
  catalog_fingerprint: string;
  captured_at: string | null;
  age_seconds: number | null;
  total_filtered: number;
  operations: ApiCoverageOperation[];
  by_outcome: ApiCoverageCount[];
  by_data_source: ApiCoverageCount[];
  by_ui_consumer: ApiCoverageCount[];
  by_crawler_side_effect: ApiCoverageCount[];
  evidence_dimensions: Array<{
    key: string;
    applicable: number;
    passed: number;
    failed: number;
    not_run: number;
    not_applicable: number;
    coverage_percent: number;
  }>;
  by_role: Array<{
    key: string;
    expected_allowed: number;
    verified: number;
    success: number;
    empty: number;
    blocked: number;
    unauthorized: number;
  }>;
  summary: {
    paths: number;
    operations: number;
    verified: number;
    coverage_percent: number;
    evidence_applicable: number;
    evidence_passed: number;
    evidence_coverage_percent: number;
    ui_consumed: number;
    crawler_side_effects: number;
  };
}
