import {
  accountCompetitorClassificationScopeProof,
  opportunityEventReadRelation,
  selectionPrimaryAsinSql,
  trendTopicEventReadRelation,
} from "@scoutops/database";

const owned = (table: string, row: string, account: string) =>
  `EXISTS (SELECT 1 FROM account_owned_records proof_owner WHERE proof_owner.source_table='${table}' AND proof_owner.source_id=${row}.id AND proof_owner.account_id=${account})`;

const detailOwners =
  "n_detail.account_id=t_detail.account_id AND " +
  owned("collection_tasks", "t_detail", "n_detail.account_id") +
  " AND " +
  owned("collection_subqueries", "q_detail", "n_detail.account_id") +
  " AND " +
  owned("collection_task_evidence_links", "l_detail", "n_detail.account_id");
const relationOwners =
  "n_relation.account_id=t_relation.account_id AND " +
  owned("collection_tasks", "t_relation", "n_relation.account_id") +
  " AND " +
  owned("collection_subqueries", "q_relation", "n_relation.account_id") +
  " AND " +
  owned("collection_task_evidence_links", "l_relation", "n_relation.account_id");

/** Translate fixed, shared evidence predicates only. No user SQL or historical coordinate fallback. */
export function nativeCompletionTaskProof(sql: string, account: string, nativeCompetitor = false) {
  return sql
    .replaceAll(
      "n_primary_current.organization_id=n_primary.organization_id AND n_primary_current.workspace_id=n_primary.workspace_id",
      "n_primary_current.account_id=n_primary.account_id",
    )
    .replaceAll(
      "n_primary.organization_id=o.organization_id AND n_primary.workspace_id=o.workspace_id",
      `n_primary.account_id=${account} AND ${owned("opportunity_evidence_links", "l_primary", "n_primary.account_id")}`,
    )
    .replaceAll(
      "n_detail.organization_id=t_detail.organization_id AND n_detail.workspace_id=t_detail.workspace_id",
      detailOwners,
    )
    .replaceAll(
      "c_detail.organization_id=t_detail.organization_id AND c_detail.workspace_id=t_detail.workspace_id",
      (nativeCompetitor ? "c_detail.account_id=t_detail.account_id AND " : "") +
        owned("competitors", "c_detail", "t_detail.account_id"),
    )
    .replaceAll(
      "n_relation.organization_id=t_relation.organization_id AND n_relation.workspace_id=t_relation.workspace_id",
      relationOwners,
    )
    .replaceAll(
      "e_relation.organization_id=t_relation.organization_id AND e_relation.workspace_id=t_relation.workspace_id AND ",
      "",
    )
    .replaceAll(
      "t_relation.organization_id=o.organization_id AND t_relation.workspace_id=o.workspace_id",
      `t_relation.account_id=${account} AND e_relation.organization_id=o.organization_id AND e_relation.workspace_id=o.workspace_id`,
    )
    .replaceAll(
      "WHERE c_sample.opportunity_id=o.id AND ",
      `WHERE c_sample.opportunity_id=o.id AND ${owned("competitors", "c_sample", account)} AND `,
    )
    .replaceAll(
      "WHERE c.opportunity_id=o.id AND ",
      `WHERE c.opportunity_id=o.id AND ${owned("competitors", "c", account)} AND `,
    );
}

export const nativeCompletionPrimaryAsin = (account: string) =>
  nativeCompletionTaskProof(selectionPrimaryAsinSql, account);

/** 0194 and 0195 are distinct physical layouts. Rank the same candidates on
 * both, using sealed ownership in place of columns that no longer exist. */
