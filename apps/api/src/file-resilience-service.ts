import type { FileResilienceDto } from "@scoutops/contracts";
import {
  evaluateFileResilience,
  type FileResiliencePolicy,
  type FileResilienceSnapshot,
} from "@scoutops/storage";

export interface FileResilienceProbe {
  snapshot(signal?: AbortSignal): Promise<FileResilienceSnapshot>;
}
export interface FileResilienceRepository {
  record(input: {
    actorId: string;
    requestId: string;
    traceId: string;
    observedAt: Date;
    snapshot: FileResilienceSnapshot;
    evaluation: ReturnType<typeof evaluateFileResilience>;
    signal?: AbortSignal;
  }): Promise<void>;
}

export class FileResilienceService {
  constructor(
    private readonly probe: FileResilienceProbe,
    private readonly repository: FileResilienceRepository,
    private readonly policy: FileResiliencePolicy,
    private readonly now = () => new Date(),
  ) {}
  async read(input: {
    actorId: string;
    requestId: string;
    traceId: string;
    signal?: AbortSignal;
  }): Promise<FileResilienceDto> {
    input.signal?.throwIfAborted();
    const observedAt = this.now();
    const snapshot = await this.probe.snapshot(input.signal);
    input.signal?.throwIfAborted();
    const evaluation = evaluateFileResilience(snapshot, this.policy);
    await this.repository.record({ ...input, observedAt, snapshot, evaluation });
    input.signal?.throwIfAborted();
    return {
      state: evaluation.state,
      mode: "local_managed_directories",
      directories: snapshot.roots.map((root) => ({
        kind: root.kind,
        available: root.available,
        writable: root.writable,
        used_bytes: Math.max(0, root.totalBytes - root.availableBytes),
        total_bytes: root.totalBytes,
        usage_basis_points:
          root.totalBytes > 0
            ? Math.min(
                10000,
                Math.round(((root.totalBytes - root.availableBytes) / root.totalBytes) * 10000),
              )
            : 10000,
        active_files: root.activeFiles,
        indexed_bytes: root.indexedBytes,
      })),
      integrity: {
        sampled_files: snapshot.checksumSampledFiles,
        verified_files: snapshot.checksumVerifiedFiles,
        mismatch_files: snapshot.checksumMismatchFiles,
        missing_files: snapshot.missingFiles,
      },
      recovery: {
        status: snapshot.recoveryStatus,
        encrypted_same_host_copy: snapshot.encryptedSameHostCopy,
        isolated_restore_verified: snapshot.isolatedRestoreVerified,
        drill_age_days: snapshot.recoveryDrillAgeDays,
      },
      findings: evaluation.findings.map((item) => ({
        code: item.code,
        severity: item.severity,
        action_hint: item.actionHint,
      })),
      organization_scoped: true,
      public_access_enabled: false,
      shared_storage_enabled: false,
      backup_server_used: false,
      capacity_claim: "unverified",
      observed_at: observedAt.toISOString(),
    };
  }
}
