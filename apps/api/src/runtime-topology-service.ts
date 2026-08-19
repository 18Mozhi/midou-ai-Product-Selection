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
    const evaluation = evaluateRuntimeTopology({
      now: observedAt,
      staleAfterMs: this.policy.staleAfterMs,
      expectedNodeId: this.policy.expectedNodeId,
      expectedHostId: this.policy.expectedHostId,
      nodes: snapshot.nodes,
    });
    return {
      state: evaluation.state,
      mode: "single_host" as const,
      active_api_instances: evaluation.activeApiInstances,
      single_host: true,
      stale_node_count: evaluation.staleNodeIds.length,
      nodes: snapshot.nodes
        .filter((node) => node.nodeId === this.policy.expectedNodeId)
        .map((node) => ({node_id: node.nodeId, host_id: node.hostId, role: node.role, status: node.status, region: node.region, zone: node.zone, build_sha: node.buildSha, version: node.version, last_heartbeat_at: node.lastHeartbeatAt.toISOString()})),
      processes: supervisor ? Object.entries(supervisor.processes).map(([name, process]) => ({ name, status: process.status, pid: process.pid, restart_count: process.restart_count, circuit_open_until: process.circuit_open_until })) : [],
      supervisor_pid: supervisor?.supervisor_pid ?? null,
      blockers: [...evaluation.blockers, ...(supervisor && supervisor.status !== "ready" ? [{ code: "backend_supervisor_degraded", actionHint: "在宝塔检查 API/Worker 子进程和连续重启记录。" }] : [])],
      load_balancing_enabled: false,
      backup_server_used: false,
      multi_node_claim: false,
      capacity_claim: "unverified" as const,
      observed_at: observedAt.toISOString(),
    };
  }

  async read(input: {actorId: string; requestId: string; traceId: string}) {
    const result = await this.evaluate();
    await this.repository.recordView({actorId: input.actorId, requestId: input.requestId, traceId: input.traceId, observedAt: new Date(result.observed_at), state: result.state, activeApiInstances: result.active_api_instances});
    return result;
  }

  async publicHealth() {
    const result = await this.evaluate();
    return {state: result.state, mode: result.mode, active_api_instances: result.active_api_instances, single_host: result.single_host, stale_node_count: result.stale_node_count, observed_at: result.observed_at};
  }
}
