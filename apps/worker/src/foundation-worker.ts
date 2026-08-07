import {
  assertOrganizationScope,
  type FoundationWorkEnvelope,
  type FoundationWorkStatus,
} from '@scoutops/contracts';

export interface FoundationWorkResult {
  event_id: string;
  status: FoundationWorkStatus;
  attempt_count: number;
  retry_after_seconds?: number;
  error_code?: 'dependency_unavailable' | 'invalid_scope';
}

export async function processFoundationWork(
  envelope: FoundationWorkEnvelope,
  execute: () => Promise<void>,
): Promise<FoundationWorkResult> {
  try {
    assertOrganizationScope(envelope, { workspaceRequired: true });
  } catch {
    return {
      event_id: envelope.event_id,
      status: 'failed_terminal',
      attempt_count: envelope.attempt_count,
      error_code: 'invalid_scope',
    };
  }

  try {
    await execute();
    return {
      event_id: envelope.event_id,
      status: 'succeeded',
      attempt_count: envelope.attempt_count,
    };
  } catch {
    if (envelope.attempt_count >= 4) {
      return {
        event_id: envelope.event_id,
        status: 'dead_letter',
        attempt_count: envelope.attempt_count,
        error_code: 'dependency_unavailable',
      };
    }
    const retrySeconds = [60, 300, 900][Math.max(0, envelope.attempt_count - 1)] ?? 900;
    return {
      event_id: envelope.event_id,
      status: 'retry_scheduled',
      attempt_count: envelope.attempt_count,
      retry_after_seconds: retrySeconds,
      error_code: 'dependency_unavailable',
    };
  }
}
