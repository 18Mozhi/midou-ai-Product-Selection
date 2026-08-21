import { createHash, randomUUID } from "node:crypto";
import { relative, resolve, sep } from "node:path";
import { rm } from "node:fs/promises";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { OrganizationId, WorkspaceId } from "@scoutops/contracts";
import { buildScopedFilePath, writeScopedFile } from "@scoutops/storage";

export interface ErpImportContext {
  organizationId: string;
  workspaceId: string;
  actorId: string;
  idempotencyKey: string;
  requestId: string;
  traceId: string;
}
export interface ErpProductImportResult {
  task_id: string;
  received_count: number;
  imported_count: number;
  deduplicated_count: number;
  opportunity_count: number;
  competitor_count: number;
  sourcing_search_count: number;
  status: "succeeded" | "succeeded_empty";
}
interface ErpRow {
  id: string;
  spu: string;
  store_id: string;
  asin_list: string[];
  product: Record<string, unknown>;
  last_sync_time: Date;
}
interface NormalizedErpProduct {
  external_id: string;
  spu: string;
  store_id: string;
  title: string;
  image_url: string | null;
  asin_list: string[];
  supplier_code: string | null;
  cost_cny: number | null;
  cost_usd: number | null;
  observed_at: string;
  source_url: string;
}
interface PersistInput {
  taskId: string;
  subqueryId: string;
  providerId: string;
  retentionDays: number;
  rawContent: Buffer;
  value: NormalizedErpProduct;
  ordinal: number;
  context: ErpImportContext;
  now: Date;
}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const object = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value))
    return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};
const text = (value: unknown, maximum: number) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : "";
const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const http = (value: unknown) => {
  try {
    const url = new URL(String(value ?? ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};
const firstObject = (value: unknown) => object(asArray(value)[0]);
const price = (sku: Record<string, unknown>, currency: string) => {
  const list = asArray(sku.costInfoList ?? sku.cost_info_list).map(object);
  const match = list.find((item) => text(item.currency, 10).toUpperCase() === currency);
  return number(match?.costPrice ?? match?.cost_price);
};
const asinValues = (value: unknown) => {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [value];
          } catch {
            return [value];
          }
        })()
      : [];
  const found = new Set<string>();
  for (const item of values) {
    for (const match of String(item ?? "")
      .toUpperCase()
      .matchAll(/[A-Z0-9]{10}/g))
      found.add(match[0]);
  }
  return [...found].slice(0, 20);
};
export function normalizeErpProductRow(
  value: unknown,
  sourceUrl: string,
  fallbackCapturedAt: Date,
): { row: ErpRow; normalized: NormalizedErpProduct } {
  const raw = object(value),
    product = object(raw.product),
    firstSkc = firstObject(product.skcInfoList),
    firstSku = firstObject(firstSkc.skuInfoList),
    title = text(firstObject(product.productMultiNameList).productName ?? product.title, 1000),
    spu = text(raw.spu ?? product.spu, 200),
    id = text(raw.id, 200),
    supplierCode = text(firstSkc.supplierCode ?? product.supplierCode, 255),
    observed = new Date(String(raw.last_sync_time ?? fallbackCapturedAt));
  if (!title || (!spu && !id) || !Number.isFinite(observed.getTime()))
    throw new Error("erp_product_row_invalid");
  const asins = [...asinValues(raw.asin_list)].filter(
    (item, index, all) => all.indexOf(item) === index,
  );
  const image = http(
    firstObject(product.spuImageInfoList).imageUrl ??
      firstObject(firstSkc.skcImageInfoList).imageUrl ??
      firstObject(firstObject(firstSkc.skuInfoList).skuImageInfoList).imageUrl,
  );
  const externalId = spu || id;
  return {
    row: {
      id,
      spu,
      store_id: text(raw.store_id, 100),
      asin_list: asins,
      product,
      last_sync_time: observed,
    },
    normalized: {
      external_id: externalId,
      spu,
      store_id: text(raw.store_id, 100),
      title,
      image_url: image,
      asin_list: asins,
      supplier_code: supplierCode || null,
      cost_cny: price(firstSku, "CNY"),
      cost_usd: price(firstSku, "USD"),
      observed_at: observed.toISOString(),
      source_url: sourceUrl,
    },
  };
}

