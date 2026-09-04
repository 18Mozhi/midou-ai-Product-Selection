import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import {
  OpportunityServiceError,
  type DecisionAction,
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
  opportunityRuleCandidateSql,
  opportunitySelectionProjectionSql,
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
const opportunityImageSql = sqlText(
  "COALESCE((SELECT JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.image_url'))",
  "FROM opportunity_evidence_links l",
  "JOIN normalized_records n ON n.raw_evidence_id=l.raw_evidence_id AND n.status='active'",
  "WHERE l.opportunity_id=o.id",
  "AND JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.image_url')) LIKE 'http%'",
  "ORDER BY n.created_at DESC LIMIT 1),",
  "(SELECT JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.image_url'))",
  "FROM competitors c",
  "JOIN competitor_snapshots s ON s.id=c.latest_snapshot_id",
  "JOIN normalized_records n ON n.id=RIGHT(s.source_ref_id,36) AND n.status='active'",
  "WHERE c.opportunity_id=o.id AND c.deleted_at IS NULL",
  "AND JSON_UNQUOTE(JSON_EXTRACT(n.payload_json,'$.image_url')) LIKE 'http%'",
  "ORDER BY s.captured_at DESC LIMIT 1))",
);
const opportunityCountsSql = sqlText(
  "(SELECT COUNT(*) FROM competitors c",
  "WHERE c.opportunity_id=o.id AND c.deleted_at IS NULL) competitor_count,",
  "(SELECT COUNT(*) FROM sourcing_candidates sc",
  "JOIN sourcing_searches ss ON ss.id=sc.search_id",
  "WHERE ss.input_type='opportunity' AND ss.input_ref=o.id AND ss.deleted_at IS NULL)",
  "supplier_candidate_count,",
  "(SELECT COUNT(*) FROM opportunity_rule_matches orm",
  "WHERE orm.opportunity_id=o.id AND orm.organization_id=o.organization_id",
  "AND orm.workspace_id=o.workspace_id) matched_rule_count",
);
const opportunityLifecycleSql =
  "GREATEST(0,TIMESTAMPDIFF(SECOND,o.lifecycle_entered_at,UTC_TIMESTAMP(3))) lifecycle_dwell_seconds";
const summary = (row: RowDataPacket): OpportunitySummary => ({
  id: String(row.id),
  name: String(row.name),
  image_url: row.image_url ? String(row.image_url) : null,
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
});

export class MySqlOpportunityRepository implements OpportunityRepository {
  constructor(private readonly pool: Pool) {}
  async list(input: {
    organizationId: string;
    workspaceId: string;
    actorId: string;
    page: number;
    pageSize: number;
    query?: string;
    market?: string;
    decisionStatus?: "pending" | "adopted" | "observing" | "rejected";
    coverageStatus?: "insufficient" | "partial" | "complete";
    blockingReason?: "evidence_insufficient" | "recommendation_insufficient";
    lifecycleStatus?:
      "candidate" | "validating" | "ready" | "adopted" | "observing" | "rejected" | "archived";
    ownerId?: string;
    scope?: "product" | "all";
    selectionView?: "recommended" | "rule_candidates" | "evidence_pending" | "all";
  }) {
    const where = ["o.organization_id=?", "o.workspace_id=?"],
      values: unknown[] = [input.organizationId, input.workspaceId];
    if (input.selectionView === "recommended") {
      where.push(
        "EXISTS (SELECT 1 FROM opportunity_rule_matches orm_view WHERE orm_view.opportunity_id=o.id AND orm_view.organization_id=o.organization_id AND orm_view.workspace_id=o.workspace_id)",
        "o.decision_status='pending'",
        opportunityRecommendedSql,
      );
    } else if (input.selectionView === "rule_candidates") {
      where.push(
        "o.decision_status='pending'",
        opportunityRuleCandidateSql,
        `NOT ${opportunityQualityGateSql}`,
      );
    } else if (input.selectionView === "evidence_pending") {
      where.push(
        "EXISTS (SELECT 1 FROM opportunity_rule_matches orm_view WHERE orm_view.opportunity_id=o.id AND orm_view.organization_id=o.organization_id AND orm_view.workspace_id=o.workspace_id)",
        "o.decision_status='pending'",
        `NOT ${opportunityRuleCandidateSql}`,
      );
    } else if (input.selectionView !== "all" && input.scope !== "all")
      where.push(
        sqlText(
          "(o.source_type='manual' OR o.category LIKE 'ERP%'",
          "OR EXISTS (SELECT 1 FROM competitors c0",
          "WHERE c0.opportunity_id=o.id AND c0.deleted_at IS NULL)",
          "OR EXISTS (SELECT 1 FROM sourcing_searches ss0",
          "WHERE ss0.input_type='opportunity' AND ss0.input_ref=o.id AND ss0.deleted_at IS NULL))",
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
    } else where.push("o.lifecycle_status<>'archived'");
    if (input.ownerId) {
      where.push("o.owner_id=?");
      values.push(input.ownerId);
    }
    const sql = where.join(" AND "),
      [count] = await this.pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) total FROM opportunities o WHERE ${sql}`,
        values,
      ),
      [rows] = await this.pool.query<RowDataPacket[]>(
        sqlText(
          `SELECT o.*,${opportunityImageSql} image_url,${opportunityCountsSql},${opportunityLifecycleSql},${opportunitySelectionProjectionSql}`,
          `FROM opportunities o WHERE ${sql}`,
          "ORDER BY o.updated_at DESC,o.id DESC LIMIT ? OFFSET ?",
        ),
        [...values, input.pageSize, (input.page - 1) * input.pageSize],
      );
    return { items: rows.map(summary), total: Number(count[0]?.total ?? 0) };
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
  }): Promise<OpportunityDetail["lineage"]> {
    const scope = [input.opportunityId, input.organizationId, input.workspaceId],
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
            "FROM opportunity_evidence_links l JOIN raw_evidence re ON re.id=l.raw_evidence_id",
            "JOIN providers p ON p.id=re.provider_id LEFT JOIN provider_adapter_health h ON h.provider_id=p.id",
            "JOIN collection_tasks ct ON ct.id=re.collection_task_id",
            "WHERE l.opportunity_id=? AND l.organization_id=? AND l.workspace_id=?",
            "ORDER BY re.captured_at DESC LIMIT 20",
          ),
          scope,
        ),
        this.pool.query<RowDataPacket[]>(
          sqlText(
            "SELECT DISTINCT a.id,a.task_id,a.status,a.error_code,a.created_at,a.request_id,a.trace_id",
            "FROM collection_task_attempts a JOIN raw_evidence re ON re.collection_task_id=a.task_id",
            "JOIN opportunity_evidence_links l ON l.raw_evidence_id=re.id",
            "WHERE l.opportunity_id=? AND l.organization_id=? AND l.workspace_id=?",
            "ORDER BY a.created_at DESC LIMIT 20",
          ),
          scope,
        ),
        this.pool.query<RowDataPacket[]>(
          sqlText(
            "SELECT DISTINCT q.id,q.metric_code,q.severity,q.status,q.updated_at,q.request_id,q.trace_id",
            "FROM data_quality_issues q JOIN opportunity_evidence_links l ON l.raw_evidence_id=q.raw_evidence_id",
            "WHERE l.opportunity_id=? AND q.organization_id=? AND q.workspace_id=?",
            "ORDER BY q.updated_at DESC LIMIT 20",
          ),
          scope,
        ),
        this.pool.query<RowDataPacket[]>(
          sqlText(
            "SELECT DISTINCT t.id,t.title,t.status,t.source_fresh_at,s.observed_at,s.request_id,s.trace_id",
            "FROM opportunities o JOIN trend_topics t ON t.id=o.source_ref_id AND o.source_type='trend_topic'",
            "LEFT JOIN trend_signals s ON s.topic_id=t.id",
            "WHERE o.id=? AND o.organization_id=? AND o.workspace_id=?",
            "ORDER BY s.observed_at DESC LIMIT 1",
          ),
          scope,
        ),
        this.pool.query<RowDataPacket[]>(
          sqlText(
            "SELECT o.id,o.name,o.decision_status,o.updated_at,e.request_id,e.trace_id",
            "FROM opportunities o LEFT JOIN opportunity_events e ON e.resource_type='opportunity'",
            "AND e.resource_id=o.id AND e.organization_id=o.organization_id AND e.workspace_id=o.workspace_id",
            "WHERE o.id=? AND o.organization_id=? AND o.workspace_id=?",
            "ORDER BY e.occurred_at DESC LIMIT 1",
          ),
          scope,
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT id,status,scored_at,request_id,trace_id FROM opportunity_score_runs " +
            "WHERE opportunity_id=? AND organization_id=? AND workspace_id=? " +
            "ORDER BY scored_at DESC LIMIT 10",
          scope,
        ),
        this.pool.query<RowDataPacket[]>(
          "SELECT id,status,calculated_at,request_id,trace_id FROM opportunity_profit_runs " +
            "WHERE opportunity_id=? AND organization_id=? AND workspace_id=? " +
            "ORDER BY calculated_at DESC LIMIT 10",
          scope,
        ),
        this.pool.query<RowDataPacket[]>(
          sqlText(
            "SELECT t.id,t.title,t.status,t.updated_at,e.request_id,e.trace_id",
            "FROM tasks t LEFT JOIN task_events e ON e.id=(SELECT e2.id FROM task_events e2",
            "WHERE e2.task_id=t.id ORDER BY e2.created_at DESC,e2.id DESC LIMIT 1)",
            "WHERE t.organization_id=? AND t.workspace_id=? AND t.source_ref_id=? AND t.deleted_at IS NULL",
            "ORDER BY t.updated_at DESC LIMIT 20",
          ),
          [input.organizationId, input.workspaceId, input.opportunityId],
        ),
        this.pool.query<RowDataPacket[]>(
          sqlText(
            "SELECT n.id,n.title,n.severity,n.created_at,o.request_id,o.trace_id",
            "FROM notifications n JOIN outbox_events o ON o.id=n.source_event_id",
            "WHERE n.organization_id=? AND n.workspace_id=? AND (n.resource_id=? OR n.resource_id IN",
            "(SELECT t.id FROM tasks t WHERE t.organization_id=? AND t.workspace_id=? AND",
            "t.source_ref_id=? AND t.deleted_at IS NULL)) ORDER BY n.created_at DESC LIMIT 20",
          ),
          [
            input.organizationId,
            input.workspaceId,
            input.opportunityId,
            input.organizationId,
            input.workspaceId,
            input.opportunityId,
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
    input: { organizationId: string; workspaceId: string; opportunityId: string },
    database: Pool | PoolConnection = this.pool,
  ): Promise<OpportunityOperatingFeedback> {
    const [rows] = await database.query<RowDataPacket[]>(
      "SELECT * FROM opportunity_operating_facts WHERE opportunity_id=? AND organization_id=? " +
        "AND workspace_id=? ORDER BY period_end DESC,created_at DESC,id DESC LIMIT 20",
      [input.opportunityId, input.organizationId, input.workspaceId],
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
  async get(input: {
    organizationId: string;
    workspaceId: string;
    actorId: string;
    opportunityId: string;
  }) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      sqlText(
        `SELECT o.*,${opportunityImageSql} image_url,${opportunityCountsSql},${opportunityLifecycleSql},${opportunitySelectionProjectionSql}`,
        "FROM opportunities o",
        "WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? LIMIT 1",
      ),
      [input.opportunityId, input.organizationId, input.workspaceId],
    );
    const row = rows[0];
    if (!row) return null;
    const [lineage, operatingFeedback] = await Promise.all([
      this.lineage(input),
      this.operatingFeedback(input),
    ]);
    const [evidence] = await this.pool.query<RowDataPacket[]>(
      sqlText(
        "SELECT l.id,s.title,s.publisher,s.canonical_url,l.provider_id,",
        "l.raw_evidence_id,l.observed_at FROM opportunity_evidence_links l",
        "JOIN trend_signals s ON s.id=l.evidence_id AND l.evidence_type='trend_signal'",
        "WHERE l.opportunity_id=? AND l.organization_id=? AND l.workspace_id=?",
        "ORDER BY l.observed_at DESC,l.id DESC",
      ),
      [input.opportunityId, input.organizationId, input.workspaceId],
    );
    const [decisions] = await this.pool.query<RowDataPacket[]>(
      sqlText(
        "SELECT id,action,reason,actor_id,created_at,opportunity_version",
        "FROM opportunity_decisions",
        "WHERE opportunity_id=? AND organization_id=? AND workspace_id=?",
        "ORDER BY created_at DESC,id DESC",
      ),
      [input.opportunityId, input.organizationId, input.workspaceId],
    );
    const [[evidenceTasks], [scoreJobs], [recommendationRuleRows]] = await Promise.all([
      this.pool.query<RowDataPacket[]>(
        "SELECT id,status,progress_percent,assignee_id,due_at,completed_at,created_at,updated_at " +
          "FROM tasks WHERE organization_id=? AND workspace_id=? AND " +
          "source_type='evidence_completion' AND source_ref_id=? AND deleted_at IS NULL " +
          "ORDER BY created_at DESC,id DESC LIMIT 1",
        [input.organizationId, input.workspaceId, input.opportunityId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT id,status,trigger_task_id,last_error_code,created_at,updated_at FROM opportunity_score_jobs " +
          "WHERE organization_id=? AND workspace_id=? AND opportunity_id=? " +
          "ORDER BY created_at DESC,id DESC LIMIT 1",
        [input.organizationId, input.workspaceId, input.opportunityId],
      ),
      this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(DISTINCT m.monitoring_rule_id) matched_rule_count," +
          "COUNT(DISTINCT CASE WHEN r.status='enabled' THEN m.monitoring_rule_id END) enabled_rule_count," +
          "MIN(CASE WHEN r.status='enabled' THEN r.recommendation_min_source_count END) minimum_source_count " +
          "FROM opportunity_rule_matches m JOIN trend_monitoring_rules r ON r.id=m.monitoring_rule_id " +
          "AND r.organization_id=m.organization_id AND r.workspace_id=m.workspace_id WHERE " +
          "m.opportunity_id=? AND m.organization_id=? AND m.workspace_id=?",
        [input.opportunityId, input.organizationId, input.workspaceId],
      ),
    ]);
    let scoreRun: RowDataPacket | undefined,
      components: RowDataPacket[] = [];
    try {
      const [scoreRuns] = await this.pool.query<RowDataPacket[]>(
        "SELECT * FROM opportunity_score_runs WHERE opportunity_id=? AND organization_id=? AND " +
          "workspace_id=? ORDER BY scored_at DESC,id DESC LIMIT 1",
        [input.opportunityId, input.organizationId, input.workspaceId],
      );
      scoreRun = scoreRuns[0];
      if (scoreRun) {
        const [result] = await this.pool.query<RowDataPacket[]>(
          sqlText(
            "SELECT dimension_code,weight_percent,input_score,weighted_score,",
            "evidence_ids_json,missing_fields_json FROM opportunity_score_components",
            "WHERE score_run_id=? ORDER BY dimension_code",
          ),
          [scoreRun.id],
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
      recommendationRule = recommendationRuleRows[0],
      evidenceBlocked = Number(row.evidence_count) === 0 || row.coverage_status === "insufficient",
      qualityRegressionBlocked =
        String(scoreJob?.last_error_code ?? "") === "score_blocked_by_data_quality_regression",
      recommendationBlocked = !selection.quality_gates.all_passed || qualityRegressionBlocked,
      scoreInProgress =
        scoreJob && ["queued", "leased", "retry_scheduled"].includes(String(scoreJob.status)),
      evidenceInProgress =
        evidenceBlocked && evidenceTask && !["cancelled"].includes(String(evidenceTask.status)),
      redecisionReady = Boolean(
        evidenceTask &&
        String(evidenceTask.status) === "completed" &&
        scoreJob &&
        String(scoreJob.trigger_task_id) === String(evidenceTask.id) &&
        ["succeeded", "completed_with_warnings"].includes(String(scoreJob.status)),
      );
    return {
      ...summary(row),
      operating_feedback: operatingFeedback,
      lineage,
      adoption_blockers: [
        {
          code: "evidence_insufficient",
          status: evidenceBlocked ? (evidenceInProgress ? "in_progress" : "blocked") : "cleared",
          progress_percent: evidenceTask ? Number(evidenceTask.progress_percent ?? 0) : null,
          next_action: evidenceBlocked
            ? evidenceTask
              ? String(evidenceTask.status) === "completed"
                ? "补采任务已完成，等待评分结果。"
                : "继续完成补采任务。"
              : "创建补采任务并补齐真实证据。"
            : "证据覆盖阻断已解除。",
          task_id: evidenceTask ? String(evidenceTask.id) : null,
          task_status: evidenceTask ? String(evidenceTask.status) : null,
          score_job_status: scoreJob ? String(scoreJob.status) : null,
        },
        {
          code: "recommendation_insufficient",
          status: recommendationBlocked ? (scoreInProgress ? "in_progress" : "blocked") : "cleared",
          progress_percent: null,
          next_action: recommendationBlocked
            ? !qualityRegressionBlocked &&
              !scoreInProgress &&
              selection.selection_stage === "rule_candidate"
              ? `已进入规则命中候选；${missingQualityGates.join("、")}质量门全部通过后才会显示“建议采纳”。`
              : recommendationGuidance({
                  qualityRegressionBlocked,
                  scoreInProgress: Boolean(scoreInProgress),
                  scoreRuleVersion:
                    row.score_rule_version == null ? null : String(row.score_rule_version),
                  latestScoreStatus: scoreRun?.status == null ? null : String(scoreRun.status),
                  matchedRuleCount: Number(
                    recommendationRule?.matched_rule_count ?? row.matched_rule_count ?? 0,
                  ),
                  enabledRuleCount: Number(recommendationRule?.enabled_rule_count ?? 0),
                  minimumSourceCount:
                    recommendationRule?.minimum_source_count == null
                      ? null
                      : Number(recommendationRule.minimum_source_count),
                  sourceCount: Number(row.source_count ?? 0),
                })
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
          "(id,organization_id,workspace_id,opportunity_id,status,attempt_count,available_at,",
          "lease_owner,lease_expires_at,last_error_code,request_id,trace_id,created_at,updated_at)",
          "VALUES (?,?,?,?,'queued',0,?,NULL,NULL,NULL,?,?,?,?)",
        ),
        [
          randomUUID(),
          input.organizationId,
          input.workspaceId,
          input.opportunityId,
          now,
          input.requestId,
          input.traceId,
          now,
          now,
        ],
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
  async decide(
    input: OpportunityWriteContext & {
      opportunityId: string;
      action: DecisionAction;
      reason: string;
      expectedVersion: number;
      route: string;
    },
  ) {
    const previous = await this.operation<{
      opportunity_id: string;
      decision_status: "adopted" | "observing" | "rejected";
      version: number;
      decision_id: string;
      verification_task_id: string;
    }>(input);
    if (previous) return previous;
    const connection = await this.pool.getConnection(),
      now = new Date();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        sqlText(
          `SELECT o.name,o.decision_status,o.version,o.recommendation_status,o.evidence_count,` +
            `o.coverage_status,o.overall_score,o.score_rule_version,o.trend_score,` +
            `o.competition_score,o.profit_status,${opportunitySelectionProjectionSql}`,
          "FROM opportunities o",
          "WHERE o.id=? AND o.organization_id=? AND o.workspace_id=? LIMIT 1 FOR UPDATE",
        ),
        [input.opportunityId, input.organizationId, input.workspaceId],
      );
      const row = rows[0];
      if (!row)
        throw new OpportunityServiceError(
          "opportunity_not_found",
          404,
          "刷新机会列表；该机会可能不在当前工作区。",
        );
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
          "(id,organization_id,workspace_id,opportunity_id,action,reason,previous_status,",
          "resulting_status,opportunity_version,actor_id,request_id,trace_id,created_at)",
          "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ),
        [
          decisionId,
          input.organizationId,
          input.workspaceId,
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
      await connection.query(
        "UPDATE opportunities SET decision_status=?," +
          "lifecycle_entered_at=IF(lifecycle_status<>?,?,lifecycle_entered_at)," +
          "lifecycle_status=?,version=?,updated_at=? WHERE id=? AND organization_id=? AND workspace_id=?",
        [
          status,
          status,
          now,
          status,
          version,
          now,
          input.opportunityId,
          input.organizationId,
          input.workspaceId,
        ],
      );
      const verificationTaskId = randomUUID(),
        dueAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      await connection.query(
        sqlText(
          "INSERT INTO tasks",
          "(id,organization_id,workspace_id,title,description,status,priority,assignee_id,",
          "source_type,source_ref_id,collection_task_id,due_at,completed_at,created_by,",
          "version,created_at,updated_at)",
          "VALUES (?,?,?,?,?,'todo','high',?,'selection_verification',?,NULL,?,NULL,?,1,?,?)",
        ),
        [
          verificationTaskId,
          input.organizationId,
          input.workspaceId,
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
      await connection.query(
        sqlText(
          "INSERT INTO task_events",
          "(id,organization_id,workspace_id,task_id,event_type,actor_id,payload_json,",
          "request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        ),
        [
          randomUUID(),
          input.organizationId,
          input.workspaceId,
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
      await this.record(
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
          "INSERT INTO task_events (id,organization_id,workspace_id,task_id,event_type,actor_id," +
            "payload_json,request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
          [
            randomUUID(),
            input.organizationId,
            input.workspaceId,
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
              "WHERE opportunity_id=? AND organization_id=? AND workspace_id=? " +
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
          "(id,organization_id,workspace_id,opportunity_id,period_start,period_end,sales_units," +
          "revenue_amount,ad_spend_amount,returned_units,purchase_lead_time_days," +
          "actual_profit_amount,currency,source_ref,notes,score_rule_version_snapshot," +
          "profit_rule_version_snapshot,decision_status_snapshot,predicted_profit_amount," +
          "predicted_currency,quoted_lead_time_days,observed_at,request_id,trace_id,created_by," +
          "created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          factId,
          input.organizationId,
          input.workspaceId,
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
  private async operation<T>(input: OpportunityWriteContext & { route: string }) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT result_json FROM opportunity_operations WHERE actor_id=? AND route=? AND idempotency_key=? LIMIT 1",
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
  ) {
    const values = [
      randomUUID(),
      input.organizationId,
      input.workspaceId,
      eventType,
      "opportunity",
      resourceId,
      input.actorId,
      input.requestId,
      input.traceId,
      JSON.stringify(payload),
      now,
    ];
    await connection.query(
      sqlText(
        "INSERT INTO opportunity_events",
        "(id,organization_id,workspace_id,event_type,resource_type,resource_id,actor_type,",
        "actor_id,request_id,trace_id,payload_json,occurred_at)",
        "VALUES (?,?,?,?,?,?,'user',?,?,?,?,?)",
      ),
      values,
    );
    await connection.query(
      sqlText(
        "INSERT INTO opportunity_outbox",
        "(id,organization_id,workspace_id,event_type,resource_type,resource_id,payload_json,",
        "status,attempt_count,available_at,request_id,trace_id,created_at,updated_at)",
        "VALUES (?,?,?,?,?,?,?,'queued',0,?,?,?,?,?)",
      ),
      [
        randomUUID(),
        input.organizationId,
        input.workspaceId,
        eventType,
        "opportunity",
        resourceId,
        JSON.stringify(payload),
        now,
        input.requestId,
        input.traceId,
        now,
        now,
      ],
    );
  }
}
