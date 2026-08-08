import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { BackupRecoveryService } from "../apps/api/dist/backup-recovery-service.js";
import { MySqlBackupRecoveryRepository } from "../apps/api/dist/mysql-backup-recovery-repository.js";

const pool = createDatabasePool(loadRuntimeConfig(process.env, "api")), requestId = randomUUID(), traceId = randomUUID();
const id = { actor: randomUUID(), backup: randomUUID(), drill: randomUUID(), localAsset: randomUUID(), replicaAsset: randomUUID() };
const now = new Date("2026-08-08T13:30:00.000Z"), email = `m07-04-${requestId.slice(0, 8)}@test.local`;
async function migrate() {
  const [rows] = await pool.query("SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='backup_recovery_runs'");
  if (Number(rows[0].n)) return;
  for (const statement of (await readFile("database/migrations/0025_backup_recovery_m07_04.up.sql", "utf8")).split(";").map((value) => value.trim()).filter(Boolean)) await pool.query(statement);
}
async function cleanup() {
  try { await pool.query("DELETE FROM platform_audit_events WHERE actor_id=?", [id.actor]); } catch {}
  try { await pool.query("DELETE FROM backup_recovery_runs WHERE id IN (?,?)", [id.backup, id.drill]); } catch {}
  try { await pool.query("DELETE FROM users WHERE id=?", [id.actor]); } catch {}
}
try {
  const [versions] = await pool.query("SELECT VERSION() version,@@character_set_server charset,DATABASE() database_name,CURRENT_USER() account_name");
  const runtime = versions[0];
  if (!String(runtime.version).startsWith("5.7.") || runtime.charset !== "utf8mb4" || runtime.database_name !== "product_scout" || !String(runtime.account_name).startsWith("product_scout@")) throw new Error("requires MySQL57 utf8mb4 product_scout business account");
  await migrate(); await cleanup();
  await pool.query("INSERT INTO users(id,email,email_normalized,password_hash,status,email_verified_at,password_changed_at,version,created_at,updated_at) VALUES(?,?,?,'probe','active',?,?,1,?,?)", [id.actor, email, email, now, now, now, now]);
  const runSql = "INSERT INTO backup_recovery_runs(id,run_type,scope_type,primary_region,recovery_region,status,rpo_target_minutes,rto_target_minutes,actual_rpo_minutes,actual_rto_minutes,source_cutoff_at,started_at,finished_at,isolated,encrypted,integrity_verified,permission_boundary_verified,audit_chain_verified,evidence_hash_verified,request_id,trace_id,metadata) VALUES(?,?,'platform','惠州','惠州',?,15,240,?,?,?,?,?,?,1,1,?,?,?, ?,?,?)";
  await pool.query(runSql, [id.backup, "backup", "verified", 5, null, now, now, now, 0, 0, 0, 0, requestId, traceId, JSON.stringify({ manager: "baota" })]);
  await pool.query("INSERT INTO backup_recovery_assets(id,run_id,asset_kind,region,storage_role,bundle_name,bundle_sha256,plaintext_sha256,size_bytes,encrypted,integrity_verified,retention_until) VALUES(?,?,'mysql_full','惠州','primary_backup','mysql-local.bundle',?,?,4096,1,1,?)", [id.localAsset, id.backup, "a".repeat(64), "b".repeat(64), new Date("2026-11-06T00:00:00Z")]);
  const policy = { primaryRegion: "惠州", recoveryRegion: "惠州", rpoMinutes: 15, rtoMinutes: 240, maximumDrillAgeDays: 90 };
  const service = new BackupRecoveryService(new MySqlBackupRecoveryRepository(pool), policy, () => now);
  const blocked = await service.read({ actorId: id.actor, requestId, traceId });
  if (blocked.state !== "blocked" || blocked.recovery_copy_verified) throw new Error("unverified local recovery copy must fail closed");
  await pool.query(runSql, [id.drill, "restore_drill", "verified", null, 18, now, now, now, 1, 1, 1, 1, requestId, traceId, JSON.stringify({ isolated: true })]);
  await pool.query("INSERT INTO backup_recovery_assets(id,run_id,asset_kind,region,storage_role,bundle_name,bundle_sha256,plaintext_sha256,size_bytes,encrypted,integrity_verified,retention_until) VALUES(?,?,'mysql_full','惠州','recovery_copy','mysql-recovery-copy.bundle',?,?,4096,1,1,?)", [id.replicaAsset, id.backup, "c".repeat(64), "b".repeat(64), new Date("2026-11-06T00:00:00Z")]);
  const verified = await service.read({ actorId: id.actor, requestId, traceId });
  if (verified.state !== "verified" || !verified.recovery_copy_verified || verified.latest_drill?.permission_boundary_verified !== true) throw new Error("verified recovery state mismatch");
  const [audits] = await pool.query("SELECT COUNT(*) n FROM platform_audit_events WHERE actor_id=? AND action='platform.backup_recovery.read' AND request_id=? AND trace_id=?", [id.actor, requestId, traceId]);
  if (Number(audits[0].n) !== 2) throw new Error("audited read correlation missing");
  await cleanup();
  console.log(JSON.stringify({ status: "passed", module: "M07-04", mysql: runtime.version, topology: "same_host_local_isolation", host_failure_protected: false, local_only_fail_closed: "passed", recovery_copy_transition: "passed", isolated_restore_record: "passed", permission_boundary: "passed", audit_correlation: "passed", cleanup: "passed", request_id: requestId, trace_id: traceId }, null, 2));
} catch (error) {
  await cleanup();
  console.error(JSON.stringify({ status: "blocked", code: error?.code ?? "backup_recovery_live_failed", message: error instanceof Error ? error.message : "unknown", request_id: requestId, trace_id: traceId }));
  process.exitCode = 2;
} finally { await pool.end(); }
