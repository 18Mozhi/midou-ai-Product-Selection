export const FOUNDATION_MODULE_ID = "M00-01" as const;

export type OrganizationId = string & { readonly __brand: "OrganizationId" };
export type WorkspaceId = string & { readonly __brand: "WorkspaceId" };

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

export type LocalAccountStatus = "pending_verification" | "active" | "disabled";
export type LocalSessionStatus = "active" | "revoked" | "expired";

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

export interface PasswordResetRequest {
  email: string;
}
export interface PasswordResetConfirm {
  token: string;
  new_password: string;
}
export interface EmailVerificationConfirm {
  token: string;
}
export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

export interface MfaChallengeResponse {
  mfa_required: true;
  expires_at: string;
}
export interface MfaEnrollmentStart {
  factor_id: string;
  secret: string;
  otpauth_uri: string;
}
export interface IdentityAdapterCapability {
  protocol: "oidc" | "saml2" | "scim2";
  status: "adapter_ready" | "reserved_disabled";
  activation: "requires_approved_provider_and_tenant_mapping";
}
export interface MfaStatus {
  totp_enabled: boolean;
  factor_id: string | null;
  confirmed_at: string | null;
  identity_adapters: IdentityAdapterCapability[];
}
export interface OrganizationMembershipSummary {
  id: string;
  name: string;
  slug: string;
  status: "active" | "archived";
  timezone: string;
  default_workspace_id: string | null;
  membership_status: "active" | "disabled";
}
export interface WorkspaceSummary {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  status: "active" | "archived";
  version: number;
}
export interface TeamSummary {
  id: string;
  organization_id: string;
  name: string;
  status: "active" | "archived";
  version: number;
}
export interface SelectedTenancyContext {
  organization: { id: string; name: string };
  workspace: WorkspaceSummary;
}
export type AuthorizationDataScope =
  "own" | "team" | "workspace" | "organization" | "platform";
export interface AuthorizationScopeSummary {
  scope: AuthorizationDataScope;
  workspace_id?: string | null;
  team_id?: string | null;
}
export interface CurrentAuthorizationSummary {
  organization_id: string;
  workspace_id: string;
  roles: string[];
  capabilities: string[];
  data_scopes: AuthorizationScopeSummary[];
  platform_roles?: string[];
  platform_capabilities?: string[];
}
export type NavigationShell =
  "member" | "organization_admin" | "platform_admin";
export interface NavigationGuardSummary {
  shell: NavigationShell;
  organization_id: string | null;
  workspace_id: string | null;
  roles: string[];
  capabilities: string[];
  platform_roles: string[];
  platform_capabilities: string[];
  guard_reason: string;
}
export type LandingShell = NavigationShell | "select_context";
export interface LandingSummary {
  shell: LandingShell;
  route: "/home" | "/org-admin" | "/platform-admin" | "/select-context";
  reason: string;
}
export interface GlobalSearchResult {
  id: string;
  resource_type: string;
  resource_id: string;
  title: string;
  subtitle: string | null;
  route: string;
  updated_at: string;
}
export interface GlobalSearchPage {
  items: GlobalSearchResult[];
  next_cursor: string | null;
  scope: { organization_id: string; workspace_id: string };
}
export interface QuickActionSummary {
  id: string;
  label: string;
  description: string;
  route: string;
  required_capability: string;
}
export type HomeDashboardKind = "action" | "change" | "follow" | "health";
export type HomeActionPriority =
  "overdue" | "blocking" | "high_risk" | "high_value" | "normal";
export interface HomeDashboardItem {
  id: string;
  kind: HomeDashboardKind;
  title: string;
  reason: string;
  route: string;
  priority: HomeActionPriority | null;
  owner_label: string | null;
  due_at: string | null;
  source_count: number | null;
  observed_at: string;
  severity: "info" | "warning" | "critical";
  source_version: number;
}
export interface HomeDashboardSummary {
  actions: HomeDashboardItem[];
  changes: HomeDashboardItem[];
  follows: HomeDashboardItem[];
  health: HomeDashboardItem[];
  scope: { organization_id: string; workspace_id: string };
  generated_at: string;
}
export type ProviderAccessMode =
  "public_page" | "public_rss" | "authenticated_browser" | "import" | "manual";
