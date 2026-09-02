import type { Pool, RowDataPacket } from "mysql2/promise";
import type { HomeDashboardItem } from "@scoutops/contracts";
import type { HomeDashboardRepository } from "./home-dashboard-service.js";
export class MySqlHomeDashboardRepository implements HomeDashboardRepository {
  constructor(private readonly pool: Pool) {}
  async automaticSelection(input: { organizationId: string; workspaceId: string }) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM trend_monitoring_rules r
          WHERE r.organization_id=? AND r.workspace_id=? AND r.status='enabled') enabled_rule_count,
         (SELECT MAX(r.last_collection_at) FROM trend_monitoring_rules r
          WHERE r.organization_id=? AND r.workspace_id=? AND r.status='enabled') last_collection_at,
         (SELECT MIN(r.next_collection_at) FROM trend_monitoring_rules r
          WHERE r.organization_id=? AND r.workspace_id=? AND r.status='enabled') next_collection_at,
         (SELECT COUNT(DISTINCT o.id) FROM opportunities o
          JOIN opportunity_rule_matches m ON m.opportunity_id=o.id
            AND m.organization_id=o.organization_id AND m.workspace_id=o.workspace_id
          WHERE o.organization_id=? AND o.workspace_id=? AND o.decision_status='pending'
            AND o.lifecycle_status<>'archived') candidate_count,
         (SELECT COUNT(DISTINCT o.id) FROM opportunities o
          JOIN opportunity_rule_matches m ON m.opportunity_id=o.id
            AND m.organization_id=o.organization_id AND m.workspace_id=o.workspace_id
          WHERE o.organization_id=? AND o.workspace_id=? AND o.decision_status='pending'
            AND o.recommendation_status='recommend' AND o.lifecycle_status<>'archived') recommended_count,
         (SELECT COUNT(DISTINCT o.id) FROM opportunities o
          JOIN opportunity_rule_matches m ON m.opportunity_id=o.id
            AND m.organization_id=o.organization_id AND m.workspace_id=o.workspace_id
          WHERE o.organization_id=? AND o.workspace_id=? AND o.decision_status='pending'
            AND o.recommendation_status='insufficient_data' AND o.lifecycle_status<>'archived') awaiting_evidence_count,
         (SELECT COUNT(DISTINCT o.id) FROM opportunities o
          JOIN opportunity_rule_matches m ON m.opportunity_id=o.id
            AND m.organization_id=o.organization_id AND m.workspace_id=o.workspace_id
          WHERE o.organization_id=? AND o.workspace_id=? AND o.decision_status='adopted') adopted_count`,
      [
        input.organizationId,
        input.workspaceId,
        input.organizationId,
        input.workspaceId,
        input.organizationId,
        input.workspaceId,
        input.organizationId,
        input.workspaceId,
        input.organizationId,
        input.workspaceId,
        input.organizationId,
        input.workspaceId,
        input.organizationId,
        input.workspaceId,
      ],
    );
    const row = rows[0] ?? ({} as RowDataPacket),
      enabled = Number(row.enabled_rule_count ?? 0),
      last = row.last_collection_at == null ? null : new Date(row.last_collection_at).toISOString(),
      next = row.next_collection_at == null ? null : new Date(row.next_collection_at).toISOString();
    return {
      state:
        enabled === 0
          ? ("not_configured" as const)
          : next
            ? ("running" as const)
            : ("attention" as const),
      enabled_rule_count: enabled,
      candidate_count: Number(row.candidate_count ?? 0),
      recommended_count: Number(row.recommended_count ?? 0),
      awaiting_evidence_count: Number(row.awaiting_evidence_count ?? 0),
      adopted_count: Number(row.adopted_count ?? 0),
      recommended_items: [],
      last_collection_at: last,
      next_collection_at: next,
    };
  }
  async list(input: Parameters<HomeDashboardRepository["list"]>[0]) {
    if (!input.capabilities.length) return [];
    const [projectionRows] = await this.pool.query<RowDataPacket[]>(
      "SELECT id,kind,title,reason,route,priority,owner_label,due_at,source_count," +
        "observed_at,severity,source_version FROM home_dashboard_items WHERE organization_id=? " +
        "AND workspace_id=? AND required_capability IN (?) AND route LIKE '/%' AND route NOT " +
        "LIKE '//%' AND ((kind='health' AND audience_user_id=?) OR (kind<>'health' AND (audience_user_id " +
        "IS NULL OR audience_user_id=?))) ORDER BY FIELD(kind,'action','change','follow'," +
        "'health'),FIELD(priority,'overdue','blocking','high_risk','high_value','normal')," +
        "observed_at DESC,id DESC LIMIT 80",
      [input.organizationId, input.workspaceId, input.capabilities, input.actorId, input.actorId],
    );
    const projections = projectionRows.map(
      (row) =>
        ({
          id: String(row.id),
          kind: String(row.kind),
          title: String(row.title),
          reason: String(row.reason),
          route: String(row.route),
          source_module: "projection",
          source_label:
            row.kind === "change"
              ? "趋势变化"
              : row.kind === "follow"
                ? "我的关注"
                : row.kind === "health"
                  ? "数据健康"
                  : "工作事项",
          context_label: row.priority === "blocking" ? "打开完整处理上下文" : "去处理",
          priority: row.priority === null ? null : String(row.priority),
          risk_level:
            row.priority === "high_risk" || row.priority === "blocking"
              ? "high"
              : row.priority === "overdue"
                ? "critical"
                : null,
          value_score: null,
          blocked: row.priority === "blocking",
          owner_label: row.owner_label === null ? null : String(row.owner_label),
          due_at: row.due_at === null ? null : new Date(row.due_at).toISOString(),
          source_count: row.source_count === null ? null : Number(row.source_count),
          observed_at: new Date(row.observed_at).toISOString(),
          severity: String(row.severity),
          source_version: Number(row.source_version),
        }) as HomeDashboardItem,
    );
    let tasks: HomeDashboardItem[] = [],
      approvals: HomeDashboardItem[] = [],
      opportunities: HomeDashboardItem[] = [];
    if (input.capabilities.includes("task:read")) {
      const [taskRows] = await this.pool.query<RowDataPacket[]>(
        "SELECT t.id,t.title,t.description,t.status,t.priority,t.source_type,t.due_at,t.updated_at," +
          "t.version,t.progress_note,t.collection_task_id,COALESCE(NULLIF(p.display_name,''),u.email) " +
          "owner_label,(t.due_at IS NOT NULL AND t.due_at<UTC_TIMESTAMP(3)) is_overdue," +
          "(t.status='paused' OR c.status IN ('blocked_login','blocked_captcha','blocked_robots'," +
          "'failed_terminal','dead_letter')) is_blocking FROM tasks t JOIN users u ON u.id=t.assignee_id " +
          "LEFT JOIN user_profiles p ON p.user_id=t.assignee_id LEFT JOIN collection_tasks c ON " +
          "c.id=t.collection_task_id AND c.organization_id=t.organization_id AND c.workspace_id=t.workspace_id " +
          "WHERE t.organization_id=? AND t.workspace_id=? AND t.assignee_id=? AND t.deleted_at IS NULL " +
          "AND t.status IN ('todo','in_progress','paused') ORDER BY is_overdue DESC,is_blocking DESC," +
          "FIELD(t.priority,'critical','high','normal','low'),(t.due_at IS NULL),t.due_at,t.updated_at DESC LIMIT 40",
        [input.organizationId, input.workspaceId, input.actorId],
      );
      tasks = taskRows.map((row) => {
        const overdue = Boolean(Number(row.is_overdue)),
          blocked = Boolean(Number(row.is_blocking)),
          priority = overdue
            ? "overdue"
            : blocked
              ? "blocking"
              : ["critical", "high"].includes(String(row.priority))
                ? "high_risk"
                : "normal",
          sourceLabel =
            (
              {
                sourcing_purchase: "采购任务",
                selection_verification: "选品复核",
                evidence_completion: "证据补采",
                collection_followup: "采集跟进",
                manual: "任务",
              } as Record<string, string>
            )[String(row.source_type)] ?? "任务",
          fallback = blocked
            ? "任务已暂停或关联采集受阻，请进入详情查看原因与下一步。"
            : overdue
              ? "任务已超过截止时间，请确认处理进度。"
              : "任务正在等待你处理。";
        return {
          id: String(row.id),
          kind: "action",
          title: String(row.title),
          reason: blocked
            ? `${fallback}${row.progress_note ? ` ${row.progress_note}` : ""}`.slice(0, 500)
            : String(row.progress_note ?? row.description ?? fallback).slice(0, 500) || fallback,
          route: `/tasks/${row.id}`,
          source_module: "task",
          source_label: sourceLabel,
          context_label: blocked ? "打开完整处理上下文" : "继续处理",
          priority,
          risk_level: String(row.priority) as HomeDashboardItem["risk_level"],
          value_score: null,
          blocked,
          owner_label: String(row.owner_label),
          due_at: row.due_at === null ? null : new Date(row.due_at).toISOString(),
          source_count: null,
          observed_at: new Date(row.updated_at).toISOString(),
          severity:
            blocked || row.priority === "critical"
              ? "critical"
              : row.priority === "high"
                ? "warning"
                : "info",
          source_version: Number(row.version),
        } as HomeDashboardItem;
      });
      const [approvalRows] = await this.pool.query<RowDataPacket[]>(
        "SELECT r.id,r.title,r.updated_at,r.version,n.name node_name,n.due_at,n.escalated_at," +
          "COALESCE(NULLIF(p.display_name,''),u.email) owner_label," +
          "(n.due_at IS NOT NULL AND n.due_at<UTC_TIMESTAMP(3)) is_overdue FROM approval_requests r " +
          "JOIN approval_node_runs n ON n.approval_request_id=r.id AND n.ordinal=r.current_node_ordinal " +
          "JOIN users u ON u.id=n.active_approver_id LEFT JOIN user_profiles p ON p.user_id=n.active_approver_id " +
          "WHERE r.organization_id=? AND r.workspace_id=? AND r.status='pending' AND n.status='pending' " +
          "AND n.active_approver_id=? ORDER BY is_overdue DESC,(n.escalated_at IS NOT NULL) DESC," +
          "(n.due_at IS NULL),n.due_at,r.updated_at DESC LIMIT 40",
        [input.organizationId, input.workspaceId, input.actorId],
      );
      approvals = approvalRows.map((row) => {
        const overdue = Boolean(Number(row.is_overdue)),
          escalated = row.escalated_at !== null;
        return {
          id: String(row.id),
          kind: "action",
          title: String(row.title),
          reason: escalated
            ? `审批已升级，当前节点“${row.node_name}”等待你处理。`
            : `当前节点“${row.node_name}”等待你处理。`,
          route: `/tasks/approvals?approval=${row.id}`,
          source_module: "approval",
          source_label: "审批",
          context_label: "打开完整审批上下文",
          priority: overdue ? "overdue" : "blocking",
          risk_level: overdue || escalated ? "high" : "medium",
          value_score: null,
          blocked: true,
          owner_label: String(row.owner_label),
          due_at: row.due_at === null ? null : new Date(row.due_at).toISOString(),
          source_count: null,
          observed_at: new Date(row.updated_at).toISOString(),
          severity: overdue || escalated ? "critical" : "warning",
          source_version: Number(row.version),
        } as HomeDashboardItem;
      });
    }
    if (input.capabilities.includes("opportunity:read")) {
      const [opportunityRows] = await this.pool.query<RowDataPacket[]>(
        "SELECT o.id,o.name,o.recommendation_status,o.overall_score,o.risk_level,o.coverage_status," +
          "o.updated_at,o.version,COALESCE(NULLIF(p.display_name,''),u.email) owner_label FROM opportunities o " +
          "LEFT JOIN users u ON u.id=COALESCE(o.owner_id,o.created_by) LEFT JOIN user_profiles p ON " +
          "p.user_id=COALESCE(o.owner_id,o.created_by) WHERE o.organization_id=? AND o.workspace_id=? " +
          "AND o.decision_status='pending' AND o.recommendation_status='recommend' " +
          "AND o.lifecycle_status<>'archived' AND EXISTS (SELECT 1 FROM opportunity_rule_matches orm " +
          "WHERE orm.opportunity_id=o.id AND orm.organization_id=o.organization_id " +
          "AND orm.workspace_id=o.workspace_id) AND " +
          "(o.owner_id=? OR (o.owner_id IS NULL AND o.created_by=?)) ORDER BY " +
          "FIELD(o.risk_level,'high','medium','low','unknown'),o.overall_score DESC,o.updated_at DESC LIMIT 40",
        [input.organizationId, input.workspaceId, input.actorId, input.actorId],
      );
      opportunities = opportunityRows.map((row) => {
        const highRisk = row.risk_level === "high";
        return {
          id: String(row.id),
          kind: "action",
          title: String(row.name),
          reason: highRisk
            ? "当前机会风险较高，等待你复核证据并作出决策。"
            : "命中已启用选品规则且评分结论为推荐，等待你最终确认。",
          route: `/opportunities/${row.id}`,
          source_module: "opportunity",
          source_label: "选品机会",
          context_label: "进入决策上下文",
          priority: highRisk ? "high_risk" : "high_value",
          risk_level: String(row.risk_level) as HomeDashboardItem["risk_level"],
          value_score: row.overall_score === null ? null : Number(row.overall_score),
          blocked: false,
          owner_label: row.owner_label === null ? null : String(row.owner_label),
          due_at: null,
          source_count: null,
          observed_at: new Date(row.updated_at).toISOString(),
          severity: highRisk ? "warning" : "info",
          source_version: Number(row.version),
        } as HomeDashboardItem;
      });
    }
    return [...projections, ...tasks, ...approvals, ...opportunities];
  }
}