export class ErpProductImportService {
  constructor(
    private readonly pool: Pool,
    private readonly evidenceRoot: string,
    private readonly maximumRawBytes: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async import(
    value: {
      source_url?: unknown;
      captured_at?: unknown;
      items?: unknown;
    },
    context: ErpImportContext,
  ): Promise<ErpProductImportResult> {
    const sourceUrl = http(value?.source_url);
    if (
      !sourceUrl ||
      new URL(sourceUrl).origin !== "https://medou.medouai.com" ||
      !sourceUrl.includes("#/ProductList")
    )
      throw new Error("erp_product_source_invalid");
    const capturedAt = new Date(String(value?.captured_at ?? this.now()));
    const items = Array.isArray(value?.items) ? value.items : [];
    if (!Number.isFinite(capturedAt.getTime()) || !items.length || items.length > 500)
      throw new Error("erp_product_import_invalid");
    const normalizedRows = items.map((item) => normalizeErpProductRow(item, sourceUrl, capturedAt));
    const connection = await this.pool.getConnection();
    const writtenFiles: string[] = [];
    try {
      await connection.beginTransaction();
      const replay = await this.replay(connection, context);
      if (replay) {
        await connection.commit();
        return replay;
      }
      const [providers] = await connection.query<RowDataPacket[]>(
        "SELECT id,retention_days FROM providers WHERE code='erp_product_catalog' AND status='enabled' LIMIT 1 FOR UPDATE",
      );
      if (!providers[0]) throw new Error("erp_product_provider_unavailable");
      const providerId = String(providers[0].id),
        retentionDays = Number(providers[0].retention_days),
        taskId = randomUUID(),
        subqueryId = randomUUID(),
        now = this.now();
      await this.createTask(
        connection,
        taskId,
        subqueryId,
        providerId,
        normalizedRows.length,
        context,
        now,
      );
      let imported = 0,
        deduplicated = 0,
        opportunityCount = 0,
        competitorCount = 0,
        sourcingCount = 0;
      for (let index = 0; index < normalizedRows.length; index += 1) {
        const current = normalizedRows[index]!,
          rawContent = Buffer.from(JSON.stringify(current.row), "utf8");
        if (rawContent.byteLength > this.maximumRawBytes)
          throw new Error("erp_product_row_too_large");
        const persisted = await this.persistEvidence(
          connection,
          {
            taskId,
            subqueryId,
            providerId,
            retentionDays,
            rawContent,
            value: current.normalized,
            ordinal: index + 1,
            context,
            now,
          },
          writtenFiles,
        );
        if (persisted.deduplicated) deduplicated += 1;
        else imported += 1;
        const projected = await this.projectProduct(connection, {
          ...persisted,
          providerId,
          taskId,
          value: current.normalized,
          context,
          now,
        });
        opportunityCount += projected.opportunityCreated;
        competitorCount += projected.competitorsCreated;
        sourcingCount += projected.sourcingCreated;
      }
      const status = normalizedRows.length ? "succeeded" : "succeeded_empty";
      await connection.query(
        "UPDATE collection_tasks SET status=?,coverage_status='partial',finished_at=?,successful_subquery_count=1,available_result_count=?,missing_fields_json=?,version=version+1,updated_at=? WHERE id=?",
        [
          status,
          now,
          normalizedRows.length,
          JSON.stringify(["amazon_price", "amazon_rank", "amazon_reviews", "supplier_quote"]),
          now,
          taskId,
        ],
      );
      await connection.query(
        "UPDATE collection_subqueries SET status='succeeded',available_result_count=?,finished_at=?,version=version+1,updated_at=? WHERE id=?",
        [normalizedRows.length, now, now, subqueryId],
      );
      const result: ErpProductImportResult = {
        task_id: taskId,
        received_count: normalizedRows.length,
        imported_count: imported,
        deduplicated_count: deduplicated,
        opportunity_count: opportunityCount,
        competitor_count: competitorCount,
        sourcing_search_count: sourcingCount,
        status,
      };
      await connection.query(
        "INSERT INTO erp_product_import_operations (id,organization_id,workspace_id,actor_id,idempotency_key,task_id,result_json,request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
          randomUUID(),
          context.organizationId,
          context.workspaceId,
          context.actorId,
          context.idempotencyKey,
          taskId,
          JSON.stringify(result),
          context.requestId,
          context.traceId,
          now,
        ],
      );
      await connection.query(
        "INSERT INTO platform_audit_events(id,organization_id,workspace_id,actor_id,action,resource_type,resource_id,outcome,request_id,trace_id,metadata,occurred_at,schema_version) VALUES(?,?,?,?, 'erp.products.imported','collection_task',?,'succeeded',?,?,?,?,1)",
        [
          randomUUID(),
          context.organizationId,
          context.workspaceId,
          context.actorId,
          taskId,
          context.requestId,
          context.traceId,
          JSON.stringify(result),
          now,
        ],
      );
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      await Promise.all(writtenFiles.map((path) => rm(path, { force: true })));
      throw error;
    } finally {
      connection.release();
    }
  }

