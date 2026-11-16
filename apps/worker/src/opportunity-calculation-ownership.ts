import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { nativeOpportunityStorage } from "./opportunity-storage.js";

export type CalculationOwnership = {
  owner: { account_id: string; reason: "shared" | "unassigned" | "exclusive_owner" } | null;
} | null;
export type CalculationOwnerRef = readonly [string, string];

export async function hasCalculationAccountCutover(db: Pick<PoolConnection,"query">) {
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT slot FROM account_ownership_cutover WHERE slot='current' AND contract_version=25",
    );
    return rows.length > 0;
  } catch (error) {
    const mysql = error as {code?:string;sqlMessage?:string};
    if (mysql.code === "ER_NO_SUCH_TABLE" &&
      /\.account_ownership_cutover' doesn't exist$/i.test(mysql.sqlMessage ?? "")) return false;
    throw error;
  }
}

export async function resolveCalculationOwnership(
  c: Pick<PoolConnection, "query">, parentId: string,
  source: "opportunities" | "competitors" | "sourcing_searches" | "approval_requests" | "collection_tasks" = "opportunities",
): Promise<CalculationOwnership> {
  let rows: RowDataPacket[];
  try {
    [rows] = await c.query<RowDataPacket[]>(
      "SELECT cut.primary_account_id,o.account_id,o.reason FROM account_ownership_cutover cut " +
        "LEFT JOIN account_owned_records o ON o.source_table=? AND o.source_id=? " +
        "WHERE cut.slot='current' AND cut.contract_version=25 LOCK IN SHARE MODE", [source,parentId],
    );
  } catch (error) {
    const mysql = error as { code?: string; sqlMessage?: string };
    if (mysql.code === "ER_NO_SUCH_TABLE" &&
      /\.account_ownership_cutover' doesn't exist$/i.test(mysql.sqlMessage ?? "")) return null;
    throw error;
  }
  const row = rows[0];
  if (!row) return null;
  if (!row.account_id) return {owner:null};
  if (row.reason !== "exclusive_owner" && (
    (row.reason !== "shared" && row.reason !== "unassigned") || row.account_id !== row.primary_account_id
  )) throw new Error("opportunity_calculation_parent_owner_mismatch");
  return {owner:{account_id:row.account_id,reason:row.reason}};
}

export async function readCalculationOpportunityForClaim(
  c: Pick<PoolConnection, "query">, opportunityId: string, missingCode: string,
) {
  const native = await nativeOpportunityStorage(c);
  const [[parent]] = await c.query<RowDataPacket[]>(
    `SELECT ${native ? "account_id" : "organization_id,workspace_id"} FROM opportunities WHERE id=?` +
      (native ? " LOCK IN SHARE MODE" : ""),
    [opportunityId],
  );
  if (!parent) throw new Error(missingCode);
  if (!native) return { organizationId: String(parent.organization_id), workspaceId: String(parent.workspace_id) };
  const ownership = await resolveCalculationOwnership(c, opportunityId);
  if (!ownership?.owner || ownership.owner.account_id !== parent.account_id)
    throw new Error("opportunity_calculation_parent_owner_mismatch");
  return { organizationId: "", workspaceId: "", ownership };
}

export async function calculationOwnersMatch(
  c: PoolConnection, ownership: CalculationOwnership, refs: CalculationOwnerRef[], allowMissing = false,
) {
  if (!ownership || !refs.length) return true;
  const unique = [...new Map(refs.map(ref => [ref.join(":"),ref])).values()];
  const [rows] = await c.query<RowDataPacket[]>(
    "SELECT account_id FROM account_owned_records WHERE (source_table,source_id) IN (?) LOCK IN SHARE MODE", [unique],
  );
  const account = ownership.owner?.account_id;
  return account ? (allowMissing || rows.length === unique.length) && rows.every(row => row.account_id === account)
    : rows.length === 0;
}

export async function registerCalculationOwners(
  c: PoolConnection, ownership: CalculationOwnership, refs: CalculationOwnerRef[],
) {
  if (!ownership?.owner || !refs.length) return;
  const {account_id,reason} = ownership.owner;
  await c.query("INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ?",
    [refs.map(([table,id]) => [table,id,account_id,reason])]);
}
