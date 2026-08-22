import { createHash } from "node:crypto";
import { constants, access, statfs } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { Pool, RowDataPacket } from "mysql2/promise";
import {
  buildScopedFilePath,
  type FileRecoveryStatus,
  type FileResilienceSnapshot,
  type FileRootSnapshot,
} from "@scoutops/storage";

const number = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const inside = (root: string, target: string) => {
  const value = relative(resolve(root), resolve(target));
  return value === "" || (!isAbsolute(value) && value !== ".." && !value.startsWith(`..${sep}`));
};
async function sha256(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export class FileResilienceProbe {
  constructor(
    private readonly pool: Pool,
    private readonly evidenceRoot: string,
    private readonly exportRoot: string,
    private readonly runtimeTempRoot: string,
    private readonly checksumSampleLimit: number,
    private readonly maximumRecoveryDrillAgeDays: number,
    private readonly publicRoot = resolve(process.cwd(), "apps/web/dist"),
    private readonly now = () => new Date(),
  ) {}
  private async root(
    kind: "evidence" | "export" | "temp",
    path: string,
    activeFiles: number,
    indexedBytes: number,
  ): Promise<FileRootSnapshot> {
    try {
      await access(path, constants.R_OK | constants.W_OK);
      const value = await statfs(path);
      return {
        kind,
        available: true,
        writable: true,
        totalBytes: Number(value.blocks) * Number(value.bsize),
        availableBytes: Number(value.bavail) * Number(value.bsize),
        activeFiles,
        indexedBytes,
      };
    } catch {
      return {
        kind,
        available: false,
        writable: false,
        totalBytes: 0,
        availableBytes: 0,
        activeFiles,
        indexedBytes,
      };
    }
  }
  async snapshot(): Promise<FileResilienceSnapshot> {
    const [evidenceTotals] = await this.pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) active_files,COALESCE(SUM(size_bytes),0) indexed_bytes FROM file_assets WHERE status='active' AND category='evidence'",
    );
    const [exportTotals] = await this.pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) active_files,COALESCE(SUM(byte_size),0) indexed_bytes FROM report_exports WHERE status='succeeded' AND expires_at>UTC_TIMESTAMP(3)",
    );
    const roots = await Promise.all([
      this.root(
        "evidence",
        this.evidenceRoot,
        number(evidenceTotals[0]?.active_files),
        number(evidenceTotals[0]?.indexed_bytes),
      ),
      this.root(
        "export",
        this.exportRoot,
        number(exportTotals[0]?.active_files),
        number(exportTotals[0]?.indexed_bytes),
      ),
      this.root("temp", this.runtimeTempRoot, 0, 0),
    ]);
    const [evidenceRows] = await this.pool.query<RowDataPacket[]>(
      "SELECT relative_path,content_sha256 FROM file_assets WHERE status='active' AND category='evidence' ORDER BY updated_at DESC,id DESC LIMIT ?",
      [this.checksumSampleLimit],
    );
    const remaining = Math.max(0, this.checksumSampleLimit - evidenceRows.length);
    const [exportRows] = remaining
      ? await this.pool.query<RowDataPacket[]>(
          "SELECT organization_id,workspace_id,id,filename,content_sha256 FROM report_exports WHERE status='succeeded' AND expires_at>UTC_TIMESTAMP(3) AND content_sha256 IS NOT NULL ORDER BY updated_at DESC,id DESC LIMIT ?",
          [remaining],
        )
      : [[] as RowDataPacket[], []];
    const samples: Array<{ path: string; expected: string }> = [];
    for (const row of evidenceRows) {
      const target = resolve(this.evidenceRoot, String(row.relative_path));
      if (inside(this.evidenceRoot, target))
        samples.push({ path: target, expected: String(row.content_sha256) });
      else samples.push({ path: "", expected: String(row.content_sha256) });
    }
    for (const row of exportRows) {
      try {
        samples.push({
          path: buildScopedFilePath(this.exportRoot, {
            organization_id: String(row.organization_id) as never,
            workspace_id: String(row.workspace_id) as never,
            category: "export",
            resource_id: String(row.id),
            filename: String(row.filename),
          }),
          expected: String(row.content_sha256),
        });
      } catch {
        samples.push({ path: "", expected: String(row.content_sha256) });
      }
    }
    let verified = 0,
      mismatched = 0,
      missing = 0;
    for (const sample of samples) {
      if (!sample.path) {
        missing++;
        continue;
      }
      try {
        if ((await sha256(sample.path)) === sample.expected) verified++;
        else mismatched++;
      } catch {
        missing++;
      }
    }
    const [runRows] = await this.pool
      .query<RowDataPacket[]>(
        "SELECT id,run_type,status,finished_at,isolated,encrypted,integrity_verified,permission_boundary_verified,audit_chain_verified,evidence_hash_verified FROM backup_recovery_runs WHERE run_type IN ('backup','restore_drill') ORDER BY started_at DESC LIMIT 20",
      )
      .catch(() => [[] as RowDataPacket[], []] as never);
    const backup = runRows.find((row) => row.run_type === "backup"),
      drill = runRows.find((row) => row.run_type === "restore_drill");
    const [assetRows] = backup
      ? await this.pool
          .query<RowDataPacket[]>(
            "SELECT asset_kind,encrypted,integrity_verified FROM backup_recovery_assets WHERE run_id=? AND storage_role='recovery_copy' AND asset_kind IN ('evidence','export')",
            [backup.id],
          )
          .catch(() => [[] as RowDataPacket[], []] as never)
      : [[] as RowDataPacket[], []];
    const kinds = new Set(
      assetRows
        .filter((row) => Boolean(row.encrypted) && Boolean(row.integrity_verified))
        .map((row) => String(row.asset_kind)),
    );
    const backupVerified =
      backup?.status === "verified" &&
      Boolean(backup.encrypted) &&
      Boolean(backup.integrity_verified) &&
      kinds.has("evidence") &&
      kinds.has("export");
    const drillVerified =
      drill?.status === "verified" &&
      Boolean(drill.isolated) &&
      Boolean(drill.encrypted) &&
      Boolean(drill.integrity_verified) &&
      Boolean(drill.permission_boundary_verified) &&
      Boolean(drill.audit_chain_verified) &&
      Boolean(drill.evidence_hash_verified);
    const drillAge = drill?.finished_at
      ? Math.max(0, (this.now().getTime() - new Date(drill.finished_at).getTime()) / 86400000)
      : null;
    let recoveryStatus: FileRecoveryStatus = "empty";
    if (backup || drill)
      recoveryStatus =
        backupVerified && drillVerified && drillAge !== null
          ? drillAge <= this.maximumRecoveryDrillAgeDays
            ? "verified"
            : "stale"
          : "blocked";
    return {
      roots,
      checksumSampledFiles: samples.length,
      checksumVerifiedFiles: verified,
      checksumMismatchFiles: mismatched,
      missingFiles: missing,
      recoveryStatus,
      encryptedSameHostCopy: Boolean(backupVerified),
      isolatedRestoreVerified: Boolean(drillVerified),
      recoveryDrillAgeDays: drillAge === null ? null : Number(drillAge.toFixed(2)),
      publicDirectoryExposed:
        inside(this.publicRoot, this.evidenceRoot) ||
        inside(this.publicRoot, this.exportRoot) ||
        inside(this.publicRoot, this.runtimeTempRoot),
      sharedStorageEnabled: false,
      backupServerUsed: false,
    };
  }
}
