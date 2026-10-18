export type TrendWorkspaceState =
  "loading" | "ready" | "empty" | "error" | "expired" | "forbidden" | "blocked";

export interface TrendTopic {
  id: string;
  title: string;
  category: string | null;
  market: string;
  language: string;
  status: "active" | "irrelevant" | "stale" | "archived";
  signal_count: number;
  source_count: number;
  heat: { value: number; unit: "signals" };
  momentum_percent: number | null;
  confidence: { score: number | null; status: "measured" | "insufficient_data" };
  first_seen_at: string;
  last_seen_at: string;
  source_fresh_at: string;
  followed: boolean;
  version: number;
}

export interface TrendDetail extends TrendTopic {
  keywords: Array<{ keyword: string; type: string; language: string; market: string }>;
  timeline: Array<{ at: string; signal_count: number; source_count: number }>;
  timeline_sources: Array<{
    source_id: string;
    source_label: string;
    points: Array<{ at: string; signal_count: number }>;
  }>;
  evidence: Array<{
    id: string;
    title: string;
    publisher: string;
    canonical_url: string;
    published_at: string;
    observed_at: string;
    provider_id: string;
    raw_evidence_id: string;
  }>;
  data_quality: {
    coverage_status: string;
    evidence_count: number;
    source_count: number;
    stale: boolean;
  };
  relevance_history: Array<{
    status: "active" | "irrelevant";
    reason: string;
    actor_id: string;
    version: number;
    occurred_at: string;
  }>;
}

export interface TrendFilters {
  q: string;
  market: string;
  category: string;
  status: string;
}

export type TrendSort = "impact" | "latest" | "momentum";
