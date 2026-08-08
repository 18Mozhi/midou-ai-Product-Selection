// @ts-nocheck -- MySQL rows are normalized before leaving the repository.
import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { ReleaseRolloutRepository } from "./release-rollout-service.js";
const iso = (value: unknown) => value ? new Date(value as string | Date).toISOString() : null;

export class MySqlReleaseRolloutRepository implements ReleaseRolloutRepository {
  constructor(private readonly pool: Pool) {}
  async read(input: { actorId: string; requestId: string; traceId: string; now: Date }) {
    const [[releaseRows], [gateRows]] = await Promise.all([
      this.pool.query<RowDataPacket[]>("SELECT id,stage,app_version,build_sha,config_fingerprint,migration_version,status,approved_by,request_id,trace_id,started_at,finished_at,created_at,updated_at FROM deployment_releases ORDER BY COALESCE(started_at,created_at) DESC LIMIT 10"),
      this.pool.query<RowDataPacket[]>("SELECT id,release_id,gate_kind,status,traffic_percent,observe_seconds,sample_count,error_rate_percent,read_p95_ms,write_p95_ms,async_lag_seconds,failure_code,started_at,finished_at,request_id,trace_id,metadata FROM deployment_release_gates WHERE release_id=(SELECT id FROM deployment_releases ORDER BY COALESCE(started_at,created_at) DESC LIMIT 1) ORDER BY started_at,gate_kind"),
    ]);
    const releases = releaseRows.map((row) => ({ ...row, started_at: iso(row.started_at), finished_at: iso(row.finished_at), created_at: iso(row.created_at), updated_at: iso(row.updated_at) }));
    const gates = gateRows.map((row) => ({ ...row, traffic_percent: Number(row.traffic_percent), observe_seconds: Number(row.observe_seconds), sample_count: Number(row.sample_count), error_rate_percent: row.error_rate_percent === null ? null : Number(row.error_rate_percent), read_p95_ms: row.read_p95_ms === null ? null : Number(row.read_p95_ms), write_p95_ms: row.write_p95_ms === null ? null : Number(row.write_p95_ms), async_lag_seconds: row.async_lag_seconds === null ? null : Number(row.async_lag_seconds), started_at: iso(row.started_at), finished_at: iso(row.finished_at) }));
    await this.pool.query("INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) VALUES(?,NULL,NULL,?,'platform.release_rollout.read','deployment_release',?,'succeeded',?,?,?,?,1)", [randomUUID(), input.actorId, releases[0]?.id ?? null, input.requestId, input.traceId, JSON.stringify({ release_count: releases.length, gate_count: gates.length }), input.now]);
    return { releases, gates };
  }
}
