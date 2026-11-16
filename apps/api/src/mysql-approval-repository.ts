import {
  appendPlatformAudit,
  appendBusinessAudit,
  approvalTemplateScopeRelation,
} from "@scoutops/database";
import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { rehearsalOwns, requireAccountReadRehearsal } from "./account-read-rehearsal.js";
import { ApprovalServiceError, type ApprovalRepository } from "./approval-service.js";

async function hasLegacyApprovalScope(
  connection: Pick<PoolConnection, "query">,
  table: "approval_template_versions" | "approval_template_nodes" | "approval_requests",
) {
  const [columns] = await connection.query<RowDataPacket[]>(
    `SHOW COLUMNS FROM ${table} WHERE Field IN ('organization_id','workspace_id')`,
  );
  if (columns.length === 1) throw new Error(`partial_inherited_scope_schema:${table}`);
  return columns.length === 2;
}

const parse = <T>(value: unknown): T =>
  typeof value === "string" ? JSON.parse(value) : (value as T);
async function nativeApprovalParent(
  db: Pick<PoolConnection, "query">,
  table: "tasks" | "opportunities",
) {
  const [columns] = await db.query<RowDataPacket[]>(
    `SHOW COLUMNS FROM ${table} WHERE Field IN ('account_id','organization_id','workspace_id')`,
  );
  const shape = columns
    .map((row) => row.Field)
    .sort()
    .join(",");
  if (shape === "account_id") return true;
  if (shape === "organization_id,workspace_id") return false;
  throw new ApprovalServiceError(
    "approval_account_schema_not_ready",
    503,
    "先完成关联资源的隔离账号迁移。",
  );
}

async function approvalTargetPredicate(db: Pick<PoolConnection, "query">) {
  const nativeTask = await nativeApprovalParent(db, "tasks");
  const nativeOpportunity = await nativeApprovalParent(db, "opportunities");
  return {
    nativeTask,
    nativeOpportunity,
    sql: `(
  (r.resource_type='task' AND EXISTS (
    SELECT 1 FROM tasks task_resource WHERE task_resource.id=r.resource_id
      ${nativeTask ? "AND task_resource.account_id=ar.account_id" : ""}
      AND ${rehearsalOwns("tasks", "task_resource.id", "ar.account_id")}))
  OR (r.resource_type='opportunity_decision' AND EXISTS (
    SELECT 1 FROM opportunity_decisions x JOIN opportunities o ON o.id=x.opportunity_id
    WHERE x.id=r.resource_id AND ${rehearsalOwns("opportunity_decisions", "x.id", "ar.account_id")}
      ${nativeOpportunity ? "AND o.account_id=ar.account_id" : ""}
      AND ${rehearsalOwns("opportunities", "o.id", "ar.account_id")})))`,
  };
}
const sealedApprovalOwnerSql = `JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
  AND (ar.reason='exclusive_owner' OR (ar.reason IN ('shared','unassigned') AND ar.account_id=cut.primary_account_id))`;
const iso = (value: unknown) =>
  value == null ? null : (value instanceof Date ? value : new Date(String(value))).toISOString();
const normalizeApprovalResourceRoute = (context: any) =>
  context?.resource?.type === "task"
    ? {
        ...context,
        resource: {
          ...context.resource,
          route: `/tasks/${context.resource.id}`,
        },
      }
    : context;

type DecisionContextItem = {
  code: string;
  label: string;
  complete?: boolean;
  detail?: string;
  value?: string | null;
};

export const compareApprovalDecisionContexts = (snapshot: any, current: any) => {
  const requirements = new Map<string, DecisionContextItem>();
  for (const item of snapshot.evidence?.requirements ?? []) requirements.set(item.code, item);
  for (const item of current.evidence?.requirements ?? [])
    if (!requirements.has(item.code)) requirements.set(item.code, item);
  const requirementChanges = [...requirements.values()]
    .map((item) => {
      const before = (snapshot.evidence?.requirements ?? []).find(
          (candidate: DecisionContextItem) => candidate.code === item.code,
        ),
        after = (current.evidence?.requirements ?? []).find(
          (candidate: DecisionContextItem) => candidate.code === item.code,
        );
      return {
        code: item.code,
        label: before?.label ?? after?.label ?? item.code,
        before_complete: before?.complete ?? null,
        after_complete: after?.complete ?? null,
        before_detail: before?.detail ?? null,
        after_detail: after?.detail ?? null,
      };
    })
    .filter(
      (item) =>
        item.before_complete !== item.after_complete || item.before_detail !== item.after_detail,
    );
  const basisItems = new Map<string, DecisionContextItem>();
  for (const item of snapshot.basis_items ?? []) basisItems.set(item.code, item);
  for (const item of current.basis_items ?? [])
    if (!basisItems.has(item.code)) basisItems.set(item.code, item);
  const basisChanges = [...basisItems.values()]
    .map((item) => {
      const before = (snapshot.basis_items ?? []).find(
          (candidate: DecisionContextItem) => candidate.code === item.code,
        ),
        after = (current.basis_items ?? []).find(
          (candidate: DecisionContextItem) => candidate.code === item.code,
        );
      return {
        code: item.code,
        label: before?.label ?? after?.label ?? item.code,
        before: before?.value ?? null,
        after: after?.value ?? null,
      };
    })
    .filter((item) => item.before !== item.after);
  const ruleVersions = ["scoring", "profit"]
    .map((code) => ({
      code,
      label: code === "scoring" ? "评分规则" : "利润规则",
      before: snapshot.rule_versions?.[code] ?? null,
      after: current.rule_versions?.[code] ?? null,
    }))
    .filter((item) => item.before !== item.after);
  const beforeComplete = Number(snapshot.evidence?.complete ?? 0),
    afterComplete = Number(current.evidence?.complete ?? 0),
    beforeTotal = Number(snapshot.evidence?.total ?? 0),
    afterTotal = Number(current.evidence?.total ?? 0),
    beforePercent = snapshot.evidence?.percent ?? null,
    afterPercent = current.evidence?.percent ?? null;
  return {
    available: true,
    observed_at: current.observed_at,
    has_changes:
      beforeComplete !== afterComplete ||
      beforeTotal !== afterTotal ||
      beforePercent !== afterPercent ||
      requirementChanges.length > 0 ||
      basisChanges.length > 0 ||
      ruleVersions.length > 0,
    evidence_summary: {
      before_complete: beforeComplete,
      before_total: beforeTotal,
      before_percent: beforePercent,
      after_complete: afterComplete,
      after_total: afterTotal,
      after_percent: afterPercent,
    },
    requirement_changes: requirementChanges,
    basis_changes: basisChanges,
    rule_version_changes: ruleVersions,
  };
};

export class MySqlApprovalRepository implements ApprovalRepository {
  constructor(
    private readonly pool: Pool,
    private readonly now = () => new Date(),
  ) {}

