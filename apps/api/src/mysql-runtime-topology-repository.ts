import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type {
  RuntimeNodeRole,
  RuntimeNodeSnapshot,
  RuntimeNodeStatus,
} from "@scoutops/runtime-topology";
import type { RuntimeTopologyRepository } from "./runtime-topology-service.js";

const isoDate = (value: unknown) => new Date(String(value));

export class MySqlRuntimeTopologyRepository implements RuntimeTopologyRepository {
  constructor(private readonly pool: Pool) {}

  async snapshot(now: Date) {
    const [[nodes], [processRows]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        "SELECT node_id,host_id,role,status,region_code,zone_code,build_sha,app_version," +
          "last_heartbeat_at FROM runtime_nodes ORDER BY role,node_id",
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT process_name,status,restart_count,observed_at FROM (" +
          "SELECT process_name,status,restart_count,observed_at FROM " +
          "runtime_process_restart_observations WHERE observed_at>=? " +
          "ORDER BY observed_at DESC,process_name LIMIT 600) recent " +
          "ORDER BY observed_at,process_name",
        [new Date(now.getTime() - 86_400_000)],
      ),
    ]);
    return {
      nodes: nodes.map((row): RuntimeNodeSnapshot => ({
        nodeId: String(row.node_id),
        hostId: String(row.host_id),
        role: String(row.role) as RuntimeNodeRole,
        status: String(row.status) as RuntimeNodeStatus,
        region: String(row.region_code),
        zone: String(row.zone_code),
        buildSha: String(row.build_sha),
        version: String(row.app_version),
        lastHeartbeatAt: isoDate(row.last_heartbeat_at),
      })),
      processHistory: processRows.map((row) => ({
        process_name: String(row.process_name),
        status: String(row.status),
        restart_count: Number(row.restart_count),
        observed_at: isoDate(row.observed_at).toISOString(),
      })),
    };
  }

  async recordView(input: {
    actorId: string;
    requestId: string;
    traceId: string;
    observedAt: Date;
    state: string;
    activeApiInstances: number;
    processes: Array<{ name: string; status: string; restartCount: number }>;
  }) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        "INSERT INTO runtime_topology_views(id,actor_id,request_id,trace_id,observed_at) VALUES(?,?,?,?,?)",
        [randomUUID(), input.actorId, input.requestId, input.traceId, input.observedAt],
      );
      const sampleBucketAt = new Date(Math.floor(input.observedAt.getTime() / 300_000) * 300_000);
      for (const process of input.processes)
        await connection.query(
          "INSERT INTO runtime_process_restart_observations(id,process_name,status,restart_count," +
            "sample_bucket_at,request_id,trace_id,observed_at) VALUES(?,?,?,?,?,?,?,?) " +
            "ON DUPLICATE KEY UPDATE status=VALUES(status),restart_count=VALUES(restart_count)," +
            "request_id=VALUES(request_id),trace_id=VALUES(trace_id),observed_at=VALUES(observed_at)",
          [
            randomUUID(),
            process.name,
            process.status,
            process.restartCount,
            sampleBucketAt,
            input.requestId,
            input.traceId,
            input.observedAt,
          ],
        );
      await connection.query(
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id," +
          "action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at," +
          "schema_version) VALUES(?,NULL,NULL,?,'platform.runtime_topology.read','runtime_topology'," +
          "NULL,'succeeded',?,?,?,?,1)",
        [
          randomUUID(),
          input.actorId,
          input.requestId,
          input.traceId,
          JSON.stringify({
            state: input.state,
            active_api_instances: input.activeApiInstances,
            mode: "single_host",
          }),
          input.observedAt,
        ],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async heartbeat(input: {
    nodeId: string;
    hostId: string;
    region: string;
    zone: string;
    buildSha: string;
    version: string;
    status: "starting" | "ready" | "degraded" | "draining" | "stopped";
    requestId: string;
    traceId: string;
    observedAt: Date;
  }) {
    const connection = await this.pool.getConnection();
    const nodeRecordId = randomUUID();
    try {
      await connection.beginTransaction();
      await connection.query(
        "INSERT INTO runtime_nodes(id,organization_id,workspace_id,node_id,host_id," +
          "role,manager,region_code,zone_code,build_sha,app_version,status,started_at," +
          "last_heartbeat_at,created_at,updated_at) VALUES(?,NULL,NULL,?,?,'api','baota'," +
          "?,?,?,?,?,?,?, ?,?) ON DUPLICATE KEY UPDATE host_id=VALUES(host_id),region_code=VALUES(region_code)," +
          "zone_code=VALUES(zone_code),build_sha=VALUES(build_sha),app_version=VALUES(app_version)," +
          "status=VALUES(status),last_heartbeat_at=VALUES(last_heartbeat_at),updated_at=VALUES(updated_at)",
        [
          nodeRecordId,
          input.nodeId,
          input.hostId,
          input.region,
          input.zone,
          input.buildSha,
          input.version,
          input.status,
          input.observedAt,
          input.observedAt,
          input.observedAt,
          input.observedAt,
        ],
      );
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM runtime_nodes WHERE node_id=? FOR UPDATE",
        [input.nodeId],
      );
      await connection.query(
        "INSERT INTO runtime_node_heartbeats(id,runtime_node_id,organization_id,workspace_id," +
          "status,active_connections,sse_connections,request_rate_per_minute,error_basis_points," +
          "latency_p95_ms,request_id,trace_id,observed_at) VALUES(?,?,NULL,NULL,?,0," +
          "0,0,0,0,?,?,?)",
        [randomUUID(), rows[0]?.id, input.status, input.requestId, input.traceId, input.observedAt],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
