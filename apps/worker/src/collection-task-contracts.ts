import type { CollectionErrorCode, SubqueryOutcome } from "@scoutops/collection-tasks";

export interface ClaimedCollectionTask {
  id: string;
  organizationId: string;
  workspaceId: string;
  attemptCount: number;
  requestId: string;
  traceId: string;
  leaseToken: string;
  subqueries: Array<{
    id: string;
    providerId: string;
    ordinal: number;
    required: boolean;
    target: Record<string, unknown>;
  }>;
}

export class CollectionExecutionError extends Error {
  constructor(
    readonly code: CollectionErrorCode,
    readonly rateLimitResetAt?: Date,
  ) {
    super(code);
    this.name = "CollectionExecutionError";
  }
}

export interface CollectionTaskExecutor {
  execute(
    task: ClaimedCollectionTask,
    heartbeat: () => Promise<void>,
    signal?: AbortSignal,
  ): Promise<Array<SubqueryOutcome & { id: string }>>;
}

export interface CollectionQueueCoordinator {
  signal(task: {
    id: string;
    organizationId: string;
    workspaceId: string;
    requestId: string;
    traceId: string;
  }): Promise<void>;
  acquire(task: ClaimedCollectionTask, ttlSeconds: number): Promise<boolean>;
  release(task: ClaimedCollectionTask): Promise<void>;
}
