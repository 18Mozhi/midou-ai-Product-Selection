import {
  selectionPrimaryAsinSql,
  currentProductVersionJoinSql,
  competitorDetailEvidenceSql,
  latestCompetitorDetailSnapshotSql,
} from "@scoutops/database";
import { selectPrimaryObservation } from "@scoutops/provider-sources";
import { normalizedProductFields } from "./automatic-selection-evaluation.js";
import { nativeOpportunityStorage } from "./opportunity-storage.js";

/** Both rows remain atomic facts with their original evidence/time. */
export const primaryProductEvidence = <T extends Record<string, unknown>>(
  linked?: T,
  detail?: T,
): T | undefined => {
  const observation = (row: T | undefined) => {
    if (!row) return undefined;
    let payload: unknown;
    try {
      payload =
        typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json;
    } catch {
      payload = {};
    }
    const fields = normalizedProductFields(payload);
    return {
      value: row,
      observedAt: row.observed_at,
      price: fields.price,
      currency: fields.currency,
    };
  };
  return selectPrimaryObservation(observation(linked), observation(detail));
};

/** Search from actual primary facts, never an editable opportunity label. */
export const automaticPrimaryTitleSql =
  "(SELECT JSON_UNQUOTE(JSON_EXTRACT(n_title.payload_json,'$.title')) " +
  "FROM opportunity_evidence_links l_title " +
  currentProductVersionJoinSql("l_title", "n_title") +
  "JOIN providers p_title ON p_title.id=n_title.provider_id AND p_title.code='amazon_product' " +
  "WHERE l_title.opportunity_id=o.id AND n_title_seed.organization_id=o.organization_id " +
  "AND n_title_seed.workspace_id=o.workspace_id " +
  "AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_title.payload_json,'$.asin')))=BINARY o.primary_asin " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(n_title.payload_json,'$.canonical_url')) REGEXP " +
  "CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',JSON_UNQUOTE(JSON_EXTRACT(n_title.payload_json,'$.asin')),'([/?#]|$)') " +
  "AND JSON_TYPE(JSON_EXTRACT(n_title.payload_json,'$.title'))='STRING' " +
  "AND LENGTH(TRIM(JSON_UNQUOTE(JSON_EXTRACT(n_title.payload_json,'$.title'))))>0 " +
  "ORDER BY n_title.created_at DESC,n_title.id DESC LIMIT 1)";

/** Correlated to materialized opportunity alias o with its resolved primary_asin. */
export const automaticPrimaryImageSql =
  "COALESCE((SELECT JSON_UNQUOTE(JSON_EXTRACT(n_image.payload_json,'$.image_url')) " +
  "FROM opportunity_evidence_links l_image " +
  currentProductVersionJoinSql("l_image", "n_image") +
  "JOIN providers p_image ON p_image.id=n_image.provider_id AND p_image.code='amazon_product' " +
  "WHERE l_image.opportunity_id=o.id AND n_image_seed.organization_id=o.organization_id " +
  "AND n_image_seed.workspace_id=o.workspace_id " +
  "AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_image.payload_json,'$.asin')))=BINARY o.primary_asin " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(n_image.payload_json,'$.image_url')) REGEXP " +
  "'^https://(m[.]media-amazon[.]com|images-na[.]ssl-images-amazon[.]com)/' " +
  "ORDER BY n_image.created_at DESC,n_image.id DESC LIMIT 1)," +
  // Main-product detail snapshots are projected independently of trend evidence links.
  // Read their original normalized evidence, never a different competitor's image.
  "(SELECT JSON_UNQUOTE(JSON_EXTRACT(n_detail.payload_json,'$.image_url')) " +
  "FROM competitors c_detail JOIN competitor_snapshots s_detail " +
  "ON s_detail.competitor_id=c_detail.id " +
  "JOIN normalized_records n_detail ON n_detail.raw_evidence_id=s_detail.evidence_id " +
  "AND n_detail.organization_id=c_detail.organization_id AND n_detail.workspace_id=c_detail.workspace_id " +
  "AND n_detail.status='active' " +
  "JOIN providers p_detail ON p_detail.id=n_detail.provider_id AND p_detail.code='amazon_product' " +
  "WHERE c_detail.opportunity_id=o.id AND c_detail.organization_id=o.organization_id " +
  "AND c_detail.workspace_id=o.workspace_id AND c_detail.deleted_at IS NULL " +
  "AND BINARY UPPER(c_detail.external_id)=BINARY o.primary_asin " +
  "AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_detail.payload_json,'$.asin')))=BINARY o.primary_asin " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(n_detail.payload_json,'$.image_url')) REGEXP " +
  "'^https://(m[.]media-amazon[.]com|images-na[.]ssl-images-amazon[.]com)/' " +
  "ORDER BY s_detail.captured_at DESC,s_detail.id DESC,n_detail.created_at DESC,n_detail.id DESC LIMIT 1))";

