export type CrawlerSchedulerState = "ready" | "warning" | "blocked";
export interface CrawlerSchedulerPolicy {
  maximumWorkers: 1;
  maximumCrawlers: 1;
  maximumProviderConcurrency: 1;
  maximumLoadBasisPoints: number;
  minimumAvailableMemoryMb: number;
  minimumFreeDiskMb: number;
  staleAfterSeconds: number;
}
export interface CrawlerSchedulerProvider {
  id: string;
  code: string;
  configured_concurrency: number;
  effective_concurrency: number;
  active_leases: number;
  queued_tasks: number;
  longest_queue_wait_seconds: number;
  queue_wait_p50_seconds: number;
  queue_wait_p95_seconds: number;
  sample_count_24h: number;
  success_rate_basis_points_24h: number | null;
  duration_p95_ms_24h: number | null;
  circuit_state: "closed" | "open";
  circuit_failure_threshold: number;
  consecutive_failures: number;
  last_error_code: string | null;
}
export interface CrawlerSchedulerProfile {
  id: string;
  active_leases: number;
}
export interface CrawlerSchedulerLeaseAssociation {
  slot_type: "worker" | "crawler" | "provider";
  provider_name: string | null;
  task_id: string | null;
  task_status: string | null;
  run_id: string | null;
  process_role: "node_worker" | "python_crawler";
  process_ref: string;
  heartbeat_at: string;
  expires_at: string;
}
export interface CrawlerSchedulerSnapshot {
  worker_instances: number;
  crawler_instances: number;
  active_worker_leases: number;
  active_crawler_leases: number;
  duplicate_lease_count: number;
  expired_leases: {
    total: number;
    task_count: number;
    worker: number;
    crawler: number;
    provider: number;
    oldest_expired_at: string | null;
  };
  active_leases: CrawlerSchedulerLeaseAssociation[];
  providers: CrawlerSchedulerProvider[];
  profiles: CrawlerSchedulerProfile[];
  trend: Array<{
    bucket_at: string;
    total: number;
    succeeded: number;
    failed: number;
    failure_rate_basis_points: number;
  }>;
  resource: {
    load_basis_points: number;
    available_memory_mb: number;
    free_disk_mb: number;
    observed_at: string;
  };
  receipt_spool: null | {
    pending_count: number;
    pending_bytes: number;
    quarantined_count: number;
    quarantined_bytes: number;
    oldest_pending_at: string | null;
    retention_days: number;
    max_bytes: number;
    minimum_free_disk_mb: number;
    free_disk_mb: number;
    observed_at: string;
  };
}
export interface CrawlerSchedulerFinding {
  code: string;
  severity: "warning" | "blocked";
  action_hint: string;
}
export interface CrawlerSchedulerEvaluation {
  state: CrawlerSchedulerState;
  findings: CrawlerSchedulerFinding[];
}
export interface CrawlerSchedulerRepository {
  snapshot(
    now: Date,
    signal?: AbortSignal,
  ): Promise<Omit<CrawlerSchedulerSnapshot, "worker_instances" | "crawler_instances" | "resource">>;
  record(input: {
    actorId: string;
    requestId: string;
    traceId: string;
    observedAt: Date;
    snapshot: CrawlerSchedulerSnapshot;
    evaluation: CrawlerSchedulerEvaluation;
    signal?: AbortSignal;
  }): Promise<void>;
  recoverExpired(input: {
    actorId: string;
    requestId: string;
    traceId: string;
    idempotencyKey: string;
    now: Date;
  }): Promise<{ recovered: number }>;
  recoverProvider(input: {
    actorId: string;
    providerId: string;
    requestId: string;
    traceId: string;
    idempotencyKey: string;
    now: Date;
  }): Promise<{ provider_id: string; recovered: boolean }>;
}
export interface CrawlerSchedulerHostProbe {
  snapshot(): Promise<
    Pick<CrawlerSchedulerSnapshot, "worker_instances" | "crawler_instances" | "resource">
  >;
}
export class CrawlerSchedulerError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly actionHint: string,
  ) {
    super(code);
    this.name = "CrawlerSchedulerError";
  }
}

