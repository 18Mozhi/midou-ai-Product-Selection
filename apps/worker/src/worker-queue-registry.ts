import type { QueueSchedulerJob } from "./queue-scheduler.js";

export type WorkerQueueName =
  | "collection_tasks"
  | "auth_delivery"
  | "business_task_projection"
  | "approval_escalation"
  | "notification_outbox"
  | "webhook_deliveries"
  | "opportunity_refresh"
  | "opportunity_scoring"
  | "opportunity_profit"
  | "competitor_monitor"
  | "sourcing_projection"
  | "trend_projection"
  | "ai_analysis"
  | "report_exports"
  | "automation_rules"
  | "core_collection_projection"
  | "automatic_rule_sources"
  | "automatic_full_sources";

type QueuePolicy = Pick<
  QueueSchedulerJob,
  | "priority"
  | "maxConcurrency"
  | "timeoutMs"
  | "maxRetries"
  | "retryDelayMs"
  | "circuitFailureThreshold"
  | "circuitCooldownMs"
  | "agingIntervalMs"
  | "maximumAgingBoost"
  | "stuckAfterMs"
>;

const policy = (
  priority: number,
  timeoutMs: number,
  maxRetries: number,
  circuitFailureThreshold = 5,
): QueuePolicy => ({
  priority,
  maxConcurrency: 1,
  timeoutMs,
  maxRetries,
  retryDelayMs: 1_000,
  circuitFailureThreshold,
  circuitCooldownMs: 60_000,
  agingIntervalMs: 30_000,
  maximumAgingBoost: 100,
  stuckAfterMs: Math.max(timeoutMs * 2, 120_000),
});

/**
 * The single registry is the runtime contract for queue-specific isolation.
 * Business handlers keep their own transactional retry/dead-letter semantics;
 * scheduler retries only cover a failed polling attempt before a durable result exists.
 */
export const WORKER_QUEUE_POLICIES: Readonly<Record<WorkerQueueName, QueuePolicy>> = {
  collection_tasks: policy(100, 300_000, 0, 3),
  auth_delivery: policy(95, 30_000, 2),
  business_task_projection: policy(90, 60_000, 1),
  approval_escalation: policy(85, 60_000, 1),
  notification_outbox: policy(80, 60_000, 2),
  webhook_deliveries: policy(80, 60_000, 2),
  opportunity_refresh: policy(70, 120_000, 0, 4),
  opportunity_scoring: policy(65, 120_000, 0, 4),
  opportunity_profit: policy(65, 120_000, 0, 4),
  competitor_monitor: policy(60, 120_000, 0, 4),
  sourcing_projection: policy(60, 120_000, 0, 4),
  trend_projection: policy(55, 120_000, 0, 4),
  ai_analysis: policy(50, 300_000, 0, 3),
  report_exports: policy(45, 300_000, 0, 3),
  automation_rules: policy(40, 120_000, 1, 4),
  core_collection_projection: policy(35, 120_000, 1, 4),
  automatic_rule_sources: policy(32, 60_000, 1, 3),
  automatic_full_sources: policy(30, 60_000, 1, 3),
};

export const workerQueue = (
  name: WorkerQueueName,
  intervalMs: number,
  run: QueueSchedulerJob["run"],
): QueueSchedulerJob => ({
  name,
  intervalMs,
  run,
  ...WORKER_QUEUE_POLICIES[name],
});
