export interface QueueSchedulerRunContext {
  attempt: number;
  max_attempts: number;
}

export interface QueueBusinessObjectAssociation {
  type:
    | "collection_task"
    | "business_task"
    | "opportunity"
    | "trend_topic"
    | "report_export"
    | "automation_execution";
  id: string;
  label: string;
  href: string | null;
}

export interface QueueRunObservation {
  status: string;
  error_code: string | null;
  business_objects: QueueBusinessObjectAssociation[];
}

export interface QueueSchedulerJob {
  name: string;
  intervalMs: number;
  priority: number;
  maxConcurrency?: number;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  circuitFailureThreshold?: number;
  circuitCooldownMs?: number;
  agingIntervalMs?: number;
  maximumAgingBoost?: number;
  stuckAfterMs?: number;
  run(signal: AbortSignal, context: QueueSchedulerRunContext): Promise<unknown>;
}

interface ActiveRun {
  id: number;
  startedAt: number;
  controller: AbortController;
}

interface QueueSchedulerJobState extends QueueSchedulerJob {
  maxConcurrency: number;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  circuitFailureThreshold: number;
  circuitCooldownMs: number;
  agingIntervalMs: number;
  maximumAgingBoost: number;
  stuckAfterMs: number;
  nextRunAt: number;
  activeRuns: Map<number, ActiveRun>;
  startedTotal: number;
  completedTotal: number;
  failedTotal: number;
  timedOutTotal: number;
  cancelledTotal: number;
  retryTotal: number;
  deferredTotal: number;
  consecutiveFailures: number;
  circuitOpenUntil: number | null;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  lastError: string | null;
  lastQueueDelayMs: number;
  lastResult: QueueRunObservation | null;
  lastResultAt: string | null;
}

interface CompletionEvent {
  failed: boolean;
  at: number;
}

type RunOutcome =
  | { status: "succeeded"; observation: QueueRunObservation | null }
  | { status: "failed"; error: string }
  | { status: "timed_out"; error: string }
  | { status: "cancelled"; error: string };

export interface QueueSchedulerSnapshot {
  status: "running" | "stopping" | "stopped";
  max_concurrency: number;
  active_runs: number;
  due_queue_count: number;
  backpressure: boolean;
  max_queue_delay_ms: number;
  suspected_stuck_runs: number;
  started_total: number;
  completed_total: number;
  failed_total: number;
  timed_out_total: number;
  cancelled_total: number;
  retry_total: number;
  deferred_total: number;
  snapshot_publish_failed_total: number;
  last_snapshot_error: string | null;
  completed_last_minute: number;
  failed_last_minute: number;
  failure_rate_percent: number;
  queues: Array<{
    name: string;
    priority: number;
    effective_priority: number;
    aging_interval_ms: number;
    maximum_aging_boost: number;
    interval_ms: number;
    max_concurrency: number;
    timeout_ms: number;
    max_retries: number;
    active_runs: number;
    running: boolean;
    due: boolean;
    queue_delay_ms: number;
    longest_running_ms: number;
    suspected_stuck: boolean;
    circuit_state: "closed" | "open";
    circuit_open_until: string | null;
    consecutive_failures: number;
    started_total: number;
    completed_total: number;
    failed_total: number;
    timed_out_total: number;
    cancelled_total: number;
    retry_total: number;
    deferred_total: number;
    last_started_at: string | null;
    last_completed_at: string | null;
    last_failed_at: string | null;
    last_error: string | null;
    last_result_at: string | null;
    last_result_status: string | null;
    last_result_error_code: string | null;
    last_business_objects: QueueBusinessObjectAssociation[];
  }>;
  observed_at: string;
}

const positive = (value: number | undefined, fallback: number, minimum = 1) =>
  Number.isFinite(value) ? Math.max(minimum, Math.floor(value!)) : fallback;

const errorMessage = (error: unknown) =>
  (error instanceof Error ? error.message : "unknown").slice(0, 240);

const associationTypes = new Set<QueueBusinessObjectAssociation["type"]>([
  "collection_task",
  "business_task",
  "opportunity",
  "trend_topic",
  "report_export",
  "automation_execution",
]);

const boundedText = (value: unknown, maximum: number) =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximum
    ? value.trim()
    : null;

