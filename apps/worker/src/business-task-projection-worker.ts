import { randomUUID } from "node:crypto";
import {
  collectionTaskScope,
  hasLegacyCompetitorOutboxScope,
  hasLegacySourcingEventScope,
  hasLegacySourcingOutboxScope,
} from "@scoutops/database";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { RuntimeConfig } from "@scoutops/config";
import {
  calculationOwnersMatch,
  registerCalculationOwners,
  resolveCalculationOwnership,
} from "./opportunity-calculation-ownership.js";
import { usesNativeBusinessTasks } from "./business-task-storage.js";
import { nativeCompetitorStorage } from "./competitor-storage.js";

const rehearsalName = /^product_scout_[a-z0-9_]*rehearsal$/;
const sourcingPurchaseParentJoin =
  "JOIN sourcing_purchase_tasks pp ON pp.id=e.resource_id " +
  "JOIN supplier_quotes pq ON pq.id=pp.quote_id JOIN sourcing_candidates pc ON pc.id=pq.candidate_id " +
  "JOIN sourcing_searches ps ON ps.id=pc.search_id";
export function shouldProjectAccountPurchase(
  config: Pick<RuntimeConfig, "nodeEnv" | "app" | "database">,
) {
  return (
    (config.nodeEnv === "development" || config.nodeEnv === "test") &&
    config.app.host === "127.0.0.1" &&
    config.database.host === "127.0.0.1" &&
    !config.database.readHost &&
    !config.database.writeHost &&
    rehearsalName.test(config.database.name)
  );
}

