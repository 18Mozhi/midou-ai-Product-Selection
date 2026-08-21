export type ProviderSourceViewState =
  "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";

export interface ProvisionedSource {
  id: string;
  code: string;
  status: "draft" | "disabled" | "enabled";
  version: number;
  schedule_minutes: number;
  timeout_ms: number;
  retry_limit: number;
  updated_at: string;
  last_success: {
    task_id: string;
    status: "succeeded" | "succeeded_empty";
    available_result_count: number;
    finished_at: string;
  } | null;
}

export interface ProviderSourceItem {
  code: string;
  name: string;
  access_mode: string;
  target_url: string;
  markets: string[];
  languages: string[];
  fields: string[];
  schedule_minutes: number;
  timeout_ms: number;
  retry_limit: number;
  owner_label: string;
  category: "news" | "ecommerce" | "data" | "community" | "product_supply";
  availability: "automatic" | "setup_required" | "manual";
  policy_note: string;
  provisioned: ProvisionedSource | null;
}

export interface ParserSample {
  id: string;
  name: string;
  baseline_parser_version: string;
  last_replay_status: "never" | "passed" | "changed" | "failed";
  last_replay_at: string | null;
  created_at: string;
}

export interface ParserSampleCandidate {
  browser_job_id: string;
  captured_at: string;
  item_count: number;
  parser_version: string;
}

export interface ParserSampleReplay {
  status: "passed" | "changed" | "failed";
  diff: Array<{ path: string; before: unknown; after: unknown }>;
  error_code: string | null;
}

export interface ConfigurationChange {
  field: "schedule_minutes" | "timeout_ms" | "retry_limit" | "status";
  before: number | string | null;
  after: number | string;
}

export interface ConfigurationVersion {
  version: number;
  action: string;
  created_at: string;
  current: boolean;
  rollback_available: boolean;
  changes: ConfigurationChange[];
}