const runObservation = (value: unknown): QueueRunObservation | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const status = boundedText(source.status, 64);
  if (!status) return null;
  const errorCode = boundedText(source.error_code, 120);
  const businessObjects = Array.isArray(source.business_objects)
    ? source.business_objects.slice(0, 4).flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const association = item as Record<string, unknown>;
        const type = boundedText(association.type, 64) as
          QueueBusinessObjectAssociation["type"] | null;
        const id = boundedText(association.id, 200);
        const label = boundedText(association.label, 80);
        const href = association.href === null ? null : boundedText(association.href, 500);
        if (!type || !associationTypes.has(type) || !id || !label) return [];
        if (href !== null && (!href.startsWith("/") || href.startsWith("//"))) return [];
        return [{ type, id, label, href }];
      })
    : [];
  return { status, error_code: errorCode, business_objects: businessObjects };
};

const abortableDelay = (delayMs: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new Error("scheduler_run_cancelled"));
      return;
    }
    const timer = setTimeout(resolve, delayMs);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("scheduler_run_cancelled"));
      },
      { once: true },
    );
  });

export class QueueScheduler {
  private readonly jobs: QueueSchedulerJobState[] = [];
  private readonly completions: CompletionEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private status: QueueSchedulerSnapshot["status"] = "stopped";
  private activeRuns = 0;
  private nextRunId = 1;
  private ticking = false;
  private snapshotPublishFailedTotal = 0;
  private lastSnapshotError: string | null = null;

  constructor(
    private readonly options: {
      maxConcurrency: number;
      tickMs: number;
      now?: () => Date;
      onSnapshot?: (snapshot: QueueSchedulerSnapshot) => void | Promise<void>;
      onSnapshotError?: (error: unknown) => void | Promise<void>;
    },
  ) {}

  register(job: QueueSchedulerJob): this {
    if (this.status !== "stopped") throw new Error("scheduler_already_started");
    if (this.jobs.some((item) => item.name === job.name))
      throw new Error(`scheduler_job_duplicate:${job.name}`);
    const now = this.now().getTime();
    this.jobs.push({
      ...job,
      maxConcurrency: positive(job.maxConcurrency, 1),
      timeoutMs: positive(job.timeoutMs, 60_000),
      maxRetries: positive(job.maxRetries, 0, 0),
      retryDelayMs: positive(job.retryDelayMs, 1_000),
      circuitFailureThreshold: positive(job.circuitFailureThreshold, 5),
      circuitCooldownMs: positive(job.circuitCooldownMs, 60_000),
      agingIntervalMs: positive(job.agingIntervalMs, 30_000),
      maximumAgingBoost: positive(job.maximumAgingBoost, 100),
      stuckAfterMs: positive(job.stuckAfterMs, Math.max(120_000, (job.timeoutMs ?? 60_000) * 2)),
      nextRunAt: now,
      activeRuns: new Map(),
      startedTotal: 0,
      completedTotal: 0,
      failedTotal: 0,
      timedOutTotal: 0,
      cancelledTotal: 0,
      retryTotal: 0,
      deferredTotal: 0,
      consecutiveFailures: 0,
      circuitOpenUntil: null,
      lastStartedAt: null,
      lastCompletedAt: null,
      lastFailedAt: null,
      lastError: null,
      lastQueueDelayMs: 0,
      lastResult: null,
      lastResultAt: null,
    });
    return this;
  }