  private async replay(c: PoolConnection, context: ErpImportContext) {
    const [rows] = await c.query<RowDataPacket[]>(
      "SELECT result_json FROM erp_product_import_operations WHERE actor_id=? AND idempotency_key=? LIMIT 1",
      [context.actorId, context.idempotencyKey],
    );
    if (!rows[0]) return null;
    return (
      typeof rows[0].result_json === "string"
        ? JSON.parse(rows[0].result_json)
        : rows[0].result_json
    ) as ErpProductImportResult;
  }

  private async createTask(
    c: PoolConnection,
    taskId: string,
    subqueryId: string,
    providerId: string,
    count: number,
    context: ErpImportContext,
    now: Date,
  ) {
    await c.query(
      "INSERT INTO collection_tasks (id,organization_id,workspace_id,status,coverage_status,priority,scheduled_at,available_at,started_at,attempt_count,successful_subquery_count,failed_subquery_count,blocked_subquery_count,available_result_count,missing_fields_json,request_id,trace_id,version,created_by,created_at,updated_at) VALUES (?,?,?,'running',NULL,'high',?,?,?,1,0,0,0,0,'[]',?,?,1,?,?,?)",
      [
        taskId,
        context.organizationId,
        context.workspaceId,
        now,
        now,
        now,
        context.requestId,
        context.traceId,
        context.actorId,
        now,
        now,
      ],
    );
    await c.query(
      "INSERT INTO collection_subqueries (id,task_id,organization_id,workspace_id,provider_id,ordinal,target_json,is_required,status,available_result_count,missing_fields_json,error_code,retryable,started_at,version,created_at,updated_at) VALUES (?,?,?,?,?,1,?,1,'running',0,'[]',NULL,0,?,1,?,?)",
      [
        subqueryId,
        taskId,
        context.organizationId,
        context.workspaceId,
        providerId,
        JSON.stringify({
          source: "erp_product_catalog",
          received_count: count,
        }),
        now,
        now,
        now,
      ],
    );
  }

