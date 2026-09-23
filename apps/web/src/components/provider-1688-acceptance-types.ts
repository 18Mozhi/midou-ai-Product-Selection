export interface AcceptanceSnapshot {
  provider_id: string;
  source_status: "draft" | "disabled" | "enabled";
  owner_label: string;
  overall: "setup_required" | "ready_for_enable" | "production_ready";
  gates: Array<{
    key: "login" | "captcha" | "parser";
    state: "passed" | "blocked" | "pending";
    evidence_at: string | null;
    reason: string;
  }>;
  latest_run: {
    status: string;
    error_code: string | null;
    started_at: string;
    finished_at: string | null;
  } | null;
  coverage_matrix: {
    parser_version: string;
    observed_at: string | null;
    rows: Array<{
      key: "search" | "detail" | "pagination";
      contract: string;
      state: "covered" | "not_observed" | "not_exercised" | "invalid";
      observed_count: number;
      reason: string;
    }>;
  };
  pending_reasons: string[];
}

export interface ScheduledAcceptanceRun {
  task_id: string;
  status: "scheduled";
}

export type AcceptanceViewState = "loading" | "ready" | "error" | "forbidden" | "expired";

export type AcceptanceRunOutcome = {
  kind: "submitting" | "scheduled" | "failed" | "unknown";
  message: string;
  requestId: string;
  taskId: string;
};
