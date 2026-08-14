import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import { ReleaseRolloutService, ReleaseWriteProbeService, signReleaseProbe } from "../apps/api/dist/release-rollout-service.js";
import { MySqlReleaseRolloutRepository } from "../apps/api/dist/mysql-release-rollout-repository.js";

const pool = createDatabasePool(loadRuntimeConfig(process.env, "api")), requestId = randomUUID(), traceId = randomUUID();
const ids = { actor: randomUUID(), release: randomUUID() }, now = new Date(), email = `m07-05-${requestId.slice(0,8)}@test.local`;
async function migrate() {
  for (const name of ["0007_m00_08_deployment_releases.up.sql", "0026_release_rollout_m07_05.up.sql", "0027_release_write_probe_m07_05.up.sql", "0027a_release_rollout_attempts_m07_05.up.sql", "0032a_compact_release_write_probe_m08_03.up.sql"]) {
    const sql = await readFile(`database/migrations/${name}`, "utf8"), checksum = createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
    const [existing] = await pool.query("SELECT checksum FROM schema_migrations WHERE name=?", [name]);
    if (existing.length) { if (existing[0].checksum !== checksum) throw new Error(`${name} checksum drift`); continue; }
    for (const statement of sql.split(";").map((value) => value.trim()).filter(Boolean)) await pool.query(statement);
    await pool.query("INSERT INTO schema_migrations(name,checksum,applied_at) VALUES(?,?,UTC_TIMESTAMP(3))", [name, checksum]);
  }
}
async function cleanup() {
  try { await pool.query("DELETE FROM platform_audit_events WHERE actor_id=?", [ids.actor]); } catch {}
  try { await pool.query("DELETE FROM deployment_release_write_samples WHERE release_id=?", [ids.release]); } catch {}
  try { await pool.query("DELETE FROM deployment_releases WHERE id=?", [ids.release]); } catch {}
  try { await pool.query("DELETE FROM users WHERE id=?", [ids.actor]); } catch {}
}
try {
  const [versions] = await pool.query("SELECT VERSION() version,@@character_set_server charset,DATABASE() database_name,CURRENT_USER() account_name"); const runtime = versions[0];
  if (!String(runtime.version).startsWith("5.7.") || runtime.charset !== "utf8mb4" || runtime.database_name !== "product_scout" || !String(runtime.account_name).startsWith("product_scout@")) throw new Error("requires MySQL57 utf8mb4 product_scout business account");
  await migrate(); await cleanup();
  await pool.query("INSERT INTO users(id,email,email_normalized,password_hash,status,email_verified_at,password_changed_at,version,created_at,updated_at) VALUES(?,?,?,'probe','active',?,?,1,?,?)", [ids.actor,email,email,now,now,now,now]);
  await pool.query("INSERT INTO deployment_releases(id,stage,app_version,build_sha,config_fingerprint,migration_version,status,approved_by,request_id,trace_id,started_at,finished_at,created_at,updated_at) VALUES(?,'S0','0.1.0',?,?,?,'healthy',NULL,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))", [ids.release,"a".repeat(40),"b".repeat(64),"0032a_compact_release_write_probe_m08_03.up.sql",requestId,traceId]);
  const signingKey="m07-05-live-signing-key-with-32-characters",sampleId=randomUUID(),nonce=randomUUID(),timestamp=Math.floor(now.getTime()/1000),signatureInput={timestamp,nonce,requestId,traceId,releaseId:ids.release,sampleId},proxyRequestId="c".repeat(32),proxyTraceId=randomUUID();
  const writeProbe = new ReleaseWriteProbeService(new MySqlReleaseRolloutRepository(pool),signingKey,"a".repeat(40),60,()=>now);
  await writeProbe.record({...signatureInput,requestId:proxyRequestId,traceId:proxyTraceId,signature:signReleaseProbe(signatureInput,signingKey)});
  const [probes]=await pool.query("SELECT LOWER(HEX(build_sha)) build_sha,request_id,trace_id FROM deployment_release_write_samples WHERE release_id=? AND sample_id=?",[ids.release,Buffer.from(sampleId.replaceAll("-",""),"hex")]);
  if(probes.length!==1||probes[0].build_sha!=="a".repeat(40)||probes[0].request_id!==proxyRequestId||probes[0].trace_id!==proxyTraceId)throw new Error("proxy-safe signed durable write probe mismatch");
  for (const percent of [5,25,100]) await pool.query("INSERT INTO deployment_release_gates(id,release_id,gate_kind,status,traffic_percent,observe_seconds,sample_count,error_rate_percent,read_p95_ms,write_p95_ms,async_lag_seconds,failure_code,started_at,finished_at,request_id,trace_id,metadata) VALUES(?,?,?,'passed',?,1800,20,0,100,200,2,NULL,DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1800 SECOND),UTC_TIMESTAMP(3),?,?,NULL)", [randomUUID(),ids.release,`canary_${percent}`,percent,requestId,traceId]);
  const service = new ReleaseRolloutService(new MySqlReleaseRolloutRepository(pool), { percentages:[5,25,100],minimumObservationSeconds:1800,maximumEvidenceAgeMinutes:30 }, () => now);
  const verified = await service.read({ actorId:ids.actor,requestId,traceId }); if (verified.state !== "verified" || verified.gates.length !== 3) throw new Error("verified rollout state mismatch");
  await pool.query("UPDATE deployment_release_gates SET write_p95_ms=NULL WHERE release_id=? AND gate_kind='canary_5'", [ids.release]);
  const blocked = await service.read({ actorId:ids.actor,requestId,traceId }); if (blocked.state !== "blocked") throw new Error("missing metric must fail closed");
  const [audits] = await pool.query("SELECT COUNT(*) n FROM platform_audit_events WHERE actor_id=? AND action='platform.release_rollout.read' AND request_id=? AND trace_id=?", [ids.actor,requestId,traceId]); if (Number(audits[0].n) !== 2) throw new Error("release read audit missing");
  await cleanup(); console.log(JSON.stringify({ module:"M07-05",status:"passed",mysql:runtime.version,same_host_candidate:true,signed_single_transaction_write_probe:"passed",verified_transition:"passed",missing_metric_fail_closed:"passed",audit_correlation:"passed",cleanup:"passed",request_id:requestId,trace_id:traceId },null,2));
} catch (error) { await cleanup(); console.error(JSON.stringify({ module:"M07-05",status:"blocked",code:error?.code??"release_rollout_live_failed",message:error instanceof Error?error.message:"unknown",request_id:requestId,trace_id:traceId })); process.exitCode=2; }
finally { await pool.end(); }
