/** Keep account admission independent from legacy tenant tables. */
export const eligibleTaskOwnerFromSql =
  "FROM account_owned_records task_owner " +
  "JOIN users task_account ON task_account.id=task_owner.account_id AND task_account.status='active' " +
  "JOIN account_ownership_cutover task_cut ON task_cut.slot='current' AND task_cut.contract_version=25 " +
  "WHERE task_owner.source_table='collection_tasks' AND " +
  "(task_owner.reason='exclusive_owner' OR (task_owner.reason IN ('shared','unassigned') AND task_owner.account_id=task_cut.primary_account_id))";

export const activeAccountCollectionTaskStatusesSql =
  "('scheduled','queued','leased','running','parsing','validating','retry_scheduled','rate_limited')";

export const sealedAccountCollectionBacklogCountSql =
  "(SELECT COUNT(*) FROM collection_tasks backlog WHERE EXISTS (SELECT 1 " +
  eligibleTaskOwnerFromSql + " AND task_owner.source_id=backlog.id)" +
  " AND backlog.status IN " + activeAccountCollectionTaskStatusesSql + ")";

export const nativeCollectionBacklogCountSql =
  "(SELECT COUNT(*) FROM collection_tasks backlog WHERE EXISTS (SELECT 1 " +
  eligibleTaskOwnerFromSql + " AND task_owner.source_id=backlog.id AND task_owner.account_id=backlog.account_id)" +
  " AND backlog.status IN " + activeAccountCollectionTaskStatusesSql + ")";
