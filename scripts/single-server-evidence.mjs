export function validateSingleServerEvidence({
  evidence,
  manifest,
  head,
  now = Date.now(),
  maxAgeMs = 300_000,
}) {
  if (
    manifest?.topology !== "single_host" ||
    manifest?.loadBalancingEnabled !== false ||
    manifest?.expectedHostCount !== 1 ||
    manifest?.productionRegion !== "惠州"
  )
    throw new Error("single_server_manifest_invalid");
  if (
    evidence?.schemaVersion !== 1 ||
    evidence?.module !== "M08-01" ||
    evidence?.status !== "ready" ||
    evidence?.buildSha !== head ||
    evidence?.manager !== "baota" ||
    evidence?.topology !== "single_host" ||
    evidence?.region !== "惠州"
  )
    throw new Error("single_server_evidence_identity_invalid");
  if (
    evidence.loadBalancingEnabled !== false ||
    evidence.backupServerUsed !== false ||
    evidence.multiNodeClaim !== false ||
    evidence.capacityClaim !== "unverified"
  )
    throw new Error("single_server_evidence_claim_invalid");
  const exception = evidence.host?.publicAccessException;
  const mysqlException =
    exception?.service === "mysql" &&
    exception.port === 3306 &&
    exception.approvedBy === "project_owner" &&
    exception.approvedOn === "2026-10-15" &&
    Object.keys(exception).length === 4 &&
    evidence.host?.otherServicesPrivate === true &&
    manifest.host?.publicAccessExceptions?.some(
      (item) =>
        item.service === exception.service &&
        item.port === exception.port &&
        item.approvedBy === exception.approvedBy &&
        item.approvedOn === exception.approvedOn,
    );
  if (exception && !mysqlException) throw new Error("single_server_evidence_exception_invalid");
  if (manifest.host?.publicAccessExceptions?.length && !mysqlException)
    throw new Error("single_server_evidence_exception_missing");
  if (
    !evidence.host?.hostId ||
    evidence.host.manager !== "baota" ||
    evidence.host.region !== "惠州" ||
    !(
      (evidence.host.privateServices === true && !exception) ||
      (evidence.host.privateServices === false && mysqlException)
    ) ||
    !Array.isArray(evidence.host.roles) ||
    !evidence.host.roles.includes("api")
  )
    throw new Error("single_server_evidence_host_invalid");
  if (evidence.api?.hostId !== evidence.host.hostId)
    throw new Error("single_server_evidence_host_identity_invalid");
  if (
    !evidence.api?.nodeId ||
    evidence.api.status !== "ready" ||
    evidence.api.ready !== true ||
    evidence.api.buildSha !== head ||
    evidence.api.loopbackHost !== "127.0.0.1" ||
    evidence.api.publicPortExposed !== false
  )
    throw new Error("single_server_evidence_api_invalid");
  if (
    evidence.nginx?.managedBy !== "baota_site" ||
    evidence.nginx?.mode !== "single_upstream_reverse_proxy" ||
    evidence.nginx?.tlsProbeReady !== true ||
    evidence.nginx?.sseBufferingOff !== true
  )
    throw new Error("single_server_evidence_nginx_invalid");
  if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs < 30_000 || maxAgeMs > 3_600_000)
    throw new Error("single_server_evidence_max_age_invalid");
  const capturedAt = Date.parse(evidence.capturedAt);
  const heartbeatAt = Date.parse(evidence.api.lastHeartbeatAt);
  if (
    !Number.isFinite(capturedAt) ||
    !Number.isFinite(heartbeatAt) ||
    capturedAt > now + 30_000 ||
    heartbeatAt > now + 30_000 ||
    now - capturedAt > maxAgeMs ||
    now - heartbeatAt > maxAgeMs
  )
    throw new Error("single_server_evidence_stale");
  return { hostId: evidence.host.hostId, activeApiInstances: 1 };
}
