import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  calculationOwnersMatch,
  registerCalculationOwners,
  type CalculationOwnerRef,
  type CalculationOwnership,
} from "./opportunity-calculation-ownership.js";

export async function requireSourcingOwners(
  c: PoolConnection,
  ownership: CalculationOwnership,
  refs: CalculationOwnerRef[],
  allowMissing = false,
) {
  if (!(await calculationOwnersMatch(c, ownership, refs, allowMissing)))
    throw Object.assign(new Error("sourcing_projection_owner_mismatch"), {
      code: "sourcing_projection_owner_mismatch",
    });
}

export async function requireSourcingRecordOwner(
  c: PoolConnection,
  ownership: CalculationOwnership,
  record: RowDataPacket,
) {
  await requireSourcingRecordsOwner(c, ownership, [record]);
}

export async function requireSourcingRecordsOwner(
  c: PoolConnection,
  ownership: CalculationOwnership,
  records: RowDataPacket[],
) {
  await requireSourcingOwners(
    c,
    ownership,
    records.flatMap((record): CalculationOwnerRef[] => [
      ["normalized_records", String(record.id)],
      ["raw_evidence", String(record.raw_evidence_id)],
      ["collection_task_evidence_links", String(record.evidence_link_id)],
      ["collection_subqueries", String(record.collection_subquery_id)],
    ]),
  );
}

export async function registerSourcingCandidate(
  c: PoolConnection,
  ownership: CalculationOwnership,
  searchId: string,
  record: RowDataPacket,
  candidateId: string,
  inserted: boolean,
) {
  if (!ownership) return;
  if (inserted) {
    await registerCalculationOwners(c, ownership, [["sourcing_candidates", candidateId]]);
    return;
  }
  const [rows] = await c.query<RowDataPacket[]>(
    "SELECT id FROM sourcing_candidates WHERE search_id=? AND normalized_record_id=? AND raw_evidence_id=? AND provider_id=? FOR UPDATE",
    [searchId, record.id, record.raw_evidence_id, record.provider_id],
  );
  if (!rows[0])
    throw Object.assign(new Error("sourcing_candidate_source_mismatch"), {
      code: "sourcing_candidate_source_mismatch",
    });
  await requireSourcingOwners(c, ownership, [["sourcing_candidates", String(rows[0].id)]]);
}
