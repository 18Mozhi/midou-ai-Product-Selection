import { notificationScopeRelation } from "@scoutops/database";
import { accountCompetitorClassificationScopeProof } from "@scoutops/database";
import { appendAccountOpportunityEvent } from "@scoutops/database";
import { nativeBusinessTaskScope } from "./business-task-storage.js";
import { opportunityEventReadRelation } from "@scoutops/database";
import { appendOpportunityEvent } from "@scoutops/database";
import { appendOpportunityOutbox } from "@scoutops/database";
import {
  homeCandidateSql,
  homeCompetitorUpperBoundSql,
  homeQualityGateSql,
} from "./home-selection-sql.js";
import { MINIMUM_SELECTION_COMPETITORS } from "@scoutops/contracts";
import { optimizeSelectionReadSql } from "./selection-read-query-plan.js";
import {
  opportunityRecommendedListSourceSql,
  reuseRecommendedFilterIdentitySql,
} from "./opportunity-recommended-list-scope.js";
import {
  opportunityAnalysisCompletedAtSql,
  opportunityCompletedFilterSql,
  accountOpportunityAnalysisCompletedAtSql,
  accountOpportunityCompletedFilterSql,
} from "./opportunity-completed-filter.js";
import {
  opportunityListPrimaryAsinSql,
  opportunityListPrimaryRecordsSql,
  opportunityListSelectionProjectionSql,
  reuseListPrimaryIdentitySql,
} from "./opportunity-list-projection.js";
import {
  opportunityPrimaryRecordsSql,
  readOpportunityPrimaryProduct,
} from "./opportunity-primary-product.js";
import { readOpportunityPurchasePrices } from "./opportunity-purchase-price.js";
import {
  opportunitySourceTopicFilterSql,
  accountOpportunitySourceTopicFilterSql,
} from "./opportunity-source-topic-filter.js";
import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { rehearsalOwns, requireAccountReadRehearsal } from "./account-read-rehearsal.js";
import {
  OpportunityServiceError,
  type OpportunityCreateInput,
  type OpportunityDecision,
  type OpportunityDetail,
  type OpportunityOperatingFact,
  type OpportunityOperatingFeedback,
  type OpportunityRepository,
  type OpportunitySummary,
  type OpportunityWriteContext,
} from "./opportunity-service.js";
import { recommendationGuidance } from "./opportunity-recommendation-guidance.js";
import {
  evaluateOpportunitySelection,
  opportunityQualityGateSql,
  opportunityRecommendedSql,
  opportunityRecommendationFactsSql,
  opportunitySelectionProjectionSql,
  opportunityCandidateSql,
  opportunityPrimaryAsinSql,
} from "./opportunity-selection-policy.js";

const iso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
export const mysqlDateOnly = (value: unknown) => {
  if (!(value instanceof Date)) return String(value).slice(0, 10);
  const year = value.getFullYear(),
    month = String(value.getMonth() + 1).padStart(2, "0"),
    day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const numberOrNull = (value: unknown) => (value == null ? null : Number(value));
const parse = <T>(value: unknown): T =>
  typeof value === "string" ? (JSON.parse(value) as T) : (value as T);
const sqlText = (...parts: string[]) => parts.join(" ");
const opportunityCountsSql = sqlText(
  "(SELECT COUNT(DISTINCT UPPER(c.external_id)) FROM competitors c",
  `WHERE c.opportunity_id=o.id AND c.organization_id=o.organization_id AND c.workspace_id=o.workspace_id AND c.deleted_at IS NULL AND c.source_site='Amazon' AND c.external_id REGEXP '^[A-Za-z0-9]{10}$' AND BINARY UPPER(c.external_id)<>BINARY COALESCE(${opportunityPrimaryAsinSql},'')) competitor_count,`,
  "(SELECT COUNT(*) FROM sourcing_candidates sc",
  "JOIN sourcing_searches ss ON ss.id=sc.search_id",
  "WHERE ss.input_type='opportunity' AND ss.input_ref=o.id AND ss.deleted_at IS NULL)",
  "supplier_candidate_count,",
  "(SELECT COUNT(*) FROM opportunity_rule_matches orm",
  "WHERE orm.opportunity_id=o.id) matched_rule_count",
);
const opportunityLifecycleSql =
  "GREATEST(0,TIMESTAMPDIFF(SECOND,o.lifecycle_entered_at,UTC_TIMESTAMP(3))) lifecycle_dwell_seconds";
const ownOpportunityChild = (table: string, id: string) =>
  rehearsalOwns(table, id, "o.account_owner");
const nativeOwnerParameter = "/* native evidence owner */?";
type ReadParameter = string | number | null | undefined;
const bindNativeOwner = (
  sql: string,
  values: Array<ReadParameter | Date>,
  account: string | null | undefined,
) => {
  let index = 0;
  const bound: Array<string | number | null | Date> = [];
  const query = sql.replace(/'(?:''|[^'])*'|\/\* native evidence owner \*\/\?|\?/g, (token) => {
    if (token === nativeOwnerParameter) {
      if (!account) throw new Error("native_evidence_owner_missing");
      bound.push(account);
      return "?";
    }
    if (token === "?") {
      const value = values[index++];
      if (value === undefined) throw new Error("opportunity_read_parameter_missing");
      bound.push(value);
    }
    return token;
  });
  if (index !== values.length) throw new Error("opportunity_read_bind_count_invalid");
  return [query, bound] as const;
};
const primaryVersionOriginJoins = (seed: string, active: string) =>
  `STRAIGHT_JOIN raw_evidence seed_e ON seed_e.id=${seed}.raw_evidence_id AND seed_e.provider_id=${seed}.provider_id
    STRAIGHT_JOIN collection_tasks seed_t ON seed_t.id=seed_e.collection_task_id
    STRAIGHT_JOIN raw_evidence active_e ON active_e.id=${active}.raw_evidence_id AND active_e.provider_id=${active}.provider_id
    STRAIGHT_JOIN collection_tasks active_t ON active_t.id=active_e.collection_task_id
      AND active_t.organization_id=seed_t.organization_id AND active_t.workspace_id=seed_t.workspace_id `;
const primaryVersionOriginOwner = (account: string) =>
  `seed_e.account_id=${account} AND active_e.account_id=${account}
      AND ${rehearsalOwns("collection_tasks", "seed_t.id", account)}
      AND ${rehearsalOwns("collection_tasks", "active_t.id", account)}`;
// The ledger is unique on (source_table, source_id); these point lookups cannot
// multiply matches. Avoid independent semi-join materialization of the ledger.
const primaryIdentityLedgerJoins = (account: string) =>
  (
    [
      ["opportunity_evidence_links", "l_primary.id"],
      ["raw_evidence", "l_primary.raw_evidence_id"],
      ["raw_evidence", "n_primary_current.raw_evidence_id"],
      ["normalized_records", "n_primary.id"],
      ["normalized_records", "n_primary_current.id"],
      ["collection_tasks", "seed_t.id"],
      ["collection_tasks", "active_t.id"],
    ] as const
  )
    .map(
      ([table, id], index) =>
        `STRAIGHT_JOIN account_owned_records lp_owner_${index} FORCE INDEX (PRIMARY) ON lp_owner_${index}.source_table='${table}' AND lp_owner_${index}.source_id=${id} AND lp_owner_${index}.account_id=${account} `,
    )
    .join("");
// These exact shared proofs also appear inside the list's recommendation gates.
// Keep their task/range and payload requirements; obtain evidence provenance from its parent.
const nativeCompetitorEvidence = (sql: string, account: string) => {
  for (const [suffix, provider, predicate] of [
    [
      "detail",
      "n_detail.provider_id",
      /WHERE LEFT\(s(?:_sample)?\.source_ref_id,11\)='collection:'/g,
    ],
    [
      "relation",
      "q_relation.provider_id",
      "WHERE e_relation.organization_id=t_relation.organization_id",
    ],
  ] as const) {
    const n = `n_${suffix}`,
      t = `t_${suffix}`,
      l = `l_${suffix}`;
    sql = sql
      .replaceAll(
        `AND ${n}.organization_id=${t}.organization_id AND ${n}.workspace_id=${t}.workspace_id `,
        "",
      )
      .replaceAll(
        predicate,
        (
          match,
        ) => `WHERE ${n}.account_id=${account} AND ${rehearsalOwns("normalized_records", `${n}.id`, account)}
      AND ${rehearsalOwns("collection_tasks", `${t}.id`, account)}
      AND ${rehearsalOwns("collection_subqueries", `q_${suffix}.id`, account)}
      AND ${rehearsalOwns("collection_task_evidence_links", `${l}.id`, account)}
      AND ${rehearsalOwns("raw_evidence", `${l}.raw_evidence_id`, account)}
      AND EXISTS (SELECT 1 FROM raw_evidence proof_e STRAIGHT_JOIN collection_tasks proof_t ON proof_t.id=proof_e.collection_task_id
        WHERE proof_e.id=${l}.raw_evidence_id AND proof_e.account_id=${account} AND proof_e.provider_id=${provider}
          AND proof_t.organization_id=${t}.organization_id AND proof_t.workspace_id=${t}.workspace_id
          AND ${rehearsalOwns("collection_tasks", "proof_t.id", account)}) AND ${match.slice(6)}`,
      );
  }
  return sql
    .replaceAll(
      "FROM collection_subqueries q_detail JOIN collection_task_evidence_links l_detail",
      "FROM collection_subqueries q_detail STRAIGHT_JOIN collection_task_evidence_links l_detail",
    )
    .replaceAll("JOIN collection_tasks t_detail ON", "STRAIGHT_JOIN collection_tasks t_detail ON")
    .replaceAll(
      "JOIN normalized_records n_detail ON",
      "STRAIGHT_JOIN normalized_records n_detail ON",
    )
    .replaceAll("JOIN competitors c_detail ON", "STRAIGHT_JOIN competitors c_detail ON");
};
const ownedPrimaryIdentity = (
  sql: string,
  legacyAccount: "oo.account_id" | "o.account_owner",
  native: boolean,
) => {
  const account = native ? nativeOwnerParameter : legacyAccount;
  const scoped = sql
    .replaceAll(
      "l_primary.opportunity_id=o.id AND n_primary.organization_id=o.organization_id AND n_primary.workspace_id=o.workspace_id",
      "l_primary.opportunity_id=o.id",
    )
    .replaceAll(
      "WHERE l_primary.opportunity_id=o.id",
      native
        ? `${primaryVersionOriginJoins("n_primary", "n_primary_current")}${primaryIdentityLedgerJoins(account)}WHERE n_primary.account_id=${account} AND seed_e.account_id=${account} AND active_e.account_id=${account} AND l_primary.opportunity_id=o.id`
        : `WHERE ${rehearsalOwns("opportunity_evidence_links", "l_primary.id", account)} AND ${rehearsalOwns("raw_evidence", "l_primary.raw_evidence_id", account)} AND ${rehearsalOwns("normalized_records", "n_primary.id", account)} AND ${rehearsalOwns("normalized_records", "n_primary_current.id", account)} AND l_primary.opportunity_id=o.id`,
    )
    .replaceAll(
      "n_primary_current.organization_id=n_primary.organization_id AND n_primary_current.workspace_id=n_primary.workspace_id",
      native
        ? "n_primary_current.account_id=n_primary.account_id"
        : "n_primary_current.organization_id=n_primary.organization_id AND n_primary_current.workspace_id=n_primary.workspace_id",
    );
  return native
    ? scoped
        .replaceAll(
          "FROM opportunity_evidence_links l_primary JOIN normalized_records n_primary ON",
          "FROM opportunity_evidence_links l_primary FORCE INDEX (uq_opportunity_evidence) STRAIGHT_JOIN normalized_records n_primary FORCE INDEX (idx_normalized_evidence) ON",
        )
        .replaceAll(
          "JOIN normalized_records n_primary_current ON",
          "STRAIGHT_JOIN normalized_records n_primary_current FORCE INDEX (uq_normalized_account_record_version) ON",
        )
        .replaceAll("JOIN providers p_primary ON", "STRAIGHT_JOIN providers p_primary ON")
    : scoped;
};
const accountPrimaryRecordsSql = opportunityPrimaryRecordsSql
  .replace(
    "WHERE l.opportunity_id=o.id AND n_seed.organization_id=o.organization_id AND n_seed.workspace_id=o.workspace_id",
    `WHERE ${ownOpportunityChild("opportunity_evidence_links", "l.id")} AND ${ownOpportunityChild("normalized_records", "n_seed.id")} AND ${ownOpportunityChild("normalized_records", "n.id")} AND ${ownOpportunityChild("raw_evidence", "l.raw_evidence_id")} AND ${ownOpportunityChild("raw_evidence", "n.raw_evidence_id")} AND l.opportunity_id=o.id`,
  )
  .replace(
    "WHERE c.opportunity_id=o.id",
    `WHERE ${ownOpportunityChild("competitors", "c.id")} AND ${ownOpportunityChild("competitor_snapshots", "s.id")} AND ${ownOpportunityChild("normalized_records", "n.id")} AND ${ownOpportunityChild("raw_evidence", "s.evidence_id")} AND c.opportunity_id=o.id`,
  );
