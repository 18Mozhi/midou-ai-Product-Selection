export const FOUNDATION_MODULE_ID = 'M00-01' as const;

export type OrganizationId = string & { readonly __brand: 'OrganizationId' };
export type WorkspaceId = string & { readonly __brand: 'WorkspaceId' };

export interface OrganizationScope {
  organization_id: OrganizationId;
  workspace_id?: WorkspaceId;
}

export interface RequestContext extends OrganizationScope {
  actor_id: string;
  request_id: string;
  trace_id: string;
}

export interface SuccessEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
  request_id: string;
  trace_id: string;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    action_hint: string;
  };
  request_id: string;
  trace_id: string;
}

export type LocalAccountStatus = 'pending_verification' | 'active' | 'disabled';
export type LocalSessionStatus = 'active' | 'revoked' | 'expired';

export interface LocalAccountSummary {
  id: string;
  email: string;
  status: LocalAccountStatus;
}

export interface LocalAccountRegistration {
  email: string;
  password: string;
}

export interface LocalLoginRequest extends LocalAccountRegistration {}

export interface LocalSessionSummary {
  id: string;
  status: LocalSessionStatus;
  device_label: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  current: boolean;
}

export interface PasswordResetRequest { email: string; }
export interface PasswordResetConfirm { token: string; new_password: string; }
export interface EmailVerificationConfirm { token: string; }
export interface PasswordChangeRequest { current_password: string; new_password: string; }

export interface RedisDependencyStatus {
  status: 'available' | 'unavailable';
  latency_ms: number;
  checked_at: string;
  request_id: string;
  trace_id: string;
}

export interface DatabaseDependencyStatus {
  status: 'available' | 'unavailable';
  latency_ms: number;
  migration_version: string;
  checked_at: string;
  request_id: string;
  trace_id: string;
}

export type FoundationWorkStatus =
  | 'queued'
  | 'leased'
  | 'running'
  | 'retry_scheduled'
  | 'succeeded'
  | 'failed_terminal'
  | 'dead_letter';

export interface FoundationWorkEnvelope extends OrganizationScope {
  event_id: string;
  schema_version: 1;
  request_id: string;
  trace_id: string;
  attempt_count: number;
  payload: Record<string, unknown>;
}

export function assertOrganizationScope(
  value: Partial<OrganizationScope>,
  options: { workspaceRequired?: boolean } = {},
): asserts value is OrganizationScope {
  if (!value.organization_id?.trim()) {
    throw new Error('organization_id is required');
  }
  if (options.workspaceRequired && !value.workspace_id?.trim()) {
    throw new Error('workspace_id is required');
  }
}
