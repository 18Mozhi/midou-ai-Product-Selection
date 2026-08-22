export interface BackupRecoveryRepository {
  read(input: { actorId: string; requestId: string; traceId: string; now: Date }): Promise<{
    runs: Array<Record<string, unknown>>;
    assets: Array<Record<string, unknown>>;
  }>;
}

export interface BackupRecoveryPolicy {
  primaryRegion: string;
  recoveryRegion: string;
  rpoMinutes: number;
  rtoMinutes: number;
  maximumDrillAgeDays: number;
}

export class BackupRecoveryService {
  constructor(
    private readonly repository: BackupRecoveryRepository,
    private readonly policy: BackupRecoveryPolicy,
    private readonly now = () => new Date(),
  ) {}

  async read(input: { actorId: string; requestId: string; traceId: string }) {
    const now = this.now();
    const result = await this.repository.read({ ...input, now });
    const latestBackup = result.runs.find((run) => run.run_type === "backup");
    const latestDrill = result.runs.find((run) => run.run_type === "restore_drill");
    const recoveryAssets = result.assets.filter(
      (asset) =>
        asset.run_id === latestBackup?.id &&
        asset.region === this.policy.recoveryRegion &&
        asset.storage_role === "recovery_copy" &&
        asset.encrypted === true &&
        asset.integrity_verified === true,
    );
    const drillDate = latestDrill?.finished_at ? new Date(String(latestDrill.finished_at)) : null;
    const drillAgeDays = drillDate
      ? Math.floor((now.getTime() - drillDate.getTime()) / 86_400_000)
      : null;
    const drillExpiresAt = drillDate
      ? new Date(drillDate.getTime() + this.policy.maximumDrillAgeDays * 86_400_000)
      : null;
    const daysUntilDrillExpiry = drillExpiresAt
      ? Math.ceil((drillExpiresAt.getTime() - now.getTime()) / 86_400_000)
      : null;
    const backupVerified =
      latestBackup?.status === "verified" &&
      latestBackup?.encrypted === true &&
      latestBackup?.integrity_verified === true &&
      Number.isFinite(Number(latestBackup?.actual_rpo_minutes)) &&
      Number(latestBackup?.actual_rpo_minutes) <= this.policy.rpoMinutes;
    const drillVerified =
      latestDrill?.status === "verified" &&
      latestDrill?.isolated === true &&
      latestDrill?.encrypted === true &&
      latestDrill?.integrity_verified === true &&
      latestDrill?.permission_boundary_verified === true &&
      latestDrill?.audit_chain_verified === true &&
      latestDrill?.evidence_hash_verified === true &&
      Number.isFinite(Number(latestDrill?.actual_rto_minutes)) &&
      Number(latestDrill?.actual_rto_minutes) <= this.policy.rtoMinutes;
    const drillStale = drillAgeDays !== null && drillAgeDays > this.policy.maximumDrillAgeDays;
    const state = !latestBackup
      ? "empty"
      : !backupVerified || recoveryAssets.length === 0 || !drillVerified
        ? "blocked"
        : drillStale
          ? "stale"
          : "verified";
    return {
      state,
      policy: {
        primary_region: this.policy.primaryRegion,
        recovery_region: this.policy.recoveryRegion,
        rpo_minutes: this.policy.rpoMinutes,
        rto_minutes: this.policy.rtoMinutes,
        maximum_drill_age_days: this.policy.maximumDrillAgeDays,
      },
      latest_backup: latestBackup ?? null,
      latest_drill: latestDrill ?? null,
      drill_age_days: drillAgeDays,
      drill_expires_at: drillExpiresAt?.toISOString() ?? null,
      days_until_drill_expiry: daysUntilDrillExpiry,
      recovery_copy_verified: recoveryAssets.length > 0,
      targets: result.assets.map(({ run_id: _runId, ...asset }) => asset),
      blockers: [
        ...(backupVerified
          ? []
          : [
              {
                code: "backup_objective_unverified",
                action_hint: "核验加密、完整性与实际 RPO，并记录不超过目标的分钟数。",
              },
            ]),
        ...(recoveryAssets.length
          ? []
          : [
              {
                code: "recovery_copy_unverified",
                action_hint: "由宝塔生成同机独立加密恢复副本并完成完整性校验。",
              },
            ]),
        ...(drillVerified
          ? []
          : [
              {
                code: "isolated_restore_unverified",
                action_hint:
                  "在中国境内隔离环境完成恢复并核验业务数据、审计链、证据哈希与权限边界。",
              },
            ]),
        ...(!drillStale
          ? []
          : [
              {
                code: "restore_drill_stale",
                action_hint: `最近隔离恢复已超过 ${this.policy.maximumDrillAgeDays} 天，请由宝塔任务重新演练。`,
              },
            ]),
      ],
      observed_at: now.toISOString(),
    };
  }
}