const nativeAccountPrimaryRecordsSql = accountPrimaryRecordsSql
  .replace(
    "FORCE INDEX (uq_normalized_scope_record_version) ON n.organization_id=n_seed.organization_id AND n.workspace_id=n_seed.workspace_id",
    "FORCE INDEX (uq_normalized_account_record_version) ON n.account_id=n_seed.account_id",
  )
  .replace("AND n.organization_id=c.organization_id AND n.workspace_id=c.workspace_id ", "")
  .replace(
    "AND c.opportunity_id=o.id",
    `AND n.account_id=${nativeOwnerParameter} AND c.opportunity_id=o.id`,
  )
  .replace(
    "JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' WHERE",
    `STRAIGHT_JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' ${primaryVersionOriginJoins("n_seed", "n")}WHERE`,
  )
  .replace(
    "AND l.opportunity_id=o.id",
    `AND n_seed.account_id=${nativeOwnerParameter} AND ${primaryVersionOriginOwner(nativeOwnerParameter)} AND l.opportunity_id=o.id`,
  );
const accountPrimaryProjection = (native: boolean, sql: string) =>
  native ? nativeCompetitorEvidence(optimizeSelectionReadSql(sql), nativeOwnerParameter) : sql;
const accountCountsSql = opportunityCountsSql
  .replace(
    "WHERE c.opportunity_id=o.id",
    `WHERE ${ownOpportunityChild("competitors", "c.id")} AND c.opportunity_id=o.id`,
  )
  .replace(
    "WHERE ss.input_type='opportunity'",
    `WHERE ${ownOpportunityChild("sourcing_searches", "ss.id")} AND ${ownOpportunityChild("sourcing_candidates", "sc.id")}
      AND ${ownOpportunityChild("collection_tasks", "ss.collection_task_id")} AND ${ownOpportunityChild("raw_evidence", "sc.raw_evidence_id")}
      AND ss.input_type='opportunity'`,
  )
  .replace(
    "WHERE orm.opportunity_id=o.id",
    `WHERE ${ownOpportunityChild("opportunity_rule_matches", "orm.id")} AND orm.opportunity_id=o.id`,
  );
// The currently rehearsed ownership batch assigns one account per historical scope. Keep the
// sealed scope as provenance for legacy quality proofs; never use a session's old workspace.
const accountOpportunitySource = `opportunities o JOIN account_owned_records oo
  ON oo.source_table='opportunities' AND oo.source_id=o.id
  JOIN account_ownership_cutover receipt ON receipt.slot='current' AND receipt.contract_version=25
    AND (oo.reason='exclusive_owner' OR
         (oo.reason IN ('shared','unassigned') AND oo.account_id=receipt.primary_account_id))`;
// The old coordinates are retained only inside the immutable classification
// fingerprint. Read them from the exact sealed original, not a session scope.
export function bindNativeOpportunityCandidate(
  sql: string,
  preceding: Array<string | Date>,
  account: string,
) {
  const candidate = nativeOpportunityProof(opportunityCandidateSql, "oo.account_id");
  if (/\b\w+\.(organization_id|workspace_id)\b/.test(candidate))
    throw new Error("native_opportunity_candidate_projection_invalid");
  return bindNativeOwner(sql + candidate, preceding, account);
}

function nativeOpportunityProof(sql: string, ownerAlias: "oo.account_id" | "o.account_owner") {
  // MySQL 5.7 cannot resolve the outer account alias in nested JOIN ... ON.
  // The root is already fenced to this request account; bind the same ID in proofs.
  const account = nativeOwnerParameter;
  const rawProof = (kind: "detail" | "relation") =>
    `EXISTS (SELECT 1 FROM raw_evidence decision_raw JOIN collection_tasks decision_origin ON decision_origin.id=decision_raw.collection_task_id
      WHERE decision_raw.id=l_${kind}.raw_evidence_id AND decision_raw.provider_id=n_${kind}.provider_id
      AND decision_raw.account_id=${account} AND decision_origin.account_id=${account}
      AND ${rehearsalOwns("raw_evidence", "decision_raw.id", account)}
      AND ${rehearsalOwns("collection_tasks", "decision_origin.id", account)})`;
  const sourceRun = ownerAlias === "oo.account_id" ? "receipt.source_run_id" : "o.sealed_run_id";
  const sealedRecord = `scope_record.run_id=${sourceRun} AND scope_record.source_table='opportunities' AND scope_record.source_id=o.id`;
  const coordinate = (field: "org" | "workspace") =>
    `(SELECT scope_record.legacy_${field}_id FROM account_retirement_records scope_record WHERE ${sealedRecord})`;
  return accountCompetitorClassificationScopeProof(ownedPrimaryIdentity(sql, ownerAlias, true), {
    account,
    legacyOrg: coordinate("org"),
    legacyWorkspace: coordinate("workspace"),
    fresh: `EXISTS (SELECT 1 FROM account_ownership_cutover scope_cut WHERE scope_cut.slot='current'
      AND scope_cut.contract_version=25 AND scope_cut.source_run_id=${sourceRun} AND o.created_at>scope_cut.created_at)
      AND NOT EXISTS (SELECT 1 FROM account_retirement_records scope_record WHERE ${sealedRecord})`,
  })
    .replaceAll(opportunityEventReadRelation, "opportunity_events")
    .replaceAll(
      "active_t.organization_id=seed_t.organization_id AND active_t.workspace_id=seed_t.workspace_id",
      `active_t.account_id=${account} AND seed_t.account_id=${account}`,
    )
    .replaceAll(
      "n_detail.organization_id=t_detail.organization_id AND n_detail.workspace_id=t_detail.workspace_id",
      `n_detail.account_id=${account} AND t_detail.account_id=${account} AND ${rehearsalOwns("normalized_records", "n_detail.id", account)} AND ${rawProof("detail")} AND ${rehearsalOwns("collection_tasks", "t_detail.id", account)} AND ${rehearsalOwns("collection_subqueries", "q_detail.id", account)} AND ${rehearsalOwns("collection_task_evidence_links", "l_detail.id", account)}`,
    )
    .replaceAll(
      "c_detail.organization_id=t_detail.organization_id AND c_detail.workspace_id=t_detail.workspace_id",
      `c_detail.account_id=${account} AND ${rehearsalOwns("competitors", "c_detail.id", account)}`,
    )
    .replaceAll(
      "n_relation.organization_id=t_relation.organization_id AND n_relation.workspace_id=t_relation.workspace_id",
      `n_relation.account_id=${account} AND ${rehearsalOwns("normalized_records", "n_relation.id", account)} AND ${rawProof("relation")} AND ${rehearsalOwns("collection_subqueries", "q_relation.id", account)} AND ${rehearsalOwns("collection_task_evidence_links", "l_relation.id", account)}`,
    )
    .replaceAll(
      "e_relation.organization_id=t_relation.organization_id AND e_relation.workspace_id=t_relation.workspace_id",
      rehearsalOwns("opportunity_events", "e_relation.id", account),
    )
    .replaceAll(
      "t_relation.organization_id=o.organization_id AND t_relation.workspace_id=o.workspace_id",
      `t_relation.account_id=${account} AND ${rehearsalOwns("collection_tasks", "t_relation.id", account)}`,
    )
    .replaceAll(
      "latest_relation.organization_id=e_relation.organization_id AND latest_relation.workspace_id=e_relation.workspace_id",
      rehearsalOwns("opportunity_events", "latest_relation.id", account),
    )
    .replaceAll(
      "newer_relation.organization_id=e_relation.organization_id AND newer_relation.workspace_id=e_relation.workspace_id",
      rehearsalOwns("opportunity_events", "newer_relation.id", account),
    )
    .replaceAll(
      "c_sample.organization_id=o.organization_id AND c_sample.workspace_id=o.workspace_id",
      `c_sample.account_id=${account} AND ${rehearsalOwns("competitors", "c_sample.id", account)} AND ${rehearsalOwns("competitor_snapshots", "s_sample.id", account)}`,
    )
    .replaceAll(
      "c_bound.organization_id=o.organization_id AND c_bound.workspace_id=o.workspace_id",
      `c_bound.account_id=${account} AND ${rehearsalOwns("competitors", "c_bound.id", account)} AND ${rehearsalOwns("competitor_snapshots", "s_bound.id", account)}`,
    )
    .replaceAll(
      "c.organization_id=o.organization_id AND c.workspace_id=o.workspace_id",
      `c.account_id=${account}`,
    )
    .replaceAll("'organizationId',o.organization_id", `'organizationId',${coordinate("org")}`)
    .replaceAll("'workspaceId',o.workspace_id", `'workspaceId',${coordinate("workspace")}`)
    .replaceAll(
      "AND sc_gate.dimension_code='risk'",
      `AND ${rehearsalOwns("opportunity_score_runs", "sr_gate.id", account)} AND ${rehearsalOwns("opportunity_score_components", "sc_gate.id", account)} AND sc_gate.dimension_code='risk'`,
    );
}
// The full recommendation gate still runs on each candidate. Materialize its cheap
// prerequisites first and resolve the costly identity once in MySQL 5.7.
const nativeRecommendedSource = sqlText(
  `(SELECT o.*,${ownedPrimaryIdentity(opportunityPrimaryAsinSql, "o.account_owner", true)} filter_primary_asin FROM`,
  `(SELECT o.*,oo.account_id account_owner FROM ${accountOpportunitySource}`,
  `WHERE oo.account_id=${nativeOwnerParameter} AND o.decision_status='pending' AND ${opportunityRecommendationFactsSql}`,
  `AND ${homeCompetitorUpperBoundSql}>=${MINIMUM_SELECTION_COMPETITORS}`,
  "LIMIT 18446744073709551615) o LIMIT 18446744073709551615) o",
);
const nativeRecommendedSelectionProjection =
  "1 candidate_ready,1 risk_gate_passed,1 competition_gate_passed,o.primary_fact_asin main_asin";
function detailOwnership(accountId?: string) {
  return (entries: Array<[source: string, idSql: string]>) => ({
    sql:
      accountId === undefined
        ? ""
        : entries.map(([source, id]) => ` AND ${rehearsalOwns(source, id, "?")}`).join(""),
    values: accountId === undefined ? [] : entries.map(() => accountId),
  });
}
const summary = (row: RowDataPacket): OpportunitySummary => {
  const primary = readOpportunityPrimaryProduct(
    row.primary_linked_record,
    row.primary_detail_record,
  );
  return {
    id: String(row.id),
    name: String(row.name),
    image_url: primary.imageUrl,
    primary_product: primary.facts,
    main_asin: row.main_asin ? String(row.main_asin) : null,
    market: String(row.market),
    category: row.category == null ? null : String(row.category),
    source_type: row.source_type,
    source_ref_id: row.source_ref_id == null ? null : String(row.source_ref_id),
    owner_id: row.owner_id == null ? null : String(row.owner_id),
    lifecycle_status: String(row.lifecycle_status),
    lifecycle_entered_at: iso(row.lifecycle_entered_at ?? row.updated_at),
    lifecycle_dwell_seconds: Number(row.lifecycle_dwell_seconds ?? 0),
    recommendation_status: row.recommendation_status,
    overall_score: numberOrNull(row.overall_score),
    trend_score: numberOrNull(row.trend_score),
    competition_score: numberOrNull(row.competition_score),
    profit_status: row.profit_status,
    risk_level: row.risk_level,
    confidence: { status: row.confidence_status, score: numberOrNull(row.confidence_score) },
    evidence_count: Number(row.evidence_count),
    source_count: Number(row.source_count),
    competitor_count: Number(row.competitor_count ?? 0),
    supplier_candidate_count: Number(row.supplier_candidate_count ?? 0),
    matched_rule_count: Number(row.matched_rule_count ?? 0),
    ...evaluateOpportunitySelection(row),
    coverage_status: row.coverage_status,
    blocking_reasons: [
      ...(Number(row.evidence_count) === 0 || row.coverage_status === "insufficient"
        ? ["evidence_insufficient" as const]
        : []),
      ...(!evaluateOpportunitySelection(row).quality_gates.all_passed
        ? ["recommendation_insufficient" as const]
        : []),
    ],
    decision_status: row.decision_status,
    version: Number(row.version),
    updated_at: iso(row.updated_at),
  };
};

