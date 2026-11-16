import { approvalTemplateScopeRelation } from "@scoutops/database";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { CalculationOwnerRef } from "./opportunity-calculation-ownership.js";

export async function readApprovalResourceOwners(db: PoolConnection, run: RowDataPacket, owner: string): Promise<CalculationOwnerRef[] | null> {
  const nativeTemplate = await approvalTemplateScopeRelation(db) !== "approval_templates";
  const [[definition]] = await db.query<RowDataPacket[]>(
    "SELECT d.id definition_id FROM approval_node_runs r " +
      "JOIN approval_template_nodes d ON d.id=r.template_node_id AND d.template_version_id=? AND d.ordinal=r.ordinal " +
      "JOIN approval_template_versions v ON v.id=d.template_version_id " +
      "JOIN approval_templates t ON t.id=v.template_id AND t.id=? AND t.resource_type=? WHERE r.id=?" +
      (nativeTemplate ? " AND t.account_id=?" : "") + " LOCK IN SHARE MODE",
    [run.template_version_id, run.template_id, run.resource_type, run.id, ...(nativeTemplate ? [owner] : [])],
  );
  if (!definition) return null;
  const task = run.resource_type === "task";
  if (!task && run.resource_type !== "opportunity_decision")
    return null;
  const table = task ? "tasks" : "opportunities";
  const [columns] = await db.query<RowDataPacket[]>(
    `SHOW COLUMNS FROM ${table} WHERE Field IN ('account_id','organization_id','workspace_id')`,
  );
  const shape = columns.map(column => column.Field).sort().join(",");
  const native = shape === "account_id";
  if (!native && shape !== "organization_id,workspace_id")
    throw new Error("approval_account_schema_not_ready");
  const from = task ? "tasks p WHERE p.id=?" :
    "opportunity_decisions d JOIN opportunities p ON p.id=d.opportunity_id WHERE d.id=?";
  const [[parent]] = await db.query<RowDataPacket[]>(
    `SELECT p.id parent_id FROM ${from}${native ? " AND p.account_id=?" : ""} LOCK IN SHARE MODE`,
    [run.resource_id, ...(native ? [owner] : [])],
  );
  if (!parent) return null;
  return [["approval_template_nodes", String(definition.definition_id)], [table, String(parent.parent_id)],
    ...(task ? [] : [["opportunity_decisions", String(run.resource_id)] as const])];
}