  async accountTemplateOptions(i: { accountId: string }) {
    const source = await approvalTemplateScopeRelation(this.pool);
    const items = await this.listTemplates(i, source);
    if (source === "approval_templates") return { items, canManage: false };
    const [versions, nodes, requests, [actors]] = await Promise.all([
      hasLegacyApprovalScope(this.pool, "approval_template_versions"),
      hasLegacyApprovalScope(this.pool, "approval_template_nodes"),
      hasLegacyApprovalScope(this.pool, "approval_requests"),
      this.pool.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE id=? AND status='active' AND email_verified_at IS NOT NULL",
        [i.accountId],
      ),
    ]);
    return { items, canManage: !versions && !nodes && !requests && actors.length === 1 };
  }
  async listTemplates(i: any, templateSource?: string) {
    const account = "accountId" in i;
    const source = templateSource ?? (await approvalTemplateScopeRelation(this.pool));
    if (account) await requireAccountReadRehearsal(this.pool);
    const scope = account
      ? rehearsalOwns("approval_templates", "t.id", "?") +
        (source === "approval_templates" ? "" : " AND t.account_id=?")
      : "t.organization_id=? AND t.workspace_id=?";
    const args = account
      ? source === "approval_templates"
        ? [i.accountId]
        : [i.accountId, i.accountId]
      : [i.organizationId, i.workspaceId];

    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT t.id,t.name,t.resource_type,t.status,t.current_version,t.revision,t.published_at,t.updated_at,COUNT(n.id) node_count FROM ${source} t LEFT JOIN approval_template_versions ` +
        "v ON v.template_id=t.id AND v.version_number=t.current_version " +
        (account ? "AND " + rehearsalOwns("approval_template_versions", "v.id", "?") + " " : "") +
        "LEFT JOIN approval_template_nodes " +
        "n ON n.template_version_id=v.id " +
        (account ? "AND " + rehearsalOwns("approval_template_nodes", "n.id", "?") + " " : "") +
        `WHERE ${scope} GROUP BY t.id,t.name,t.resource_type,t.status,t.current_version,t.revision,t.published_at,t.updated_at ORDER BY t.updated_at DESC`,
      [...(account ? [i.accountId, i.accountId] : []), ...args],
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
    const account = "accountId" in i;
    if (account) i = this.templateMutation(i);
    const previous = account ? null : await this.operation(i);
    if (previous) return previous;
    if (!account)
      for (const node of i.value.nodes) {
        await this.ensureMember(i.organizationId, i.workspaceId, node.approver_id);
        await this.ensureMember(i.organizationId, i.workspaceId, node.escalation_assignee_id);
      }
    const connection = await this.pool.getConnection(),
      now = this.now();
    try {
      await connection.beginTransaction();
      if (account) {
        await this.requireTemplateOwner(connection, i);
        const replay = await this.templateReplay(connection, i);
        if (replay) {
          await connection.commit();
          return replay;
        }
      }
      if (account) {
        const actors = [
          ...new Set<string>(
            i.value.nodes.flatMap((node: any) => [node.approver_id, node.escalation_assignee_id]),
          ),
        ].sort();
        const [verified] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM users WHERE id IN (?) AND status='active' AND email_verified_at IS NOT NULL LOCK IN SHARE MODE",
          [actors],
        );
        if (verified.length !== actors.length)
          throw new ApprovalServiceError(
            "approval_member_invalid",
            400,
            "请选择已验证的有效账号。",
          );
      }
      await connection.query(
        `INSERT INTO approval_templates (id,${account ? "account_id" : "organization_id,workspace_id"},name,resource_type,` +
          "status,current_version,revision,created_by,created_at,updated_at) VALUES (?," +
          `${account ? "?,?,?" : "?,?,?,?"},'draft',1,1,?,?,?)`,
        [
          i.id,
          ...(account ? [i.accountId] : [i.organizationId, i.workspaceId]),
          i.value.name,
          i.value.resource_type,
          i.actorId,
          now,
          now,
        ],
      );
      const hasLegacyVersionScope = await hasLegacyApprovalScope(
        connection,
        "approval_template_versions",
      );
      const hasLegacyNodeScope = await hasLegacyApprovalScope(
        connection,
        "approval_template_nodes",
      );
      if (account && (hasLegacyVersionScope || hasLegacyNodeScope))
        throw new ApprovalServiceError(
          "approval_account_schema_not_ready",
          503,
          "先应用隔离审批迁移。",
        );
      const coordinates = [i.organizationId, i.workspaceId];
      if (account) {
        await this.registerDecisionOwner(connection, i, "approval_templates", i.id);
        await this.registerDecisionOwner(connection, i, "approval_template_versions", i.versionId);
      }
      await connection.query(
        "INSERT INTO approval_template_versions (id,template_id," +
          (hasLegacyVersionScope ? "organization_id,workspace_id," : "") +
          "version_number,status,created_by,created_at) VALUES (?,?," +
          (hasLegacyVersionScope ? "?,?," : "") +
          "1,'draft',?,?)",
        [i.versionId, i.id, ...(hasLegacyVersionScope ? coordinates : []), i.actorId, now],
      );
      for (const node of i.value.nodes) {
        const nodeId = randomUUID();
        await connection.query(
          "INSERT INTO approval_template_nodes (id,template_version_id," +
            (hasLegacyNodeScope ? "organization_id,workspace_id," : "") +
            "ordinal,name,approver_id,sla_minutes,escalation_assignee_id) VALUES (?,?," +
            (hasLegacyNodeScope ? "?,?," : "") +
            "?,?,?,?,?)",
          [
            nodeId,
            i.versionId,
            ...(hasLegacyNodeScope ? coordinates : []),
            node.ordinal,
            node.name,
            node.approver_id,
            node.sla_minutes,
            node.escalation_assignee_id,
          ],
        );
        if (account)
          await this.registerDecisionOwner(connection, i, "approval_template_nodes", nodeId);
      }
      const result = {
        id: i.id,
        status: "draft",
        current_version: 1,
        revision: 1,
      };
      await this.recordTemplate(
        connection,
        i,
        "approval.template.created",
        "approval_template",
        i.id,
        { ...result, node_count: i.value.nodes.length },
        now,
      );
      await this.save(
        connection,
        i,
        i.id,
        account ? { payload: i.templatePayload, result } : result,
        now,
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

  async publishTemplate(i: any) {
    const account = "accountId" in i;
    if (account) i = this.templateMutation(i);
    const previous = account ? null : await this.operation(i);
    if (previous) return previous;
    const connection = await this.pool.getConnection(),
      now = this.now();
    try {
      await connection.beginTransaction();
      if (account) {
        await this.requireTemplateOwner(connection, i);
        const replay = await this.templateReplay(connection, i);
        if (replay) {
          await connection.commit();
          return replay;
        }
      }
      const [rows] = await connection.query<RowDataPacket[]>(
        account
          ? `SELECT t.* FROM approval_templates t WHERE t.id=? AND t.account_id=? AND ${rehearsalOwns("approval_templates", "t.id", "t.account_id")} FOR UPDATE`
          : "SELECT * FROM approval_templates WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
        account ? [i.templateId, i.accountId] : [i.templateId, i.organizationId, i.workspaceId],
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
        "SELECT v.id FROM approval_template_versions v WHERE template_id=? AND version_number=? AND status='draft'" +
          (account
            ? " AND " + rehearsalOwns("approval_template_versions", "v.id", "?") + " FOR UPDATE"
            : ""),
        [i.templateId, row.current_version, ...(account ? [i.accountId] : [])],
      );
      if (!versions[0])
        throw new ApprovalServiceError(
          "approval_template_version_missing",
          409,
          "补全草稿版本后重试。",
        );
      if (account) {
        const [[counts]] = await connection.query<RowDataPacket[]>(
          `SELECT COUNT(*) total, SUM(${rehearsalOwns("approval_template_nodes", "n.id", "?")}) owned
           FROM approval_template_nodes n WHERE n.template_version_id=?`,
          [i.accountId, versions[0].id],
        );
        if (!counts || !Number(counts.total) || Number(counts.total) !== Number(counts.owned))
          throw new ApprovalServiceError("approval_nodes_invalid", 409, "模板节点归属不一致。");
      }
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
      await this.recordTemplate(
        connection,
        i,
        "approval.template.published",
        "approval_template",
        i.templateId,
        { ...result, reason: i.reason },
        now,
      );
      await this.save(
        connection,
        i,
        i.templateId,
        account ? { payload: i.templatePayload, result } : result,
        now,
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

  async listRequests(i: any) {
    const accountMode = "accountId" in i;
    if (accountMode) await requireAccountReadRehearsal(this.pool);
    const requestHasScope = await hasLegacyApprovalScope(this.pool, "approval_requests");
    const scopeAlias = requestHasScope ? "r" : "t";
    const actorId = accountMode ? i.accountId : i.actorId;
    const from = accountMode
      ? `approval_requests r JOIN account_owned_records ar ON ar.source_table='approval_requests' AND ar.source_id=r.id ${sealedApprovalOwnerSql}`
      : "approval_requests r";
    const templateSource = await approvalTemplateScopeRelation(this.pool);
    const target = accountMode ? await approvalTargetPredicate(this.pool) : null;
    const templateJoin = accountMode
      ? `JOIN ${templateSource} t ON t.id=r.template_id AND t.resource_type=r.resource_type
         ${templateSource !== "approval_templates" ? "AND t.account_id=ar.account_id" : ""}
         AND ${rehearsalOwns("approval_templates", "t.id", "ar.account_id")}
         JOIN approval_template_versions v ON v.id=r.template_version_id AND v.template_id=t.id`
      : `JOIN ${templateSource} t ON t.id=r.template_id`;
    const ownedNode = (alias: "nr" | "n") =>
      accountMode
        ? ` AND ${rehearsalOwns("approval_node_runs", `${alias}.id`, "ar.account_id")}`
        : "";
    const assignedToActor =
      "EXISTS(SELECT 1 FROM approval_node_runs nr " +
      "JOIN approval_template_nodes nd ON nd.id=nr.template_node_id AND nd.ordinal=nr.ordinal " +
      "WHERE nd.template_version_id=r.template_version_id AND nr.approval_request_id=r.id AND nr.ordinal=r.current_node_ordinal AND nr.active_approver_id=? AND nr.status='pending'" +
      ownedNode("nr") +
      " AND " +
      rehearsalOwns("approval_template_nodes", "nd.id", "ar.account_id") +
      ")";
    const currentNodeDefinition = accountMode
      ? " AND EXISTS (SELECT 1 FROM approval_template_nodes nd WHERE nd.id=n.template_node_id " +
        "AND nd.template_version_id=r.template_version_id AND nd.ordinal=n.ordinal AND " +
        rehearsalOwns("approval_template_nodes", "nd.id", "ar.account_id") +
        ")"
      : "";
    const where = accountMode
      ? [
          `(ar.account_id=? OR (r.status='pending' AND ${assignedToActor}))`,
          rehearsalOwns("approval_template_versions", "r.template_version_id", "ar.account_id"),
          target!.sql,
        ]
      : [`${scopeAlias}.organization_id=?`, `${scopeAlias}.workspace_id=?`];
    const args: any[] = accountMode ? [actorId, actorId] : [i.organizationId, i.workspaceId];
    if (i.status) {
      where.push("r.status=?");
      args.push(i.status);
    }
    if (i.involvement === "requested") {
      where.push("r.requested_by=?");
      args.push(actorId);
    } else if (i.involvement === "decidable") {
      where.push(
        accountMode
          ? "r.status='pending' AND " + assignedToActor
          : "EXISTS(SELECT 1 FROM approval_node_runs nr WHERE nr.approval_request_id=r.id " +
              `AND nr.ordinal=r.current_node_ordinal AND nr.active_approver_id=? AND nr.status='pending'${ownedNode("nr")})`,
      );
      args.push(actorId);
    } else if (i.mine) {
      where.push(
        "(r.requested_by=? OR EXISTS(SELECT 1 FROM approval_node_runs nr " +
          "WHERE nr.approval_request_id=r.id AND nr.active_approver_id=? " +
          `AND nr.status='pending'${ownedNode("nr")}))`,
      );
      args.push(actorId, actorId);
    }
    const [count] = await this.pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) total FROM ${from} ${accountMode || !requestHasScope ? templateJoin : ""} WHERE ${where.join(" AND ")}`,
        args,
      ),
      [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT r.*,t.name template_name,n.name current_node_name,
          n.active_approver_id,n.due_at,n.escalated_at,n.status current_node_status
         FROM ${from}
         ${templateJoin}
         LEFT JOIN approval_node_runs n ON n.approval_request_id=r.id
          AND n.ordinal=r.current_node_ordinal${ownedNode("n")}${currentNodeDefinition}
         WHERE ${where.join(" AND ")}
         ORDER BY (r.status='pending') DESC,n.due_at IS NULL,n.due_at ASC,
           r.updated_at DESC,r.id DESC LIMIT ? OFFSET ?`,
        [...args, i.pageSize, (i.page - 1) * i.pageSize],
      );
    return {
      items: rows.map((r) => ({
        ...this.request(r, actorId),
        ...(accountMode ? { can_decide: this.accountCanDecide(r, actorId) } : {}),
      })),
      page: i.page,
      page_size: i.pageSize,
      total: Number(count[0]?.total ?? 0),
    };
  }

  async detail(i: any) {
    const accountId = "accountId" in i ? String(i.accountId) : null;
    const own = (source: string, id: string, account = "?") =>
      accountId === null ? "" : ` AND ${rehearsalOwns(source, id, account)}`;
    if (accountId !== null) await requireAccountReadRehearsal(this.pool);
    const requestHasScope = await hasLegacyApprovalScope(this.pool, "approval_requests");
    const scopeAlias = requestHasScope ? "r" : "t";
    const templateSource = await approvalTemplateScopeRelation(this.pool);
    const target = accountId !== null ? await approvalTargetPredicate(this.pool) : null;
    const coordinates = requestHasScope ? "" : ",t.organization_id,t.workspace_id";
    const [rows] = await this.pool.query<RowDataPacket[]>(
      accountId === null
        ? `SELECT r.*${coordinates},t.name template_name,v.version_number rule_version,n.name current_node_name,` +
            "n.active_approver_id,n.due_at,n.escalated_at FROM approval_requests r JOIN approval_templates " +
            "t ON t.id=r.template_id JOIN approval_template_versions v ON v.id=r.template_version_id " +
            "LEFT JOIN approval_node_runs n ON n.approval_request_id=r.id AND n.ordinal=r.current_node_ordinal " +
            `WHERE r.id=? AND ${scopeAlias}.organization_id=? AND ${scopeAlias}.workspace_id=?`
        : `SELECT r.*${coordinates},t.name template_name,v.version_number rule_version,n.name current_node_name,
          n.active_approver_id,n.due_at,n.escalated_at,n.status current_node_status,
          ar.account_id ownership_account_id
        FROM approval_requests r
        JOIN account_owned_records ar ON ar.source_table='approval_requests' AND ar.source_id=r.id
        ${sealedApprovalOwnerSql}
        JOIN ${templateSource} t ON t.id=r.template_id AND t.resource_type=r.resource_type
          ${templateSource !== "approval_templates" ? "AND t.account_id=ar.account_id" : ""}
          ${own("approval_templates", "t.id", "ar.account_id")}
        JOIN approval_template_versions v ON v.id=r.template_version_id AND v.template_id=t.id
          ${own("approval_template_versions", "v.id", "ar.account_id")}
        LEFT JOIN approval_node_runs n ON n.approval_request_id=r.id AND n.ordinal=r.current_node_ordinal
          ${own("approval_node_runs", "n.id", "ar.account_id")}
          AND EXISTS (SELECT 1 FROM approval_template_nodes nd WHERE nd.id=n.template_node_id
              AND nd.template_version_id=r.template_version_id AND nd.ordinal=n.ordinal
              ${own("approval_template_nodes", "nd.id", "ar.account_id")})
        WHERE r.id=? AND ${target!.sql} AND (ar.account_id=? OR (
          r.status='pending' AND n.status='pending' AND n.active_approver_id=?))`,
      accountId === null
        ? [i.requestIdValue, i.organizationId, i.workspaceId]
        : [i.requestIdValue, accountId, accountId],
    );
    const row = rows[0];
    if (!row) throw new ApprovalServiceError("approval_request_not_found", 404, "刷新审批列表。");
    const organizationId = accountId === null ? i.organizationId : String(row.organization_id);
    const workspaceId = accountId === null ? i.workspaceId : String(row.workspace_id);
    const owner = accountId === null ? null : String(row.ownership_account_id);
    const scopedArgs = [i.requestIdValue, ...(owner === null ? [] : [owner])];
    const [nodes] = await this.pool.query<RowDataPacket[]>(
        "SELECT n.*,\n                original_profile.display_name approver_name,\n                approver_profile.display_name active_approver_name,\n                escalation_profile.display_name escalation_assignee_name," +
          "\n                decided_profile.display_name decided_by_name\n         FROM approval_node_runs " +
          "n\n         LEFT JOIN user_profiles original_profile\n           ON original_profile.user_id=n.approver_id\n         LEFT JOIN user_profiles approver_profile\n           ON approver_profile.user_id=n.active_approver_id\n         LEFT JOIN user_profiles escalation_profile\n           ON escalation_profile.user_id=n.escalation_assignee_id\n" +
          "         LEFT JOIN user_profiles decided_profile\n           ON decided_profile.user_id=n.decided_by\n" +
          `         WHERE n.approval_request_id=?${own("approval_node_runs", "n.id")} ORDER BY n.ordinal`,
        scopedArgs,
      ),
      [actions] = await this.pool.query<RowDataPacket[]>(
        "SELECT a.id,a.node_run_id,a.action,a.reason,a.actor_id,a.created_at,\n               " +
          " actor_profile.display_name actor_name\n         FROM approval_actions a\n         LEFT " +
          "JOIN user_profiles actor_profile\n           ON actor_profile.user_id=a.actor_id\n    " +
          `     WHERE a.approval_request_id=?${own("approval_actions", "a.id")}` +
          (accountId === null
            ? ""
            : ` AND EXISTS (SELECT 1 FROM approval_node_runs an
            WHERE an.id=a.node_run_id AND an.approval_request_id=a.approval_request_id
              ${own("approval_node_runs", "an.id")})`) +
          " ORDER BY a.created_at,a.id",
        owner === null ? scopedArgs : [...scopedArgs, owner],
      );
    const approvalTemplateVersion = Number(row.rule_version);
    const hasCapturedContext = Boolean(row.decision_context_json);
    const currentDecisionContext = await this.loadDecisionContext(
      this.pool,
      {
        organizationId,
        workspaceId,
        resourceType: String(row.resource_type),
        resourceId: String(row.resource_id),
        approvalTemplateVersion,
        accountId: owner,
        nativeResourceOwner:
          target !== null &&
          (row.resource_type === "task" ? target.nativeTask : target.nativeOpportunity),
      },
      this.now(),
      "live_fallback",
    );
    const normalizedDecisionContext = normalizeApprovalResourceRoute(
      hasCapturedContext ? parse<any>(row.decision_context_json) : currentDecisionContext,
    );
    if (
      accountId !== null &&
      (normalizedDecisionContext?.resource?.type !== currentDecisionContext.resource.type ||
        normalizedDecisionContext.resource.id !== currentDecisionContext.resource.id)
    )
      throw new ApprovalServiceError("approval_request_not_found", 404, "刷新审批列表。");
    return {
      ...this.request(row, accountId ?? i.actorId),
      ...(accountId === null ? {} : { can_decide: this.accountCanDecide(row, accountId) }),
      approval_template_version: approvalTemplateVersion,
      decision_context: normalizedDecisionContext,
      decision_context_diff: hasCapturedContext
        ? compareApprovalDecisionContexts(normalizedDecisionContext, currentDecisionContext)
        : {
            available: false,
            observed_at: currentDecisionContext.observed_at,
            has_changes: false,
            evidence_summary: null,
            requirement_changes: [],
            basis_changes: [],
            rule_version_changes: [],
          },
      nodes: nodes.map((r) => ({
        id: String(r.id),
        ordinal: Number(r.ordinal),
        name: String(r.name),
        approver_id: String(r.approver_id),
        approver_name: r.approver_name ? String(r.approver_name) : "未设置展示名称",
        active_approver_id: String(r.active_approver_id),
        active_approver_name: r.active_approver_name
          ? String(r.active_approver_name)
          : "未设置展示名称",
        escalation_assignee_id: String(r.escalation_assignee_id),
        escalation_assignee_name: r.escalation_assignee_name
          ? String(r.escalation_assignee_name)
          : "未设置展示名称",
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
    const account = "accountId" in i;
    if (account) i = this.templateMutation(i);
    const previous = account ? null : await this.operation(i);
    if (previous) return previous;
    const connection = await this.pool.getConnection(),
      now = this.now();
    try {
      await connection.beginTransaction();
      if (account) {
        await this.requireTemplateOwner(connection, i);
        const replay = await this.requestReplay(connection, i);
        if (replay) {
          await connection.commit();
          return replay;
        }
      }
      const [templates] = await connection.query<RowDataPacket[]>(
        "SELECT t.*,v.id version_id FROM approval_templates t JOIN approval_template_versions " +
          "v ON v.template_id=t.id AND v.version_number=t.current_version AND v.status='published' " +
          `WHERE t.id=? AND ${account ? "t.account_id=? AND " + rehearsalOwns("approval_templates", "t.id", "t.account_id") + " AND " + rehearsalOwns("approval_template_versions", "v.id", "t.account_id") : "t.organization_id=? AND t.workspace_id=?"} AND t.status='published' FOR ` +
          "UPDATE",
        account
          ? [i.value.template_id, i.accountId]
          : [i.value.template_id, i.organizationId, i.workspaceId],
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
      let nativeResourceOwner = false;
      if (account) {
        const task = i.value.resource_type === "task";
        nativeResourceOwner = await nativeApprovalParent(
          connection,
          task ? "tasks" : "opportunities",
        );
        const parent = task
          ? "tasks o"
          : "opportunity_decisions d JOIN opportunities o ON o.id=d.opportunity_id";
        const target = task ? "o.id" : "d.id";
        const [targets] = await connection.query<RowDataPacket[]>(
          `SELECT ow.reason FROM ${parent}
             JOIN account_owned_records ow ON ow.source_table='${task ? "tasks" : "opportunities"}' AND ow.source_id=o.id
             JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25
               AND (ow.reason='exclusive_owner' OR (ow.reason IN ('shared','unassigned') AND ow.account_id=cut.primary_account_id))
             WHERE ${target}=? AND ow.account_id=?
             ${nativeResourceOwner ? "AND o.account_id=ow.account_id" : ""}
             ${task ? "AND o.deleted_at IS NULL" : "AND o.lifecycle_status<>'deleted' AND " + rehearsalOwns("opportunity_decisions", "d.id", "?")} FOR UPDATE`,
          [i.value.resource_id, i.accountId, ...(task ? [] : [i.accountId])],
        );
        if (!targets[0])
          throw new ApprovalServiceError(
            "approval_resource_not_found",
            404,
            "选择当前账号的资源。",
          );
        i = { ...i, ownershipReason: targets[0].reason };
      } else await this.ensureResource(connection, i, i.value.resource_type, i.value.resource_id);
      const decisionContext = await this.loadDecisionContext(
        connection,
        {
          organizationId: i.organizationId,
          workspaceId: i.workspaceId,
          resourceType: i.value.resource_type,
          resourceId: i.value.resource_id,
          ...(account ? { accountId: i.accountId } : {}),
          nativeResourceOwner,
          approvalTemplateVersion: Number(template.current_version),
        },
        now,
        "captured",
      );
      const [nodes] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM approval_template_nodes WHERE template_version_id=? ORDER BY ordinal",
        [template.version_id],
      );
      if (account && nodes.length) {
        const [owners] = await connection.query<RowDataPacket[]>(
          "SELECT source_id FROM account_owned_records WHERE source_table='approval_template_nodes' AND source_id IN (?) AND account_id=? LOCK IN SHARE MODE",
          [nodes.map((n) => n.id), i.accountId],
        );
        if (owners.length !== nodes.length || nodes.some((n, k) => Number(n.ordinal) !== k + 1))
          throw new ApprovalServiceError(
            "approval_nodes_invalid",
            409,
            "模板节点归属或顺序不一致。",
          );
      }
      if (!nodes.length)
        throw new ApprovalServiceError("approval_nodes_invalid", 409, "模板没有审批节点。");
      const requestHasScope = await hasLegacyApprovalScope(connection, "approval_requests");
      if (account && requestHasScope)
        throw new ApprovalServiceError(
          "approval_account_schema_not_ready",
          503,
          "先应用隔离审批迁移。",
        );
      await connection.query(
        "INSERT INTO approval_requests (id," +
          (requestHasScope ? "organization_id,workspace_id," : "") +
          "template_id," +
          "template_version_id,resource_type,resource_id,title,decision_context_json," +
          "status,current_node_ordinal,requested_by,version,created_at,updated_at) VALUES (?," +
          (requestHasScope ? "?,?," : "") +
          "?,?,?,?,?,?,'pending',1,?,1,?,?)",
        [
          i.id,
          ...(requestHasScope ? [i.organizationId, i.workspaceId] : []),
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
      if (account) await this.registerDecisionOwner(connection, i, "approval_requests", i.id);
      let firstJobId: string | undefined;
      for (const node of nodes) {
        const runId = randomUUID(),
          pending = Number(node.ordinal) === 1,
          due = pending ? new Date(now.valueOf() + Number(node.sla_minutes) * 60000) : null;
        await connection.query(
          "INSERT INTO approval_node_runs (id,approval_request_id," +
            "template_node_id,ordinal,name,approver_id,active_approver_id,escalation_assignee_id," +
            "status,due_at,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?," +
            "?, ?,1,?,?)",
          [
            runId,
            i.id,
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
        if (account) await this.registerDecisionOwner(connection, i, "approval_node_runs", runId);
        if (pending) firstJobId = await this.insertJob(connection, i, i.id, runId, due!, now);
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
          ...(account ? { approval_request_id: i.id, approval_escalation_job_id: firstJobId } : {}),
          resource_type: i.value.resource_type,
          resource_id: i.value.resource_id,
          evidence_complete: decisionContext.evidence.is_complete,
          missing_items: decisionContext.evidence.missing_items,
          rule_versions: decisionContext.rule_versions,
        },
        now,
      );
      await this.save(
        connection,
        i,
        i.id,
        account ? { payload: i.templatePayload, result } : result,
        now,
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

  private accountCanDecide(row: RowDataPacket, accountId: string) {
    return (
      row.status === "pending" &&
      row.current_node_status === "pending" &&
      String(row.active_approver_id ?? "") === accountId
    );
  }

  async decide(i: any) {
    const account = "accountId" in i;
    if (account) i = { ...i, actorId: i.accountId, route: i.route + "#account-v1" };
    const previous = account ? null : await this.operation(i);
    if (previous) return previous;
    const connection = await this.pool.getConnection(),
      now = this.now();
    try {
      await connection.beginTransaction();
      if (account) {
        await requireAccountReadRehearsal(connection, { lockForTransaction: true });
        const [actors] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM users WHERE id=? AND status='active' AND email_verified_at IS NOT NULL FOR UPDATE",
          [i.actorId],
        );
        if (!actors.length)
          throw new ApprovalServiceError(
            "approval_actor_forbidden",
            403,
            "请使用已验证的有效账号。",
          );
      }
      const requestHasScope = await hasLegacyApprovalScope(connection, "approval_requests");
      if (account && requestHasScope)
        throw new ApprovalServiceError(
          "approval_account_schema_not_ready",
          503,
          "先应用隔离审批迁移。",
        );
      const templateSource =
        account || requestHasScope
          ? "approval_templates"
          : await approvalTemplateScopeRelation(connection);
      const nativeTemplate =
        account && (await approvalTemplateScopeRelation(connection)) !== "approval_templates";
      const target = account ? await approvalTargetPredicate(connection) : null;
      const [requests] = await connection.query<RowDataPacket[]>(
        account
          ? `SELECT r.*,ar.reason ownership_reason,ar.account_id ownership_account_id
             FROM approval_requests r
             JOIN account_owned_records ar ON ar.source_table='approval_requests' AND ar.source_id=r.id
             ${sealedApprovalOwnerSql}
             JOIN ${templateSource} t ON t.id=r.template_id AND t.resource_type=r.resource_type
               ${nativeTemplate ? "AND t.account_id=ar.account_id" : ""}
               AND ${rehearsalOwns("approval_templates", "t.id", "ar.account_id")}
             JOIN approval_template_versions v ON v.id=r.template_version_id AND v.template_id=t.id
               AND ${rehearsalOwns("approval_template_versions", "v.id", "ar.account_id")}
             WHERE r.id=? AND ${target!.sql}
               AND (ar.account_id=? OR EXISTS (
                 SELECT 1 FROM approval_node_runs nr WHERE nr.approval_request_id=r.id
                 AND nr.ordinal=r.current_node_ordinal AND nr.active_approver_id=? AND nr.status='pending'
                 AND ${rehearsalOwns("approval_node_runs", "nr.id", "ar.account_id")}
               ) OR EXISTS (
                 SELECT 1 FROM approval_operations op WHERE op.resource_id=r.id
                   AND op.actor_id=? AND op.route_key=? AND op.idempotency_key=?
               )) FOR UPDATE`
          : requestHasScope
            ? "SELECT * FROM approval_requests WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE"
            : `SELECT r.* FROM approval_requests r JOIN ${templateSource} t ON t.id=r.template_id ` +
              "JOIN approval_template_versions v ON v.id=r.template_version_id AND v.template_id=t.id " +
              "WHERE r.id=? AND t.organization_id=? AND t.workspace_id=? FOR UPDATE",
        account
          ? [i.requestIdValue, i.accountId, i.accountId, i.actorId, i.route, i.idempotencyKey]
          : [i.requestIdValue, i.organizationId, i.workspaceId],
      );
      const request = requests[0];
      if (!request)
        throw new ApprovalServiceError("approval_request_not_found", 404, "刷新审批列表。");
      if (account) {
        i = {
          ...i,
          ownershipReason: request.ownership_reason,
          ownershipAccountId: request.ownership_account_id,
        };
        const replay = await this.operation(i, connection);
        if (replay) {
          await connection.commit();
          return replay;
        }
      }
      if (request.status !== "pending")
        throw new ApprovalServiceError("approval_request_state_invalid", 409, "审批单已结束。");
      if (Number(request.version) !== i.value.expected_version)
        throw new ApprovalServiceError("approval_version_conflict", 409, "刷新审批单后重试。");
      const [runs] = await connection.query<RowDataPacket[]>(
        account
          ? `SELECT n.* FROM approval_node_runs n JOIN approval_template_nodes d ON d.id=n.template_node_id
             AND d.template_version_id=? AND d.ordinal=n.ordinal
             WHERE n.approval_request_id=? AND n.ordinal=?
             AND ${rehearsalOwns("approval_node_runs", "n.id", "?")}
             AND ${rehearsalOwns("approval_template_nodes", "d.id", "?")} FOR UPDATE`
          : "SELECT * FROM approval_node_runs WHERE approval_request_id=? AND ordinal=? FOR UPDATE",
        account
          ? [
              request.template_version_id,
              i.requestIdValue,
              request.current_node_ordinal,
              i.ownershipAccountId,
              i.ownershipAccountId,
            ]
          : [i.requestIdValue, request.current_node_ordinal],
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
      const actionId = randomUUID();
      await connection.query(
        "INSERT INTO approval_actions (id,approval_request_id," +
          "node_run_id,action,reason,actor_id,request_id,trace_id,created_at) VALUES (?," +
          "?,?,?,?,?,?,?,?)",
        [
          actionId,
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
      if (account) await this.registerDecisionOwner(connection, i, "approval_actions", actionId);
      let status = "rejected",
        ordinal = Number(request.current_node_ordinal),
        completed: any = now;
      if (approved) {
        const [nextRows] = await connection.query<RowDataPacket[]>(
          "SELECT r.*,n.sla_minutes FROM approval_node_runs r JOIN approval_template_nodes n ON " +
            "n.id=r.template_node_id WHERE r.approval_request_id=? AND r.ordinal=?" +
            (account
              ? " AND n.template_version_id=? AND n.ordinal=r.ordinal AND " +
                rehearsalOwns("approval_node_runs", "r.id", "?") +
                " AND " +
                rehearsalOwns("approval_template_nodes", "n.id", "?")
              : "") +
            " FOR UPDATE",
          [
            i.requestIdValue,
            ordinal + 1,
            ...(account
              ? [request.template_version_id, i.ownershipAccountId, i.ownershipAccountId]
              : []),
          ],
        );
        const next = nextRows[0];
        if (account && next && next.status !== "waiting")
          throw new ApprovalServiceError(
            "approval_node_state_invalid",
            409,
            "下一审批节点状态不匹配。",
          );
        if (account && !next) {
          const [remaining] = await connection.query<RowDataPacket[]>(
            "SELECT d.id FROM approval_template_nodes d WHERE d.template_version_id=? AND d.ordinal>? LIMIT 1 FOR UPDATE",
            [request.template_version_id, ordinal],
          );
          if (remaining.length)
            throw new ApprovalServiceError(
              "approval_node_state_invalid",
              409,
              "下一审批节点归属或顺序不匹配。",
            );
          const [unmatched] = await connection.query<RowDataPacket[]>(
            "SELECT id FROM approval_node_runs WHERE approval_request_id=? AND ordinal>? LIMIT 1 FOR UPDATE",
            [i.requestIdValue, ordinal],
          );
          if (unmatched.length)
            throw new ApprovalServiceError(
              "approval_node_state_invalid",
              409,
              "存在不属于原模板的后续节点。",
            );
        }
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
        {
          ...result,
          node_run_id: String(run.id),
          reason: i.value.reason,
          ...(account ? { approval_action_id: actionId } : {}),
        },
        now,
      );
      await this.save(
        connection,
        i,
        i.requestIdValue,
        account
          ? {
              result,
              action: i.value.action,
              expected_version: i.value.expected_version,
              reason: i.value.reason,
            }
          : result,
        now,
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
      accountId?: string | null;
      nativeResourceOwner?: boolean;
    },
    now: Date,
    snapshotStatus: "captured" | "live_fallback",
  ) {
    const accountId = input.accountId ?? null;
    const ownership = (source: string, id: string) =>
      accountId === null ? "" : ` AND ${rehearsalOwns(source, id, "?")}`;
    const scoped = (resourceId: string, owners: number) => [
      resourceId,
      ...(accountId === null
        ? [input.organizationId, input.workspaceId]
        : Array<string>(owners).fill(accountId)),
    ];
    const legacyScope = (alias: string) =>
      accountId === null ? ` AND ${alias}.organization_id=? AND ${alias}.workspace_id=?` : "";
    const nativeScope = (alias: "t" | "o") =>
      input.nativeResourceOwner ? ` AND ${alias}.account_id=?` : "";
    const parentScope = (ref: string) =>
      accountId === null
        ? ` AND EXISTS (SELECT 1 FROM opportunities p WHERE p.id=${ref}${legacyScope("p")})`
        : ` AND ${rehearsalOwns("opportunities", ref, "?")}`;
    if (input.resourceType === "task") {
      const [rows] = await queryable.query(
          "SELECT t.title,t.status,t.priority,t.progress_percent,t.due_at,\n                  profile.display_name " +
            "assignee_name\n           FROM tasks t\n           LEFT JOIN user_profiles profile ON " +
            "profile.user_id=t.assignee_id\n           WHERE t.id=?" +
            legacyScope("t") +
            ownership("tasks", "t.id") +
            nativeScope("t") +
            " LIMIT 1",
          scoped(input.resourceId, input.nativeResourceOwner ? 2 : 1),
        ),
        task = rows[0];
      if (accountId !== null && !task)
        throw new ApprovalServiceError("approval_request_not_found", 404, "刷新审批列表。");
      return {
        schema_version: 1,
        snapshot_status: snapshotStatus,
        captured_at: snapshotStatus === "captured" ? iso(now) : null,
        observed_at: iso(now),
        resource: {
          type: "task",
          id: input.resourceId,
          label: task?.title ? String(task.title) : "关联任务",
          route: `/tasks/${input.resourceId}`,
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
          "d\n         JOIN opportunities o\n           ON o.id=d.opportunity_id\n" +
          "         WHERE d.id=?" +
          legacyScope("o") +
          ownership("opportunity_decisions", "d.id") +
          ownership("opportunities", "o.id") +
          nativeScope("o") +
          " LIMIT 1",
        scoped(input.resourceId, input.nativeResourceOwner ? 3 : 2),
      ),
      decision = decisionRows[0];
    if (!decision)
      throw new ApprovalServiceError(
        accountId === null ? "approval_resource_not_found" : "approval_request_not_found",
        404,
        "关联机会决策不存在，请刷新审批列表。",
      );
    const [scoreRows] = await queryable.query(
        "SELECT status,coverage_percent,recommendation_status,\n                rule_version_code," +
          "missing_fields_json,scored_at\n         FROM opportunity_score_runs\n         WHERE opportunity_id=?" +
          parentScope("opportunity_score_runs.opportunity_id") +
          ownership("opportunity_score_runs", "opportunity_score_runs.id") +
          " ORDER BY scored_at DESC," +
          "id DESC\n         LIMIT 1",
        scoped(decision.opportunity_id, 2),
      ),
      [profitRows] = await queryable.query(
        "SELECT status,rule_version_code,missing_fields_json,calculated_at\n         FROM opportunity_profit_runs\n" +
          "WHERE opportunity_id=?" +
          parentScope("opportunity_profit_runs.opportunity_id") +
          ownership("opportunity_profit_runs", "opportunity_profit_runs.id") +
          " ORDER " +
          "BY calculated_at DESC,id DESC\n         LIMIT 1",
        scoped(decision.opportunity_id, 2),
      ),
      [evidenceRows] = await queryable.query(
        "SELECT COUNT(*) evidence_count,COUNT(DISTINCT provider_id) source_count\n         FROM " +
          "opportunity_evidence_links\n         WHERE opportunity_id=?" +
          parentScope("opportunity_evidence_links.opportunity_id") +
          ownership("opportunity_evidence_links", "opportunity_evidence_links.id") +
          (accountId === null
            ? ""
            : ` AND (raw_evidence_id IS NULL OR
            ${rehearsalOwns("raw_evidence", "opportunity_evidence_links.raw_evidence_id", "?")})
            AND (evidence_type<>'trend_signal' OR
            ${rehearsalOwns("trend_signals", "opportunity_evidence_links.evidence_id", "?")})`),
        scoped(decision.opportunity_id, 4),
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
    const [rows] = await c.query<RowDataPacket[]>(
      type === "task"
        ? "SELECT id FROM tasks WHERE id=? AND organization_id=? AND workspace_id=?"
        : "SELECT d.id FROM opportunity_decisions d JOIN opportunities o ON o.id=d.opportunity_id WHERE d.id=? AND o.organization_id=? AND o.workspace_id=?",
      [id, i.organizationId, i.workspaceId],
    );
    if (!rows[0])
      throw new ApprovalServiceError(
        "approval_resource_not_found",
        404,
        "选择当前工作区内存在的资源。",
      );
  }
  private templateMutation(i: any) {
    return {
      ...i,
      actorId: i.accountId,
      ownershipAccountId: i.accountId,
      ownershipReason: "exclusive_owner",
      route: i.route + "#account-v1",
      templatePayload: JSON.stringify(
        i.templateId ? [i.templateId, i.expectedRevision, i.reason] : i.value,
      ),
    };
  }
  private async requireTemplateOwner(c: PoolConnection, i: any) {
    await requireAccountReadRehearsal(c, { lockForTransaction: true });
    if ((await approvalTemplateScopeRelation(c)) === "approval_templates")
      throw new ApprovalServiceError(
        "approval_account_schema_not_ready",
        503,
        "先应用隔离审批迁移。",
      );
    const [actors] = await c.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE id=? AND status='active' AND email_verified_at IS NOT NULL FOR UPDATE",
      [i.actorId],
    );
    if (!actors.length)
      throw new ApprovalServiceError("approval_actor_forbidden", 403, "请使用已验证的有效账号。");
  }
  private async templateReplay(c: PoolConnection, i: any) {
    const [rows] = await c.query<RowDataPacket[]>(
      `SELECT op.result_json FROM approval_operations op JOIN approval_templates t ON t.id=op.resource_id
       WHERE op.actor_id=? AND op.route_key=? AND op.idempotency_key=? AND t.account_id=?
         AND ${rehearsalOwns("approval_templates", "t.id", "t.account_id")} FOR UPDATE`,
      [i.actorId, i.route, i.idempotencyKey, i.accountId],
    );
    if (!rows[0]) return null;
    const receipt = parse<any>(rows[0].result_json);
    if (receipt?.payload !== i.templatePayload || !receipt?.result)
      throw new ApprovalServiceError(
        "approval_idempotency_conflict",
        409,
        "审批模板内容不同，请使用新的幂等键。",
      );
    return receipt.result;
  }
  private async requestReplay(c: PoolConnection, i: any) {
    const [rows] = await c.query<RowDataPacket[]>(
      `SELECT op.result_json,op.resource_id FROM approval_operations op
        WHERE op.actor_id=? AND op.route_key=? AND op.idempotency_key=? FOR UPDATE`,
      [i.actorId, i.route, i.idempotencyKey],
    );
    if (!rows[0]) return null;
    const receipt = parse<any>(rows[0].result_json);
    if (receipt?.payload !== i.templatePayload || !receipt?.result)
      throw new ApprovalServiceError(
        "approval_idempotency_conflict",
        409,
        "审批内容不同，请使用新的幂等键。",
      );
    const target = await approvalTargetPredicate(c);
    const [retained] = await c.query<RowDataPacket[]>(
      `SELECT r.id FROM approval_requests r
       JOIN account_owned_records ar ON ar.source_table='approval_requests' AND ar.source_id=r.id
       ${sealedApprovalOwnerSql}
       JOIN approval_templates t ON t.id=r.template_id AND t.account_id=ar.account_id AND t.resource_type=r.resource_type
         AND ${rehearsalOwns("approval_templates", "t.id", "ar.account_id")}
       JOIN approval_template_versions v ON v.id=r.template_version_id AND v.template_id=t.id
         AND ${rehearsalOwns("approval_template_versions", "v.id", "ar.account_id")}
       WHERE r.id=? AND ar.account_id=? AND r.template_id=? AND r.resource_type=? AND r.resource_id=?
         AND ${target.sql} FOR UPDATE`,
      [
        rows[0].resource_id,
        i.accountId,
        i.value.template_id,
        i.value.resource_type,
        i.value.resource_id,
      ],
    );
    if (!retained.length)
      throw new ApprovalServiceError("approval_request_not_found", 404, "刷新审批列表。");
    return receipt.result;
  }
  private recordTemplate(
    c: PoolConnection,
    i: any,
    event: string,
    type: string,
    id: string,
    payload: unknown,
    now: Date,
  ) {
    if (!i.accountId) return this.record(c, i, event, type, id, payload, now);
    return appendPlatformAudit(
      c,
      "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) VALUES(?,NULL,NULL,?,?,?,?, 'succeeded',?,?,?,?,1)",
      [
        randomUUID(),
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
  }
  private async operation(i: any, db: Pick<PoolConnection, "query"> = this.pool) {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT result_json${i.accountId ? ",resource_id" : ""} FROM approval_operations WHERE actor_id=? AND route_key=? AND idempotency_key=?` +
        (db === this.pool ? "" : " FOR UPDATE"),
      [i.actorId, i.route, i.idempotencyKey],
    );
    if (i.accountId && rows[0] && rows[0].resource_id !== i.requestIdValue)
      throw new ApprovalServiceError(
        "approval_idempotency_conflict",
        409,
        "为不同审批使用新的幂等键。",
      );
    if (!rows[0]) return null;
    const result = parse<any>(rows[0].result_json);
    if (!i.accountId) return result;
    if (
      result?.action !== i.value.action ||
      result?.expected_version !== i.value.expected_version ||
      result?.reason !== i.value.reason ||
      result?.result?.id !== i.requestIdValue
    )
      throw new ApprovalServiceError(
        "approval_idempotency_conflict",
        409,
        "审批内容不同，请使用新的幂等键。",
      );
    return result.result;
  }
  private registerDecisionOwner(c: PoolConnection, i: any, table: string, id: string) {
    return c.query(
      "INSERT INTO account_owned_records(source_table,source_id,account_id,reason) VALUES(?,?,?,?)",
      [table, id, i.ownershipAccountId, i.ownershipReason],
    );
  }
  private save(c: PoolConnection, i: any, id: string, result: unknown, now: Date) {
    return c.query(
      "INSERT INTO approval_operations (id,actor_id,route_key,idempotency_key,resource_id," +
        "result_json,created_at) VALUES (?,?,?,?,?,?,?)",
      [randomUUID(), i.actorId, i.route, i.idempotencyKey, id, JSON.stringify(result), now],
    );
  }
  private async insertJob(
    c: PoolConnection,
    i: any,
    requestId: string,
    runId: string,
    due: Date,
    now: Date,
  ) {
    const id = randomUUID();
    await c.query(
      "INSERT INTO approval_escalation_jobs (id,approval_request_id," +
        "node_run_id,status,attempt_count,available_at,request_id,trace_id,created_at," +
        "updated_at) VALUES (?,?,?,'queued',0,?,?,?,?,?)",
      [id, requestId, runId, due, i.requestId, i.traceId, now, now],
    );
    if (i.accountId) await this.registerDecisionOwner(c, i, "approval_escalation_jobs", id);
    return id;
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
    if (i.accountId) {
      const [columns] = await c.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM outbox_events WHERE Field IN ('organization_id','workspace_id')",
      );
      const legacyNullable =
        columns.length === 2 &&
        ["organization_id", "workspace_id"].every((field) =>
          columns.some((column) => column.Field === field && column.Null === "YES"),
        );
      if (columns.length !== 0 && !legacyNullable)
        throw new ApprovalServiceError(
          "approval_account_schema_not_ready",
          503,
          "先应用隔离审批投递迁移。",
        );
      await this.recordTemplate(c, i, event, type, id, payload, now);
      const outboxId = randomUUID();
      await c.query(
        "INSERT INTO outbox_events (id,event_type,schema_version,payload_json,status,attempt_count,available_at," +
          "request_id,trace_id,created_at,updated_at,version) VALUES (?,?,1,?,'pending',0,?,?,?,?,?,1)",
        [
          outboxId,
          event,
          JSON.stringify({
            resource_type: type,
            resource_id: id,
            ...(payload as object),
            account_projection_contract: 25,
          }),
          now,
          i.requestId,
          i.traceId,
          now,
          now,
        ],
      );
      await this.registerDecisionOwner(c, i, "outbox_events", outboxId);
      return;
    }
    await appendBusinessAudit(
      c,
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
    const outboxId = randomUUID();
    await c.query(
      "INSERT INTO outbox_events (id,organization_id,workspace_id,event_type,schema_version," +
        "payload_json,status,attempt_count,available_at,request_id,trace_id,created_at," +
        "updated_at,version) VALUES (?,?,?,?,1,?,'pending',0,?,?,?,?,?,1)",
      [
        outboxId,
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
