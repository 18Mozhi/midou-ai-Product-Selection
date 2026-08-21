import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

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
const asinFrom = (fields: Record<string, unknown>, url: string) =>
  optionalText(fields.asin, 10)?.toUpperCase() ??
  /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i.exec(url)?.[1]?.toUpperCase() ??
  null;

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
      await this.pool.query(
        "UPDATE core_collection_projection_runs SET status=?,item_count=?,finished_at=? WHERE id=? AND status='processing'",
        [count ? "succeeded" : "succeeded_empty", count, this.now(), job.runId],
      );
      return {
        status: count ? ("succeeded" as const) : ("succeeded_empty" as const),
        task_id: job.taskId,
        projection_type: job.projectionType,
        item_count: count,
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
        `SELECT t.id,t.organization_id,t.workspace_id,t.request_id,t.trace_id,t.created_by,s.target_json
         FROM collection_tasks t
         JOIN collection_subqueries s ON s.task_id=t.id
         LEFT JOIN core_collection_projection_runs r ON r.collection_task_id=t.id
         WHERE r.id IS NULL
           AND t.status IN ('succeeded','succeeded_empty','completed_with_warnings')
           AND JSON_UNQUOTE(JSON_EXTRACT(s.target_json,'$.projection_type')) IN ('opportunity_competitors','competitor_snapshot','sourcing_search')
         ORDER BY t.finished_at,t.id LIMIT 1 FOR UPDATE`,
      );
      const row = rows[0];
      if (!row) {
        await c.commit();
        return null;
      }
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
      await c.commit();
      return count;
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
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
    let count = 0;
    for (const record of records) {
      const fields = parse<Record<string, unknown>>(record.payload_json),
        url = optionalText(fields.canonical_url ?? fields.source_url),
        title = optionalText(fields.title, 500),
        asin = url ? asinFrom(fields, url) : null;
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
        "SELECT id FROM competitors WHERE organization_id=? AND workspace_id=? AND market=? AND source_site='Amazon' AND external_id=? AND deleted_at IS NULL LIMIT 1",
        [job.organizationId, job.workspaceId, String(opportunities[0].market), asin],
      );
      const persistedId = String(competitors[0]?.id ?? competitorId);
      if (await this.insertSnapshot(c, job, persistedId, record, fields, now, false)) count += 1;
      else if (Number(insert.affectedRows ?? 0)) count += 1;
    }
    await c.query(
      "UPDATE opportunities SET updated_at=? WHERE id=? AND organization_id=? AND workspace_id=?",
      [now, job.resourceId, job.organizationId, job.workspaceId],
    );
    return count;
  }

  private async projectCompetitorSnapshot(
    c: PoolConnection,
    job: Job,
    records: RecordRow[],
    now: Date,
  ) {
    const [competitors] = await c.query<RowDataPacket[]>(
      "SELECT id FROM competitors WHERE id=? AND organization_id=? AND workspace_id=? AND deleted_at IS NULL FOR UPDATE",
      [job.resourceId, job.organizationId, job.workspaceId],
    );
    if (!competitors[0]) throw new Error("competitor_not_found");
    for (const record of records) {
      const fields = parse<Record<string, unknown>>(record.payload_json);
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
      await c.query("UPDATE competitors SET latest_snapshot_id=?,updated_at=? WHERE id=?", [
        snapshotId,
        now,
        competitorId,
      ]);
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
