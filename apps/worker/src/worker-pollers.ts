import type {
  QueueBusinessObjectAssociation,
  QueueRunObservation,
  QueueSchedulerJob,
} from "./queue-scheduler.js";

type PollResult = { status?: string } & Record<string, unknown>;

const asPollResult = (value: unknown): PollResult | null =>
  value !== null && typeof value === "object" ? (value as PollResult) : null;

type AssociationRule = {
  key: string;
  type: QueueBusinessObjectAssociation["type"];
  label: string;
  href: (id: string) => string | null;
};

const associationRules: Readonly<Record<string, AssociationRule[]>> = {
  collection_tasks: [
    {
      key: "task_id",
      type: "collection_task",
      label: "采集任务",
      href: (id) => `/platform-admin/collection?task=${encodeURIComponent(id)}`,
    },
  ],
  core_collection_projection: [
    {
      key: "task_id",
      type: "collection_task",
      label: "采集任务",
      href: (id) => `/platform-admin/collection?task=${encodeURIComponent(id)}`,
    },
  ],
  automatic_rule_sources: [
    {
      key: "taskId",
      type: "collection_task",
      label: "采集任务",
      href: (id) => `/platform-admin/collection?task=${encodeURIComponent(id)}`,
    },
  ],
  automatic_full_sources: [
    {
      key: "taskId",
      type: "collection_task",
      label: "采集任务",
      href: (id) => `/platform-admin/collection?task=${encodeURIComponent(id)}`,
    },
  ],
  business_task_projection: [
    {
      key: "taskId",
      type: "business_task",
      label: "业务任务",
      href: (id) => `/tasks/${encodeURIComponent(id)}`,
    },
  ],
  opportunity_refresh: [
    {
      key: "opportunity_id",
      type: "opportunity",
      label: "选品机会",
      href: (id) => `/opportunities/${encodeURIComponent(id)}`,
    },
  ],
  automatic_selection_evaluation: [
    {
      key: "opportunity_id",
      type: "opportunity",
      label: "自动质量评估",
      href: (id) => `/opportunities/${encodeURIComponent(id)}`,
    },
  ],
  opportunity_scoring: [
    {
      key: "opportunity_id",
      type: "opportunity",
      label: "选品机会",
      href: (id) => `/opportunities/${encodeURIComponent(id)}`,
    },
  ],
  opportunity_profit: [
    {
      key: "opportunity_id",
      type: "opportunity",
      label: "选品机会",
      href: (id) => `/opportunities/${encodeURIComponent(id)}`,
    },
  ],
  ai_analysis: [
    {
      key: "opportunity_id",
      type: "opportunity",
      label: "选品机会",
      href: (id) => `/opportunities/${encodeURIComponent(id)}`,
    },
  ],
  trend_projection: [
    {
      key: "topic_id",
      type: "trend_topic",
      label: "趋势主题",
      href: () => null,
    },
  ],
  report_exports: [
    {
      key: "export_id",
      type: "report_export",
      label: "报表导出",
      href: () => null,
    },
  ],
  automation_rules: [
    {
      key: "execution_id",
      type: "automation_execution",
      label: "自动化执行",
      href: () => null,
    },
  ],
};

const bounded = (value: unknown, maximum: number) =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximum
    ? value.trim()
    : null;

export const normalizeQueueRunObservation = (
  queue: string,
  result: PollResult | null,
): QueueRunObservation | null => {
  const status = bounded(result?.status, 64);
  if (!result || !status || status === "idle") return null;
  const businessObjects = (associationRules[queue] ?? []).flatMap((rule) => {
    const id = bounded(result[rule.key], 200);
    return id ? [{ type: rule.type, id, label: rule.label, href: rule.href(id) }] : [];
  });
  return {
    status,
    error_code: bounded(result.error_code, 120),
    business_objects: businessObjects,
  };
};

export class WorkerPollers {
  private stopping = false;
  private readonly activeQueues = new Set<string>();

  get isStopping() {
    return this.stopping;
  }

  create(
    queue: string,
    run: (signal: AbortSignal) => Promise<unknown>,
    options: { enabled?: () => boolean; logResult?: boolean } = {},
  ): QueueSchedulerJob["run"] {
    return async (signal) => {
      if (this.stopping || this.activeQueues.has(queue) || options.enabled?.() === false) return;
      this.activeQueues.add(queue);
      try {
        const value = await run(signal);
        const result = asPollResult(value);
        if (options.logResult !== false && result?.status && result.status !== "idle") {
          console.log(
            JSON.stringify({
              service: "product-scout-worker",
              queue,
              ...result,
              observed_at: new Date().toISOString(),
            }),
          );
        }
        return normalizeQueueRunObservation(queue, result);
      } catch (error) {
        console.error(
          JSON.stringify({
            service: "product-scout-worker",
            queue,
            status: "dependency_failed",
            error: error instanceof Error ? error.message.slice(0, 240) : "unknown",
            observed_at: new Date().toISOString(),
          }),
        );
        throw error;
      } finally {
        this.activeQueues.delete(queue);
      }
    };
  }

  requestStop() {
    this.stopping = true;
  }

  async waitForIdle() {
    while (this.activeQueues.size > 0) await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