export async function projectAccountPurchaseOnce(
  pool: Pick<Pool, "getConnection">,
  mode: "rehearsal" | "retired" = "rehearsal",
) {
  const c = await pool.getConnection();
  try {
    const retired = mode === "retired";
    const [[target]] = await c.query<RowDataPacket[]>(
      "SELECT DATABASE() db, VERSION() version" +
        (retired ? ", CURRENT_USER() authenticated_as" : ""),
    );
    if (
      (retired
        ? target?.db !== "product_scout" ||
          !/^product_scout@[^@]+$/.test(String(target.authenticated_as ?? ""))
        : !rehearsalName.test(String(target?.db ?? ""))) ||
      !/^5\.7\./.test(String(target?.version ?? ""))
    )
      throw new Error(
        retired
          ? "account_purchase_projection_target_invalid"
          : "mysql57_rehearsal_database_required",
      );
    await c.beginTransaction();
    const [[receipt]] = await c.query<RowDataPacket[]>(
      "SELECT slot FROM account_ownership_cutover WHERE slot='current' AND contract_version=25 LOCK IN SHARE MODE",
    );
    if (!receipt) throw new Error("account_ownership_not_ready");
    const legacy = await hasLegacySourcingOutboxScope(c);
    const legacyEvent = legacy || (await hasLegacySourcingEventScope(c));
    if (retired && legacyEvent) throw new Error("purchase_projection_task_schema_invalid");
    const accountEventType = "sourcing.purchase_task.account_rehearsal.queued";
    const [[event]] = await c.query<RowDataPacket[]>(
      legacy
        ? "SELECT id,resource_id,organization_id,workspace_id FROM sourcing_outbox " +
            "WHERE event_type='sourcing.purchase_task.account_rehearsal.queued' AND status='queued' " +
            "AND available_at<=NOW(3) ORDER BY available_at,id LIMIT 1 FOR UPDATE"
        : `SELECT o.id,o.resource_id${legacyEvent ? ",e.organization_id,e.workspace_id" : ""} FROM sourcing_outbox o
         JOIN sourcing_events e ON e.id=o.id AND e.resource_id=o.resource_id AND BINARY e.event_type=BINARY o.event_type
         WHERE o.event_type='${accountEventType}' AND o.status='queued'
           AND o.available_at<=NOW(3) ORDER BY o.available_at,o.id LIMIT 1 FOR UPDATE`,
    );
    if (!event) {
      await c.commit();
      return { status: "idle" as const };
    }
    const finish = (status: "published" | "dead_letter") =>
      c.query(
        "UPDATE sourcing_outbox SET status=?,leased_by=NULL,leased_at=NULL,lease_expires_at=NULL WHERE id=?",
        [status, event.id],
      );
    const block = async (reason: string) => {
      await finish("dead_letter");
      await c.commit();
      return { status: "blocked" as const, event_id: String(event.id), reason };
    };
    const nativeCollectionTask = (await collectionTaskScope(c)) === "account";
    const nativeBusinessTask = await usesNativeBusinessTasks(c);
    if (
      (retired && !nativeBusinessTask) ||
      (nativeBusinessTask && (!nativeCollectionTask || legacyEvent))
    )
      throw new Error("purchase_projection_task_schema_invalid");
    const [[purchase]] = await c.query<RowDataPacket[]>(
      "SELECT p.id,p.created_by,p.request_id,p.trace_id,po.account_id,po.reason ownership_reason" +
        (nativeBusinessTask
          ? " "
          : nativeCollectionTask
            ? ",work.organization_id,work.id workspace_id "
            : ",ct.organization_id,ct.workspace_id ") +
        "FROM sourcing_purchase_tasks p JOIN account_owned_records po " +
        "ON po.source_table='sourcing_purchase_tasks' AND po.source_id=p.id " +
        "JOIN supplier_quotes q ON q.id=p.quote_id " +
        "JOIN sourcing_candidates qc ON qc.id=q.candidate_id JOIN sourcing_searches qs ON qs.id=qc.search_id " +
        "JOIN account_owned_records qo ON qo.source_table='supplier_quotes' AND qo.source_id=q.id AND qo.account_id=po.account_id " +
        "JOIN account_owned_records co ON co.source_table='sourcing_candidates' AND co.source_id=qc.id AND co.account_id=po.account_id " +
        "JOIN account_owned_records so ON so.source_table='sourcing_searches' AND so.source_id=qs.id AND so.account_id=po.account_id " +
        "JOIN collection_tasks ct ON ct.id=qs.collection_task_id " +
        "JOIN account_owned_records cto ON cto.source_table='collection_tasks' AND cto.source_id=ct.id AND cto.account_id=po.account_id " +
        (nativeCollectionTask ? "AND ct.account_id=cto.account_id " : "") +
        (nativeCollectionTask && !nativeBusinessTask
          ? "JOIN account_ownership_cutover cut ON cut.slot='current' AND cut.contract_version=25 " +
            "JOIN account_retirement_records cr ON cr.run_id=cut.source_run_id AND cr.source_table='collection_tasks' AND cr.source_id=ct.id " +
            "JOIN account_retirement_scopes cs ON cs.run_id=cr.run_id AND cs.legacy_org_id=cr.legacy_org_id " +
            "AND cs.legacy_workspace_id=cr.legacy_workspace_id AND cs.account_id=cto.account_id AND cs.reason=cto.reason " +
            "AND (cto.reason='exclusive_owner' OR (cto.reason IN ('shared','unassigned') AND cto.account_id=cut.primary_account_id)) " +
            "JOIN workspaces work ON work.id=cr.legacy_workspace_id AND work.organization_id=cr.legacy_org_id "
          : "") +
        "JOIN normalized_records qn ON qn.id=qc.normalized_record_id AND qn.raw_evidence_id=qc.raw_evidence_id AND qn.provider_id=qc.provider_id " +
        "JOIN raw_evidence qr ON qr.id=qn.raw_evidence_id AND qr.provider_id=qn.provider_id " +
        "JOIN account_owned_records no ON no.source_table='normalized_records' AND no.source_id=qn.id AND no.account_id=po.account_id " +
        "JOIN account_owned_records ro ON ro.source_table='raw_evidence' AND ro.source_id=qr.id AND ro.account_id=po.account_id " +
        "JOIN raw_evidence qe ON qe.id=q.evidence_id " +
        "JOIN account_owned_records qeo ON qeo.source_table='raw_evidence' AND qeo.source_id=qe.id AND qeo.account_id=po.account_id " +
        "JOIN account_owned_records oo ON oo.source_table='sourcing_outbox' AND oo.source_id=? AND oo.account_id=po.account_id " +
        "JOIN sourcing_events e ON e.id=oo.source_id AND e.resource_id=p.id " +
        (legacyEvent
          ? nativeCollectionTask
            ? "AND e.organization_id=work.organization_id AND e.workspace_id=work.id "
            : "AND e.organization_id=qs.organization_id AND e.workspace_id=qs.workspace_id "
          : "") +
        `AND e.event_type='${accountEventType}' ` +
        "JOIN account_owned_records eo ON eo.source_table='sourcing_events' AND eo.source_id=oo.source_id AND eo.account_id=po.account_id " +
        "WHERE p.id=? " +
        (legacyEvent ? "AND e.organization_id=? AND e.workspace_id=? " : "") +
        "AND qs.deleted_at IS NULL AND p.status='queued' AND p.created_by=po.account_id FOR UPDATE",
      [
        event.id,
        event.resource_id,
        ...(legacyEvent ? [event.organization_id, event.workspace_id] : []),
      ],
    );
    if (!purchase) return await block("purchase_task_scope_invalid");
    // Until business tasks retire their old columns, use only the original
    // collection task's verified coordinates, never an account's default scope.
    const scope = nativeBusinessTask
      ? [purchase.account_id]
      : [purchase.organization_id, purchase.workspace_id];
    // The purchase row is already locked above. Check its original ID across
    // legacy scopes, and fail closed on ambiguous or independently owned tasks.
    const [existingTasks] = await c.query<RowDataPacket[]>(
      "SELECT t.id,t.deleted_at,o.account_id" +
        (nativeBusinessTask ? ",t.account_id native_account_id" : "") +
        " FROM tasks t LEFT JOIN account_owned_records o " +
        "ON o.source_table='tasks' AND o.source_id=t.id " +
        "WHERE t.source_type='sourcing_purchase' AND t.source_ref_id=? ORDER BY t.id LIMIT 2 FOR UPDATE",
      [purchase.id],
    );
    if (existingTasks.length > 1) return await block("purchase_projection_duplicate_source");
    const existing = existingTasks[0];
    if (
      existing &&
      (existing.deleted_at ||
        existing.account_id !== purchase.account_id ||
        (nativeBusinessTask && existing.native_account_id !== purchase.account_id))
    )
      return await block("purchase_projection_ownership_conflict");
    const taskId = existing ? String(existing.id) : randomUUID();
    if (!existing) {
      const now = new Date(),
        taskEventId = randomUUID();
      await c.query(
        "INSERT INTO tasks (id," +
          (nativeBusinessTask ? "account_id" : "organization_id,workspace_id") +
          ",title,description,status,priority,assignee_id," +
          "source_type,source_ref_id,created_by,version,created_at,updated_at) " +
          (nativeBusinessTask ? "VALUES (?,?,?,?" : "VALUES (?,?,?,?,?") +
          ",'todo','normal',?,'sourcing_purchase',?,?,1,?,?)",
        [
          taskId,
          ...scope,
          `处理采购任务 · ${String(purchase.id).slice(0, 8)}`,
          `来源于已排队采购任务 ${purchase.id}`,
          purchase.created_by,
          purchase.id,
          purchase.created_by,
          now,
          now,
        ],
      );
      await c.query(
        "INSERT INTO task_events (id,task_id,event_type,actor_id,payload_json,request_id,trace_id,created_at) " +
          "VALUES (?,?,'task.created',?,?,?,?,?)",
        [
          taskEventId,
          taskId,
          purchase.created_by,
          JSON.stringify({ source_type: "sourcing_purchase", source_ref_id: purchase.id }),
          purchase.request_id,
          purchase.trace_id,
          now,
        ],
      );
      await c.query(
        "INSERT INTO account_owned_records (source_table,source_id,account_id,reason) VALUES ('tasks',?,?,?),('task_events',?,?,?)",
        [taskId, taskEventId].flatMap((id) => [id, purchase.account_id, purchase.ownership_reason]),
      );
    }
    await finish("published");
    await c.commit();
    return { status: "projected" as const, taskId };
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    c.release();
  }
}