export function accountCompletionRankProof(
  sql: string,
  nativeCompetitor: boolean,
  nativeParent: boolean,
) {
  const trendRank = sql
    .replaceAll(trendTopicEventReadRelation, "trend_events")
    // MySQL 5.7 cannot resolve the enclosing account inside a subquery in JOIN ON.
    .replaceAll(
      "AND source_origin.organization_id=source_approval.organization_id AND source_origin.workspace_id=source_approval.workspace_id",
      "",
    )
    .replaceAll(
      /newer_origin\.organization_id=source_origin\.organization_id\s+AND newer_origin\.workspace_id=source_origin\.workspace_id/g,
      owned("trend_events", "newer_origin", "o.account_id"),
    )
    .replaceAll(
      "source_origin.resource_id=o.source_ref_id",
      "source_origin.resource_id=o.source_ref_id AND " +
        owned("trend_events", "source_origin", "o.account_id") +
        " AND " +
        owned("trend_topics", "source_origin", "o.account_id").replace(
          "source_id=source_origin.id",
          "source_id=source_origin.resource_id",
        ),
    );
  if (!nativeCompetitor) return trendRank;
  const competitorRank = trendRank
    .replaceAll(/,c\.organization_id,c\.workspace_id/g, "")
    .replaceAll(",pending.organization_id,pending.workspace_id", "")
    .replaceAll(
      / AND o\.organization_id=scopes\.organization_id AND o\.workspace_id=scopes\.workspace_id/g,
      "",
    )
    .replaceAll(
      / AND pending\.organization_id=o\.organization_id AND pending\.workspace_id=o\.workspace_id/g,
      "",
    )
    .replaceAll(
      /(c_sample|c)\.organization_id=o\.organization_id\s+AND \1\.workspace_id=o\.workspace_id/g,
      "$1.account_id=o.account_id",
    )
    .replaceAll(
      "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.competitor_id'))=BINARY c.id",
      "AND c.account_id=t.account_id AND BINARY JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.competitor_id'))=BINARY c.id",
    )
    .replaceAll(
      "WHERE LEFT(s.",
      "WHERE " + owned("competitor_snapshots", "s", "t_detail.account_id") + " AND LEFT(s.",
    )
    .replaceAll(
      "WHERE LEFT(s_sample.",
      "WHERE " +
        owned("competitor_snapshots", "s_sample", "t_detail.account_id") +
        " AND LEFT(s_sample.",
    );
  if (!nativeParent) return competitorRank;
  const archivedColumns =
    "sealed.legacy_org_id,sealed.legacy_workspace_id,sealed.source_id sealed_source_id,proof_cut.created_at cut_created_at";
  const archivedProof =
    "JOIN account_ownership_cutover proof_cut ON proof_cut.slot='current' AND proof_cut.contract_version=25\n" +
    "LEFT JOIN account_retirement_records sealed ON sealed.run_id=proof_cut.source_run_id AND sealed.source_table='opportunities' AND sealed.source_id=o.id";
  const result = competitorRank
    .replaceAll(",o.organization_id,o.workspace_id", "")
    .replaceAll(
      /\s+JOIN organizations org ON org\.id=o\.organization_id AND org\.status='active'\s+JOIN workspaces ws ON ws\.id=o\.workspace_id AND ws\.organization_id=o\.organization_id AND ws\.status='active'/g,
      "",
    )
    .replaceAll(
      "o.id=scopes.opportunity_id",
      "o.id=scopes.opportunity_id AND o.account_id=scopes.account_id",
    )
    .replaceAll(
      "o.id=candidate.opportunity_id",
      "o.id=candidate.opportunity_id AND o.account_id=candidate.account_id",
    )
    .replace(
      "o.id,o.market,o.source_ref_id,",
      `o.id,o.market,o.source_ref_id,o.created_at,${archivedColumns},`,
    )
    .replace(
      "candidate.search_id,o.id,o.market,",
      `candidate.search_id,o.id,o.market,o.created_at,${archivedColumns},`,
    )
    .replace(
      /(JOIN opportunities o ON o\.id=(?:scopes|candidate)\.opportunity_id[\s\S]*?)(\r?\n\s+WHERE o\.source_type)/,
      (_match, join, where) => `${join}\n${archivedProof}${where}`,
    )
    .replaceAll(opportunityEventReadRelation, "opportunity_events")
    .replaceAll(
      "AND e_relation.organization_id=o.organization_id AND e_relation.workspace_id=o.workspace_id",
      "AND " + owned("opportunity_events", "e_relation", "o.account_id"),
    )
    .replaceAll(
      /latest_relation\.organization_id=e_relation\.organization_id AND latest_relation\.workspace_id=e_relation\.workspace_id/g,
      owned("opportunity_events", "latest_relation", "o.account_id"),
    )
    .replaceAll(
      /newer_relation\.organization_id=e_relation\.organization_id AND newer_relation\.workspace_id=e_relation\.workspace_id/g,
      owned("opportunity_events", "newer_relation", "o.account_id"),
    )
    .replaceAll(
      "source_approval.organization_id=o.organization_id AND source_approval.workspace_id=o.workspace_id",
      owned("opportunity_events", "source_approval", "o.account_id"),
    )
    .replaceAll(
      "source_news.account_id=o.account_id",
      "source_news.account_id=o.account_id AND " +
        owned("normalized_records", "source_news", "o.account_id"),
    )
    .replaceAll(
      /newer_source\.organization_id=source_approval\.organization_id\s+AND newer_source\.workspace_id=source_approval\.workspace_id/g,
      owned("opportunity_events", "newer_source", "o.account_id"),
    )
    .replaceAll(
      "ci.opportunity_id=o.id\n        AND ci.platform",
      "ci.opportunity_id=o.id AND " +
        owned("opportunity_cost_inputs", "ci", "candidate.account_id") +
        "\n        AND ci.platform",
    );
  return accountCompetitorClassificationScopeProof(result, {
    account: "o.account_id",
    legacyOrg: "o.legacy_org_id",
    legacyWorkspace: "o.legacy_workspace_id",
    fresh: "o.sealed_source_id IS NULL AND o.created_at>o.cut_created_at",
  });
}