  private async persistEvidence(c: PoolConnection, input: PersistInput, writtenFiles: string[]) {
    const contentHash = createHash("sha256").update(input.rawContent).digest("hex"),
      recordKey = `erp:${createHash("sha256").update(input.value.external_id).digest("hex")}`,
      dedupeKey = `erp:${createHash("sha256")
        .update(`${input.value.external_id}\0${contentHash}`)
        .digest("hex")}`;
    const [existing] = await c.query<RowDataPacket[]>(
      "SELECT e.id evidence_id FROM raw_evidence e WHERE e.organization_id=? AND e.workspace_id=? AND e.provider_id=? AND e.dedupe_key=? LIMIT 1 FOR UPDATE",
      [input.context.organizationId, input.context.workspaceId, input.providerId, dedupeKey],
    );
    if (existing[0]) {
      const normalized = await this.createNormalizedVersion(
        c,
        input,
        String(existing[0].evidence_id),
        recordKey,
      );
      await this.linkTask(
        c,
        input,
        String(existing[0].evidence_id),
        normalized.recordId,
        "deduplicated",
      );
      return {
        evidenceId: String(existing[0].evidence_id),
        recordId: normalized.recordId,
        deduplicated: true,
      };
    }
    const evidenceId = randomUUID(),
      fileId = randomUUID(),
      fileInput = {
        organization_id: input.context.organizationId as OrganizationId,
        workspace_id: input.context.workspaceId as WorkspaceId,
        category: "evidence" as const,
        resource_id: evidenceId,
        filename: `${evidenceId}.json`,
      },
      target = buildScopedFilePath(this.evidenceRoot, fileInput);
    await writeScopedFile(this.evidenceRoot, fileInput, input.rawContent);
    writtenFiles.push(target);
    const relativePath = relative(resolve(this.evidenceRoot), target).split(sep).join("/");
    await c.query(
      "INSERT INTO file_assets (id,organization_id,workspace_id,category,relative_path,content_sha256,size_bytes,status,created_by,created_at,updated_at) VALUES (?,?,?,'evidence',?,?,?,'active',?,?,?)",
      [
        fileId,
        input.context.organizationId,
        input.context.workspaceId,
        relativePath,
        contentHash,
        input.rawContent.byteLength,
        input.context.actorId,
        input.now,
        input.now,
      ],
    );
    await c.query(
      "INSERT INTO raw_evidence (id,organization_id,workspace_id,collection_task_id,collection_subquery_id,provider_id,file_asset_id,source_url,canonical_url,dedupe_key,content_sha256,content_type,size_bytes,captured_at,parser_version,adapter_version,retention_until,status,request_id,trace_id,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'browser-helper-v1',?,'active',?,?,?,?)",
      [
        evidenceId,
        input.context.organizationId,
        input.context.workspaceId,
        input.taskId,
        input.subqueryId,
        input.providerId,
        fileId,
        input.value.source_url,
        input.value.source_url,
        dedupeKey,
        contentHash,
        "application/json",
        input.rawContent.byteLength,
        new Date(input.value.observed_at),
        "erp-product-catalog-v1",
        new Date(new Date(input.value.observed_at).getTime() + input.retentionDays * 86_400_000),
        input.context.requestId,
        input.context.traceId,
        input.context.actorId,
        input.now,
      ],
    );
    const normalized = await this.createNormalizedVersion(c, input, evidenceId, recordKey);
    await this.linkTask(c, input, evidenceId, normalized.recordId, "captured");
    return { evidenceId, recordId: normalized.recordId, deduplicated: false };
  }

