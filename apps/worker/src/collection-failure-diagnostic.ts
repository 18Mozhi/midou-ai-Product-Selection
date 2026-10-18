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
