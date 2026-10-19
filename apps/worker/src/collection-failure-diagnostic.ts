const technicalCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "PROTOCOL_CONNECTION_LOST",
  "ER_LOCK_DEADLOCK",
  "ER_LOCK_WAIT_TIMEOUT",
  "ER_DUP_ENTRY",
  "ER_DATA_TOO_LONG",
  "ER_TRUNCATED_WRONG_VALUE",
  "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD",
  "ER_BAD_NULL_ERROR",
  "ER_NO_REFERENCED_ROW_2",
  "ER_QUERY_INTERRUPTED",
  "ER_FILSORT_ABORT",
  "ENOENT",
  "ENOSPC",
  "EIO",
  "EACCES",
  "EPERM",
]);
const errorNames = new Set(["Error", "TypeError", "RangeError", "SyntaxError"]);
export type EvidencePersistenceOperation =
  | "transaction_begin"
  | "scope_lock"
  | "dedupe_lock"
  | "record_version_lock"
  | "file_write"
  | "file_asset_insert"
  | "raw_evidence_insert"
  | "record_supersede"
  | "normalized_record_insert"
  | "provenance_insert"
  | "evidence_link"
  | "event_insert"
  | "outbox_insert"
  | "operation_insert"
  | "transaction_commit"
  | "dedupe_link";
const persistenceOperations = new WeakMap<object, EvidencePersistenceOperation>();
/** Keep context outside the error and never trust arbitrary error properties. */
export function markEvidencePersistenceFailure(
  error: unknown,
  operation: EvidencePersistenceOperation,
) {
  if (error && typeof error === "object") persistenceOperations.set(error, operation);
}

/** Internal diagnosis only: never serialize the error, message, SQL, payload or cause. */
export function collectionFailureDiagnostic(
  error: unknown,
  context: {
    taskId: string;
    stage:
      | "source_collection"
      | "evidence_artifact"
      | "normalize"
      | "evidence_persist"
      | "classification"
      | "provider_runtime"
      | "task_execution";
    providerId?: string;
    recordOrdinal?: number;
  },
) {
  const value =
    error && typeof error === "object"
      ? (error as { code?: unknown; name?: unknown; errno?: unknown })
      : {};
  return {
    service: "product-scout-worker",
    queue: "collection_tasks",
    status: "internal_failure_diagnostic",
    task_id: context.taskId,
    stage: context.stage,
    provider_id: context.providerId,
    record_ordinal: context.recordOrdinal,
    persistence_operation:
      error && typeof error === "object" ? persistenceOperations.get(error) : undefined,
    technical_code:
      typeof value.code === "string" && technicalCodes.has(value.code)
        ? value.code
        : "unclassified_error",
    error_type:
      typeof value.name === "string" && errorNames.has(value.name) ? value.name : "unknown",
    mysql_errno:
      typeof value.errno === "number" &&
      Number.isSafeInteger(value.errno) &&
      value.errno > 0 &&
      value.errno <= 65535
        ? value.errno
        : undefined,
    observed_at: new Date().toISOString(),
  };
}
