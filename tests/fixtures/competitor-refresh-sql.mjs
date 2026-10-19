import { competitorRefreshNoActiveDetailSql } from "../../apps/worker/dist/competitor-refresh-policy.js";

/** Read-only derived tasks exercise the real scoped duplicate guard without creating jobs. */
export function competitorRefreshGuardCases() {
  const base = {
    task_id: "task",
    organization_id: "org",
    workspace_id: "ws",
    projection_type: "competitor_snapshot",
    competitor_id: "competitor",
    parent_org: "org",
    parent_ws: "ws",
    parent_id: "task",
    status: "running",
  };
  const cases = [
    ...[
      "scheduled",
      "queued",
      "leased",
      "running",
      "parsing",
      "validating",
      "retry_scheduled",
      "rate_limited",
    ].map((status) => ({ name: status, task: { ...base, status }, expected: 0 })),
    ...["succeeded", "succeeded_empty", "failed_terminal", "dead_letter", "cancelled"].map(
      (status) => ({ name: status, task: { ...base, status }, expected: 1 }),
    ),
    ...[
      ["unrelated competitor", { competitor_id: "another" }],
      ["other workspace", { workspace_id: "other", parent_ws: "other" }],
      ["other organization", { organization_id: "other", parent_org: "other" }],
      ["other projection", { projection_type: "sourcing_search" }],
      ["parent organization mismatch", { parent_org: "other" }],
      ["parent workspace mismatch", { parent_ws: "other" }],
      ["unmatched parent", { parent_id: "other" }],
      ["case differs in resource identity", { competitor_id: "COMPETITOR" }],
    ].map(([name, changes]) => ({ name, task: { ...base, ...changes }, expected: 1 })),
  ];
  const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
  return cases.map(({ name, task, expected }) => {
    const child = `(SELECT ${literal(task.task_id)} task_id,${literal(task.organization_id)} organization_id,${literal(task.workspace_id)} workspace_id,CAST(${literal(JSON.stringify({ projection_type: task.projection_type, competitor_id: task.competitor_id }))} AS JSON) target_json) q_refresh`;
    const parent = `(SELECT ${literal(task.parent_id)} id,${literal(task.parent_org)} organization_id,${literal(task.parent_ws)} workspace_id,${literal(task.status)} status) ct_refresh`;
    return {
      name,
      expected,
      sql:
        "SELECT COUNT(*) actual FROM (SELECT 'org' organization_id,'ws' workspace_id,'competitor' id) c WHERE " +
        competitorRefreshNoActiveDetailSql
          .replace("collection_subqueries q_refresh", child)
          .replace("collection_tasks ct_refresh", parent),
    };
  });
}
