export type ApprovalViewState =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "forbidden"
  | "expired"
  | "rate_limited"
  | "version_conflict";

export type ApprovalTemplate = {
  id: string;
  name: string;
  resource_type: string;
  status: string;
  current_version: number;
  revision: number;
  node_count: number;
};

export type ApprovalMemberOption = { id: string; label: string };

export type ApprovalItem = {
  id: string;
  title: string;
  template_name: string;
  resource_type: string;
  resource_id: string;
  status: string;
  current_node_ordinal: number;
  current_node_name: string | null;
  can_decide: boolean;
  due_at: string | null;
  escalated_at: string | null;
  version: number;
  approval_template_version?: number;
  nodes?: Array<{
    id: string;
    ordinal: number;
    name: string;
    status: string;
    approver_name: string;
    active_approver_id: string;
    active_approver_name: string;
    escalation_assignee_id: string;
    escalation_assignee_name: string;
    due_at: string | null;
    escalated_at: string | null;
    decision_reason: string | null;
    decided_by_name: string | null;
  }>;
  actions?: Array<{
    id: string;
    action: string;
    reason: string;
    actor_name: string;
    created_at: string;
  }>;
  requested_by?: string;
  decision_context?: {
    snapshot_status: "captured" | "live_fallback";
    captured_at: string | null;
    observed_at: string;
    resource: {
      type: "task" | "opportunity";
      id: string;
      label: string;
      route: string;
    };
    evidence: {
      applicable: boolean;
      complete: number;
      total: number;
      percent: number | null;
      is_complete: boolean | null;
      missing_items: string[];
      note: string | null;
      requirements: Array<{
        code: string;
        label: string;
        complete: boolean;
        detail: string;
        route: string;
      }>;
    };
    rule_versions: {
      approval_template: string;
      scoring: string | null;
      profit: string | null;
    };
    decision: {
      action: string;
      reason: string;
      opportunity_version: number;
      created_at: string;
    } | null;
    basis_items: Array<{ code: string; label: string; value: string | null }>;
    evidence_complete: number;
    evidence_total: number;
    missing_items: string[];
    rule_version: string;
    basis: string[];
  };
  decision_context_diff?: {
    available: boolean;
    observed_at: string | null;
    has_changes: boolean;
    evidence_summary: {
      before_complete: number;
      before_total: number;
      before_percent: number | null;
      after_complete: number;
      after_total: number;
      after_percent: number | null;
    } | null;
    requirement_changes: Array<{
      code: string;
      label: string;
      before_complete: boolean | null;
      after_complete: boolean | null;
      before_detail: string | null;
      after_detail: string | null;
    }>;
    basis_changes: Array<{
      code: string;
      label: string;
      before: string | null;
      after: string | null;
    }>;
    rule_version_changes: Array<{
      code: string;
      label: string;
      before: string | null;
      after: string | null;
    }>;
  };
};

export type ApprovalTemplateForm = {
  name: string;
  resource_type: string;
  node_name: string;
  approver_id: string;
  sla_minutes: number;
  escalation_assignee_id: string;
};

export type ApprovalRequestForm = {
  template_id: string;
  resource_type: string;
  resource_id: string;
  title: string;
};