/** Resolve the same primary used by the catalogue, rather than the latest linked competitor. */
export const automaticPrimaryEvidenceSql =
  "SELECT n.raw_evidence_id,n.created_at observed_at,n.payload_json,p.status provider_status " +
  // LIMIT prevents MySQL 5.7 from merging this scoped identity into every history row.
  "FROM (SELECT o.id,o.organization_id,o.workspace_id," +
  selectionPrimaryAsinSql +
  " primary_asin " +
  "FROM opportunities o WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? LIMIT 1) o " +
  "JOIN opportunity_evidence_links l ON l.opportunity_id=o.id " +
  currentProductVersionJoinSql("l", "n") +
  "JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' " +
  "WHERE n_seed.organization_id=o.organization_id AND n_seed.workspace_id=o.workspace_id " +
  "AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.asin')))=BINARY o.primary_asin " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.canonical_url')) REGEXP " +
  "CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.asin')),'([/?#]|$)') " +
  "ORDER BY l.observed_at DESC,n.created_at DESC,n.id DESC LIMIT 1";

/** Detail projections do not create trend links; resolve their original primary evidence separately. */
export const automaticPrimaryDetailEvidenceSql =
  "SELECT n.raw_evidence_id,s.captured_at observed_at,n.payload_json,p.status provider_status " +
  "FROM opportunities o JOIN competitors c ON c.opportunity_id=o.id " +
  "AND c.organization_id=o.organization_id AND c.workspace_id=o.workspace_id " +
  "AND c.status='active' AND c.deleted_at IS NULL AND c.source_site='Amazon' " +
  "JOIN competitor_snapshots s ON s.competitor_id=c.id " +
  "JOIN normalized_records n ON n.raw_evidence_id=s.evidence_id " +
  "AND n.organization_id=c.organization_id AND n.workspace_id=c.workspace_id AND n.status IN ('active','superseded') " +
  "JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' " +
  "WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? " +
  `AND BINARY UPPER(c.external_id)=BINARY ${selectionPrimaryAsinSql} ` +
  "AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.asin')))=BINARY UPPER(c.external_id) " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.canonical_url')) REGEXP " +
  "CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.asin')),'([/?#]|$)') " +
  `AND ${competitorDetailEvidenceSql("s")} ` +
  "ORDER BY s.captured_at DESC,s.id DESC,n.created_at DESC,n.id DESC LIMIT 1";

/** Only records produced by this opportunity's sourcing tasks can establish its purchase cost. */
export const automaticSupplyEvidenceSql =
  "SELECT n.raw_evidence_id,n.payload_json,n.created_at FROM sourcing_searches ss " +
  "JOIN collection_task_evidence_links l ON l.collection_task_id=ss.collection_task_id " +
  "JOIN collection_tasks link_task ON link_task.id=l.collection_task_id " +
  "AND link_task.organization_id=ss.organization_id AND link_task.workspace_id=ss.workspace_id " +
  "JOIN normalized_records n ON n.id=l.normalized_record_id AND n.raw_evidence_id=l.raw_evidence_id " +
  "AND n.organization_id=link_task.organization_id AND n.workspace_id=link_task.workspace_id " +
  "JOIN providers p ON p.id=n.provider_id " +
  "WHERE ss.input_type='opportunity' AND ss.input_ref=? AND ss.organization_id=? AND ss.workspace_id=? " +
  "AND ss.deleted_at IS NULL AND n.status='active' AND p.code='1688_search' " +
  "ORDER BY n.created_at DESC,n.id DESC LIMIT 500";

// A completed account calculation must prove every input independently of the
// old workspace. Keep the same ordering, limit and dedicated sourcing contract.
const supplyOwns = (table: string, id: string) =>
  `EXISTS (SELECT 1 FROM account_owned_records a WHERE a.source_table='${table}' AND a.source_id=${id} AND a.account_id=owner.account_id)`;