export class MySqlOpportunityRepository implements OpportunityRepository {
  constructor(private readonly pool: Pool) {}
  private async nativeOpportunityScope(db: Pick<PoolConnection, "query">) {
    const [columns] = await db.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM opportunities WHERE Field IN ('account_id','organization_id','workspace_id')",
    );
    const shape = columns
      .map((row) => row.Field)
      .sort()
      .join(",");
    if (shape !== "account_id" && shape !== "organization_id,workspace_id")
      throw new Error("opportunity_scope_schema_invalid");
    return shape === "account_id";
  }
  private async nativeEvidenceScope() {
    const [columns] = await this.pool.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM normalized_records WHERE Field IN ('account_id','organization_id','workspace_id')",
    );
    const shape = columns
      .map((row) => row.Field)
      .sort()
      .join(",");
    if (shape !== "account_id" && shape !== "organization_id,workspace_id")
      throw new Error("normalized_record_scope_schema_invalid");
    return shape === "account_id";
  }
  async list(input: Parameters<OpportunityRepository["list"]>[0]) {
    const legacy = "organizationId" in input ? input : null;
    const accountId = "accountId" in input ? input.accountId : null;
    if (!legacy) await requireAccountReadRehearsal(this.pool);
    const native = !legacy && (await this.nativeEvidenceScope());
    const nativeOpportunity = !legacy && (await this.nativeOpportunityScope(this.pool));
    if (nativeOpportunity && !native)
      throw new Error("native_opportunity_requires_account_evidence");
    const legacyValues = legacy ? [legacy.organizationId, legacy.workspaceId] : [];
    const where = legacy
        ? ["o.organization_id=?", "o.workspace_id=?"]
        : ["oo.account_id=?", ...(nativeOpportunity ? ["o.account_id=oo.account_id"] : [])],
      values: ReadParameter[] = legacy ? [...legacyValues] : [accountId];
    if (input.sourceTopicId) {
      where.push(
        legacy
          ? opportunitySourceTopicFilterSql
          : nativeOpportunity
            ? accountOpportunitySourceTopicFilterSql
                .replace("WHERE tt.id=? ", "WHERE tt.id=? AND tt.account_id=oo.account_id ")
                .replace(
                  "AND r.provider_id=l.provider_id ",
                  "AND r.provider_id=l.provider_id AND r.account_id=oo.account_id ",
                )
            : accountOpportunitySourceTopicFilterSql,
      );
      values.push(input.sourceTopicId);
    }
    if (input.selectionView === "completed") {
      where.push(legacy ? opportunityCompletedFilterSql : accountOpportunityCompletedFilterSql);
    } else if (input.selectionView === "recommended") {
      where.push("o.decision_status='pending'", opportunityRecommendedSql);
    } else if (input.selectionView === "rule_candidates") {
      where.push(
        "o.decision_status='pending'",
        nativeOpportunity ? opportunityCandidateSql : homeCandidateSql,
        `NOT ${homeQualityGateSql}`,
      );
    } else if (input.selectionView === "evidence_pending") {
      where.push(
        "o.decision_status='pending'",
        `NOT ${nativeOpportunity ? opportunityCandidateSql : homeCandidateSql}`,
      );
    } else if (input.selectionView !== "all" && input.scope !== "all")
      where.push(
        sqlText(
          "(o.source_type='manual' OR o.category LIKE 'ERP%'",
          "OR EXISTS (SELECT 1 FROM competitors c0",
          "WHERE c0.opportunity_id=o.id AND c0.deleted_at IS NULL" +
            (legacy
              ? ""
              : ` AND ${nativeOpportunity ? "c0.account_id=oo.account_id" : "c0.organization_id=o.organization_id AND c0.workspace_id=o.workspace_id"} AND ${rehearsalOwns("competitors", "c0.id", "oo.account_id")}`) +
            ")",
          "OR EXISTS (SELECT 1 FROM sourcing_searches ss0",
          "WHERE ss0.input_type='opportunity' AND ss0.input_ref=o.id AND ss0.deleted_at IS NULL" +
            (legacy
              ? ""
              : ` AND ${rehearsalOwns("sourcing_searches", "ss0.id", "oo.account_id")} AND ${rehearsalOwns("collection_tasks", "ss0.collection_task_id", "oo.account_id")}`) +
            "))",
        ),
      );
    if (input.query) {
      where.push("o.name LIKE ?");
      values.push(`%${input.query}%`);
    }
    if (input.market) {
      where.push("o.market=?");
      values.push(input.market);
    }
    if (input.decisionStatus) {
      where.push("o.decision_status=?");
      values.push(input.decisionStatus);
    }
    if (input.coverageStatus) {
      where.push("o.coverage_status=?");
      values.push(input.coverageStatus);
    }
    if (input.blockingReason === "evidence_insufficient")
      where.push("(o.evidence_count=0 OR o.coverage_status='insufficient')");
    if (input.blockingReason === "recommendation_insufficient")
      where.push(`NOT ${opportunityQualityGateSql}`);
    if (input.lifecycleStatus) {
      where.push("o.lifecycle_status=?");
      values.push(input.lifecycleStatus);
    } else if (input.selectionView !== "completed") where.push("o.lifecycle_status<>'archived'");
    if (input.ownerId) {
      where.push("o.owner_id=?");
      values.push(input.ownerId);
    }
    if (nativeOpportunity) {
      const filter = nativeOpportunityProof(where.join(" AND "), "oo.account_id");
      const records = nativeOpportunityProof(
        reuseListPrimaryIdentitySql(nativeAccountPrimaryRecordsSql),
        "o.account_owner",
      );
      const counts = nativeOpportunityProof(
        reuseListPrimaryIdentitySql(accountCountsSql),
        "o.account_owner",
      );
      const projection = nativeOpportunityProof(
        opportunityListSelectionProjectionSql,
        "o.account_owner",
      );
      const primary = nativeOpportunityProof(opportunityPrimaryAsinSql, "o.account_owner");
      const countSql = `SELECT COUNT(*) total FROM ${accountOpportunitySource} WHERE ${filter}`;
      const rowsSql = `SELECT o.*,${records},${counts},${opportunityLifecycleSql},${projection}
        FROM (SELECT o.*,${primary} primary_fact_asin FROM (
          SELECT o.*,oo.account_id account_owner,receipt.source_run_id sealed_run_id FROM ${accountOpportunitySource}
          WHERE ${filter} ORDER BY o.updated_at DESC,o.id DESC LIMIT ? OFFSET ?
        ) o LIMIT 18446744073709551615) o ORDER BY o.updated_at DESC,o.id DESC`;
      if (/\b\w+\.(organization_id|workspace_id)\b/.test(countSql + rowsSql))
        throw new Error("native_opportunity_list_projection_invalid");
      const [[count], [rows]] = await Promise.all([
        this.pool.execute<RowDataPacket[]>(...bindNativeOwner(countSql, values, accountId)),
        this.pool.execute<RowDataPacket[]>(
          ...bindNativeOwner(
            rowsSql,
            [...values, input.pageSize, (input.page - 1) * input.pageSize],
            accountId,
          ),
        ),
      ]);
      const prices = await readOpportunityPurchasePrices(
        this.pool,
        { accountId: accountId! },
        rows.map((row) => String(row.id)),
      );
      return {
        total: Number(count[0]?.total ?? 0),
        items: rows.map((row) => ({
          ...summary(row),
          automatic_purchase_price: prices.get(String(row.id)) ?? null,
        })),
      };
    }
    if (native && input.selectionView === "recommended") {
      const filter = nativeCompetitorEvidence(
        reuseRecommendedFilterIdentitySql(
          optimizeSelectionReadSql(
            where.join(" AND ").replaceAll("oo.account_id", "o.account_owner"),
          ),
        ),
        nativeOwnerParameter,
      );
      const result = await this.readNativeRecommended(
        filter,
        values,
        accountId!,
        input.pageSize,
        (input.page - 1) * input.pageSize,
      );
      const prices = await readOpportunityPurchasePrices(
        this.pool,
        { accountId: accountId! },
        result.rows.map((row) => String(row.id)),
      );
      return {
        total: result.total,
        items: result.rows.map((row) => ({
          ...summary(row),
          automatic_purchase_price: prices.get(String(row.id)) ?? null,
        })),
      };
    }
    const recommended = Boolean(legacy && input.selectionView === "recommended"),
      // Presence filtering needs no sorted scalar identity for every scoped product.
      // Only the recommended view materializes its identity before filtering.
      pendingIdentity = recommended,
      source = legacy
        ? recommended
          ? opportunityRecommendedListSourceSql
          : "opportunities o"
        : accountOpportunitySource,
      sql = pendingIdentity
        ? reuseRecommendedFilterIdentitySql(where.join(" AND "))
        : legacy
          ? where.join(" AND ")
          : ownedPrimaryIdentity(
              optimizeSelectionReadSql(where.join(" AND ")),
              "oo.account_id",
              native,
            ),
      accountFilter = native ? nativeCompetitorEvidence(sql, nativeOwnerParameter) : sql,
      records = legacy
        ? opportunityListPrimaryRecordsSql
        : native
          ? nativeAccountPrimaryRecordsSql
          : accountPrimaryRecordsSql,
      filterValues = recommended ? [...legacyValues, ...legacyValues, ...values] : values,
      countSql = optimizeSelectionReadSql(
        `SELECT COUNT(*) total FROM ${source} WHERE ${accountFilter}`,
      ),
      countRead = native
        ? this.pool.execute<RowDataPacket[]>(...bindNativeOwner(countSql, filterValues, accountId))
        : this.pool.query<RowDataPacket[]>(countSql, filterValues),
      // LIMIT prevents MySQL 5.7 derived merging: resolve identity once per paged row,
      // rather than once per candidate evidence record. The outer sort preserves paging order.
      rowsSql = optimizeSelectionReadSql(
        sqlText(
          `SELECT o.*,${accountPrimaryProjection(native, reuseListPrimaryIdentitySql(records))},${reuseListPrimaryIdentitySql(legacy ? opportunityCountsSql : accountCountsSql)},${opportunityLifecycleSql},${accountPrimaryProjection(native, opportunityListSelectionProjectionSql)}`,
          `FROM (SELECT o.*,${pendingIdentity ? "o.filter_primary_asin" : legacy ? opportunityListPrimaryAsinSql : ownedPrimaryIdentity(opportunityPrimaryAsinSql, "o.account_owner", native)} primary_fact_asin FROM (SELECT o.*${legacy ? "" : ",oo.account_id account_owner"} FROM ${source} WHERE ${accountFilter} ORDER BY o.updated_at DESC,o.id DESC LIMIT ? OFFSET ?) o LIMIT 18446744073709551615) o`,
          "ORDER BY o.updated_at DESC,o.id DESC",
        ),
      ),
      rowsValues = [
        ...legacyValues,
        ...(pendingIdentity ? [] : legacyValues),
        ...filterValues,
        input.pageSize,
        (input.page - 1) * input.pageSize,
      ],
      rowsRead = native
        ? this.pool.execute<RowDataPacket[]>(...bindNativeOwner(rowsSql, rowsValues, accountId))
        : this.pool.query<RowDataPacket[]>(rowsSql, rowsValues);
    const [[count], [rows]] = await Promise.all([countRead, rowsRead]);
    const prices = legacy
      ? await readOpportunityPurchasePrices(
          this.pool,
          legacy,
          rows.map((row) => String(row.id)),
        )
      : await readOpportunityPurchasePrices(
          this.pool,
          { accountId: accountId! },
          rows.map((row) => String(row.id)),
        );
    return {
      items: rows.map((row) => ({
        ...summary(row),
        automatic_purchase_price: prices.get(String(row.id)) ?? null,
      })),
      total: Number(count[0]?.total ?? 0),
    };
  }
  private async readNativeRecommended(
    filter: string,
    values: ReadParameter[],
    account: string,
    size: number,
    offset: number,
  ) {
    const conn = await this.pool.getConnection();
    try {
      // Keep qualification and hydration on the same MVCC snapshot without
      // nesting the expensive filter under display-only correlated subqueries.
      await conn.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await conn.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
      const selection = `FROM ${nativeRecommendedSource} WHERE ${filter}`;
      // MySQL 5.7 can flatten these evidence EXISTS clauses and enumerate a
      // considerably larger join. Keep the already-scoped candidate relation first.
      const [counts] = await conn.execute<RowDataPacket[]>(
        ...bindNativeOwner(`SELECT STRAIGHT_JOIN COUNT(*) total ${selection}`, values, account),
      );
      const total = Number(counts[0]?.total ?? 0);
      if (total <= offset) return { total, rows: [] };
      const [hits] = await conn.execute<RowDataPacket[]>(
        ...bindNativeOwner(
          `SELECT STRAIGHT_JOIN o.id,o.filter_primary_asin ${selection} ORDER BY o.updated_at DESC,o.id DESC LIMIT ? OFFSET ?`,
          [...values, size, offset],
          account,
        ),
      );
      if (!hits.length) return { total, rows: [] };
      const pairs = hits
        .map(
          () =>
            "SELECT CAST(? AS CHAR(36) CHARACTER SET ascii) id,CAST(? AS CHAR(10) CHARACTER SET ascii) primary_fact_asin",
        )
        .join(" UNION ALL ");
      const [rows] = await conn.execute<RowDataPacket[]>(
        ...bindNativeOwner(
          sqlText(
            `SELECT o.*,${accountPrimaryProjection(true, nativeAccountPrimaryRecordsSql)},${reuseListPrimaryIdentitySql(accountCountsSql)},${opportunityLifecycleSql},${nativeRecommendedSelectionProjection}`,
            `FROM (SELECT o.*,oo.account_id account_owner,hit.primary_fact_asin FROM ${accountOpportunitySource} JOIN (${pairs}) hit ON hit.id=o.id WHERE oo.account_id=? LIMIT 18446744073709551615) o`,
            "ORDER BY o.updated_at DESC,o.id DESC",
          ),
          [...hits.flatMap((row) => [String(row.id), String(row.filter_primary_asin)]), account],
          account,
        ),
      );
      return { total, rows };
    } finally {
      try {
        await conn.rollback();
      } catch (error) {
        conn.destroy();
        throw error;
      }
      conn.release();
    }
  }
  async memberOptions(input: { organizationId: string; workspaceId: string }) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT DISTINCT m.user_id id,u.email label FROM memberships m " +
        "JOIN users u ON u.id=m.user_id JOIN membership_data_scopes s ON s.membership_id=m.id " +
        "WHERE m.organization_id=? AND m.status='active' AND u.status='active' " +
        "AND (s.scope_type='organization' OR (s.scope_type='workspace' AND s.workspace_id=?)) " +
        "ORDER BY u.email,m.user_id",
      [input.organizationId, input.workspaceId],
    );
    return rows.map((row) => ({ id: String(row.id), label: String(row.label) }));
  }
  private async lineage(input: {
    organizationId: string;
    workspaceId: string;
    opportunityId: string;
    accountId?: string;
    nativeOpportunity?: boolean;
  }): Promise<OpportunityDetail["lineage"]> {
    const own = detailOwnership(input.accountId);
    const account = input.accountId !== undefined;
    const sourceOwned = own([
      ["opportunities", "op.id"],
      ["opportunity_evidence_links", "l.id"],
      ["raw_evidence", "re.id"],
      ["collection_tasks", "ct.id"],
    ]);
    const attemptOwned = own([
      ["opportunities", "op.id"],
      ["opportunity_evidence_links", "l.id"],
      ["raw_evidence", "re.id"],
      ["collection_tasks", "a.task_id"],
    ]);
    const qualityOwned = own([
      ["opportunities", "op.id"],
      ["opportunity_evidence_links", "l.id"],
      ["raw_evidence", "l.raw_evidence_id"],
      ["data_quality_issues", "q.id"],
    ]);
    const trendOwned = own([
      ["opportunities", "o.id"],
      ["trend_topics", "t.id"],
    ]);
    const signalOwned = own([["trend_signals", "s.id"]]);
    const eventOwned = own([["opportunity_events", "e.id"]]);
    const scoreOwned = own([["opportunity_score_runs", "opportunity_score_runs.id"]]);
    const profitOwned = own([["opportunity_profit_runs", "opportunity_profit_runs.id"]]);
    const taskOwned = own([["tasks", "t.id"]]);
    const taskEventOwned = own([["task_events", "e2.id"]]);
    const taskDecisionOwned = own([["opportunity_decisions", "d.id"]]);
    const taskOpportunityOwned = own([["opportunities", "parent.id"]]);
    const notificationEventOwned = own([["outbox_events", "delivery.id"]]);
    const nativeParent = "p.account_id=?";
    const scope = [input.opportunityId, input.organizationId, input.workspaceId],
      lineageScope = account ? [input.opportunityId] : scope,
      [
        sourceRows = [],
        attemptRows = [],
        qualityRows = [],
        trendRows = [],
        opportunityRows = [],
        scoreRows = [],
        profitRows = [],
        taskRows = [],
        notificationRows = [],
      ] = await Promise.all([
        this.pool.query<RowDataPacket[]>(
          sqlText(
            "SELECT DISTINCT p.id source_id,p.name source_name,",
            "COALESCE(h.health_status,p.status) source_status,h.last_error_code source_error_code,",
            "COALESCE(h.last_checked_at,re.captured_at) source_checked_at,",
            "re.id evidence_id,re.status evidence_status,re.captured_at,re.request_id,re.trace_id,",
            "ct.id collection_task_id,ct.status collection_status,ct.last_error_code,",
            "ct.created_at task_created_at,ct.request_id task_request_id,ct.trace_id task_trace_id",
            "FROM opportunity_evidence_links l JOIN raw_evidence re ON re.id=l.raw_evidence_id JOIN opportunities op ON op.id=l.opportunity_id",
            "JOIN providers p ON p.id=re.provider_id LEFT JOIN provider_adapter_health h ON h.provider_id=p.id",
            "JOIN collection_tasks ct ON ct.id=re.collection_task_id",
            account
              ? `WHERE l.opportunity_id=? AND l.provider_id=re.provider_id${sourceOwned.sql}`
              : "WHERE l.opportunity_id=? AND op.organization_id=? AND op.workspace_id=?",
            "ORDER BY re.captured_at DESC LIMIT 20",
          ),
          [...lineageScope, ...sourceOwned.values],
        ),
        this.pool.query<RowDataPacket[]>(
          sqlText(
            "SELECT DISTINCT a.id,a.task_id,a.status,a.error_code,a.created_at,a.request_id,a.trace_id",
            "FROM collection_task_attempts a JOIN raw_evidence re ON re.collection_task_id=a.task_id",
            "JOIN opportunity_evidence_links l ON l.raw_evidence_id=re.id JOIN opportunities op ON op.id=l.opportunity_id",
            account
              ? `WHERE l.opportunity_id=? AND l.provider_id=re.provider_id${attemptOwned.sql}`
              : "WHERE l.opportunity_id=? AND op.organization_id=? AND op.workspace_id=?",
            "ORDER BY a.created_at DESC LIMIT 20",
          ),
          [...lineageScope, ...attemptOwned.values],
        ),
        this.pool.query<RowDataPacket[]>(
          sqlText(
            "SELECT DISTINCT q.id,q.metric_code,q.severity,q.status,q.updated_at,q.request_id,q.trace_id",
            "FROM data_quality_issues q JOIN opportunity_evidence_links l ON l.raw_evidence_id=q.raw_evidence_id JOIN opportunities op ON op.id=l.opportunity_id",
            account
              ? "JOIN raw_evidence re ON re.id=l.raw_evidence_id AND re.provider_id=l.provider_id"
              : "",
            account
              ? `WHERE l.opportunity_id=?${qualityOwned.sql}`
              : "WHERE l.opportunity_id=? AND q.organization_id=? AND q.workspace_id=?",
            "ORDER BY q.updated_at DESC LIMIT 20",
          ),
          [...lineageScope, ...qualityOwned.values],
        ),
        this.pool.query<RowDataPacket[]>(
          sqlText(
            "SELECT DISTINCT t.id,t.title,t.status,t.source_fresh_at,s.observed_at,s.request_id,s.trace_id",
            "FROM opportunities o JOIN trend_topics t ON t.id=o.source_ref_id AND o.source_type='trend_topic'",
            `LEFT JOIN trend_signals s ON s.topic_id=t.id${signalOwned.sql}`,
            account
              ? `WHERE o.id=?${trendOwned.sql}`
              : "WHERE o.id=? AND o.organization_id=? AND o.workspace_id=?",
            "ORDER BY s.observed_at DESC LIMIT 1",
          ),
          [...signalOwned.values, ...lineageScope, ...trendOwned.values],
        ),
        this.pool.query<RowDataPacket[]>(
          sqlText(
            "SELECT o.id,o.name,o.decision_status,o.updated_at,e.request_id,e.trace_id",
            "FROM opportunities o LEFT JOIN " +
              (input.nativeOpportunity ? "opportunity_events" : opportunityEventReadRelation) +
              " e ON e.resource_type='opportunity'",
            `AND e.resource_id=o.id${input.nativeOpportunity ? "" : " AND e.organization_id=o.organization_id AND e.workspace_id=o.workspace_id"}${eventOwned.sql}`,
            input.nativeOpportunity
              ? "WHERE o.id=? AND o.account_id=?"
              : "WHERE o.id=? AND o.organization_id=? AND o.workspace_id=?",
            "ORDER BY e.occurred_at DESC LIMIT 1",
          ),
          [
            ...eventOwned.values,
            ...(input.nativeOpportunity ? [input.opportunityId, input.accountId] : scope),
          ],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT id,status,scored_at,request_id,trace_id FROM opportunity_score_runs " +
            "WHERE opportunity_id=? AND EXISTS (SELECT 1 FROM opportunities p " +
            `WHERE p.id=opportunity_score_runs.opportunity_id AND ${input.nativeOpportunity ? nativeParent : "p.organization_id=? AND p.workspace_id=?"})${scoreOwned.sql} ` +
            "ORDER BY scored_at DESC LIMIT 10",
          [
            ...(input.nativeOpportunity ? [input.opportunityId, input.accountId] : scope),
            ...scoreOwned.values,
          ],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT id,status,calculated_at,request_id,trace_id FROM opportunity_profit_runs " +
            "WHERE opportunity_id=? AND EXISTS (SELECT 1 FROM opportunities p " +
            `WHERE p.id=opportunity_profit_runs.opportunity_id AND ${input.nativeOpportunity ? nativeParent : "p.organization_id=? AND p.workspace_id=?"})${profitOwned.sql} ` +
            "ORDER BY calculated_at DESC LIMIT 10",
          [
            ...(input.nativeOpportunity ? [input.opportunityId, input.accountId] : scope),
            ...profitOwned.values,
          ],
        ),
        this.pool.query<RowDataPacket[]>(
          sqlText(
            "SELECT t.id,t.title,t.status,t.updated_at,e.request_id,e.trace_id",
            "FROM tasks t LEFT JOIN task_events e ON e.id=(SELECT e2.id FROM task_events e2",
            `WHERE e2.task_id=t.id${taskEventOwned.sql} ORDER BY e2.created_at DESC,e2.id DESC LIMIT 1)`,
            account
              ? `WHERE EXISTS (SELECT 1 FROM opportunities parent WHERE parent.id=?${taskOpportunityOwned.sql} AND (` +
                  "(t.source_type IN ('evidence_completion','selection_verification') AND t.source_ref_id=parent.id) OR " +
                  "(t.source_type='selection_verification' AND EXISTS (SELECT 1 FROM opportunity_decisions d " +
                  `WHERE d.id=t.source_ref_id AND d.opportunity_id=parent.id${taskDecisionOwned.sql})))) ` +
                  `AND t.deleted_at IS NULL${taskOwned.sql}`
              : "WHERE t.organization_id=? AND t.workspace_id=? AND t.source_ref_id=? AND t.deleted_at IS NULL",
            "ORDER BY t.updated_at DESC LIMIT 20",
          ),
          account
            ? [
                ...taskEventOwned.values,
                input.opportunityId,
                ...taskOpportunityOwned.values,
                ...taskDecisionOwned.values,
                ...taskOwned.values,
              ]
            : [input.organizationId, input.workspaceId, input.opportunityId],
        ),
        input.nativeOpportunity
          ? this.pool.query<RowDataPacket[]>(
              sqlText(
                "SELECT n.id,n.title,n.severity,n.created_at,delivery.request_id,delivery.trace_id",
                "FROM notifications n JOIN outbox_events delivery ON delivery.id=n.source_event_id",
                `WHERE n.recipient_id=?${notificationEventOwned.sql} AND ((n.resource_type='opportunity' AND n.resource_id=?)`,
                "OR (n.resource_type='task' AND EXISTS (SELECT 1 FROM tasks t WHERE t.id=n.resource_id",
                `AND t.account_id=? AND t.deleted_at IS NULL${taskOwned.sql} AND ((t.source_type IN ('evidence_completion','selection_verification') AND t.source_ref_id=?)`,
                "OR (t.source_type='selection_verification' AND EXISTS (SELECT 1 FROM opportunity_decisions d",
                `WHERE d.id=t.source_ref_id AND d.opportunity_id=?${taskDecisionOwned.sql}))))))`,
                "ORDER BY n.created_at DESC LIMIT 20",
              ),
              [
                input.accountId,
                ...notificationEventOwned.values,
                input.opportunityId,
                input.accountId,
                ...taskOwned.values,
                input.opportunityId,
                input.opportunityId,
                ...taskDecisionOwned.values,
              ],
            )
          : this.pool.query<RowDataPacket[]>(
              sqlText(
                "SELECT n.id,n.title,n.severity,n.created_at,o.request_id,o.trace_id",
                `FROM ${await notificationScopeRelation(this.pool)} n JOIN outbox_events o ON o.id=n.source_event_id`,
                "WHERE n.organization_id=? AND n.workspace_id=? AND (n.resource_id=? OR n.resource_id IN",
                "(SELECT t.id FROM tasks t WHERE t.organization_id=? AND t.workspace_id=? AND",
                `t.source_ref_id=? AND t.deleted_at IS NULL${taskOwned.sql}))${account ? " AND n.recipient_id=? AND o.organization_id=n.organization_id AND o.workspace_id=n.workspace_id" : ""} ORDER BY n.created_at DESC LIMIT 20`,
              ),
              [
                input.organizationId,
                input.workspaceId,
                input.opportunityId,
                input.organizationId,
                input.workspaceId,
                input.opportunityId,
                ...taskOwned.values,
                ...(account ? [input.accountId] : []),
              ],
            ),
      ]).then((results) => results.map(([rows]) => rows));
    const nodes: OpportunityDetail["lineage"]["nodes"] = [],
      seen = new Set<string>(),
      add = (node: OpportunityDetail["lineage"]["nodes"][number]) => {
        const key = `${node.kind}:${node.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          nodes.push(node);
        }
      };
    for (const row of sourceRows) {
      add({
        kind: "source",
        id: String(row.source_id),
        label: String(row.source_name),
        status: row.source_error_code
          ? [row.source_status, row.source_error_code].map(String).join(":")
          : String(row.source_status),
        occurred_at: iso(row.source_checked_at),
        request_id: String(row.request_id),
        trace_id: String(row.trace_id),
        route: `/platform-admin/providers/sources?provider_id=${encodeURIComponent(String(row.source_id))}`,
      });
      add({
        kind: "collection_task",
        id: String(row.collection_task_id),
        label: "采集任务",
        status: String(row.collection_status),
        occurred_at: iso(row.task_created_at),
        request_id: String(row.task_request_id),
        trace_id: String(row.task_trace_id),
        route: `/platform-admin/collection?task_id=${encodeURIComponent(String(row.collection_task_id))}`,
      });
      add({
        kind: "evidence",
        id: String(row.evidence_id),
        label: "原始证据",
        status: String(row.evidence_status),
        occurred_at: iso(row.captured_at),
        request_id: String(row.request_id),
        trace_id: String(row.trace_id),
        route: `/platform-admin/data?evidence_id=${encodeURIComponent(String(row.evidence_id))}`,
      });
    }
    for (const row of attemptRows)
      add({
        kind: "collection_attempt",
        id: String(row.id),
        label: "采集尝试",
        status: row.error_code ? `${row.status}:${row.error_code}` : String(row.status),
        occurred_at: iso(row.created_at),
        request_id: String(row.request_id),
        trace_id: String(row.trace_id),
        route: `/platform-admin/collection?task_id=${encodeURIComponent(String(row.task_id))}`,
      });
    for (const row of qualityRows)
      add({
        kind: "quality_issue",
        id: String(row.id),
        label: `质量问题：${String(row.metric_code)}`,
        status: `${String(row.status)}:${String(row.severity)}`,
        occurred_at: iso(row.updated_at),
        request_id: String(row.request_id),
        trace_id: String(row.trace_id),
        route: `/platform-admin/data?issue_id=${encodeURIComponent(String(row.id))}`,
      });
    for (const row of trendRows) {
      if (row.source_fresh_at == null) continue;
      add({
        kind: "trend",
        id: String(row.id),
        label: String(row.title),
        status: String(row.status),
        occurred_at: iso(row.source_fresh_at),
        request_id: row.request_id == null ? null : String(row.request_id),
        trace_id: row.trace_id == null ? null : String(row.trace_id),
        route: `/trends?topic_id=${encodeURIComponent(String(row.id))}`,
      });
    }
    for (const row of opportunityRows)
      add({
        kind: "opportunity",
        id: String(row.id),
        label: String(row.name),
        status: String(row.decision_status),
        occurred_at: iso(row.updated_at),
        request_id: row.request_id == null ? null : String(row.request_id),
        trace_id: row.trace_id == null ? null : String(row.trace_id),
        route: `/opportunities/${encodeURIComponent(String(row.id))}?tab=lineage`,
      });
    for (const row of scoreRows)
      add({
        kind: "score",
        id: String(row.id),
        label: "机会评分",
        status: String(row.status),
        occurred_at: iso(row.scored_at),
        request_id: String(row.request_id),
        trace_id: String(row.trace_id),
        route: `/opportunities/${encodeURIComponent(input.opportunityId)}?tab=overview`,
      });
    for (const row of profitRows)
      add({
        kind: "profit",
        id: String(row.id),
        label: "利润核算",
        status: String(row.status),
        occurred_at: iso(row.calculated_at),
        request_id: String(row.request_id),
        trace_id: String(row.trace_id),
        route: `/opportunities/${encodeURIComponent(input.opportunityId)}?tab=profit`,
      });
    for (const row of taskRows)
      add({
        kind: "task",
        id: String(row.id),
        label: String(row.title),
        status: String(row.status),
        occurred_at: iso(row.updated_at),
        request_id: row.request_id == null ? null : String(row.request_id),
        trace_id: row.trace_id == null ? null : String(row.trace_id),
        route: `/tasks/${encodeURIComponent(String(row.id))}`,
      });
    for (const row of notificationRows)
      add({
        kind: "notification",
        id: String(row.id),
        label: String(row.title),
        status: String(row.severity),
        occurred_at: iso(row.created_at),
        request_id: String(row.request_id),
        trace_id: String(row.trace_id),
        route: `/notifications?notification=${encodeURIComponent(String(row.id))}`,
      });
    const stageOrder = [
      "source",
      "collection_task",
      "collection_attempt",
      "evidence",
      "quality_issue",
      "trend",
      "opportunity",
      "score",
      "profit",
      "task",
      "notification",
    ];
    nodes.sort(
      (left, right) =>
        stageOrder.indexOf(left.kind) - stageOrder.indexOf(right.kind) ||
        new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime(),
    );
    const codes = new Set<string>(),
      affectedStages = new Set<string>();
    let level: "none" | "degraded" | "blocked" = "none";
    for (const node of nodes) {
      const status = node.status.toLowerCase();
      const blocked =
        /blocked|failed_terminal|dead_letter/.test(status) ||
        (node.kind === "quality_issue" && status === "open:critical");
      const degraded =
        blocked ||
        /warning|retry_scheduled|rate_limited|succeeded_empty|insufficient_data/.test(status) ||
        (node.kind === "quality_issue" && status === "open:warning");
      if (degraded) {
        affectedStages.add(node.kind);
        codes.add(node.status);
        if (blocked) level = "blocked";
        else if (level === "none") level = "degraded";
      }
    }
    const observedAt = sourceRows
      .map((row) => new Date(row.captured_at as string | Date))
      .sort((left, right) => right.getTime() - left.getTime())[0];
    return {
      freshness: {
        observed_at: observedAt ? observedAt.toISOString() : null,
        age_seconds: observedAt
          ? Math.max(0, Math.floor((Date.now() - observedAt.getTime()) / 1000))
          : null,
      },
      failure_impact: {
        level,
        codes: [...codes],
        affected_stages: [...affectedStages],
      },
      request_ids: [
        ...new Set(nodes.flatMap((node) => (node.request_id ? [node.request_id] : []))),
      ],
      trace_ids: [...new Set(nodes.flatMap((node) => (node.trace_id ? [node.trace_id] : [])))],
      nodes,
    };
  }
  private async operatingFeedback(
    input: {
      organizationId: string;
      workspaceId: string;
      opportunityId: string;
      accountId?: string;
      nativeOpportunity?: boolean;
    },
    database: Pool | PoolConnection = this.pool,
  ): Promise<OpportunityOperatingFeedback> {
    const owned = detailOwnership(input.accountId)([["opportunity_operating_facts", "f.id"]]);
    const [rows] = await database.query<RowDataPacket[]>(
      "SELECT f.* FROM opportunity_operating_facts f JOIN opportunities o ON o.id=f.opportunity_id " +
        `WHERE o.id=? AND ${input.nativeOpportunity ? "o.account_id=?" : "o.organization_id=? AND o.workspace_id=?"}${owned.sql} ` +
        "ORDER BY f.period_end DESC,f.created_at DESC,f.id DESC LIMIT 20",
      [
        input.opportunityId,
        ...(input.nativeOpportunity
          ? [input.accountId]
          : [input.organizationId, input.workspaceId]),
        ...owned.values,
      ],
    );
    const facts: OpportunityOperatingFact[] = rows.map((row) => ({
        id: String(row.id),
        period_start: mysqlDateOnly(row.period_start),
        period_end: mysqlDateOnly(row.period_end),
        sales_units: Number(row.sales_units),
        revenue_amount: Number(row.revenue_amount),
        ad_spend_amount: Number(row.ad_spend_amount),
        returned_units: Number(row.returned_units),
        purchase_lead_time_days: Number(row.purchase_lead_time_days),
        actual_profit_amount: Number(row.actual_profit_amount),
        currency: String(row.currency),
        source_ref: String(row.source_ref),
        notes: row.notes == null ? null : String(row.notes),
        score_rule_version_snapshot:
          row.score_rule_version_snapshot == null ? null : String(row.score_rule_version_snapshot),
        profit_rule_version_snapshot:
          row.profit_rule_version_snapshot == null
            ? null
            : String(row.profit_rule_version_snapshot),
        decision_status_snapshot: row.decision_status_snapshot,
        predicted_profit_amount: numberOrNull(row.predicted_profit_amount),
        predicted_currency: row.predicted_currency == null ? null : String(row.predicted_currency),
        quoted_lead_time_days: numberOrNull(row.quoted_lead_time_days),
        observed_at: iso(row.observed_at),
        request_id: String(row.request_id),
        trace_id: String(row.trace_id),
        created_at: iso(row.created_at),
      })),
      latest = facts[0];
    if (!latest) return { facts, calibration: null };
    const sameProfitCurrency =
      latest.predicted_profit_amount !== null && latest.predicted_currency === latest.currency;
    return {
      facts,
      calibration: {
        fact_id: latest.id,
        return_rate_percent:
          latest.sales_units > 0
            ? Math.round((latest.returned_units / latest.sales_units) * 10_000) / 100
            : null,
        ad_spend_ratio_percent:
          latest.revenue_amount > 0
            ? Math.round((latest.ad_spend_amount / latest.revenue_amount) * 10_000) / 100
            : null,
        profit_variance_amount: sameProfitCurrency
          ? Math.round(
              (latest.actual_profit_amount - Number(latest.predicted_profit_amount)) * 1_000_000,
            ) / 1_000_000
          : null,
        profit_variance_currency: sameProfitCurrency ? latest.currency : null,
        lead_time_variance_days:
          latest.quoted_lead_time_days === null
            ? null
            : latest.purchase_lead_time_days - latest.quoted_lead_time_days,
        score_rule_version: latest.score_rule_version_snapshot,
        profit_rule_version: latest.profit_rule_version_snapshot,
        decision_status_snapshot: latest.decision_status_snapshot,
        human_review_required: true,
        automatic_rule_update: false,
        automatic_decision: false,
      },
    };
  }
  async get(request: Parameters<OpportunityRepository["get"]>[0]) {
    const accountId = "accountId" in request ? request.accountId : undefined;
    if (accountId !== undefined) await requireAccountReadRehearsal(this.pool);
    const native = accountId !== undefined && (await this.nativeEvidenceScope());
    const nativeOpportunity =
      accountId !== undefined && (await this.nativeOpportunityScope(this.pool));
    if (nativeOpportunity && !native)
      throw new Error("native_opportunity_requires_native_evidence");
    const inner = `WHERE o.id=? AND oo.account_id=?${nativeOpportunity ? " AND o.account_id=oo.account_id" : ""} LIMIT 1) o`;
    const accountDetailSql = nativeOpportunity
      ? sqlText(
          `SELECT o.*,${nativeOpportunityProof(reuseListPrimaryIdentitySql(nativeAccountPrimaryRecordsSql), "o.account_owner")},${nativeOpportunityProof(reuseListPrimaryIdentitySql(accountCountsSql), "o.account_owner")},${opportunityLifecycleSql},${nativeOpportunityProof(opportunityListSelectionProjectionSql, "o.account_owner")}`,
          `FROM (SELECT o.*,oo.account_id account_owner,receipt.source_run_id sealed_run_id,${nativeOpportunityProof(opportunityPrimaryAsinSql, "oo.account_id")} primary_fact_asin FROM ${accountOpportunitySource} ${inner}`,
        )
      : sqlText(
          `SELECT o.*,${accountPrimaryProjection(native, native ? nativeAccountPrimaryRecordsSql : accountPrimaryRecordsSql)},${reuseListPrimaryIdentitySql(accountCountsSql)},${opportunityLifecycleSql},${accountPrimaryProjection(native, opportunityListSelectionProjectionSql)}`,
          `FROM (SELECT o.*,oo.account_id account_owner,${ownedPrimaryIdentity(opportunityPrimaryAsinSql, "oo.account_id", native)} primary_fact_asin FROM ${accountOpportunitySource} ${inner}`,
        );
    const accountDetailValues = [request.opportunityId, accountId];
    const [rows] =
      "organizationId" in request
        ? await this.pool.query<RowDataPacket[]>(
            sqlText(
              `SELECT o.*,${opportunityPrimaryRecordsSql},${opportunityCountsSql},${opportunityLifecycleSql},${opportunitySelectionProjectionSql}`,
              `FROM (SELECT o.*,${opportunityPrimaryAsinSql} primary_fact_asin FROM opportunities o WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? LIMIT 1) o`,
            ),
            [request.opportunityId, request.organizationId, request.workspaceId],
          )
        : native
          ? await this.pool.execute<RowDataPacket[]>(
              ...bindNativeOwner(accountDetailSql, accountDetailValues, accountId),
            )
          : await this.pool.query<RowDataPacket[]>(accountDetailSql, accountDetailValues);
    const row = rows[0];
    if (!row) return null;
    const input =
      "organizationId" in request
        ? request
        : {
            organizationId: nativeOpportunity ? "" : String(row.organization_id),
            workspaceId: nativeOpportunity ? "" : String(row.workspace_id),
            opportunityId: request.opportunityId,
            accountId: request.accountId,
            nativeOpportunity,
          };
    const own = detailOwnership(accountId);
    const evidenceOwner = own([
      ["opportunities", "op.id"],
      ["opportunity_evidence_links", "l.id"],
      ["trend_signals", "s.id"],
      ["raw_evidence", "l.raw_evidence_id"],
    ]);
    const decisionOwner = own([["opportunity_decisions", "opportunity_decisions.id"]]);
    const taskOwner = own([["tasks", "tasks.id"]]);
    const taskParentOwner = own([["opportunities", "tasks.source_ref_id"]]);
    const scoreJobOwner = own([["opportunity_score_jobs", "j.id"]]);
    const scoreRunOwner = own([["opportunity_score_runs", "opportunity_score_runs.id"]]);
    const scoreComponentOwner = own([
      ["opportunity_score_components", "opportunity_score_components.id"],
    ]);
    const parentScope = nativeOpportunity ? [accountId] : [input.organizationId, input.workspaceId];
    const qualifyParent = (alias: "o" | "op" | "p") =>
      nativeOpportunity
        ? `${alias}.account_id=?`
        : `${alias}.organization_id=? AND ${alias}.workspace_id=?`;
    const [lineage, operatingFeedback] = await Promise.all([
      this.lineage(input),
      this.operatingFeedback(input),
    ]);
    const [evidence] = await this.pool.query<RowDataPacket[]>(
      sqlText(
        "SELECT l.id,s.title,s.publisher,s.canonical_url,l.provider_id,",
        "l.raw_evidence_id,l.observed_at FROM opportunity_evidence_links l JOIN opportunities op ON op.id=l.opportunity_id",
        "JOIN trend_signals s ON s.id=l.evidence_id AND l.evidence_type='trend_signal'",
        accountId === undefined
          ? "WHERE l.opportunity_id=? AND op.organization_id=? AND op.workspace_id=?"
          : "JOIN raw_evidence r ON r.id=l.raw_evidence_id AND r.id=s.raw_evidence_id " +
              "AND r.provider_id=l.provider_id AND s.provider_id=l.provider_id " +
              `WHERE l.opportunity_id=?${evidenceOwner.sql}`,
        "ORDER BY l.observed_at DESC,l.id DESC",
      ),
      accountId === undefined
        ? [input.opportunityId, input.organizationId, input.workspaceId]
        : [input.opportunityId, ...evidenceOwner.values],
    );
    const [decisions] = await this.pool.query<RowDataPacket[]>(
      sqlText(
        "SELECT id,action,reason,actor_id,created_at,opportunity_version",
        "FROM opportunity_decisions",
        `WHERE opportunity_id=?${decisionOwner.sql}`,
        "ORDER BY created_at DESC,id DESC",
      ),
      [input.opportunityId, ...decisionOwner.values],
    );
    const [[evidenceTasks], [scoreJobs], [automaticEvaluations], [analysisCompletions]] =
      await Promise.all([
        this.pool.query<RowDataPacket[]>(
          "SELECT id,status,progress_percent,assignee_id,due_at,completed_at,created_at,updated_at " +
            "FROM tasks WHERE " +
            (accountId === undefined ? "organization_id=? AND workspace_id=? AND " : "") +
            `source_type='evidence_completion' AND source_ref_id=? AND deleted_at IS NULL${taskOwner.sql}${taskParentOwner.sql} ` +
            "ORDER BY created_at DESC,id DESC LIMIT 1",
          accountId === undefined
            ? [input.organizationId, input.workspaceId, input.opportunityId]
            : [input.opportunityId, ...taskOwner.values, ...taskParentOwner.values],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT j.id,j.status,j.trigger_task_id,j.last_error_code,j.created_at,j.updated_at FROM opportunity_score_jobs j " +
            "JOIN opportunities o ON o.id=j.opportunity_id " +
            `WHERE ${qualifyParent("o")} AND j.opportunity_id=?${scoreJobOwner.sql} ` +
            "ORDER BY j.created_at DESC,j.id DESC LIMIT 1",
          [...parentScope, input.opportunityId, ...scoreJobOwner.values],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT e.status,e.last_error_code,e.result_json,e.evaluated_at FROM automatic_selection_evaluations e " +
            "JOIN opportunities op ON op.id=e.opportunity_id WHERE e.opportunity_id=? " +
            `AND ${qualifyParent("op")} LIMIT 1`,
          [input.opportunityId, ...parentScope],
        ),
        this.pool.query<RowDataPacket[]>(
          accountId === undefined
            ? opportunityAnalysisCompletedAtSql
            : nativeOpportunity
              ? accountOpportunityAnalysisCompletedAtSql.replaceAll(
                  opportunityEventReadRelation,
                  "opportunity_events",
                )
              : accountOpportunityAnalysisCompletedAtSql,
          accountId === undefined
            ? [input.organizationId, input.workspaceId, input.opportunityId, row.main_asin ?? ""]
            : [accountId, input.opportunityId, row.main_asin ?? ""],
        ),
      ]);
    let scoreRun: RowDataPacket | undefined,
      components: RowDataPacket[] = [];
    try {
      const [scoreRuns] = await this.pool.query<RowDataPacket[]>(
        "SELECT * FROM opportunity_score_runs WHERE opportunity_id=? AND EXISTS (SELECT 1 FROM opportunities p " +
          `WHERE p.id=opportunity_score_runs.opportunity_id AND ${qualifyParent("p")})${scoreRunOwner.sql} ` +
          "ORDER BY scored_at DESC,id DESC LIMIT 1",
        [input.opportunityId, ...parentScope, ...scoreRunOwner.values],
      );
      scoreRun = scoreRuns[0];
      if (scoreRun) {
        const [result] = await this.pool.query<RowDataPacket[]>(
          sqlText(
            "SELECT dimension_code,weight_percent,input_score,weighted_score,",
            "evidence_ids_json,missing_fields_json FROM opportunity_score_components",
            `WHERE score_run_id=?${scoreComponentOwner.sql} ORDER BY dimension_code`,
          ),
          [scoreRun.id, ...scoreComponentOwner.values],
        );
        components = result;
      }
    } catch (error) {
      if ((error as { code?: string }).code !== "ER_NO_SUCH_TABLE") throw error;
    }
    const selection = evaluateOpportunitySelection(row),
      missingQualityGates = Object.entries(selection.quality_gates)
        .filter(([key, passed]) => key !== "all_passed" && !passed)
        .map(
          ([key]) =>
            ({ score: "评分", market: "市场", competition: "竞争", cost: "成本", risk: "风险" })[
              key
            ],
        ),
      evidenceTask = evidenceTasks[0],
      scoreJob = scoreJobs[0],
      automaticEvaluation = automaticEvaluations[0],
      automaticResult = automaticEvaluation
        ? parse<Record<string, unknown>>(automaticEvaluation.result_json ?? "{}")
        : {},
      automaticErrorCode = String(
        automaticEvaluation?.last_error_code ?? automaticResult.error_code ?? "",
      ),
      automaticGuidance =
        (
          {
            automatic_rules_not_active: "先启用评分规则和 Amazon 费用规则。",
            amazon_product_evidence_missing: "等待 Amazon 商品页证据。",
            amazon_sale_facts_incomplete: "Amazon 商品页尚未取得有效标题、售价或币种。",
            automatic_cost_scope_mismatch:
              "当前费用规则未覆盖该商品族；系统不会套用其他品类的成本假设。",
            automatic_primary_source_unsupported: "原情报不支持当前主品的需求关联或商品类型。",
            automatic_primary_source_unverified: "等待复核原情报与当前主品的关联。",
            amazon_competitor_snapshot_missing: "等待当前主品的 Amazon 详情快照。",
            high_confidence_1688_match_missing:
              "1688 同款高置信报价不足 3 条；系统会继续采集，不会用弱匹配强行估算。",
            automatic_cost_policy_incomplete: "费用规则需补齐固定入仓物流和当前币种换算依据。",
            automatic_cost_inputs_missing: "自动成本输入尚未写入完成；系统会继续重试。",
            profit_calculation_incomplete: "利润计算仍缺少费用或换算依据。",
          } as Record<string, string>
        )[automaticErrorCode] ?? null,
      evidenceBlocked = Number(row.evidence_count) === 0 || row.coverage_status === "insufficient",
      qualityRegressionBlocked =
        String(scoreJob?.last_error_code ?? "") === "score_blocked_by_data_quality_regression",
      recommendationBlocked = !selection.quality_gates.all_passed || qualityRegressionBlocked,
      scoreInProgress =
        scoreJob && ["queued", "leased", "retry_scheduled"].includes(String(scoreJob.status)),
      automaticInProgress =
        automaticEvaluation &&
        ["queued", "leased", "retry_scheduled", "waiting_profit"].includes(
          String(automaticEvaluation.status),
        ),
      evidenceInProgress =
        evidenceBlocked &&
        (automaticInProgress ||
          scoreInProgress ||
          (evidenceTask && !["cancelled", "completed"].includes(String(evidenceTask.status)))),
      redecisionReady = Boolean(
        evidenceTask &&
        String(evidenceTask.status) === "completed" &&
        scoreJob &&
        String(scoreJob.trigger_task_id) === String(evidenceTask.id) &&
        ["succeeded", "completed_with_warnings"].includes(String(scoreJob.status)),
      );
    return {
      ...summary(row),
      analysis_completed_at: analysisCompletions[0]
        ? iso(analysisCompletions[0].occurred_at)
        : null,
      operating_feedback: operatingFeedback,
      lineage,
      adoption_blockers: [
        {
          code: "evidence_insufficient",
          status: evidenceBlocked ? (evidenceInProgress ? "in_progress" : "blocked") : "cleared",
          progress_percent: evidenceTask ? Number(evidenceTask.progress_percent ?? 0) : null,
          next_action: evidenceBlocked
            ? (automaticGuidance ??
              (automaticInProgress || scoreInProgress
                ? "已进入自动分析队列，可稍后刷新查看证据状态。"
                : evidenceTask
                  ? String(evidenceTask.status) === "completed"
                    ? "补采任务已完成，等待评分结果。"
                    : "历史补采任务尚未完成，仍缺少有效采集证据。"
                  : "证据尚未齐备；请检查采集来源和自动分析状态。"))
            : "证据覆盖阻断已解除。",
          task_id: evidenceTask ? String(evidenceTask.id) : null,
          task_status: evidenceTask ? String(evidenceTask.status) : null,
          score_job_status: scoreJob ? String(scoreJob.status) : null,
        },
        {
          code: "recommendation_insufficient",
          status: recommendationBlocked
            ? scoreInProgress || automaticInProgress
              ? "in_progress"
              : "blocked"
            : "cleared",
          progress_percent: null,
          next_action: recommendationBlocked
            ? (automaticGuidance ??
              (!qualityRegressionBlocked &&
              !scoreInProgress &&
              selection.selection_stage === "rule_candidate"
                ? `已进入选品候选；${missingQualityGates.join("、")}质量门全部通过后才会显示“建议采纳”。`
                : recommendationGuidance({
                    qualityRegressionBlocked,
                    scoreInProgress: Boolean(scoreInProgress),
                    scoreRuleVersion:
                      row.score_rule_version == null ? null : String(row.score_rule_version),
                    latestScoreStatus: scoreRun?.status == null ? null : String(scoreRun.status),
                    primaryIdentified: row.main_asin != null,
                  })))
            : "推荐结论阻断已解除。",
          task_id: evidenceTask ? String(evidenceTask.id) : null,
          task_status: evidenceTask ? String(evidenceTask.status) : null,
          score_job_status: scoreJob ? String(scoreJob.status) : null,
        },
      ],
      redecision_ready: redecisionReady,
      score_rule_version: row.score_rule_version == null ? null : String(row.score_rule_version),
      scored_at: row.scored_at == null ? null : iso(row.scored_at),
      latest_score_run: scoreRun
        ? {
            id: String(scoreRun.id),
            status: scoreRun.status,
            coverage_percent: Number(scoreRun.coverage_percent),
            confidence_score: numberOrNull(scoreRun.confidence_score),
            recommendation_status: String(scoreRun.recommendation_status),
            missing_fields: parse<string[]>(scoreRun.missing_fields_json),
            scored_at: iso(scoreRun.scored_at),
          }
        : null,
      score_components: components.map((item) => ({
        dimension_code: String(item.dimension_code),
        weight_percent: Number(item.weight_percent),
        input_score: numberOrNull(item.input_score),
        weighted_score: numberOrNull(item.weighted_score),
        evidence_ids: parse<string[]>(item.evidence_ids_json),
        missing_fields: parse<string[]>(item.missing_fields_json),
      })),
      evidence: evidence.map((item) => ({
        id: String(item.id),
        title: String(item.title),
        publisher: String(item.publisher),
        canonical_url: String(item.canonical_url),
        provider_id: String(item.provider_id),
        raw_evidence_id: String(item.raw_evidence_id),
        observed_at: iso(item.observed_at),
      })),
      decisions: decisions.map((item) => ({
        id: String(item.id),
        action: item.action,
        reason: String(item.reason),
        actor_id: String(item.actor_id),
        created_at: iso(item.created_at),
        opportunity_version: Number(item.opportunity_version),
      })),
      section_status: {
        market: Number(row.evidence_count) > 0 ? "covered" : "insufficient_data",
        competition: row.competition_score == null ? "insufficient_data" : "covered",
        profit: row.profit_status,
        risk: selection.quality_gates.risk ? "covered" : "insufficient_data",
        execution: "not_available",
      },
    } as OpportunityDetail;
  }
  async create(
    input: OpportunityWriteContext & {
      opportunityId: string;
      value: OpportunityCreateInput;
      route: string;
    },
  ) {
    const existing = await this.operation<OpportunitySummary>(input);
    if (existing) return existing;
    const connection = await this.pool.getConnection(),
      now = new Date();
    try {
      await connection.beginTransaction();
      if (input.value.source_topic_id) {
        const [topics] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM trend_topics WHERE id=? AND organization_id=? AND workspace_id=? AND status='active' LIMIT 1 FOR UPDATE",
          [input.value.source_topic_id, input.organizationId, input.workspaceId],
        );
        if (!topics[0])
          throw new OpportunityServiceError(
            "opportunity_source_not_found",
            404,
            "刷新趋势列表；来源主题可能不在当前工作区。",
          );
      }
      const sourceType = input.value.source_topic_id ? "trend_topic" : "manual";
      await connection.query(
        sqlText(
          "INSERT INTO opportunities",
          "(id,organization_id,workspace_id,name,market,category,source_type,source_ref_id,",
          "owner_id,lifecycle_status,recommendation_status,overall_score,trend_score,",
          "competition_score,profit_status,risk_level,confidence_status,confidence_score,",
          "evidence_count,source_count,coverage_status,score_rule_version,scored_at,",
          "decision_status,version,created_by,created_at,updated_at)",
          "VALUES (?,?,?,?,?,?,?, ?,?,'candidate','insufficient_data',NULL,NULL,NULL,",
          "'insufficient_data','unknown','insufficient_data',NULL,0,0,'insufficient',",
          "NULL,NULL,'pending',1,?,?,?)",
        ),
        [
          input.opportunityId,
          input.organizationId,
          input.workspaceId,
          input.value.name,
          input.value.market,
          input.value.category ?? null,
          sourceType,
          input.value.source_topic_id ?? null,
          input.actorId,
          input.actorId,
          now,
          now,
        ],
      );
      await connection.query(
        sqlText(
          "INSERT INTO opportunity_refresh_jobs",
          "(id,opportunity_id,status,attempt_count,available_at,",
          "lease_owner,lease_expires_at,last_error_code,request_id,trace_id,created_at,updated_at)",
          "VALUES (?,?,'queued',0,?,NULL,NULL,NULL,?,?,?,?)",
        ),
        [randomUUID(), input.opportunityId, now, input.requestId, input.traceId, now, now],
      );
      const result = (await this.getIn(
        connection,
        input.opportunityId,
        input.organizationId,
        input.workspaceId,
      ))!;
      await this.record(
        connection,
        input,
        "opportunity.created",
        input.opportunityId,
        { source_type: sourceType, source_ref_id: input.value.source_topic_id ?? null },
        now,
      );
      await connection.query(
        "INSERT INTO opportunity_operations (id,actor_id,route,idempotency_key,resource_id," +
          "result_json,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomUUID(),
          input.actorId,
          input.route,
          input.idempotencyKey,
          input.opportunityId,
          JSON.stringify(result),
          now,
        ],
      );
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      if ((error as { code?: string }).code === "ER_DUP_ENTRY")
        throw new OpportunityServiceError(
          "opportunity_conflict",
          409,
          "刷新列表；该趋势可能已转为机会，或幂等请求已完成。",
        );
      throw error;
    } finally {
      connection.release();
    }
  }
  async decide(command: Parameters<OpportunityRepository["decide"]>[0]) {
    type DecisionResult = {
      opportunity_id: string;
      decision_status: "adopted" | "observing" | "rejected";
      version: number;
      decision_id: string;
      verification_task_id: string;
    };
    const accountMode = "accountOwnedDecision" in command;
    if (!accountMode) {
      const previous = await this.operation<DecisionResult>(command);
      if (previous) return previous;
    }
    const connection = await this.pool.getConnection(),
      now = new Date();
    try {
      await connection.beginTransaction();
      if (accountMode) await requireAccountReadRehearsal(connection, { lockForTransaction: true });
      const nativeOpportunity = accountMode && (await this.nativeOpportunityScope(connection));
      const projection = nativeOpportunity
        ? nativeOpportunityProof(opportunitySelectionProjectionSql, "oo.account_id")
        : opportunitySelectionProjectionSql;
      if (nativeOpportunity && /\b\w+\.(organization_id|workspace_id)\b/.test(projection))
        throw new Error("native_opportunity_decision_projection_invalid");
      const scopeQuery = sqlText(
        `SELECT o.name,o.decision_status,o.version,o.recommendation_status,o.evidence_count,` +
          `o.coverage_status,o.overall_score,o.score_rule_version,o.trend_score,` +
          `o.competition_score,o.profit_status,${projection}` +
          (accountMode
            ? (nativeOpportunity ? "" : ",o.organization_id,o.workspace_id") +
              ",oo.reason ownership_reason"
            : ""),
        accountMode ? `FROM ${accountOpportunitySource}` : "FROM opportunities o",
        accountMode
          ? "WHERE o.id=? AND oo.account_id=? " +
              (nativeOpportunity ? "AND o.account_id=oo.account_id " : "") +
              "LIMIT 1 FOR UPDATE"
          : "WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? LIMIT 1 FOR UPDATE",
      );
      const scopeArgs = accountMode
        ? [command.opportunityId, command.actorId]
        : [command.opportunityId, command.organizationId, command.workspaceId];
      const [rows] = nativeOpportunity
        ? await connection.query<RowDataPacket[]>(
            ...bindNativeOwner(scopeQuery, scopeArgs, command.actorId),
          )
        : await connection.query<RowDataPacket[]>(scopeQuery, scopeArgs);
      const row = rows[0];
      if (!row)
        throw new OpportunityServiceError(
          "opportunity_not_found",
          404,
          "刷新机会列表；该机会可能不在当前工作区。",
        );
      const input = accountMode
        ? {
            ...command,
            organizationId: String(row.organization_id),
            workspaceId: String(row.workspace_id),
          }
        : command;
      const nativeTask = accountMode && (await nativeBusinessTaskScope(connection));
      if (nativeOpportunity && !nativeTask)
        throw new Error("native_opportunity_requires_account_tasks");
      if (accountMode) {
        const previous = await this.operation<DecisionResult>(input, connection);
        if (previous) {
          const [ownedReplay] =
            previous.opportunity_id === input.opportunityId &&
            typeof previous.decision_id === "string" &&
            typeof previous.verification_task_id === "string"
              ? await connection.query<RowDataPacket[]>(
                  "SELECT d.id FROM opportunity_decisions d JOIN tasks t ON t.source_ref_id=d.id " +
                    "AND t.source_type='selection_verification' " +
                    "WHERE d.id=? AND t.id=? AND d.opportunity_id=? " +
                    `AND ${rehearsalOwns("opportunity_decisions", "d.id", "?")} AND ${rehearsalOwns("tasks", "t.id", "?")}` +
                    (nativeTask ? " AND t.account_id=?" : "") +
                    " LIMIT 1 LOCK IN SHARE MODE",
                  [
                    previous.decision_id,
                    previous.verification_task_id,
                    input.opportunityId,
                    input.actorId,
                    input.actorId,
                    ...(nativeTask ? [input.actorId] : []),
                  ],
                )
              : [[]];
          if (!ownedReplay.length)
            throw new OpportunityServiceError(
              "opportunity_decision_replay_not_available",
              409,
              "原决策或复核任务已无法按当前账号回读，请刷新选品详情。",
            );
          await connection.commit();
          return previous;
        }
      }
      if (Number(row.version) !== input.expectedVersion)
        throw new OpportunityServiceError(
          "opportunity_version_conflict",
          409,
          "刷新机会详情并使用最新 version 重试。",
        );
      if (
        input.action === "adopt" &&
        evaluateOpportunitySelection(row).selection_stage !== "recommended"
      )
        throw new OpportunityServiceError(
          "opportunity_adopt_evidence_insufficient",
          409,
          "仅可采纳已通过评分、市场、竞争、成本和风险五项质量门的“建议采纳”商品。",
        );
      const status: Exclude<OpportunityDecision, "pending"> =
          input.action === "adopt"
            ? "adopted"
            : input.action === "observe"
              ? "observing"
              : "rejected",
        decisionId = randomUUID(),
        version = input.expectedVersion + 1;
      await connection.query(
        sqlText(
          "INSERT INTO opportunity_decisions",
          "(id,opportunity_id,action,reason,previous_status,",
          "resulting_status,opportunity_version,actor_id,request_id,trace_id,created_at)",
          "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        ),
        [
          decisionId,
          input.opportunityId,
          input.action,
          input.reason,
          row.decision_status,
          status,
          version,
          input.actorId,
          input.requestId,
          input.traceId,
          now,
        ],
      );
      const [updated] = await connection.query<ResultSetHeader>(
        "UPDATE opportunities SET decision_status=?," +
          "lifecycle_entered_at=IF(lifecycle_status<>?,?,lifecycle_entered_at)," +
          "lifecycle_status=?,version=?,updated_at=? WHERE id=?" +
          (accountMode
            ? ` AND version=? AND ${rehearsalOwns("opportunities", "opportunities.id", "?")}` +
              (nativeOpportunity ? " AND account_id=?" : "")
            : " AND organization_id=? AND workspace_id=?"),
        [
          status,
          status,
          now,
          status,
          version,
          now,
          input.opportunityId,
          ...(accountMode
            ? [input.expectedVersion, input.actorId, ...(nativeOpportunity ? [input.actorId] : [])]
            : [input.organizationId, input.workspaceId]),
        ],
      );
      if (accountMode && updated.affectedRows !== 1)
        throw new OpportunityServiceError(
          "opportunity_version_conflict",
          409,
          "刷新机会详情并使用最新 version 重试。",
        );
      const verificationTaskId = randomUUID(),
        dueAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      await connection.query(
        sqlText(
          "INSERT INTO tasks",
          `(id,${nativeTask ? "account_id" : "organization_id,workspace_id"},title,description,status,priority,assignee_id,`,
          "source_type,source_ref_id,collection_task_id,due_at,completed_at,created_by,",
          "version,created_at,updated_at)",
          `VALUES (${nativeTask ? "?,?,?,?" : "?,?,?,?,?"},'todo','high',?,'selection_verification',?,NULL,?,NULL,?,1,?,?)`,
        ),
        [
          verificationTaskId,
          ...(nativeTask ? [input.actorId] : [input.organizationId, input.workspaceId]),
          `验证机会决策 · ${String(row.name).slice(0, 160)}`,
          `复核决策 ${decisionId} 的结论、证据、利润与风险；决策原因：${input.reason}`.slice(
            0,
            5000,
          ),
          input.actorId,
          decisionId,
          dueAt,
          input.actorId,
          now,
          now,
        ],
      );
      const taskEventId = randomUUID();
      await connection.query(
        sqlText(
          "INSERT INTO task_events",
          "(id,task_id,event_type,actor_id,payload_json,",
          "request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?)",
        ),
        [
          taskEventId,
          verificationTaskId,
          "task.created",
          input.actorId,
          JSON.stringify({
            source_type: "selection_verification",
            opportunity_id: input.opportunityId,
            decision_id: decisionId,
          }),
          input.requestId,
          input.traceId,
          now,
        ],
      );
      const result = {
        opportunity_id: input.opportunityId,
        decision_status: status,
        version,
        decision_id: decisionId,
        verification_task_id: verificationTaskId,
      };
      const { eventId, outboxId } = await this.record(
        connection,
        input,
        "opportunity.decision.changed",
        input.opportunityId,
        {
          action: input.action,
          reason: input.reason,
          previous_status: row.decision_status,
          resulting_status: status,
          version,
          verification_task_id: verificationTaskId,
        },
        now,
        nativeOpportunity,
      );
      if (accountMode)
        await connection.query(
          "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES " +
            "('opportunity_decisions',?,?,?),('tasks',?,?,?),('task_events',?,?,?),('opportunity_events',?,?,?),('opportunity_outbox',?,?,?)",
          [decisionId, verificationTaskId, taskEventId, eventId, outboxId].flatMap((id) => [
            id,
            input.actorId,
            row.ownership_reason,
          ]),
        );
      await connection.query(
        "INSERT INTO opportunity_operations (id,actor_id,route,idempotency_key,resource_id," +
          "result_json,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomUUID(),
          input.actorId,
          input.route,
          input.idempotencyKey,
          input.opportunityId,
          JSON.stringify(result),
          now,
        ],
      );
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  async batch(input: OpportunityWriteContext & { value: any; route: string }) {
    const previous = await this.operation<any>(input);
    if (previous) return previous;
    if (input.value.action === "assign")
      await this.ensureMember(input.organizationId, input.workspaceId, input.value.assignee_id);
    const connection = await this.pool.getConnection(),
      now = new Date(),
      results: Array<{ id: string; version: number; task_id?: string }> = [];
    try {
      await connection.beginTransaction();
      for (const item of input.value.items) {
        const [rows] = await connection.query<RowDataPacket[]>(
            "SELECT id,name,version,lifecycle_status FROM opportunities WHERE id=? AND organization_id=? " +
              "AND workspace_id=? FOR UPDATE",
            [item.id, input.organizationId, input.workspaceId],
          ),
          row = rows[0];
        if (!row)
          throw new OpportunityServiceError(
            "opportunity_not_found",
            404,
            "刷新机会列表后重试批量操作。",
          );
        if (Number(row.version) !== item.expected_version)
          throw new OpportunityServiceError(
            "opportunity_version_conflict",
            409,
            "部分机会版本已变化，刷新影响范围后重试。",
          );
        const version = Number(row.version) + 1,
          lifecycle =
            input.value.action === "archive"
              ? "archived"
              : input.value.action === "review"
                ? "validating"
                : String(row.lifecycle_status);
        await connection.query(
          "UPDATE opportunities SET owner_id=IF(?='assign',?,owner_id)," +
            "lifecycle_entered_at=IF(lifecycle_status<>?,?,lifecycle_entered_at)," +
            "lifecycle_status=?,version=?,updated_at=? WHERE id=?",
          [
            input.value.action,
            input.value.assignee_id,
            lifecycle,
            now,
            lifecycle,
            version,
            now,
            item.id,
          ],
        );
        let taskId: string | undefined;
        if (input.value.action === "review") {
          taskId = randomUUID();
          const dueAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
          await connection.query(
            "INSERT IGNORE INTO tasks (id,organization_id,workspace_id,title,description,status," +
              "priority,assignee_id,source_type,source_ref_id,collection_task_id,due_at,completed_at," +
              "created_by,version,created_at,updated_at) VALUES (?,?,?,?,?,'todo','high',?," +
              "'selection_verification',?,NULL,?,NULL,?,1,?,?)",
            [
              taskId,
              input.organizationId,
              input.workspaceId,
              `复核机会 · ${String(row.name).slice(0, 170)}`,
              `批量复核机会 ${item.id}；原因：${input.value.reason}`.slice(0, 5000),
              input.actorId,
              item.id,
              dueAt,
              input.actorId,
              now,
              now,
            ],
          );
          const [tasks] = await connection.query<RowDataPacket[]>(
            "SELECT id FROM tasks WHERE organization_id=? AND workspace_id=? AND " +
              "source_type='selection_verification' AND source_ref_id=? LIMIT 1",
            [input.organizationId, input.workspaceId, item.id],
          );
          if (!tasks[0]) throw new Error("opportunity_review_task_not_created");
          taskId = String(tasks[0].id);
        }
        await this.record(
          connection,
          input,
          `opportunity.batch.${input.value.action}`,
          item.id,
          {
            reason: input.value.reason,
            previous_lifecycle_status: row.lifecycle_status,
            lifecycle_status: lifecycle,
            owner_id: input.value.action === "assign" ? input.value.assignee_id : null,
            task_id: taskId ?? null,
            version,
          },
          now,
        );
        results.push({ id: item.id, version, ...(taskId ? { task_id: taskId } : {}) });
      }
      const result = { action: input.value.action, affected_count: results.length, items: results };
      await connection.query(
        "INSERT INTO opportunity_operations (id,actor_id,route,idempotency_key,resource_id," +
          "result_json,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomUUID(),
          input.actorId,
          input.route,
          input.idempotencyKey,
          input.value.items[0].id,
          JSON.stringify(result),
          now,
        ],
      );
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  async createEvidenceTask(
    input: OpportunityWriteContext & {
      opportunityId: string;
      expectedVersion: number;
      route: string;
    },
  ) {
    const previous = await this.operation<any>(input);
    if (previous) return previous;
    const connection = await this.pool.getConnection(),
      now = new Date();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT id,name,version,recommendation_status,coverage_status FROM opportunities " +
            "WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
          [input.opportunityId, input.organizationId, input.workspaceId],
        ),
        row = rows[0];
      if (!row) throw new OpportunityServiceError("opportunity_not_found", 404, "刷新机会列表。");
      if (Number(row.version) !== input.expectedVersion)
        throw new OpportunityServiceError(
          "opportunity_version_conflict",
          409,
          "刷新机会详情后重试。",
        );
      if (
        row.recommendation_status !== "insufficient_data" &&
        row.coverage_status !== "insufficient"
      )
        throw new OpportunityServiceError(
          "opportunity_evidence_task_not_required",
          409,
          "当前机会数据已满足基础要求，无需创建补数任务。",
        );
      const [existing] = await connection.query<RowDataPacket[]>(
        "SELECT id,status FROM tasks WHERE organization_id=? AND workspace_id=? AND " +
          "source_type='evidence_completion' AND source_ref_id=? AND deleted_at IS NULL LIMIT 1",
        [input.organizationId, input.workspaceId, input.opportunityId],
      );
      const taskId = existing[0] ? String(existing[0].id) : randomUUID(),
        created = !existing[0];
      if (created) {
        await connection.query(
          "INSERT INTO tasks (id,organization_id,workspace_id,title,description,status,priority," +
            "assignee_id,source_type,source_ref_id,collection_task_id,due_at,completed_at,created_by," +
            "version,created_at,updated_at) VALUES (?,?,?,?,?,'todo','high',?,'evidence_completion'," +
            "?,NULL,NULL,NULL,?,1,?,?)",
          [
            taskId,
            input.organizationId,
            input.workspaceId,
            `补齐机会数据 · ${String(row.name).slice(0, 170)}`,
            `补齐机会 ${input.opportunityId} 的评分缺失项、来源证据与新鲜度；完成后系统自动重新评分。`,
            input.actorId,
            input.opportunityId,
            input.actorId,
            now,
            now,
          ],
        );
        await connection.query(
          "INSERT INTO task_events (id,task_id,event_type,actor_id," +
            "payload_json,request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?)",
          [
            randomUUID(),
            taskId,
            "task.created",
            input.actorId,
            JSON.stringify({
              source_type: "evidence_completion",
              opportunity_id: input.opportunityId,
              auto_score_on_complete: true,
            }),
            input.requestId,
            input.traceId,
            now,
          ],
        );
        await this.record(
          connection,
          input,
          "opportunity.evidence_completion_task.created",
          input.opportunityId,
          { task_id: taskId, auto_score_on_complete: true },
          now,
        );
      }
      const result = { task_id: taskId, created, status: existing[0]?.status ?? "todo" };
      await connection.query(
        "INSERT INTO opportunity_operations (id,actor_id,route,idempotency_key,resource_id," +
          "result_json,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomUUID(),
          input.actorId,
          input.route,
          input.idempotencyKey,
          input.opportunityId,
          JSON.stringify(result),
          now,
        ],
      );
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  async createOperatingFeedback(
    input: Parameters<OpportunityRepository["createOperatingFeedback"]>[0],
  ) {
    const previous = await this.operation<OpportunityOperatingFeedback>(input);
    if (previous) return previous;
    const connection = await this.pool.getConnection(),
      now = new Date(),
      factId = randomUUID();
    try {
      await connection.beginTransaction();
      const [[opportunities], [profits], [quotes]] = await Promise.all([
          connection.query<RowDataPacket[]>(
            "SELECT id,version,decision_status,score_rule_version FROM opportunities " +
              "WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1 FOR UPDATE",
            [input.opportunityId, input.organizationId, input.workspaceId],
          ),
          connection.query<RowDataPacket[]>(
            "SELECT rule_version_code,net_profit,currency FROM opportunity_profit_runs " +
              "WHERE opportunity_id=? AND EXISTS (SELECT 1 FROM opportunities p " +
              "WHERE p.id=opportunity_profit_runs.opportunity_id AND p.organization_id=? AND p.workspace_id=?) " +
              "ORDER BY calculated_at DESC,id DESC LIMIT 1",
            [input.opportunityId, input.organizationId, input.workspaceId],
          ),
          connection.query<RowDataPacket[]>(
            "SELECT q.lead_time_days FROM sourcing_searches s " +
              "JOIN sourcing_candidates c ON c.search_id=s.id " +
              "JOIN supplier_quotes q ON q.candidate_id=c.id AND q.is_current=1 " +
              "WHERE s.input_type='opportunity' AND s.input_ref=? AND s.organization_id=? " +
              "AND s.workspace_id=? AND s.deleted_at IS NULL " +
              "ORDER BY q.created_at DESC,q.id DESC LIMIT 1",
            [input.opportunityId, input.organizationId, input.workspaceId],
          ),
        ]),
        opportunity = opportunities[0],
        profit = profits[0],
        quote = quotes[0];
      if (!opportunity)
        throw new OpportunityServiceError("opportunity_not_found", 404, "刷新机会列表后重试。");
      if (Number(opportunity.version) !== input.value.expected_version)
        throw new OpportunityServiceError(
          "opportunity_version_conflict",
          409,
          "刷新机会详情后重新提交复盘事实。",
        );
      await connection.query(
        "INSERT INTO opportunity_operating_facts " +
          "(id,opportunity_id,period_start,period_end,sales_units," +
          "revenue_amount,ad_spend_amount,returned_units,purchase_lead_time_days," +
          "actual_profit_amount,currency,source_ref,notes,score_rule_version_snapshot," +
          "profit_rule_version_snapshot,decision_status_snapshot,predicted_profit_amount," +
          "predicted_currency,quoted_lead_time_days,observed_at,request_id,trace_id,created_by," +
          "created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          factId,
          input.opportunityId,
          input.value.period_start,
          input.value.period_end,
          input.value.sales_units,
          input.value.revenue_amount,
          input.value.ad_spend_amount,
          input.value.returned_units,
          input.value.purchase_lead_time_days,
          input.value.actual_profit_amount,
          input.value.currency,
          input.value.source_ref,
          input.value.notes ?? null,
          opportunity.score_rule_version ?? null,
          profit?.rule_version_code ?? null,
          opportunity.decision_status,
          profit?.net_profit ?? null,
          profit?.currency ?? null,
          quote?.lead_time_days ?? null,
          new Date(input.value.observed_at),
          input.requestId,
          input.traceId,
          input.actorId,
          now,
        ],
      );
      await this.record(
        connection,
        input,
        "opportunity.operating_feedback.recorded",
        input.opportunityId,
        {
          fact_id: factId,
          period_start: input.value.period_start,
          period_end: input.value.period_end,
          score_rule_version: opportunity.score_rule_version ?? null,
          profit_rule_version: profit?.rule_version_code ?? null,
          human_review_required: true,
          automatic_rule_update: false,
          automatic_decision: false,
        },
        now,
      );
      const result = await this.operatingFeedback(input, connection);
      await connection.query(
        "INSERT INTO opportunity_operations (id,actor_id,route,idempotency_key,resource_id," +
          "result_json,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          randomUUID(),
          input.actorId,
          input.route,
          input.idempotencyKey,
          input.opportunityId,
          JSON.stringify(result),
          now,
        ],
      );
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  private async ensureMember(organizationId: string, workspaceId: string, userId: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT m.id FROM memberships m JOIN users u ON u.id=m.user_id " +
        "LEFT JOIN membership_data_scopes s ON s.membership_id=m.id WHERE m.organization_id=? " +
        "AND m.user_id=? AND m.status='active' AND u.status='active' AND " +
        "(s.scope_type='organization' OR (s.scope_type='workspace' AND s.workspace_id=?)) LIMIT 1",
      [organizationId, userId, workspaceId],
    );
    if (!rows[0])
      throw new OpportunityServiceError(
        "opportunity_owner_scope_invalid",
        409,
        "选择可访问当前工作区的活动成员。",
      );
  }
  private async operation<T>(
    input: Pick<OpportunityWriteContext, "actorId" | "idempotencyKey"> & { route: string },
    connection: Pick<Pool, "query"> = this.pool,
  ) {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT result_json FROM opportunity_operations WHERE actor_id=? AND route=? AND idempotency_key=? LIMIT 1" +
        (connection === this.pool ? "" : " FOR UPDATE"),
      [input.actorId, input.route, input.idempotencyKey],
    );
    return rows[0] ? parse<T>(rows[0].result_json) : null;
  }
  private async getIn(
    connection: PoolConnection,
    id: string,
    organizationId: string,
    workspaceId: string,
  ) {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM opportunities WHERE id=? AND organization_id=? AND workspace_id=? LIMIT 1",
      [id, organizationId, workspaceId],
    );
    return rows[0] ? summary(rows[0]) : null;
  }
  private async record(
    connection: PoolConnection,
    input: OpportunityWriteContext,
    eventType: string,
    resourceId: string,
    payload: unknown,
    now: Date,
    native = false,
  ) {
    const eventId = randomUUID(),
      outboxId = randomUUID();
    if (native) {
      await appendAccountOpportunityEvent(connection, {
        id: eventId,
        outboxId,
        opportunityId: resourceId,
        actorType: "user",
        actorId: input.actorId,
        eventType,
        requestId: input.requestId,
        traceId: input.traceId,
        payloadJson: JSON.stringify(payload),
        now,
      });
      return { eventId, outboxId };
    }
    await appendOpportunityEvent(connection, {
      id: eventId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      eventType,
      resourceType: "opportunity",
      resourceId,
      actorType: "user",
      actorId: input.actorId,
      requestId: input.requestId,
      traceId: input.traceId,
      payloadJson: JSON.stringify(payload),
      occurredAt: now,
    });
    await appendOpportunityOutbox(connection, {
      id: outboxId,
      eventId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      eventType,
      resourceType: "opportunity",
      resourceId,
      payloadJson: JSON.stringify(payload),
      createdAt: now,
      requestId: input.requestId,
      traceId: input.traceId,
    });
    return { eventId, outboxId };
  }
}
