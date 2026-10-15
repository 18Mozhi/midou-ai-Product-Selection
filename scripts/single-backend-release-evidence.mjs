export function validateSingleBackendReleaseEvidence(e, head, now = Date.now()) {
  const sha = /^[a-f0-9]{40}$/;
  if (
    e?.schemaVersion !== 1 ||
    e.module !== "M07-05" ||
    e.manager !== "baota" ||
    e.topology !== "single_backend_fixed_directories" ||
    e.buildSha !== head ||
    !sha.test(head) ||
    !sha.test(e.previousBuildSha) ||
    e.previousBuildSha === head
  )
    throw new Error("single_backend_release_identity_invalid");
  if (
    e.candidateInstances !== 0 ||
    e.nodeProject !== "ai选品" ||
    e.nodePort !== 4101 ||
    e.pythonProject !== "ai选品-python" ||
    e.databaseRollback !== false ||
    e.migrationCompatible !== true ||
    e.cleanupVerified !== true
  )
    throw new Error("single_backend_release_boundary_invalid");
  let prior = -Infinity;
  for (const [name, expected] of [
    ["release", head],
    ["rollback", e.previousBuildSha],
    ["recovery", head],
  ]) {
    const p = e[name],
      at = Date.parse(p?.verifiedAt);
    if (
      !p ||
      p.buildSha !== expected ||
      ![
        "live",
        "ready",
        "available",
        "version",
        "knownRoute",
        "missingRoute",
        "browserHelper",
      ].every((k) => p[k] === true) ||
      !Number.isFinite(at) ||
      at < prior ||
      at > now + 30000
    )
      throw new Error("single_backend_release_health_invalid");
    prior = at;
  }
  const captured = Date.parse(e.capturedAt);
  if (
    !Number.isFinite(captured) ||
    captured < prior ||
    captured > now ||
    now - captured > 30 * 60_000
  )
    throw new Error("single_backend_release_evidence_stale");
  if (
    typeof e.migrationVersion !== "string" ||
    !/^\d{4}[a-z]?_[a-z0-9_]+\.up\.sql$/.test(e.migrationVersion)
  )
    throw new Error("single_backend_release_migration_invalid");
  return { status: "passed", buildSha: head, rollbackBuildSha: e.previousBuildSha };
}
