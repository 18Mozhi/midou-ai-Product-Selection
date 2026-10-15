import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
const id = randomUUID(),
  production = process.argv.includes("--production");
const fail = (code, message, blocked = false) => {
  console.error(
    JSON.stringify(
      {
        module: "M07-04",
        status: blocked ? "blocked" : "failed",
        code,
        message,
        request_id: id,
        trace_id: id,
      },
      null,
      2,
    ),
  );
  process.exit(blocked ? 2 : 1);
};
const manifest = JSON.parse(
  await readFile(resolve("infra/baota/backup-recovery-manifest.json"), "utf8"),
);
if (
  manifest.productionManager !== "baota" ||
  manifest.primaryRegion !== "惠州" ||
  manifest.recoveryRegion !== "惠州" ||
  manifest.topology !== "S0-single-host-local-isolation" ||
  manifest.encryption?.algorithm !== "aes-256-gcm"
)
  fail("backup_manifest_invalid", "M07-04 backup manifest drifted");
if (
  manifest.targets?.mysql?.rpoMinutes !== 15 ||
  manifest.targets?.mysql?.rtoMinutes !== 240 ||
  manifest.targets?.mysql?.businessConnection !== "product_scout-over-tcp" ||
  manifest.targets?.mysql?.adminTransport !== "unix-socket" ||
  manifest.recoveryDrill?.isolated !== true
)
  fail(
    "recovery_objective_invalid",
    "RPO RTO, MySQL connection boundary or isolated drill contract drifted",
  );
if (!production) {
  console.log(
    JSON.stringify(
      {
        module: "M07-04",
        status: "preflight_passed",
        recovery_verified: false,
        request_id: id,
        trace_id: id,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
let evidence;
try {
  evidence = JSON.parse(
    await readFile(
      resolve(".artifacts/verification/backup-recovery-production-evidence.json"),
      "utf8",
    ),
  );
} catch {
  fail("recovery_evidence_missing", "需要当前惠州主机的宝塔加密副本与隔离恢复证据。", true);
}
const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
if (head.status !== 0 || evidence.releaseCommit !== head.stdout.trim())
  fail("recovery_release_mismatch", "恢复证据必须对应当前 Git commit。", true);
if (
  evidence.schemaVersion !== 1 ||
  evidence.manager !== "baota" ||
  evidence.primaryRegion !== "惠州" ||
  evidence.recoveryRegion !== "惠州" ||
  evidence.hostFailureProtected !== false
)
  fail("recovery_evidence_identity_invalid", "管理器、区域或单机风险边界证据不匹配", true);
if (
  evidence.backup?.encrypted !== true ||
  evidence.backup?.integrityVerified !== true ||
  evidence.backup?.pitrVerified !== true ||
  evidence.backup?.coordinatesEmbedded !== true ||
  !Number.isInteger(evidence.backup?.binlogRetentionDays) ||
  evidence.backup?.binlogRetentionDays < 1 ||
  !Number.isFinite(evidence.backup?.rpoMinutes) ||
  evidence.backup?.rpoMinutes < 0 ||
  evidence.backup?.rpoMinutes > 15
)
  fail("backup_objective_unverified", "加密、完整性、PITR 或 RPO 未达标", true);
if (
  evidence.backup?.postSnapshotProbeVerified !== true ||
  evidence.backup?.replayBoundary?.eventChecksumsVerified !== true ||
  !Number.isInteger(evidence.backup?.replayBoundary?.rowEvents) ||
  !Number.isInteger(evidence.backup?.replayBoundary?.mapEvents) ||
  evidence.backup?.replayBoundary?.rowEvents < 1 ||
  evidence.backup?.replayBoundary?.mapEvents < 1 ||
  !/^product_scout_restore_m0704_[a-f0-9]{12}$/.test(
    evidence.backup?.replayBoundary?.targetDatabase ?? "",
  ) ||
  evidence.cleanup?.sourceProbeRemoved !== true ||
  evidence.cleanup?.isolatedDatabaseRemoved !== true ||
  evidence.cleanup?.plaintextRemoved !== true
)
  fail("pitr_replay_or_cleanup_unverified", "隔离行事件回放、快照后探针或清理未验证", true);
if (
  evidence.recoveryCopy?.region !== "惠州" ||
  evidence.recoveryCopy?.sameHost !== true ||
  evidence.recoveryCopy?.separateEncryptedRoot !== true ||
  evidence.recoveryCopy?.integrityVerified !== true
)
  fail("local_recovery_copy_unverified", "同机独立加密恢复副本未验证", true);
const drill = evidence.restoreDrill;
if (
  drill?.isolated !== true ||
  !Number.isFinite(drill?.rtoMinutes) ||
  drill?.rtoMinutes < 0 ||
  drill?.rtoMinutes > 240 ||
  ![
    drill?.businessDataVerified,
    drill?.auditChainVerified,
    drill?.evidenceHashVerified,
    drill?.permissionBoundaryVerified,
  ].every((value) => value === true)
)
  fail("isolated_restore_unverified", "隔离恢复检查未全部通过", true);
const age = Date.now() - Date.parse(evidence.capturedAt);
if (!Number.isFinite(age) || age < 0 || age > 90 * 86_400_000)
  fail("recovery_drill_stale", "恢复演练超过 90 天", true);
console.log(
  JSON.stringify(
    {
      module: "M07-04",
      status: "passed",
      recovery_region: "惠州",
      topology: "same_host_local_isolation",
      host_failure_protected: false,
      rpo: "passed",
      rto: "passed",
      isolated_restore: "passed",
      request_id: id,
      trace_id: id,
    },
    null,
    2,
  ),
);
