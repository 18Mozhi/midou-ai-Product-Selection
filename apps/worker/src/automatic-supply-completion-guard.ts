import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  automaticPrimaryEvidenceSql,
  automaticPrimaryDetailEvidenceSql,
  automaticSupplyEvidenceSql,
  primaryProductEvidence,
} from "./automatic-selection-evidence.js";
import {
  normalizedProductFields,
  selectConservativeSupplyMatch,
  type SupplyFacts,
} from "./automatic-selection-evaluation.js";

/** Revalidate old automatic P75 costs before an independent scoring worker closes a pipeline. */
export async function automaticSupplyCompletionQuoteValid(
  connection: PoolConnection,
  parameters: string[],
  proof: RowDataPacket,
) {
  if (
    proof.purchase_source_type !== "automatic_crawler_evidence" ||
    proof.purchase_confirmation_mode !== "automatic_evidence" ||
    !/^1688:\d{1,40}:p75:\d+$/.test(String(proof.purchase_source_ref_id))
  )
    return true;
  const [linked] = await connection.query<RowDataPacket[]>(automaticPrimaryEvidenceSql, parameters);
  const [detail] = await connection.query<RowDataPacket[]>(
    automaticPrimaryDetailEvidenceSql,
    parameters,
  );
  const primary = primaryProductEvidence(linked[0], detail[0]);
  const parse = (value: unknown) => (typeof value === "string" ? JSON.parse(value) : value);
  if (!primary) return false;
  const title = normalizedProductFields(parse(primary.payload_json)).title;
  if (typeof title !== "string" || !title.trim()) return false;
  const [rows] = await connection.query<RowDataPacket[]>(automaticSupplyEvidenceSql, parameters);
  const supplies: SupplyFacts[] = rows.map((row) => {
    const fields = normalizedProductFields(parse(row.payload_json));
    const observed = fields.observed_at ?? row.created_at;
    return {
      title: String(fields.title ?? ""),
      price: fields.price == null ? NaN : Number(fields.price),
      currency: String(fields.currency ?? "").toUpperCase(),
      externalId: String(fields.external_id ?? ""),
      evidenceId: String(row.raw_evidence_id),
      observedAt: observed instanceof Date ? observed : new Date(String(observed)),
      priceDescription: String(fields.price_description ?? ""),
    };
  });
  const match = selectConservativeSupplyMatch(title, supplies);
  return Boolean(
    match &&
    match.item.evidenceId === proof.supply_evidence_id &&
    match.item.externalId === proof.supply_offer_id &&
    match.conservativePrice === Number(proof.purchase_price),
  );
}
