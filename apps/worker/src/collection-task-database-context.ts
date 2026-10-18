type CollectionQueueStage = "recover_expired" | "queue_ready" | "claim";

const statementContext = (value: unknown) => {
  if (typeof value !== "string") return "statement_unknown";
  const sql = value.trimStart().replace(/\s+/g, " ");
  if (/^DELETE FROM crawler_scheduler_leases WHERE expires_at/i.test(sql))
    return "expired_scheduler_leases_delete";
  if (/^SELECT slot_key FROM crawler_scheduler_leases/i.test(sql)) return "scheduler_slot_lock";
  if (/^INSERT INTO crawler_scheduler_leases/i.test(sql)) return "scheduler_lease_insert";
  if (/^SELECT \* FROM collection_tasks WHERE id=/i.test(sql)) return "task_primary_lock";
  if (/^SELECT \* FROM collection_tasks/i.test(sql)) return "task_candidates";
  if (/^UPDATE collection_tasks/i.test(sql)) return "task_update";
  if (/^INSERT INTO collection_task_attempts/i.test(sql)) return "attempt_insert";
  return "statement_other";
};

/** Preserve retries and rollback; expose only an allowlisted operation label. */
export async function collectionQueueDatabaseContext<T>(
  stage: CollectionQueueStage,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (cause) {
    const code = (cause as { code?: unknown } | null)?.code;
    if (code !== "ER_LOCK_DEADLOCK" && code !== "ER_LOCK_WAIT_TIMEOUT") throw cause;
    const statement = statementContext((cause as { sql?: unknown }).sql);
    throw Object.assign(new Error(`collection_database:${stage}:${code}:${statement}`, { cause }), {
      code,
    });
  }
}