// For a point read, traverse the selected opportunity's exact evidence IDs,
// not a materialized account-wide semi-join over the ownership ledger.
const primaryLedgerJoins = (link: string, record: string) => [
  [`${link}_own_link`, "opportunity_evidence_links", `${link}.id`],
  [`${record}_own_seed`, "normalized_records", `${record}_seed.id`],
  [`${record}_own_current`, "normalized_records", `${record}.id`],
  [`${record}_own_seed_raw`, "raw_evidence", `${record}_origin.id`],
  [`${record}_own_current_raw`, "raw_evidence", `${record}_current.id`],
  [`${record}_own_seed_task`, "collection_tasks", `${record}_origin_task.id`],
  [`${record}_own_current_task`, "collection_tasks", `${record}_current_task.id`],
].map(([alias, table, id]) =>
  `STRAIGHT_JOIN account_owned_records ${alias} FORCE INDEX (PRIMARY) ON ${alias}.source_table='${table}' AND ${alias}.source_id=${id} AND ${alias}.account_id=${record}_seed.account_id `,
).join("");

// Preserve the original record family until explicit version lineage replaces the old storage key.
const ownedPrimaryFacts = (link: string, record: string, from: "FROM" | "JOIN" = "FROM", native = false, accountOnly = false, nativeTask = false) =>
  `${from} opportunity_evidence_links ${link}${nativeTask ? " FORCE INDEX (uq_opportunity_evidence)" : ""}${from === "JOIN" ? ` ON ${link}.opportunity_id=o.id` : ""} ` +
  (native
    ? `JOIN normalized_records ${record}_seed${accountOnly ? " FORCE INDEX (idx_normalized_evidence)" : ""} ON ${record}_seed.raw_evidence_id=${link}.raw_evidence_id ` +
      `AND ${record}_seed.status IN ('active','superseded') ` +
      `JOIN normalized_records ${record}${accountOnly ? " FORCE INDEX (uq_normalized_account_record_version)" : ""} ON ${record}.account_id=${record}_seed.account_id ` +
      `AND ${record}.provider_id=${record}_seed.provider_id AND ${record}.record_key=${record}_seed.record_key ` +
      `AND ${record}.status='active' AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(${record}.payload_json,'$.asin')))=` +
      `BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(${record}_seed.payload_json,'$.asin'))) ` +
      `JOIN raw_evidence ${record}_origin${accountOnly ? " FORCE INDEX (PRIMARY)" : ""} ON ${record}_origin.id=${record}_seed.raw_evidence_id AND ${record}_origin.provider_id=${record}_seed.provider_id ` +
      `JOIN raw_evidence ${record}_current${accountOnly ? " FORCE INDEX (PRIMARY)" : ""} ON ${record}_current.id=${record}.raw_evidence_id AND ${record}_current.provider_id=${record}.provider_id ` +
      `JOIN collection_tasks ${record}_origin_task ON ${record}_origin_task.id=${record}_origin.collection_task_id ` +
      `JOIN collection_tasks ${record}_current_task ON ${record}_current_task.id=${record}_current.collection_task_id ` +
      (accountOnly
        ? ""
        : `AND ${record}_current_task.organization_id=${record}_origin_task.organization_id AND ${record}_current_task.workspace_id=${record}_origin_task.workspace_id `)
    : currentProductVersionJoinSql(link, record)) +
  `JOIN providers p_${record} ON p_${record}.id=${record}.provider_id AND p_${record}.code='amazon_product' ` +
  (nativeTask ? primaryLedgerJoins(link, record) : "") +
  `WHERE ${link}.opportunity_id=o.id AND ` +
  (native
    ? `${record}_seed.account_id=owner.account_id AND ` + (accountOnly
      ? `${record}_origin.account_id=owner.account_id AND ${record}_current.account_id=owner.account_id AND ` +
        (nativeTask ? `${record}_origin_task.account_id=owner.account_id AND ${record}_current_task.account_id=owner.account_id AND ` : "") +
        (nativeTask ? "" :
          [supplyOwns("collection_tasks", `${record}_origin_task.id`), supplyOwns("collection_tasks", `${record}_current_task.id`)].join(" AND ") + " AND ")
      : `${record}_origin_task.organization_id=o.organization_id AND ${record}_origin_task.workspace_id=o.workspace_id AND `)
    : `${record}_seed.organization_id=o.organization_id AND ${record}_seed.workspace_id=o.workspace_id AND `) +
  (nativeTask ? "" : [supplyOwns("opportunity_evidence_links", `${link}.id`),
    ...[record, `${record}_seed`].flatMap(alias => [
      supplyOwns("normalized_records", `${alias}.id`), supplyOwns("raw_evidence", `${alias}.raw_evidence_id`),
    ])].join(" AND ") + " AND ") +
  [record, `${record}_seed`].map(alias =>
    `JSON_UNQUOTE(JSON_EXTRACT(${alias}.payload_json,'$.canonical_url')) REGEXP ` +
    `CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',JSON_UNQUOTE(JSON_EXTRACT(${alias}.payload_json,'$.asin')),'([/?#]|$)')`
  ).join(" AND ");
