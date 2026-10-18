import { randomUUID } from "node:crypto";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { selectionPrimaryAsinSql } from "@scoutops/database";
import { automaticPrimaryEvidenceSql } from "./automatic-selection-evidence.js";
import { amazonAsin } from "./competitor-discovery-policy.js";

const eligibleOpportunitySql =
  "o.source_type='trend_topic' AND o.decision_status='pending' " +
  "AND o.lifecycle_status NOT IN ('archived','deleted') " +
  "AND EXISTS (SELECT 1 FROM organizations scope_org JOIN workspaces scope_ws " +
  "ON scope_ws.organization_id=scope_org.id WHERE scope_org.id=o.organization_id " +
  "AND scope_org.status='active' AND scope_ws.id=o.workspace_id AND scope_ws.status='active')";

/** Nonlocking admission only. Never borrow another opportunity's product or snapshots. */
export const missingPrimaryProductCandidateSql =
  "SELECT primary_repair.*, (primary_repair.primary_asin IS NOT NULL AND NOT EXISTS " +
  "(SELECT 1 FROM competitors c WHERE c.organization_id=primary_repair.organization_id " +
  "AND c.workspace_id=primary_repair.workspace_id AND c.opportunity_id=primary_repair.id " +
  "AND c.market=primary_repair.market AND c.source_site='Amazon' " +
  "AND BINARY UPPER(c.external_id)=BINARY primary_repair.primary_asin)) missing_primary " +
  "FROM (SELECT o.id,o.organization_id,o.workspace_id,o.market," +
  "o.created_by,o.created_at," +
  selectionPrimaryAsinSql +
  " primary_asin " +
  "FROM (SELECT o.* FROM opportunities o WHERE o.id>? AND " +
  eligibleOpportunitySql +
  " AND EXISTS (SELECT 1 FROM opportunity_evidence_links primary_link " +
  "JOIN providers primary_provider ON primary_provider.id=primary_link.provider_id " +
  "AND primary_provider.code='amazon_product' AND primary_provider.status='enabled' " +
  "WHERE primary_link.opportunity_id=o.id AND primary_link.organization_id=o.organization_id " +
  "AND primary_link.workspace_id=o.workspace_id) ORDER BY o.id LIMIT 20) o " +
  " LIMIT 18446744073709551615) primary_repair " +
  "ORDER BY primary_repair.id";

export interface PrimaryProductRepairResult {
  afterId: string;
  repaired: boolean;
}

/** Called inside the existing downstream transaction; its normal producer schedules details. */
export async function repairMissingPrimaryProduct(
  c: PoolConnection,
  providerId: string,
  now: Date,
  afterId = "",
): Promise<PrimaryProductRepairResult> {
  const [candidates] = await c.query<RowDataPacket[]>(missingPrimaryProductCandidateSql, [afterId]);
  const candidate = candidates.find((row) => Number(row.missing_primary) === 1);
  const result = { afterId: String(candidate?.id ?? candidates.at(-1)?.id ?? ""), repaired: false };
  if (!candidate) return result;
  const [opportunities] = await c.query<RowDataPacket[]>(
    "SELECT o.id,o.market,o.created_by FROM opportunities o FORCE INDEX (PRIMARY) " +
      "WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? AND " +
      eligibleOpportunitySql +
      " FOR UPDATE",
    [candidate.id, candidate.organization_id, candidate.workspace_id],
  );
  if (!opportunities[0]) return result;
  const scope = [candidate.id, candidate.organization_id, candidate.workspace_id];
  const [evidence] = await c.query<RowDataPacket[]>(automaticPrimaryEvidenceSql, scope);
  const current = evidence[0];
  if (!current || current.provider_status !== "enabled") return result;
  let fields: Record<string, unknown>;
  try {
    fields =
      typeof current.payload_json === "string"
        ? JSON.parse(current.payload_json)
        : current.payload_json;
  } catch {
    return result;
  }
  if (!fields || typeof fields !== "object") return result;
  const url = typeof fields.canonical_url === "string" ? fields.canonical_url : "";
  const asin = amazonAsin(fields, url);
  if (
    !asin ||
    asin !== candidate.primary_asin ||
    typeof fields.title !== "string" ||
    !fields.title.trim()
  )
    return result;
  const opportunity = opportunities[0];
  const [existing] = await c.query<RowDataPacket[]>(
    "SELECT id FROM competitors WHERE organization_id=? AND workspace_id=? " +
      "AND market=? AND source_site='Amazon' AND external_id=? AND opportunity_id=? LIMIT 1 FOR UPDATE",
    [candidate.organization_id, candidate.workspace_id, opportunity.market, asin, candidate.id],
  );
  // Includes deleted records: a deliberate deletion is never undone by repair.
  if (existing[0]) return result;
  const [insert] = await c.query<ResultSetHeader>(
    "INSERT IGNORE INTO competitors (id,organization_id,workspace_id,opportunity_id,provider_id,market," +
      "source_site,external_id,product_url,title,status,latest_snapshot_id,revision,created_by,created_at,updated_at) " +
      "VALUES (?,?,?,?,?,?,'Amazon',?,?,?,'active',NULL,1,?,?,?)",
    [
      randomUUID(),
      candidate.organization_id,
      candidate.workspace_id,
      candidate.id,
      providerId,
      opportunity.market,
      asin,
      url,
      fields.title.slice(0, 500),
      opportunity.created_by,
      now,
      now,
    ],
  );
  // Preparation release is safe on the old global key: conflict waits for migration.
  return { ...result, repaired: Number(insert.affectedRows) === 1 };
}
