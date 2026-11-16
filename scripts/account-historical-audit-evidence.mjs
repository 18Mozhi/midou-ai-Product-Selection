import { createHash } from "node:crypto";
import { fileAssetScopeRelation } from "./lib/file-asset-scope.mjs";
import { accountRehearsalTaskScope } from "./lib/account-rehearsal-task-scope.mjs";
// One explicitly approved historical rehearsal; not a production evidence exception.
export const october15AuditEvidenceSha256 =
  "28056f1387984bd3112df3574c72a8a72cfabb42473690bea8e0b1ed5280800b";

export async function loadHistoricalAuditEvidence(
  connection,
  runId,
  stamp,
  database,
  historicalRoots = false,
) {
  const { entries, sha256 } = await readHistoricalAuditEvidence(
    connection,
    runId,
    stamp,
    database,
    historicalRoots,
  );
  if (sha256 !== october15AuditEvidenceSha256)
    throw new Error("historical_audit_evidence_original_digest_mismatch");
  return entries;
}

export async function readHistoricalAuditEvidence(
  connection,
  runId,
  stamp,
  database,
  historicalRoots = false,
) {
  if (
    runId !== "6d55e9c4-87d5-453a-9b2a-5c2b096cfc27" ||
    stamp !== "2026-10-15T11-58-28-788Z" ||
    database !== "product_scout_restore_m0704_3a10e02cf47d_rehearsal"
  )
    throw new Error("historical_audit_evidence_not_authorized");
  const [rawScope] = await connection.query(
    "SHOW COLUMNS FROM raw_evidence WHERE Field IN ('account_id','organization_id','workspace_id')",
  );
  const shape = rawScope
    .map((row) => row.Field)
    .sort()
    .join(",");
  let raw = "raw_evidence";
  if (shape === "account_id") {
    const task = await accountRehearsalTaskScope(connection);
    if (!task.native) throw new Error("historical_audit_evidence_requires_native_tasks");
    raw = `(SELECT e.*,t.organization_id,t.workspace_id FROM raw_evidence e
      JOIN ${task.relation} t ON t.id=e.collection_task_id AND t.account_id=e.account_id)`;
  } else if (shape !== "organization_id,workspace_id") {
    throw new Error("historical_audit_evidence_scope_invalid");
  }
  const [rows] = await connection.query(`SELECT f.id,f.organization_id,f.workspace_id,
    f.relative_path,f.content_sha256,f.size_bytes,f.status asset_status,
    CAST(JSON_ARRAY(r.id,r.organization_id,r.workspace_id,r.collection_task_id,
      r.collection_subquery_id,r.provider_id,r.file_asset_id,r.source_url,r.canonical_url,
      r.dedupe_key,r.content_sha256,r.content_type,r.size_bytes,r.captured_at,r.parser_version,
      r.adapter_version,r.retention_until,r.status,r.request_id,r.trace_id,r.created_by,r.created_at,
      f.id,f.category,f.relative_path,f.content_sha256,f.size_bytes,f.status,
      f.created_by,f.created_at,f.updated_at) AS CHAR) original_record,
    IF(o.slug LIKE 'm0306-%','m0306','m0406') fixture
    FROM ${raw} r JOIN providers p ON p.id=r.provider_id
    JOIN ${await fileAssetScopeRelation(connection)} f ON f.id=r.file_asset_id AND f.organization_id=r.organization_id
      AND f.workspace_id=r.workspace_id AND f.created_by=r.created_by
      AND f.size_bytes=r.size_bytes AND f.content_sha256=r.content_sha256
    JOIN ${historicalRoots ? "historical_organizations" : "organizations"} o ON o.id=r.organization_id JOIN users u ON u.id=r.created_by
    WHERE f.category='evidence' AND f.status='active' AND r.status='active'
    AND NOT EXISTS (SELECT 1 FROM browser_evidence_artifacts b WHERE b.file_asset_id=f.id)
    AND (
      (p.code=CONCAT('m03_06_',LEFT(REPLACE(r.request_id,'-',''),10))
       AND r.source_url='https://example.test/raw/1' AND r.canonical_url='https://example.test/item/1'
       AND r.parser_version='parser-v1' AND r.adapter_version='adapter-v1'
       AND f.size_bytes=16 AND f.content_sha256=SHA2('{"title":"Desk"}',256)
       AND ((o.slug=CONCAT('m0306-primary-',LEFT(r.request_id,8))
         AND u.email_normalized=CONCAT('m03-06-primary-',r.request_id,'@example.test'))
         OR (o.slug=CONCAT('m0306-outside-',LEFT(r.request_id,8))
         AND u.email_normalized=CONCAT('m03-06-outside-',r.request_id,'@example.test'))))
      OR
      (p.code=CONCAT('m04_06_',LEFT(r.request_id,8)) AND r.source_url=r.canonical_url
       AND r.source_url REGEXP '^https://example[.]test/supply/[12]$'
       AND r.parser_version='product-supply-csv-v1' AND r.adapter_version='manual-product-supply-csv-adapter-v1'
       AND o.slug=CONCAT('m0406-primary-',LEFT(r.request_id,8))
       AND u.email_normalized=CONCAT('m04-06-',r.request_id,'@example.test')
       AND f.size_bytes=1 AND f.relative_path=CONCAT('m0406/',f.id,'.json')
       AND f.content_sha256=REPEAT(RIGHT(r.source_url,1),64))
    ) ORDER BY BINARY r.id`);
  const entries = new Map(rows.map((row) => [row.id, assetFacts(row)]));
  if (
    rows.length !== 82 ||
    entries.size !== 82 ||
    rows.filter((row) => row.fixture === "m0306").length !== 54
  )
    throw new Error("historical_audit_evidence_identity_mismatch");
  const sha256 = createHash("sha256")
    .update(JSON.stringify(rows.map((row) => row.original_record)))
    .digest("hex");
  return { entries, sha256 };
}

const assetFacts = (row) =>
  JSON.stringify([
    row.organization_id,
    row.workspace_id,
    row.relative_path,
    row.content_sha256,
    String(row.size_bytes),
    row.asset_status,
  ]);
export function isHistoricalAuditAsset(entries, row) {
  if (!entries?.has(row.id)) return false;
  if (entries.get(row.id) !== assetFacts(row) || !row.account_id)
    throw new Error("historical_audit_evidence_asset_changed");
  return true;
}
