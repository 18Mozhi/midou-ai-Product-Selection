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

export interface MfaChallengeResponse { mfa_required: true; expires_at: string; }
export interface MfaEnrollmentStart { factor_id: string; secret: string; otpauth_uri: string; }
export interface IdentityAdapterCapability {
  protocol: 'oidc' | 'saml2' | 'scim2';
  status: 'adapter_ready' | 'reserved_disabled';
  activation: 'requires_approved_provider_and_tenant_mapping';
}
export interface MfaStatus {
  totp_enabled: boolean;
  factor_id: string | null;
  confirmed_at: string | null;
  identity_adapters: IdentityAdapterCapability[];
}
export interface OrganizationMembershipSummary { id:string;name:string;slug:string;status:'active'|'archived';timezone:string;default_workspace_id:string|null;membership_status:'active'|'disabled'; }
export interface WorkspaceSummary { id:string;organization_id:string;name:string;slug:string;status:'active'|'archived';version:number; }
export interface TeamSummary { id:string;organization_id:string;name:string;status:'active'|'archived';version:number; }
export interface SelectedTenancyContext { organization:{id:string;name:string};workspace:WorkspaceSummary; }
export type AuthorizationDataScope='own'|'team'|'workspace'|'organization'|'platform';
export interface AuthorizationScopeSummary{scope:AuthorizationDataScope;workspace_id?:string|null;team_id?:string|null;}
export interface CurrentAuthorizationSummary{organization_id:string;workspace_id:string;roles:string[];capabilities:string[];data_scopes:AuthorizationScopeSummary[];platform_roles?:string[];platform_capabilities?:string[];}
export type NavigationShell='member'|'organization_admin'|'platform_admin';
export interface NavigationGuardSummary{shell:NavigationShell;organization_id:string|null;workspace_id:string|null;roles:string[];capabilities:string[];platform_roles:string[];platform_capabilities:string[];guard_reason:string;}
export interface GlobalSearchResult{id:string;resource_type:string;resource_id:string;title:string;subtitle:string|null;route:string;updated_at:string;}
export interface GlobalSearchPage{items:GlobalSearchResult[];next_cursor:string|null;scope:{organization_id:string;workspace_id:string};}
export interface QuickActionSummary{id:string;label:string;description:string;route:string;required_capability:string;}
export type HomeDashboardKind='action'|'change'|'follow'|'health';
export type HomeActionPriority='overdue'|'blocking'|'high_risk'|'high_value'|'normal';
export interface HomeDashboardItem{id:string;kind:HomeDashboardKind;title:string;reason:string;route:string;priority:HomeActionPriority|null;owner_label:string|null;due_at:string|null;source_count:number|null;observed_at:string;severity:'info'|'warning'|'critical';source_version:number;}
export interface HomeDashboardSummary{actions:HomeDashboardItem[];changes:HomeDashboardItem[];follows:HomeDashboardItem[];health:HomeDashboardItem[];scope:{organization_id:string;workspace_id:string};generated_at:string;}
export interface RoleCapabilitySummary{code:string;name:string;category:'organization'|'platform';description:string;capabilities:string[];}
export type ResourceGrantType='task'|'opportunity'|'competitor'|'sourcing';
export type ResourceGrantStatus='active'|'revoked'|'expired';
export interface ResourceGrantSummary{id:string;organization_id:string;workspace_id:string;resource_type:ResourceGrantType;resource_id:string;grantee_membership_id:string;grantor_id:string;reason:string;status:'active'|'revoked';effective_status:ResourceGrantStatus;expires_at:string;revoked_at:string|null;revoked_by:string|null;revocation_reason:string|null;version:number;created_at:string;updated_at:string;actions:string[];}
export interface CreateResourceGrantRequest{workspace_id:string;resource_type:ResourceGrantType;resource_id:string;grantee_membership_id:string;actions:string[];reason:string;expires_at:string;}
export interface ExtendResourceGrantRequest{expected_version:number;reason:string;expires_at:string;}
export interface RevokeResourceGrantRequest{expected_version:number;reason:string;}
export interface EligibleResourceGrantMember{id:string;user_id:string;email:string;status:'active';}
export interface SecuritySetupStatus{required:boolean;must_change_password:boolean;must_enroll_mfa:boolean;completed_at?:string|null;}
export type AuditOutcome='succeeded'|'failed'|'blocked';
export interface SecurityAuditEvent{id:string;organization_id:string|null;workspace_id:string|null;actor_id:string|null;action:string;resource_type:string;resource_id:string|null;outcome:AuditOutcome;request_id:string;trace_id:string;metadata:Record<string,unknown>;occurred_at:string;schema_version:1;}
export interface SecurityAuditPage{items:SecurityAuditEvent[];nextCursor:string|null;}
export interface MfaCodeRequest { code: string; }
export interface MfaDisableRequest extends MfaCodeRequest { current_password: string; }

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