const ownedPrimaryAsin = (native: boolean, accountOnly = false) =>
  "(SELECT " + (accountOnly ? "STRAIGHT_JOIN " : "") +
  "UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_first_seed.payload_json,'$.asin'))) " +
  ownedPrimaryFacts("l_first", "n_first", "FROM", native, accountOnly) +
  " AND JSON_UNQUOTE(JSON_EXTRACT(n_first_seed.payload_json,'$.asin')) REGEXP '^[A-Za-z0-9]{10}$' " +
  "ORDER BY l_first.created_at,n_first_seed.created_at DESC LIMIT 1)";
export const sealedPrimaryRefreshAsinSql = ownedPrimaryAsin(true, true);
const accountPrimarySql = (native: boolean) =>
  "SELECT n.raw_evidence_id,n.created_at observed_at,n.payload_json,p_n.status provider_status " +
  "FROM opportunities o JOIN account_owned_records owner ON owner.source_table='opportunities' " +
  "AND owner.source_id=o.id AND o.id=? AND owner.account_id=? " +
  ownedPrimaryFacts("l", "n", "JOIN", native) +
  " AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.asin')))=BINARY " + ownedPrimaryAsin(native) +
  (native ? "" : " AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.asin')))=BINARY " + selectionPrimaryAsinSql) +
  " ORDER BY l.observed_at DESC,n.created_at DESC,n.id DESC LIMIT 1";
export const accountAutomaticPrimaryEvidenceSql = accountPrimarySql(false);
export const nativeAccountAutomaticPrimaryEvidenceSql = accountPrimarySql(true);
// LIMIT makes the one-row identity non-mergeable in MySQL 5.7. Pick it
// once, in the same statement snapshot as the latest matching evidence.
const pinnedAccountPrimaryIdentity =
  "SELECT STRAIGHT_JOIN o.id,owner.account_id,UPPER(JSON_UNQUOTE(JSON_EXTRACT(n_first_seed.payload_json,'$.asin'))) primary_asin " +
  "FROM opportunities o JOIN account_owned_records owner ON owner.source_table='opportunities' " +
  "AND owner.source_id=o.id AND o.id=? AND owner.account_id=? AND o.account_id=owner.account_id " +
  "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
  "AND (owner.reason='exclusive_owner' OR (owner.reason IN ('shared','unassigned') AND owner.account_id=cut.primary_account_id)) " +
  ownedPrimaryFacts("l_first", "n_first", "JOIN", true, true, true) +
  " AND JSON_UNQUOTE(JSON_EXTRACT(n_first_seed.payload_json,'$.asin')) REGEXP '^[A-Za-z0-9]{10}$' " +
  "ORDER BY l_first.created_at,n_first_seed.created_at DESC LIMIT 1";
export const accountOnlyAutomaticPrimaryEvidenceSql =
  "SELECT STRAIGHT_JOIN n.raw_evidence_id,n.created_at observed_at,n.payload_json,p_n.status provider_status " +
  `FROM (${pinnedAccountPrimaryIdentity}) o JOIN account_owned_records owner ON owner.source_table='opportunities' ` +
  "AND owner.source_id=o.id AND owner.account_id=o.account_id " +
  ownedPrimaryFacts("l", "n", "JOIN", true, true, true) +
  " AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.asin')))=BINARY o.primary_asin " +
  "ORDER BY l.observed_at DESC,n.created_at DESC,n.id DESC LIMIT 1";

export async function hasNativeNormalizedAccountScope(db: Pick<import("mysql2/promise").PoolConnection, "query">) {
  const [columns] = await db.query<import("mysql2/promise").RowDataPacket[]>(
    "SHOW COLUMNS FROM normalized_records WHERE Field IN ('account_id','organization_id','workspace_id')",
  );
  const shape = columns.map(row => row.Field).sort().join(",");
  if (shape !== "account_id" && shape !== "organization_id,workspace_id")
    throw new Error("normalized_record_scope_schema_invalid");
  return shape === "account_id";
}

