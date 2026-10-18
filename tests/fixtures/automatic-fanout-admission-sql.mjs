import { automaticCollectionBacklogCountSql } from "../../apps/worker/dist/collection-source-scheduling-policy.js";

// SELECT-only MySQL 5.7 cases using the production count expression over synthetic derived tables.
export function automaticFanoutAdmissionCases() {
  const unfinished = [
    "scheduled",
    "queued",
    "leased",
    "running",
    "parsing",
    "validating",
    "retry_scheduled",
    "rate_limited",
  ];
  const scenarios = [
    ...unfinished.map((status) => ({ name: status, status, count: 1 })),
    ...[
      "succeeded",
      "succeeded_empty",
      "completed_with_warnings",
      "failed_terminal",
      "dead_letter",
      "cancelled",
    ].map((status) => ({ name: status, status, count: 0 })),
    { name: "inactive-org", status: "queued", orgStatus: "disabled", count: 0 },
    { name: "inactive-workspace", status: "queued", workspaceStatus: "archived", count: 0 },
    { name: "mismatched-workspace-org", status: "queued", workspaceOrg: "foreign", count: 0 },
  ];
  return scenarios.flatMap((scenario) => {
    const countSql = automaticCollectionBacklogCountSql
      .replace(
        "collection_tasks backlog",
        `(SELECT 'o' organization_id,'w' workspace_id,'${scenario.status}' status) backlog`,
      )
      .replace(
        "organizations collection_scope_org",
        `(SELECT 'o' id,'${scenario.orgStatus ?? "active"}' status) collection_scope_org`,
      )
      .replace(
        "workspaces collection_scope_workspace",
        `(SELECT 'w' id,'${scenario.workspaceOrg ?? "o"}' organization_id,'${scenario.workspaceStatus ?? "active"}' status) collection_scope_workspace`,
      );
    return [1, 2].map((limit) => ({
      name: `${scenario.name}-limit-${limit}`,
      sql: `SELECT ${countSql} backlog,(${countSql}<?) trend_allowed,('opportunity_competitors'<>'opportunity_competitors' OR ${countSql}<?) discovery_allowed,('competitor_snapshot'<>'opportunity_competitors' OR ${countSql}<?) detail_allowed,('sourcing_search'<>'opportunity_competitors' OR ${countSql}<?) sourcing_allowed`,
      params: [limit, limit, limit, limit],
      expected: {
        backlog: scenario.count,
        trend_allowed: Number(scenario.count < limit),
        discovery_allowed: Number(scenario.count < limit),
        detail_allowed: 1,
        sourcing_allowed: 1,
      },
    }));
  });
}
