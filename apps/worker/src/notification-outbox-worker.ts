import { approvalTemplateScopeRelation, approvalRequestCoordinates } from "@scoutops/database";
import { appendScopedNotification } from "@scoutops/database";
import { randomUUID } from "node:crypto";
import { PRIMARY_COST_APPROVER_EMAIL } from "@scoutops/auth";
import { notificationDeliveryScopeColumns, notificationPreferencesAccountSchema, readDeliveryNotificationPreferences, realtimeEventScopeColumns } from "@scoutops/database";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { calculationOwnersMatch } from "./opportunity-calculation-ownership.js";
import { readApprovalResourceOwners } from "./approval-resource-lineage.js";
import { nativeOpportunityStorage } from "./opportunity-storage.js";
const parse = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : (v as any));
const isCostReviewReminder = (type: unknown) =>
  type === "approval.cost_input.review_due_soon" || type === "approval.cost_input.overdue";
const isApprovalWorkflowDelivery = (type: unknown) =>
  type === "approval.request.created" || type === "approval.node.approved" || type === "approval.node.rejected";
const guardedDelivery = (type: unknown) =>
  type === "task.evidence_completion.redecision_ready" || type === "approval.overdue" ||
  isApprovalWorkflowDelivery(type) || isCostReviewReminder(type);
const isNativeTaskDelivery = (type: unknown, payload: any) =>
  typeof type === "string" && type.startsWith("task.") && payload?.task_account_contract !== undefined;
const isNativeCompetitorDelivery = (type: unknown, payload: any) =>
  type === "competitor.threshold.triggered" && payload?.competitor_account_contract !== undefined;
const isNativeAutomationDelivery = (event: any, payload: any) =>
  event.event_type === "automation.notification.queued" &&
  (payload?.automation_account_contract !== undefined ||
    (!Object.hasOwn(event, "organization_id") && !Object.hasOwn(event, "workspace_id")));
const isNativeRedecisionDelivery = (event: any, payload: any) =>
  event.event_type === "task.evidence_completion.redecision_ready" &&
  payload?.account_projection_contract === 25 && event.organization_id == null && event.workspace_id == null;
export const notificationBody = (category: string) =>
  ({
    approval: "审批状态已变化，请查看关联记录。",
    competitor: "竞品监控状态已变化，请查看关联记录。",
    system: "系统状态已变化，请查看关联记录。",
    task: "任务状态已变化，请查看关联记录。",
  })[category] ?? "业务状态已变化，请查看关联记录。";