export async function readAutomaticPrimaryEvidence(
  db: Pick<import("mysql2/promise").PoolConnection, "query">,
  scope: { opportunityId: string; organizationId: string; workspaceId: string; accountId?: string },
) {
  type Row = import("mysql2/promise").RowDataPacket;
  if (!scope.accountId) {
    const args = [scope.opportunityId, scope.organizationId, scope.workspaceId];
    const [[linked], [detail]] = await Promise.all([
      db.query<Row[]>(automaticPrimaryEvidenceSql, args),
      db.query<Row[]>(automaticPrimaryDetailEvidenceSql, args),
    ]);
    return { linked: linked[0], detail: detail[0] };
  }
  const native = await hasNativeNormalizedAccountScope(db);
  const accountParent = native && await nativeOpportunityStorage(db);
  const [[linked]] = await db.query<Row[]>(accountParent ? accountOnlyAutomaticPrimaryEvidenceSql :
    native ? nativeAccountAutomaticPrimaryEvidenceSql : accountAutomaticPrimaryEvidenceSql,
    [scope.opportunityId, scope.accountId]);
  const detailQuery = accountPrimaryDetailQuery(scope.opportunityId, scope.accountId, linked?.payload_json, accountParent);
  if (!detailQuery) return { linked, detail: undefined };
  const [[detail]] = await db.query<Row[]>(detailQuery.sql, detailQuery.params);
  return { linked, detail };
}
export const accountAutomaticSupplyEvidenceSql =
  "SELECT n.raw_evidence_id,n.payload_json,n.created_at FROM sourcing_searches ss " +
  "JOIN account_owned_records owner ON owner.source_table='opportunities' AND owner.source_id=ss.input_ref " +
  "JOIN collection_task_evidence_links l ON l.collection_task_id=ss.collection_task_id " +
  "JOIN collection_tasks link_task ON link_task.id=l.collection_task_id " +
  "JOIN normalized_records n ON n.id=l.normalized_record_id AND n.raw_evidence_id=l.raw_evidence_id AND n.provider_id=l.provider_id " +
  "JOIN raw_evidence r ON r.id=n.raw_evidence_id AND r.provider_id=n.provider_id " +
  "JOIN providers p ON p.id=n.provider_id " +
  "WHERE ss.input_type='opportunity' AND ss.input_ref=? AND owner.account_id=? " +
  "AND ss.deleted_at IS NULL AND n.status='active' AND p.code='1688_search' AND " +
  [supplyOwns("sourcing_searches", "ss.id"), supplyOwns("collection_task_evidence_links", "l.id"),
    supplyOwns("collection_tasks", "link_task.id"), supplyOwns("normalized_records", "n.id"),
    supplyOwns("raw_evidence", "n.raw_evidence_id")].join(" AND ") +
  " ORDER BY n.created_at DESC,n.id DESC LIMIT 500 LOCK IN SHARE MODE";

/** Same actual primary detail prerequisite for model preflight and the authoritative evaluation transaction. */
export const automaticPrimarySnapshotSql =
  `SELECT s.* FROM competitors c JOIN competitor_snapshots s ON s.id=${latestCompetitorDetailSnapshotSql("c")} ` +
  "WHERE c.opportunity_id=? AND c.organization_id=? AND c.workspace_id=? AND c.status='active' " +
  "AND c.source_site='Amazon' AND c.external_id=? AND c.deleted_at IS NULL " +
  "ORDER BY s.captured_at DESC,s.id DESC LIMIT 1";

// The persisted snapshot identifies its original task and normalized record.
// Do not substitute another same-ASIN capture or accept a sibling subquery.
const accountPrimarySnapshotParentSql =
  "FROM competitors c JOIN account_owned_records owner " +
  "ON owner.source_table='opportunities' AND owner.source_id=c.opportunity_id " +
  "JOIN competitor_snapshots s ON s.competitor_id=c.id ";
