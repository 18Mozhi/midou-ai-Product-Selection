import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
export const backupStateServiceFile = "apps/api/src/backup-recovery-service.ts";

// Isolated synthetic repository only. Execute the current service, never a copied predicate.
export async function backupStateFixtures() {
  const source = await readFile(backupStateServiceFile, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports }, { timeout: 1000 });
  const now = new Date("2026-09-15T08:00:00Z");
  const scenarios = [
    { id: "verified", age: 1 },
    { id: "expiring", age: 89 },
    { id: "due-today", age: 90 },
    { id: "stale", age: 91 },
    { id: "checks-missing", age: 1, failedChecks: true },
    { id: "no-drill", noDrill: true },
    { id: "empty", empty: true },
    { id: "zero-actual", age: 1, zero: true },
    { id: "long-region", age: 1, long: true },
  ];
  const cases = [];
  for (const scenario of scenarios) {
    const region = scenario.long ? "惠州本地样例区域".repeat(6) : "惠州";
    const policy = {
      primaryRegion: region,
      recoveryRegion: region,
      rpoMinutes: 15,
      rtoMinutes: 240,
      maximumDrillAgeDays: 90,
    };
    const backup = {
      id: "local-state-backup",
      run_type: "backup",
      status: "verified",
      encrypted: true,
      integrity_verified: true,
      actual_rpo_minutes: scenario.zero ? 0 : 5,
      finished_at: "2026-09-15T07:55:00Z",
    };
    const drill = {
      id: "local-state-drill",
      run_type: "restore_drill",
      status: "verified",
      isolated: true,
      encrypted: true,
      integrity_verified: true,
      permission_boundary_verified: !scenario.failedChecks,
      audit_chain_verified: !scenario.failedChecks,
      evidence_hash_verified: !scenario.failedChecks,
      actual_rto_minutes: scenario.zero ? 0 : 60,
      finished_at: new Date(now.getTime() - (scenario.age ?? 1) * 86400000).toISOString(),
    };
    const repositoryData = {
      runs: scenario.empty ? [] : scenario.noDrill ? [backup] : [backup, drill],
      assets: scenario.empty
        ? []
        : ["primary_backup", "recovery_copy"].map((role) => ({
            run_id: backup.id,
            asset_kind: "mysql_full",
            region,
            storage_role: role,
            bundle_count: 1,
            size_bytes: scenario.zero ? 0 : 1048576,
            encrypted: true,
            integrity_verified: true,
          })),
    };
    let reads = 0;
    const service = new exports.BackupRecoveryService(
      {
        read: async () => {
          reads++;
          return structuredClone(repositoryData);
        },
      },
      policy,
      () => now,
    );
    const data = await service.read({
      actorId: "local-review",
      requestId: `local-${scenario.id}`,
      traceId: `local-${scenario.id}`,
    });
    cases.push({ id: scenario.id, data: JSON.parse(JSON.stringify(data)), repositoryReads: reads });
  }
  return cases;
}
