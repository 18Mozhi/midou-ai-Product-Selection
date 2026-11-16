import type { Pool, RowDataPacket } from "mysql2/promise";
import { rehearsalOwns } from "./account-read-rehearsal.js";

export interface ErpSourcingReference {
  normalized_record_id: string;
  evidence_id: string;
  title: string;
  image_url: string | null;
  supplier_code: string | null;
  cost_cny: number | null;
  cost_usd: number | null;
  source_url: string;
  observed_at: string;
}

const payload = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const amount = (value: unknown) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const http = (value: unknown) => {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};
const iso = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

export async function loadErpSourcingReference(
  pool: Pool,
  input: { opportunityId: string } & (
    { accountId: string } | { organizationId: string; workspaceId: string }
  ),
): Promise<ErpSourcingReference | null> {
  const account = "accountId" in input;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT n.id normalized_record_id,n.payload_json,e.id evidence_id,e.captured_at FROM opportunities o JOIN trend_signals s ON s.topic_id=o.source_ref_id JOIN normalized_records n ON n.id=s.normalized_record_id AND n.status='active' JOIN raw_evidence e ON e.id=n.raw_evidence_id JOIN providers p ON p.id=n.provider_id AND p.code='erp_product_catalog' " +
      (account
        ? "JOIN account_owned_records oo ON oo.source_table='opportunities' AND oo.source_id=o.id "
        : "") +
      "WHERE o.id=? " +
      (account
        ? `AND oo.account_id=?
           AND s.raw_evidence_id=e.id AND s.provider_id=n.provider_id AND e.provider_id=n.provider_id
           AND ${rehearsalOwns("trend_topics", "o.source_ref_id", "oo.account_id")} AND ${rehearsalOwns("trend_signals", "s.id", "oo.account_id")} AND ${rehearsalOwns("normalized_records", "n.id", "oo.account_id")} AND ${rehearsalOwns("raw_evidence", "e.id", "oo.account_id")} `
        : "AND o.organization_id=? AND o.workspace_id=? ") +
      "ORDER BY n.record_version DESC,n.created_at DESC LIMIT 1",
    [
      input.opportunityId,
      ...(account ? [input.accountId] : [input.organizationId, input.workspaceId]),
    ],
  );
  const row = rows[0];
  if (!row) return null;
  const value = payload(row.payload_json),
    title = text(value.title),
    sourceUrl = http(value.source_url),
    observedAt = iso(value.observed_at ?? row.captured_at);
  if (!title || !sourceUrl || !observedAt) return null;
  return {
    normalized_record_id: String(row.normalized_record_id),
    evidence_id: String(row.evidence_id),
    title,
    image_url: http(value.image_url),
    supplier_code: text(value.supplier_code),
    cost_cny: amount(value.cost_cny),
    cost_usd: amount(value.cost_usd),
    source_url: sourceUrl,
    observed_at: observedAt,
  };
}
