import { collectionQueueDatabaseContext } from "./collection-task-database-context.js";
import type { CollectionClaimFence } from "@scoutops/database";
import type { PoolConnection } from "mysql2/promise";
import { collectionFailureDiagnostic } from "./collection-failure-diagnostic.js";
import type { OrganizationId, WorkspaceId } from "@scoutops/contracts";
import { ScopedRedisStore } from "@scoutops/redis";
import {
  CollectionExecutionError,
  type ClaimedCollectionTask,
  type CollectionQueueCoordinator,
  type CollectionTaskExecutor,
} from "./collection-task-contracts.js";
import { MySqlCollectionTaskWorkerRepository } from "./collection-task-state-machine.js";

export {
  CollectionExecutionError,
  type ClaimedCollectionTask,
  type CollectionQueueCoordinator,
  type CollectionTaskExecutor,
};
export { MySqlCollectionTaskWorkerRepository };

export class ScopedRedisCollectionCoordinator implements CollectionQueueCoordinator {
  constructor(private readonly store: ScopedRedisStore) {}
  private scope(task: { organizationId: string; workspaceId: string }) {
    return {
      organization_id: task.organizationId as OrganizationId,
      workspace_id: task.workspaceId as WorkspaceId,
    };
  }
  async signal(task: {
    id: string;
    organizationId: string;
    workspaceId: string;
    requestId: string;
    traceId: string;
  }) {
    await this.store.writeJson(
      {
        ...this.scope(task),
        purpose: "queue",
        resource: "collection-ready",
        identifiers: [task.id],
      },
      { task_id: task.id, request_id: task.requestId, trace_id: task.traceId },
    );
  }
  acquire(task: ClaimedCollectionTask, ttlSeconds: number) {
    return this.store.acquireLease(
      { ...this.scope(task), resource: "collection-task", identifiers: [task.id] },
      task.leaseToken,
      ttlSeconds,
    );
  }
  async release(task: ClaimedCollectionTask) {
    await this.store.releaseLease(
      { ...this.scope(task), resource: "collection-task", identifiers: [task.id] },
      task.leaseToken,
    );
  }
}

export async function processCollectionTaskOnce(input: {
  repository: MySqlCollectionTaskWorkerRepository;
  coordinator: CollectionQueueCoordinator;
  executor: CollectionTaskExecutor;
  workerId: string;
  leaseSeconds: number;
  claimFence?: CollectionClaimFence;
  signal?: AbortSignal;
  resourceProbe?: {
    inspect(): Promise<{
      allowed: boolean;
      snapshot: {
        loadBasisPoints: number;
        availableMemoryMb: number;
        freeDiskMb: number;
        observedAt: Date;
      };
    }>;
  };
  now?: () => Date;
}) {
  const clock = input.now ?? (() => new Date());
  if (input.resourceProbe) {
    const resource = await input.resourceProbe.inspect();
    if (!resource.allowed) {
      const correlation = `worker-resource-${input.workerId}`;
      console.error(
        JSON.stringify({
          service: "product-scout-worker",
          queue: "collection_tasks",
          status: "resource_blocked",
          request_id: correlation,
          trace_id: correlation,
          load_basis_points: resource.snapshot.loadBasisPoints,
          available_memory_mb: resource.snapshot.availableMemoryMb,
          free_disk_mb: resource.snapshot.freeDiskMb,
          observed_at: resource.snapshot.observedAt.toISOString(),
        }),
      );
      return { status: "resource_blocked" as const, recovered: 0 };
    }
  }
  const admit = async (paused: boolean, connection?: PoolConnection) => {
    if (paused) return null;
    const admissionTime = clock();
    const recovered = await collectionQueueDatabaseContext("recover_expired", () =>
      input.repository.recoverExpired(admissionTime, undefined, connection),
    );
    const queued = await collectionQueueDatabaseContext("queue_ready", () =>
      input.repository.queueReady(admissionTime, undefined, connection),
    );
    if (queued) await input.coordinator.signal(queued);
    const claimed = await collectionQueueDatabaseContext("claim", () =>
      input.repository.claim(input.workerId, admissionTime, input.leaseSeconds, connection),
    );
    return { recovered, claimed, now: admissionTime };
  };
  const admission = input.claimFence ? await input.claimFence(admit) : await admit(false);
  if (!admission) return { status: "idle" as const, recovered: 0, claim_paused: true };
  const { recovered, claimed, now } = admission;
  if (!claimed) return { status: "idle" as const, recovered };
  if (!(await input.coordinator.acquire(claimed, input.leaseSeconds))) {
    const result = await input.repository.releaseCoordinationConflict(claimed, now);
    return {
      status: result.status,
      task_id: claimed.id,
      error_code: "timeout" as const,
      recovered,
    };
  }
  try {
    await input.repository.start(claimed, now);
    try {
      const outcomes = await input.executor.execute(
        claimed,
        () => input.repository.heartbeat(claimed, clock(), input.leaseSeconds),
        input.signal,
      );
      const summary = await input.repository.complete(claimed, outcomes, clock());
      return {
        status: summary.terminalStatus,
        task_id: claimed.id,
        coverage_status: summary.coverageStatus,
        recovered,
      };
    } catch (error) {
      if (!(error instanceof CollectionExecutionError))
        console.error(
          JSON.stringify(
            collectionFailureDiagnostic(error, { taskId: claimed.id, stage: "task_execution" }),
          ),
        );
      const failure =
        error instanceof CollectionExecutionError
          ? error
          : new CollectionExecutionError("network_error");
      const result = await input.repository.fail(claimed, failure, clock());
      return { status: result.status, task_id: claimed.id, error_code: failure.code, recovered };
    }
  } finally {
    await input.coordinator.release(claimed);
  }
}
