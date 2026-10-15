import { createHash } from "node:crypto";
import { validateSingleBackendReleaseEvidence } from "../single-backend-release-evidence.mjs";

export function capacityReleasePrerequisite(source, head, identity, now = Date.now()) {
  const evidence = JSON.parse(source);
  validateSingleBackendReleaseEvidence(evidence, head, now);
  if (
    identity?.build_sha !== head ||
    !/^[a-f0-9]{64}$/.test(identity.config_fingerprint ?? "") ||
    typeof identity.version !== "string" ||
    !identity.version ||
    identity.version.length > 80
  )
    throw new Error("capacity_release_identity_invalid");
  return {
    receipt: evidence,
    evidenceSha256: createHash("sha256").update(source).digest("hex"),
    previousBuildSha: evidence.previousBuildSha,
    migrationVersion: evidence.migrationVersion,
    capturedAt: evidence.capturedAt,
    startedAt: evidence.release.verifiedAt,
    finishedAt: evidence.recovery.verifiedAt,
    appVersion: identity.version,
    configFingerprint: identity.config_fingerprint,
  };
}
