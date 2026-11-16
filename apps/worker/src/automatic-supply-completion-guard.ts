import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  readAutomaticPrimaryEvidence,
  automaticSupplyEvidenceSql,
  accountAutomaticSupplyEvidenceSql,
  primaryProductEvidence,
} from "./automatic-selection-evidence.js";
import {
  normalizedProductFields,
  selectConservativeSupplyMatch,
  genericTitleFactsCompatible,
} from "./automatic-selection-evaluation.js";
import { supplyFacts } from "./supply-facts-from-records.js";
import type { CalculationOwnership } from "./opportunity-calculation-ownership.js";
import {
  supplyDetailText,
  supplyDetailEligible,
  supplySkuUseCompatible,
} from "./supply-detail-facts.js";

/** Revalidate old automatic P75 costs before an independent scoring worker closes a pipeline. */
export async function automaticSupplyCompletionQuoteValid(
  connection: PoolConnection,
  parameters: string[],
  proof: RowDataPacket,
  ownership: CalculationOwnership = null,
) {
  if (
    proof.purchase_source_type !== "automatic_crawler_evidence" ||
    proof.purchase_confirmation_mode !== "automatic_evidence"
  )
    return true;
  if (ownership && !ownership.owner) return false;
  const skuRef = /^1688:(\d{1,40}):sku:(\d{1,40}):(classified-details:v1|p75:\d+)$/.exec(
    String(proof.purchase_source_ref_id),
  );
  if (String(proof.purchase_source_ref_id).includes(":sku:") && !skuRef) return false;
  if (
    proof.purchase_source_type !== "automatic_crawler_evidence" ||
    proof.purchase_confirmation_mode !== "automatic_evidence" ||
    (!skuRef && !/^1688:\d{1,40}:p75:\d+$/.test(String(proof.purchase_source_ref_id)))
  )
    return true;
  const [opportunityId, organizationId, workspaceId] = parameters;
  const { linked, detail } = await readAutomaticPrimaryEvidence(connection,
    { opportunityId: opportunityId!, organizationId: organizationId!, workspaceId: workspaceId!,
      ...(ownership?.owner ? { accountId: ownership.owner.account_id } : {}) });
  const primary = primaryProductEvidence(linked, detail);
  const parse = (value: unknown) => (typeof value === "string" ? JSON.parse(value) : value);
  if (!primary) return false;
  const title = normalizedProductFields(parse(primary.payload_json)).title;
  if (typeof title !== "string" || !title.trim()) return false;
  const [rows] = await connection.query<RowDataPacket[]>(
    ownership?.owner ? accountAutomaticSupplyEvidenceSql : automaticSupplyEvidenceSql,
    ownership?.owner ? [parameters[0], ownership.owner.account_id] : parameters,
  );
  if (skuRef) {
    const row = rows.find((row) => row.raw_evidence_id === proof.supply_evidence_id);
    if (!row) return false;
    const fields = normalizedProductFields(parse(row.payload_json));
    const item = supplyFacts([row])[0];
    if (!item) return false;
    if (skuRef[3] !== "classified-details:v1") {
      const match = selectConservativeSupplyMatch(title, supplyFacts(rows));
      return Boolean(
        match &&
        match.item.skuId === skuRef[2] &&
        match.item.externalId === skuRef[1] &&
        match.item.evidenceId === proof.supply_evidence_id &&
        match.item.externalId === proof.supply_offer_id &&
        match.conservativePrice === Number(proof.purchase_price),
      );
    }
    return (
      fields.record_type === "offer_sku_detail" &&
      item.externalId === skuRef[1] &&
      item.skuId === skuRef[2] &&
      item.externalId === proof.supply_offer_id &&
      item.currency === "CNY" &&
      Number.isFinite(item.price) &&
      item.price > 0 &&
      item.price === Number(proof.purchase_price) &&
      supplyDetailEligible(item) &&
      supplySkuUseCompatible(title, item) &&
      genericTitleFactsCompatible(title, `${item.title} ${supplyDetailText(item)}`)
    );
  }
  const supplies = supplyFacts(rows);
  const match = selectConservativeSupplyMatch(title, supplies);
  return Boolean(
    match &&
    match.item.evidenceId === proof.supply_evidence_id &&
    match.item.externalId === proof.supply_offer_id &&
    match.conservativePrice === Number(proof.purchase_price),
  );
}