export const accountPrimarySnapshotProofSql =
  [supplyOwns("competitors", "c.id"), supplyOwns("competitor_snapshots", "s.id")].join(" AND ") +
  " AND EXISTS (SELECT 1 FROM collection_subqueries q JOIN collection_tasks t ON t.id=q.task_id " +
  "JOIN collection_task_evidence_links l ON l.collection_subquery_id=q.id AND l.collection_task_id=t.id AND l.provider_id=q.provider_id " +
  "JOIN normalized_records n ON n.id=l.normalized_record_id AND n.raw_evidence_id=l.raw_evidence_id " +
  "AND n.provider_id=l.provider_id AND n.status IN ('active','superseded') " +
  "JOIN raw_evidence r ON r.id=n.raw_evidence_id AND r.provider_id=n.provider_id " +
  "WHERE LEFT(s.source_ref_id,11)='collection:' AND q.task_id=CONVERT(SUBSTRING(s.source_ref_id,12,36) USING ascii) " +
  "AND l.raw_evidence_id=s.evidence_id AND n.id=CONVERT(RIGHT(s.source_ref_id,36) USING ascii) " +
  "AND q.provider_id=c.provider_id " +
  "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.competitor_id'))=BINARY c.id " +
  "AND BINARY UPPER(JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.asin')))=BINARY UPPER(c.external_id) " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.projection_type'))='competitor_snapshot' " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(q.target_json,'$.page_url')) REGEXP '^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/[A-Za-z0-9]{10}([/?#]|$)' AND " +
  [supplyOwns("collection_tasks", "t.id"), supplyOwns("collection_subqueries", "q.id"),
    supplyOwns("collection_task_evidence_links", "l.id"), supplyOwns("normalized_records", "n.id"),
    supplyOwns("raw_evidence", "r.id")].join(" AND ") + ") ";

export const accountAutomaticPrimarySnapshotSql =
  "SELECT s.* " + accountPrimarySnapshotParentSql +
  "WHERE c.opportunity_id=? AND owner.account_id=? AND c.status='active' " +
  "AND c.source_site='Amazon' AND c.external_id=? AND c.deleted_at IS NULL AND " +
  accountPrimarySnapshotProofSql + "ORDER BY s.captured_at DESC,s.id DESC LIMIT 1";

/** Bind the ASIN already proved by linked primary evidence, not an editable label. */
const accountAutomaticPrimaryDetailEvidenceSql =
  "SELECT n.raw_evidence_id,s.captured_at observed_at,n.payload_json,p.status provider_status " +
  accountPrimarySnapshotParentSql +
  "JOIN normalized_records n ON n.id=CONVERT(RIGHT(s.source_ref_id,36) USING ascii) AND n.raw_evidence_id=s.evidence_id " +
  "JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' " +
  "WHERE c.opportunity_id=? AND owner.account_id=? AND c.status='active' " +
  "AND c.source_site='Amazon' AND c.deleted_at IS NULL AND BINARY UPPER(c.external_id)=BINARY ? " +
  "AND JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.canonical_url')) REGEXP " +
  "CONCAT('^https://www[.]amazon[.]com/([^?#]*/)?(dp|gp/product)/',JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.asin')),'([/?#]|$)') AND " +
  accountPrimarySnapshotProofSql + "ORDER BY s.captured_at DESC,s.id DESC,n.created_at DESC,n.id DESC LIMIT 1";

const accountOnlyAutomaticPrimaryDetailEvidenceSql = accountAutomaticPrimaryDetailEvidenceSql
  .replace("JOIN competitor_snapshots s", "JOIN opportunities o ON o.id=c.opportunity_id AND o.account_id=owner.account_id " +
    "AND c.account_id=owner.account_id JOIN competitor_snapshots s")
  .replace("WHERE c.opportunity_id=?", "WHERE n.account_id=owner.account_id AND c.opportunity_id=?")
  .replace("WHERE LEFT(s.source_ref_id,11)", "WHERE t.account_id=owner.account_id AND n.account_id=owner.account_id " +
    "AND r.account_id=owner.account_id AND LEFT(s.source_ref_id,11)");

export function accountPrimaryDetailQuery(opportunityId: string, accountId: string, linkedPayload: unknown, accountParent = false) {
  try {
    const value = typeof linkedPayload === "string" ? JSON.parse(linkedPayload) : linkedPayload;
    const asin = normalizedProductFields(value).asin;
    return typeof asin === "string" && /^[A-Za-z0-9]{10}$/.test(asin)
      ? { sql: accountParent ? accountOnlyAutomaticPrimaryDetailEvidenceSql : accountAutomaticPrimaryDetailEvidenceSql,
        params: [opportunityId, accountId, asin.toUpperCase()] }
      : null;
  } catch {
    return null;
  }
}
