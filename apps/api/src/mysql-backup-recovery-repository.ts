import { randomUUID } from "node:crypto";
import type { Pool, RowDataPacket } from "mysql2/promise";
import type { BackupRecoveryRepository } from "./backup-recovery-service.js";

const iso = (value: unknown) => (value ? new Date(value as string | Date).toISOString() : null);
const truth = (value: unknown) => Number(value) === 1;

export class MySqlBackupRecoveryRepository implements BackupRecoveryRepository {
  constructor(private readonly pool: Pick<Pool, "getConnection">) {}

  async read(input: Parameters<BackupRecoveryRepository["read"]>[0]) {
    input.signal?.throwIfAborted();
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      input.signal?.throwIfAborted();
      const [runsResult] = await connection.query<RowDataPacket[]>(
        "SELECT id,run_type,scope_type,status,primary_region,recovery_region,rpo_target_minutes," +
          "rto_target_minutes,actual_rpo_minutes,actual_rto_minutes,source_cutoff_at," +
          "started_at,finished_at,isolated,encrypted,integrity_verified,permission_boundary_verified," +
          "audit_chain_verified,evidence_hash_verified,failure_code,request_id,trace_id FROM backup_recovery_runs " +
          "ORDER BY started_at DESC LIMIT 20",
      );
      input.signal?.throwIfAborted();
      const [assetsResult] = await connection.query<RowDataPacket[]>(
        "SELECT a.run_id,a.asset_kind,a.region,a.storage_role,COUNT(*) bundle_count," +
          "MAX(a.created_at) latest_created_at,SUM(a.size_bytes) size_bytes,MIN(a.encrypted) encrypted," +
          "MIN(a.integrity_verified) integrity_verified FROM backup_recovery_assets a INNER JOIN " +
          "(SELECT id FROM backup_recovery_runs WHERE run_type='backup' ORDER BY started_at DESC " +
          "LIMIT 1) latest ON latest.id=a.run_id GROUP BY a.run_id,a.asset_kind,a.region," +
          "a.storage_role ORDER BY a.asset_kind,a.region,a.storage_role",
      );
      input.signal?.throwIfAborted();
      const runs = runsResult.map((row) => ({
        ...row,
        rpo_target_minutes: Number(row.rpo_target_minutes),
        rto_target_minutes: Number(row.rto_target_minutes),
        actual_rpo_minutes: row.actual_rpo_minutes === null ? null : Number(row.actual_rpo_minutes),
        actual_rto_minutes: row.actual_rto_minutes === null ? null : Number(row.actual_rto_minutes),
        source_cutoff_at: iso(row.source_cutoff_at),
        started_at: iso(row.started_at),
        finished_at: iso(row.finished_at),
        isolated: truth(row.isolated),
        encrypted: truth(row.encrypted),
        integrity_verified: truth(row.integrity_verified),
        permission_boundary_verified: truth(row.permission_boundary_verified),
        audit_chain_verified: truth(row.audit_chain_verified),
        evidence_hash_verified: truth(row.evidence_hash_verified),
      }));
      const assets = assetsResult.map((row) => ({
        run_id: row.run_id,
        asset_kind: row.asset_kind,
        region: row.region,
        storage_role: row.storage_role,
        bundle_count: Number(row.bundle_count),
        latest_created_at: iso(row.latest_created_at),
        size_bytes: Number(row.size_bytes),
        encrypted: truth(row.encrypted),
        integrity_verified: truth(row.integrity_verified),
      }));
      input.signal?.throwIfAborted();
      await connection.query(
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id," +
          "action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at," +
          "schema_version) VALUES(?,NULL,NULL,?,'platform.backup_recovery.read','backup_recovery'," +
          "NULL,'succeeded',?,?,?,?,1)",
        [
          randomUUID(),
          input.actorId,
          input.requestId,
          input.traceId,
          JSON.stringify({
            state_source: "backup_recovery_runs",
            run_count: runs.length,
            asset_group_count: assets.length,
          }),
          input.now,
        ],
      );
      input.signal?.throwIfAborted();
      await connection.commit();
      return { runs, assets };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