export async function projectBusinessTaskOnce(
  pool: Pool,
  workerId: string,
  leaseSeconds: number,
  config?: Pick<RuntimeConfig, "nodeEnv" | "app" | "database">,
) {
  if (config?.app.accountScopeMode === "retired") {
    if (
      config.nodeEnv !== "production" ||
      config.app.host !== "127.0.0.1" ||
      config.database.name !== "product_scout" ||
      config.database.host !== "127.0.0.1" ||
      config.database.user !== "product_scout" ||
      config.database.readHost ||
      config.database.writeHost
    )
      throw new Error("account_purchase_projection_target_invalid");
    const competitor = await projectCompetitorOutboxOnce(pool, "retired");
    if (competitor.status !== "idle") return competitor;
    return projectAccountPurchaseOnce(pool, "retired");
  }
  if (config && shouldProjectAccountPurchase(config)) {
    const competitor = await projectCompetitorOutboxOnce(pool, "rehearsal");
    if (competitor.status !== "idle") return competitor;
    return projectAccountPurchaseOnce(pool);
  }
  const competitor = await projectCompetitorOutboxOnce(pool);
  if (competitor.status !== "idle") return competitor;
  return projectSourcingPurchaseOnce(pool, workerId, leaseSeconds);
}

async function projectCompetitorOutboxOnce(
  pool: Pool,
  mode: "legacy" | "rehearsal" | "retired" = "legacy",
) {
  const c = await pool.getConnection(),
    now = new Date();
  try {
    const rehearsalOnly = mode === "rehearsal",
      retired = mode === "retired";
    if (rehearsalOnly || retired) {
      const [[target]] = await c.query<RowDataPacket[]>(
        "SELECT DATABASE() db, VERSION() version" +
          (retired ? ", CURRENT_USER() authenticated_as" : ""),
      );
      if (
        (retired
          ? target?.db !== "product_scout" ||
            !/^product_scout@[^@]+$/.test(String(target.authenticated_as ?? ""))
          : !rehearsalName.test(String(target?.db ?? ""))) ||
        !/^5\.7\./.test(String(target?.version ?? ""))
      )
        throw new Error(
          retired
            ? "account_purchase_projection_target_invalid"
            : "mysql57_rehearsal_database_required",
        );
    }
    await c.beginTransaction();
    const legacy = await hasLegacyCompetitorOutboxScope(c);
    const nativeCompetitor = await nativeCompetitorStorage(c);
    if ((nativeCompetitor && legacy) || (retired && !nativeCompetitor))
      throw new Error("competitor_projection_scope_schema_invalid");
    const [rows] = await c.query<RowDataPacket[]>(
      `SELECT o.*${nativeCompetitor ? ",c.account_id" : legacy ? "" : ",c.organization_id,c.workspace_id"},c.title,c.created_by,COALESCE(e.request_id,j.request_id) source_request_id,` +
        "COALESCE(e.trace_id,j.trace_id) source_trace_id FROM competitor_outbox o " +
        "JOIN competitors c ON c.id=o.aggregate_id " +
        (legacy
          ? "AND c.organization_id=o.organization_id AND c.workspace_id=o.workspace_id "
          : "") +
        "LEFT JOIN competitor_events e ON e.id=o.id " +
        (legacy
          ? ""
          : "AND e.event_type=o.event_type AND e.competitor_id=o.aggregate_id AND o.event_type<>'competitor.threshold.triggered' " +
            "LEFT JOIN competitor_alerts a ON o.event_type='competitor.threshold.triggered' AND a.id=o.id AND a.competitor_id=o.aggregate_id " +
            "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.change_id'))=BINARY a.change_id ") +
        "LEFT JOIN competitor_changes ch ON ch.id=CONVERT(JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.change_id')) USING ascii) " +
        "LEFT JOIN competitor_snapshot_jobs j ON j.snapshot_id=ch.snapshot_id " +
        "WHERE o.status='pending' AND o.available_at<=? " +
        (rehearsalOnly || nativeCompetitor
          ? "AND o.event_type='competitor.threshold.triggered' " +
            "AND JSON_TYPE(JSON_EXTRACT(o.payload_json,'$.account_projection_contract'))='INTEGER' " +
            "AND JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.account_projection_contract'))='25' "
          : "") +
        (legacy
          ? ""
          : "AND o.event_type<>'competitor.rule.created' AND (e.id IS NOT NULL OR a.id IS NOT NULL) ") +
        "ORDER BY o.available_at,o.id LIMIT 1 FOR UPDATE",
      [now],
    );
    const event = rows[0];
    if (!event) {
      await c.commit();
      return { status: "idle" as const };
    }
    const payload =
        typeof event.payload_json === "string"
          ? JSON.parse(event.payload_json)
          : event.payload_json,
      threshold = event.event_type === "competitor.threshold.triggered",
      changeId = threshold ? String(payload.change_id ?? "") : "",
      actorId = String(event.created_by),
      requestId = String(event.source_request_id ?? "competitor-outbox").slice(0, 64),
      traceId = String(event.source_trace_id ?? requestId).slice(0, 64);
    const ownedThreshold = threshold && payload.account_projection_contract === 25;
    const ownership = ownedThreshold
      ? await resolveCalculationOwnership(c, String(event.aggregate_id), "competitors")
      : null;
    if ((rehearsalOnly || ownedThreshold) && !ownership?.owner)
      throw new Error("competitor_task_projection_owner_missing");
    if (nativeCompetitor && ownership?.owner?.account_id !== event.account_id)
      throw new Error("competitor_task_projection_owner_mismatch");
    const recipientId = ownership?.owner?.account_id ?? actorId;
    let taskId: string | null = null;
    if (threshold) {
      if (!/^[0-9a-f-]{36}$/i.test(changeId)) throw new Error("competitor_change_id_invalid");
      const nativeBusinessTask = await usesNativeBusinessTasks(c);
      if (nativeCompetitor && !nativeBusinessTask)
        throw new Error("competitor_projection_scope_schema_invalid");
      if (nativeBusinessTask && !ownership?.owner)
        throw new Error("competitor_task_projection_owner_missing");
      const taskScope = nativeBusinessTask
        ? [recipientId]
        : [event.organization_id, event.workspace_id];
      if (ownership) {
        const [[source]] = await c.query<RowDataPacket[]>(
          "SELECT a.rule_id,ch.evidence_id,ch.snapshot_id FROM competitor_alerts a " +
            "JOIN competitor_changes ch ON ch.id=a.change_id AND ch.competitor_id=a.competitor_id " +
            "JOIN competitor_snapshots s ON s.id=ch.snapshot_id AND s.competitor_id=a.competitor_id AND s.evidence_id=ch.evidence_id " +
            "JOIN competitor_monitor_rules r ON r.id=a.rule_id AND (r.competitor_id IS NULL OR r.competitor_id=a.competitor_id) " +
            "JOIN competitors p ON p.id=a.competitor_id " +
            "WHERE a.id=? AND a.competitor_id=? AND ch.id=? AND ch.evidence_id=? FOR UPDATE",
          [event.id, event.aggregate_id, changeId, payload.evidence_id],
        );
        if (
          !source ||
          String(source.rule_id) !== String(payload.rule_id) ||
          !(await calculationOwnersMatch(c, ownership, [
            ["competitor_outbox", String(event.id)],
            ["competitor_alerts", String(event.id)],
            ["competitor_changes", changeId],
            ["competitor_snapshots", String(source.snapshot_id)],
            ["competitor_monitor_rules", String(source.rule_id)],
            ["raw_evidence", String(source.evidence_id)],
          ]))
        )
          throw new Error("competitor_task_projection_owner_mismatch");
      }
      const candidateTaskId = randomUUID(),
        field = String(payload.field ?? "竞品字段").slice(0, 80),
        previous = String(payload.previous ?? "未提供").slice(0, 120),
        current = String(payload.current ?? "未提供").slice(0, 120),
        evidenceId = String(payload.evidence_id ?? "未提供").slice(0, 120),
        changedAt = String(payload.changed_at ?? "未提供").slice(0, 80);
      const [inserted] = await c.query<ResultSetHeader>(
        (nativeBusinessTask
          ? "INSERT INTO tasks (id,account_id,"
          : "INSERT IGNORE INTO tasks (id,organization_id,workspace_id,") +
          "title,description,status," +
          "priority,assignee_id,source_type,source_ref_id,due_at,completed_at,created_by,version," +
          "created_at,updated_at) VALUES (" +
          (nativeBusinessTask ? "?,?,?,?" : "?,?,?,?,?") +
          ",'todo','high',?,'selection_verification',?,NULL,NULL,?,1,?,?)" +
          (nativeBusinessTask ? " ON DUPLICATE KEY UPDATE id=id" : ""),
        [
          candidateTaskId,
          ...taskScope,
          `复核竞品变化 · ${field} · ${String(event.title)}`.slice(0, 200),
          `竞品 ${event.aggregate_id} 的监控阈值已触发。\n字段：${field}\n变化：${previous} → ${current}\n证据：${evidenceId}\n采集时间：${changedAt}\n请核对原始证据后记录结论，不覆盖竞品快照历史。`,
          recipientId,
          changeId,
          actorId,
          now,
          now,
        ],
      );
      const [tasks] = await c.query<RowDataPacket[]>(
        (ownership ? "SELECT id,deleted_at FROM tasks " : "SELECT id FROM tasks ") +
          (nativeBusinessTask
            ? "WHERE account_id=? "
            : "WHERE organization_id=? AND workspace_id=? ") +
          "AND source_type='selection_verification' AND source_ref_id=? LIMIT 1" +
          (ownership ? " FOR UPDATE" : ""),
        [...taskScope, changeId],
      );
      if (!tasks[0]) throw new Error("competitor_validation_task_missing");
      taskId = String(tasks[0].id);
      if (ownership) {
        if (tasks[0].deleted_at) throw new Error("competitor_validation_task_deleted");
        if (inserted.affectedRows === 1 && taskId === candidateTaskId) {
          const taskEventId = randomUUID();
          await c.query(
            "INSERT INTO task_events (id,task_id,event_type,actor_id,payload_json,request_id,trace_id,created_at) " +
              "VALUES (?,?,'task.created',?,?,?,?,?)",
            [
              taskEventId,
              taskId,
              actorId,
              JSON.stringify({
                source_type: "selection_verification",
                source_ref_id: changeId,
                competitor_id: String(event.aggregate_id),
                evidence_id: evidenceId,
              }),
              requestId,
              traceId,
              now,
            ],
          );
          await registerCalculationOwners(c, ownership, [
            ["tasks", taskId],
            ["task_events", taskEventId],
          ]);
        } else if (!(await calculationOwnersMatch(c, ownership, [["tasks", taskId]])))
          throw new Error("competitor_validation_task_owner_mismatch");
      }
      await c.query(
        "UPDATE competitor_alerts a JOIN competitors c ON c.id=a.competitor_id " +
          "SET a.task_status='created',a.updated_at=? WHERE a.id=? AND " +
          (nativeCompetitor ? "c.account_id=?" : "c.organization_id=? AND c.workspace_id=?"),
        [
          now,
          event.id,
          ...(nativeCompetitor ? [recipientId] : [event.organization_id, event.workspace_id]),
        ],
      );
    }
    const notificationPayload = {
      ...payload,
      resource_type: "competitor",
      resource_id: String(event.aggregate_id),
      ...(threshold ? { recipient_id: recipientId, task_id: taskId } : {}),
      ...(nativeCompetitor
        ? { competitor_id: String(event.aggregate_id), competitor_account_contract: 25 }
        : {}),
    };
    const [outbox] = await c.query<ResultSetHeader>(
      "INSERT IGNORE INTO outbox_events (id," +
        (nativeCompetitor ? "" : "organization_id,workspace_id,") +
        "event_type," +
        "schema_version,payload_json,status,attempt_count,available_at,leased_at," +
        "lease_expires_at,published_at,request_id,trace_id,created_at,updated_at,version) " +
        "VALUES (" +
        (nativeCompetitor ? "?,?" : "?,?,?,?") +
        ",1,?,'pending',0,?,NULL,NULL,NULL,?,?,?,?,1)",
      [
        event.id,
        ...(nativeCompetitor ? [] : [event.organization_id, event.workspace_id]),
        event.event_type,
        JSON.stringify(notificationPayload),
        now,
        requestId,
        traceId,
        now,
        now,
      ],
    );
    if (ownership) {
      if (outbox.affectedRows === 1)
        await registerCalculationOwners(c, ownership, [["outbox_events", String(event.id)]]);
      else {
        const [[existing]] = await c.query<RowDataPacket[]>(
          "SELECT id FROM outbox_events WHERE id=? AND event_type=? " +
            (nativeCompetitor
              ? "AND JSON_EXTRACT(payload_json,'$.competitor_account_contract')=25 "
              : "AND organization_id=? AND workspace_id=? ") +
            "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.task_id'))=BINARY ? " +
            "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.recipient_id'))=BINARY ? " +
            "AND BINARY JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.change_id'))=BINARY ? FOR UPDATE",
          [
            event.id,
            event.event_type,
            ...(nativeCompetitor ? [] : [event.organization_id, event.workspace_id]),
            taskId,
            recipientId,
            changeId,
          ],
        );
        if (
          !existing ||
          !(await calculationOwnersMatch(c, ownership, [["outbox_events", String(event.id)]]))
        )
          throw new Error("competitor_validation_delivery_owner_mismatch");
      }
    }
    await c.query("UPDATE competitor_outbox SET status='delivered' WHERE id=?", [event.id]);
    await c.commit();
    return {
      status: "projected" as const,
      event_id: String(event.id),
      ...(taskId ? { taskId } : {}),
    };
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    c.release();
  }
}

