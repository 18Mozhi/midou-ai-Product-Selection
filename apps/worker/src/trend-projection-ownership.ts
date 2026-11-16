import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { TrendProjectionError, type TrendProjectionJob } from "./trend-projection-calculation.js";
import { hasNativeNormalizedAccountScope } from "./automatic-selection-evidence.js";
import { collectionTaskScope } from "@scoutops/database";

type Owner = { account_id: string; reason: "shared" | "unassigned" | "exclusive_owner" };
export type TrendProjectionOwnership = { owner: Owner | null; nativeEvidence?: true } | null;
type Ref = readonly [string, string];
type Query = Pick<PoolConnection, "query">;

export async function resolveTrendProjectionOwnership(
  c: Query,
  job: TrendProjectionJob,
  lock = true,
): Promise<TrendProjectionOwnership> {
  const native = await hasNativeNormalizedAccountScope(c);
  const nativeTask = native && (await collectionTaskScope(c)) === "account";
  let rows: RowDataPacket[];
  try {
    [rows] = await c.query<RowDataPacket[]>(
      "SELECT cut.primary_account_id,n.id record_id,no.account_id,no.reason,eo.account_id evidence_account_id" +
        (native ? ",tor.source_id IS NOT NULL native_task_owned " : " ") +
        "FROM account_ownership_cutover cut LEFT JOIN normalized_records n ON n.id=? AND n.raw_evidence_id=? " +
        "AND n.provider_id=? " +
        (native ? "" : "AND n.organization_id=? AND n.workspace_id=? ") +
        "LEFT JOIN account_owned_records no ON no.source_table='normalized_records' AND no.source_id=n.id " +
        "LEFT JOIN account_owned_records eo ON eo.source_table='raw_evidence' AND eo.source_id=n.raw_evidence_id " +
        (native
          ? "LEFT JOIN raw_evidence r ON r.id=n.raw_evidence_id AND r.provider_id=n.provider_id AND r.account_id=n.account_id " +
            "AND r.account_id=no.account_id AND r.account_id=eo.account_id " +
            "LEFT JOIN collection_tasks t ON t.id=? AND " +
            (nativeTask
              ? "t.account_id=r.account_id "
              : "t.organization_id=? AND t.workspace_id=? ") +
            "LEFT JOIN account_owned_records tor ON tor.source_table='collection_tasks' AND tor.source_id=t.id AND tor.account_id=r.account_id " +
            "AND (r.collection_task_id=t.id OR EXISTS (SELECT 1 FROM collection_task_evidence_links l " +
            "JOIN account_owned_records lo ON lo.source_table='collection_task_evidence_links' AND lo.source_id=l.id " +
            "WHERE lo.account_id=r.account_id AND l.collection_task_id=t.id AND l.normalized_record_id=n.id AND l.raw_evidence_id=r.id AND l.provider_id=r.provider_id)) "
          : "") +
        "WHERE cut.slot='current' AND cut.contract_version=25" +
        (lock ? " LOCK IN SHARE MODE" : ""),
      [
        job.normalizedRecordId,
        job.rawEvidenceId,
        job.providerId,
        ...(native ? [job.collectionTaskId] : []),
        ...(nativeTask ? [] : [job.organizationId, job.workspaceId]),
      ],
    );
  } catch (error) {
    const mysql = error as { code?: string; sqlMessage?: string };
    if (
      mysql.code === "ER_NO_SUCH_TABLE" &&
      /\.account_ownership_cutover' doesn't exist$/i.test(mysql.sqlMessage ?? "") &&
      !native
    )
      return null;
    throw error;
  }
  const row = rows[0];
  if (native && (!row?.account_id || !row.native_task_owned))
    throw new TrendProjectionError("trend_projection_evidence_owner_mismatch", false);
  if (!row) return null;
  if (!row.record_id || row.account_id !== row.evidence_account_id)
    throw new TrendProjectionError("trend_projection_evidence_owner_mismatch", false);
  if (!row.account_id) return { owner: null };
  if (
    row.reason !== "exclusive_owner" &&
    ((row.reason !== "shared" && row.reason !== "unassigned") ||
      row.account_id !== row.primary_account_id)
  )
    throw new TrendProjectionError("trend_projection_evidence_owner_mismatch", false);
  return {
    owner: { account_id: row.account_id, reason: row.reason },
    ...(native ? { nativeEvidence: true } : {}),
  };
}

export async function verifyTrendProjectionOwner(
  c: Query,
  ownership: TrendProjectionOwnership,
  ref: Ref,
  lock = true,
) {
  if (!ownership) return;
  const [rows] = await c.query<RowDataPacket[]>(
    "SELECT account_id FROM account_owned_records WHERE source_table=? AND source_id=?" +
      (lock ? " LOCK IN SHARE MODE" : ""),
    [...ref],
  );
  if ((rows[0]?.account_id ?? null) !== (ownership.owner?.account_id ?? null))
    throw new TrendProjectionError("trend_projection_destination_owner_mismatch", false);
}

export async function verifyTrendModelInputs(
  c: Query,
  ownership: TrendProjectionOwnership,
  refs: Ref[],
) {
  if (!ownership || !refs.length) return;
  const unique = [...new Map(refs.map((ref) => [ref.join(":"), ref])).values()];
  const [rows] = await c.query<RowDataPacket[]>(
    "SELECT account_id FROM account_owned_records WHERE (source_table,source_id) IN (?)",
    [unique],
  );
  const account = ownership.owner?.account_id;
  if (
    account
      ? rows.length !== unique.length || rows.some((row) => row.account_id !== account)
      : rows.length > 0
  )
    throw new TrendProjectionError("trend_projection_model_input_owner_mismatch", false);
}

export async function registerTrendProjectionOwners(
  c: PoolConnection,
  ownership: TrendProjectionOwnership,
  refs: Ref[],
) {
  const owner = ownership?.owner;
  if (!owner || !refs.length) return;
  await c.query(
    "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ?",
    [refs.map(([table, id]) => [table, id, owner.account_id, owner.reason])],
  );
}
