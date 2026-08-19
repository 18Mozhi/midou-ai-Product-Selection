import { evaluateRuntimeTopology, type RuntimeNodeSnapshot } from "@scoutops/runtime-topology";

export interface RuntimeTopologyRepository {
  snapshot(): Promise<{nodes: RuntimeNodeSnapshot[]}>;
  recordView(input: {actorId: string; requestId: string; traceId: string; observedAt: Date; state: string; activeApiInstances: number}): Promise<void>;
  heartbeat(input: {nodeId: string; hostId: string; region: string; zone: string; buildSha: string; version: string; status: "starting" | "ready" | "degraded" | "draining" | "stopped"; requestId: string; traceId: string; observedAt: Date}): Promise<void>;
}

export interface RuntimeTopologyPolicy {
  expectedNodeId: string;
  expectedHostId: string;
  staleAfterMs: number;
  restartAlertThreshold?: number;
  workerSchedulerStaleAfterMs?: number;
  workerSchedulerSnapshot?: () => Promise<null | {
    status: "running" | "stopping" | "stopped";
    max_concurrency: number;
    active_runs: number;
    due_queue_count: number;
    backpressure: boolean;
    max_queue_delay_ms: number;
    completed_last_minute: number;
    failed_last_minute: number;
    failure_rate_percent: number;
    queues: Array<{
      name: string;
      priority: number;
      running: boolean;
      queue_delay_ms: number;
      failed_total: number;
      deferred_total: number;
    }>;
    observed_at: string;
  }>;
  supervisorSnapshot?: () => Promise<null | {
    supervisor_pid: number;
    status: string;
    processes: Record<string, { status: string; pid: number | null; restart_count: number; circuit_open_until: string | null }>;
    observed_at: string;
  }>;
}

export class RuntimeTopologyService {
  constructor(private readonly repository: RuntimeTopologyRepository, private readonly policy: RuntimeTopologyPolicy, private readonly now = () => new Date()) {}

  private async evaluate() {
    const observedAt = this.now();
    const snapshot = await this.repository.snapshot();
    const supervisor = await this.policy.supervisorSnapshot?.().catch(() => null) ?? null;
    const workerScheduler = await this.policy.workerSchedulerSnapshot?.().catch(() => null) ?? null;
    const evaluation = evaluateRuntimeTopology({
      now: observedAt,
      staleAfterMs: this.policy.staleAfterMs,
      expectedNodeId: this.policy.expectedNodeId,
      expectedHostId: this.policy.expectedHostId,
      nodes: snapshot.nodes,
    });
    const workerSchedulerRequired = Boolean(this.policy.workerSchedulerSnapshot);
    const workerSchedulerAgeMs = workerScheduler
      ? observedAt.getTime() - Date.parse(workerScheduler.observed_at)
      : Number.POSITIVE_INFINITY;
    const workerSchedulerFresh =
      !workerSchedulerRequired ||
      Boolean(
        workerScheduler &&
          workerScheduler.status === "running" &&
          Number.isFinite(workerSchedulerAgeMs) &&
          workerSchedulerAgeMs >= 0 &&
          workerSchedulerAgeMs <= (this.policy.workerSchedulerStaleAfterMs ?? 90_000),
      );
    const alerts: Array<{code: string; severity: "warning" | "critical"; actionHint: string}> = [];
    if (!workerSchedulerFresh)
      alerts.push({
        code: "worker_scheduler_heartbeat_stale",
        severity: "critical",
        actionHint: "在宝塔检查 Node Worker，并确认调度状态文件持续更新。",
      });
    if (workerScheduler?.backpressure)
      alerts.push({
        code: "worker_scheduler_backpressure",
        severity: "warning",
        actionHint: "优先处理高优先级积压；确认资源水位后再调整 Worker 并发配额。",
      });
    if ((workerScheduler?.failed_last_minute ?? 0) > 0)
      alerts.push({
        code: "worker_scheduler_recent_failures",
        severity: "warning",
        actionHint: "按失败队列下钻日志并携带 request_id 处理依赖错误。",
      });
    if (
      supervisor &&
      Object.values(supervisor.processes).some(
        (process) => process.restart_count >= (this.policy.restartAlertThreshold ?? 5),
      )
    )
      alerts.push({
        code: "backend_restart_loop",
        severity: "critical",
        actionHint: "停止继续重启，在宝塔检查最近一次退出原因和熔断时间。",
      });
    const state = !workerSchedulerFresh && evaluation.state === "ready"
      ? "stale"
      : evaluation.state;
    return {
      _node_state: evaluation.state,
      state,
      mode: "single_host" as const,
      active_api_instances: evaluation.activeApiInstances,
      single_host: true,
      stale_node_count: evaluation.staleNodeIds.length,
      nodes: snapshot.nodes
        .filter((node) => node.nodeId === this.policy.expectedNodeId)
        .map((node) => ({node_id: node.nodeId, host_id: node.hostId, role: node.role, status: node.status, region: node.region, zone: node.zone, build_sha: node.buildSha, version: node.version, last_heartbeat_at: node.lastHeartbeatAt.toISOString()})),
      processes: supervisor ? Object.entries(supervisor.processes).map(([name, process]) => ({ name, status: process.status, pid: process.pid, restart_count: process.restart_count, circuit_open_until: process.circuit_open_until })) : [],
      worker_scheduler: workerScheduler,
      supervisor_pid: supervisor?.supervisor_pid ?? null,
      blockers: [...evaluation.blockers, ...(supervisor && supervisor.status !== "ready" ? [{ code: "backend_supervisor_degraded", actionHint: "在宝塔检查 API/Worker 子进程和连续重启记录。" }] : [])],
      alerts,
      load_balancing_enabled: false,
      backup_server_used: false,
      multi_node_claim: false,
      capacity_claim: "unverified" as const,
      observed_at: observedAt.toISOString(),
    };
  }

  async read(input: {actorId: string; requestId: string; traceId: string}) {
    const evaluated = await this.evaluate();
    const {_node_state: _nodeState, ...result} = evaluated;
    await this.repository.recordView({actorId: input.actorId, requestId: input.requestId, traceId: input.traceId, observedAt: new Date(result.observed_at), state: result.state, activeApiInstances: result.active_api_instances});
    return result;
  }

  async publicHealth() {
    const result = await this.evaluate();
    return {state: result._node_state, mode: result.mode, active_api_instances: result.active_api_instances, single_host: result.single_host, stale_node_count: result.stale_node_count, observed_at: result.observed_at};
  }

  async businessHealth() {
    const result = await this.evaluate();
    const status = result.state !== "ready" || result.alerts.some((item) => item.severity === "critical")
      ? "unavailable"
      : result.alerts.length
        ? "degraded"
        : "available";
    return {
      status,
      services: {
        api: result.state === "ready" ? "available" : "unavailable",
        worker: result.worker_scheduler
          ? result.worker_scheduler.status === "running" &&
            !result.alerts.some((item) => item.code === "worker_scheduler_heartbeat_stale")
            ? "available"
            : "unavailable"
          : this.policy.workerSchedulerSnapshot
            ? "unavailable"
            : "not_observed",
      },
      observed_at: result.observed_at,
    } as const;
  }
}
