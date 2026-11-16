export async function accountRehearsalTaskScope(db) {
  const [columns] = await db.query(
    "SHOW COLUMNS FROM collection_tasks WHERE Field IN ('account_id','organization_id','workspace_id')",
  );
  const shape = columns
    .map((row) => row.Field)
    .sort()
    .join(",");
  if (shape === "organization_id,workspace_id")
    return { native: false, relation: "collection_tasks" };
  if (shape !== "account_id") throw new Error("invalid_collection_task_scope_schema");
  // Historical paths must use each task's sealed source record, never a
  // representative workspace inferred from the account.
  return {
    native: true,
    relation:
      "(SELECT task.id,task.request_id,task.trace_id,task.account_id," +
      "record.legacy_org_id organization_id,record.legacy_workspace_id workspace_id " +
      "FROM collection_tasks task JOIN account_owned_records owner " +
      "ON owner.source_table='collection_tasks' AND owner.source_id=task.id AND owner.account_id=task.account_id " +
      "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
      "AND (owner.reason='exclusive_owner' OR (owner.reason IN ('shared','unassigned') AND owner.account_id=cut.primary_account_id)) " +
      "LEFT JOIN account_retirement_records record ON record.run_id=cut.source_run_id " +
      "AND record.source_table='collection_tasks' AND record.source_id=task.id LIMIT 18446744073709551615)",
  };
}