export function evaluateCrawlerScheduler(
  snapshot: CrawlerSchedulerSnapshot,
  policy: CrawlerSchedulerPolicy,
  now = new Date(),
): CrawlerSchedulerEvaluation {
  const findings: CrawlerSchedulerFinding[] = [];
  const blocked = (code: string, action_hint: string) =>
      findings.push({ code, severity: "blocked", action_hint }),
    warning = (code: string, action_hint: string) =>
      findings.push({ code, severity: "warning", action_hint });
  if (snapshot.worker_instances !== policy.maximumWorkers)
    blocked(
      "crawler_worker_count_exceeded",
      "通过宝塔检查 ai选品 统一后端，只保留一个受托管 Worker 并重新核验。",
    );
  if (snapshot.crawler_instances !== policy.maximumCrawlers)
    blocked(
      "crawler_process_count_exceeded",
      "通过宝塔检查 ai选品 统一后端内的采集执行器并重新核验。",
    );
  if (
    snapshot.active_worker_leases > policy.maximumWorkers ||
    snapshot.active_crawler_leases > policy.maximumCrawlers
  )
    blocked("crawler_global_concurrency_exceeded", "停止新增任务并等待当前单机租约释放。");
  if (
    snapshot.duplicate_lease_count > 0 ||
    snapshot.profiles.some((item) => item.active_leases > 1)
  )
    blocked("crawler_lease_duplicate", "通过宝塔有限任务回收过期租约并检查独占约束。");
  if (
    snapshot.providers.some(
      (item) =>
        item.effective_concurrency > policy.maximumProviderConcurrency ||
        item.active_leases > item.effective_concurrency,
    )
  )
    blocked("crawler_provider_quota_exceeded", "降低来源并发或等待该来源的活动租约释放。");
  if (snapshot.providers.some((item) => item.circuit_state === "open"))
    warning(
      "crawler_provider_circuit_open",
      "仅恢复已通过来源健康检查的熔断来源，其他来源继续独立运行。",
    );
  const age = (now.getTime() - Date.parse(snapshot.resource.observed_at)) / 1000;
  if (!Number.isFinite(age) || age < 0 || age > policy.staleAfterSeconds)
    blocked("crawler_resource_observation_stale", "刷新当前惠州单机资源观测后再调度。");
  if (
    snapshot.resource.load_basis_points >= policy.maximumLoadBasisPoints ||
    snapshot.resource.available_memory_mb < policy.minimumAvailableMemoryMb ||
    snapshot.resource.free_disk_mb < policy.minimumFreeDiskMb
  )
    blocked("crawler_resource_stop", "资源水位触及停止线，保持任务排队并通过宝塔排查。");
  else if (
    snapshot.resource.load_basis_points >= Math.round(policy.maximumLoadBasisPoints * 0.9) ||
    snapshot.resource.available_memory_mb < Math.ceil(policy.minimumAvailableMemoryMb * 1.25) ||
    snapshot.resource.free_disk_mb < Math.ceil(policy.minimumFreeDiskMb * 1.25)
  )
    warning("crawler_resource_warning", "资源接近停止线，暂缓扩大任务量并持续观察。");
  const spool = snapshot.receipt_spool;
  if (!spool)
    blocked("crawler_completion_spool_missing", "重启 Python Crawler 并确认完成回执水位已上报。");
  else {
    const observedAge = (now.getTime() - Date.parse(spool.observed_at)) / 1000,
      totalBytes = spool.pending_bytes + spool.quarantined_bytes,
      oldestAgeDays = spool.oldest_pending_at
        ? (now.getTime() - Date.parse(spool.oldest_pending_at)) / 86_400_000
        : 0;
    if (!Number.isFinite(observedAge) || observedAge < 0 || observedAge > policy.staleAfterSeconds)
      blocked("crawler_completion_spool_stale", "检查 Python Crawler 运行状态并恢复水位上报。");
    if (spool.free_disk_mb < spool.minimum_free_disk_mb)
      blocked(
        "crawler_completion_spool_disk_stop",
        "停止领取新作业并通过宝塔恢复受限运行目录磁盘水位。",
      );
    if (totalBytes >= spool.max_bytes)
      blocked(
        "crawler_completion_spool_capacity_stop",
        "停止领取新作业，优先恢复回写并人工审阅隔离回执。",
      );
    else if (totalBytes >= Math.round(spool.max_bytes * 0.8))
      warning(
        "crawler_completion_spool_capacity_warning",
        "回执目录已达到容量上限的 80%，优先恢复回写。",
      );
    if (spool.oldest_pending_at && oldestAgeDays >= spool.retention_days)
      warning(
        "crawler_completion_spool_retention_warning",
        "最老待回写回执已达到保留期；修复回写合同后人工处理，系统不会自动删除。",
      );
    if (spool.quarantined_count > 0)
      warning(
        "crawler_completion_spool_quarantine_pending",
        "隔离区存在重复不可重试或结构损坏回执，请按 correlation 人工审阅。",
      );
  }
  return {
    state: findings.some((item) => item.severity === "blocked")
      ? "blocked"
      : findings.length
        ? "warning"
        : "ready",
    findings,
  };
}