export interface ProviderDefinition {
  id: string;
  code: string;
  name: string;
  target_url: string;
  access_mode: ProviderAccessMode;
  markets: string[];
  languages: string[];
  fields: string[];
  schedule_minutes: number;
  concurrency_limit: number;
  timeout_ms: number;
  retry_limit: number;
  circuit_failure_threshold: number;
  dedupe_key: string;
  retention_days: number;
  failure_rules: string[];
  parser_version: string;
  healthcheck_url: string | null;
  owner_label: string;
  status: "draft" | "disabled" | "enabled";
  version: number;
  updated_at: string;
}
export type ProviderDefinitionInput = Omit<
  ProviderDefinition,
  "id" | "version" | "updated_at"
>;
export interface ProviderAdapterSummary {
  id: string;
  code: string;
  name: string;
  access_mode: ProviderAccessMode;
  provider_status: "draft" | "disabled" | "enabled";
  adapter_registered: boolean;
  adapter_version: string | null;
  health_status: "unknown" | "ready" | "degraded" | "blocked";
  last_checked_at: string | null;
  last_latency_ms: number | null;
  last_error_code: string | null;
  consecutive_failures: number;
  version: number;
  updated_at: string;
}
export interface ProviderAdapterHealthResult extends ProviderAdapterSummary {
  request_id: string;
  trace_id: string;
}
export type CredentialAssetKind =
  | "api_key"
  | "account_secret"
  | "cookie_bundle"
  | "private_key"
  | "browser_profile";
export interface CredentialAssetSummary {
  id: string;
  provider_id: string;
  name: string;
  kind: CredentialAssetKind;
  status: "active" | "revoked";
  key_version: string;
  fingerprint: string;
  expires_at: string | null;
  rotated_at: string | null;
  version: number;
  updated_at: string;
}
export interface CredentialSecretInput {
  encoding: "utf8" | "base64";
  value: string;
}
export interface CredentialAssetCreateInput {
  provider_id: string;
  name: string;
  kind: CredentialAssetKind;
  secret_payload: CredentialSecretInput;
  expires_at: string | null;
}
export interface CrawlerProfileSummary {
  id: string;
  provider_id: string;
  credential_asset_id: string;
  code: string;
  name: string;
  browser_family: "chromium";
  locale: string;
  timezone: string;
  status: "active" | "disabled" | "revoked";
  version: number;
  updated_at: string;
}
export interface CrawlerProfileInput {
  provider_id: string;
  credential_asset_id: string;
  code: string;
  name: string;
  browser_family: "chromium";
  locale: string;
  timezone: string;
  status: "active" | "disabled";
}
export interface RoleCapabilitySummary {
  code: string;
  name: string;
  category: "organization" | "platform";
  description: string;
  capabilities: string[];
}
export type ResourceGrantType =
  "task" | "opportunity" | "competitor" | "sourcing";
export type ResourceGrantStatus = "active" | "revoked" | "expired";
export interface ResourceGrantSummary {
  id: string;
  organization_id: string;
  workspace_id: string;
  resource_type: ResourceGrantType;
  resource_id: string;
  grantee_membership_id: string;
  grantor_id: string;
  reason: string;
  status: "active" | "revoked";
  effective_status: ResourceGrantStatus;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  actions: string[];
}
export interface CreateResourceGrantRequest {
  workspace_id: string;
  resource_type: ResourceGrantType;
  resource_id: string;
  grantee_membership_id: string;
  actions: string[];
  reason: string;
  expires_at: string;
}
export interface ExtendResourceGrantRequest {
  expected_version: number;
  reason: string;
  expires_at: string;
}
export interface RevokeResourceGrantRequest {
  expected_version: number;
  reason: string;
}
export interface EligibleResourceGrantMember {
  id: string;
  user_id: string;
  email: string;
  status: "active";
}
export interface SecuritySetupStatus {
  required: boolean;
  must_change_password: boolean;
  must_enroll_mfa: boolean;
  completed_at?: string | null;
}
export type AuditOutcome = "succeeded" | "failed" | "blocked";
export interface SecurityAuditEvent {
  id: string;
  organization_id: string | null;
  workspace_id: string | null;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  outcome: AuditOutcome;
  request_id: string;
  trace_id: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
  schema_version: 1;
}
export interface SecurityAuditPage {
  items: SecurityAuditEvent[];
  nextCursor: string | null;
}
export interface MfaCodeRequest {
  code: string;
}
export interface MfaDisableRequest extends MfaCodeRequest {
  current_password: string;
}

