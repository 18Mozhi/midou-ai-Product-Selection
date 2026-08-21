import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { OrganizationId, OrganizationScope, WorkspaceId } from "@scoutops/contracts";
import { assertOrganizationScope } from "@scoutops/contracts";

export class StorageBoundaryError extends Error {
  constructor(
    readonly code:
      | "invalid_scope"
      | "invalid_segment"
      | "path_escape"
      | "invalid_grant"
      | "grant_expired"
      | "invalid_policy",
    message: string,
  ) {
    super(message);
    this.name = "StorageBoundaryError";
  }
}
function safeSegment(value: string, field: string) {
  const v = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/.test(v) || v === "." || v === "..")
    throw new StorageBoundaryError("invalid_segment", `${field} is invalid`);
  return v;
}
function assertInside(root: string, target: string) {
  const rel = relative(root, target);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel))
    throw new StorageBoundaryError(
      "path_escape",
      "file path must remain inside the configured root",
    );
}
export interface ScopedFileInput extends OrganizationScope {
  category: "evidence" | "export" | "attachment";
  resource_id: string;
  filename: string;
}
export function buildScopedFilePath(root: string, input: ScopedFileInput): string {
  try {
    assertOrganizationScope(input, { workspaceRequired: true });
  } catch {
    throw new StorageBoundaryError(
      "invalid_scope",
      "organization_id and workspace_id are required",
    );
  }
  const absoluteRoot = resolve(root);
  const target = resolve(
    absoluteRoot,
    "organizations",
    safeSegment(input.organization_id, "organization_id"),
    "workspaces",
    safeSegment(input.workspace_id!, "workspace_id"),
    input.category,
    safeSegment(input.resource_id, "resource_id"),
    safeSegment(input.filename, "filename"),
  );
  assertInside(absoluteRoot, target);
  return target;
}
export async function writeScopedFile(
  root: string,
  input: ScopedFileInput,
  data: Uint8Array,
): Promise<string> {
  const target = buildScopedFilePath(root, input);
  await mkdir(resolve(target, ".."), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, data, { flag: "wx" });
    await rename(temporary, target);
    return target;
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

interface DownloadClaims {
  organization_id: string;
  workspace_id: string;
  relative_path: string;
  expires_at: number;
  nonce: string;
}
const encode = (value: string) => Buffer.from(value).toString("base64url");
export function issueDownloadGrant(
  root: string,
  input: ScopedFileInput,
  signingKey: Uint8Array,
  ttlSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  if (signingKey.byteLength < 32)
    throw new StorageBoundaryError(
      "invalid_grant",
      "download signing key must contain at least 32 bytes",
    );
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 300)
    throw new StorageBoundaryError("invalid_grant", "download grant TTL must be 1 to 300 seconds");
  const target = buildScopedFilePath(root, input);
  const claims: DownloadClaims = {
    organization_id: input.organization_id,
    workspace_id: input.workspace_id!,
    relative_path: relative(resolve(root), target).split(sep).join("/"),
    expires_at: nowSeconds + ttlSeconds,
    nonce: randomUUID(),
  };
  const payload = encode(JSON.stringify(claims));
  const signature = createHmac("sha256", signingKey).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
export function verifyDownloadGrant(
  token: string,
  signingKey: Uint8Array,
  scope: { organization_id: string; workspace_id: string },
  nowSeconds = Math.floor(Date.now() / 1000),
): DownloadClaims {
  const [payload, signature, ...extra] = token.split(".");
  if (!payload || !signature || extra.length)
    throw new StorageBoundaryError("invalid_grant", "download grant is malformed");
  const expected = createHmac("sha256", signingKey).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    throw new StorageBoundaryError("invalid_grant", "download grant signature is invalid");
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new StorageBoundaryError("invalid_grant", "download grant signature is invalid");
  let claims: DownloadClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new StorageBoundaryError("invalid_grant", "download grant payload is invalid");
  }
  if (
    claims.organization_id !== scope.organization_id ||
    claims.workspace_id !== scope.workspace_id
  )
    throw new StorageBoundaryError("invalid_scope", "download grant scope does not match");
  if (claims.expires_at < nowSeconds)
    throw new StorageBoundaryError("grant_expired", "download grant has expired");
  if (isAbsolute(claims.relative_path) || claims.relative_path.split("/").includes(".."))
    throw new StorageBoundaryError("path_escape", "download path is invalid");
  return claims;
}

const SENSITIVE = /(password|secret|token|cookie|authorization|api[_-]?key|private[_-]?key)/i;
export function redactAuditMetadata(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.map((item) => redactAuditMetadata(item, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE.test(key) ? "[REDACTED]" : redactAuditMetadata(item, depth + 1),
      ]),
    );
  return typeof value === "string" && value.length > 2000
    ? `${value.slice(0, 2000)}[TRUNCATED]`
    : value;
}
export interface AuditEventInput {
  organization_id: OrganizationId;
  workspace_id?: WorkspaceId;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  request_id: string;
  trace_id: string;
  metadata?: Record<string, unknown>;
}
export function createAuditEvent(input: AuditEventInput, occurredAt = new Date()) {
  assertOrganizationScope(input);
  return {
    audit_id: randomUUID(),
    organization_id: input.organization_id,
    ...(input.workspace_id ? { workspace_id: input.workspace_id } : {}),
    actor_id: safeSegment(input.actor_id, "actor_id"),
    action: safeSegment(input.action, "action"),
    resource_type: safeSegment(input.resource_type, "resource_type"),
    resource_id: safeSegment(input.resource_id, "resource_id"),
    request_id: input.request_id,
    trace_id: input.trace_id,
    metadata: redactAuditMetadata(input.metadata ?? {}),
    occurred_at: occurredAt.toISOString(),
    schema_version: 1 as const,
  };
}