export class CrawlerSchedulerService {
  constructor(
    private readonly repository: CrawlerSchedulerRepository,
    private readonly hostProbe: CrawlerSchedulerHostProbe,
    private readonly policy: CrawlerSchedulerPolicy,
    private readonly now = () => new Date(),
  ) {}
  async read(input: { actorId: string; requestId: string; traceId: string; signal?: AbortSignal }) {
    input.signal?.throwIfAborted();
    const repositoryObservedAt = this.now(),
      snapshot = {
        ...(await this.repository.snapshot(repositoryObservedAt, input.signal)),
        ...(await this.hostProbe.snapshot()),
      },
      observedAt = this.now(),
      evaluation = evaluateCrawlerScheduler(snapshot, this.policy, observedAt);
    input.signal?.throwIfAborted();
    await this.repository.record({ ...input, observedAt, snapshot, evaluation });
    input.signal?.throwIfAborted();
    return {
      state: evaluation.state,
      topology: {
        mode: "single_host",
        worker_instances: snapshot.worker_instances,
        crawler_instances: snapshot.crawler_instances,
        maximum_workers: 1,
        maximum_crawlers: 1,
      },
      leases: {
        active_worker: snapshot.active_worker_leases,
        active_crawler: snapshot.active_crawler_leases,
        duplicate_count: snapshot.duplicate_lease_count,
      },
      expired_leases: snapshot.expired_leases,
      active_leases: snapshot.active_leases,
      providers: snapshot.providers,
      profiles: snapshot.profiles,
      trend: snapshot.trend,
      resource: snapshot.resource,
      receipt_spool: snapshot.receipt_spool,
      findings: evaluation.findings,
      observed_at: observedAt.toISOString(),
      capacity_claim: "unverified",
    };
  }
  async recoverExpired(input: {
    actorId: string;
    requestId: string;
    traceId: string;
    idempotencyKey: string;
  }) {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(input.idempotencyKey))
      throw new CrawlerSchedulerError(
        "crawler_scheduler_idempotency_invalid",
        400,
        "使用有效 Idempotency-Key 重试。",
      );
    return {
      ...(await this.repository.recoverExpired({ ...input, now: this.now() })),
      observed_at: this.now().toISOString(),
    };
  }
  async recoverProvider(input: {
    actorId: string;
    providerId: string;
    requestId: string;
    traceId: string;
    idempotencyKey: string;
  }) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        input.providerId,
      )
    )
      throw new CrawlerSchedulerError(
        "crawler_provider_id_invalid",
        400,
        "刷新调度页面后选择有效来源。",
      );
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(input.idempotencyKey))
      throw new CrawlerSchedulerError(
        "crawler_scheduler_idempotency_invalid",
        400,
        "使用有效 Idempotency-Key 重试。",
      );
    return this.repository.recoverProvider({ ...input, now: this.now() });
  }
}
