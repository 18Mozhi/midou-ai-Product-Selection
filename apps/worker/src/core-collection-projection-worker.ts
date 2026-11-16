import {
  appendCollectionSubquery,
  collectionTaskScope,
  insertScheduledHighCollectionTask,
} from "@scoutops/database";
import { opportunityEventReadRelation } from "@scoutops/database";
import { automaticCollectionBacklogCountSql } from "./collection-source-scheduling-policy.js";
import { nativeCollectionBacklogCountSql } from "./collection-account-backlog.js";
import { nativeCompletionTaskProof } from "./native-completion-task-proof.js";
import { nativeCompetitorStorage } from "./competitor-storage.js";
import { nativeOpportunityStorage } from "./opportunity-storage.js";
import { randomUUID } from "node:crypto";
import { appendCompetitorEvent, appendCompetitorOutbox } from "@scoutops/database";
import { competitorDetailEvidenceSql } from "@scoutops/database";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { queueAutomaticSelectionEvaluation } from "./automatic-selection-evaluation-worker.js";
import { queueOwnedSelectionEvaluation } from "./account-evaluation-enqueue.js";
import {
  registerSourcingCandidate,
  requireSourcingOwners,
  requireSourcingRecordOwner,
} from "./sourcing-projection-ownership.js";
import {
  calculationOwnersMatch,
  registerCalculationOwners,
  resolveCalculationOwnership,
  type CalculationOwnership,
  type CalculationOwnerRef,
} from "./opportunity-calculation-ownership.js";
import {
  readCompetitorClassificationContext,
  sealedClassificationOrigin,
  validateCompetitorTitleRelations,
} from "./competitor-title-classification.js";
import {
  amazonAsin,
  COMPETITOR_DISCOVERY_MINIMUM,
  selectIndependentCompetitors,
} from "./competitor-discovery-policy.js";

type ProjectionType = "opportunity_competitors" | "competitor_snapshot" | "sourcing_search";
type Job = {
  runId: string;
  taskId: string;
  organizationId: string;
  workspaceId: string;
  projectionType: ProjectionType;
  resourceId: string;
  requestId: string;
  traceId: string;
  actorId: string;
  primaryAsin: string | null;
  subqueryId: string;
  accountId?: string;
  nativeCompetitor?: boolean;
  nativeOpportunity?: boolean;
};
const competitorScope = (job: Job) => {
  if (job.nativeCompetitor) {
    if (!job.accountId) throw new Error("core_projection_owner_mismatch");
    return {
      columns: "account_id",
      placeholders: "?",
      where: "account_id=?",
      values: [job.accountId],
    };
  }
  return {
    columns: "organization_id,workspace_id",
    placeholders: "?,?",
    where: "organization_id=? AND workspace_id=?",
    values: [job.organizationId, job.workspaceId],
  };
};
const accountPath = (type: ProjectionType) =>
  type === "opportunity_competitors"
    ? "opportunities"
    : type === "competitor_snapshot"
      ? "competitors"
      : "sourcing_searches";
const projectionResourceKey = (type: ProjectionType) =>
  type === "opportunity_competitors"
    ? "opportunity_id"
    : type === "competitor_snapshot"
      ? "competitor_id"
      : "search_id";
const projectionAsin = (target: Record<string, unknown>) =>
  typeof target.main_asin === "string" && /^[A-Z0-9]{10}$/i.test(target.main_asin)
    ? target.main_asin.toUpperCase()
    : null;
type RecordRow = RowDataPacket & {
  evidence_link_id: string;
  collection_subquery_id: string;
  id: string;
  provider_id: string;
  raw_evidence_id: string;
  payload_json: unknown;
  captured_at: Date;
};

const parse = <T>(value: unknown): T =>
  (typeof value === "string" ? JSON.parse(value) : value) as T;
