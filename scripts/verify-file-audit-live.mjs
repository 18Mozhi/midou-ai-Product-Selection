import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { loadRuntimeConfig } from "../packages/config/dist/index.js";
import { createDatabasePool } from "../packages/database/dist/index.js";
import {
  createAuditEvent,
  issueDownloadGrant,
  verifyDownloadGrant,
  writeScopedFile,
} from "../packages/storage/dist/index.js";

async function runLocalProbe() {
  const id = randomUUID();
  const config = loadRuntimeConfig(process.env, "api");
  const pool = createDatabasePool(config);
  const root = await mkdtemp(join(tmpdir(), "scoutops-m00-06-live-"));
  const fileId = randomUUID();
  const auditId = randomUUID();
  let cleaned = false;

  async function cleanup() {
    try {
      await pool.query("DELETE FROM audit_logs WHERE id=?", [auditId]);
      await pool.query("DELETE FROM file_assets WHERE id=?", [fileId]);
    } catch {}
    await rm(root, { recursive: true, force: true });
    cleaned = true;
  }

  try {
    for (const table of ["file_assets", "audit_logs"]) {
      const [existing] = await pool.query(
        "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?",
        [table],
      );
      if (Number(existing[0].count) === 0)
        throw new Error(`required migration table is missing: ${table}`);
    }

    const organizationId = randomUUID();
    const workspaceId = randomUUID();
    const actorId = randomUUID();
    const input = {
      organization_id: organizationId,
      workspace_id: workspaceId,
      category: "evidence",
      resource_id: fileId,
      filename: "probe.json",
    };
    const content = Buffer.from(JSON.stringify({ request_id: id }));
    const path = await writeScopedFile(root, input, content);
    const key = Buffer.alloc(32, 9);
    const token = issueDownloadGrant(root, input, key, 30, 1000);
    verifyDownloadGrant(
      token,
      key,
      { organization_id: organizationId, workspace_id: workspaceId },
      1001,
    );
    const audit = createAuditEvent({
      organization_id: organizationId,
      workspace_id: workspaceId,
      actor_id: actorId,
      action: "file.write",
      resource_type: "file",
      resource_id: fileId,
      request_id: id,
      trace_id: id,
      metadata: { token: "must-redact", relative_path: relative(root, path) },
    });
    if (audit.metadata.token !== "[REDACTED]") throw new Error("audit redaction failed");

    await pool.query(
      "INSERT INTO file_assets (id,organization_id,workspace_id,category,relative_path,content_sha256,size_bytes,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",
      [
        fileId,
        organizationId,
        workspaceId,
        "evidence",
        relative(root, path).replaceAll("\\", "/"),
        createHash("sha256").update(content).digest("hex"),
        content.length,
        "active",
        actorId,
      ],
    );
    await pool.query(
      "INSERT INTO audit_logs (id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,request_id,trace_id,metadata_json,occurred_at,schema_version) VALUES (?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3),1)",
      [
        auditId,
        organizationId,
        workspaceId,
        actorId,
        "file.write",
        "file",
        fileId,
        id,
        id,
        JSON.stringify(audit.metadata),
      ],
    );
    const [rows] = await pool.query(
      "SELECT COUNT(*) AS count FROM file_assets f JOIN audit_logs a ON a.organization_id=f.organization_id AND a.resource_id=f.id WHERE f.id=?",
      [fileId],
    );
    if (Number(rows[0].count) !== 1) throw new Error("file/audit persistence mismatch");
    await cleanup();
    console.log(
      JSON.stringify({
        status: "passed",
        scope: "organization_and_workspace",
        grant: "verified",
        audit: "redacted_and_persisted",
        temp_cleanup: "passed",
        request_id: id,
        trace_id: id,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        status: "blocked",
        code: "file_audit_integration_failed",
        message: error instanceof Error ? error.message : "unknown",
        request_id: id,
        trace_id: id,
      }),
    );
    process.exitCode = 2;
  } finally {
    if (!cleaned) await cleanup();
    await pool.end();
  }
}

function runBaoTaProbe() {
  const result = spawnSync("python", ["scripts/verify-live-baota.py", "file-audit"], {
    encoding: "utf8",
    timeout: 150_000,
    windowsHide: true,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) process.exitCode = result.status ?? 2;
}

const target = process.env.SCOUTOPS_FILE_AUDIT_LIVE_TARGET ?? "local";
if (target === "baota-production") runBaoTaProbe();
else if (target === "local") await runLocalProbe();
else {
  const id = randomUUID();
  console.error(
    JSON.stringify({
      status: "blocked",
      code: "file_audit_live_target_invalid",
      message: "SCOUTOPS_FILE_AUDIT_LIVE_TARGET must be local or baota-production.",
      request_id: id,
      trace_id: id,
    }),
  );
  process.exitCode = 2;
}
