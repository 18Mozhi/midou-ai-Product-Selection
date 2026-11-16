import { appendCollectionSubquery, collectionTaskScope } from "@scoutops/database";
import { randomUUID } from "node:crypto";
import {
  appendSourcingEvent,
  appendSourcingOutbox,
  sourcingSearchHasLegacyScope,
} from "@scoutops/database";
import { sourcingSkuFacts } from "./sourcing-sku-facts.js";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  SourcingServiceError,
  type SourcingContext,
  type SourcingPageRead,
  type SourcingReadScope,
  type SourcingRepository,
} from "./sourcing-service.js";
import { loadErpSourcingReference } from "./erp-sourcing-reference.js";
import { rehearsalOwns, requireAccountReadRehearsal } from "./account-read-rehearsal.js";
const parse = <T>(v: unknown): T => (typeof v === "string" ? JSON.parse(v) : (v as T)),
  iso = (v: unknown) => (v instanceof Date ? v : new Date(String(v))).toISOString();
const quoteParentJoin =
  "JOIN sourcing_candidates qc ON qc.id=q.candidate_id JOIN sourcing_searches qs ON qs.id=qc.search_id";
const ownsQuoteEvidence = (account: "co.account_id" | "qo.account_id", native: boolean) =>
  `EXISTS (SELECT 1 FROM raw_evidence qe WHERE qe.id=q.evidence_id
    ${native ? `AND qe.account_id=${account}` : ""}
    AND ${rehearsalOwns("raw_evidence", "qe.id", account)})`;
const ownsWritableQuoteSearch = (
  search: "s" | "qs",
  account: "co.account_id" | "qo.account_id",
  nativeTask: boolean,
) =>
  `EXISTS (SELECT 1 FROM collection_tasks quote_task WHERE quote_task.id=${search}.collection_task_id
    ${nativeTask ? `AND quote_task.account_id=${account}` : ""}
    AND ${rehearsalOwns("collection_tasks", "quote_task.id", account)})
   AND (${search}.input_type<>'opportunity'
     OR ${rehearsalOwns("opportunities", `CONVERT(${search}.input_ref USING ascii)`, account)})`;
const ownsQuoteParents = (native: boolean, nativeTask: boolean) =>
  `${rehearsalOwns("sourcing_candidates", "qc.id", "qo.account_id")}
   AND ${rehearsalOwns("sourcing_searches", "qs.id", "qo.account_id")}
   AND ${ownsWritableQuoteSearch("qs", "qo.account_id", nativeTask)}
   AND ${rehearsalOwns("raw_evidence", "qc.raw_evidence_id", "qo.account_id")}
   AND EXISTS (SELECT 1 FROM normalized_records qn JOIN raw_evidence qr ON qr.id=qn.raw_evidence_id
     AND qr.provider_id=qn.provider_id
     WHERE qn.id=qc.normalized_record_id AND qn.raw_evidence_id=qc.raw_evidence_id
       AND qn.provider_id=qc.provider_id
       ${native ? "AND qn.account_id=qo.account_id AND qr.account_id=qo.account_id" : ""}
       AND ${rehearsalOwns("normalized_records", "qn.id", "qo.account_id")})`;
async function quoteEvidenceIsNative(db: Pick<PoolConnection, "query">) {
  const [columns] = await db.query<RowDataPacket[]>(
    "SELECT TABLE_NAME AS table_name,COLUMN_NAME AS column_name FROM information_schema.COLUMNS " +
      "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('raw_evidence','normalized_records') " +
      "AND COLUMN_NAME IN ('account_id','organization_id','workspace_id')",
  );
  const shapes = ["raw_evidence", "normalized_records"].map((table) =>
    columns
      .filter((row) => row.table_name === table)
      .map((row) => row.column_name)
      .sort()
      .join(","),
  );
  if (shapes.every((shape) => shape === "account_id")) return true;
  if (shapes.every((shape) => shape === "organization_id,workspace_id")) return false;
  throw new SourcingServiceError(
    "sourcing_evidence_scope_not_ready",
    503,
    "先完成隔离报价证据迁移。",
  );
}
async function quoteTaskIsNative(db: Pick<PoolConnection, "query">) {
  try {
    return (await collectionTaskScope(db)) === "account";
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_collection_task_scope_schema")
      throw new SourcingServiceError(
        "sourcing_quote_task_scope_not_ready",
        503,
        "先完成隔离采集任务迁移。",
      );
    throw error;
  }
}
async function comparisonUsesQuoteAnchor(connection: Pick<PoolConnection, "query">) {
  const [columns] = await connection.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM sourcing_comparisons WHERE Field IN ('organization_id','workspace_id','anchor_quote_id')",
  );
  const shape = columns
    .map(({ Field }) => Field)
    .sort()
    .join(",");
  if (shape === "anchor_quote_id") return true;
  if (shape === "organization_id,workspace_id") return false;
  throw new Error("partial_inherited_scope_schema:sourcing_comparisons");
}
const amazonEvidenceImageSql = (where: string, accountScoped = false) =>
  "SELECT JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.image_url')) image_url " +
  "FROM opportunity_evidence_links l JOIN opportunities op ON op.id=l.opportunity_id JOIN normalized_records n ON n.raw_evidence_id=l.raw_evidence_id " +
  (accountScoped
    ? "AND EXISTS (SELECT 1 FROM raw_evidence e WHERE e.id=n.raw_evidence_id AND e.provider_id=n.provider_id) "
    : "AND n.organization_id=op.organization_id AND n.workspace_id=op.workspace_id ") +
  "AND n.status='active' " +
  "JOIN providers p ON p.id=n.provider_id AND p.code='amazon_product' " +
  "WHERE " +
  where +
  " AND JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.image_url')) LIKE 'https://%' " +
  "ORDER BY n.created_at DESC,n.id DESC LIMIT 1";
const searchImageSql = (
  opportunityId: "o.id" | "s.image_opportunity_id",
  account?: "so.account_id" | "s.account_owner",
  native = false,
) =>
  "CASE WHEN s.input_type='opportunity' THEN COALESCE(" +
  "(SELECT JSON_UNQUOTE(JSON_EXTRACT(image_query.target_json,'$.image_url')) FROM collection_subqueries image_query " +
  "JOIN providers image_provider ON image_provider.id=image_query.provider_id AND image_provider.code='1688_search' " +
  "JOIN collection_tasks image_task ON image_task.id=image_query.task_id " +
  "WHERE image_query.task_id=s.collection_task_id " +
  (account
    ? `AND ${rehearsalOwns("collection_tasks", "image_task.id", account)} AND ${rehearsalOwns("collection_subqueries", "image_query.id", account)} ${native ? `AND image_task.account_id=${account} ` : ""}`
    : "AND image_task.organization_id=s.organization_id AND image_task.workspace_id=s.workspace_id ") +
  "AND JSON_UNQUOTE(JSON_EXTRACT(image_query.target_json,'$.image_url')) LIKE 'https://%' " +
  "ORDER BY image_query.ordinal LIMIT 1),(" +
  amazonEvidenceImageSql(
    `l.opportunity_id=${opportunityId}` +
      (account
        ? ` AND ${rehearsalOwns("opportunities", "op.id", account)} AND ${rehearsalOwns("opportunity_evidence_links", "l.id", account)} AND ${rehearsalOwns("normalized_records", "n.id", account)} AND ${rehearsalOwns("raw_evidence", "l.raw_evidence_id", account)}
            ${native ? `AND op.account_id=${account} AND n.account_id=${account} AND EXISTS
              (SELECT 1 FROM raw_evidence image_evidence WHERE image_evidence.id=l.raw_evidence_id
                 AND image_evidence.provider_id=n.provider_id AND image_evidence.account_id=${account})` : ""}`
        : " AND op.organization_id=s.organization_id AND op.workspace_id=s.workspace_id"),
    Boolean(account),
  ) +
  ")) END image_url";