export type FileResilienceState = "ready" | "warning" | "blocked";
export type FileRecoveryStatus = "verified" | "stale" | "blocked" | "empty";
export interface FileRootSnapshot {
  kind: "evidence" | "export";
  available: boolean;
  writable: boolean;
  totalBytes: number;
  availableBytes: number;
  activeFiles: number;
  indexedBytes: number;
}
export interface FileResilienceSnapshot {
  roots: FileRootSnapshot[];
  checksumSampledFiles: number;
  checksumVerifiedFiles: number;
  checksumMismatchFiles: number;
  missingFiles: number;
  recoveryStatus: FileRecoveryStatus;
  encryptedSameHostCopy: boolean;
  isolatedRestoreVerified: boolean;
  recoveryDrillAgeDays: number | null;
  publicDirectoryExposed: boolean;
  sharedStorageEnabled: false;
  backupServerUsed: false;
}
export interface FileResiliencePolicy {
  usageWarningBasisPoints: number;
  usageStopBasisPoints: number;
  maximumRecoveryDrillAgeDays: number;
}
export interface FileResilienceFinding {
  code: string;
  severity: "warning" | "blocked";
  actionHint: string;
}
export function evaluateFileResilience(
  snapshot: FileResilienceSnapshot,
  policy: FileResiliencePolicy,
) {
  if (policy.usageWarningBasisPoints >= policy.usageStopBasisPoints)
    throw new StorageBoundaryError(
      "invalid_policy",
      "file storage warning threshold must be less than stop threshold",
    );
  const usageBasisPoints = snapshot.roots.map((root) =>
    root.totalBytes > 0
      ? Math.min(
          10000,
          Math.round(((root.totalBytes - root.availableBytes) / root.totalBytes) * 10000),
        )
      : 10000,
  );
  const maximumUsageBasisPoints = Math.max(0, ...usageBasisPoints);
  const findings: FileResilienceFinding[] = [];
  const blocked = (code: string, actionHint: string) =>
    findings.push({ code, severity: "blocked", actionHint });
  const warning = (code: string, actionHint: string) =>
    findings.push({ code, severity: "warning", actionHint });
  if (
    snapshot.roots.length !== 2 ||
    snapshot.roots.some((root) => !root.available || !root.writable)
  )
    blocked("file_root_unavailable", "在宝塔核对证据与导出受控目录的挂载、权限和可写状态。");
  if (snapshot.publicDirectoryExposed)
    blocked(
      "file_root_publicly_exposed",
      "立即从宝塔网站静态目录或 Nginx alias 中移除受控文件根。",
    );
  if (snapshot.sharedStorageEnabled)
    blocked("shared_storage_unexpected", "S0 仅允许当前主机的宝塔受控目录，停止共享存储配置。");
  if (snapshot.backupServerUsed)
    blocked("backup_server_unexpected", "当前范围不允许备用服务器，请恢复为同机加密恢复副本。");
  if (snapshot.checksumMismatchFiles > 0)
    blocked("file_checksum_mismatch", "隔离哈希不一致文件并由宝塔任务从同机加密副本恢复。");
  if (snapshot.missingFiles > 0)
    blocked("file_missing", "停止相关下载或任务并核对文件资产与受控目录。");
  if (
    !snapshot.encryptedSameHostCopy ||
    !snapshot.isolatedRestoreVerified ||
    snapshot.recoveryStatus === "empty" ||
    snapshot.recoveryStatus === "blocked"
  )
    blocked(
      "file_recovery_unverified",
      "通过宝塔任务核验 evidence/export 同机加密副本及隔离恢复。",
    );
  if (
    snapshot.recoveryStatus === "stale" ||
    (snapshot.recoveryDrillAgeDays !== null &&
      snapshot.recoveryDrillAgeDays > policy.maximumRecoveryDrillAgeDays)
  )
    warning(
      "file_recovery_drill_stale",
      `最近文件恢复演练超过 ${policy.maximumRecoveryDrillAgeDays} 天。`,
    );
  if (maximumUsageBasisPoints >= policy.usageStopBasisPoints)
    blocked("file_capacity_stop", "停止新增大文件任务并通过宝塔释放或扩展当前主机受控目录。");
  else if (maximumUsageBasisPoints >= policy.usageWarningBasisPoints)
    warning("file_capacity_warning", "受控目录接近容量水位，请按保留策略归档并核验恢复副本。");
  return {
    state: (findings.some((item) => item.severity === "blocked")
      ? "blocked"
      : findings.length
        ? "warning"
        : "ready") as FileResilienceState,
    maximumUsageBasisPoints,
    findings,
  };
}
