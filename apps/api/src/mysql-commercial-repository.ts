import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { CommercialError, type CommercialRepository } from "./commercial-service.js";
const json = (v: any) => (typeof v === "string" ? JSON.parse(v) : v),
  iso = (v: any) => (v ? new Date(v).toISOString() : null);
export class MySqlCommercialRepository implements CommercialRepository {
  constructor(
    private readonly pool: Pool,
    private readonly now = () => new Date(),
  ) {}
  async tx(fn: (c: PoolConnection) => Promise<any>) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      const r = await fn(c);
      await c.commit();
      return r;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async op(c: PoolConnection, i: any, id: string, result: any) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT result_json FROM commercial_operations WHERE actor_id=? AND route_key=? AND idempotency_key=? FOR UPDATE",
      [i.actorId, i.route, i.idempotencyKey],
    );
    if (rows[0]) return { ...json(rows[0].result_json), idempotent_replay: true };
    const [insert] = await c.query<ResultSetHeader>(
      "INSERT IGNORE INTO commercial_operations(id,actor_id,route_key,idempotency_key," +
        "resource_id,result_json,created_at) VALUES(?,?,?,?,?,?,?)",
      [randomUUID(), i.actorId, i.route, i.idempotencyKey, id, JSON.stringify(result), this.now()],
    );
    if (insert.affectedRows === 1) return null;
    const [replayed] = await c.query<RowDataPacket[]>(
      "SELECT result_json FROM commercial_operations WHERE actor_id=? AND route_key=? AND idempotency_key=?",
      [i.actorId, i.route, i.idempotencyKey],
    );
    if (!replayed[0])
      throw new CommercialError(
        "commercial_operation_conflict",
        409,
        "使用原 Idempotency-Key 重试，或生成新键提交新操作。",
      );
    return { ...json(replayed[0].result_json), idempotent_replay: true };
  }
  async audit(
    c: PoolConnection,
    i: any,
    org: any,
    action: string,
    type: string,
    id: string,
    meta: any,
  ) {
    const payload = { resource_type: type, resource_id: id, ...meta };
    await c.query(
      "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id," +
        "action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at," +
        "schema_version) VALUES(?,?,NULL,?,?,?,?,'succeeded',?,?,?,?,1)",
      [
        randomUUID(),
        org,
        i.actorId,
        action,
        type,
        id,
        i.requestId,
        i.traceId,
        JSON.stringify(meta),
        this.now(),
      ],
    );
    await c.query(
      "INSERT INTO commercial_events(id,organization_id,actor_id,event_type,resource_type," +
        "resource_id,payload_json,request_id,trace_id,occurred_at) VALUES(?,?,?,?," +
        "?,?,?,?,?,?)",
      [
        randomUUID(),
        org,
        i.actorId,
        `${action}.v1`,
        type,
        id,
        JSON.stringify(payload),
        i.requestId,
        i.traceId,
        this.now(),
      ],
    );
    if (org)
      await c.query(
        "INSERT INTO outbox_events(id,organization_id,workspace_id,event_type,schema_version," +
          "payload_json,status,attempt_count,available_at,request_id,trace_id,created_at," +
          "updated_at,version) VALUES(?,?,NULL,?,1,?,'pending',0,?,?,?,?,?,1)",
        [
          randomUUID(),
          org,
          `${action}.v1`,
          JSON.stringify(payload),
          this.now(),
          i.requestId,
          i.traceId,
          this.now(),
          this.now(),
        ],
      );
  }
  async read(i: any) {
    const observedAt = this.now(),
      conditions: string[] = [],
      parameters: unknown[] = [];
    if (i.status) {
      conditions.push("p.status=?");
      parameters.push(i.status);
    }
    if (i.query) {
      const escaped = String(i.query)
        .replaceAll("=", "==")
        .replaceAll("%", "=%")
        .replaceAll("_", "=_");
      conditions.push(
        "LOWER(CONCAT_WS(' ',p.code,p.name,COALESCE(p.description,''))) LIKE LOWER(?) ESCAPE '='",
      );
      parameters.push(`%${escaped}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
      [[summaryRow]] = await this.pool.query<RowDataPacket[]>(
        "SELECT COUNT(*) total," +
          "SUM(status='draft') draft,SUM(status='active') active,SUM(status='retired') retired " +
          "FROM commercial_plans",
      ),
      [[filteredRow]] = await this.pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) total FROM commercial_plans p ${where}`,
        parameters,
      ),
      total = Number(filteredRow?.total ?? 0),
      totalPages = Math.max(1, Math.ceil(total / i.pageSize)),
      page = Math.min(i.page, totalPages),
      offset = (page - 1) * i.pageSize,
      [plans] = await this.pool.query<RowDataPacket[]>(
        "SELECT p.id,p.code,p.name,p.description,p.quotas_json,p.status,p.version,p.updated_at," +
          "(SELECT COUNT(*) FROM organization_plan_assignments a WHERE a.plan_id=p.id " +
          "AND a.status IN ('active','suspended')) assignment_count FROM commercial_plans p " +
          `${where} ORDER BY FIELD(p.status,'active','draft','retired'),p.updated_at DESC,p.id DESC ` +
          "LIMIT ? OFFSET ?",
        [...parameters, i.pageSize, offset],
      );
    let assignment = null,
      organization = null,
      adjustments: any[] = [],
      usage = { collection_tasks: 0, open_api_requests: 0, report_exports: 0 },
      effective: any = {},
      adjustmentPagination = {
        page: 1,
        page_size: i.adjustmentPageSize,
        total: 0,
        total_pages: 1,
      };
    if (i.organizationId) {
      const [organizations] = await this.pool.query<RowDataPacket[]>(
        "SELECT id,name,status FROM organizations WHERE id=? LIMIT 1",
        [i.organizationId],
      );
      if (!organizations[0])
        throw new CommercialError("organization_not_found", 404, "选择现有组织后重试。");
      organization = organizations[0];
      const [a] = await this.pool.query<RowDataPacket[]>(
        "SELECT a.id,a.organization_id,a.plan_id,p.code plan_code,p.name plan_name," +
          "p.quotas_json,a.period_start,a.period_end,a.status,a.version,a.updated_at FROM organization_plan_assignments " +
          "a JOIN commercial_plans p ON p.id=a.plan_id WHERE a.organization_id=? LIMIT 1",
        [i.organizationId],
      );
      assignment = a[0] ?? null;
      if (assignment) {
        const [[adjustmentCount]] = await this.pool.query<RowDataPacket[]>(
            "SELECT COUNT(*) total FROM commercial_quota_adjustments WHERE organization_id=?",
            [i.organizationId],
          ),
          adjustmentTotal = Number(adjustmentCount?.total ?? 0),
          adjustmentTotalPages = Math.max(1, Math.ceil(adjustmentTotal / i.adjustmentPageSize)),
          adjustmentPage = Math.min(i.adjustmentPage, adjustmentTotalPages),
          adjustmentOffset = (adjustmentPage - 1) * i.adjustmentPageSize;
        adjustmentPagination = {
          page: adjustmentPage,
          page_size: i.adjustmentPageSize,
          total: adjustmentTotal,
          total_pages: adjustmentTotalPages,
        };
        const [x] = await this.pool.query<RowDataPacket[]>(
          "SELECT id,quota_key,delta_value,reason,status,effective_at,expires_at,version," +
            "updated_at FROM commercial_quota_adjustments WHERE organization_id=? " +
            "ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?",
          [i.organizationId, i.adjustmentPageSize, adjustmentOffset],
        );
        adjustments = x.map((r: any) => ({
          ...r,
          delta_value: Number(r.delta_value),
          effective_at: iso(r.effective_at),
          expires_at: iso(r.expires_at),
          updated_at: iso(r.updated_at),
        }));
        const [[u]] = await this.pool.query<RowDataPacket[]>(
          "SELECT (SELECT COUNT(*) FROM collection_tasks WHERE organization_id=? AND created_at>=? " +
            "AND created_at<?) collection_tasks,(SELECT COUNT(*) FROM open_api_usage WHERE organization_id=? " +
            "AND occurred_at>=? AND occurred_at<?) open_api_requests,(SELECT COUNT(*) FROM report_exports " +
            "WHERE organization_id=? AND created_at>=? AND created_at<?) report_exports",
          [
            i.organizationId,
            assignment.period_start,
            assignment.period_end,
            i.organizationId,
            assignment.period_start,
            assignment.period_end,
            i.organizationId,
            assignment.period_start,
            assignment.period_end,
          ],
        );
        if (!u)
          throw new CommercialError(
            "commercial_usage_row_invalid",
            500,
            "用量聚合结果缺失，请检查 MySQL 后重试。",
          );
        usage = Object.fromEntries(Object.entries(u).map(([k, v]) => [k, Number(v)])) as any;
        effective = { ...json(assignment.quotas_json) };
        const [activeAdjustmentTotals] = await this.pool.query<RowDataPacket[]>(
          "SELECT quota_key,SUM(delta_value) delta_value FROM commercial_quota_adjustments " +
            "WHERE organization_id=? AND assignment_id=? AND status='active' AND effective_at<=? " +
            "AND (expires_at IS NULL OR expires_at>?) GROUP BY quota_key",
          [i.organizationId, assignment.id, observedAt, observedAt],
        );
        for (const activeAdjustment of activeAdjustmentTotals)
          effective[activeAdjustment.quota_key] = Math.max(
            0,
            Number(effective[activeAdjustment.quota_key] ?? 0) +
              Number(activeAdjustment.delta_value),
          );
        assignment = {
          ...assignment,
          quotas: json(assignment.quotas_json),
          quotas_json: undefined,
          period_start: iso(assignment.period_start),
          period_end: iso(assignment.period_end),
          updated_at: iso(assignment.updated_at),
        };
      }
    }
    const result = {
      summary: {
        total: Number(summaryRow?.total ?? 0),
        draft: Number(summaryRow?.draft ?? 0),
        active: Number(summaryRow?.active ?? 0),
        retired: Number(summaryRow?.retired ?? 0),
      },
      pagination: { page, page_size: i.pageSize, total, total_pages: totalPages },
      plans: plans.map((r: any) => ({
        ...r,
        quotas: json(r.quotas_json),
        assignment_count: Number(r.assignment_count),
        quotas_json: undefined,
        updated_at: iso(r.updated_at),
      })),
      organization,
      assignment,
      adjustments,
      adjustment_pagination: adjustmentPagination,
      usage,
      effective_quotas: effective,
      observed_at: observedAt.toISOString(),
      scope: { organization_id: i.organizationId ?? null },
    };
    await this.tx(async (c) => {
      await c.query(
        "INSERT INTO commercial_views(id,actor_id,organization_id,request_id,trace_id,observed_at) VALUES(?,?,?,?,?,?)",
        [randomUUID(), i.actorId, i.organizationId ?? null, i.requestId, i.traceId, this.now()],
      );
      await this.audit(
        c,
        i,
        i.organizationId ?? null,
        "platform.commercial.read",
        "commercial_view",
        i.organizationId ?? i.actorId,
        {
          organization_id: i.organizationId ?? null,
          query: i.query || null,
          status: i.status,
          page,
          adjustment_page: adjustmentPagination.page,
        },
      );
    });
    return result;
  }
  async createPlan(i: any) {
    return this.tx(async (c) => {
      const replay = await this.op(c, i, i.id, { id: i.id, version: 1 });
      if (replay) return replay;
      await c.query(
        "INSERT INTO commercial_plans(id,code,name,description,quotas_json,status," +
          "version,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,'draft'," +
          "1,?,?,?,?)",
        [
          i.id,
          i.value.code,
          i.value.name,
          i.value.description,
          JSON.stringify(i.value.quotas),
          i.actorId,
          i.actorId,
          this.now(),
          this.now(),
        ],
      );
      await this.audit(c, i, null, "platform.commercial.plan.created", "commercial_plan", i.id, {
        code: i.value.code,
        reason: i.value.reason,
      });
      return { id: i.id, status: "draft", version: 1 };
    });
  }
  async updatePlan(i: any) {
    return this.tx(async (c) => {
      const [r] = await c.query<RowDataPacket[]>(
        "SELECT version FROM commercial_plans WHERE id=? FOR UPDATE",
        [i.planId],
      );
      if (!r[0]) throw new CommercialError("plan_not_found", 404, "刷新后重试。");
      const replay = await this.op(c, i, i.planId, { id: i.planId, version: r[0].version });
      if (replay) return replay;
      if (Number(r[0].version) !== i.value.expected_version)
        throw new CommercialError("plan_version_conflict", 409, "刷新后重试。");
      await c.query(
        "UPDATE commercial_plans SET name=?,description=?,quotas_json=?,status=?," +
          "version=version+1,updated_by=?,updated_at=? WHERE id=?",
        [
          i.value.name,
          i.value.description,
          JSON.stringify(i.value.quotas),
          i.value.status,
          i.actorId,
          this.now(),
          i.planId,
        ],
      );
      await this.audit(
        c,
        i,
        null,
        "platform.commercial.plan.updated",
        "commercial_plan",
        i.planId,
        { status: i.value.status, reason: i.value.reason },
      );
      return { id: i.planId, status: i.value.status, version: Number(r[0].version) + 1 };
    });
  }
  async assign(i: any) {
    return this.tx(async (c) => {
      const [p] = await c.query<RowDataPacket[]>("SELECT status FROM commercial_plans WHERE id=?", [
        i.value.plan_id,
      ]);
      if (!p[0] || p[0].status !== "active")
        throw new CommercialError("active_plan_required", 409, "先启用配额方案。");
      const [existing] = await c.query<RowDataPacket[]>(
        "SELECT id,version FROM organization_plan_assignments WHERE organization_id=? FOR UPDATE",
        [i.value.organization_id],
      );
      const resource = existing[0]?.id ?? i.id,
        replay = await this.op(c, i, resource, { id: resource });
      if (replay) return replay;
      if (
        existing[0] &&
        (!Number.isSafeInteger(Number(i.value.expected_version)) ||
          Number(existing[0].version) !== Number(i.value.expected_version))
      )
        throw new CommercialError("assignment_version_conflict", 409, "刷新后重试。");
      if (existing[0])
        await c.query(
          "UPDATE organization_plan_assignments SET plan_id=?,period_start=?,period_end=?," +
            "status='active',version=version+1,updated_by=?,updated_at=? WHERE id=?",
          [
            i.value.plan_id,
            i.value.period_start,
            i.value.period_end,
            i.actorId,
            this.now(),
            resource,
          ],
        );
      else
        await c.query(
          "INSERT INTO organization_plan_assignments(id,organization_id,plan_id,period_start," +
            "period_end,status,version,created_by,updated_by,created_at,updated_at) VALUES(?," +
            "?,?,?,?,'active',1,?,?,?,?)",
          [
            resource,
            i.value.organization_id,
            i.value.plan_id,
            i.value.period_start,
            i.value.period_end,
            i.actorId,
            i.actorId,
            this.now(),
            this.now(),
          ],
        );
      await this.audit(
        c,
        i,
        i.value.organization_id,
        "platform.commercial.assignment.set",
        "organization_plan_assignment",
        resource,
        { plan_id: i.value.plan_id, reason: i.value.reason },
      );
      return {
        id: resource,
        status: "active",
        version: existing[0] ? Number(existing[0].version) + 1 : 1,
      };
    });
  }
  async assignmentAction(i: any) {
    return this.tx(async (c) => {
      const [r] = await c.query<RowDataPacket[]>(
        "SELECT organization_id,status,version FROM organization_plan_assignments WHERE id=? FOR UPDATE",
        [i.assignmentId],
      );
      if (!r[0]) throw new CommercialError("assignment_not_found", 404, "刷新后重试。");
      const replay = await this.op(c, i, i.assignmentId, {
        id: i.assignmentId,
        status: r[0].status,
        version: r[0].version,
      });
      if (replay) return replay;
      if (Number(r[0].version) !== i.value.expected_version)
        throw new CommercialError("assignment_version_conflict", 409, "刷新后重试。");
      const status =
        i.value.action === "suspend"
          ? "suspended"
          : i.value.action === "resume"
            ? "active"
            : "ended";
      const allowed =
        (r[0].status === "active" && ["suspend", "end"].includes(i.value.action)) ||
        (r[0].status === "suspended" && ["resume", "end"].includes(i.value.action));
      if (!allowed)
        throw new CommercialError(
          "assignment_action_state_invalid",
          409,
          "刷新组织配额状态后重试。",
        );
      await c.query(
        "UPDATE organization_plan_assignments SET status=?,version=version+1,updated_by=?,updated_at=? WHERE id=?",
        [status, i.actorId, this.now(), i.assignmentId],
      );
      await this.audit(
        c,
        i,
        r[0].organization_id,
        "platform.commercial.assignment.updated",
        "organization_plan_assignment",
        i.assignmentId,
        { status, reason: i.value.reason },
      );
      return { id: i.assignmentId, status, version: Number(r[0].version) + 1 };
    });
  }
  async adjust(i: any) {
    return this.tx(async (c) => {
      const [a] = await c.query<RowDataPacket[]>(
        "SELECT organization_id,status FROM organization_plan_assignments WHERE id=?",
        [i.value.assignment_id],
      );
      if (!a[0] || a[0].organization_id !== i.value.organization_id || a[0].status === "ended")
        throw new CommercialError(
          "assignment_scope_invalid",
          409,
          "选择同组织且未结束的配额分配。",
        );
      const replay = await this.op(c, i, i.id, { id: i.id, status: "active", version: 1 });
      if (replay) return replay;
      await c.query(
        "INSERT INTO commercial_quota_adjustments(id,organization_id,assignment_id," +
          "quota_key,delta_value,reason,status,effective_at,expires_at,version,created_by," +
          "created_at,updated_at) VALUES(?,?,?,?,?,?,'active',?,?,1,?,?,?)",
        [
          i.id,
          i.value.organization_id,
          i.value.assignment_id,
          i.value.quota_key,
          i.value.delta_value,
          i.value.reason,
          i.value.effective_at,
          i.value.expires_at,
          i.actorId,
          this.now(),
          this.now(),
        ],
      );
      await this.audit(
        c,
        i,
        i.value.organization_id,
        "platform.commercial.quota.adjusted",
        "commercial_quota_adjustment",
        i.id,
        { quota_key: i.value.quota_key, delta_value: i.value.delta_value, reason: i.value.reason },
      );
      return { id: i.id, status: "active", version: 1 };
    });
  }
  async revokeAdjustment(i: any) {
    return this.tx(async (c) => {
      const [r] = await c.query<RowDataPacket[]>(
        "SELECT organization_id,status,version FROM commercial_quota_adjustments WHERE id=? FOR UPDATE",
        [i.adjustmentId],
      );
      if (!r[0]) throw new CommercialError("adjustment_not_found", 404, "刷新后重试。");
      const replay = await this.op(c, i, i.adjustmentId, {
        id: i.adjustmentId,
        status: r[0].status,
        version: r[0].version,
      });
      if (replay) return replay;
      if (Number(r[0].version) !== i.value.expected_version)
        throw new CommercialError("adjustment_version_conflict", 409, "刷新后重试。");
      if (r[0].status !== "active")
        throw new CommercialError("adjustment_not_active", 409, "该调整已撤销。");
      await c.query(
        "UPDATE commercial_quota_adjustments SET status='revoked',revoked_by=?,revoked_at=?," +
          "version=version+1,updated_at=? WHERE id=?",
        [i.actorId, this.now(), this.now(), i.adjustmentId],
      );
      await this.audit(
        c,
        i,
        r[0].organization_id,
        "platform.commercial.quota.revoked",
        "commercial_quota_adjustment",
        i.adjustmentId,
        { reason: i.value.reason },
      );
      return { id: i.adjustmentId, status: "revoked", version: Number(r[0].version) + 1 };
    });
  }
}