  start(): void {
    if (this.status !== "stopped") return;
    this.status = "running";
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.options.tickMs);
  }

  async stop(): Promise<void> {
    if (this.status === "stopped") return;
    this.status = "stopping";
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const job of this.jobs)
      for (const run of job.activeRuns.values())
        run.controller.abort(new Error("scheduler_stopping"));
    await this.publish();
    while (this.activeRuns > 0) await new Promise((resolve) => setTimeout(resolve, 25));
    this.status = "stopped";
    await this.publish();
  }

  snapshot(): QueueSchedulerSnapshot {
    const observedAt = this.now();
    const nowMs = observedAt.getTime();
    this.pruneCompletions(nowMs);
    const due = this.dueJobs(nowMs);
    const dueQueueNames = new Set(due.map((job) => job.name));
    const completedLastMinute = this.completions.length;
    const failedLastMinute = this.completions.filter((item) => item.failed).length;
    const queues = this.jobs
      .slice()
      .sort(
        (left, right) =>
          this.effectivePriority(right, nowMs) - this.effectivePriority(left, nowMs) ||
          left.name.localeCompare(right.name),
      )
      .map((job) => {
        const longestRunningMs = Math.max(
          0,
          ...[...job.activeRuns.values()].map((run) => nowMs - run.startedAt),
        );
        return {
          name: job.name,
          priority: job.priority,
          effective_priority: this.effectivePriority(job, nowMs),
          aging_interval_ms: job.agingIntervalMs,
          maximum_aging_boost: job.maximumAgingBoost,
          interval_ms: job.intervalMs,
          max_concurrency: job.maxConcurrency,
          timeout_ms: job.timeoutMs,
          max_retries: job.maxRetries,
          active_runs: job.activeRuns.size,
          running: job.activeRuns.size > 0,
          due: dueQueueNames.has(job.name),
          queue_delay_ms: Math.max(job.lastQueueDelayMs, Math.max(0, nowMs - job.nextRunAt)),
          longest_running_ms: longestRunningMs,
          suspected_stuck: longestRunningMs >= job.stuckAfterMs,
          circuit_state:
            job.circuitOpenUntil !== null && job.circuitOpenUntil > nowMs
              ? ("open" as const)
              : ("closed" as const),
          circuit_open_until:
            job.circuitOpenUntil !== null && job.circuitOpenUntil > nowMs
              ? new Date(job.circuitOpenUntil).toISOString()
              : null,
          consecutive_failures: job.consecutiveFailures,
          started_total: job.startedTotal,
          completed_total: job.completedTotal,
          failed_total: job.failedTotal,
          timed_out_total: job.timedOutTotal,
          cancelled_total: job.cancelledTotal,
          retry_total: job.retryTotal,
          deferred_total: job.deferredTotal,
          last_started_at: job.lastStartedAt,
          last_completed_at: job.lastCompletedAt,
          last_failed_at: job.lastFailedAt,
          last_error: job.lastError,
          last_result_at: job.lastResultAt,
          last_result_status: job.lastResult?.status ?? null,
          last_result_error_code: job.lastResult?.error_code ?? null,
          last_business_objects: job.lastResult?.business_objects ?? [],
        };
      });
    return {
      status: this.status,
      max_concurrency: this.options.maxConcurrency,
      active_runs: this.activeRuns,
      due_queue_count: due.length,
      backpressure: due.length > Math.max(0, this.options.maxConcurrency - this.activeRuns),
      max_queue_delay_ms: Math.max(0, ...due.map((job) => nowMs - job.nextRunAt)),
      suspected_stuck_runs: queues.filter((queue) => queue.suspected_stuck).length,
      started_total: this.jobs.reduce((total, job) => total + job.startedTotal, 0),
      completed_total: this.jobs.reduce((total, job) => total + job.completedTotal, 0),
      failed_total: this.jobs.reduce((total, job) => total + job.failedTotal, 0),
      timed_out_total: this.jobs.reduce((total, job) => total + job.timedOutTotal, 0),
      cancelled_total: this.jobs.reduce((total, job) => total + job.cancelledTotal, 0),
      retry_total: this.jobs.reduce((total, job) => total + job.retryTotal, 0),
      deferred_total: this.jobs.reduce((total, job) => total + job.deferredTotal, 0),
      snapshot_publish_failed_total: this.snapshotPublishFailedTotal,
      last_snapshot_error: this.lastSnapshotError,
      completed_last_minute: completedLastMinute,
      failed_last_minute: failedLastMinute,
      failure_rate_percent:
        completedLastMinute === 0
          ? 0
          : Math.round((failedLastMinute / completedLastMinute) * 10_000) / 100,
      queues,
      observed_at: observedAt.toISOString(),
    };
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private dueJobs(nowMs: number) {
    return this.jobs.filter((job) => {
      if (job.activeRuns.size >= job.maxConcurrency || job.nextRunAt > nowMs) return false;
      if (job.circuitOpenUntil !== null && job.circuitOpenUntil > nowMs) return false;
      if (job.circuitOpenUntil !== null) job.circuitOpenUntil = null;
      return true;
    });
  }

  private effectivePriority(job: QueueSchedulerJobState, nowMs: number) {
    const waitingMs = Math.max(0, nowMs - job.nextRunAt);
    return (
      job.priority + Math.min(job.maximumAgingBoost, Math.floor(waitingMs / job.agingIntervalMs))
    );
  }

  private async tick(): Promise<void> {
    if (this.status !== "running" || this.ticking) return;
    this.ticking = true;
    try {
      const nowMs = this.now().getTime();
      const due = this.dueJobs(nowMs).sort(
        (left, right) =>
          this.effectivePriority(right, nowMs) - this.effectivePriority(left, nowMs) ||
          left.nextRunAt - right.nextRunAt ||
          left.name.localeCompare(right.name),
      );
      const available = Math.max(0, this.options.maxConcurrency - this.activeRuns);
      for (const job of due.slice(available)) job.deferredTotal += 1;
      for (const job of due.slice(0, available)) this.launch(job, nowMs);
      await this.publish();
    } finally {
      this.ticking = false;
    }
  }

  private launch(job: QueueSchedulerJobState, startedAtMs: number): void {
    const run: ActiveRun = {
      id: this.nextRunId++,
      startedAt: startedAtMs,
      controller: new AbortController(),
    };
    job.activeRuns.set(run.id, run);
    job.startedTotal += 1;
    job.lastQueueDelayMs = Math.max(0, startedAtMs - job.nextRunAt);
    job.lastStartedAt = new Date(startedAtMs).toISOString();
    job.nextRunAt = startedAtMs + job.intervalMs;
    this.activeRuns += 1;
    void this.execute(job, run).then((outcome) => this.complete(job, run, outcome));
  }

  private async execute(job: QueueSchedulerJobState, run: ActiveRun): Promise<RunOutcome> {
    const maxAttempts = job.maxRetries + 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (run.controller.signal.aborted)
        return { status: "cancelled", error: "scheduler_stopping" };
      const attemptController = new AbortController();
      const cancelAttempt = () =>
        attemptController.abort(run.controller.signal.reason ?? new Error("scheduler_stopping"));
      run.controller.signal.addEventListener("abort", cancelAttempt, { once: true });
      let timeout: ReturnType<typeof setTimeout> | null = null;
      let timedOut = false;
      try {
        const operation = Promise.resolve(
          job.run(attemptController.signal, { attempt, max_attempts: maxAttempts }),
        );
        const timeoutOperation = new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            timedOut = true;
            const error = new Error(`queue_execution_timeout:${job.name}:${job.timeoutMs}`);
            attemptController.abort(error);
            reject(error);
          }, job.timeoutMs);
        });
        const value = await Promise.race([operation, timeoutOperation]);
        if (run.controller.signal.aborted)
          return { status: "cancelled", error: "scheduler_stopping" };
        return { status: "succeeded", observation: runObservation(value) };
      } catch (error) {
        if (run.controller.signal.aborted)
          return { status: "cancelled", error: "scheduler_stopping" };
        if (timedOut) return { status: "timed_out", error: errorMessage(error) };
        if (attempt >= maxAttempts) return { status: "failed", error: errorMessage(error) };
        job.retryTotal += 1;
        try {
          await abortableDelay(job.retryDelayMs * attempt, run.controller.signal);
        } catch {
          return { status: "cancelled", error: "scheduler_stopping" };
        }
      } finally {
        if (timeout) clearTimeout(timeout);
        run.controller.signal.removeEventListener("abort", cancelAttempt);
      }
    }
    return { status: "failed", error: "queue_execution_failed" };
  }

  private async complete(
    job: QueueSchedulerJobState,
    run: ActiveRun,
    outcome: RunOutcome,
  ): Promise<void> {
    const completedAt = this.now();
    job.activeRuns.delete(run.id);
    job.completedTotal += 1;
    job.lastCompletedAt = completedAt.toISOString();
    if (outcome.status === "succeeded") {
      job.consecutiveFailures = 0;
      job.lastError = null;
      if (outcome.observation) {
        job.lastResult = outcome.observation;
        job.lastResultAt = completedAt.toISOString();
      }
    } else if (outcome.status === "cancelled") {
      job.cancelledTotal += 1;
      job.lastError = outcome.error;
    } else {
      job.failedTotal += 1;
      job.consecutiveFailures += 1;
      job.lastFailedAt = completedAt.toISOString();
      job.lastError = outcome.error;
      if (outcome.status === "timed_out") job.timedOutTotal += 1;
      if (job.consecutiveFailures >= job.circuitFailureThreshold) {
        job.circuitOpenUntil = completedAt.getTime() + job.circuitCooldownMs;
        job.nextRunAt = Math.max(job.nextRunAt, job.circuitOpenUntil);
      }
    }
    this.activeRuns = Math.max(0, this.activeRuns - 1);
    this.completions.push({
      failed: outcome.status === "failed" || outcome.status === "timed_out",
      at: completedAt.getTime(),
    });
    this.pruneCompletions(completedAt.getTime());
    await this.publish();
  }

  private pruneCompletions(nowMs: number): void {
    while (this.completions[0] && this.completions[0].at < nowMs - 60_000) this.completions.shift();
  }

  private async publish(): Promise<void> {
    if (!this.options.onSnapshot) return;
    try {
      await this.options.onSnapshot(this.snapshot());
      this.lastSnapshotError = null;
    } catch (error) {
      this.snapshotPublishFailedTotal += 1;
      this.lastSnapshotError = "snapshot_publish_failed";
      try {
        await this.options.onSnapshotError?.(error);
      } catch {
        // Snapshot diagnostics must never alter queue execution state.
      }
    }
  }
}
