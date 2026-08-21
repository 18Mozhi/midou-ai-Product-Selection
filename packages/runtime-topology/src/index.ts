export type RuntimeNodeRole = "api" | "worker" | "crawler";
export type RuntimeNodeStatus = "starting" | "ready" | "degraded" | "draining" | "stopped";

export interface RuntimeNodeSnapshot {
  nodeId: string;
  hostId: string;
  role: RuntimeNodeRole;
  status: RuntimeNodeStatus;
  region?: string;
  zone?: string;
  buildSha?: string;
  version?: string;
  lastHeartbeatAt: Date;
}

export interface RuntimeTopologyBlocker {
  code:
    | "runtime_nodes_empty"
    | "api_node_missing"
    | "api_unavailable"
    | "api_host_identity_mismatch"
    | "api_heartbeat_stale";
  actionHint: string;
}

export interface RuntimeTopologyEvaluation {
  state: "ready" | "blocked" | "stale" | "empty";
  activeApiInstances: number;
  singleHost: true;
  staleNodeIds: string[];
  blockers: RuntimeTopologyBlocker[];
}

export function evaluateRuntimeTopology(input: {
  now: Date;
  staleAfterMs: number;
  expectedNodeId: string;
  expectedHostId: string;
  nodes: RuntimeNodeSnapshot[];
}): RuntimeTopologyEvaluation {
  if (!Number.isFinite(input.now.getTime())) throw new Error("runtime_topology_now_invalid");
  if (!Number.isSafeInteger(input.staleAfterMs) || input.staleAfterMs < 1_000)
    throw new Error("runtime_topology_stale_window_invalid");
  if (!input.expectedNodeId.trim()) throw new Error("runtime_topology_node_id_invalid");
  if (!input.expectedHostId.trim()) throw new Error("runtime_topology_host_id_invalid");

  const apiNodes = input.nodes.filter((node) => node.role === "api");
  const expectedNode = apiNodes.find((node) => node.nodeId === input.expectedNodeId);
  const staleNodeIds =
    expectedNode &&
    (!Number.isFinite(expectedNode.lastHeartbeatAt.getTime()) ||
      input.now.getTime() - expectedNode.lastHeartbeatAt.getTime() > input.staleAfterMs)
      ? [expectedNode.nodeId]
      : [];
  const blockers: RuntimeTopologyBlocker[] = [];
  if (apiNodes.length === 0)
    blockers.push({
      code: "runtime_nodes_empty",
      actionHint: "由当前宝塔 Node API 写入首次运行心跳后重新检查。",
    });
  else if (!expectedNode)
    blockers.push({
      code: "api_node_missing",
      actionHint: "核对宝塔 Node API 的 RUNTIME_NODE_ID，并重启当前项目写入心跳。",
    });
  if (expectedNode && expectedNode.hostId !== input.expectedHostId)
    blockers.push({
      code: "api_host_identity_mismatch",
      actionHint: "核对当前单机的 RUNTIME_HOST_ID，禁止复用其他主机身份。",
    });
  if (staleNodeIds.length > 0)
    blockers.push({
      code: "api_heartbeat_stale",
      actionHint: "在宝塔检查当前 Node API 项目、日志和健康端点，恢复后重新观察。",
    });
  if (expectedNode && expectedNode.status !== "ready")
    blockers.push({
      code: "api_unavailable",
      actionHint: "通过宝塔恢复当前 Node API，确认 ready 后重新验收。",
    });

  const ready = Boolean(
    expectedNode &&
    expectedNode.hostId === input.expectedHostId &&
    expectedNode.status === "ready" &&
    staleNodeIds.length === 0,
  );
  return {
    state:
      apiNodes.length === 0
        ? "empty"
        : staleNodeIds.length > 0
          ? "stale"
          : ready && blockers.length === 0
            ? "ready"
            : "blocked",
    activeApiInstances: ready ? 1 : 0,
    singleHost: true,
    staleNodeIds,
    blockers,
  };
}
