export interface QueueSchedulerJob {
  name: string;
  intervalMs: number;
  priority: number;
  run(): Promise<unknown>;
}

interface QueueSchedulerJobState extends QueueSchedulerJob {
  nextRunAt: number;
  running: boolean;
  startedTotal: number;
  completedTotal: number;
  failedTotal: number;
  deferredTotal: number;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  lastError: string | null;
  lastQueueDelayMs: number;
}

interface CompletionEvent {
  failed: boolean;
  at: number;
}

export interface QueueSchedulerSnapshot {
  status: "running" | "stopping" | "stopped";
  max_concurrency: number;
  active_runs: number;
  due_queue_count: number;
  backpressure: boolean;
  max_queue_delay_ms: number;
  started_total: number;
  completed_total: number;
  failed_total: number;
  deferred_total: number;
  completed_last_minute: number;
  failed_last_minute: number;
  failure_rate_percent: number;
  queues: Array<{
    name: string;
    priority: number;
    interval_ms: number;
    running: boolean;
    queue_delay_ms: number;
    started_total: number;
    completed_total: number;
    failed_total: number;
    deferred_total: number;
    last_started_at: string | null;
    last_completed_at: string | null;
    last_failed_at: string | null;
    last_error: string | null;
  }>;
  observed_at: string;
}

export class QueueScheduler {
  private readonly jobs: QueueSchedulerJobState[] = [];
  private readonly completions: CompletionEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private status: QueueSchedulerSnapshot["status"] = "stopped";
  private activeRuns = 0;
  private ticking = false;

  constructor(
    private readonly options: {
      maxConcurrency: number;
      tickMs: number;
      now?: () => Date;
      onSnapshot?: (snapshot: QueueSchedulerSnapshot) => void | Promise<void>;
    },
  ) {}

  register(job: QueueSchedulerJob): this {
    if (this.status !== "stopped") throw new Error("scheduler_already_started");
    if (this.jobs.some((item) => item.name === job.name))
      throw new Error(`scheduler_job_duplicate:${job.name}`);
    const now = this.now().getTime();
    this.jobs.push({
      ...job,
      nextRunAt: now,
      running: false,
      startedTotal: 0,
      completedTotal: 0,
      failedTotal: 0,
      deferredTotal: 0,
      lastStartedAt: null,
      lastCompletedAt: null,
      lastFailedAt: null,
      lastError: null,
      lastQueueDelayMs: 0,
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
    await this.publish();
    while (this.activeRuns > 0)
      await new Promise((resolve) => setTimeout(resolve, 25));
    this.status = "stopped";
    await this.publish();
  }

  snapshot(): QueueSchedulerSnapshot {
    const observedAt = this.now();
    const nowMs = observedAt.getTime();
    this.pruneCompletions(nowMs);
    const due = this.jobs.filter((job) => !job.running && job.nextRunAt <= nowMs);
    const completedLastMinute = this.completions.length;
    const failedLastMinute = this.completions.filter((item) => item.failed).length;
    return {
      status: this.status,
      max_concurrency: this.options.maxConcurrency,
      active_runs: this.activeRuns,
      due_queue_count: due.length,
      backpressure: due.length > Math.max(0, this.options.maxConcurrency - this.activeRuns),
      max_queue_delay_ms: Math.max(0, ...due.map((job) => nowMs - job.nextRunAt)),
      started_total: this.jobs.reduce((total, job) => total + job.startedTotal, 0),
      completed_total: this.jobs.reduce((total, job) => total + job.completedTotal, 0),
      failed_total: this.jobs.reduce((total, job) => total + job.failedTotal, 0),
      deferred_total: this.jobs.reduce((total, job) => total + job.deferredTotal, 0),
      completed_last_minute: completedLastMinute,
      failed_last_minute: failedLastMinute,
      failure_rate_percent:
        completedLastMinute === 0
          ? 0
          : Math.round((failedLastMinute / completedLastMinute) * 10_000) / 100,
      queues: this.jobs
        .slice()
        .sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name))
        .map((job) => ({
          name: job.name,
          priority: job.priority,
          interval_ms: job.intervalMs,
          running: job.running,
          queue_delay_ms: job.lastQueueDelayMs,
          started_total: job.startedTotal,
          completed_total: job.completedTotal,
          failed_total: job.failedTotal,
          deferred_total: job.deferredTotal,
          last_started_at: job.lastStartedAt,
          last_completed_at: job.lastCompletedAt,
          last_failed_at: job.lastFailedAt,
          last_error: job.lastError,
        })),
      observed_at: observedAt.toISOString(),
    };
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private async tick(): Promise<void> {
    if (this.status !== "running" || this.ticking) return;
    this.ticking = true;
    try {
      const nowMs = this.now().getTime();
      const due = this.jobs
        .filter((job) => !job.running && job.nextRunAt <= nowMs)
        .sort((left, right) => right.priority - left.priority || left.nextRunAt - right.nextRunAt);
      const available = Math.max(0, this.options.maxConcurrency - this.activeRuns);
      const selected = due.slice(0, available);
      for (const job of due.slice(available)) job.deferredTotal += 1;
      for (const job of selected) this.launch(job, nowMs);
      await this.publish();
    } finally {
      this.ticking = false;
    }
  }

  private launch(job: QueueSchedulerJobState, startedAtMs: number): void {
    job.running = true;
    job.startedTotal += 1;
    job.lastQueueDelayMs = Math.max(0, startedAtMs - job.nextRunAt);
    job.lastStartedAt = new Date(startedAtMs).toISOString();
    job.nextRunAt = startedAtMs + job.intervalMs;
    this.activeRuns += 1;
    void job
      .run()
      .then(() => this.complete(job, false))
      .catch((error: unknown) => {
        job.lastError = error instanceof Error ? error.message.slice(0, 240) : "unknown";
        return this.complete(job, true);
      });
  }

  private async complete(job: QueueSchedulerJobState, failed: boolean): Promise<void> {
    const completedAt = this.now();
    job.running = false;
    job.completedTotal += 1;
    job.lastCompletedAt = completedAt.toISOString();
    if (failed) {
      job.failedTotal += 1;
      job.lastFailedAt = completedAt.toISOString();
    } else {
      job.lastError = null;
    }
    this.activeRuns -= 1;
    this.completions.push({ failed, at: completedAt.getTime() });
    this.pruneCompletions(completedAt.getTime());
    await this.publish();
  }

  private pruneCompletions(nowMs: number): void {
    while (this.completions[0] && this.completions[0].at < nowMs - 60_000)
      this.completions.shift();
  }

  private async publish(): Promise<void> {
    await this.options.onSnapshot?.(this.snapshot());
  }
}