export class NotificationOutboxWorker {
  constructor(
    private readonly pool: Pool,
    private readonly leaseSeconds: number,
    private readonly retryLimit: number,
    private readonly now = () => new Date(),
  ) {}
  async processOnce() {
    const c = await this.pool.getConnection(),
      now = this.now();
    let event: any;
    try {
      await c.beginTransaction();
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT * FROM outbox_events WHERE ((status='pending' AND available_at<=?) OR (status='leased' AND lease_expires_at<=?)) AND (event_type LIKE 'task.%' OR event_type LIKE 'approval.%' OR event_type LIKE 'competitor.%' OR event_type='automation.notification.queued') ORDER BY available_at,id LIMIT 1 FOR UPDATE",
        [now, now],
      );
      event = rows[0];
      if (!event) {
        await c.commit();
        return { status: "idle" as const };
      }
      await c.query(
        "UPDATE outbox_events SET status='leased',leased_at=?,lease_expires_at=DATE_ADD(?,INTERVAL ? SECOND),attempt_count=attempt_count+1,version=version+1,updated_at=? WHERE id=?",
        [now, now, this.leaseSeconds, now, event.id],
      );
      await c.commit();
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
    try {
      const marked = parse(event.payload_json);
      if (guardedDelivery(event.event_type) || isNativeTaskDelivery(event.event_type, marked) ||
          isNativeCompetitorDelivery(event.event_type, marked) || isNativeAutomationDelivery(event, marked))
        return await this.publishGuarded(event);
      const payload = parse(event.payload_json),
        category = String(event.event_type).startsWith("approval.")
          ? "approval"
          : String(event.event_type).startsWith("competitor.")
            ? "competitor"
            : String(event.event_type).startsWith("automation.")
              ? "system"
              : "task",
        actionable = await this.isStillActionable(event, payload),
        recipients = actionable ? await this.recipients(event, payload) : [];
      let createdNotifications = 0;
      for (const recipient of recipients)
        if (await this.create(event, payload, category, recipient, now)) createdNotifications += 1;
      await this.pool.query(
        "UPDATE outbox_events SET status='published',published_at=?,lease_expires_at=NULL,version=version+1,updated_at=? WHERE id=?",
        [now, now, event.id],
      );
      if (event.event_type === "competitor.threshold.triggered")
        await this.pool.query(
          "UPDATE competitor_alerts a JOIN competitors c ON c.id=a.competitor_id " +
            "SET a.notification_status=?,a.updated_at=? WHERE a.id=? AND c.organization_id=? AND c.workspace_id=?",
          [
            createdNotifications > 0 ? "delivered" : "failed",
            now,
            event.id,
            event.organization_id,
            event.workspace_id,
          ],
        );
      return {
        status: "published" as const,
        event_id: String(event.id),
        notifications: createdNotifications,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      let marked: any;
      try { marked = parse(event.payload_json); } catch { /* malformed payload uses the existing retry path */ }
      const guarded = guardedDelivery(event.event_type) || isNativeTaskDelivery(event.event_type, marked) ||
        isNativeCompetitorDelivery(event.event_type, marked) || isNativeAutomationDelivery(event, marked);
      await this.pool.query(
        "UPDATE outbox_events SET status=IF(attempt_count>=?,'dead_letter','pending'),available_at=DATE_ADD(?,INTERVAL 60 SECOND),lease_expires_at=NULL,updated_at=? WHERE id=?" +
          (guarded ? " AND status='leased' AND version=?" : ""),
        [this.retryLimit, now, now, event.id, ...(guarded ? [Number(event.version) + 1] : [])],
      );
      return {
        status: "failed" as const,
        event_id: String(event.id),
        error: message,
      };
    }
  }
  private async publishGuarded(leased: RowDataPacket) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const now = this.now();
      const [[event]] = await c.query<RowDataPacket[]>(
        "SELECT * FROM outbox_events WHERE id=? AND version=? AND status='leased' AND lease_expires_at>? FOR UPDATE",
        [leased.id, Number(leased.version) + 1, now],
      );
      if (!event) {
        await c.rollback();
        return { status: "lease_lost" as const, event_id: String(leased.id) };
      }
      const payload = parse(event.payload_json);
      const overdue = event.event_type === "approval.overdue";
      const workflow = isApprovalWorkflowDelivery(event.event_type);
      const costReview = isCostReviewReminder(event.event_type);
      const nativeTask = isNativeTaskDelivery(event.event_type, payload);
      const nativeCompetitor = isNativeCompetitorDelivery(event.event_type, payload);
      const nativeAutomation = isNativeAutomationDelivery(event, payload);
      const ownedWorkflowRecipients = workflow ? await this.accountApprovalRecipients(event, payload, c) : null;
      const recipients = overdue
        ? await this.approvalOverdueRecipients(c, event, payload)
        : workflow
          ? ownedWorkflowRecipients ?? await this.legacyRecipients(event, payload, c)
          : costReview ? await this.costReviewRecipients(c, event, payload)
          : nativeTask ? await this.nativeTaskRecipients(c, event, payload)
          : nativeCompetitor ? await this.nativeCompetitorRecipients(c, event, payload)
          : nativeAutomation ? await this.nativeAutomationRecipients(c, event, payload)
          : await this.isRedecisionActionable(event, payload, c) ? await this.recipients(event, payload) : [];
      const notificationPayload = overdue || ownedWorkflowRecipients !== null
        ? { resource_type: "approval", resource_id: payload.approval_request_id ?? payload.id }
        : payload;
      let notifications = 0;
      for (const recipient of recipients)
        if (await this.create(event, notificationPayload,
          overdue || workflow || costReview ? "approval" : nativeCompetitor ? "competitor" : nativeAutomation ? "system" : "task", recipient, now, c)) notifications++;
      if (nativeCompetitor && recipients.length)
        await c.query("UPDATE competitor_alerts SET notification_status=?,updated_at=? WHERE id=? AND competitor_id=?",
          [notifications ? "delivered" : "failed", now, event.id, payload.competitor_id]);
      await c.query(
        "UPDATE outbox_events SET status='published',published_at=?,lease_expires_at=NULL,version=version+1,updated_at=? WHERE id=?",
        [now, now, event.id],
      );
      await c.commit();
      return { status: "published" as const, event_id: String(event.id), notifications };
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }
  private async nativeAutomationRecipients(c: PoolConnection, event: RowDataPacket, p: any) {
    if (p?.automation_account_contract !== 25 || Number(event.schema_version) !== 1 ||
        event.organization_id != null || event.workspace_id != null || p.resource_type !== "automation_rule" ||
        ![p.resource_id, p.automation_execution_id, p.recipient_id, p.title].every(s => typeof s === "string" && s.length > 0))
      return [];
    const [rows] = await c.query<RowDataPacket[]>(
      `SELECT u.id recipient_id FROM automation_executions x
       JOIN automation_rules r ON r.id=x.rule_id AND r.action_type='notify_owner' AND r.owner_id=?
       JOIN users u ON u.id=r.owner_id AND u.status='active'
       JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 AND ? >= cut.created_at
       JOIN account_owned_records rule_owner ON rule_owner.source_table='automation_rules'
         AND rule_owner.source_id=r.id AND rule_owner.account_id=r.account_id
         AND (rule_owner.reason='exclusive_owner' OR
          (rule_owner.reason IN ('shared','unassigned') AND rule_owner.account_id=cut.primary_account_id))
       JOIN account_owned_records execution_owner ON execution_owner.source_table='automation_executions'
         AND execution_owner.source_id=x.id AND execution_owner.account_id=r.account_id
       JOIN account_owned_records delivery_owner ON delivery_owner.source_table='outbox_events'
         AND delivery_owner.source_id=? AND delivery_owner.account_id=r.account_id
       WHERE x.id=? AND x.rule_id=? AND x.status='succeeded'
         AND x.action_resource_type='notification' AND x.action_resource_id=?
         AND BINARY x.request_id=BINARY ? AND BINARY x.trace_id=BINARY ?
       LIMIT 1 LOCK IN SHARE MODE`,
      [p.recipient_id, event.created_at, event.id, p.automation_execution_id, p.resource_id,
        event.id, event.request_id, event.trace_id],
    );
    return rows.map(row => String(row.recipient_id));
  }
  private async nativeCompetitorRecipients(c: PoolConnection, event: RowDataPacket, p: any) {
    if (p.competitor_account_contract !== 25 || Number(event.schema_version) !== 1 ||
        event.organization_id != null || event.workspace_id != null ||
        p.resource_type !== "competitor" || p.resource_id !== p.competitor_id ||
        ![p.competitor_id,p.change_id,p.task_id,p.recipient_id,p.rule_id,p.evidence_id]
          .every(id => typeof id === "string" && id.length > 0)) return [];
    const owns = (alias: string, table: string, id: string) =>
      `JOIN account_owned_records ${alias} ON ${alias}.source_table='${table}' AND ${alias}.source_id=${id} AND ${alias}.account_id=c.account_id `;
    const [[row]] = await c.query<RowDataPacket[]>(
      "SELECT c.account_id FROM competitor_alerts a JOIN competitors c ON c.id=a.competitor_id " +
      "JOIN competitor_changes ch ON ch.id=a.change_id AND ch.competitor_id=c.id " +
      "JOIN competitor_snapshots s ON s.id=ch.snapshot_id AND s.competitor_id=c.id AND s.evidence_id=ch.evidence_id " +
      "JOIN competitor_monitor_rules rule ON rule.id=a.rule_id AND (rule.competitor_id IS NULL OR rule.competitor_id=c.id) " +
      "JOIN tasks t ON t.id=? AND t.account_id=c.account_id AND t.source_type='selection_verification' AND t.source_ref_id=ch.id AND t.deleted_at IS NULL " +
      "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
      owns("co","competitors","c.id") + owns("ao","competitor_alerts","a.id") +
      owns("ho","competitor_changes","ch.id") + owns("so","competitor_snapshots","s.id") +
      owns("ro","competitor_monitor_rules","rule.id") + owns("eo","raw_evidence","ch.evidence_id") +
      owns("to1","tasks","t.id") + owns("oo","outbox_events","a.id") +
      "WHERE a.id=? AND c.id=? AND ch.id=? AND a.rule_id=? AND ch.evidence_id=? AND c.account_id=? " +
      "AND (co.reason='exclusive_owner' OR (co.reason IN ('shared','unassigned') AND c.account_id=cut.primary_account_id)) LOCK IN SHARE MODE",
      [p.task_id,event.id,p.competitor_id,p.change_id,p.rule_id,p.evidence_id,p.recipient_id],
    );
    return row ? [String(row.account_id)] : [];
  }
  private async nativeTaskRecipients(c: PoolConnection, event: RowDataPacket, payload: any) {
    if (payload.task_account_contract !== 25 || Number(event.schema_version) !== 1 ||
        event.organization_id != null || event.workspace_id != null ||
        typeof payload.task_id !== "string" || typeof payload.assignee_id !== "string") return [];
    const [[row]] = await c.query<RowDataPacket[]>(
      "SELECT t.account_id FROM tasks t JOIN task_events e ON e.id=? AND e.task_id=t.id " +
      "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
      "JOIN account_owned_records t_owner ON t_owner.source_table='tasks' AND t_owner.source_id=t.id AND t_owner.account_id=t.account_id " +
      "JOIN account_owned_records e_owner ON e_owner.source_table='task_events' AND e_owner.source_id=e.id AND e_owner.account_id=t.account_id AND e_owner.reason=t_owner.reason " +
      "JOIN account_owned_records o_owner ON o_owner.source_table='outbox_events' AND o_owner.source_id=e.id AND o_owner.account_id=t.account_id AND o_owner.reason=t_owner.reason " +
      "WHERE t.id=? AND t.deleted_at IS NULL AND t.account_id=t.assignee_id AND t.assignee_id=? " +
      "AND (t_owner.reason='exclusive_owner' OR (t_owner.reason IN ('shared','unassigned') AND t.account_id=cut.primary_account_id)) " +
      "AND BINARY e.event_type=BINARY ? AND BINARY e.request_id=BINARY ? AND BINARY e.trace_id=BINARY ? LOCK IN SHARE MODE",
      [event.id, payload.task_id, payload.assignee_id, event.event_type, event.request_id, event.trace_id],
    );
    return row ? [String(row.account_id)] : [];
  }
  private async approvalOverdueRecipients(c: PoolConnection, event: RowDataPacket, p: any): Promise<string[]> {
    let receipt: RowDataPacket[];
    try {
      [receipt] = await c.query<RowDataPacket[]>(
        "SELECT contract_version,primary_account_id FROM account_ownership_cutover WHERE slot='current' LIMIT 1 LOCK IN SHARE MODE",
      );
    } catch (error) {
      const mysql = error as {code?: string; sqlMessage?: string};
      if (mysql.code !== "ER_NO_SUCH_TABLE" ||
          !/\.account_ownership_cutover' doesn't exist$/i.test(mysql.sqlMessage ?? "")) throw error;
      receipt = [];
    }
    const cutover = receipt[0];
    if (!cutover) return p?.account_projection_contract === undefined ? this.recipients(event, p) : [];
    const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
    const native = p?.account_projection_contract !== undefined;
    if (Number(cutover.contract_version) !== 25 || !uuid(p?.approval_request_id) || !uuid(p?.node_run_id) ||
        (native && (p.account_projection_contract !== 25 || !uuid(p.approval_action_id)))) return [];
    const own = (alias: string, table: string, id: string) =>
      `JOIN account_owned_records ${alias} ON ${alias}.source_table='${table}' AND ${alias}.source_id=${id} AND ${alias}.account_id=eo.account_id `;
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT n.active_approver_id,n.id,r.template_id,r.template_version_id,r.resource_type,r.resource_id,eo.account_id,eo.reason FROM account_owned_records eo " +
      "JOIN approval_requests r ON r.id=? AND r.status='pending' " +
      "JOIN approval_node_runs n ON n.id=? AND n.approval_request_id=r.id AND n.ordinal=r.current_node_ordinal " +
      "AND n.status='pending' AND n.escalated_at IS NOT NULL AND n.active_approver_id=n.escalation_assignee_id " +
      "JOIN users u ON u.id=n.active_approver_id AND u.status='active' " +
      "JOIN approval_actions a ON a.approval_request_id=r.id AND a.node_run_id=n.id " +
      "AND a.action='escalated' AND a.actor_id=n.active_approver_id AND a.created_at=n.escalated_at " +
      "AND BINARY a.request_id=BINARY ? AND BINARY a.trace_id=BINARY ? " +
      own("ro", "approval_requests", "r.id") + own("no", "approval_node_runs", "n.id") +
      own("ao", "approval_actions", "a.id") +
      "WHERE eo.source_table='outbox_events' AND eo.source_id=? " +
      "AND (eo.reason='exclusive_owner' OR (eo.reason IN ('shared','unassigned') AND eo.account_id=?)) " +
      (native ? "AND a.id=? " : "") + "LIMIT 2 LOCK IN SHARE MODE",
      [p.approval_request_id,p.node_run_id,event.request_id,event.trace_id,event.id,cutover.primary_account_id,
        ...(native ? [p.approval_action_id] : [])],
    );
    const run = rows.length === 1 ? rows[0] : undefined;
    if (!run) return [];
    const lineage = await readApprovalResourceOwners(c, run, String(run.account_id));
    if (!lineage || !(await calculationOwnersMatch(c, { owner: { account_id: run.account_id, reason: run.reason } }, [
      ["approval_templates", String(run.template_id)], ["approval_template_versions", String(run.template_version_id)], ...lineage,
    ]))) return [];
    return [String(run.active_approver_id)];
  }
  private async isStillActionable(event: any, payload: any) {
    if (event.event_type === "task.evidence_completion.redecision_ready")
      return this.isRedecisionActionable(event, payload);
    // These reminders check the pending review together with the recipient lookup.
    if (isCostReviewReminder(event.event_type)) return true;
    if (!String(event.event_type).startsWith("approval.cost_input.")) return true;
    return this.isLegacyCostReviewPending(event, payload);
  }
  private async isLegacyCostReviewPending(event: any, payload: any, transaction?: PoolConnection) {
    if (!payload.review_id) return false;
    const [rows] = await (transaction ?? this.pool).query<RowDataPacket[]>(
      "SELECT r.status FROM opportunity_cost_input_reviews r JOIN opportunities o ON o.id=r.opportunity_id JOIN opportunity_cost_inputs i ON i.id=r.cost_input_id AND i.opportunity_id=o.id WHERE r.id=? AND o.organization_id=? AND o.workspace_id=? LIMIT 1" + (transaction ? " LOCK IN SHARE MODE" : ""),
      [payload.review_id, event.organization_id, event.workspace_id],
    );
    return rows[0]?.status === "pending";
  }
  private async isRedecisionActionable(event: any, payload: any, transaction?: PoolConnection) {
    const db = transaction ?? this.pool;
    const lock = transaction ? " LOCK IN SHARE MODE" : "";
    const legacyDelivery = payload?.account_projection_contract === undefined &&
      Boolean(event.organization_id && event.workspace_id);
    if (!event.organization_id || !event.workspace_id) {
      if (!isNativeRedecisionDelivery(event, payload)) return false;
    } else if (payload?.account_projection_contract !== undefined && payload.account_projection_contract !== 25) {
      return false;
    }
    let owners: RowDataPacket[];
    try {
      [owners] = await db.query<RowDataPacket[]>(
        "SELECT account_id FROM account_owned_records WHERE source_table='outbox_events' AND source_id=?" + lock,
        [event.id],
      );
    } catch (error) {
      const mysql = error as { code?: string; sqlMessage?: string };
      if (mysql.code !== "ER_NO_SUCH_TABLE" ||
          !/\.account_owned_records' doesn't exist$/i.test(mysql.sqlMessage ?? "")) throw error;
      return legacyDelivery;
    }
    const owner = owners[0]?.account_id;
    if (!owner) return legacyDelivery;
    if (payload?.resource_type !== "opportunity" || payload.resource_id !== payload.opportunity_id ||
        payload.recipient_id !== owner ||
        ![payload.opportunity_id, payload.trigger_task_id, payload.score_run_id].every(
          id => typeof id === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id),
        )) return false;
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT 1 FROM opportunities p " +
        "JOIN account_owned_records po ON po.source_table='opportunities' AND po.source_id=p.id " +
        "JOIN opportunity_score_runs r ON r.opportunity_id=p.id AND r.id=? " +
        "JOIN account_owned_records ro ON ro.source_table='opportunity_score_runs' AND ro.source_id=r.id AND ro.account_id=po.account_id " +
        "JOIN tasks t ON t.id=? AND t.source_ref_id=p.id AND t.source_type='evidence_completion' AND t.status='completed' AND t.deleted_at IS NULL " +
        "JOIN account_owned_records task_owner ON task_owner.source_table='tasks' AND task_owner.source_id=t.id AND task_owner.account_id=po.account_id " +
        "WHERE p.id=? AND po.account_id=? AND BINARY r.request_id=BINARY ? AND BINARY r.trace_id=BINARY ? LIMIT 1" + lock,
      [payload.score_run_id, payload.trigger_task_id, payload.opportunity_id, owner, event.request_id, event.trace_id],
    );
    return rows.length === 1;
  }
  private async recipients(event: any, p: any) {
    return this.legacyRecipients(event, p);
  }
  private async legacyRecipients(event: any, p: any, db: Pick<Pool, "query"> = this.pool) {
    const direct = p.recipient_id ?? p.active_approver_id ?? p.assignee_id;
    if (direct) return [String(direct)];
    return this.legacyIndirectRecipients(event, p, db);
  }

  private async costReviewRecipients(db: PoolConnection, event: RowDataPacket, p: any) {
    const overdue = event.event_type === "approval.cost_input.overdue";
    const accountRecipients = await this.accountCostReviewRecipients(db, event, p, overdue);
    if (accountRecipients !== null) return accountRecipients;
    if (!event.organization_id || !event.workspace_id || !await this.isLegacyCostReviewPending(event, p, db)) return [];
    const direct = p.recipient_id ?? p.active_approver_id ?? p.assignee_id;
    if (!overdue) return direct ? [String(direct)] : [];
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT DISTINCT u.id user_id FROM users u JOIN memberships m ON m.user_id=u.id " +
        "JOIN organizations o ON o.id=m.organization_id AND o.status='active' " +
        "JOIN workspaces w ON w.organization_id=o.id AND w.id=? AND w.status='active' " +
        "JOIN membership_data_scopes s ON s.membership_id=m.id WHERE m.organization_id=? AND " +
        "u.email_normalized=? AND u.email_verified_at IS NOT NULL AND u.status='active' AND " +
        "m.status='active' AND (s.scope_type='organization' OR " +
        "(s.scope_type='workspace' AND s.workspace_id=w.id)) AND EXISTS (" +
        "SELECT 1 FROM membership_role_assignments a " +
        "JOIN roles r ON r.code=a.role_code AND r.category='organization' AND r.status='active' " +
        "JOIN role_capabilities c ON c.role_code=r.code AND c.capability_code='notification:read' " +
        "WHERE a.membership_id=m.id) LOCK IN SHARE MODE",
      [event.workspace_id, event.organization_id, PRIMARY_COST_APPROVER_EMAIL],
    );
    return [
      ...new Set([direct ? String(direct) : "", ...rows.map((row) => String(row.user_id))]),
    ].filter(Boolean);
  }
  private async legacyIndirectRecipients(event: any, p: any, db: Pick<Pool, "query">) {
    if (String(event.event_type).startsWith("approval.")) {
      const requestId = p.approval_request_id ?? p.resource_id;
      if (requestId) {
        const templateSource = await approvalTemplateScopeRelation(db);
        const org = templateSource === "approval_templates" ? "t.organization_id" : approvalRequestCoordinates("r","organization_id");
        const ws = templateSource === "approval_templates" ? "t.workspace_id" : approvalRequestCoordinates("r","workspace_id");
        const [rows] = await db.query<RowDataPacket[]>(
          `SELECT r.requested_by FROM approval_requests r JOIN ${templateSource} t ON t.id=r.template_id AND t.resource_type=r.resource_type ` +
            "JOIN approval_template_versions v ON v.id=r.template_version_id AND v.template_id=t.id " +
            `WHERE r.id=? AND ${org}=? AND ${ws}=? ` +
            "UNION SELECT n.active_approver_id FROM approval_node_runs n JOIN approval_requests r ON r.id=n.approval_request_id " +
            `JOIN ${templateSource} t ON t.id=r.template_id AND t.resource_type=r.resource_type ` +
            "JOIN approval_template_versions v ON v.id=r.template_version_id AND v.template_id=t.id " +
            `WHERE r.id=? AND ${org}=? AND ${ws}=? AND n.status='pending'`,
          [
            requestId,
            event.organization_id,
            event.workspace_id,
            requestId,
            event.organization_id,
            event.workspace_id,
          ],
        );
        return [
          ...new Set(
            rows.map((r) => String(r.requested_by ?? r.active_approver_id)).filter(Boolean),
          ),
        ];
      }
    }
    return [];
  }
  private async accountApprovalRecipients(event: any, p: any, db: PoolConnection): Promise<string[] | null> {
    const lock = " LOCK IN SHARE MODE";
    const native = p?.account_projection_contract !== undefined;
    if (native && (p.account_projection_contract !== 25 || event.organization_id != null || event.workspace_id != null)) return [];
    let receipt: RowDataPacket[];
    try {
      [receipt] = await db.query<RowDataPacket[]>(
        "SELECT contract_version,primary_account_id FROM account_ownership_cutover WHERE slot='current' LIMIT 1" + lock,
      );
    } catch (error) {
      const mysql = error as { code?: string; sqlMessage?: string };
      if (mysql.code !== "ER_NO_SUCH_TABLE" ||
          !/\.account_ownership_cutover' doesn't exist$/i.test(mysql.sqlMessage ?? "")) throw error;
      return native ? [] : null;
    }
    const cutover = receipt[0];
    if (!cutover) return native ? [] : null;
    const created = event.event_type === "approval.request.created";
    const id = p.approval_request_id ?? p.id;
    const nativeSourceId = created ? p.approval_escalation_job_id : p.approval_action_id;
    if (Number(cutover.contract_version) !== 25 || Number(event.schema_version) !== 1 ||
        typeof id !== "string" || !id || (p.id != null && p.id !== id) ||
        (native && (typeof nativeSourceId !== "string" || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(nativeSourceId))) ||
        (!created && (typeof p.node_run_id !== "string" || !p.node_run_id))) return [];
    const decision = event.event_type === "approval.node.approved" ? "approved" : "rejected";
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT r.requested_by requester,CASE WHEN no.account_id=eo.account_id THEN n.active_approver_id END approver," +
      "n.id pending_node_id,r.template_id,r.template_version_id,r.resource_type,r.resource_id,eo.account_id,eo.reason" +
      (created ? ",original_run.id first_node_id " : " ") +
      "FROM account_owned_records eo " +
      "JOIN approval_requests r ON r.id=? " +
      "JOIN account_owned_records ro ON ro.source_table='approval_requests' AND ro.source_id=r.id AND ro.account_id=eo.account_id " +
      "JOIN approval_templates t ON t.id=r.template_id AND t.resource_type=r.resource_type " +
      "JOIN approval_template_versions v ON v.id=r.template_version_id AND v.template_id=t.id " +
      "JOIN account_owned_records tor ON tor.source_table='approval_templates' AND tor.source_id=t.id AND tor.account_id=eo.account_id " +
      "JOIN account_owned_records vo ON vo.source_table='approval_template_versions' AND vo.source_id=v.id AND vo.account_id=eo.account_id " +
      (created ? "JOIN approval_node_runs original_run ON original_run.approval_request_id=r.id AND original_run.ordinal=1 " : "") +
      "LEFT JOIN approval_node_runs n ON n.approval_request_id=r.id AND n.ordinal=r.current_node_ordinal AND n.status='pending' " +
      "LEFT JOIN account_owned_records no ON no.source_table='approval_node_runs' AND no.source_id=n.id " +
      "WHERE eo.source_table='outbox_events' AND eo.source_id=? " +
      "AND (eo.reason='exclusive_owner' OR (eo.reason IN ('shared','unassigned') AND eo.account_id=?)) " +
      (created ? "AND EXISTS (SELECT 1 FROM approval_escalation_jobs j " +
        "JOIN account_owned_records jo ON jo.source_table='approval_escalation_jobs' AND jo.source_id=j.id " +
        "JOIN account_owned_records fo ON fo.source_table='approval_node_runs' AND fo.source_id=j.node_run_id " +
        "WHERE j.approval_request_id=r.id AND j.node_run_id=original_run.id AND jo.account_id=eo.account_id AND fo.account_id=eo.account_id " +
        "AND BINARY j.request_id=BINARY ? AND BINARY j.trace_id=BINARY ?" +
        (native ? " AND j.id=?" : "") + lock + ")" :
        "AND EXISTS (SELECT 1 FROM approval_actions a " +
        "JOIN approval_node_runs dn ON dn.id=a.node_run_id AND dn.approval_request_id=a.approval_request_id " +
        "JOIN account_owned_records dno ON dno.source_table='approval_node_runs' AND dno.source_id=dn.id " +
        "JOIN account_owned_records ao ON ao.source_table='approval_actions' AND ao.source_id=a.id " +
        "WHERE a.approval_request_id=r.id AND a.node_run_id=? AND a.action=? " +
        "AND dno.account_id=eo.account_id AND ao.account_id=eo.account_id " +
        "AND BINARY a.request_id=BINARY ? AND BINARY a.trace_id=BINARY ?" +
        (native ? " AND a.id=?" : "") + lock + ")") + lock,
      [id, event.id, cutover.primary_account_id, ...(created ? [] : [p.node_run_id, decision]),
        event.request_id, event.trace_id, ...(native ? [nativeSourceId] : [])],
    );
    const row = rows.length === 1 ? rows[0] : undefined;
    if (!row) return [];
    const sourceNodeId = created ? row.first_node_id : p.node_run_id;
    const ownership = { owner: { account_id: row.account_id, reason: row.reason } };
    const matchesLineage = async (id: string) => {
      const refs = await readApprovalResourceOwners(db, { ...row, id }, String(row.account_id));
      return refs !== null && await calculationOwnersMatch(db, ownership, refs);
    };
    if (!sourceNodeId || !await matchesLineage(sourceNodeId)) return [];
    const approver = row.approver && row.pending_node_id &&
      (row.pending_node_id === sourceNodeId || await matchesLineage(row.pending_node_id)) ? row.approver : null;
    return [...new Set([row.requester, approver].filter(Boolean).map(String))];
  }
  // A sealed cutover replaces the membership-based escalation, not the named reviewer.
  private async accountCostReviewRecipients(db: PoolConnection, event: RowDataPacket, p: any, overdue: boolean): Promise<string[] | null> {
    let cutover: RowDataPacket[];
    try {
      [cutover] = await db.query<RowDataPacket[]>(
        "SELECT primary_account_id,contract_version FROM account_ownership_cutover WHERE slot='current' LIMIT 1 LOCK IN SHARE MODE",
      );
    } catch (error) {
      const mysql = error as { code?: string; sqlMessage?: string };
      if (mysql.code !== "ER_NO_SUCH_TABLE" ||
          !/\.account_ownership_cutover' doesn't exist$/i.test(mysql.sqlMessage ?? "")) throw error;
      return null;
    }
    if (!cutover[0]) return null;
    if (Number(cutover[0].contract_version) !== 25 || !p.review_id ||
        p.resource_type !== "opportunity" || !p.opportunity_id || p.resource_id !== p.opportunity_id) return [];
    const coordinateFree = event.organization_id == null && event.workspace_id == null;
    if (coordinateFree ? Number(event.schema_version) !== 1 : !event.organization_id || !event.workspace_id) return [];
    const native = await nativeOpportunityStorage(db);
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT r.reviewer_id,CASE WHEN po.account_id=u.id AND u.status='active' " +
        "AND u.email_verified_at IS NOT NULL AND BINARY u.email_normalized=BINARY ? THEN u.id ELSE NULL END primary_recipient " +
        "FROM opportunity_cost_input_reviews r JOIN opportunity_cost_inputs i ON i.id=r.cost_input_id AND i.opportunity_id=r.opportunity_id " +
        "JOIN opportunities p ON p.id=r.opportunity_id " +
        "JOIN account_owned_records po ON po.source_table='opportunities' AND po.source_id=p.id " +
        (native ? "AND p.account_id=po.account_id " : "") +
        "JOIN account_owned_records io ON io.source_table='opportunity_cost_inputs' AND io.source_id=i.id AND io.account_id=po.account_id " +
        "JOIN account_owned_records ro ON ro.source_table='opportunity_cost_input_reviews' AND ro.source_id=r.id AND ro.account_id=po.account_id " +
        "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 AND cut.primary_account_id=? " +
        "JOIN users u ON u.id=cut.primary_account_id WHERE r.id=? AND p.id=? AND r.status='pending' " +
        "AND (po.reason='exclusive_owner' OR (po.reason IN ('shared','unassigned') AND po.account_id=cut.primary_account_id)) " +
        "AND BINARY LEFT(r.request_id,64)=BINARY ? AND BINARY LEFT(r.trace_id,64)=BINARY ? " +
        (coordinateFree ? "AND EXISTS (SELECT 1 FROM account_owned_records eo WHERE eo.source_table='outbox_events' " +
          "AND eo.source_id=? AND eo.account_id=po.account_id AND eo.reason=po.reason) " : "") +
        "LIMIT 1 LOCK IN SHARE MODE",
      [PRIMARY_COST_APPROVER_EMAIL, cutover[0].primary_account_id, p.review_id, p.opportunity_id, event.request_id, event.trace_id, ...(coordinateFree ? [event.id] : [])],
    );
    const row = rows[0];
    return row ? [...new Set([row.reviewer_id, overdue ? row.primary_recipient : null].filter(Boolean).map(String))] : [];
  }
  private async create(event: any, p: any, category: string, recipient: string, now: Date, db: Pick<Pool, "query"> = this.pool) {
    const accountDelivery = (isApprovalWorkflowDelivery(event.event_type) || event.event_type === "approval.overdue" || isCostReviewReminder(event.event_type) || isNativeTaskDelivery(event.event_type, p) || isNativeCompetitorDelivery(event.event_type, p) || isNativeAutomationDelivery(event, p) || isNativeRedecisionDelivery(event, p)) &&
      event.organization_id == null && event.workspace_id == null;
    if (accountDelivery) await notificationPreferencesAccountSchema(db);
    const [prefs] = accountDelivery
      ? await db.query<RowDataPacket[]>("SELECT * FROM notification_preferences WHERE user_id=?", [recipient])
      : await readDeliveryNotificationPreferences(db, event.organization_id, event.workspace_id, recipient),
      pref = prefs[0],
      categoryEnabled = !pref || Boolean(pref[`${category}_enabled`]),
      inApp = !pref || Boolean(pref.in_app_enabled),
      email = Boolean(pref?.email_enabled);
    if (!categoryEnabled) return false;
    const legacyDelivery = await notificationDeliveryScopeColumns(db);
    let legacyRealtime: boolean | undefined;
    try {
      legacyRealtime = await realtimeEventScopeColumns(db);
    } catch (error) {
      if ((error as { code?: string }).code !== "ER_NO_SUCH_TABLE") throw error;
    }
    const redecisionReady = event.event_type === "task.evidence_completion.redecision_ready",
      costDueSoon = event.event_type === "approval.cost_input.review_due_soon",
      costOverdue = event.event_type === "approval.cost_input.overdue",
      title = redecisionReady
        ? String(p.title ?? "机会可重新决策")
        : costDueSoon
          ? "成本复核即将到期"
          : costOverdue
            ? "成本复核已超时"
            : category === "system" && p.title
              ? String(p.title)
              : category === "approval"
                ? "审批状态更新"
                : category === "competitor"
                  ? "竞品监控更新"
                  : "任务状态更新",
      body = redecisionReady
        ? "补采与重新评分已完成，请查看最新证据、阻断状态和评分后重新决策。"
        : costDueSoon
          ? "该成本输入将在 4 小时后到期，请核对金额、来源与证据并完成复核。"
          : costOverdue
            ? "该成本输入已超过 24 小时复核期限，仍不会自动生效，请立即处理。"
            : notificationBody(category),
      resourceType = p.resource_type ?? category,
      resourceId = p.resource_id ?? p.task_id ?? p.approval_request_id ?? null,
      notificationId = randomUUID();
    await appendScopedNotification(db,
      "INSERT IGNORE INTO notifications (id,organization_id,workspace_id,recipient_id,source_event_id,category,severity,title,body,resource_type,resource_id,root_cause_key,read_at,workflow_status,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL,'open',1,?,?)",
      [
        notificationId,
        event.organization_id,
        event.workspace_id,
        recipient,
        event.id,
        category,
        event.event_type === "approval.overdue" || costOverdue ? "warning" : "info",
        title,
        body,
        resourceType,
        resourceId,
        `${String(event.event_type).slice(0, 100)}:${String(resourceType).slice(0, 80)}:${String(resourceId ?? "none").slice(0, 36)}`,
        now,
        now,
      ],
    );
    const [found] = await db.query<RowDataPacket[]>(
        "SELECT id FROM notifications WHERE source_event_id=? AND recipient_id=?",
        [event.id, recipient],
      ),
      id = String(found[0]!.id);
    try {
      if (legacyRealtime !== undefined) await db.query(
        `INSERT IGNORE INTO realtime_events (${legacyRealtime ? "organization_id,workspace_id," : ""}recipient_id,notification_id,event_type,payload_json,created_at) VALUES (${legacyRealtime ? "?,?," : ""}?,?, 'notification.changed',?,?)`,
        [
          ...(legacyRealtime ? [event.organization_id, event.workspace_id] : []),
          recipient,
          id,
          JSON.stringify({
            notification_id: id,
            category,
            severity: event.event_type === "approval.overdue" || costOverdue ? "warning" : "info",
          }),
          now,
        ],
      );
    } catch (error) {
      if ((error as { code?: string }).code !== "ER_NO_SUCH_TABLE") throw error;
    }
    await db.query(
      `INSERT IGNORE INTO notification_deliveries (id,${legacyDelivery ? "organization_id,workspace_id," : ""}notification_id,recipient_id,channel,status,attempt_count,created_at,updated_at) VALUES (${legacyDelivery ? "?,?," : ""}?,?,?,'in_app',?,0,?,?)`,
      [
        randomUUID(),
        ...(legacyDelivery ? [event.organization_id, event.workspace_id] : []),
        id,
        recipient,
        inApp ? "delivered" : "suppressed",
        now,
        now,
      ],
    );
    await db.query(
      `INSERT IGNORE INTO notification_deliveries (id,${legacyDelivery ? "organization_id,workspace_id," : ""}notification_id,recipient_id,channel,status,attempt_count,provider_ref,created_at,updated_at) VALUES (${legacyDelivery ? "?,?," : ""}?,?,?,'email',?,0,'placeholder:no-provider',?,?)`,
      [
        randomUUID(),
        ...(legacyDelivery ? [event.organization_id, event.workspace_id] : []),
        id,
        recipient,
        email ? "pending_placeholder" : "suppressed",
        now,
        now,
      ],
    );
    return true;
  }
}