export interface RedisDependencyStatus {
  status: "available" | "unavailable";
  latency_ms: number;
  checked_at: string;
  request_id: string;
  trace_id: string;
}

export interface RedisResilienceFindingDto {
  code: string;
  severity: "warning" | "blocked";
  action_hint: string;
}
export interface RedisResilienceDto {
  state: "ready" | "warning" | "blocked";
  mode: "single_instance";
  persistence: {
    aof_enabled: boolean;
    rdb_enabled: boolean;
    aof_last_write_status: "ok" | "err" | "unknown";
    rdb_last_save_status: "ok" | "err" | "unknown";
  };
  memory: { used_bytes: number; max_bytes: number; usage_basis_points: number };
  connections: {
    connected: number;
    maximum: number;
    usage_basis_points: number;
    rejected: number;
  };
  evicted_keys: number;
  findings: RedisResilienceFindingDto[];
  single_instance: true;
  sentinel_enabled: false;
  cluster_enabled: false;
  capacity_claim: "unverified";
  observed_at: string;
}

export interface MySqlResilienceFindingDto {
  code: string;
  severity: "warning" | "blocked";
  action_hint: string;
}
export interface MySqlResilienceDto {
  state: "ready" | "warning" | "blocked";
  mode: "single_primary";
  durability: {
    log_bin_enabled: boolean;
    binlog_format: "ROW" | "MIXED" | "STATEMENT" | "unknown";
    innodb_flush_log_at_trx_commit: number;
    sync_binlog: number;
  };
  connections: {
    connected: number;
    running: number;
    maximum: number;
    usage_basis_points: number;
  };
  storage: {
    used_bytes: number;
    total_bytes: number;
    usage_basis_points: number;
  };
  io: {
    buffer_pool_bytes: number;
    buffer_pool_data_bytes: number;
    buffer_pool_hit_rate_basis_points: number;
    innodb_log_waits: number;
    innodb_row_lock_waits: number;
  };
  slow_queries: { per_minute: number; long_query_time_seconds: number };
  recovery: {
    status: "verified" | "stale" | "blocked" | "empty";
    actual_rpo_minutes: number | null;
    actual_rto_minutes: number | null;
    drill_age_days: number | null;
  };
  findings: MySqlResilienceFindingDto[];
  single_primary: true;
  replica_enabled: false;
  backup_server_used: false;
  capacity_claim: "unverified";
  observed_at: string;
}

export interface FileResilienceFindingDto {
  code: string;
  severity: "warning" | "blocked";
  action_hint: string;
}
export interface FileResilienceDto {
  state: "ready" | "warning" | "blocked";
  mode: "local_managed_directories";
  directories: Array<{
    kind: "evidence" | "export";
    available: boolean;
    writable: boolean;
    used_bytes: number;
    total_bytes: number;
    usage_basis_points: number;
    active_files: number;
    indexed_bytes: number;
  }>;
  integrity: {
    sampled_files: number;
    verified_files: number;
    mismatch_files: number;
    missing_files: number;
  };
  recovery: {
    status: "verified" | "stale" | "blocked" | "empty";
    encrypted_same_host_copy: boolean;
    isolated_restore_verified: boolean;
    drill_age_days: number | null;
  };
  findings: FileResilienceFindingDto[];
  organization_scoped: true;
  public_access_enabled: false;
  shared_storage_enabled: false;
  backup_server_used: false;
  capacity_claim: "unverified";
  observed_at: string;
}

export interface DatabaseDependencyStatus {
  status: "available" | "unavailable";
  latency_ms: number;
  migration_version: string;
  checked_at: string;
  request_id: string;
  trace_id: string;
}

export type FoundationWorkStatus =
  | "queued"
  | "leased"
  | "running"
  | "retry_scheduled"
  | "succeeded"
  | "failed_terminal"
  | "dead_letter";

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
    throw new Error("organization_id is required");
  }
  if (options.workspaceRequired && !value.workspace_id?.trim()) {
    throw new Error("workspace_id is required");
  }
}