const ownedSearchSource =
  " FROM sourcing_searches s JOIN account_owned_records so ON so.source_table='sourcing_searches' AND so.source_id=s.id ";
const ownedSearchFields =
  "s.id,s.input_type,s.input_ref,s.collection_task_id,s.status,s.missing_fields_json,s.created_at,s.updated_at";
const ownedCandidateCount = `(SELECT COUNT(*) FROM sourcing_candidates sc_count WHERE sc_count.search_id=s.id
  AND ${rehearsalOwns("sourcing_candidates", "sc_count.id", "so.account_id")}
  AND ${rehearsalOwns("raw_evidence", "sc_count.raw_evidence_id", "so.account_id")})`;
const opportunityIdPattern = "^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$";
const ownedSourcingSource = (search: "s" | "target", native: boolean) =>
  `(${search}.input_type<>'opportunity'
    OR (${rehearsalOwns("opportunities", `CONVERT(${search}.input_ref USING ascii)`, "so.account_id")}
        ${native ? `AND EXISTS (SELECT 1 FROM opportunities original_opportunity
          WHERE original_opportunity.id=CONVERT(${search}.input_ref USING ascii)
            AND original_opportunity.account_id=so.account_id)` : ""})
    OR (${search}.input_ref NOT REGEXP '${opportunityIdPattern}'
      AND EXISTS (SELECT 1 FROM collection_tasks history_task
        WHERE history_task.id=${search}.collection_task_id
          AND BINARY history_task.request_id=BINARY ${search}.request_id
          AND BINARY history_task.trace_id=BINARY ${search}.trace_id)
      AND NOT EXISTS (SELECT 1 FROM sourcing_candidates history_candidate WHERE history_candidate.search_id=${search}.id)))`;
const ownedSearchTask = (search: "s" | "target", native: boolean) =>
  rehearsalOwns("collection_tasks", `${search}.collection_task_id`, "so.account_id") +
  (native ? ` AND EXISTS (SELECT 1 FROM collection_tasks original_task
    WHERE original_task.id=${search}.collection_task_id AND original_task.account_id=so.account_id)` : "");
const ownedSearchScope = (native: boolean) =>
  `so.account_id=? AND s.deleted_at IS NULL AND ${ownedSearchTask("s", native)}
    AND ${ownedSourcingSource("s", native)}`;
const ownedOpportunityJoin = (native: boolean) =>
  " LEFT JOIN opportunities o ON s.input_type='opportunity' " +
  "AND s.input_ref=CONVERT(o.id USING utf8mb4) COLLATE utf8mb4_unicode_ci AND o.lifecycle_status<>'deleted' " +
  `AND ${rehearsalOwns("opportunities", "o.id", "so.account_id")} ${native ? "AND o.account_id=so.account_id " : ""}`;
