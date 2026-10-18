import { randomUUID } from "node:crypto";
import { competitorDetailEvidenceSql } from "@scoutops/database";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { queueAutomaticSelectionEvaluation } from "./automatic-selection-evaluation-worker.js";
import {
  readCompetitorClassificationContext,
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
};
type RecordRow = RowDataPacket & {
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
      const [rows] = await c.query<RowDataPacket[]>(
        `SELECT t.id,t.organization_id,t.workspace_id,t.request_id,t.trace_id,t.created_by,s.target_json,s.id classification_subquery_id
         FROM collection_tasks t
         JOIN collection_subqueries s ON s.task_id=t.id
         LEFT JOIN core_collection_projection_runs r ON r.collection_task_id=t.id
         WHERE r.id IS NULL
           AND t.status IN ('succeeded','succeeded_empty','completed_with_warnings')
           AND JSON_UNQUOTE(JSON_EXTRACT(s.target_json,'$.projection_type')) IN ('opportunity_competitors','competitor_snapshot','sourcing_search')
         ORDER BY t.finished_at,t.id LIMIT 1`,
      );
      const candidate = rows[0];
      if (!candidate) {
        await c.commit();
        return null;
      }
      // The filesorted backlog read must not lock unrelated running collectors.
      // Recheck the selected identities with current locking reads in task/query order.
      const [tasks] = await c.query<RowDataPacket[]>(
        "SELECT id,organization_id,workspace_id,request_id,trace_id,created_by FROM collection_tasks " +
          "WHERE id=? AND organization_id=? AND workspace_id=? " +
          "AND status IN ('succeeded','succeeded_empty','completed_with_warnings') FOR UPDATE",
        [candidate.id, candidate.organization_id, candidate.workspace_id],
      );
      if (!tasks[0]) {
        await c.commit();
        return null;
      }
      const [queries] = await c.query<RowDataPacket[]>(
        "SELECT target_json,id classification_subquery_id FROM collection_subqueries " +
          "WHERE id=? AND task_id=? AND organization_id=? AND workspace_id=? " +
          "AND JSON_UNQUOTE(JSON_EXTRACT(target_json,'$.projection_type')) " +
          "IN ('opportunity_competitors','competitor_snapshot','sourcing_search') FOR UPDATE",
        [
          candidate.classification_subquery_id,
          candidate.id,
          candidate.organization_id,
          candidate.workspace_id,
        ],
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
        resourceKey =
          projectionType === "opportunity_competitors"
            ? "opportunity_id"
            : projectionType === "competitor_snapshot"
              ? "competitor_id"
              : "search_id",
        resourceId = String(target[resourceKey] ?? ""),
        runId = randomUUID();
      if (!/^[0-9a-f-]{36}$/i.test(resourceId)) throw new Error("projection_target_invalid");
      await c.query(
        "INSERT INTO core_collection_projection_runs(id,organization_id,workspace_id,collection_task_id,projection_type,resource_id,status,item_count,error_code,started_at,finished_at) VALUES(?,?,?,?,?,?,'processing',0,NULL,?,NULL)",
        [runId, row.organization_id, row.workspace_id, row.id, projectionType, resourceId, now],
      );
      await c.commit();
      return {
        runId,
        taskId: String(row.id),
        organizationId: String(row.organization_id),
        workspaceId: String(row.workspace_id),
        projectionType,
        resourceId,
        requestId: String(row.request_id),
        traceId: String(row.trace_id),
        actorId: String(row.created_by),
        subqueryId: String(row.classification_subquery_id),
        primaryAsin:
          typeof target.main_asin === "string" && /^[A-Z0-9]{10}$/i.test(target.main_asin)
            ? target.main_asin.toUpperCase()
            : null,
      };
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }

  private async records(c: PoolConnection, job: Job) {
    const [rows] = await c.query<RecordRow[]>(
      `SELECT n.id,n.provider_id,n.raw_evidence_id,n.payload_json,e.captured_at
       FROM collection_task_evidence_links l
       JOIN normalized_records n ON n.id=l.normalized_record_id AND n.status='active'
       JOIN raw_evidence e ON e.id=l.raw_evidence_id
       WHERE l.collection_task_id=? AND l.organization_id=? AND l.workspace_id=?
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
      const records = await this.records(c, job);
      let count = 0;
      if (job.projectionType === "opportunity_competitors")
        count = await this.projectCompetitorDiscovery(c, job, records, now);
      else if (job.projectionType === "competitor_snapshot")
        count = await this.projectCompetitorSnapshot(c, job, records, now);
      else count = await this.projectSourcing(c, job, records, now);
      if (count > 0) await this.requeueEvaluation(c, job, now);
      await c.commit();
      return count;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }

  private async requeueEvaluation(c: PoolConnection, job: Job, now: Date) {
    let opportunityId: string | null =
      job.projectionType === "opportunity_competitors" ? job.resourceId : null;
    if (job.projectionType === "competitor_snapshot") {
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT opportunity_id FROM competitors WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL",
        [job.resourceId, job.organizationId, job.workspaceId],
      );
      opportunityId = rows[0]?.opportunity_id ? String(rows[0].opportunity_id) : null;
    } else if (job.projectionType === "sourcing_search") {
      const [rows] = await c.query<RowDataPacket[]>(
        "SELECT input_ref FROM sourcing_searches WHERE id=? AND organization_id=? AND workspace_id=? AND input_type='opportunity' AND deleted_at IS NULL",
        [job.resourceId, job.organizationId, job.workspaceId],
      );
      opportunityId = rows[0]?.input_ref ? String(rows[0].input_ref) : null;
    }
    if (opportunityId)
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
    const [opportunities] = await c.query<RowDataPacket[]>(
      "SELECT id,market FROM opportunities WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
      [job.resourceId, job.organizationId, job.workspaceId],
    );
    if (!opportunities[0]) throw new Error("opportunity_not_found");
    if (!job.primaryAsin) return 0;
    const [proofs] = await c.query<RowDataPacket[]>(
      "SELECT payload_json FROM opportunity_events WHERE organization_id=? AND workspace_id=? AND resource_id=? AND resource_type='opportunity' AND event_type='opportunity.competitors_classified' AND JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.task_id'))=? AND JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.subquery_id'))=? ORDER BY occurred_at DESC,id DESC LIMIT 1",
      [job.organizationId, job.workspaceId, job.resourceId, job.taskId, job.subqueryId],
    );
    if (!proofs[0]) return 0;
    let related: Set<string>;
    try {
      const proof = parse<Record<string, unknown>>(proofs[0].payload_json);
      const context = await readCompetitorClassificationContext(c, {
        taskId: job.taskId,
        subqueryId: job.subqueryId,
        organizationId: job.organizationId,
        workspaceId: job.workspaceId,
        opportunityId: job.resourceId,
        mainAsin: job.primaryAsin,
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
      records.filter((record) => related.has(String(record.id))),
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
      const competitorId = randomUUID();
      const [insert] = await c.query<any>(
        "INSERT IGNORE INTO competitors(id,organization_id,workspace_id,opportunity_id,provider_id,market,source_site,external_id,product_url,title,status,latest_snapshot_id,revision,created_by,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?, 'Amazon',?,?,?,'active',NULL,1,?,?,?,NULL)",
        [
          competitorId,
          job.organizationId,
          job.workspaceId,
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
        "SELECT id,opportunity_id FROM competitors WHERE organization_id=? AND workspace_id=? AND market=? AND source_site='Amazon' AND external_id=? AND opportunity_id=? AND deleted_at IS NULL LIMIT 1",
        [
          job.organizationId,
          job.workspaceId,
          String(opportunities[0].market),
          asin,
          job.resourceId,
        ],
      );
      if (!competitors[0] || String(competitors[0].opportunity_id) !== job.resourceId) continue;
      const persistedId = String(competitors[0]?.id ?? competitorId);
      if (await this.insertSnapshot(c, job, persistedId, record, fields, now, false)) count += 1;
      else if (Number(insert.affectedRows ?? 0)) count += 1;
      await this.scheduleCompetitorDetail(c, job, persistedId, record.provider_id, url, now);
    }
    await c.query(
      "UPDATE opportunities SET updated_at=? WHERE id=? AND organization_id=? AND workspace_id=?",
      [now, job.resourceId, job.organizationId, job.workspaceId],
    );
    return count;
  }

  private async scheduleCompetitorDetail(
    c: PoolConnection,
    job: Job,
    competitorId: string,
    providerId: string,
    pageUrl: string,
    now: Date,
  ) {
    const taskId = randomUUID();
    await c.query(
      "INSERT INTO collection_tasks(id,organization_id,workspace_id,status,coverage_status,priority,scheduled_at,available_at,attempt_count,successful_subquery_count,failed_subquery_count,blocked_subquery_count,available_result_count,missing_fields_json,request_id,trace_id,version,created_by,created_at,updated_at) VALUES(?,?,?,'scheduled',NULL,'high',?,?,0,0,0,0,0,'[]',?,?,1,?,?,?)",
      [
        taskId,
        job.organizationId,
        job.workspaceId,
        now,
        now,
        job.requestId,
        job.traceId,
        job.actorId,
        now,
        now,
      ],
    );
    await c.query(
      "INSERT INTO collection_subqueries(id,task_id,organization_id,workspace_id,provider_id,ordinal,target_json,is_required,status,available_result_count,missing_fields_json,error_code,retryable,version,created_at,updated_at) VALUES(?,?,?,?,?,1,?,1,'pending',0,'[]',NULL,0,1,?,?)",
      [
        randomUUID(),
        taskId,
        job.organizationId,
        job.workspaceId,
        providerId,
        JSON.stringify({
          page_url: pageUrl,
          projection_type: "competitor_snapshot",
          competitor_id: competitorId,
        }),
        now,
        now,
      ],
    );
    await c.query(
      "INSERT INTO collection_task_events(id,task_id,organization_id,workspace_id,event_type,from_status,to_status,actor_type,actor_id,request_id,trace_id,metadata_json,occurred_at) VALUES(?,?,?,?,'competitor.detail.auto_scheduled',NULL,'scheduled','worker',?,?,?,?,?)",
      [
        randomUUID(),
        taskId,
        job.organizationId,
        job.workspaceId,
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
    await c.query(
      "INSERT INTO competitor_events(id,organization_id,workspace_id,competitor_id,event_type,actor_id,payload_json,request_id,trace_id,created_at) VALUES(?,?,?,?,'competitor.collection.scheduled',?,?,?,?,?)",
      [
        eventId,
        job.organizationId,
        job.workspaceId,
        competitorId,
        job.actorId,
        payload,
        job.requestId,
        job.traceId,
        now,
      ],
    );
    await c.query(
      "INSERT INTO competitor_outbox(id,organization_id,workspace_id,aggregate_id,event_type,payload_json,status,available_at,created_at) VALUES(?,?,?,?,'competitor.collection.scheduled',?,'pending',?,?)",
      [eventId, job.organizationId, job.workspaceId, competitorId, payload, now, now],
    );
  }

  private async projectCompetitorSnapshot(
    c: PoolConnection,
    job: Job,
    records: RecordRow[],
    now: Date,
  ) {
    const [competitors] = await c.query<RowDataPacket[]>(
      "SELECT id,external_id,product_url FROM competitors WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL FOR UPDATE",
      [job.resourceId, job.organizationId, job.workspaceId],
    );
    if (!competitors[0]) throw new Error("competitor_not_found");
    for (const record of records) {
      const fields = parse<Record<string, unknown>>(record.payload_json);
      const actualAsin = amazonAsin(
        fields,
        String(fields.canonical_url ?? fields.source_url ?? ""),
      );
      if (!actualAsin || actualAsin !== String(competitors[0].external_id).toUpperCase()) continue;
      if (await this.insertSnapshot(c, job, job.resourceId, record, fields, now, true)) return 1;
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
  ) {
    const sourceRef = `collection:${job.taskId}:${record.id}`,
      snapshotId = randomUUID(),
      [insert] = await c.query<any>(
        `INSERT IGNORE INTO competitor_snapshots
         (id,competitor_id,organization_id,workspace_id,provider_id,current_price,currency,rank_value,review_count,rating_value,availability,captured_at,freshness,source_status,source_ref_id,evidence_id,request_id,trace_id,created_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'fresh','healthy',?,?,?,?,?)`,
        [
          snapshotId,
          competitorId,
          job.organizationId,
          job.workspaceId,
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
    if (!Number(insert.affectedRows ?? 0)) return false;
    if (queueComparison) {
      await c.query(
        "INSERT INTO competitor_snapshot_jobs(id,organization_id,workspace_id,competitor_id,snapshot_id,status,attempt_count,available_at,request_id,trace_id,created_at,updated_at) VALUES(?,?,?,?,?,'queued',0,?,?,?,?,?)",
        [
          randomUUID(),
          job.organizationId,
          job.workspaceId,
          competitorId,
          snapshotId,
          now,
          job.requestId,
          job.traceId,
          now,
          now,
        ],
      );
    } else {
      const [current] = await c.query<RowDataPacket[]>(
        "SELECT latest_snapshot_id FROM competitors WHERE id=? AND organization_id=? AND workspace_id=? FOR UPDATE",
        [competitorId, job.organizationId, job.workspaceId],
      );
      const [latest] = current[0]?.latest_snapshot_id
        ? await c.query<RowDataPacket[]>(
            `SELECT ${competitorDetailEvidenceSql("s")} detail_verified FROM competitor_snapshots s ` +
              "WHERE s.id=? AND s.organization_id=? AND s.workspace_id=?",
            [current[0].latest_snapshot_id, job.organizationId, job.workspaceId],
          )
        : [[]];
      if (!Number(latest[0]?.detail_verified ?? 0))
        await c.query(
          "UPDATE competitors SET latest_snapshot_id=?,updated_at=? WHERE id=? AND organization_id=? AND workspace_id=?",
          [snapshotId, now, competitorId, job.organizationId, job.workspaceId],
        );
    }
    return true;
  }

  private async projectSourcing(c: PoolConnection, job: Job, records: RecordRow[], now: Date) {
    const [searches] = await c.query<RowDataPacket[]>(
      "SELECT id FROM sourcing_searches WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL FOR UPDATE",
      [job.resourceId, job.organizationId, job.workspaceId],
    );
    if (!searches[0]) throw new Error("sourcing_search_not_found");
    let count = 0;
    for (const record of records) {
      const fields = parse<Record<string, unknown>>(record.payload_json),
        supplier = optionalText(fields.supplier_name, 500),
        title = optionalText(fields.title, 1000),
        url = optionalText(fields.canonical_url ?? fields.source_url),
        price = optionalNumber(fields.price),
        currency = optionalText(fields.currency, 3),
        moqValue = optionalNumber(fields.moq),
        moq = moqValue == null ? null : Math.max(1, Math.floor(moqValue));
      if (!supplier || !title || !url || price == null || !currency) continue;
      const missing = [
        ...(moq == null ? ["moq"] : []),
        "specification",
        "lead_time_days",
        "location",
        "confidence_value",
        "stability_status",
        "risk_level",
      ];
      const [insert] = await c.query<any>(
        `INSERT IGNORE INTO sourcing_candidates
         (id,organization_id,workspace_id,search_id,provider_id,normalized_record_id,raw_evidence_id,external_id,supplier_name,product_title,specification,moq,quoted_price,currency,lead_time_days,location,original_url,observed_at,confidence_value,status,missing_fields_json,created_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,NULL,?,?,?,NULL,NULL,?,?,NULL,'incomplete',?,?)`,
        [
          randomUUID(),
          job.organizationId,
          job.workspaceId,
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
      count += Number(insert.affectedRows ?? 0);
    }
    const [totals] = await c.query<RowDataPacket[]>(
      "SELECT COUNT(*) count FROM sourcing_candidates WHERE search_id=?",
      [job.resourceId],
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
