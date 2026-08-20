import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { ApprovalServiceError, type ApprovalRepository } from "./approval-service.js";

const parse = <T>(value: unknown): T =>
  typeof value === "string" ? JSON.parse(value) : (value as T);
const iso = (value: unknown) =>
  value == null ? null : (value instanceof Date ? value : new Date(String(value))).toISOString();

export class MySqlApprovalRepository implements ApprovalRepository {
  constructor(
    private readonly pool: Pool,
    private readonly now = () => new Date(),
  ) {}

  async listTemplates(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT t.*,COUNT(n.id) node_count FROM approval_templates t LEFT JOIN approval_template_versions " +
        "v ON v.template_id=t.id AND v.version_number=t.current_version LEFT JOIN approval_template_nodes " +
        "n ON n.template_version_id=v.id WHERE t.organization_id=? AND t.workspace_id=? GROUP " +
        "BY t.id ORDER BY t.updated_at DESC",
      [i.organizationId, i.workspaceId],
    );
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      resource_type: String(row.resource_type),
      status: String(row.status),
      current_version: Number(row.current_version),
      revision: Number(row.revision),
      node_count: Number(row.node_count),
      published_at: iso(row.published_at),
      updated_at: iso(row.updated_at),
    }));
  }

  async createTemplate(i: any) {
    const previous = await this.operation(i);
    if (previous) return previous;
    for (const node of i.value.nodes) {
      await this.ensureMember(i.organizationId, i.workspaceId, node.approver_id);
      await this.ensureMember(i.organizationId, i.workspaceId, node.escalation_assignee_id);
    }
    const connection = await this.pool.getConnection(),
      now = this.now();
    try {
      await connection.beginTransaction();
      await connection.query(
        "INSERT INTO approval_templates (id,organization_id,workspace_id,name,resource_type," +
          "status,current_version,revision,created_by,created_at,updated_at) VALUES (?," +
          "?,?,?,?,'draft',1,1,?,?,?)",
        [
          i.id,
          i.organizationId,
          i.workspaceId,
          i.value.name,
          i.value.resource_type,
          i.actorId,
          now,
          now,
        ],
      );
      await connection.query(
        "INSERT INTO approval_template_versions (id,template_id,organization_id,workspace_id," +
          "version_number,status,created_by,created_at) VALUES (?,?,?,?,1,'draft',?," +
          "?)",
        [i.versionId, i.id, i.organizationId, i.workspaceId, i.actorId, now],
      );
      for (const node of i.value.nodes)
        await connection.query(
          "INSERT INTO approval_template_nodes (id,template_version_id,organization_id," +
            "workspace_id,ordinal,name,approver_id,sla_minutes,escalation_assignee_id) VALUES (?," +
            "?,?,?,?,?,?,?,?)",
          [
            randomUUID(),
            i.versionId,
            i.organizationId,
            i.workspaceId,
            node.ordinal,
            node.name,
            node.approver_id,
            node.sla_minutes,
            node.escalation_assignee_id,
          ],
        );
      const result = {
        id: i.id,
        status: "draft",
        current_version: 1,
        revision: 1,
      };
      await this.record(
        connection,
        i,
        "approval.template.created",
        "approval_template",
        i.id,
        { ...result, node_count: i.value.nodes.length },
        now,
      );
      await this.save(connection, i, i.id, result, now);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async publishTemplate(i: any) {
    const previous = await this.operation(i);
    if (previous) return previous;
    const connection = await this.pool.getConnection(),
      now = this.now();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM approval_templates WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
        [i.templateId, i.organizationId, i.workspaceId],
      );
      const row = rows[0];
      if (!row)
        throw new ApprovalServiceError("approval_template_not_found", 404, "刷新模板列表。");
      if (Number(row.revision) !== i.expectedRevision)
        throw new ApprovalServiceError("approval_version_conflict", 409, "刷新模板后重试。");
      if (row.status !== "draft")
        throw new ApprovalServiceError(
          "approval_template_state_invalid",
          409,
          "仅草稿模板可发布。",
        );
      const [versions] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM approval_template_versions WHERE template_id=? AND version_number=? AND status='draft'",
        [i.templateId, row.current_version],
      );
      if (!versions[0])
        throw new ApprovalServiceError(
          "approval_template_version_missing",
          409,
          "补全草稿版本后重试。",
        );
      const revision = Number(row.revision) + 1;
      await connection.query(
        "UPDATE approval_template_versions SET status='published',published_at=? WHERE id=?",
        [now, versions[0].id],
      );
      await connection.query(
        "UPDATE approval_templates SET status='published',revision=?,published_by=?,published_at=?,updated_at=? WHERE id=?",
        [revision, i.actorId, now, now, i.templateId],
      );
      const result = {
        id: i.templateId,
        status: "published",
        current_version: Number(row.current_version),
        revision,
      };
      await this.record(
        connection,
        i,
        "approval.template.published",
        "approval_template",
        i.templateId,
        { ...result, reason: i.reason },
        now,
      );
      await this.save(connection, i, i.templateId, result, now);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listRequests(i: any) {
    const where = ["r.organization_id=?", "r.workspace_id=?"],
      args: any[] = [i.organizationId, i.workspaceId];
    if (i.status) {
      where.push("r.status=?");
      args.push(i.status);
    }
    if (i.mine) {
      where.push(
        "(r.requested_by=? OR EXISTS(SELECT 1 FROM approval_node_runs nr " +
          "WHERE nr.approval_request_id=r.id AND nr.active_approver_id=? " +
          "AND nr.status='pending'))",
      );
      args.push(i.actorId, i.actorId);
    }
    const [count] = await this.pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) total FROM approval_requests r WHERE ${where.join(" AND ")}`,
        args,
      ),
      [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT r.*,t.name template_name,n.name current_node_name,
          n.active_approver_id,n.due_at,n.escalated_at
         FROM approval_requests r
         JOIN approval_templates t ON t.id=r.template_id
         LEFT JOIN approval_node_runs n ON n.approval_request_id=r.id
          AND n.ordinal=r.current_node_ordinal
         WHERE ${where.join(" AND ")}
         ORDER BY (r.status='pending') DESC,r.updated_at DESC LIMIT ? OFFSET ?`,
        [...args, i.pageSize, (i.page - 1) * i.pageSize],
      );
    return {
      items: rows.map((r) => this.request(r, i.actorId)),
      page: i.page,
      page_size: i.pageSize,
      total: Number(count[0]?.total ?? 0),
    };
  }

  async detail(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT r.*,t.name template_name,v.version_number rule_version,n.name current_node_name," +
        "n.active_approver_id,n.due_at,n.escalated_at FROM approval_requests r JOIN approval_templates " +
        "t ON t.id=r.template_id JOIN approval_template_versions v ON v.id=r.template_version_id " +
        "LEFT JOIN approval_node_runs n ON n.approval_request_id=r.id AND n.ordinal=r.current_node_ordinal " +
        "WHERE r.id=? AND r.organization_id=? AND r.workspace_id=?",
      [i.requestIdValue, i.organizationId, i.workspaceId],
    );
    if (!rows[0])
      throw new ApprovalServiceError("approval_request_not_found", 404, "刷新审批列表。");
    const [nodes] = await this.pool.query<RowDataPacket[]>(
        "SELECT n.*,\n                approver_profile.display_name active_approver_name," +
          "\n                decided_profile.display_name decided_by_name\n         FROM approval_node_runs " +
          "n\n         LEFT JOIN user_profiles approver_profile\n           ON approver_profile.user_id=n.active_approver_id\n" +
          "         LEFT JOIN user_profiles decided_profile\n           ON decided_profile.user_id=n.decided_by\n" +
          "         WHERE n.approval_request_id=?\n           AND n.organization_id=?\n          " +
          " AND n.workspace_id=?\n         ORDER BY n.ordinal",
        [i.requestIdValue, i.organizationId, i.workspaceId],
      ),
      [actions] = await this.pool.query<RowDataPacket[]>(
        "SELECT a.id,a.node_run_id,a.action,a.reason,a.actor_id,a.created_at,\n               " +
          " actor_profile.display_name actor_name\n         FROM approval_actions a\n         LEFT " +
          "JOIN user_profiles actor_profile\n           ON actor_profile.user_id=a.actor_id\n    " +
          "     WHERE a.approval_request_id=?\n           AND a.organization_id=?\n           AND " +
          "a.workspace_id=?\n         ORDER BY a.created_at,a.id",
        [i.requestIdValue, i.organizationId, i.workspaceId],
      );
    const approvalTemplateVersion = Number(rows[0].rule_version),
      decisionContext = rows[0].decision_context_json
        ? parse(rows[0].decision_context_json)
        : await this.loadDecisionContext(
            this.pool,
            {
              organizationId: i.organizationId,
              workspaceId: i.workspaceId,
              resourceType: String(rows[0].resource_type),
              resourceId: String(rows[0].resource_id),
              approvalTemplateVersion,
            },
            this.now(),
            "live_fallback",
          );
    return {
      ...this.request(rows[0], i.actorId),
      approval_template_version: approvalTemplateVersion,
      decision_context: decisionContext,
      nodes: nodes.map((r) => ({
        id: String(r.id),
        ordinal: Number(r.ordinal),
        name: String(r.name),
        approver_id: String(r.approver_id),
        active_approver_id: String(r.active_approver_id),
        active_approver_name: r.active_approver_name
          ? String(r.active_approver_name)
          : "未设置展示名称",
        escalation_assignee_id: String(r.escalation_assignee_id),
        status: String(r.status),
        due_at: iso(r.due_at),
        escalated_at: iso(r.escalated_at),
        decided_by: r.decided_by ? String(r.decided_by) : null,
        decided_by_name: r.decided_by_name ? String(r.decided_by_name) : null,
        decision_reason: r.decision_reason ? String(r.decision_reason) : null,
        decided_at: iso(r.decided_at),
        version: Number(r.version),
      })),
      actions: actions.map((r) => ({
        id: String(r.id),
        node_run_id: String(r.node_run_id),
        action: String(r.action),
        reason: String(r.reason),
        actor_id: String(r.actor_id),
        actor_name: r.actor_name ? String(r.actor_name) : "未设置展示名称",
        created_at: iso(r.created_at),
      })),
    };
  }

  async createRequest(i: any) {
    const previous = await this.operation(i);
    if (previous) return previous;
    const connection = await this.pool.getConnection(),
      now = this.now();
    try {
      await connection.beginTransaction();
      const [templates] = await connection.query<RowDataPacket[]>(
        "SELECT t.*,v.id version_id FROM approval_templates t JOIN approval_template_versions " +
          "v ON v.template_id=t.id AND v.version_number=t.current_version AND v.status='published' " +
          "WHERE t.id=? AND t.organization_id=? AND t.workspace_id=? AND t.status='published' FOR " +
          "UPDATE",
        [i.value.template_id, i.organizationId, i.workspaceId],
      );
      const template = templates[0];
      if (!template)
        throw new ApprovalServiceError("approval_template_not_published", 409, "选择已发布模板。");
      if (template.resource_type !== i.value.resource_type)
        throw new ApprovalServiceError(
          "approval_resource_type_mismatch",
          409,
          "选择与资源类型一致的模板。",
        );
      await this.ensureResource(connection, i, i.value.resource_type, i.value.resource_id);
      const decisionContext = await this.loadDecisionContext(
        connection,
        {
          organizationId: i.organizationId,
          workspaceId: i.workspaceId,
          resourceType: i.value.resource_type,
          resourceId: i.value.resource_id,
          approvalTemplateVersion: Number(template.current_version),
        },
        now,
        "captured",
      );
      const [nodes] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM approval_template_nodes WHERE template_version_id=? ORDER BY ordinal",
        [template.version_id],
      );
      if (!nodes.length)
        throw new ApprovalServiceError("approval_nodes_invalid", 409, "模板没有审批节点。");
      await connection.query(
        "INSERT INTO approval_requests (id,organization_id,workspace_id,template_id," +
          "template_version_id,resource_type,resource_id,title,decision_context_json," +
          "status,current_node_ordinal,requested_by,version,created_at,updated_at) VALUES (?," +
          "?,?,?,?,?,?,?,?,'pending',1,?,1,?,?)",
        [
          i.id,
          i.organizationId,
          i.workspaceId,
          template.id,
          template.version_id,
          i.value.resource_type,
          i.value.resource_id,
          i.value.title,
          JSON.stringify(decisionContext),
          i.actorId,
          now,
          now,
        ],
      );
      for (const node of nodes) {
        const runId = randomUUID(),
          pending = Number(node.ordinal) === 1,
          due = pending ? new Date(now.valueOf() + Number(node.sla_minutes) * 60000) : null;
        await connection.query(
          "INSERT INTO approval_node_runs (id,approval_request_id,organization_id,workspace_id," +
            "template_node_id,ordinal,name,approver_id,active_approver_id,escalation_assignee_id," +
            "status,due_at,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?," +
            "?, ?,1,?,?)",
          [
            runId,
            i.id,
            i.organizationId,
            i.workspaceId,
            node.id,
            node.ordinal,
            node.name,
            node.approver_id,
            node.approver_id,
            node.escalation_assignee_id,
            pending ? "pending" : "waiting",
            due,
            now,
            now,
          ],
        );
        if (pending) await this.insertJob(connection, i, i.id, runId, due!, now);
      }
      const result = {
        id: i.id,
        status: "pending",
        current_node_ordinal: 1,
        version: 1,
      };
      await this.record(
        connection,
        i,
        "approval.request.created",
        "approval_request",
        i.id,
        {
          ...result,
          resource_type: i.value.resource_type,
          resource_id: i.value.resource_id,
          evidence_complete: decisionContext.evidence.is_complete,
          missing_items: decisionContext.evidence.missing_items,
          rule_versions: decisionContext.rule_versions,
        },
        now,
      );
      await this.save(connection, i, i.id, result, now);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async decide(i: any) {
    const previous = await this.operation(i);
    if (previous) return previous;
    const connection = await this.pool.getConnection(),
      now = this.now();
    try {
      await connection.beginTransaction();
      const [requests] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM approval_requests WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
        [i.requestIdValue, i.organizationId, i.workspaceId],
      );
      const request = requests[0];
      if (!request)
        throw new ApprovalServiceError("approval_request_not_found", 404, "刷新审批列表。");
      if (request.status !== "pending")
        throw new ApprovalServiceError("approval_request_state_invalid", 409, "审批单已结束。");
      if (Number(request.version) !== i.value.expected_version)
        throw new ApprovalServiceError("approval_version_conflict", 409, "刷新审批单后重试。");
      const [runs] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM approval_node_runs WHERE approval_request_id=? AND ordinal=? AND organization_id=? " +
          "AND workspace_id=? FOR UPDATE",
        [i.requestIdValue, request.current_node_ordinal, i.organizationId, i.workspaceId],
      );
      const run = runs[0];
      if (!run || run.status !== "pending")
        throw new ApprovalServiceError("approval_node_state_invalid", 409, "当前节点不可审批。");
      if (String(run.active_approver_id) !== i.actorId)
        throw new ApprovalServiceError("approval_actor_forbidden", 403, "由当前节点审批人处理。");
      const approved = i.value.action === "approve",
        version = Number(request.version) + 1;
      await connection.query(
        "UPDATE approval_node_runs SET status=?,decided_by=?,decision_reason=?,decided_at=?," +
          "version=version+1,updated_at=? WHERE id=?",
        [approved ? "approved" : "rejected", i.actorId, i.value.reason, now, now, run.id],
      );
      await connection.query(
        "INSERT INTO approval_actions (id,organization_id,workspace_id,approval_request_id," +
          "node_run_id,action,reason,actor_id,request_id,trace_id,created_at) VALUES (?," +
          "?,?,?,?,?,?,?,?,?,?)",
        [
          randomUUID(),
          i.organizationId,
          i.workspaceId,
          i.requestIdValue,
          run.id,
          approved ? "approved" : "rejected",
          i.value.reason,
          i.actorId,
          i.requestId,
          i.traceId,
          now,
        ],
      );
      let status = "rejected",
        ordinal = Number(request.current_node_ordinal),
        completed: any = now;
      if (approved) {
        const [nextRows] = await connection.query<RowDataPacket[]>(
          "SELECT r.*,n.sla_minutes FROM approval_node_runs r JOIN approval_template_nodes n ON " +
            "n.id=r.template_node_id WHERE r.approval_request_id=? AND r.ordinal=? FOR UPDATE",
          [i.requestIdValue, ordinal + 1],
        );
        const next = nextRows[0];
        if (next) {
          status = "pending";
          ordinal++;
          completed = null;
          const due = new Date(now.valueOf() + Number(next.sla_minutes) * 60000);
          await connection.query(
            "UPDATE approval_node_runs SET status='pending',due_at=?,updated_at=? WHERE id=?",
            [due, now, next.id],
          );
          await this.insertJob(connection, i, i.requestIdValue, String(next.id), due, now);
        } else status = "approved";
      }
      await connection.query(
        "UPDATE approval_requests SET status=?,current_node_ordinal=?,completed_at=?,version=?,updated_at=? WHERE id=?",
        [status, ordinal, completed, version, now, i.requestIdValue],
      );
      const result = {
        id: i.requestIdValue,
        status,
        current_node_ordinal: ordinal,
        version,
      };
      await this.record(
        connection,
        i,
        approved ? "approval.node.approved" : "approval.node.rejected",
        "approval_request",
        i.requestIdValue,
        { ...result, node_run_id: String(run.id), reason: i.value.reason },
        now,
      );
      await this.save(connection, i, i.requestIdValue, result, now);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private request(r: RowDataPacket, actorId: string) {
    return {
      id: String(r.id),
      template_id: String(r.template_id),
      template_name: String(r.template_name ?? ""),
      resource_type: String(r.resource_type),
      resource_id: String(r.resource_id),
      title: String(r.title),
      status: String(r.status),
      current_node_ordinal: Number(r.current_node_ordinal),
      current_node_name: r.current_node_name ? String(r.current_node_name) : null,
      active_approver_id: r.active_approver_id ? String(r.active_approver_id) : null,
      can_decide: r.status === "pending" && String(r.active_approver_id ?? "") === actorId,
      due_at: iso(r.due_at),
      escalated_at: iso(r.escalated_at),
      requested_by: String(r.requested_by),
      completed_at: iso(r.completed_at),
      version: Number(r.version),
      created_at: iso(r.created_at),
      updated_at: iso(r.updated_at),
    };
  }
  private async loadDecisionContext(
    queryable: any,
    input: {
      organizationId: string;
      workspaceId: string;
      resourceType: string;
      resourceId: string;
      approvalTemplateVersion: number;
    },
    now: Date,
    snapshotStatus: "captured" | "live_fallback",
  ) {
    if (input.resourceType === "task") {
      const [rows] = await queryable.query(
          "SELECT t.title,t.status,t.priority,t.progress_percent,t.due_at,\n                  profile.display_name " +
            "assignee_name\n           FROM tasks t\n           LEFT JOIN user_profiles profile ON " +
            "profile.user_id=t.assignee_id\n           WHERE t.id=? AND t.organization_id=? AND t.workspace_id=?\n" +
            "           LIMIT 1",
          [input.resourceId, input.organizationId, input.workspaceId],
        ),
        task = rows[0];
      return {
        schema_version: 1,
        snapshot_status: snapshotStatus,
        captured_at: snapshotStatus === "captured" ? iso(now) : null,
        observed_at: iso(now),
        resource: {
          type: "task",
          id: input.resourceId,
          label: task?.title ? String(task.title) : "关联任务",
          route: `/tasks?task=${input.resourceId}`,
        },
        evidence: {
          applicable: false,
          complete: 0,
          total: 0,
          percent: null,
          is_complete: null,
          missing_items: [],
          note: "任务审批未配置独立证据完整度规则。",
          requirements: [],
        },
        rule_versions: {
          approval_template: `v${input.approvalTemplateVersion}`,
          scoring: null,
          profit: null,
        },
        decision: null,
        basis_items: task
          ? [
              { code: "task_status", label: "任务状态", value: task.status },
              { code: "task_priority", label: "任务优先级", value: task.priority },
              {
                code: "task_progress",
                label: "任务进度",
                value: `${Number(task.progress_percent)}%`,
              },
              {
                code: "task_assignee",
                label: "任务负责人",
                value: task.assignee_name ? String(task.assignee_name) : "未设置展示名称",
              },
              {
                code: "task_due_at",
                label: "任务期限",
                value: iso(task.due_at),
              },
            ]
          : [],
        evidence_complete: 0,
        evidence_total: 0,
        missing_items: [],
        rule_version: `approval-v${input.approvalTemplateVersion}`,
        basis: ["任务状态、优先级、进度、负责人和期限"],
      };
    }
    const [decisionRows] = await queryable.query(
        "SELECT d.action,d.reason,d.opportunity_version,d.created_at decision_created_at," +
          "\n                o.id opportunity_id,o.name opportunity_name,o.recommendation_status," +
          "\n                o.risk_level,o.score_rule_version\n         FROM opportunity_decisions " +
          "d\n         JOIN opportunities o\n           ON o.id=d.opportunity_id\n          AND o.organization_id=d.organization_id\n" +
          "          AND o.workspace_id=d.workspace_id\n         WHERE d.id=? AND d.organization_id=? " +
          "AND d.workspace_id=?\n         LIMIT 1",
        [input.resourceId, input.organizationId, input.workspaceId],
      ),
      decision = decisionRows[0];
    if (!decision)
      throw new ApprovalServiceError(
        "approval_resource_not_found",
        404,
        "关联机会决策不存在，请刷新审批列表。",
      );
    const [scoreRows] = await queryable.query(
        "SELECT status,coverage_percent,recommendation_status,\n                rule_version_code," +
          "missing_fields_json,scored_at\n         FROM opportunity_score_runs\n         WHERE opportunity_id=? " +
          "AND organization_id=? AND workspace_id=?\n         ORDER BY scored_at DESC," +
          "id DESC\n         LIMIT 1",
        [decision.opportunity_id, input.organizationId, input.workspaceId],
      ),
      [profitRows] = await queryable.query(
        "SELECT status,rule_version_code,missing_fields_json,calculated_at\n         FROM opportunity_profit_runs\n" +
          "         WHERE opportunity_id=? AND organization_id=? AND workspace_id=?\n         ORDER " +
          "BY calculated_at DESC,id DESC\n         LIMIT 1",
        [decision.opportunity_id, input.organizationId, input.workspaceId],
      ),
      [evidenceRows] = await queryable.query(
        "SELECT COUNT(*) evidence_count,COUNT(DISTINCT provider_id) source_count\n         FROM " +
          "opportunity_evidence_links\n         WHERE opportunity_id=? AND organization_id=? AND " +
          "workspace_id=?",
        [decision.opportunity_id, input.organizationId, input.workspaceId],
      ),
      score = scoreRows[0],
      profit = profitRows[0],
      evidenceCount = Number(evidenceRows[0]?.evidence_count ?? 0),
      sourceCount = Number(evidenceRows[0]?.source_count ?? 0),
      scoreMissing = score ? parse<string[]>(score.missing_fields_json) : [],
      profitMissing = profit ? parse<string[]>(profit.missing_fields_json) : [],
      requirements = [
        {
          code: "market_evidence",
          label: "市场证据",
          complete: evidenceCount > 0,
          detail: `${evidenceCount} 条证据，来自 ${sourceCount} 个来源`,
          route: `/opportunities/${decision.opportunity_id}?tab=evidence`,
        },
        {
          code: "scoring",
          label: "评分依据",
          complete: score?.status === "calculated",
          detail: score
            ? `覆盖 ${Number(score.coverage_percent)}%，缺失 ${scoreMissing.length} 项`
            : "尚无评分运行",
          route: `/opportunities/${decision.opportunity_id}?tab=overview`,
        },
        {
          code: "profit",
          label: "利润依据",
          complete: profit?.status === "calculated",
          detail: profit
            ? profit.status === "calculated"
              ? "利润输入与规则已完成计算"
              : `缺失 ${profitMissing.length} 项利润输入`
            : "尚无利润运行",
          route: `/opportunities/${decision.opportunity_id}?tab=profit`,
        },
        {
          code: "risk",
          label: "风险识别",
          complete: decision.risk_level !== "unknown",
          detail:
            decision.risk_level === "unknown"
              ? "尚未形成风险等级"
              : `风险等级 ${decision.risk_level}`,
          route: `/opportunities/${decision.opportunity_id}?tab=risk`,
        },
      ],
      complete = requirements.filter((item) => item.complete).length,
      missingItems = requirements.filter((item) => !item.complete).map((item) => item.label),
      scoreVersion = score?.rule_version_code
        ? String(score.rule_version_code)
        : decision.score_rule_version
          ? String(decision.score_rule_version)
          : null,
      profitVersion = profit?.rule_version_code ? String(profit.rule_version_code) : null;
    return {
      schema_version: 1,
      snapshot_status: snapshotStatus,
      captured_at: snapshotStatus === "captured" ? iso(now) : null,
      observed_at: iso(now),
      resource: {
        type: "opportunity",
        id: String(decision.opportunity_id),
        label: String(decision.opportunity_name),
        route: `/opportunities/${decision.opportunity_id}`,
      },
      evidence: {
        applicable: true,
        complete,
        total: requirements.length,
        percent: Math.round((complete / requirements.length) * 100),
        is_complete: complete === requirements.length,
        missing_items: missingItems,
        note: null,
        requirements,
      },
      rule_versions: {
        approval_template: `v${input.approvalTemplateVersion}`,
        scoring: scoreVersion,
        profit: profitVersion,
      },
      decision: {
        action: String(decision.action),
        reason: String(decision.reason),
        opportunity_version: Number(decision.opportunity_version),
        created_at: iso(decision.decision_created_at),
      },
      basis_items: [
        {
          code: "requested_decision",
          label: "申请决策",
          value: String(decision.action),
        },
        {
          code: "system_recommendation",
          label: "系统建议",
          value: String(score?.recommendation_status ?? decision.recommendation_status),
        },
        {
          code: "score_coverage",
          label: "评分覆盖",
          value: score ? `${Number(score.coverage_percent)}%` : "尚未评分",
        },
        {
          code: "profit_status",
          label: "利润状态",
          value: profit ? String(profit.status) : "not_calculated",
        },
        {
          code: "risk_level",
          label: "风险等级",
          value: String(decision.risk_level),
        },
        {
          code: "evidence_sources",
          label: "来源证据",
          value: `${evidenceCount} 条 / ${sourceCount} 个来源`,
        },
      ],
      evidence_complete: complete,
      evidence_total: requirements.length,
      missing_items: missingItems,
      rule_version: scoreVersion ?? `approval-v${input.approvalTemplateVersion}`,
      basis: [
        `申请决策：${String(decision.action)}`,
        `系统建议：${String(score?.recommendation_status ?? decision.recommendation_status)}`,
        `来源证据：${evidenceCount} 条 / ${sourceCount} 个来源`,
        `风险等级：${String(decision.risk_level)}`,
      ],
    };
  }
  private async ensureMember(org: string, workspace: string, user: string) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT m.id FROM memberships m LEFT JOIN membership_data_scopes s ON s.membership_id=m.id " +
        "WHERE m.organization_id=? AND m.user_id=? AND m.status='active' AND (s.scope_type='organization' " +
        "OR (s.scope_type='workspace' AND s.workspace_id=?)) LIMIT 1",
      [org, user, workspace],
    );
    if (!rows[0])
      throw new ApprovalServiceError(
        "approval_member_scope_invalid",
        409,
        "选择可访问当前工作区的活动成员。",
      );
  }
  private async ensureResource(c: PoolConnection, i: any, type: string, id: string) {
    const table = type === "task" ? "tasks" : "opportunity_decisions";
    const [rows] = await c.query<RowDataPacket[]>(
      `SELECT id FROM ${table} WHERE id=? AND organization_id=? AND workspace_id=?`,
      [id, i.organizationId, i.workspaceId],
    );
    if (!rows[0])
      throw new ApprovalServiceError(
        "approval_resource_not_found",
        404,
        "选择当前工作区内存在的资源。",
      );
  }
  private async operation(i: any) {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      "SELECT result_json FROM approval_operations WHERE actor_id=? AND route_key=? AND idempotency_key=?",
      [i.actorId, i.route, i.idempotencyKey],
    );
    return rows[0] ? parse(rows[0].result_json) : null;
  }
  private save(c: PoolConnection, i: any, id: string, result: unknown, now: Date) {
    return c.query(
      "INSERT INTO approval_operations (id,actor_id,route_key,idempotency_key,resource_id," +
        "result_json,created_at) VALUES (?,?,?,?,?,?,?)",
      [randomUUID(), i.actorId, i.route, i.idempotencyKey, id, JSON.stringify(result), now],
    );
  }
  private insertJob(
    c: PoolConnection,
    i: any,
    requestId: string,
    runId: string,
    due: Date,
    now: Date,
  ) {
    return c.query(
      "INSERT INTO approval_escalation_jobs (id,organization_id,workspace_id,approval_request_id," +
        "node_run_id,status,attempt_count,available_at,request_id,trace_id,created_at," +
        "updated_at) VALUES (?,?,?,?,?,'queued',0,?,?,?,?,?)",
      [
        randomUUID(),
        i.organizationId,
        i.workspaceId,
        requestId,
        runId,
        due,
        i.requestId,
        i.traceId,
        now,
        now,
      ],
    );
  }
  private async record(
    c: PoolConnection,
    i: any,
    event: string,
    type: string,
    id: string,
    payload: unknown,
    now: Date,
  ) {
    await c.query(
      "INSERT INTO audit_logs (id,organization_id,workspace_id,actor_id,action," +
        "resource_type,resource_id,request_id,trace_id,metadata_json,occurred_at," +
        "schema_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)",
      [
        randomUUID(),
        i.organizationId,
        i.workspaceId,
        i.actorId,
        event,
        type,
        id,
        i.requestId,
        i.traceId,
        JSON.stringify(payload),
        now,
      ],
    );
    await c.query(
      "INSERT INTO outbox_events (id,organization_id,workspace_id,event_type,schema_version," +
        "payload_json,status,attempt_count,available_at,request_id,trace_id,created_at," +
        "updated_at,version) VALUES (?,?,?,?,1,?,'pending',0,?,?,?,?,?,1)",
      [
        randomUUID(),
        i.organizationId,
        i.workspaceId,
        event,
        JSON.stringify({
          resource_type: type,
          resource_id: id,
          ...(payload as object),
        }),
        now,
        i.requestId,
        i.traceId,
        now,
        now,
      ],
    );
  }
}