  private async createNormalizedVersion(
    c: PoolConnection,
    input: PersistInput,
    evidenceId: string,
    recordKey: string,
  ) {
    const [previousRecords] = await c.query<RowDataPacket[]>(
      "SELECT id,raw_evidence_id,record_version FROM normalized_records WHERE organization_id=? AND workspace_id=? AND provider_id=? AND record_key=? AND status='active' ORDER BY record_version DESC LIMIT 1 FOR UPDATE",
      [input.context.organizationId, input.context.workspaceId, input.providerId, recordKey],
    );
    if (previousRecords[0] && String(previousRecords[0].raw_evidence_id) === evidenceId) {
      return { recordId: String(previousRecords[0].id), created: false };
    }
    const previousRecordId = previousRecords[0] ? String(previousRecords[0].id) : null,
      recordVersion = previousRecords[0] ? Number(previousRecords[0].record_version) + 1 : 1;
    const recordId = randomUUID();
    if (previousRecordId) {
      await c.query(
        "UPDATE normalized_records SET status='superseded' WHERE id=? AND status='active'",
        [previousRecordId],
      );
    }
    await c.query(
      "INSERT INTO normalized_records (id,organization_id,workspace_id,provider_id,raw_evidence_id,record_key,schema_version,record_version,payload_json,supersedes_record_id,correction_reason,status,request_id,trace_id,created_by,created_at) VALUES (?,?,?,?,?,?,'erp-product-catalog-v1',?,?,?,NULL,'active',?,?,?,?)",
      [
        recordId,
        input.context.organizationId,
        input.context.workspaceId,
        input.providerId,
        evidenceId,
        recordKey,
        recordVersion,
        JSON.stringify(input.value),
        previousRecordId,
        input.context.requestId,
        input.context.traceId,
        input.context.actorId,
        input.now,
      ],
    );
    for (const field of [
      "title",
      "image_url",
      "asin_list",
      "supplier_code",
      "cost_cny",
      "cost_usd",
    ]) {
      const source = JSON.stringify(input.value[field as keyof NormalizedErpProduct]);
      await c.query(
        "INSERT INTO field_provenance (id,organization_id,workspace_id,normalized_record_id,raw_evidence_id,field_path,source_path,transform_version,source_value_sha256,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
          randomUUID(),
          input.context.organizationId,
          input.context.workspaceId,
          recordId,
          evidenceId,
          field,
          `erp.product.${field}`,
          "erp-product-normalizer-v1",
          createHash("sha256").update(source).digest("hex"),
          input.now,
        ],
      );
    }
    return { recordId, created: true };
  }

  private async linkTask(
    c: PoolConnection,
    input: {
      taskId: string;
      subqueryId: string;
      providerId: string;
      context: ErpImportContext;
      now: Date;
    },
    evidenceId: string,
    recordId: string,
    linkType: "captured" | "deduplicated",
  ) {
    await c.query(
      "INSERT IGNORE INTO collection_task_evidence_links (id,organization_id,workspace_id,collection_task_id,collection_subquery_id,provider_id,raw_evidence_id,normalized_record_id,link_type,request_id,trace_id,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        randomUUID(),
        input.context.organizationId,
        input.context.workspaceId,
        input.taskId,
        input.subqueryId,
        input.providerId,
        evidenceId,
        recordId,
        linkType,
        input.context.requestId,
        input.context.traceId,
        input.context.actorId,
        input.now,
      ],
    );
  }

  private async projectProduct(
    c: PoolConnection,
    input: {
      evidenceId: string;
      recordId: string;
      providerId: string;
      taskId: string;
      value: NormalizedErpProduct;
      context: ErpImportContext;
      now: Date;
    },
  ) {
    const market = input.value.asin_list.length ? "US" : "GLOBAL",
      topicKey = createHash("sha256").update(`erp\0${input.value.external_id}`).digest("hex"),
      [topics] = await c.query<RowDataPacket[]>(
        "SELECT id FROM trend_topics WHERE organization_id=? AND workspace_id=? AND topic_key=? LIMIT 1 FOR UPDATE",
        [input.context.organizationId, input.context.workspaceId, topicKey],
      );
    const topicId = topics[0] ? String(topics[0].id) : randomUUID();
    if (!topics[0])
      await c.query(
        "INSERT INTO trend_topics (id,organization_id,workspace_id,topic_key,title,category,market,language,status,signal_count,source_count,heat_value,heat_unit,momentum_percent,confidence_score,confidence_status,first_seen_at,last_seen_at,source_fresh_at,version,created_by,created_at,updated_at) VALUES (?,?,?,?,?,'ERP商品库',?,'zh-CN','active',0,0,0,'signals',NULL,NULL,'insufficient_data',?,?,?,1,?,?,?)",
        [
          topicId,
          input.context.organizationId,
          input.context.workspaceId,
          topicKey,
          input.value.title.slice(0, 500),
          market,
          new Date(input.value.observed_at),
          new Date(input.value.observed_at),
          new Date(input.value.observed_at),
          input.context.actorId,
          input.now,
          input.now,
        ],
      );
    const signalId = randomUUID();
    await c.query(
      "INSERT IGNORE INTO trend_signals (id,organization_id,workspace_id,topic_id,normalized_record_id,raw_evidence_id,provider_id,title,publisher,canonical_url,published_at,observed_at,request_id,trace_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        signalId,
        input.context.organizationId,
        input.context.workspaceId,
        topicId,
        input.recordId,
        input.evidenceId,
        input.providerId,
        input.value.title,
        "米豆 ERP 商品库",
        input.value.source_url,
        new Date(input.value.observed_at),
        new Date(input.value.observed_at),
        input.context.requestId,
        input.context.traceId,
        input.now,
      ],
    );
    await c.query(
      "UPDATE trend_topics t SET signal_count=(SELECT COUNT(*) FROM trend_signals s WHERE s.topic_id=t.id),source_count=(SELECT COUNT(DISTINCT provider_id) FROM trend_signals s WHERE s.topic_id=t.id),heat_value=(SELECT COUNT(*) FROM trend_signals s WHERE s.topic_id=t.id),last_seen_at=GREATEST(last_seen_at,?),source_fresh_at=GREATEST(source_fresh_at,?),version=version+1,updated_at=? WHERE id=?",
      [new Date(input.value.observed_at), new Date(input.value.observed_at), input.now, topicId],
    );
    const [existingOpportunity] = await c.query<RowDataPacket[]>(
      "SELECT id FROM opportunities WHERE organization_id=? AND workspace_id=? AND source_type='trend_topic' AND source_ref_id=? LIMIT 1 FOR UPDATE",
      [input.context.organizationId, input.context.workspaceId, topicId],
    );
    const opportunityId = existingOpportunity[0] ? String(existingOpportunity[0].id) : randomUUID();
    if (!existingOpportunity[0])
      await c.query(
        "INSERT INTO opportunities (id,organization_id,workspace_id,name,market,category,source_type,source_ref_id,owner_id,lifecycle_status,recommendation_status,overall_score,trend_score,competition_score,profit_status,risk_level,confidence_status,confidence_score,evidence_count,source_count,coverage_status,score_rule_version,scored_at,decision_status,version,created_by,created_at,updated_at) VALUES (?,?,?,?,?,'ERP商品库','trend_topic',?,?,'ready','insufficient_data',NULL,NULL,NULL,'insufficient_data','unknown','insufficient_data',NULL,0,0,'partial',NULL,NULL,'pending',1,?,?,?)",
        [
          opportunityId,
          input.context.organizationId,
          input.context.workspaceId,
          input.value.title.slice(0, 200),
          market,
          topicId,
          input.context.actorId,
          input.context.actorId,
          input.now,
          input.now,
        ],
      );
    const [signal] = await c.query<RowDataPacket[]>(
      "SELECT id FROM trend_signals WHERE normalized_record_id=? LIMIT 1",
      [input.recordId],
    );
    await c.query(
      "INSERT IGNORE INTO opportunity_evidence_links (id,organization_id,workspace_id,opportunity_id,evidence_type,evidence_id,provider_id,raw_evidence_id,observed_at,created_at) VALUES (?,?,?,?,'trend_signal',?,?,?,?,?)",
      [
        randomUUID(),
        input.context.organizationId,
        input.context.workspaceId,
        opportunityId,
        String(signal[0]?.id ?? signalId),
        input.providerId,
        input.evidenceId,
        new Date(input.value.observed_at),
        input.now,
      ],
    );
    await c.query(
      "UPDATE opportunities o SET evidence_count=(SELECT COUNT(*) FROM opportunity_evidence_links l WHERE l.opportunity_id=o.id),source_count=(SELECT COUNT(DISTINCT provider_id) FROM opportunity_evidence_links l WHERE l.opportunity_id=o.id),coverage_status='partial',updated_at=? WHERE id=?",
      [input.now, opportunityId],
    );
    let competitorsCreated = 0;
    for (const asin of input.value.asin_list) {
      const id = randomUUID();
      const [result] = await c.query<any>(
        "INSERT IGNORE INTO competitors (id,organization_id,workspace_id,opportunity_id,provider_id,market,source_site,external_id,product_url,title,status,latest_snapshot_id,revision,created_by,created_at,updated_at) VALUES (?,?,?,?,?,'US','Amazon',?,?,?,'active',NULL,1,?,?,?)",
        [
          id,
          input.context.organizationId,
          input.context.workspaceId,
          opportunityId,
          input.providerId,
          asin,
          `https://www.amazon.com/dp/${asin}`,
          input.value.title,
          input.context.actorId,
          input.now,
          input.now,
        ],
      );
      competitorsCreated += Number(result.affectedRows ?? 0);
    }
    const [searches] = await c.query<RowDataPacket[]>(
      "SELECT id FROM sourcing_searches WHERE organization_id=? AND workspace_id=? AND input_type='opportunity' AND input_ref=? LIMIT 1",
      [input.context.organizationId, input.context.workspaceId, opportunityId],
    );
    const searchId = searches[0] ? String(searches[0].id) : randomUUID();
    let sourcingCreated = 0;
    if (!searches[0]) {
      await c.query(
        "INSERT INTO sourcing_searches (id,organization_id,workspace_id,collection_task_id,input_type,input_ref,status,candidate_count,missing_fields_json,request_id,trace_id,created_by,created_at,updated_at) VALUES (?,?,?,?,'opportunity',?,'succeeded_empty',0,?,?,?,?,?,?)",
        [
          searchId,
          input.context.organizationId,
          input.context.workspaceId,
          input.taskId,
          opportunityId,
          JSON.stringify([
            "supplier_listing",
            "supplier_name",
            "moq",
            "lead_time_days",
            "location",
          ]),
          input.context.requestId,
          input.context.traceId,
          input.context.actorId,
          input.now,
          input.now,
        ],
      );
      sourcingCreated = 1;
    }
    const referenceCost = input.value.cost_cny ?? input.value.cost_usd;
    if (input.value.supplier_code && referenceCost != null) {
      await c.query(
        "INSERT IGNORE INTO sourcing_candidates (id,organization_id,workspace_id,search_id,provider_id,normalized_record_id,raw_evidence_id,external_id,supplier_name,product_title,specification,moq,quoted_price,currency,lead_time_days,location,original_url,observed_at,confidence_value,status,missing_fields_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,NULL,NULL,?,?,NULL,NULL,?,?,NULL,'incomplete',?,?)",
        [
          randomUUID(),
          input.context.organizationId,
          input.context.workspaceId,
          searchId,
          input.providerId,
          input.recordId,
          input.evidenceId,
          createHash("sha256").update(`erp-cost\0${input.value.external_id}`).digest("hex"),
          input.value.supplier_code,
          input.value.title,
          referenceCost,
          input.value.cost_cny != null ? "CNY" : "USD",
          input.value.source_url,
          new Date(input.value.observed_at),
          JSON.stringify([
            "moq",
            "specification",
            "lead_time_days",
            "location",
            "confidence_value",
            "stability_status",
            "risk_level",
          ]),
          input.now,
        ],
      );
      await c.query(
        "UPDATE sourcing_searches SET status='completed_with_warnings',candidate_count=(SELECT COUNT(*) FROM sourcing_candidates WHERE search_id=?),missing_fields_json=?,updated_at=? WHERE id=?",
        [
          searchId,
          JSON.stringify([
            "moq",
            "specification",
            "lead_time_days",
            "location",
            "confidence_value",
            "stability_status",
            "risk_level",
          ]),
          input.now,
          searchId,
        ],
      );
    }
    return {
      opportunityCreated: existingOpportunity[0] ? 0 : 1,
      competitorsCreated,
      sourcingCreated,
    };
  }
}