export class MySqlSourcingRepository implements SourcingRepository {
  constructor(private readonly pool: Pool, private readonly nativeAccountScope = false) {}
  async list(i: SourcingReadScope) {
    if ("accountId" in i) {
      await requireAccountReadRehearsal(this.pool);
      const [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT ${ownedSearchFields},${ownedCandidateCount} owned_candidate_count,${searchImageSql("o.id", "so.account_id", this.nativeAccountScope)},COALESCE(o.name,s.input_ref) display_name${ownedSearchSource}${ownedOpportunityJoin(this.nativeAccountScope)}WHERE ${ownedSearchScope(this.nativeAccountScope)} ORDER BY s.created_at DESC,s.id DESC`,
        [i.accountId],
      );
      return rows.map((row) => this.search(row));
    }
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT s.*," +
        searchImageSql("o.id") +
        ",CASE WHEN s.input_type='opportunity' THEN COALESCE(o.name,s.input_ref) ELSE " +
        "s.input_ref END display_name FROM sourcing_searches s LEFT JOIN " +
        "(SELECT id,name,organization_id,workspace_id,lifecycle_status,CONVERT(id USING utf8mb4) COLLATE utf8mb4_unicode_ci lookup_ref " +
        "FROM opportunities WHERE organization_id=? AND workspace_id=? LIMIT 18446744073709551615) o ON s.input_type='opportunity' " +
        "AND s.input_ref=o.lookup_ref AND o.organization_id=s.organization_id " +
        "AND o.workspace_id=s.workspace_id AND o.lifecycle_status<>'deleted' WHERE s.organization_id=? " +
        "AND s.workspace_id=? AND s.deleted_at IS NULL ORDER BY s.created_at DESC," +
        "s.id DESC",
      [i.organizationId, i.workspaceId, i.organizationId, i.workspaceId],
    );
    return rows.map((r) => this.search(r));
  }
  async listPage(i: SourcingPageRead) {
    const account = "accountId" in i;
    if (account) await requireAccountReadRehearsal(this.pool);
    const name =
      "CASE WHEN s.input_type='opportunity' THEN COALESCE(NULLIF(o.name,''),s.input_ref) ELSE s.input_ref END";
    const displayName =
      "CASE WHEN s.input_type='opportunity' THEN COALESCE(o.name,s.input_ref) ELSE s.input_ref END";
    const join = account
      ? ownedSearchSource + ownedOpportunityJoin(this.nativeAccountScope)
      : " FROM sourcing_searches s LEFT JOIN " +
        "(SELECT id,name,organization_id,workspace_id,lifecycle_status,CONVERT(id USING utf8mb4) COLLATE utf8mb4_unicode_ci lookup_ref " +
        "FROM opportunities WHERE organization_id=? AND workspace_id=? LIMIT 18446744073709551615) o " +
        "ON s.input_type='opportunity' AND s.input_ref=o.lookup_ref AND o.organization_id=s.organization_id " +
        "AND o.workspace_id=s.workspace_id AND o.lifecycle_status<>'deleted' ";
    const scope = account
      ? ownedSearchScope(this.nativeAccountScope)
      : "s.organization_id=? AND s.workspace_id=? AND s.deleted_at IS NULL";
    const pattern =
      "%" + i.query.toLowerCase().replace(/[=%_]/g, (value: string) => "=" + value) + "%";
    const filter =
      scope +
      (i.query
        ? ` AND BINARY LOWER(CONCAT(${name},' ',s.input_ref,' ',s.status)) LIKE BINARY ? ESCAPE '='`
        : "");
    const baseParams = account ? [i.accountId] : [i.organizationId, i.workspaceId];
    const joinParams = account ? [] : [i.organizationId, i.workspaceId];
    const source = account ? ownedSearchSource : " FROM sourcing_searches s ";
    const values = [...joinParams, ...baseParams, ...(i.query ? [pattern] : [])];
    const [[totals], [summaries]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        i.query
          ? "SELECT COUNT(*) total" + join + "WHERE " + filter
          : "SELECT COUNT(*) total" + source + "WHERE " + scope,
        i.query ? values : baseParams,
      ),
      this.pool.query<RowDataPacket[]>(
        account
          ? "SELECT COUNT(*) total,COALESCE(SUM(s.status IN ('queued','running')),0) running," +
              `COALESCE(SUM(${ownedCandidateCount}),0) candidates,COALESCE(SUM(${ownedCandidateCount}>0),0) ready` +
              source +
              "WHERE " +
              scope
          : "SELECT COUNT(*) total,COALESCE(SUM(status IN ('queued','running')),0) running," +
              "COALESCE(SUM(candidate_count),0) candidates,COALESCE(SUM(candidate_count>0),0) ready FROM sourcing_searches " +
              "WHERE organization_id=? AND workspace_id=? AND deleted_at IS NULL",
        baseParams,
      ),
    ]);
    const total = Number(totals[0]?.total ?? 0),
      lastPage = Math.max(1, Math.ceil(total / i.pageSize));
    let page = Math.min(i.page, lastPage);
    if (i.locateRecord && total) {
      const [positions] = await this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) preceding_count" +
          join +
          "JOIN sourcing_searches target ON target.id=? " +
          (account
            ? `AND target.deleted_at IS NULL AND ${rehearsalOwns("sourcing_searches", "target.id", "so.account_id")} AND ${ownedSearchTask("target", this.nativeAccountScope)} AND ${ownedSourcingSource("target", this.nativeAccountScope)} `
            : "AND target.organization_id=s.organization_id AND target.workspace_id=s.workspace_id AND target.deleted_at IS NULL ") +
          "WHERE " +
          filter +
          " AND (s.created_at>target.created_at OR (s.created_at=target.created_at AND s.id>target.id))",
        [...joinParams, i.locateRecord, ...values.slice(joinParams.length)],
      );
      page = Math.min(
        Math.floor(Number(positions[0]?.preceding_count ?? 0) / i.pageSize) + 1,
        lastPage,
      );
    }
    const [rows] = total
      ? await this.pool.query<RowDataPacket[]>(
          "SELECT s.*," +
            searchImageSql("s.image_opportunity_id", account ? "s.account_owner" : undefined, this.nativeAccountScope) +
            ` FROM (SELECT ${account ? ownedSearchFields : "s.*"},o.id image_opportunity_id,` +
            (account
              ? `so.account_id account_owner,${ownedCandidateCount} owned_candidate_count,`
              : "") +
            displayName +
            " display_name" +
            join +
            "WHERE " +
            filter +
            " ORDER BY s.created_at DESC,s.id DESC LIMIT ? OFFSET ?) s ORDER BY s.created_at DESC,s.id DESC",
          [...values, i.pageSize, (page - 1) * i.pageSize],
        )
      : [[]];
    const summary = summaries[0] ?? ({} as RowDataPacket);
    return {
      items: rows.map((row) => this.search(row)),
      meta: {
        page,
        page_size: i.pageSize,
        total,
        summary: {
          total: Number(summary.total ?? 0),
          running: Number(summary.running ?? 0),
          candidates: Number(summary.candidates ?? 0),
          ready: Number(summary.ready ?? 0),
        },
      },
    };
  }
  async detail(i: SourcingReadScope & { searchId: string }) {
    const account = "accountId" in i;
    if (account) await requireAccountReadRehearsal(this.pool);
    const [searches] = account
      ? await this.pool.query<RowDataPacket[]>(
          `SELECT ${ownedSearchFields},${ownedCandidateCount} owned_candidate_count,${searchImageSql("o.id", "so.account_id", this.nativeAccountScope)},COALESCE(o.name,s.input_ref) display_name${ownedSearchSource}${ownedOpportunityJoin(this.nativeAccountScope)}WHERE s.id=? AND ${ownedSearchScope(this.nativeAccountScope)}`,
          [i.searchId, i.accountId],
        )
      : await this.pool.query<RowDataPacket[]>(
          "SELECT s.*," +
            searchImageSql("o.id") +
            ",CASE WHEN s.input_type='opportunity' THEN COALESCE(o.name,s.input_ref) ELSE " +
            "s.input_ref END display_name FROM sourcing_searches s LEFT JOIN opportunities o ON s.input_type='opportunity' " +
            "AND s.input_ref=CONVERT(o.id USING utf8mb4) COLLATE utf8mb4_unicode_ci AND o.organization_id=s.organization_id " +
            "AND o.workspace_id=s.workspace_id AND o.lifecycle_status<>'deleted' WHERE s.id=? AND " +
            "s.organization_id=? AND s.workspace_id=? AND s.deleted_at IS NULL",
          [i.searchId, i.organizationId, i.workspaceId],
        );
    if (!searches[0])
      throw new SourcingServiceError("sourcing_search_not_found", 404, "刷新找货列表。");
    const scopeValues = account ? [i.accountId] : [i.organizationId, i.workspaceId];
    const nativeEvidence = account && (await quoteEvidenceIsNative(this.pool));
    const legacyScopeFilter = account ? "" : " AND cs.organization_id=? AND cs.workspace_id=?";
    const quoteOwner = account
      ? `AND ${rehearsalOwns("supplier_quotes", "q.id", "co.account_id")}
         AND ${ownsQuoteEvidence("co.account_id", nativeEvidence)}
         ${
           nativeEvidence
             ? `AND EXISTS (SELECT 1 FROM normalized_records qn
           JOIN raw_evidence qr ON qr.id=qn.raw_evidence_id AND qr.provider_id=qn.provider_id
           WHERE qn.id=c.normalized_record_id AND qr.id=c.raw_evidence_id AND qn.provider_id=c.provider_id
             AND qn.account_id=co.account_id AND qr.account_id=co.account_id
             AND ${rehearsalOwns("normalized_records", "qn.id", "co.account_id")})`
             : ""
         } `
      : "";
    const offerOwner = account
      ? `AND ${rehearsalOwns("normalized_records", "n_offer.id", "co.account_id")} ${nativeEvidence ? "AND n_offer.account_id=co.account_id" : ""} `
      : "";
    const candidateOwner = account
      ? ` AND co.account_id=? AND ${rehearsalOwns("sourcing_searches", "cs.id", "co.account_id")}
         AND ${rehearsalOwns("raw_evidence", "c.raw_evidence_id", "co.account_id")}`
      : "";
    const subqueryOwner = account
      ? ` AND ${rehearsalOwns("collection_subqueries", "s.id", "towner.account_id")}`
      : "";
    const [[candidates], [progressRows]] = await Promise.all([
        this.pool.query<RowDataPacket[]>(
          "SELECT c.*,q.id quote_id,q.quote_version,q.specification quote_specification," +
            "q.moq quote_moq,q.quoted_price quote_price,q.currency quote_currency," +
            "q.lead_time_days quote_lead_time_days,q.location quote_location,q.confidence_value quote_confidence," +
            "q.observed_at quote_observed_at,q.evidence_id quote_evidence_id,q.stability_status,q.risk_level," +
            "n_offer.payload_json source_offer_payload " +
            "FROM sourcing_candidates c JOIN sourcing_searches cs ON cs.id=c.search_id " +
            (account
              ? "JOIN account_owned_records co ON co.source_table='sourcing_candidates' AND co.source_id=c.id "
              : "") +
            "LEFT JOIN supplier_quotes q ON q.candidate_id=c.id AND q.is_current=1 " +
            quoteOwner +
            "LEFT JOIN normalized_records n_offer ON n_offer.id=c.normalized_record_id " +
            "AND n_offer.raw_evidence_id=c.raw_evidence_id AND n_offer.provider_id=c.provider_id " +
            (account
              ? ""
              : "AND n_offer.organization_id=cs.organization_id AND n_offer.workspace_id=cs.workspace_id ") +
            "AND n_offer.status='active' AND EXISTS (SELECT 1 FROM providers p_offer " +
            "WHERE p_offer.id=n_offer.provider_id AND p_offer.code='1688_search') " +
            offerOwner +
            `WHERE c.search_id=? AND cs.deleted_at IS NULL${legacyScopeFilter}${candidateOwner} ORDER BY c.created_at,` +
            "c.id",
          [i.searchId, ...scopeValues],
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT t.status,t.available_at,t.successful_subquery_count,t.failed_subquery_count," +
            `t.blocked_subquery_count,(SELECT COUNT(*) FROM collection_subqueries s WHERE s.task_id=t.id${subqueryOwner}) total_subqueries,` +
            `(SELECT COUNT(*) FROM collection_subqueries s WHERE s.task_id=t.id AND s.status IN ('pending','running')${subqueryOwner}) active_subqueries ` +
            "FROM collection_tasks t " +
            (account
              ? "JOIN account_owned_records towner ON towner.source_table='collection_tasks' AND towner.source_id=t.id "
              : "") +
            "WHERE t.id=?" +
            (account
              ? " AND towner.account_id=?"
              : " AND t.organization_id=? AND t.workspace_id=?") +
            " LIMIT 1",
          [String(searches[0].collection_task_id), ...scopeValues],
        ),
      ]),
      erpReference =
        searches[0].input_type === "opportunity" &&
        (!account || new RegExp(opportunityIdPattern).test(String(searches[0].input_ref)))
          ? await loadErpSourcingReference(this.pool, {
              ...(account
                ? { accountId: i.accountId }
                : { organizationId: i.organizationId, workspaceId: i.workspaceId }),
              opportunityId: String(searches[0].input_ref),
            })
          : null;
    return {
      ...this.search(searches[0]),
      collection_task_id: String(searches[0].collection_task_id),
      collection_progress: progressRows[0]
        ? {
            status: String(progressRows[0].status),
            total_subqueries: Number(progressRows[0].total_subqueries),
            successful_subqueries: Number(progressRows[0].successful_subquery_count),
            failed_subqueries: Number(progressRows[0].failed_subquery_count),
            blocked_subqueries: Number(progressRows[0].blocked_subquery_count),
            active_subqueries: Number(progressRows[0].active_subqueries),
            available_at: iso(progressRows[0].available_at),
          }
        : null,
      candidates: candidates.map((r) => this.candidate(r)),
      erp_reference: erpReference,
    };
  }
  async listComparisons(i: SourcingReadScope) {
    const account = "accountId" in i;
    if (account) await requireAccountReadRehearsal(this.pool);
    const anchored = !account && (await comparisonUsesQuoteAnchor(this.pool));
    const [rows] = await this.pool.query<RowDataPacket[]>(
      account
        ? "SELECT c.* FROM sourcing_comparisons c JOIN account_owned_records co ON co.source_table='sourcing_comparisons' AND co.source_id=c.id WHERE co.account_id=? ORDER BY c.created_at DESC"
        : anchored
          ? `SELECT c.* FROM sourcing_comparisons c JOIN supplier_quotes q ON q.id=c.anchor_quote_id
             ${quoteParentJoin} WHERE qs.organization_id=? AND qs.workspace_id=? ORDER BY c.created_at DESC`
          : "SELECT * FROM sourcing_comparisons WHERE organization_id=? AND workspace_id=? ORDER BY created_at DESC",
      account ? [i.accountId] : [i.organizationId, i.workspaceId],
    );
    const ids = [...new Set(rows.flatMap((row) => parse<string[]>(row.quote_ids_json)))];
    const nativeEvidence = account && ids.length > 0 && (await quoteEvidenceIsNative(this.pool));
    const nativeTask = account && ids.length > 0 && (await quoteTaskIsNative(this.pool));
    const [quotes] = ids.length
      ? await this.pool.query<RowDataPacket[]>(
          account
            ? `SELECT q.* FROM supplier_quotes q ${quoteParentJoin}
               JOIN account_owned_records qo ON qo.source_table='supplier_quotes' AND qo.source_id=q.id
               WHERE qo.account_id=? AND q.id IN (?) AND ${ownsQuoteEvidence("qo.account_id", nativeEvidence)}
               AND ${ownsQuoteParents(nativeEvidence, nativeTask)}`
            : `SELECT q.* FROM supplier_quotes q ${quoteParentJoin}
               WHERE qs.organization_id=? AND qs.workspace_id=? AND q.id IN (?)`,
          account ? [i.accountId, ids] : [i.organizationId, i.workspaceId, ids],
        )
      : [[]];
    const byId = new Map(quotes.map((q) => [String(q.id).toLowerCase(), q]));
    return rows.map((row) => {
      const ids = parse<string[]>(row.quote_ids_json);
      const selected = new Set(ids);
      return {
        id: String(row.id),
        name: String(row.name),
        quotes: (account
          ? ids.flatMap((id) => {
              const q = byId.get(id.toLowerCase());
              return q ? [q] : [];
            })
          : quotes.filter((q) => selected.has(String(q.id)))
        ).map((q) => this.quote(q)),
        created_at: iso(row.created_at),
      };
    });
  }

  async createSearch(i: any) {
    const accountMode = i.accountOwnedSearch === true;
    const old = accountMode ? null : await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      let taskId = i.value.collection_task_id as string | null,
        jobId: string | null = null,
        query = String(i.value.input_ref);
      let organizationId = i.organizationId,
        workspaceId = i.workspaceId;
      let legacySearchScope = true;
      if (accountMode) {
        await requireAccountReadRehearsal(c, { lockForTransaction: true });
        if (!taskId)
          throw new SourcingServiceError(
            "sourcing_collection_task_required",
            409,
            "选择本账号已完成的供应商采集任务。",
          );
        legacySearchScope = await sourcingSearchHasLegacyScope(c);
        const nativeTask = await quoteTaskIsNative(c);
        if (legacySearchScope && nativeTask)
          throw new SourcingServiceError(
            "sourcing_search_task_scope_mixed",
            503,
            "先核对找货与采集任务的迁移结构。",
          );
        const [[task]] = await c.query<RowDataPacket[]>(
          `SELECT ${legacySearchScope ? "t.organization_id,t.workspace_id" : "t.id"} FROM collection_tasks t
           JOIN account_owned_records own ON own.source_table='collection_tasks' AND own.source_id=t.id
           WHERE t.id=? AND own.account_id=? AND t.status IN ('succeeded','succeeded_empty','completed_with_warnings')
             ${nativeTask ? "AND t.account_id=own.account_id" : ""}
             AND NOT EXISTS (SELECT 1 FROM sourcing_searches history
               WHERE history.collection_task_id=t.id AND history.input_type='opportunity'
                 AND history.input_ref NOT REGEXP '${opportunityIdPattern}'
                 AND BINARY history.request_id=BINARY t.request_id AND BINARY history.trace_id=BINARY t.trace_id
                 AND NOT EXISTS (SELECT 1 FROM sourcing_candidates hc WHERE hc.search_id=history.id))
             AND EXISTS (SELECT 1 FROM collection_subqueries sq JOIN providers p ON p.id=sq.provider_id
               WHERE sq.task_id=t.id AND p.code='1688_search'
                 AND ${rehearsalOwns("collection_subqueries", "sq.id", "own.account_id")}) FOR UPDATE`,
          [taskId, i.actorId],
        );
        if (!task)
          throw new SourcingServiceError(
            "sourcing_collection_task_not_ready",
            409,
            "选择本账号已完成的供应商采集任务。",
          );
        if (i.value.input_type === "opportunity") {
          const [[parent]] = await c.query<RowDataPacket[]>(
            "SELECT o.id FROM opportunities o JOIN account_owned_records own ON own.source_table='opportunities' " +
              "AND own.source_id=o.id WHERE o.id=? AND own.account_id=? AND o.lifecycle_status<>'deleted' FOR UPDATE",
            [i.value.input_ref, i.actorId],
          );
          if (!parent)
            throw new SourcingServiceError("opportunity_not_found", 404, "选择本账号选品。");
        }
        // Required by the current legacy search schema only; never use these coordinates to authorize the request.
        if (legacySearchScope)
          ({ organization_id: organizationId, workspace_id: workspaceId } = task);
        const previous = await this.operation<{ id: string }>(i, c);
        if (previous) {
          const [[search]] = await c.query<RowDataPacket[]>(
            "SELECT s.id FROM sourcing_searches s JOIN account_owned_records own ON own.source_table='sourcing_searches' " +
              "AND own.source_id=s.id WHERE s.id=? AND own.account_id=? AND s.collection_task_id=? " +
              "AND s.input_type=? AND BINARY s.input_ref=BINARY ? AND s.deleted_at IS NULL FOR UPDATE",
            [previous.id, i.actorId, taskId, i.value.input_type, i.value.input_ref],
          );
          if (!search)
            throw new SourcingServiceError(
              "sourcing_search_replay_mismatch",
              409,
              "使用新的幂等键。",
            );
          await c.commit();
          return previous;
        }
      }
      if (taskId && !accountMode) {
        const [tasks] = await c.query<RowDataPacket[]>(
          "SELECT id,status FROM collection_tasks WHERE id=? AND organization_id=? AND workspace_id=? " +
            "AND status IN ('succeeded','succeeded_empty','completed_with_warnings') FOR UPDATE",
          [taskId, i.organizationId, i.workspaceId],
        );
        if (!tasks[0])
          throw new SourcingServiceError(
            "sourcing_collection_task_not_ready",
            409,
            "选择当前工作区已完成的供应链采集任务。",
          );
      } else if (!taskId) {
        taskId = i.taskId;
        if (i.value.input_type === "opportunity") {
          const [opportunities] = await c.query<RowDataPacket[]>(
            "SELECT name FROM opportunities WHERE id=? AND organization_id=? AND workspace_id=?",
            [i.value.input_ref, i.organizationId, i.workspaceId],
          );
          if (!opportunities[0])
            throw new SourcingServiceError("opportunity_not_found", 404, "选择当前工作区机会。");
          query = String(opportunities[0].name);
        }
        const imageUrl = await this.searchImage(c, i.value.input_type, i.value.input_ref, i);
        const providers = await this.supplierProviders(c, Boolean(imageUrl));
        if (!providers.length)
          throw new SourcingServiceError(
            "supplier_crawler_unavailable",
            409,
            "公开供应商爬虫尚未启用，请联系平台管理员检查来源状态。",
          );
        await this.enqueueCollection(
          c,
          i,
          providers,
          {
            query,
            ...(imageUrl ? { image_url: imageUrl } : {}),
            projection_type: "sourcing_search",
            search_id: i.id,
          },
          now,
        );
      }
      await c.query(
        `INSERT INTO sourcing_searches (id,${legacySearchScope ? "organization_id,workspace_id," : ""}collection_task_id,` +
          "input_type,input_ref,status,candidate_count,missing_fields_json,request_id," +
          `trace_id,created_by,created_at,updated_at,deleted_at) VALUES (?,${legacySearchScope ? "?,?," : ""}?,?,` +
          "?,'queued',0,'[]',?,?,?,?,?,NULL)",
        [
          i.id,
          ...(legacySearchScope ? [organizationId, workspaceId] : []),
          taskId,
          i.value.input_type,
          i.value.input_ref,
          i.requestId,
          i.traceId,
          i.actorId,
          now,
          now,
        ],
      );
      if (i.value.collection_task_id) {
        jobId = randomUUID();
        await c.query(
          "INSERT INTO sourcing_projection_jobs (id,search_id," +
            "status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES " +
            "(?,?,'queued',0,?,?,?,?,?)",
          [jobId, i.id, now, i.requestId, i.traceId, now, now],
        );
      }
      const result = { id: i.id, status: "queued", task_id: taskId, job_id: jobId };
      if (accountMode)
        await c.query(
          "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ?",
          [
            [
              ["sourcing_searches", i.id, i.actorId, "exclusive_owner"],
              ["sourcing_projection_jobs", jobId, i.actorId, "exclusive_owner"],
            ],
          ],
        );
      await this.record(
        c,
        i,
        "sourcing.search.queued",
        i.id,
        result,
        now,
        accountMode ? "exclusive_owner" : undefined,
      );
      await this.save(c, i, i.id, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async confirmQuote(command: any) {
    const accountMode = command.accountOwnedQuote === true;
    if (!accountMode) {
      const old = await this.operation(command);
      if (old) return old;
    }
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      if (accountMode) await requireAccountReadRehearsal(c, { lockForTransaction: true });
      const nativeEvidence = accountMode && (await quoteEvidenceIsNative(c));
      const nativeTask = accountMode && (await quoteTaskIsNative(c));
      const [rows] = await c.query<RowDataPacket[]>(
        accountMode
          ? `SELECT c.*,co.reason ownership_reason FROM sourcing_candidates c
             JOIN account_owned_records co ON co.source_table='sourcing_candidates' AND co.source_id=c.id
             JOIN sourcing_searches s ON s.id=c.search_id AND s.deleted_at IS NULL
             JOIN normalized_records n ON n.id=c.normalized_record_id AND n.raw_evidence_id=c.raw_evidence_id
               AND n.provider_id=c.provider_id
             WHERE c.id=? AND co.account_id=?
               AND ${rehearsalOwns("sourcing_searches", "s.id", "co.account_id")}
               AND ${ownsWritableQuoteSearch("s", "co.account_id", nativeTask)}
               AND ${rehearsalOwns("normalized_records", "n.id", "co.account_id")}
               AND ${rehearsalOwns("raw_evidence", "c.raw_evidence_id", "co.account_id")}
               ${nativeEvidence ? "AND n.account_id=co.account_id AND EXISTS (SELECT 1 FROM raw_evidence re WHERE re.id=c.raw_evidence_id AND re.provider_id=c.provider_id AND re.account_id=co.account_id)" : ""}
             FOR UPDATE`
          : "SELECT c.* FROM sourcing_candidates c JOIN sourcing_searches s ON s.id=c.search_id WHERE c.id=? AND s.organization_id=? AND s.workspace_id=? FOR UPDATE",
        accountMode
          ? [command.value.candidate_id, command.actorId]
          : [command.value.candidate_id, command.organizationId, command.workspaceId],
      );
      const r = rows[0];
      if (!r) throw new SourcingServiceError("sourcing_candidate_not_found", 404, "刷新候选列表。");
      const i = command;
      if (accountMode) {
        const [[evidence]] = await c.query<RowDataPacket[]>(
          "SELECT e.id FROM raw_evidence e JOIN account_owned_records eo ON eo.source_table='raw_evidence' " +
            "AND eo.source_id=e.id WHERE e.id=? AND eo.account_id=?" +
            (nativeEvidence ? " AND e.account_id=eo.account_id" : "") +
            " FOR UPDATE",
          [i.value.evidence_id, i.actorId],
        );
        if (!evidence)
          throw new SourcingServiceError(
            "sourcing_quote_evidence_not_found",
            404,
            "选择同账号范围内的证据。",
          );
        const previous = await this.operation<{ id: string }>(i, c);
        if (previous) {
          const [[quote]] = await c.query<RowDataPacket[]>(
            `SELECT q.id FROM supplier_quotes q ${quoteParentJoin} JOIN account_owned_records qo
               ON qo.source_table='supplier_quotes' AND qo.source_id=q.id
             WHERE q.id=? AND q.candidate_id=?
               AND qo.account_id=? AND ${ownsQuoteEvidence("qo.account_id", nativeEvidence)} FOR UPDATE`,
            [previous.id, r.id, i.actorId],
          );
          if (!quote) throw new SourcingServiceError("sourcing_quote_not_found", 404, "刷新报价。");
          await c.commit();
          return previous;
        }
        if (r.quoted_price == null || !r.currency)
          throw new SourcingServiceError(
            "sourcing_quote_source_incomplete",
            409,
            "候选缺少原始报价或币种。",
          );
        const [current] = await c.query<RowDataPacket[]>(
          "SELECT qo.account_id FROM supplier_quotes q " +
            "LEFT JOIN account_owned_records qo ON qo.source_table='supplier_quotes' AND qo.source_id=q.id " +
            "WHERE q.candidate_id=? AND q.is_current=1 FOR UPDATE",
          [r.id],
        );
        if (current.some((q) => q.account_id !== i.actorId))
          throw new SourcingServiceError(
            "sourcing_quote_ownership_conflict",
            409,
            "现行报价归属不一致。",
          );
      }
      const [versions] = await c.query<RowDataPacket[]>(
          "SELECT COALESCE(MAX(quote_version),0)+1 version FROM supplier_quotes WHERE candidate_id=?",
          [r.id],
        ),
        version = Number(versions[0]?.version ?? 1);
      await c.query(
        "UPDATE supplier_quotes SET is_current=0 WHERE candidate_id=? AND is_current=1",
        [r.id],
      );
      await c.query(
        "INSERT INTO supplier_quotes (id,candidate_id," +
          "quote_version,is_current,supplier_name,product_title,specification,moq,quoted_price," +
          "currency,lead_time_days,location,original_url,observed_at,evidence_id,confidence_value," +
          "stability_status,risk_level,confirmed_by,request_id,trace_id,created_at) VALUES (?," +
          "?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          i.id,
          r.id,
          version,
          r.supplier_name,
          r.product_title,
          i.value.specification,
          i.value.moq,
          r.quoted_price,
          r.currency,
          i.value.lead_time_days,
          i.value.location,
          r.original_url,
          i.value.observed_at,
          i.value.evidence_id,
          i.value.confidence_value,
          i.value.stability_status,
          i.value.risk_level,
          i.actorId,
          i.requestId,
          i.traceId,
          now,
        ],
      );
      await c.query(
        "UPDATE sourcing_candidates SET specification=?,moq=?,lead_time_days=?,location=?," +
          "confidence_value=?,status='ready',missing_fields_json='[]' WHERE id=?",
        [
          i.value.specification,
          i.value.moq,
          i.value.lead_time_days,
          i.value.location,
          i.value.confidence_value,
          r.id,
        ],
      );
      const result = {
        id: i.id,
        candidate_id: String(r.id),
        quote_version: version,
        status: "confirmed",
      };
      if (accountMode)
        await c.query(
          "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ('supplier_quotes',?,?,?)",
          [i.id, i.actorId, r.ownership_reason],
        );
      await this.record(
        c,
        i,
        "supplier_quote.confirmed",
        i.id,
        result,
        now,
        accountMode ? r.ownership_reason : undefined,
      );
      await this.save(c, i, i.id, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async createComparison(command: any) {
    const accountMode = command.accountOwnedComparison === true;
    if (!accountMode) {
      const old = await this.operation(command);
      if (old) return old;
    }
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      if (accountMode) await requireAccountReadRehearsal(c, { lockForTransaction: true });
      const nativeEvidence = accountMode && (await quoteEvidenceIsNative(c));
      const nativeTask = accountMode && (await quoteTaskIsNative(c));
      const [rows] = await c.query<RowDataPacket[]>(
        accountMode
          ? `SELECT q.id,q.is_current,qo.reason ownership_reason
             FROM supplier_quotes q ${quoteParentJoin} JOIN account_owned_records qo
               ON qo.source_table='supplier_quotes' AND qo.source_id=q.id
             WHERE qo.account_id=? AND q.id IN (?) AND ${ownsQuoteEvidence("qo.account_id", nativeEvidence)}
               AND qs.deleted_at IS NULL AND ${ownsQuoteParents(nativeEvidence, nativeTask)} ORDER BY q.id FOR UPDATE`
          : `SELECT q.id FROM supplier_quotes q ${quoteParentJoin}
             WHERE qs.organization_id=? AND qs.workspace_id=? AND q.is_current=1 AND q.id IN (?)`,
        accountMode
          ? [command.actorId, command.value.quote_ids]
          : [command.organizationId, command.workspaceId, command.value.quote_ids],
      );
      if (rows.length !== command.value.quote_ids.length)
        throw new SourcingServiceError(
          "sourcing_quote_scope_invalid",
          409,
          accountMode ? "只比较本人可访问的报价。" : "只比较当前工作区的现行报价。",
        );
      const anchor = rows.find((q) => String(q.id) === command.value.quote_ids[0]);
      if (accountMode && !anchor)
        throw new SourcingServiceError("sourcing_quote_scope_invalid", 409, "刷新可访问的报价。");
      const i = command;
      if (accountMode) {
        const previous = await this.operation<{ id: string }>(i, c);
        if (previous) {
          const [[saved]] = await c.query<RowDataPacket[]>(
            "SELECT x.name,x.quote_ids_json FROM sourcing_comparisons x JOIN account_owned_records xo " +
              "ON xo.source_table='sourcing_comparisons' AND xo.source_id=x.id " +
              "WHERE x.id=? AND xo.account_id=? FOR UPDATE",
            [previous.id, i.actorId],
          );
          if (!saved)
            throw new SourcingServiceError("sourcing_comparison_not_found", 404, "刷新报价对比。");
          if (
            saved.name !== i.value.name ||
            JSON.stringify(parse<string[]>(saved.quote_ids_json)) !==
              JSON.stringify(i.value.quote_ids)
          )
            throw new SourcingServiceError(
              "sourcing_comparison_replay_conflict",
              409,
              "使用新幂等键保存不同的对比。",
            );
          await c.commit();
          return previous;
        }
        if (rows.some((q) => Number(q.is_current) !== 1))
          throw new SourcingServiceError(
            "sourcing_quote_scope_invalid",
            409,
            "只比较本人现行报价。",
          );
      }
      const anchored = await comparisonUsesQuoteAnchor(c);
      if (accountMode && !anchored)
        throw new SourcingServiceError(
          "account_sourcing_comparison_schema_not_ready",
          503,
          "先在隔离副本应用报价对比迁移。",
        );
      await c.query(
        `INSERT INTO sourcing_comparisons (id,${anchored ? "anchor_quote_id" : "organization_id,workspace_id"},name,quote_ids_json,
          created_by,request_id,trace_id,created_at) VALUES (?,?,${anchored ? "" : "?,"}?,?,?,?,?,?)`,
        [
          i.id,
          ...(anchored ? [i.value.quote_ids[0]] : [i.organizationId, i.workspaceId]),
          i.value.name,
          JSON.stringify(i.value.quote_ids),
          i.actorId,
          i.requestId,
          i.traceId,
          now,
        ],
      );
      const result = { id: i.id, name: i.value.name, quote_count: rows.length };
      if (accountMode)
        await c.query(
          "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ('sourcing_comparisons',?,?,?)",
          [i.id, i.actorId, anchor!.ownership_reason],
        );
      await this.record(
        c,
        i,
        "sourcing.comparison.created",
        i.id,
        result,
        now,
        accountMode ? anchor!.ownership_reason : undefined,
      );
      await this.save(c, i, i.id, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async createPurchaseTask(command: any) {
    const accountMode = command.accountOwnedPurchase === true;
    if (!accountMode) {
      const old = await this.operation(command);
      if (old) return old;
    }
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      if (accountMode) await requireAccountReadRehearsal(c, { lockForTransaction: true });
      const nativeEvidence = accountMode && (await quoteEvidenceIsNative(c));
      const nativeTask = accountMode && (await quoteTaskIsNative(c));
      const [rows] = await c.query<RowDataPacket[]>(
        accountMode
          ? `SELECT q.moq,q.is_current,qo.reason ownership_reason
             FROM supplier_quotes q ${quoteParentJoin} JOIN account_owned_records qo
               ON qo.source_table='supplier_quotes' AND qo.source_id=q.id
             WHERE q.id=? AND qo.account_id=? AND ${ownsQuoteEvidence("qo.account_id", nativeEvidence)}
               AND qs.deleted_at IS NULL AND ${ownsQuoteParents(nativeEvidence, nativeTask)} FOR UPDATE`
          : `SELECT q.moq FROM supplier_quotes q ${quoteParentJoin}
             WHERE q.id=? AND qs.organization_id=? AND qs.workspace_id=? AND q.is_current=1`,
        accountMode
          ? [command.quoteId, command.actorId]
          : [command.quoteId, command.organizationId, command.workspaceId],
      );
      const quote = rows[0];
      if (!quote) throw new SourcingServiceError("supplier_quote_not_found", 404, "刷新报价列表。");
      const i = command;
      if (accountMode) {
        const old = await this.operation<{ id: string }>(i, c);
        if (old) {
          const [[saved]] = await c.query<RowDataPacket[]>(
            "SELECT p.quantity,p.reason FROM sourcing_purchase_tasks p JOIN account_owned_records po " +
              "ON po.source_table='sourcing_purchase_tasks' AND po.source_id=p.id " +
              "WHERE p.id=? AND p.quote_id=? AND po.account_id=? FOR UPDATE",
            [old.id, i.quoteId, i.actorId],
          );
          if (!saved)
            throw new SourcingServiceError(
              "sourcing_purchase_task_not_found",
              404,
              "刷新采购任务。",
            );
          if (Number(saved.quantity) !== i.quantity || saved.reason !== i.reason)
            throw new SourcingServiceError(
              "sourcing_purchase_replay_conflict",
              409,
              "使用新幂等键提交不同的采购任务。",
            );
          await c.commit();
          return old;
        }
        if (Number(quote.is_current) !== 1)
          throw new SourcingServiceError("supplier_quote_not_found", 404, "选择现行报价。");
      }
      if (i.quantity < Number(quote.moq))
        throw new SourcingServiceError(
          "purchase_quantity_below_moq",
          409,
          "采购数量不得低于 MOQ。",
        );
      await c.query(
        "INSERT INTO sourcing_purchase_tasks (id,quote_id," +
          "quantity,reason,status,created_by,request_id,trace_id,created_at,updated_at) VALUES " +
          "(?,?,?,?,'queued',?,?,?,?,?)",
        [i.id, i.quoteId, i.quantity, i.reason, i.actorId, i.requestId, i.traceId, now, now],
      );
      const result = { id: i.id, status: "queued", quote_id: i.quoteId, quantity: i.quantity };
      if (accountMode)
        await c.query(
          "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ('sourcing_purchase_tasks',?,?,?)",
          [i.id, i.actorId, quote.ownership_reason],
        );
      await this.record(
        c,
        i,
        accountMode
          ? "sourcing.purchase_task.account_rehearsal.queued"
          : "sourcing.purchase_task.queued",
        i.id,
        result,
        now,
        accountMode ? quote.ownership_reason : undefined,
      );
      await this.save(c, i, i.id, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async refresh(i: any) {
    const old = await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      const [searches] = await c.query<RowDataPacket[]>(
        "SELECT input_type,input_ref FROM sourcing_searches WHERE id=? AND organization_id=? " +
          "AND workspace_id=? AND deleted_at IS NULL FOR UPDATE",
        [i.searchId, i.organizationId, i.workspaceId],
      );
      if (!searches[0])
        throw new SourcingServiceError("sourcing_search_not_found", 404, "刷新找货列表。");
      let query = String(searches[0].input_ref);
      if (searches[0].input_type === "opportunity") {
        const [opportunities] = await c.query<RowDataPacket[]>(
          "SELECT name FROM opportunities WHERE id=? AND organization_id=? AND workspace_id=?",
          [query, i.organizationId, i.workspaceId],
        );
        if (opportunities[0]) query = String(opportunities[0].name);
      }
      const imageUrl = await this.searchImage(c, searches[0].input_type, searches[0].input_ref, i);
      const providers = await this.supplierProviders(c, Boolean(imageUrl));
      if (!providers.length)
        throw new SourcingServiceError(
          "supplier_crawler_unavailable",
          409,
          "公开供应商爬虫尚未启用。",
        );
      await this.enqueueCollection(
        c,
        i,
        providers,
        {
          query,
          ...(imageUrl ? { image_url: imageUrl } : {}),
          projection_type: "sourcing_search",
          search_id: i.searchId,
        },
        now,
      );
      await c.query(
        "UPDATE sourcing_searches SET collection_task_id=?,status='queued',updated_at=? WHERE id=?",
        [i.taskId, now, i.searchId],
      );
      const result = { id: i.searchId, task_id: i.taskId, status: "queued" };
      await this.record(c, i, "sourcing.search.refreshed", i.searchId, result, now);
      await this.save(c, i, i.searchId, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async remove(i: any) {
    const accountMode = i.accountOwnedSearch === true;
    const old = accountMode ? null : await this.operation(i);
    if (old) return old;
    const c = await this.pool.getConnection(),
      now = new Date();
    try {
      await c.beginTransaction();
      if (accountMode) await requireAccountReadRehearsal(c, { lockForTransaction: true });
      const nativeTask = accountMode && (await quoteTaskIsNative(c));
      const [rows] = await c.query<RowDataPacket[]>(
        accountMode
          ? `SELECT s.id,s.deleted_at,own.reason FROM sourcing_searches s
             JOIN account_owned_records own ON own.source_table='sourcing_searches' AND own.source_id=s.id
             WHERE s.id=? AND own.account_id=?
               AND EXISTS (SELECT 1 FROM collection_tasks t WHERE t.id=s.collection_task_id
                 ${nativeTask ? "AND t.account_id=own.account_id" : ""}
                 AND ${rehearsalOwns("collection_tasks", "t.id", "own.account_id")})
               AND (s.input_type<>'opportunity' OR (s.input_ref REGEXP '${opportunityIdPattern}' AND EXISTS (SELECT 1 FROM opportunities o
                 WHERE o.id=CONVERT(s.input_ref USING ascii)
                   AND ${rehearsalOwns("opportunities", "o.id", "own.account_id")}))) FOR UPDATE`
          : "SELECT id FROM sourcing_searches WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL FOR UPDATE",
        accountMode ? [i.searchId, i.actorId] : [i.searchId, i.organizationId, i.workspaceId],
      );
      if (!rows[0])
        throw new SourcingServiceError("sourcing_search_not_found", 404, "刷新找货列表。");
      if (accountMode) {
        const previous = await this.operation<{ id: string; deleted: boolean }>(i, c);
        if (
          previous &&
          previous.id === i.searchId &&
          previous.deleted === true &&
          rows[0].deleted_at
        ) {
          await c.commit();
          return previous;
        }
        if (previous)
          throw new SourcingServiceError(
            "sourcing_search_replay_mismatch",
            409,
            "使用新的幂等键。",
          );
        if (rows[0].deleted_at)
          throw new SourcingServiceError("sourcing_search_not_found", 404, "刷新找货列表。");
      }
      await c.query("UPDATE sourcing_searches SET deleted_at=?,updated_at=? WHERE id=?", [
        now,
        now,
        i.searchId,
      ]);
      const result = { id: i.searchId, deleted: true };
      await this.record(
        c,
        i,
        "sourcing.search.deleted",
        i.searchId,
        { ...result, reason: i.reason },
        now,
        accountMode ? rows[0].reason : undefined,
      );
      await this.save(c, i, i.searchId, result, now);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  private async enqueueCollection(
    c: PoolConnection,
    i: any,
    providerIds: string[],
    target: Record<string, unknown>,
    now: Date,
  ) {
    await c.query(
      "INSERT INTO collection_tasks(id,organization_id,workspace_id,status,coverage_status," +
        "priority,scheduled_at,available_at,attempt_count,successful_subquery_count," +
        "failed_subquery_count,blocked_subquery_count,available_result_count,missing_fields_json," +
        "request_id,trace_id,version,created_by,created_at,updated_at) VALUES(?,?," +
        "?,'scheduled',NULL,'high',?,?,0,0,0,0,0,'[]',?,?,1,?,?,?)",
      [
        i.taskId,
        i.organizationId,
        i.workspaceId,
        now,
        now,
        i.requestId,
        i.traceId,
        i.actorId,
        now,
        now,
      ],
    );
    for (let index = 0; index < providerIds.length; index++)
      await appendCollectionSubquery(c, {
        id: index === 0 ? i.subqueryId : randomUUID(),
        taskId: i.taskId,
        providerId: providerIds[index]!,
        ordinal: index + 1,
        targetJson: JSON.stringify(target),
        required: false,
        status: "pending",
        now,
      });
    await c.query(
      "INSERT INTO collection_task_events(id,task_id," +
        "event_type,from_status,to_status,actor_type,actor_id,request_id,trace_id," +
        "metadata_json,occurred_at) VALUES(?,?,?,NULL,'scheduled','user',?,?," +
        "?,?,?)",
      [
        randomUUID(),
        i.taskId,
        "sourcing.collection.scheduled",
        i.actorId,
        i.requestId,
        i.traceId,
        JSON.stringify({ ...target, source_count: providerIds.length }),
        now,
      ],
    );
  }
  private async searchImage(
    c: PoolConnection,
    inputType: string,
    inputRef: string,
    context: SourcingContext,
  ) {
    if (inputType === "image") return inputRef;
    if (inputType !== "opportunity") return null;
    const [rows] = await c.query<RowDataPacket[]>(
      amazonEvidenceImageSql("l.opportunity_id=? AND op.organization_id=? AND op.workspace_id=?"),
      [inputRef, context.organizationId, context.workspaceId],
    );
    return rows[0]?.image_url ? String(rows[0].image_url) : null;
  }
  private async supplierProviders(c: PoolConnection, imageSearch = false) {
    if (imageSearch) {
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT id FROM providers WHERE code='1688_search' AND status='enabled' LIMIT 1",
      );
      if (rows.length) return [String(rows[0]!.id)];
      throw new SourcingServiceError(
        "supplier_crawler_unavailable",
        409,
        "1688 图搜来源尚未启用，请在采集来源中检查。",
      );
    }
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT id FROM providers WHERE code IN ('dhgate_supplier_search','made_in_china_search','ec21_supplier_search') " +
        "AND status='enabled' AND access_mode='public_page' AND terms_review_status='approved' " +
        "AND terms_version IS NOT NULL AND (terms_permanent=1 OR terms_expires_at>NOW(3)) " +
        "ORDER BY FIELD(code,'dhgate_supplier_search','made_in_china_search','ec21_supplier_search') FOR UPDATE",
    );
    return rows.map((row) => String(row.id));
  }
  private search(r: RowDataPacket) {
    return {
      id: String(r.id),
      input_type: r.input_type,
      input_ref: String(r.input_ref),
      display_name: String(r.display_name ?? r.input_ref),
      image_url: r.image_url == null ? null : String(r.image_url),
      status: r.status,
      candidate_count: Number(r.owned_candidate_count ?? r.candidate_count),
      missing_fields: parse(r.missing_fields_json),
      created_at: iso(r.created_at),
      updated_at: iso(r.updated_at),
    };
  }
  private candidate(r: RowDataPacket) {
    const source = parse<Record<string, unknown>>(r.source_offer_payload ?? {}) ?? {},
      fields =
        source.fields && typeof source.fields === "object" && !Array.isArray(source.fields)
          ? (source.fields as Record<string, unknown>)
          : source;
    return {
      id: String(r.id),
      supplier_name: String(r.supplier_name),
      product_title: String(r.product_title),
      specification: r.quote_specification ?? r.specification,
      source_sku: sourcingSkuFacts(fields),
      source_sku_pending: fields.price_eligible === false,
      moq: r.quote_moq == null ? (r.moq == null ? null : Number(r.moq)) : Number(r.quote_moq),
      quoted_price: Number(r.quote_price ?? r.quoted_price),
      source_price_description:
        typeof fields.price_description === "string"
          ? fields.price_description.trim().slice(0, 200) || null
          : null,
      currency: String(r.quote_currency ?? r.currency),
      lead_time_days: r.quote_lead_time_days == null ? null : Number(r.quote_lead_time_days),
      location: r.quote_location ?? r.location,
      original_url: String(r.original_url),
      observed_at: iso(r.observed_at),
      evidence_id: String(r.raw_evidence_id),
      confidence_value: r.quote_confidence == null ? null : Number(r.quote_confidence),
      status: r.status,
      missing_fields: parse(r.missing_fields_json),
      quote: r.quote_id
        ? {
            id: String(r.quote_id),
            version: Number(r.quote_version),
            stability_status: r.stability_status,
            risk_level: r.risk_level,
            observed_at: iso(r.quote_observed_at),
            evidence_id: String(r.quote_evidence_id),
          }
        : null,
    };
  }
  private quote(r: RowDataPacket) {
    return {
      id: String(r.id),
      supplier_name: String(r.supplier_name),
      product_title: String(r.product_title),
      specification: String(r.specification),
      moq: Number(r.moq),
      quoted_price: Number(r.quoted_price),
      currency: String(r.currency),
      lead_time_days: Number(r.lead_time_days),
      location: String(r.location),
      confidence_value: Number(r.confidence_value),
      stability_status: r.stability_status,
      risk_level: r.risk_level,
      evidence_id: String(r.evidence_id),
    };
  }
  private async operation<T = unknown>(
    i: SourcingContext & { route: string },
    connection: Pick<Pool, "query"> = this.pool,
  ) {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT result_json FROM sourcing_operations WHERE actor_id=? AND route=? AND idempotency_key=?" +
        (connection === this.pool ? "" : " FOR UPDATE"),
      [i.actorId, i.route, i.idempotencyKey],
    );
    return rows[0] ? parse<T>(rows[0].result_json) : null;
  }
  private save(
    c: PoolConnection,
    i: SourcingContext & { route: string },
    id: string,
    result: unknown,
    now: Date,
  ) {
    return c.query(
      "INSERT INTO sourcing_operations (id,actor_id,route,idempotency_key,resource_id," +
        "result_json,created_at) VALUES (?,?,?,?,?,?,?)",
      [randomUUID(), i.actorId, i.route, i.idempotencyKey, id, JSON.stringify(result), now],
    );
  }
  private async record(
    c: PoolConnection,
    i: SourcingContext,
    type: string,
    id: string,
    payload: unknown,
    now: Date,
    accountOwnershipReason?: string,
  ) {
    const event = randomUUID();
    const scope =
      accountOwnershipReason === undefined
        ? { organizationId: i.organizationId, workspaceId: i.workspaceId }
        : {};
    try {
      await appendSourcingEvent(c, {
        id: event,
        ...scope,
        eventType: type,
        resourceId: id,
        actorId: i.actorId,
        payloadJson: JSON.stringify(payload),
        requestId: i.requestId,
        traceId: i.traceId,
        createdAt: now,
      });
      await appendSourcingOutbox(c, {
        id: event,
        ...scope,
        eventType: type,
        resourceId: id,
        payloadJson: JSON.stringify(payload),
        createdAt: now,
      });
    } catch (error) {
      if (
        accountOwnershipReason !== undefined &&
        error instanceof Error &&
        /^(?:legacy_sourcing_(?:event|outbox)_scope_required|partial_inherited_scope_schema:sourcing_(?:events|outbox))$/.test(
          error.message,
        )
      )
        throw new SourcingServiceError(
          "account_sourcing_delivery_schema_not_ready",
          503,
          "先在隔离副本应用找货事件及投递迁移。",
        );
      throw error;
    }
    if (accountOwnershipReason !== undefined)
      await c.query(
        "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) " +
          "VALUES ('sourcing_events',?,?,?),('sourcing_outbox',?,?,?)",
        [event, i.actorId, accountOwnershipReason, event, i.actorId, accountOwnershipReason],
      );
  }
}
