import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  RUNTIME_HEALTH_ENDPOINTS,
  type RuntimeHealthEndpoint,
  type RuntimeHealthEndpointSummary,
  type RuntimeHealthProbeOutcome,
  type RuntimeHealthProbeRepository,
} from "./runtime-health-probe.js";

const percentile = (values: number[], ratio: number) =>
  values.length ? values[Math.ceil(values.length * ratio) - 1]! : null;

export class MySqlRuntimeHealthProbeRepository implements RuntimeHealthProbeRepository {
  constructor(private readonly pool: Pool) {}

  async record(input: Parameters<RuntimeHealthProbeRepository["record"]>[0]) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const sample of input.samples)
        await connection.query(
          "INSERT INTO runtime_health_endpoint_probes(id,endpoint,outcome,status_code,latency_ms," +
            "request_id,trace_id,observed_at) VALUES(?,?,?,?,?,?,?,?)",
          [
            randomUUID(),
            sample.endpoint,
            sample.outcome,
            sample.statusCode,
            sample.latencyMs,
            sample.requestId,
            sample.traceId,
            sample.observedAt,
          ],
        );
      const retentionReference = input.samples.reduce(
        (latest, sample) => (sample.observedAt > latest ? sample.observedAt : latest),
        input.samples[0]?.observedAt ?? new Date(),
      );
      await connection.query(
        "DELETE FROM runtime_health_endpoint_probes WHERE observed_at<? ORDER BY observed_at LIMIT 1000",
        [new Date(retentionReference.getTime() - input.retentionHours * 3_600_000)],
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async summarize(input: Parameters<RuntimeHealthProbeRepository["summarize"]>[0]) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT endpoint,outcome,status_code,latency_ms,observed_at FROM " +
        "runtime_health_endpoint_probes WHERE observed_at>=? ORDER BY endpoint,observed_at",
      [new Date(input.observedAt.getTime() - input.windowMinutes * 60_000)],
    );
    const byEndpoint = new Map<RuntimeHealthEndpoint, RowDataPacket[]>();
    for (const row of rows) {
      const endpoint = String(row.endpoint) as RuntimeHealthEndpoint;
      const values = byEndpoint.get(endpoint) ?? [];
      values.push(row);
      byEndpoint.set(endpoint, values);
    }
    return RUNTIME_HEALTH_ENDPOINTS.map(({ endpoint }): RuntimeHealthEndpointSummary => {
      const samples = byEndpoint.get(endpoint) ?? [];
      const latencies = samples.map((row) => Number(row.latency_ms)).sort((a, b) => a - b);
      const count = (outcome: RuntimeHealthProbeOutcome) =>
        samples.filter((row) => row.outcome === outcome).length;
      const successCount = count("succeeded");
      const last = samples.at(-1);
      return {
        endpoint,
        sample_count: samples.length,
        success_count: successCount,
        http_error_count: count("http_error"),
        timeout_count: count("timeout"),
        network_error_count: count("network_error"),
        availability_basis_points: samples.length
          ? Math.round((successCount / samples.length) * 10_000)
          : 0,
        latency_p50_ms: percentile(latencies, 0.5),
        latency_p95_ms: percentile(latencies, 0.95),
        latency_p99_ms: percentile(latencies, 0.99),
        latency_max_ms: latencies.at(-1) ?? null,
        last_status_code: last?.status_code == null ? null : Number(last.status_code),
        last_outcome: last ? (String(last.outcome) as RuntimeHealthProbeOutcome) : null,
        last_observed_at: last ? new Date(last.observed_at).toISOString() : null,
      };
    });
  }
}