const optionalText = (value: unknown, max = 2048) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
const optionalNumber = (value: unknown) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export class CoreCollectionProjectionWorker {
  constructor(
    private readonly pool: Pool,
    private readonly workerId: string,
    private readonly now: () => Date = () => new Date(),
    private readonly queueBacklogLimit = 1000,
  ) {}

  async processOnce() {
    const job = await this.claim();
    if (!job) return { status: "idle" as const };
    try {
      const count = await this.project(job);
      const incomplete =
        job.projectionType === "opportunity_competitors" && count < COMPETITOR_DISCOVERY_MINIMUM;
      await this.pool.query(
        "UPDATE core_collection_projection_runs SET status=?,item_count=?,error_code=?,finished_at=? WHERE id=? AND status='processing'",
        [
          count ? "succeeded" : "succeeded_empty",
          count,
          incomplete ? "competitor_count_below_minimum" : null,
          this.now(),
          job.runId,
        ],
      );
      return {
        status: count ? ("succeeded" as const) : ("succeeded_empty" as const),
        task_id: job.taskId,
        projection_type: job.projectionType,
        item_count: count,
        ...(job.projectionType === "opportunity_competitors"
          ? { discovery_status: incomplete ? "insufficient" : "minimum_met" }
          : {}),
      };
    } catch (error) {
      const code = String((error as { code?: string }).code ?? "projection_failed")
        .toLowerCase()
        .slice(0, 120);
      await this.pool.query(
        "UPDATE core_collection_projection_runs SET status='failed',error_code=?,finished_at=? WHERE id=? AND status='processing'",
        [code, this.now(), job.runId],
      );
      return {
        status: "failed" as const,
        task_id: job.taskId,
        projection_type: job.projectionType,
        error_code: code,
      };
    }
  }

  private async claim(): Promise<Job | null> {
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const native = (await collectionTaskScope(c)) === "account";
      const [rows] = await c.query<RowDataPacket[]>(
        `SELECT t.id,${native ? "t.account_id" : "t.organization_id,t.workspace_id"},t.request_id,t.trace_id,t.created_by,s.target_json,s.id classification_subquery_id
         FROM collection_tasks t
         JOIN collection_subqueries s ON s.task_id=t.id
         LEFT JOIN core_collection_projection_runs r ON r.collection_task_id=t.id
         WHERE r.id IS NULL
           ${
             native
               ? `AND EXISTS (SELECT 1 FROM account_ownership_cutover cut
             JOIN account_owned_records ot ON ot.source_table='collection_tasks'
             JOIN account_owned_records os ON os.source_table='collection_subqueries' AND os.account_id=ot.account_id
             WHERE cut.slot='current' AND cut.contract_version=25
               AND ot.source_id=t.id AND ot.account_id=t.account_id AND os.source_id=s.id
               AND (ot.reason='exclusive_owner' OR (ot.reason IN ('shared','unassigned') AND ot.account_id=cut.primary_account_id)))`
               : ""
           }
           AND t.status IN ('succeeded','succeeded_empty','completed_with_warnings')
           AND JSON_UNQUOTE(JSON_EXTRACT(s.target_json,'$.projection_type')) IN ('opportunity_competitors','competitor_snapshot','sourcing_search')
           AND (JSON_UNQUOTE(JSON_EXTRACT(s.target_json,'$.projection_type'))<>'opportunity_competitors'
             OR ${native ? nativeCollectionBacklogCountSql : automaticCollectionBacklogCountSql}<?)
         ORDER BY t.finished_at,t.id LIMIT 1`,
        [this.queueBacklogLimit],
      );
      const candidate = rows[0];
      if (!candidate) {
        await c.commit();
        return null;
      }
      // The filesorted backlog read must not lock unrelated running collectors.
      // Recheck the selected identities with current locking reads in task/query order.
      const [tasks] = await c.query<RowDataPacket[]>(
        "SELECT id," +
          (native ? "account_id" : "organization_id,workspace_id") +
          ",request_id,trace_id,created_by FROM collection_tasks WHERE id=? AND " +
          (native ? "account_id=? " : "organization_id=? AND workspace_id=? ") +
          "AND status IN ('succeeded','succeeded_empty','completed_with_warnings') FOR UPDATE",
        native
          ? [candidate.id, candidate.account_id]
          : [candidate.id, candidate.organization_id, candidate.workspace_id],
      );
      if (!tasks[0]) {
        await c.commit();
        return null;
      }
      const [queries] = await c.query<RowDataPacket[]>(
        "SELECT target_json,id classification_subquery_id FROM collection_subqueries " +
          "WHERE id=? AND task_id=? " +
          "AND JSON_UNQUOTE(JSON_EXTRACT(target_json,'$.projection_type')) " +
          "IN ('opportunity_competitors','competitor_snapshot','sourcing_search') FOR UPDATE",
        [candidate.classification_subquery_id, candidate.id],
      );
      if (!queries[0]) {
        await c.commit();
        return null;
      }
      const [existing] = await c.query<RowDataPacket[]>(
        "SELECT id FROM core_collection_projection_runs WHERE collection_task_id=? FOR UPDATE",
        [candidate.id],
      );
      if (existing[0]) {
        await c.commit();
        return null;
      }
      const row = { ...tasks[0], ...queries[0] };
      const target = parse<Record<string, unknown>>(row.target_json),
        projectionType = String(target.projection_type) as ProjectionType,
        resourceId = String(target[projectionResourceKey(projectionType)] ?? ""),
        runId = randomUUID();
      if (!/^[0-9a-f-]{36}$/i.test(resourceId)) throw new Error("projection_target_invalid");
      const taskOwner = native
        ? await resolveCalculationOwnership(c, String(row.id), "collection_tasks")
        : null;
      if (
        native &&
        (!taskOwner?.owner ||
          taskOwner.owner.account_id !== row.account_id ||
          !(await calculationOwnersMatch(c, taskOwner, [
            ["collection_subqueries", String(row.classification_subquery_id)],
          ])))
      ) {
        await c.commit();
        return null;
      }
      const [scopeColumns] = await c.query<RowDataPacket[]>(
        "SHOW COLUMNS FROM core_collection_projection_runs WHERE Field IN ('organization_id','workspace_id')",
      );
      if (scopeColumns.length !== 0 && scopeColumns.length !== 2)
        throw new Error("partial_inherited_scope_schema:core_collection_projection_runs");
      const legacy = scopeColumns.length === 2;
      if (native && legacy) throw new Error("core_projection_account_schema_required");
      await c.query(
        `INSERT INTO core_collection_projection_runs(id,${legacy ? "organization_id,workspace_id," : ""}collection_task_id,projection_type,resource_id,status,item_count,error_code,started_at,finished_at) VALUES(${legacy ? "?,?," : ""}?,?,?,?,'processing',0,NULL,?,NULL)`,
        [
          runId,
          ...(legacy ? [row.organization_id, row.workspace_id] : []),
          row.id,
          projectionType,
          resourceId,
          now,
        ],
      );
      await c.commit();
      return {
        runId,
        taskId: String(row.id),
        organizationId: native ? "" : String(row.organization_id),
        workspaceId: native ? "" : String(row.workspace_id),
        ...(native ? { accountId: String(row.account_id) } : {}),
        projectionType,
        resourceId,
        requestId: String(row.request_id),
        traceId: String(row.trace_id),
        actorId: String(row.created_by),
        subqueryId: String(row.classification_subquery_id),
        primaryAsin: projectionAsin(target),
      };
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }

  private async records(c: PoolConnection, job: Job, accountSourcing = false) {
    if (accountSourcing || job.accountId) {
      const [rows] = await c.query<RecordRow[]>(
        `SELECT n.id,n.provider_id,n.raw_evidence_id,n.payload_json,e.captured_at,l.id evidence_link_id,l.collection_subquery_id
         FROM collection_task_evidence_links l
         JOIN collection_subqueries sq ON sq.id=l.collection_subquery_id AND sq.task_id=l.collection_task_id AND sq.provider_id=l.provider_id
         JOIN normalized_records n ON n.id=l.normalized_record_id AND n.raw_evidence_id=l.raw_evidence_id
           AND n.provider_id=l.provider_id AND n.status='active'
         JOIN raw_evidence e ON e.id=l.raw_evidence_id AND e.provider_id=l.provider_id
         ${job.accountId ? "JOIN collection_tasks origin ON origin.id=e.collection_task_id AND origin.account_id=e.account_id " : ""}
         WHERE l.collection_task_id=? AND sq.id=?
         ${
           job.accountId
             ? "AND n.account_id=? AND e.account_id=n.account_id " +
               "AND EXISTS (SELECT 1 FROM account_owned_records oo WHERE oo.source_table='collection_tasks' AND oo.source_id=origin.id AND oo.account_id=origin.account_id)"
             : ""
         }
         ORDER BY l.created_at,n.id`,
        [job.taskId, job.subqueryId, ...(job.accountId ? [job.accountId] : [])],
      );
      return rows;
    }
    const [rows] = await c.query<RecordRow[]>(
      `SELECT n.id,n.provider_id,n.raw_evidence_id,n.payload_json,e.captured_at,l.id evidence_link_id,l.collection_subquery_id
       FROM collection_task_evidence_links l
       JOIN collection_tasks link_task ON link_task.id=l.collection_task_id
       JOIN normalized_records n ON n.id=l.normalized_record_id AND n.raw_evidence_id=l.raw_evidence_id
         AND n.organization_id=link_task.organization_id AND n.workspace_id=link_task.workspace_id AND n.status='active'
       JOIN raw_evidence e ON e.id=l.raw_evidence_id
       WHERE l.collection_task_id=? AND link_task.organization_id=? AND link_task.workspace_id=?
       ORDER BY l.created_at,n.id`,
      [job.taskId, job.organizationId, job.workspaceId],
    );
    return rows;
  }

  private async project(job: Job) {
    const c = await this.pool.getConnection(),
      now = this.now();
    try {
      await c.beginTransaction();
      const parent = accountPath(job.projectionType);
      if (job.accountId && parent !== "sourcing_searches")
        job = { ...job, nativeCompetitor: await nativeCompetitorStorage(c) };
      if (job.accountId && parent === "opportunities")
        job = { ...job, nativeOpportunity: await nativeOpportunityStorage(c) };
      if (job.accountId) {
        const [tasks] = await c.query<RowDataPacket[]>(
          "SELECT id FROM collection_tasks WHERE id=? AND account_id=? AND request_id=? AND trace_id=? " +
            "AND status IN ('succeeded','succeeded_empty','completed_with_warnings') FOR UPDATE",
          [job.taskId, job.accountId, job.requestId, job.traceId],
        );
        if (!tasks[0])
          throw Object.assign(new Error("core_projection_owner_mismatch"), {
            code: "core_projection_owner_mismatch",
          });
        const [[subquery]] = await c.query<RowDataPacket[]>(
          "SELECT target_json FROM collection_subqueries WHERE id=? AND task_id=? FOR UPDATE",
          [job.subqueryId, job.taskId],
        );
        const target = subquery ? parse<Record<string, unknown>>(subquery.target_json) : null;
        if (
          !target ||
          target.projection_type !== job.projectionType ||
          target[projectionResourceKey(job.projectionType)] !== job.resourceId ||
          (job.projectionType === "opportunity_competitors" &&
            projectionAsin(target) !== job.primaryAsin)
        )
          throw Object.assign(new Error("core_projection_target_changed"), {
            code: "core_projection_target_changed",
          });
      }
      const ownership =
        job.accountId || job.projectionType === "sourcing_search"
          ? await resolveCalculationOwnership(c, job.resourceId, parent)
          : null;
      if (job.accountId) {
        if (
          ownership?.owner?.account_id !== job.accountId ||
          !(await calculationOwnersMatch(c, ownership, [
            ["collection_tasks", job.taskId],
            ["collection_subqueries", job.subqueryId],
          ]))
        )
          throw Object.assign(new Error("core_projection_owner_mismatch"), {
            code: "core_projection_owner_mismatch",
          });
        if (parent === "competitors" && job.nativeCompetitor) {
          const [[row]] = await c.query<RowDataPacket[]>(
            "SELECT id FROM competitors WHERE id=? AND account_id=? FOR UPDATE",
            [job.resourceId, job.accountId],
          );
          if (!row) throw new Error("core_projection_owner_mismatch");
        } else if (parent === "opportunities" && job.nativeOpportunity) {
          const [[row]] = await c.query<RowDataPacket[]>(
            "SELECT id FROM opportunities WHERE id=? AND account_id=? FOR UPDATE",
            [job.resourceId, job.accountId],
          );
          if (!row) throw new Error("core_projection_owner_mismatch");
        } else if (parent !== "sourcing_searches") {
          // The competitor/opportunity tables still have required history columns.
          // Resolve the exact owned parent; never infer coordinates from an account.
          const [parents] = await c.query<RowDataPacket[]>(
            `SELECT organization_id,workspace_id FROM ${parent} WHERE id=? FOR UPDATE`,
            [job.resourceId],
          );
          if (!parents[0]?.organization_id || !parents[0].workspace_id)
            throw new Error("core_projection_parent_missing");
          job = {
            ...job,
            organizationId: String(parents[0].organization_id),
            workspaceId: String(parents[0].workspace_id),
          };
        }
      }
      if (ownership && !ownership.owner)
        throw Object.assign(new Error("sourcing_projection_owner_mismatch"), {
          code: "sourcing_projection_owner_mismatch",
        });
      const records = await this.records(c, job, Boolean(ownership?.owner));
      let count = 0;
      if (job.projectionType === "opportunity_competitors")
        count = await this.projectCompetitorDiscovery(c, job, records, now);
      else if (job.projectionType === "competitor_snapshot")
        count = await this.projectCompetitorSnapshot(c, job, records, now);
      else count = await this.projectSourcing(c, job, records, now, ownership);
      if (count > 0) await this.requeueEvaluation(c, job, now, ownership?.owner?.account_id);
      await c.commit();
      return count;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }

  private async requeueEvaluation(c: PoolConnection, job: Job, now: Date, accountId?: string) {
    let opportunityId: string | null =
      job.projectionType === "opportunity_competitors" ? job.resourceId : null;
    if (job.projectionType === "competitor_snapshot") {
      const scope = competitorScope(job);
      const [rows] = await c.query<RowDataPacket[]>(
        `SELECT opportunity_id FROM competitors WHERE id=? AND ${scope.where} AND deleted_at IS NULL`,
        [job.resourceId, ...scope.values],
      );
      opportunityId = rows[0]?.opportunity_id ? String(rows[0].opportunity_id) : null;
    } else if (job.projectionType === "sourcing_search") {
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT input_ref FROM sourcing_searches WHERE id=? " +
          (accountId ? "AND collection_task_id=? " : "AND organization_id=? AND workspace_id=? ") +
          "AND input_type='opportunity' AND deleted_at IS NULL",
        accountId
          ? [job.resourceId, job.taskId]
          : [job.resourceId, job.organizationId, job.workspaceId],
      );
      opportunityId = rows[0]?.input_ref ? String(rows[0].input_ref) : null;
    }
    if (opportunityId && accountId) {
      const native = job.nativeOpportunity ?? (await nativeOpportunityStorage(c));
      await queueOwnedSelectionEvaluation(c, opportunityId, accountId, native, now);
    } else if (opportunityId)
      await queueAutomaticSelectionEvaluation(c, {
        opportunityId,
        organizationId: job.organizationId,
        workspaceId: job.workspaceId,
        now,
      });
  }

  private async projectCompetitorDiscovery(
    c: PoolConnection,
    job: Job,
    records: RecordRow[],
    now: Date,
  ) {
    const opportunityScope = job.nativeOpportunity
      ? "account_id=?"
      : "organization_id=? AND workspace_id=?";
    const original = job.nativeOpportunity
      ? [job.accountId]
      : [job.organizationId, job.workspaceId];
    const [opportunities] = await c.query<RowDataPacket[]>(
      `SELECT id,market FROM opportunities WHERE id=? AND ${opportunityScope} FOR UPDATE`,
      [job.resourceId, ...original],
    );
    if (!opportunities[0]) throw new Error("opportunity_not_found");
    if (!job.primaryAsin) return 0;
    const ownership = await resolveCalculationOwnership(c, job.resourceId);
    if (job.nativeCompetitor && ownership?.owner?.account_id !== job.accountId)
      throw new Error("core_projection_owner_mismatch");
    const scope = competitorScope(job);
    await this.requireCompetitorOwners(c, ownership, [
      ["collection_tasks", job.taskId],
      ["collection_subqueries", job.subqueryId],
    ]);
    const [proofs] = await c.query<RowDataPacket[]>(
      job.nativeOpportunity
        ? "SELECT e.payload_json FROM opportunity_events e JOIN account_owned_records p " +
            "ON p.source_table='opportunity_events' AND p.source_id=e.id AND p.account_id=? " +
            "WHERE e.resource_id=? AND e.resource_type='opportunity' AND e.event_type='opportunity.competitors_classified' " +
            "AND e.request_id=? AND e.trace_id=? AND JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.task_id'))=? " +
            "AND JSON_UNQUOTE(JSON_EXTRACT(e.payload_json,'$.subquery_id'))=? ORDER BY e.occurred_at DESC,e.id DESC LIMIT 1 LOCK IN SHARE MODE"
        : "SELECT payload_json FROM " +
            opportunityEventReadRelation +
            " event_scoped WHERE organization_id=? AND workspace_id=? AND resource_id=? AND resource_type='opportunity' AND event_type='opportunity.competitors_classified' AND JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.task_id'))=? AND JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.subquery_id'))=? ORDER BY occurred_at DESC,id DESC LIMIT 1",
      job.nativeOpportunity
        ? [job.accountId, job.resourceId, job.requestId, job.traceId, job.taskId, job.subqueryId]
        : [job.organizationId, job.workspaceId, job.resourceId, job.taskId, job.subqueryId],
    );
    if (!proofs[0]) return 0;
    let related: Set<string>;
    try {
      const proof = parse<Record<string, unknown>>(proofs[0].payload_json);
      const origin =
        job.nativeOpportunity && job.accountId
          ? await sealedClassificationOrigin(c, job.resourceId, job.accountId, true)
          : null;
      if (job.nativeOpportunity && !origin) return 0;
      const context = await readCompetitorClassificationContext(c, {
        taskId: job.taskId,
        subqueryId: job.subqueryId,
        organizationId: origin?.kind === "historical" ? origin.organizationId : job.organizationId,
        workspaceId: origin?.kind === "historical" ? origin.workspaceId : job.workspaceId,
        opportunityId: job.resourceId,
        mainAsin: job.primaryAsin,
        ...(origin?.kind === "account" ? { accountId: origin.accountId } : {}),
      });
      if (
        proof.version !== "competitor-title-v1" ||
        typeof proof.model_fingerprint !== "string" ||
        !/^[a-f0-9]{64}$/.test(proof.model_fingerprint) ||
        proof.input_fingerprint !== context.fingerprint
      )
        return 0;
      related = new Set(
        validateCompetitorTitleRelations({ classifications: proof.classifications }, context.input)
          .filter((r) => r.relation === "substitute")
          .map((r) => r.source_ref),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "SyntaxError" ||
          ("code" in error && String(error.code).startsWith("competitor_")))
      )
        return 0;
      throw error;
    }
    let count = 0;
    const selected = selectIndependentCompetitors(
      records.filter(
        (record) =>
          related.has(String(record.id)) &&
          (!ownership || String(record.collection_subquery_id) === job.subqueryId),
      ),
      (record) => {
        const fields = parse<Record<string, unknown>>(record.payload_json);
        return { fields, canonicalUrl: String(fields.canonical_url ?? fields.source_url ?? "") };
      },
      job.primaryAsin,
    );
    for (const record of selected) {
      const fields = parse<Record<string, unknown>>(record.payload_json),
        url = optionalText(fields.canonical_url ?? fields.source_url),
        title = optionalText(fields.title, 500),
        asin = url ? amazonAsin(fields, url) : null;
      if (!url || !title || !asin) continue;
      await this.requireCompetitorRecordOwners(c, ownership, record);
      const competitorId = randomUUID();
      const [insert] = await c.query<any>(
        `INSERT ${job.nativeCompetitor ? "" : "IGNORE "}INTO competitors(id,${scope.columns},opportunity_id,provider_id,market,source_site,external_id,product_url,title,status,latest_snapshot_id,revision,created_by,created_at,updated_at,deleted_at) VALUES(?,${scope.placeholders},?,?,?, 'Amazon',?,?,?,'active',NULL,1,?,?,?,NULL)` +
          (job.nativeCompetitor ? " ON DUPLICATE KEY UPDATE id=id" : ""),
        [
          competitorId,
          ...scope.values,
          job.resourceId,
          record.provider_id,
          String(opportunities[0].market),
          asin,
          url,
          title,
          job.actorId,
          now,
          now,
        ],
      );
      const [competitors] = await c.query<RowDataPacket[]>(
        `SELECT id,opportunity_id FROM competitors WHERE ${scope.where} AND market=? AND source_site='Amazon' AND external_id=? AND opportunity_id=? AND deleted_at IS NULL LIMIT 1` +
          (job.nativeCompetitor ? " FOR UPDATE" : ""),
        [...scope.values, String(opportunities[0].market), asin, job.resourceId],
      );
      if (!competitors[0] || String(competitors[0].opportunity_id) !== job.resourceId) continue;
      const persistedId = String(competitors[0]?.id ?? competitorId);
      if (Number(insert.affectedRows ?? 0) && persistedId === competitorId)
        await registerCalculationOwners(c, ownership, [["competitors", persistedId]]);
      else await this.requireCompetitorOwners(c, ownership, [["competitors", persistedId]]);
      if (await this.insertSnapshot(c, job, persistedId, record, fields, now, false, ownership))
        count += 1;
      else if (Number(insert.affectedRows ?? 0) && persistedId === competitorId) count += 1;
      await this.scheduleCompetitorDetail(
        c,
        job,
        persistedId,
        record.provider_id,
        url,
        now,
        ownership,
      );
    }
    await c.query(`UPDATE opportunities SET updated_at=? WHERE id=? AND ${opportunityScope}`, [
      now,
      job.resourceId,
      ...original,
    ]);
    return count;
  }

  private async scheduleCompetitorDetail(
    c: PoolConnection,
    job: Job,
    competitorId: string,
    providerId: string,
    pageUrl: string,
    now: Date,
    ownership: CalculationOwnership,
  ) {
    const taskId = randomUUID();
    const subqueryId = randomUUID(),
      taskEventId = randomUUID();
    const owner = ownership?.owner;
    const accountOnly = Boolean(owner && (await collectionTaskScope(c)) === "account");
    await insertScheduledHighCollectionTask(c, {
      id: taskId,
      now,
      actorId: job.actorId,
      requestId: job.requestId,
      traceId: job.traceId,
      scope:
        accountOnly && owner
          ? { kind: "account", accountId: owner.account_id }
          : { kind: "legacy", organizationId: job.organizationId, workspaceId: job.workspaceId },
    });
    await appendCollectionSubquery(
      c,
      {
        id: subqueryId,
        taskId,
        providerId,
        ordinal: 1,
        required: true,
        status: "pending",
        now,
        targetJson: JSON.stringify({
          page_url: pageUrl,
          projection_type: "competitor_snapshot",
          competitor_id: competitorId,
        }),
      },
      accountOnly,
    );
    await c.query(
      "INSERT INTO collection_task_events(id,task_id,event_type,from_status,to_status,actor_type,actor_id,request_id,trace_id,metadata_json,occurred_at) VALUES(?,?,'competitor.detail.auto_scheduled',NULL,'scheduled','worker',?,?,?,?,?)",
      [
        taskEventId,
        taskId,
        this.workerId,
        job.requestId,
        job.traceId,
        JSON.stringify({ opportunity_id: job.resourceId, competitor_id: competitorId }),
        now,
      ],
    );
    const eventId = randomUUID();
    const payload = JSON.stringify({
      task_id: taskId,
      competitor_id: competitorId,
      opportunity_id: job.resourceId,
      automatic: true,
    });
    await appendCompetitorEvent(c, {
      id: eventId,
      organizationId: job.organizationId,
      workspaceId: job.workspaceId,
      parentId: competitorId,
      eventType: "competitor.collection.scheduled",
      actorId: job.actorId,
      payloadJson: payload,
      requestId: job.requestId,
      traceId: job.traceId,
      createdAt: now,
    });
    await appendCompetitorOutbox(c, {
      id: eventId,
      organizationId: job.organizationId,
      workspaceId: job.workspaceId,
      parentId: competitorId,
      eventType: "competitor.collection.scheduled",
      payloadJson: payload,
      createdAt: now,
    });
    await registerCalculationOwners(c, ownership, [
      ["collection_tasks", taskId],
      ["collection_subqueries", subqueryId],
      ["collection_task_events", taskEventId],
      ["competitor_events", eventId],
      ["competitor_outbox", eventId],
    ]);
  }

  private async requireCompetitorOwners(
    c: PoolConnection,
    ownership: CalculationOwnership,
    refs: CalculationOwnerRef[],
  ) {
    if (!(await calculationOwnersMatch(c, ownership, refs)))
      throw Object.assign(new Error("competitor_projection_owner_mismatch"), {
        code: "competitor_projection_owner_mismatch",
      });
  }

  private async requireCompetitorRecordOwners(
    c: PoolConnection,
    ownership: CalculationOwnership,
    row: RecordRow,
  ) {
    await this.requireCompetitorOwners(c, ownership, [
      ["normalized_records", row.id],
      ["raw_evidence", row.raw_evidence_id],
      ["collection_task_evidence_links", row.evidence_link_id],
    ]);
  }

  private async projectCompetitorSnapshot(
    c: PoolConnection,
    job: Job,
    records: RecordRow[],
    now: Date,
  ) {
    const scope = competitorScope(job);
    const [competitors] = await c.query<RowDataPacket[]>(
      `SELECT id,external_id,product_url,opportunity_id FROM competitors WHERE id=? AND ${scope.where} AND deleted_at IS NULL FOR UPDATE`,
      [job.resourceId, ...scope.values],
    );
    if (!competitors[0]) throw new Error("competitor_not_found");
    const ownership = await resolveCalculationOwnership(c, job.resourceId, "competitors");
    if (job.nativeCompetitor && ownership?.owner?.account_id !== job.accountId)
      throw new Error("core_projection_owner_mismatch");
    await this.requireCompetitorOwners(c, ownership, [
      ["collection_tasks", job.taskId],
      ["collection_subqueries", job.subqueryId],
      ...(competitors[0].opportunity_id
        ? [["opportunities", String(competitors[0].opportunity_id)] as const]
        : []),
    ]);
    for (const record of records) {
      if (ownership && String(record.collection_subquery_id) !== job.subqueryId) continue;
      const fields = parse<Record<string, unknown>>(record.payload_json);
      const actualAsin = amazonAsin(
        fields,
        String(fields.canonical_url ?? fields.source_url ?? ""),
      );
      if (!actualAsin || actualAsin !== String(competitors[0].external_id).toUpperCase()) continue;
      await this.requireCompetitorRecordOwners(c, ownership, record);
      if (await this.insertSnapshot(c, job, job.resourceId, record, fields, now, true, ownership))
        return 1;
    }
    return 0;
  }

  private async insertSnapshot(
    c: PoolConnection,
    job: Job,
    competitorId: string,
    record: RecordRow,
    fields: Record<string, unknown>,
    now: Date,
    queueComparison: boolean,
    ownership: CalculationOwnership = null,
  ) {
    const sourceRef = `collection:${job.taskId}:${record.id}`,
      snapshotId = randomUUID(),
      [insert] = await c.query<any>(
        `INSERT IGNORE INTO competitor_snapshots
         (id,competitor_id,provider_id,current_price,currency,rank_value,review_count,rating_value,availability,captured_at,freshness,source_status,source_ref_id,evidence_id,request_id,trace_id,created_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,'fresh','healthy',?,?,?,?,?)`,
        [
          snapshotId,
          competitorId,
          record.provider_id,
          optionalNumber(fields.price),
          optionalText(fields.currency, 3),
          optionalNumber(fields.position),
          optionalNumber(fields.review_count),
          optionalNumber(fields.rating_value),
          ["in_stock", "out_of_stock"].includes(String(fields.availability))
            ? String(fields.availability)
            : "unknown",
          record.captured_at,
          sourceRef,
          record.raw_evidence_id,
          job.requestId,
          job.traceId,
          now,
        ],
      );
    if (!Number(insert.affectedRows ?? 0)) {
      if (ownership) {
        const [existing] = await c.query<RowDataPacket[]>(
          "SELECT id FROM competitor_snapshots WHERE competitor_id=? AND source_ref_id=? AND evidence_id=? AND provider_id=? FOR UPDATE",
          [competitorId, sourceRef, record.raw_evidence_id, record.provider_id],
        );
        if (!existing[0]) throw new Error("competitor_snapshot_not_persisted");
        await this.requireCompetitorOwners(c, ownership, [
          ["competitor_snapshots", String(existing[0].id)],
        ]);
      }
      return false;
    }
    const owned: CalculationOwnerRef[] = [["competitor_snapshots", snapshotId]];
    if (queueComparison) {
      const comparisonId = randomUUID();
      await c.query(
        "INSERT INTO competitor_snapshot_jobs(id,competitor_id,snapshot_id,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES(?,?,?,'queued',0,?,?,?,?,?)",
        [comparisonId, competitorId, snapshotId, now, job.requestId, job.traceId, now, now],
      );
      owned.push(["competitor_snapshot_jobs", comparisonId]);
    } else {
      const scope = competitorScope(job);
      const [current] = await c.query<RowDataPacket[]>(
        `SELECT latest_snapshot_id FROM competitors WHERE id=? AND ${scope.where} FOR UPDATE`,
        [competitorId, ...scope.values],
      );
      if (current[0]?.latest_snapshot_id)
        await this.requireCompetitorOwners(c, ownership, [
          ["competitor_snapshots", String(current[0].latest_snapshot_id)],
        ]);
      const [latest] = current[0]?.latest_snapshot_id
        ? await c.query<RowDataPacket[]>(
            `SELECT ${job.accountId ? nativeCompletionTaskProof(competitorDetailEvidenceSql("s"), "NULL", job.nativeCompetitor) : competitorDetailEvidenceSql("s")} detail_verified FROM competitor_snapshots s ` +
              "WHERE s.id=? AND s.competitor_id=?",
            [current[0].latest_snapshot_id, competitorId],
          )
        : [[]];
      if (!Number(latest[0]?.detail_verified ?? 0))
        await c.query(
          `UPDATE competitors SET latest_snapshot_id=?,updated_at=? WHERE id=? AND ${scope.where}`,
          [snapshotId, now, competitorId, ...scope.values],
        );
    }
    await registerCalculationOwners(c, ownership, owned);
    return true;
  }

  private async projectSourcing(
    c: PoolConnection,
    job: Job,
    records: RecordRow[],
    now: Date,
    resolved?: Awaited<ReturnType<typeof resolveCalculationOwnership>>,
  ) {
    const ownership =
      resolved === undefined
        ? await resolveCalculationOwnership(c, job.resourceId, "sourcing_searches")
        : resolved;
    if (ownership && !ownership.owner)
      throw Object.assign(new Error("sourcing_projection_owner_mismatch"), {
        code: "sourcing_projection_owner_mismatch",
      });
    const [searches] = await c.query<RowDataPacket[]>(
      "SELECT id,collection_task_id,input_type,input_ref FROM sourcing_searches WHERE id=? " +
        (ownership ? "" : "AND organization_id=? AND workspace_id=? ") +
        "AND deleted_at IS NULL FOR UPDATE",
      ownership ? [job.resourceId] : [job.resourceId, job.organizationId, job.workspaceId],
    );
    if (!searches[0]) throw new Error("sourcing_search_not_found");
    const search = searches[0];
    if (ownership && String(search.collection_task_id) !== job.taskId)
      throw Object.assign(new Error("sourcing_projection_task_mismatch"), {
        code: "sourcing_projection_task_mismatch",
      });
    await requireSourcingOwners(c, ownership, [
      ["collection_tasks", job.taskId],
      ["collection_subqueries", job.subqueryId],
      ...(search.input_type === "opportunity"
        ? [["opportunities", String(search.input_ref)] as const]
        : []),
    ]);
    if (
      job.accountId &&
      search.input_type === "opportunity" &&
      (await nativeOpportunityStorage(c))
    ) {
      const [[opportunity]] = await c.query<RowDataPacket[]>(
        "SELECT id FROM opportunities WHERE id=? AND account_id=? LOCK IN SHARE MODE",
        [search.input_ref, job.accountId],
      );
      if (!opportunity)
        throw Object.assign(new Error("sourcing_projection_owner_mismatch"), {
          code: "sourcing_projection_owner_mismatch",
        });
    }
    let count = 0;
    for (const record of records) {
      if (ownership && String(record.collection_subquery_id) !== job.subqueryId) continue;
      const fields = parse<Record<string, unknown>>(record.payload_json),
        supplier = optionalText(fields.supplier_name, 500),
        title = optionalText(fields.title, 1000),
        url = optionalText(fields.canonical_url ?? fields.source_url),
        price = optionalNumber(fields.price),
        currency = optionalText(fields.currency, 3),
        moqValue = optionalNumber(fields.moq),
        moq = moqValue == null ? null : Math.max(1, Math.floor(moqValue));
      if (!supplier || !title || !url || price == null || !currency) continue;
      await requireSourcingRecordOwner(c, ownership, record);
      const missing = [
        ...(moq == null ? ["moq"] : []),
        "specification",
        "lead_time_days",
        "location",
        "confidence_value",
        "stability_status",
        "risk_level",
      ];
      const id = randomUUID();
      const [insert] = await c.query<any>(
        `INSERT IGNORE INTO sourcing_candidates
         (id,search_id,provider_id,normalized_record_id,raw_evidence_id,external_id,supplier_name,product_title,specification,moq,quoted_price,currency,lead_time_days,location,original_url,observed_at,confidence_value,status,missing_fields_json,created_at)
         VALUES(?,?,?,?,?,?,?,?,NULL,?,?,?,NULL,NULL,?,?,NULL,'incomplete',?,?)`,
        [
          id,
          job.resourceId,
          record.provider_id,
          record.id,
          record.raw_evidence_id,
          String(record.id),
          supplier,
          title,
          moq,
          price,
          currency.toUpperCase(),
          url,
          record.captured_at,
          JSON.stringify(missing),
          now,
        ],
      );
      await registerSourcingCandidate(
        c,
        ownership,
        job.resourceId,
        record,
        id,
        Boolean(insert.affectedRows),
      );
      count += Number(insert.affectedRows ?? 0);
    }
    const [totals] = await c.query<RowDataPacket[]>(
      "SELECT COUNT(*) count FROM sourcing_candidates WHERE search_id=?" +
        (ownership
          ? " AND " +
            (ownership.owner ? "" : "NOT ") +
            "EXISTS (SELECT 1 FROM account_owned_records ao WHERE ao.source_table='sourcing_candidates' AND ao.source_id=sourcing_candidates.id" +
            (ownership.owner ? " AND ao.account_id=?" : "") +
            ")"
          : ""),
      [job.resourceId, ...(ownership?.owner ? [ownership.owner.account_id] : [])],
    );
    const total = Number(totals[0]?.count ?? 0),
      missing = total
        ? [
            "moq",
            "specification",
            "lead_time_days",
            "location",
            "confidence_value",
            "stability_status",
            "risk_level",
          ]
        : ["supplier_listing"];
    await c.query(
      "UPDATE sourcing_searches SET status=?,candidate_count=?,missing_fields_json=?,updated_at=? WHERE id=?",
      [
        total ? "completed_with_warnings" : "succeeded_empty",
        total,
        JSON.stringify(missing),
        now,
        job.resourceId,
      ],
    );
    return count;
  }
}
