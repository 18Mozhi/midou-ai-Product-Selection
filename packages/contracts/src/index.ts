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
