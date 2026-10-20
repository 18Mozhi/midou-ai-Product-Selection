/** Literal, SELECT-only cases reused against real MySQL; never insert synthetic business rows. */
const base = {
  taskStatus: "queued",
  queryStatus: "failed",
  error: "validation_failed",
  jobStatus: "succeeded",
  result: "{}",
  jobTask: "task",
  jobQuery: "query",
  jobOrg: "org",
  jobWorkspace: "ws",
  jobProvider: "provider",
};
export const cachedValidationResultCases = [
  ["post-browser validation retry", {}, 1],
  ["scheduled retry", { taskStatus: "retry_scheduled" }, 1],
  ["original pending result", { queryStatus: "pending", error: null }, 1],
  ["successful empty result", { jobStatus: "succeeded_empty" }, 1],
  ...["leased", "running", "succeeded", "dead_letter", "cancelled"].map((taskStatus) => [
    `failed query with ${taskStatus} task`,
    { taskStatus },
    0,
  ]),
  ...["network_error", "permission_denied", "rate_limited"].map((error) => [
    `other query failure ${error}`,
    { error },
    0,
  ]),
  ["failed browser", { jobStatus: "failed" }, 0],
  ["running browser", { jobStatus: "running" }, 0],
  ["absent result", { result: null }, 0],
  ["blocked query", { queryStatus: "blocked" }, 0],
  ["consumed query", { queryStatus: "succeeded" }, 0],
  ...["jobTask", "jobQuery", "jobOrg", "jobWorkspace", "jobProvider"].map((field) => [
    `mismatched ${field}`,
    { [field]: "other" },
    0,
  ]),
].map(([name, changes, expected]) => ({ name, ...base, ...changes, expected }));

export function cachedValidationResultCaseSql(predicate, value) {
  const query =
    "(SELECT ? id,? task_id,? organization_id,? workspace_id,? provider_id,? status,? error_code)";
  const job =
    "(SELECT ? collection_subquery_id,? collection_task_id,? organization_id,? workspace_id,? provider_id,? status,? result_json)";
  const scoped = predicate
    .replace("FROM collection_subqueries result_query", `FROM ${query} result_query`)
    .replace("JOIN browser_collection_jobs result_job", `JOIN ${job} result_job`);
  return {
    sql: `SELECT (${scoped}) preference FROM (SELECT ? id,? organization_id,? workspace_id,? status) collection_tasks`,
    parameters: [
      "query",
      "task",
      "org",
      "ws",
      "provider",
      value.queryStatus,
      value.error,
      value.jobQuery,
      value.jobTask,
      value.jobOrg,
      value.jobWorkspace,
      value.jobProvider,
      value.jobStatus,
      value.result,
      "task",
      "org",
      "ws",
      value.taskStatus,
    ],
  };
}