async function projectSourcingPurchaseOnce(pool: Pool, workerId: string, leaseSeconds: number) {
  const c = await pool.getConnection(),
    now = new Date(),
    lease = new Date(now.valueOf() + leaseSeconds * 1000);
  let event: any = null;
  try {
    await c.beginTransaction();
    const legacy = await hasLegacySourcingOutboxScope(c);
    const legacyEvent = legacy || (await hasLegacySourcingEventScope(c));
    const eventScope = legacyEvent ? "e" : "ps";
    const [rows] = await c.query<RowDataPacket[]>(
      legacy
        ? "SELECT * FROM sourcing_outbox WHERE event_type='sourcing.purchase_task.queued' AND ((status='queued' AND available_at<=?) OR (status='leased' AND lease_expires_at<?)) ORDER BY available_at,id LIMIT 1 FOR UPDATE"
        : `SELECT o.*,${eventScope}.organization_id,${eventScope}.workspace_id FROM sourcing_outbox o
         JOIN sourcing_events e ON e.id=o.id AND e.resource_id=o.resource_id AND BINARY e.event_type=BINARY o.event_type
         ${legacyEvent ? "" : sourcingPurchaseParentJoin}
         WHERE o.event_type='sourcing.purchase_task.queued'
           AND BINARY JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.id'))=BINARY o.resource_id
           AND ((o.status='queued' AND o.available_at<=?) OR (o.status='leased' AND o.lease_expires_at<?))
         ORDER BY o.available_at,o.id LIMIT 1 FOR UPDATE`,
      [now, now],
    );
    event = rows[0];
    if (!event) {
      await c.commit();
      return { status: "idle" as const };
    }
    await c.query(
      "UPDATE sourcing_outbox SET status='leased',leased_by=?,leased_at=?,lease_expires_at=? WHERE id=?",
      [workerId, now, lease, event.id],
    );
    await c.commit();
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
  const payload =
      typeof event.payload_json === "string" ? JSON.parse(event.payload_json) : event.payload_json,
    taskId = randomUUID();
  try {
    await pool.query(
      "INSERT IGNORE INTO tasks (id,organization_id,workspace_id,title,description,status,priority,assignee_id," +
        "source_type,source_ref_id,due_at,completed_at,created_by,version,created_at,updated_at) " +
        "SELECT ?,qs.organization_id,qs.workspace_id,CONCAT('处理采购任务 · ',LEFT(CONVERT(p.id USING utf8mb4),8))," +
        "CONCAT('来源于已排队采购任务 ',CONVERT(p.id USING utf8mb4)),'todo','normal',p.created_by,'sourcing_purchase'," +
        "p.id,NULL,NULL,p.created_by,1,?,? FROM sourcing_purchase_tasks p JOIN supplier_quotes q ON q.id=p.quote_id " +
        "JOIN sourcing_candidates qc ON qc.id=q.candidate_id JOIN sourcing_searches qs ON qs.id=qc.search_id " +
        "WHERE p.id=? AND qs.organization_id=? AND qs.workspace_id=?",
      [taskId, now, now, payload.id, event.organization_id, event.workspace_id],
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT id,created_by FROM tasks WHERE organization_id=? AND workspace_id=? AND source_type='sourcing_purchase' AND source_ref_id=?",
      [event.organization_id, event.workspace_id, payload.id],
    );
    if (!rows[0]) throw new Error("purchase_task_scope_invalid");
    await pool.query(
      "UPDATE sourcing_outbox SET status='published',leased_by=NULL,leased_at=NULL,lease_expires_at=NULL WHERE id=?",
      [event.id],
    );
    return { status: "projected" as const, taskId: String(rows[0].id) };
  } catch (e) {
    await pool.query(
      "UPDATE sourcing_outbox SET status='queued',available_at=DATE_ADD(NOW(3),INTERVAL 60 SECOND),lease_expires_at=NULL WHERE id=?",
      [event.id],
    );
    throw e;
  }
}
